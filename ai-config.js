// AI Configuration for Feedback Analysis
const AI_CONFIG = {
  gemini: {
    apiKey: 'AIzaSyCe_s58z1KhkFj16_-w5MoDeRT-laL85WE', // Add your Gemini API key here
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    enabled: true
  }
};

class AIService {
  constructor() {
    this.config = AI_CONFIG.gemini;
  }

  async generateSummary(feedbacks) {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    if (!feedbacks || feedbacks.length === 0) {
      return {
        summary: 'No feedback available to analyze.',
        sentiment: { positive: 0, negative: 0, total: 0 }
      };
    }

    try {
      const prompt = this.createAnalysisPrompt(feedbacks);
      const response = await this.callGeminiAPI(prompt);
      
      return this.parseAIResponse(response, feedbacks.length);
    } catch (error) {
      console.error('AI summary generation failed:', error);
      return this.generateFallbackSummary(feedbacks);
    }
  }

  // Alias for backward compatibility
  async summarizeFeedback(feedbacks, url) {
    return await this.generateSummary(feedbacks);
  }

  createAnalysisPrompt(feedbacks) {
    const feedbackTexts = feedbacks.map((fb, index) => 
      `${index + 1}. ${fb.feedback || fb.feedback_text || fb.text || 'No content'}`
    ).join('\n');

    return `Analyze the following user feedback and provide:
1. A concise summary (2-3 sentences)
2. Sentiment analysis categorizing each feedback as positive or negative

Feedback to analyze:
${feedbackTexts}

Respond in this exact JSON format:
{
  "summary": "Brief summary of the feedback",
  "positive_feedback": ["List positive feedback points"],
  "negative_feedback": ["List negative feedback points"],
  "sentiment_counts": {
    "positive": number,
    "negative": number
  }
}`;
  }

  async callGeminiAPI(prompt) {
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    const response = await fetch(`${this.config.baseUrl}?key=${this.config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response format from Gemini API');
    }

    return data.candidates[0].content.parts[0].text;
  }

  parseAIResponse(responseText, totalFeedbacks) {
    try {
      const cleanResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanResponse);
      
      return {
        summary: parsed.summary || 'Analysis completed',
        sentiment: {
          positive: parsed.sentiment_counts?.positive || 0,
          negative: parsed.sentiment_counts?.negative || 0,
          total: totalFeedbacks
        },
        details: {
          positive_points: parsed.positive_feedback || [],
          negative_points: parsed.negative_feedback || []
        }
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return this.generateFallbackSummary(Array(totalFeedbacks).fill({}));
    }
  }

  generateFallbackSummary(feedbacks) {
    const total = feedbacks.length;
    const positiveKeywords = ['good', 'great', 'excellent', 'love', 'like', 'awesome', 'perfect', 'amazing','nice','fantastic','learn new things'];
    const negativeKeywords = ['bad', 'terrible', 'hate', 'dislike', 'awful', 'horrible', 'worst', 'annoying'];
    
    let positive = 0;
    let negative = 0;

    feedbacks.forEach(feedback => {
      const text = (feedback.feedback || feedback.feedback_text || feedback.text || '').toLowerCase();
      const hasPositive = positiveKeywords.some(keyword => text.includes(keyword));
      const hasNegative = negativeKeywords.some(keyword => text.includes(keyword));
      
      if (hasPositive && !hasNegative) positive++;
      else if (hasNegative && !hasPositive) negative++;
    });

    return {
      summary: `Analyzed ${total} feedback items. Basic sentiment analysis completed.`,
      sentiment: {
        positive: positive,
        negative: negative,
        total: total
      },
      details: {
        positive_points: [],
        negative_points: []
      }
    };
  }

  isConfigured() {
    return this.config.enabled && this.config.apiKey && this.config.apiKey.trim() !== '';
  }
}

// Initialize AI service
const aiService = new AIService();

// Export for use in other files and make available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIService, aiService };
}

// Make AIService available globally for browser usage
if (typeof window !== 'undefined') {
  window.AIService = AIService;
  window.aiService = aiService;
}