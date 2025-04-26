// Background script for ScreenAnalyzer extension

// Initialize the extension context menu
chrome.runtime.onInstalled.addListener(function() {
  chrome.contextMenus.create({
    id: "screenanalyzer-menu",
    title: "Analyze with ScreenAnalyzer",
    contexts: ["page", "selection", "image"]
  });
  
  // Create side panel
  if (chrome.sidePanel) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async function(info, tab) {
  if (info.menuItemId === "screenanalyzer-menu") {
    // Handle the context menu click based on the context
    if (info.selectionText) {
      // Text selection was made
      await analyzeText(info.selectionText, tab.id);
    } else if (info.srcUrl && info.srcUrl.startsWith('data:image')) {
      // Image data URL was selected
      await analyzeDataUrlImage(info.srcUrl, tab.id);
    } else if (info.srcUrl) {
      // Image URL was selected
      await analyzeImageUrl(info.srcUrl, tab.id);
    } else {
      // Full page was selected
      await analyzePage(tab);
    }
    
    // Open the side panel
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  }
});

// Handle action button click
chrome.action.onClicked.addListener(function(tab) {
  // Open or focus the side panel
  if (chrome.sidePanel) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Text analysis function
async function analyzeText(text, tabId) {
  try {
    chrome.tabs.sendMessage(tabId, { action: "showNotification", message: "Analyzing selected text...", isError: false }, () => {
      if (chrome.runtime.lastError) console.warn('showNotification failed:', chrome.runtime.lastError.message);
    });
    
    // Here you would typically send the text to your AI service
    // For now, we'll just create a placeholder analysis result
    const results = {
      summary: `Analysis of selected text (${text.length} characters): This appears to be a snippet about ${text.substring(0, 30)}...`,
      nextSteps: "Consider expanding this analysis with a real AI service integration."
    };
    
    // Send results to content script
    chrome.tabs.sendMessage(tabId, { action: "showAnalysisResults", results }, () => {
      if (chrome.runtime.lastError) console.warn('showAnalysisResults failed:', chrome.runtime.lastError.message);
    });
    
    // Save to history
    saveToHistory({
      type: "text",
      text: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
      summary: results.summary,
      nextSteps: results.nextSteps,
      timestamp: Date.now()
    });
    
    return results;
  } catch (error) {
    console.error("Error analyzing text:", error);
    chrome.tabs.sendMessage(tabId, {
      action: "showNotification",
      message: "Error analyzing text: " + error.message,
      isError: true
    });
    return { error: error.message };
  }
}

// Image URL analysis function
async function analyzeImageUrl(imageUrl, tabId) {
  try {
    chrome.tabs.sendMessage(tabId, { action: "showNotification", message: "Analyzing image...", isError: false }, () => {
      if (chrome.runtime.lastError) console.warn('showNotification failed:', chrome.runtime.lastError.message);
    });
    
    // Here you would typically process the image URL
    // For now, we'll just create a placeholder
    const results = {
      summary: `Analysis of image: ${imageUrl.substring(0, 50)}...`,
      nextSteps: "Consider integrating with Tesseract.js for OCR capabilities."
    };
    
    // Send results to content script
    chrome.tabs.sendMessage(tabId, { action: "showAnalysisResults", results }, () => {
      if (chrome.runtime.lastError) console.warn('showAnalysisResults failed:', chrome.runtime.lastError.message);
    });
    
    // Save to history
    saveToHistory({
      type: "image",
      text: imageUrl.substring(0, 100) + (imageUrl.length > 100 ? "..." : ""),
      summary: results.summary,
      nextSteps: results.nextSteps,
      timestamp: Date.now()
    });
    
    return results;
  } catch (error) {
    console.error("Error analyzing image URL:", error);
    chrome.tabs.sendMessage(tabId, {
      action: "showNotification",
      message: "Error analyzing image: " + error.message,
      isError: true
    });
    return { error: error.message };
  }
}

// Data URL image analysis function
async function analyzeDataUrlImage(dataUrl, tabId) {
  try {
    chrome.tabs.sendMessage(tabId, { action: "showNotification", message: "Analyzing screenshot...", isError: false }, () => {
      if (chrome.runtime.lastError) console.warn('showNotification failed:', chrome.runtime.lastError.message);
    });
    
    // Here you would typically process the data URL
    // For now, we'll just create a placeholder
    const results = {
      summary: "Analysis of screenshot: The image appears to contain some text that could be extracted with OCR.",
      nextSteps: "Consider using the improved Tesseract.js v3 for better OCR results."
    };
    
    // Send results to content script
    chrome.tabs.sendMessage(tabId, { action: "showAnalysisResults", results }, () => {
      if (chrome.runtime.lastError) console.warn('showAnalysisResults failed:', chrome.runtime.lastError.message);
    });
    
    // Save to history
    saveToHistory({
      type: "screenshot",
      summary: results.summary,
      nextSteps: results.nextSteps,
      timestamp: Date.now()
    });
    
    return results;
  } catch (error) {
    console.error("Error analyzing data URL image:", error);
    chrome.tabs.sendMessage(tabId, {
      action: "showNotification",
      message: "Error analyzing screenshot: " + error.message,
      isError: true
    });
    return { error: error.message };
  }
}

// Page analysis function
async function analyzePage(tab) {
  try {
    chrome.tabs.sendMessage(tab.id, { action: "showNotification", message: "Analyzing page...", isError: false }, () => {
      if (chrome.runtime.lastError) console.warn('showNotification failed:', chrome.runtime.lastError.message);
    });
    
    // Get page content from content script
    const pageContent = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "getPageContent" }, response => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
    
    // Here you would typically analyze the page content
    // For now, we'll just create a placeholder
    const results = {
      summary: `Analysis of page ${tab.title}: This page appears to be about ${pageContent.description || "a topic that's not clearly described in meta tags"}.`,
      nextSteps: "Consider extracting more specific information from the page content for better analysis."
    };
    
    // Send results to content script
    chrome.tabs.sendMessage(tab.id, { action: "showAnalysisResults", results }, () => {
      if (chrome.runtime.lastError) console.warn('showAnalysisResults failed:', chrome.runtime.lastError.message);
    });
    
    // Save to history
    saveToHistory({
      type: "page",
      text: tab.title,
      url: tab.url,
      summary: results.summary,
      nextSteps: results.nextSteps,
      timestamp: Date.now()
    });
    
    return results;
  } catch (error) {
    console.error("Error analyzing page:", error);
    chrome.tabs.sendMessage(tab.id, {
      action: "showNotification",
      message: "Error analyzing page: " + error.message,
      isError: true
    });
    return { error: error.message };
  }
}

// Save to history function
async function saveToHistory(entry) {
  try {
    // Check if auto-save is enabled
    const { autoSaveHistory = true } = await chrome.storage.sync.get('autoSaveHistory');
    
    if (autoSaveHistory) {
      const { analysisHistory = [] } = await chrome.storage.sync.get('analysisHistory');
      // Keep only the most recent 20 entries to avoid storage limits
      const updatedHistory = [entry, ...analysisHistory].slice(0, 20);
      await chrome.storage.sync.set({ analysisHistory: updatedHistory });
    }
  } catch (error) {
    console.error('Error saving to history:', error);
  }
}

// Chat API communication
async function sendChatMessage(message, model, apiKey) {
  try {
    // Using Groq API for chat
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Be concise yet thorough in your responses.'
          },
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Chat API error:', { url: 'https://api.groq.com/openai/v1/chat/completions', error });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title: 'API Error',
      message: error.message || 'Failed to process request'
    });
    throw error;
  }
}

// Handle chat API with conversation history
async function sendChatWithHistory(history, model, apiKey) {
  try {
    // Prepare the messages array for the API
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Be concise yet thorough in your responses.'
      },
      ...history.map(msg => ({ role: msg.role, content: msg.content }))
    ];
    
    // Using Groq API for chat
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 800
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Chat API error:', { url: 'https://api.groq.com/openai/v1/chat/completions', error });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon48.png',
      title: 'API Error',
      message: error.message || 'Failed to process request'
    });
    throw error;
  }
}

// Handle messages from other parts of the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle different message actions
  if (message.action === 'chatMessage') {
    // Handle chat messages with or without history
    if (message.history) {
      // Chat with history
      sendChatWithHistory(message.history, message.model, message.apiKey)
        .then(reply => {
          sendResponse({ success: true, reply });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
    } else {
      // Single message chat
      sendChatMessage(message.messageText, message.model, message.apiKey)
        .then(reply => {
          sendResponse({ success: true, reply });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
    }
    return true; // Keep the message channel open for async response
  } else if (message.action === 'getPageContent') {
    try {
      // Forward the request to the active tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length === 0) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getPageContent' }, function(response) {
          if (chrome.runtime.lastError) {
            sendResponse({ 
              success: false, 
              error: chrome.runtime.lastError.message || 'Failed to get page content' 
            });
          } else {
            sendResponse({ success: true, content: response });
          }
        });
      });
      return true; // Keep the message channel open for async response
    } catch (error) {
      sendResponse({ success: false, error: error.message });
      return true;
    }
  } else if (message.action === 'openSidePanel') {
    if (chrome.sidePanel && sender.tab) {
      chrome.sidePanel.open({ tabId: sender.tab.id });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'sidePanel API not available' });
    }
  }
});