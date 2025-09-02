document.addEventListener('DOMContentLoaded', () => {
  const feedbackText = document.getElementById('feedbackText');
  const submitBtn = document.getElementById('submitFeedback');
  const refreshBtn = document.getElementById('refreshBtn');
  const urlDebugBtn = document.getElementById('urlDebugBtn');
  const generateSummaryBtn = document.getElementById('generateSummaryBtn');
  const searchInput = document.getElementById('searchFeedback');
  const feedbackList = document.getElementById('feedbackList');
  const feedbackCount = document.getElementById('feedbackCount');
  const todayCount = document.getElementById('todayCount');
  const currentUrlDiv = document.getElementById('currentUrl');
  const aiSummarySection = document.getElementById('aiSummarySection');
  const summaryContent = document.getElementById('summaryContent');
  const summaryText = document.getElementById('summaryText');
  const aiMessage = document.getElementById('aiMessage');
  const aiMessageText = document.getElementById('aiMessageText');
  const headerFeedbackCount = document.getElementById('headerFeedbackCount');
  const diagnosticPanel = document.getElementById('diagnosticPanel');
  const runDiagnosticBtn = document.getElementById('runDiagnosticBtn');

  let currentUrl = '';
  let allFeedbacks = [];
  let aiService = null;

  // Initialize
  init();

  async function init() {
    console.log('Initializing Dashboard...');
    await getCurrentUrl();
    await initializeAI();
    await testConnection();
    
    // Add a small delay to ensure URL is properly set
    if (!currentUrl) {
      console.warn('Current URL not detected, retrying...');
      await new Promise(resolve => setTimeout(resolve, 500));
      await getCurrentUrl();
    }
    
    await loadFeedbacks();
    updateStats();
    checkAISummaryAvailability();
    console.log('Dashboard initialization complete');
  }

  async function testConnection() {
    console.log('Testing database connection...');
    
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'testConnection'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Connection test failed - runtime error:', chrome.runtime.lastError);
        } else if (response && response.status === 'success') {
          console.log('Database connection test successful:', response.message);
        } else {
          console.error('Connection test failed:', response?.error || 'Unknown error');
        }
        resolve();
      });
    });
  }

  async function getCurrentUrl() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          currentUrl = tabs[0].url;
          console.log('Current URL detected:', currentUrl);
          displayCurrentUrl();
        } else {
          console.warn('No active tab found');
        }
        resolve();
      });
    });
  }

  function displayCurrentUrl() {
    try {
      const url = new URL(currentUrl);
      const domain = url.hostname.replace('www.', '');
      let displayUrl = domain;
      
      // For YouTube, show video ID or full path for better identification
      if (domain.includes('youtube.com')) {
        const urlParams = new URLSearchParams(url.search);
        const videoId = urlParams.get('v');
        if (videoId) {
          displayUrl = `${domain}/watch?v=${videoId}`;
        } else {
          displayUrl = domain + url.pathname;
        }
      } else {
        // For other sites, show more of the path
        const path = url.pathname;
        if (path && path !== '/') {
          displayUrl += path.length > 100 ? path.substring(0, 100) + '...' : path;
        }
      }
      
      currentUrlDiv.innerHTML = `<small class="text-muted">${displayUrl}</small>`;
    } catch (error) {
      currentUrlDiv.innerHTML = '<small class="text-muted">Invalid URL</small>';
    }
  }

  async function initializeAI() {
    try {
      // Load AI configuration using script tag instead of import
      if (!window.AIService) {
        const script = document.createElement('script');
        script.src = './ai-config.js';
        document.head.appendChild(script);
        
        // Wait for script to load
        await new Promise((resolve) => {
          script.onload = resolve;
          script.onerror = resolve; // Continue even if AI fails to load
        });
      }
      
      if (window.AIService) {
        aiService = new window.AIService();
        console.log('AI service initialized');
      }
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
    }
  }

  // Event Listeners
  submitBtn.addEventListener('click', submitFeedback);
  refreshBtn.addEventListener('click', loadFeedbacks);
  if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener('click', generateSummary);
  }
  searchInput.addEventListener('input', filterFeedbacks);
  
  // URL Debug button (hidden by default, shown when issues detected)
  if (urlDebugBtn) {
    urlDebugBtn.addEventListener('click', runURLDebug);
  }
  
  // Diagnostic button
  if (runDiagnosticBtn) {
    runDiagnosticBtn.addEventListener('click', runQuickDiagnostic);
  }

  feedbackText.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitFeedback();
    }
  });

  async function submitFeedback() {
    const text = feedbackText.value.trim();
    if (!text) {
      showNotification('Please enter your feedback', 'warning');
      return;
    }

    if (!currentUrl) {
      showNotification('Unable to get current page URL', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    try {
      const feedback = {
        id: generateId(),
        feedback: text,
        url: currentUrl,
        type: 'feedback'
      };

      console.log('Sending feedback to background script:', feedback);
      console.log('URL being used:', currentUrl);

      // Send to background script
      chrome.runtime.sendMessage({
        action: 'saveFeedback',
        feedback: feedback
      }, (response) => {
        console.log('Received response from background script:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          showNotification(`Communication error: ${chrome.runtime.lastError.message}`, 'error');
        } else if (response && response.status === 'success') {
          feedbackText.value = '';
          showNotification('Feedback submitted successfully!', 'success');
          // Force reload feedbacks to update count and display
          setTimeout(() => {
            loadFeedbacks();
          }, 500); // Small delay to ensure DB write is complete
        } else {
          console.error('Response error:', response);
          const errorMsg = response?.error || 'Unknown error occurred';
          showNotification(`Failed to submit feedback: ${errorMsg}`, 'error');
        }
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      showNotification(`Error submitting feedback: ${error.message}`, 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Feedback';
    }
  }

  async function loadFeedbacks() {
    if (!currentUrl) {
      console.warn('No current URL available for loading feedbacks');
      return;
    }

    console.log('Loading feedbacks for URL:', currentUrl);

    feedbackList.innerHTML = `
      <div class="text-center text-muted py-4">
        <i class="fas fa-spinner fa-spin fa-2x"></i>
        <p class="mt-2">Loading feedback...</p>
      </div>
    `;

    chrome.runtime.sendMessage({
      action: 'getFeedback',
      url: currentUrl
    }, (response) => {
      console.log('Received getFeedback response:', response);
      
      if (chrome.runtime.lastError) {
        console.error('Chrome runtime error:', chrome.runtime.lastError);
        feedbackList.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="fas fa-exclamation-circle fa-2x"></i>
            <p class="mt-2">Failed to load feedback</p>
            <small>Error: ${chrome.runtime.lastError.message}</small>
          </div>
        `;
      } else if (response && response.status === 'success') {
        allFeedbacks = response.feedbacks || [];
        console.log(`Successfully loaded ${allFeedbacks.length} feedbacks`);
        displayFeedbacks(allFeedbacks);
        updateStats();
        checkAISummaryAvailability();
        
        // Hide URL debug button if feedbacks are loading successfully
        if (urlDebugBtn && allFeedbacks.length > 0) {
          urlDebugBtn.style.display = 'none';
        }
        
        // Hide diagnostic panel if feedbacks are loading
        if (diagnosticPanel) {
          diagnosticPanel.style.display = 'none';
        }
      } else {
        console.error('Response error:', response);
        
        // Show diagnostic tools when there are issues
        if (urlDebugBtn) {
          urlDebugBtn.style.display = 'inline-block';
        }
        if (diagnosticPanel) {
          diagnosticPanel.style.display = 'block';
        }
        
        feedbackList.innerHTML = `
          <div class="text-center text-muted py-4">
            <i class="fas fa-exclamation-circle fa-2x"></i>
            <p class="mt-2">Failed to load feedback</p>
            <small>Error: ${response?.error || 'Unknown error'}</small>
            <br><button class="btn btn-sm btn-outline-primary mt-2" onclick="location.reload()">Retry</button>
          </div>
        `;
      }
    });
  }

  function displayFeedbacks(feedbacks) {
    console.log('Displaying feedbacks:', feedbacks.length, 'items');
    
    if (feedbacks.length === 0) {
      feedbackList.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="fas fa-comment-slash fa-2x"></i>
          <p class="mt-2">No feedback yet for this page</p>
          <small>Be the first to share your thoughts!</small>
        </div>
      `;
      
      // Show diagnostic panel when no feedback is displayed
      if (diagnosticPanel) {
        diagnosticPanel.style.display = 'block';
      }
      
      return;
    }

    // Hide diagnostic panel when feedback is displayed
    if (diagnosticPanel) {
      diagnosticPanel.style.display = 'none';
    }

    // Sort by created_at (newest first)
    feedbacks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    feedbackList.innerHTML = feedbacks.map(feedback => {
      const time = formatTime(feedback.created_at);
      const userId = feedback.user_id ? feedback.user_id.substring(0, 8) : 'anonymous';
      
      // Handle different feedback formats - check both 'feedback' and 'text' fields
      let feedbackContent = '';
      if (feedback.feedback) {
        feedbackContent = feedback.feedback;
      } else if (feedback.text) {
        feedbackContent = feedback.text;
      } else {
        feedbackContent = 'No content available';
      }
      
      return `
        <div class="feedback-item">
          <div class="feedback-content">${escapeHtml(feedbackContent)}</div>
          <div class="feedback-meta">
            <span class="feedback-time"><i class="fas fa-clock"></i> ${time}</span>
            <span class="feedback-user">User: ${userId}</span>
            ${feedback.type ? `<span class="feedback-type badge badge-info">${feedback.type}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function filterFeedbacks() {
    const query = searchInput.value.toLowerCase();
    const filtered = allFeedbacks.filter(feedback =>
      feedback.feedback.toLowerCase().includes(query)
    );
    displayFeedbacks(filtered);
  }

  function updateStats() {
    const total = allFeedbacks.length;
    const today = allFeedbacks.filter(f => {
      const feedbackDate = new Date(f.created_at).toDateString();
      const todayDate = new Date().toDateString();
      return feedbackDate === todayDate;
    }).length;

    feedbackCount.textContent = total;
    todayCount.textContent = today;
    
    // Update header count
    if (headerFeedbackCount) {
      headerFeedbackCount.textContent = total;
    }
    
    // Also update the page title to show feedback count
    const domain = window.location.hostname || 'this page';
    document.title = `Feedback Dashboard (${total} feedback${total !== 1 ? 's' : ''})`;
    
    console.log(`Stats updated: ${total} total, ${today} today`);
  }

  function checkAISummaryAvailability() {
    const minRequired = 5;
    const hasEnoughFeedback = allFeedbacks.length >= minRequired;

    if (hasEnoughFeedback) {
      aiSummarySection.style.display = 'block';
      aiMessage.style.display = 'none';
    } else {
      aiSummarySection.style.display = 'none';
      aiMessage.style.display = 'block';
      aiMessageText.textContent = `Need at least ${minRequired} feedback items to generate AI summary (currently ${allFeedbacks.length})`;
    }
  }

  async function generateSummary() {
    if (!aiService || allFeedbacks.length < 5) {
      showNotification('Need at least 5 feedback items for AI summary', 'warning');
      return;
    }

    if (!generateSummaryBtn) {
      console.error('Generate summary button not found');
      return;
    }

    generateSummaryBtn.disabled = true;
    generateSummaryBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    
    if (summaryContent) {
      summaryContent.style.display = 'block';
    }
    if (summaryText) {
      summaryText.innerHTML = `
        <div class="text-center py-3">
          <div class="loading-spinner"></div>
          <p class="mt-2 mb-0">AI is analyzing ${allFeedbacks.length} feedback items...</p>
        </div>
      `;
    }

    try {
      const result = await aiService.summarizeFeedback(allFeedbacks, currentUrl);
      if (summaryText) {
        summaryText.innerHTML = `
          <div class="ai-summary-content">
            <p class="mb-3">${result.summary}</p>
            <div class="sentiment-analysis">
              <h6><i class="fas fa-chart-pie"></i> Sentiment Analysis</h6>
              <div class="row">
                <div class="col-4">
                  <div class="text-center">
                    <div class="text-success font-weight-bold h4">${result.sentiment.positive}</div>
                    <small class="text-muted">Positive</small>
                  </div>
                </div>
                <div class="col-4">
                  <div class="text-center">
                    <div class="text-danger font-weight-bold h4">${result.sentiment.negative}</div>
                    <small class="text-muted">Negative</small>
                  </div>
                </div>
                <div class="col-4">
                  <div class="text-center">
                    <div class="text-info font-weight-bold h4">${result.sentiment.total}</div>
                    <small class="text-muted">Total</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
      showNotification('AI summary generated successfully!', 'success');
    } catch (error) {
      console.error('Failed to generate summary:', error);
      if (summaryText) {
        summaryText.innerHTML = `
          <div class="text-danger">
            <i class="fas fa-exclamation-triangle"></i>
            Failed to generate summary. Please check your AI configuration.
          </div>
        `;
      }
      showNotification('Failed to generate AI summary', 'error');
    }

    generateSummaryBtn.disabled = false;
    generateSummaryBtn.innerHTML = '<i class="fas fa-magic"></i> Generate Summary';
  }

  // Utility functions
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function generateId() {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible`;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.innerHTML = `
      ${message}
      <button type="button" class="close" onclick="this.parentElement.remove()">
        <span>&times;</span>
      </button>
    `;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
  }

  async function runURLDebug() {
    console.log('Running URL Debug...');
    showNotification('URL debug functionality has been simplified.', 'info');
  }

  async function runQuickDiagnostic() {
    console.log('Running Quick Diagnostic...');
    runDiagnosticBtn.disabled = true;
    runDiagnosticBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    
    showNotification('Diagnostic complete. Check browser console for results.', 'info');
    
    runDiagnosticBtn.disabled = false;
    runDiagnosticBtn.innerHTML = '<i class="fas fa-stethoscope"></i> Diagnose';
  }

  // Listen for tab changes to update URL
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(() => {
      setTimeout(() => {
        init();
      }, 100);
    });
  }

  if (chrome.tabs && chrome.tabs.onUpdated) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url) {
        setTimeout(() => {
          init();
        }, 100);
      }
    });
  }
});
