// Import Supabase modules directly (ES6 modules are supported in service workers)
import { createClient } from './supabase-simple.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

let supabaseClient;

// Initialize Supabase immediately when service worker starts
console.log('Service worker starting, initializing Supabase...');
initializeSupabase().then(result => {
  console.log('Startup Supabase initialization:', result);
}).catch(error => {
  console.error('Startup Supabase initialization failed:', error);
});

async function initializeSupabase() {
  if (!supabaseClient) {
    try {
      console.log('Initializing Supabase with URL:', SUPABASE_URL);
      console.log('SUPABASE_ANON_KEY defined:', !!SUPABASE_ANON_KEY);
      
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Supabase URL or Anon Key is not defined. Please check supabase-config.js');
        console.error('SUPABASE_URL:', SUPABASE_URL);
        console.error('SUPABASE_ANON_KEY defined:', !!SUPABASE_ANON_KEY);
        return false;
      }

      supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase client created:', !!supabaseClient);
      console.log('Supabase initialized successfully in background');
      return true;
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      console.error('Error details:', error.message, error.stack);
      return false;
    }
  }
  console.log('Supabase already initialized');
  return true;
}

chrome.runtime.onInstalled.addListener(async () => {
  // Generate anonymous user ID
  chrome.storage.local.get('anonymousUserId', (data) => {
    if (!data.anonymousUserId) {
      const anonymousId = 'anon_' + Math.random().toString(36).substr(2, 16);
      chrome.storage.local.set({ anonymousUserId: anonymousId });
    }
  });
  
  // Initialize Supabase
  await initializeSupabase();
});

// Open dashboard when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);
  
  if (request.action === 'ping') {
    sendResponse({ status: 'success', message: 'Extension is active', timestamp: new Date().toISOString() });
    return true;
  }
  
  if (request.action === 'saveFeedback') {
    handleSaveFeedback(request.feedback, sendResponse);
    return true;
  }

  if (request.action === 'getFeedback') {
    handleGetFeedback(request.url, sendResponse);
    return true;
  }
  
  if (request.action === 'testConnection') {
    handleTestConnection(sendResponse);
    return true;
  }

  // If no action matches, send error response
  console.warn('Unknown action received:', request.action);
  sendResponse({ status: 'error', error: 'Unknown action' });
});

async function handleSaveFeedback(feedback, sendResponse) {
  console.log('Handling save feedback request:', feedback);
  
  try {
    const initialized = await initializeSupabase();
    if (!initialized) {
      console.error('Supabase initialization failed');
      sendResponse({ status: 'error', error: 'Database connection failed' });
      return;
    }

    if (!supabaseClient) {
      console.error('Supabase client not available');
      sendResponse({ status: 'error', error: 'Supabase not initialized' });
      return;
    }

    chrome.storage.local.get('anonymousUserId', async (data) => {
      try {
        const feedbackData = {
          url: feedback.url,
          feedback: feedback.feedback, // Use the 'feedback' column (NOT NULL)
          user_id: data.anonymousUserId,
          created_at: new Date().toISOString(),
        };
        
        console.log('Attempting to save feedback data:', feedbackData);
        
        const result = await supabaseClient
          .from('feedback')
          .insert([feedbackData]);

        console.log('Full insert result:', result);

        if (result.error) {
          console.error('Database insert error:', result.error);
          throw new Error(`Database error: ${result.error.message || JSON.stringify(result.error)}`);
        }
        
        console.log('Feedback saved successfully:', result.data);
        sendResponse({ status: 'success', id: result.data ? result.data[0]?.id : null });
      } catch (error) {
        console.error('Error saving feedback:', error);
        const errorMessage = error.message || error.error?.message || JSON.stringify(error) || 'Unknown error occurred';
        sendResponse({ status: 'error', error: errorMessage });
      }
    });
  } catch (error) {
    console.error('Error in handleSaveFeedback:', error);
    const errorMessage = error.message || error.error?.message || JSON.stringify(error) || 'Unknown error occurred';
    sendResponse({ status: 'error', error: errorMessage });
  }
}

async function handleGetFeedback(url, sendResponse) {
  console.log('Handling getFeedback request for URL:', url);
  
  try {
    await initializeSupabase();
    
    if (!supabaseClient) {
      console.error('Supabase client not available for getFeedback');
      sendResponse({ status: 'error', feedbacks: [], error: 'Supabase not initialized' });
      return;
    }

    console.log('Querying feedback table for URL:', url);
    const { data, error } = await supabaseClient
      .from('feedback')
      .select('*')
      .eq('url', url)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database query error:', error);
      throw error;
    }
    
    console.log(`Found ${data.length} feedback items for URL:`, url);
    
    sendResponse({ status: 'success', feedbacks: data });
  } catch (error) {
    console.error('Error getting feedback:', error);
    const errorMessage = error.message || error.error?.message || JSON.stringify(error) || 'Unknown error occurred';
    sendResponse({ status: 'error', feedbacks: [], error: errorMessage });
  }
}

async function handleTestConnection(sendResponse) {
  try {
    const initialized = await initializeSupabase();
    if (initialized && supabaseClient) {
      // A simple query to test the connection
      const { data, error } = await supabaseClient.from('feedback').select('id').limit(1);
      if (error) {
        // Check if it's a table not found error during initial setup
        if (error.message.includes('does not exist') || error.message.includes('relation') || error.message.includes('42P01')) {
           sendResponse({ status: 'success', message: 'Supabase connected, but table might not exist yet.' });
        } else {
          throw error;
        }
      } else {
        sendResponse({ status: 'success', message: 'Supabase connected successfully' });
      }
    } else {
      sendResponse({ status: 'error', error: 'Supabase initialization failed' });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    const errorMessage = error.message || error.error?.message || JSON.stringify(error) || 'Unknown error occurred';
    sendResponse({ status: 'error', error: errorMessage });
  }
}
