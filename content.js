// Simplified content script - Supabase operations moved to background
let currentFeedbacks = [];

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'sendToFirebase') {
    // This is handled by background script now
    sendResponse({ status: 'success' });
    return true;
  }

  if (request.action === 'getFeedbackFromFirebase') {
    // This is handled by background script now  
    sendResponse({ status: 'success', feedbacks: [] });
    return true;
  }

  if (request.action === 'generateSummary') {
    // Generate summary when user clicks the button in dashboard
    if (currentFeedbacks.length > 0) {
      try {
        // Load AI config if not already loaded
        if (!window.AIService) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('ai-config.js');
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        }
        
        const aiService = new window.AIService();
        const summary = await aiService.summarizeFeedback(currentFeedbacks, window.location.href);
        sendResponse({ status: 'success', summary: summary });
      } catch (error) {
        console.error('Error generating summary:', error);
        sendResponse({ status: 'error', error: error.message });
      }
    } else {
      sendResponse({ status: 'error', error: 'No feedback available' });
    }
    return true;
  }
});
