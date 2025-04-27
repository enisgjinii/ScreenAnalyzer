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
    // First, ensure the content script is loaded
    try {
      await ensureContentScriptLoaded(tab.id);
      
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
    } catch (error) {
      console.error("Error handling context menu click:", error);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon48.png',
        title: 'Error',
        message: error.message || 'Failed to analyze content'
      });
    }
  }
});

// Function to ensure content script is loaded before sending messages
async function ensureContentScriptLoaded(tabId) {
  return new Promise((resolve, reject) => {
    // First check if we can communicate with the content script
    chrome.tabs.sendMessage(tabId, { action: "ping" }, response => {
      if (chrome.runtime.lastError) {
        // Content script is not loaded, inject it
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['js/content.js']
        })
        .then(() => {
          // Now verify the content script is working
          setTimeout(() => {
            chrome.tabs.sendMessage(tabId, { action: "ping" }, verifyResponse => {
              if (chrome.runtime.lastError) {
                reject(new Error("Content script couldn't be loaded properly"));
              } else {
                resolve();
              }
            });
          }, 200); // Short delay to ensure script is fully initialized
        })
        .catch(err => {
          reject(new Error("Failed to inject content script: " + err.message));
        });
      } else {
        // Content script is already loaded
        resolve();
      }
    });
  });
}

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
    await sendMessageToTab(tabId, { action: "showNotification", message: "Analyzing selected text...", isError: false });
    
    // Here you would typically send the text to your AI service
    // For now, we'll just create a placeholder analysis result
    const results = {
      summary: `Analysis of selected text (${text.length} characters): This appears to be a snippet about ${text.substring(0, 30)}...`,
      nextSteps: "Consider expanding this analysis with a real AI service integration."
    };
    
    // Send results to content script
    await sendMessageToTab(tabId, { action: "showAnalysisResults", results });
    
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
    try {
      await sendMessageToTab(tabId, {
        action: "showNotification",
        message: "Error analyzing text: " + error.message,
        isError: true
      });
    } catch (e) {
      console.error("Failed to show error notification:", e);
    }
    return { error: error.message };
  }
}

// Image URL analysis function
async function analyzeImageUrl(imageUrl, tabId) {
  try {
    await sendMessageToTab(tabId, { action: "showNotification", message: "Analyzing image...", isError: false });
    
    // Here you would typically process the image URL
    // For now, we'll just create a placeholder
    const results = {
      summary: `Analysis of image: ${imageUrl.substring(0, 50)}...`,
      nextSteps: "Consider integrating with Tesseract.js for OCR capabilities."
    };
    
    // Send results to content script
    await sendMessageToTab(tabId, { action: "showAnalysisResults", results });
    
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
    try {
      await sendMessageToTab(tabId, {
        action: "showNotification",
        message: "Error analyzing image: " + error.message,
        isError: true
      });
    } catch (e) {
      console.error("Failed to show error notification:", e);
    }
    return { error: error.message };
  }
}

// Data URL image analysis function
async function analyzeDataUrlImage(dataUrl, tabId) {
  try {
    await sendMessageToTab(tabId, { action: "showNotification", message: "Analyzing screenshot...", isError: false });
    
    // Here you would typically process the data URL
    // For now, we'll just create a placeholder
    const results = {
      summary: "Analysis of screenshot: The image appears to contain some text that could be extracted with OCR.",
      nextSteps: "Consider using the improved Tesseract.js v3 for better OCR results."
    };
    
    // Send results to content script
    await sendMessageToTab(tabId, { action: "showAnalysisResults", results });
    
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
    try {
      await sendMessageToTab(tabId, {
        action: "showNotification",
        message: "Error analyzing screenshot: " + error.message,
        isError: true
      });
    } catch (e) {
      console.error("Failed to show error notification:", e);
    }
    return { error: error.message };
  }
}

// Page analysis function
async function analyzePage(tab) {
  try {
    await sendMessageToTab(tab.id, { action: "showNotification", message: "Analyzing page...", isError: false });
    
    // Get page content from content script
    const pageContent = await getPageContentFromTab(tab.id);
    
    // Here you would typically analyze the page content
    // For now, we'll just create a placeholder
    const results = {
      summary: `Analysis of page ${tab.title}: This page appears to be about ${pageContent.description || "a topic that's not clearly described in meta tags"}.`,
      nextSteps: "Consider extracting more specific information from the page content for better analysis."
    };
    
    // Send results to content script
    await sendMessageToTab(tab.id, { action: "showAnalysisResults", results });
    
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
    try {
      await sendMessageToTab(tab.id, {
        action: "showNotification",
        message: "Error analyzing page: " + error.message,
        isError: true
      });
    } catch (e) {
      console.error("Failed to show error notification:", e);
    }
    return { error: error.message };
  }
}

// Helper function to send messages to tabs with proper error handling
async function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Helper function to get page content from a tab
async function getPageContentFromTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: "getPageContent" }, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// New function: Capture screenshot of the current tab
async function captureScreenshot() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (!tabs || tabs.length === 0) {
        reject(new Error('No active tab found'));
        return;
      }
      
      const activeTab = tabs[0];
      try {
        // Ensure we have the activeTab permission
        await chrome.tabs.update(activeTab.id, {active: true});
        
        // Capture the visible tab content
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {format: 'png'});
        resolve({
          success: true,
          dataUrl: dataUrl
        });
      } catch (error) {
        console.error('Screenshot capture error:', error);
        reject(new Error('Failed to capture screenshot: ' + error.message));
      }
    });
  });
}

// New function: Generic content analysis that calls the Groq API
async function analyzeGenericContent(payload, model, apiKey) {
  try {
    let analysisPrompt = "";
    
    if (payload.type === 'pageContent') {
      const pageData = payload.data;
      analysisPrompt = `Analyze this webpage:
Title: ${pageData.title || 'Untitled'}
URL: ${pageData.url || 'No URL provided'}
Description: ${pageData.description || 'No meta description'}

Content:
${pageData.content?.substring(0, 15000) || 'No content available'}

Provide a concise summary of what this page is about and key information it contains. 
Then, provide recommended next steps or actions based on this content.`;
    } else if (payload.type === 'plainText') {
      analysisPrompt = `Analyze the following text extracted from a screenshot or image:
${payload.data?.substring(0, 15000) || 'No text provided'}

Provide a concise summary of what this text contains and its key points.
Then, suggest next steps or actions based on this content.`;
    } else {
      throw new Error('Unsupported content type for analysis');
    }
    
    // Call the Groq API
    const apiResponse = await sendChatMessage(analysisPrompt, model, apiKey);
    
    // Process the response to extract summary and next steps
    const parts = apiResponse.split('\n\n');
    let summary = apiResponse;
    let nextSteps = "";
    
    // Try to identify if there are next steps in the response
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].toLowerCase();
      if (part.includes('next step') || part.includes('recommendation') || part.includes('action') ||
          part.includes('suggested') || part.startsWith('next:')) {
        summary = parts.slice(0, i).join('\n\n');
        nextSteps = parts.slice(i).join('\n\n');
        break;
      }
    }
    
    // If no clear next steps section, use default split (70/30)
    if (!nextSteps) {
      const splitPoint = Math.floor(apiResponse.length * 0.7);
      summary = apiResponse.substring(0, splitPoint);
      nextSteps = apiResponse.substring(splitPoint);
    }
    
    return {
      success: true,
      summary: summary.trim(),
      nextSteps: nextSteps.trim()
    };
  } catch (error) {
    console.error('Error analyzing content:', error);
    return {
      success: false,
      error: error.message || 'Failed to analyze content'
    };
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
  if (message.action === 'ping') {
    // Simple ping to check if content script is loaded
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'captureScreenshot') {
    // Handle screenshot capture request from popup
    captureScreenshot()
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to capture screenshot'
        });
      });
    return true; // Keep the message channel open for async response
  } else if (message.action === 'analyzeGenericContent') {
    // Handle generic content analysis
    analyzeGenericContent(message.payload, message.model, message.apiKey)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to analyze content'
        });
      });
    return true; // Keep the message channel open for async response
  } else if (message.action === 'chatMessage') {
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
      // Check if a specific tabId was provided
      const tabId = message.tabId;
      
      if (tabId) {
        // Try to ensure the content script is loaded in the specified tab
        ensureContentScriptLoaded(tabId)
          .then(() => {
            // Content script is confirmed loaded, now get content
            return getPageContentFromTab(tabId);
          })
          .then(content => {
            sendResponse({ success: true, content: content });
          })
          .catch(error => {
            sendResponse({ 
              success: false, 
              error: error.message || 'Failed to get page content'
            });
          });
      } else {
        // Use the active tab as before
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
          if (tabs.length === 0) {
            sendResponse({ success: false, error: 'No active tab found' });
            return;
          }
          
          const activeTabId = tabs[0].id;
          
          ensureContentScriptLoaded(activeTabId)
            .then(() => {
              // Content script is loaded, now get content
              return getPageContentFromTab(activeTabId);
            })
            .then(content => {
              sendResponse({ success: true, content: content });
            })
            .catch(error => {
              sendResponse({ 
                success: false, 
                error: error.message || 'Failed to get page content' 
              });
            });
        });
      }
      
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
  
  return true; // Always return true to indicate you might respond asynchronously
});