document.addEventListener('DOMContentLoaded', () => {
  const feedbackList = document.getElementById('feedbackList');
  const searchInput = document.getElementById('search');
  const refreshButton = document.getElementById('refreshFeedback');
  const generateSummaryBtn = document.getElementById('generateSummary');
  const showSummaryBtn = document.getElementById('showSummaryBtn');
  const closeSummaryBtn = document.getElementById('closeSummary');
  const summarySection = document.getElementById('summarySection');
  const summaryContent = document.getElementById('summaryContent');
  const summaryFeedbackCount = document.getElementById('summaryFeedbackCount');
  const aiSummaryAlert = document.getElementById('aiSummaryAlert');
  const highlightButton = document.getElementById('highlight');
  const feedbackButton = document.getElementById('feedback');
  const highlightColorInput = document.getElementById('highlightColor');

  let currentFeedbacks = [];
  let aiService = null;

  // Initialize AI service
  async function initializeAI() {
    if (!aiService) {
      try {
        // Load AI configuration
        const script = document.createElement('script');
        script.src = './ai-config.js';
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        
        aiService = new window.AIService();
        console.log('AI service initialized in popup');
      } catch (error) {
        console.error('Failed to initialize AI service:', error);
      }
    }
  }

  // Load initial feedback
  loadFeedbackForCurrentPage();
  initializeAI();

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    const filteredFeedbacks = currentFeedbacks.filter(feedback =>
      (feedback.text && feedback.text.toLowerCase().includes(query)) ||
      (feedback.feedback && feedback.feedback.toLowerCase().includes(query))
    );
    displayFeedbacks(filteredFeedbacks);
  });

  refreshButton.addEventListener('click', () => {
    loadFeedbackForCurrentPage();
  });

  generateSummaryBtn.addEventListener('click', () => {
    generateSummary();
  });

  showSummaryBtn.addEventListener('click', () => {
    generateSummary();
  });

  closeSummaryBtn.addEventListener('click', () => {
    summarySection.style.display = 'none';
  });

  highlightButton.addEventListener('change', () => {
    if (highlightButton.checked) {
      chrome.runtime.sendMessage({
        action: 'setMode',
        mode: 'highlight',
        color: highlightColorInput.value
      });
    }
  });

  feedbackButton.addEventListener('change', () => {
    if (feedbackButton.checked) {
      chrome.runtime.sendMessage({ 
        action: 'setMode', 
        mode: 'feedback' 
      });
    }
  });

  function loadFeedbackForCurrentPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentUrl = tabs[0].url;
      console.log('Popup loading feedbacks for URL:', currentUrl);
      
      chrome.runtime.sendMessage({
        action: 'getFeedback',
        url: currentUrl
      }, (response) => {
        console.log('Popup received getFeedback response:', response);
        
        if (chrome.runtime.lastError) {
          console.error('Popup chrome runtime error:', chrome.runtime.lastError);
        } else if (response && response.status === 'success') {
          currentFeedbacks = response.feedbacks || [];
          console.log(`Popup successfully loaded ${currentFeedbacks.length} feedbacks`);
          displayFeedbacks(currentFeedbacks);
          updateSummaryAvailability();
        } else {
          console.error('Popup response error:', response);
          currentFeedbacks = [];
          displayFeedbacks(currentFeedbacks);
          updateSummaryAvailability();
        }
      });
    });
  }

  function displayFeedbacks(feedbacks) {
    feedbackList.innerHTML = '';
    
    console.log('Popup displaying feedbacks:', feedbacks.length, 'items');
    
    if (feedbacks.length === 0) {
      const li = document.createElement('li');
      li.classList.add('list-group-item', 'text-muted', 'text-center');
      li.innerHTML = '<i class="fas fa-info-circle"></i> No feedback yet for this page';
      feedbackList.appendChild(li);
      return;
    }

    feedbacks.forEach(feedback => {
      const li = document.createElement('li');
      li.classList.add('list-group-item');
      
      const date = new Date(feedback.created_at).toLocaleDateString();
      const time = new Date(feedback.created_at).toLocaleTimeString();
      
      let content = '';
      
      // Handle different types of feedback content
      if (feedback.type === 'highlight' && feedback.text) {
        content = `
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="badge badge-warning mr-2">Highlight</span>
              <strong>"${feedback.text.substring(0, 50)}${feedback.text.length > 50 ? '...' : ''}"</strong>
              ${feedback.feedback ? `<br><small class="text-muted">${feedback.feedback}</small>` : ''}
            </div>
            <small class="text-muted">${date}<br>${time}</small>
          </div>
        `;
      } else if (feedback.feedback) {
        // Regular feedback - check both 'feedback' field and 'type'
        const badgeType = feedback.type === 'feedback' ? 'info' : 'primary';
        const badgeText = feedback.type === 'feedback' ? 'Feedback' : (feedback.type || 'Comment');
        content = `
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="badge badge-${badgeType} mr-2">${badgeText}</span>
              <span>${feedback.feedback}</span>
            </div>
            <small class="text-muted">${date}<br>${time}</small>
          </div>
        `;
      } else if (feedback.text) {
        // Fallback for text-only content
        content = `
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="badge badge-secondary mr-2">Note</span>
              <span>${feedback.text}</span>
            </div>
            <small class="text-muted">${date}<br>${time}</small>
          </div>
        `;
      } else {
        // Fallback for unknown format
        content = `
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <span class="badge badge-light mr-2">Unknown</span>
              <span class="text-muted">No content available</span>
            </div>
            <small class="text-muted">${date}<br>${time}</small>
          </div>
        `;
      }
      
      li.innerHTML = content;
      feedbackList.appendChild(li);
    });
  }

  function updateSummaryAvailability() {
    const minFeedbackCount = window.AI_CONFIG?.settings?.minFeedbackCount || 3;
    const hasSufficientFeedback = currentFeedbacks.length >= minFeedbackCount;
    
    if (hasSufficientFeedback) {
      generateSummaryBtn.style.display = 'inline-block';
      aiSummaryAlert.style.display = 'block';
    } else {
      generateSummaryBtn.style.display = 'none';
      aiSummaryAlert.style.display = 'none';
      summarySection.style.display = 'none';
    }
  }

  async function generateSummary() {
    if (currentFeedbacks.length === 0) {
      return;
    }

    summarySection.style.display = 'block';
    summaryContent.innerHTML = `
      <div class="text-center">
        <div class="spinner-border spinner-border-sm text-primary" role="status">
          <span class="sr-only">Loading...</span>
        </div>
        <p class="mt-2 mb-0"><small>Generating AI summary with Google Gemini...</small></p>
      </div>
    `;
    summaryFeedbackCount.textContent = currentFeedbacks.length;

    try {
      // Send message to content script to generate summary
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { 
          action: 'generateSummary' 
        }, (response) => {
          if (response && response.status === 'success') {
            summaryContent.innerHTML = `
              <div class="summary-text">
                <p class="mb-0">${response.summary}</p>
              </div>
            `;
          } else {
            summaryContent.innerHTML = `
              <div class="text-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <small>Failed to generate summary: ${response?.error || 'Unknown error'}. Please check your AI API configuration.</small>
              </div>
            `;
          }
        });
      });
    } catch (error) {
      console.error('Failed to generate summary:', error);
      summaryContent.innerHTML = `
        <div class="text-danger">
          <i class="fas fa-exclamation-triangle"></i>
          <small>Failed to generate summary. Please try again.</small>
        </div>
      `;
    }
  }
});
