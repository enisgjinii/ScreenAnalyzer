document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChatBtn');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const themeToggle = document.getElementById('themeToggle');
  const exportChat = document.getElementById('exportChat');
  const includePageContext = document.getElementById('includePageContext');
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
  const modelSelectSidebar = document.getElementById('modelSelectSidebar');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const autoSaveHistory = document.getElementById('autoSaveHistory');
  const historyList = document.getElementById('historyList');
  const clearHistory = document.getElementById('clearHistory');
  const chatContainer = document.getElementById('chatContainer');

  // Conversation history
  let chatHistory = [];
  
  // Load settings
  loadSettings();

  // Set up event listeners
  sendChatBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  clearChatBtn.addEventListener('click', clearChat);
  themeToggle.addEventListener('click', toggleDarkMode);
  exportChat.addEventListener('click', exportChatHistory);
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  darkModeToggle.addEventListener('change', function() {
    setDarkMode(this.checked);
  });
  
  // Tab navigation
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked button and corresponding content
      button.classList.add('active');
      document.getElementById(`tab-${button.dataset.tab}`).classList.add('active');
      
      // If history tab is clicked, refresh history list
      if (button.dataset.tab === 'history') {
        loadHistoryItems();
      }
    });
  });
  
  // Model selection change
  modelSelectSidebar.addEventListener('change', function() {
    chrome.storage.sync.set({ selectedModel: this.value });
  });
  
  // Auto-save history toggle
  autoSaveHistory.addEventListener('change', function() {
    chrome.storage.sync.set({ autoSaveHistory: this.checked });
  });
  
  // Clear history button
  clearHistory.addEventListener('click', function() {
    if (confirm("Are you sure you want to clear all analysis history?")) {
      chrome.storage.sync.set({ analysisHistory: [] });
      loadHistoryItems();
    }
  });

  // Function to send a message
  async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Add user message to chat
    addMessageToChat('user', message);
    chatInput.value = '';
    
    // Get API key and selected model
    const { groqApiKey, selectedModel } = await chrome.storage.sync.get(['groqApiKey', 'selectedModel']);
    
    if (!groqApiKey) {
      addMessageToChat('error', 'Please set your GroqCloud API key in the Settings tab.');
      return;
    }

    // Show thinking indicator
    const thinkingId = addThinkingIndicator();
    
    try {
      let response;
      
      // Check if including page context is enabled
      if (includePageContext.checked) {
        // Get page content from the active tab
        const pageContentResponse = await chrome.runtime.sendMessage({ action: 'getPageContent' });
        
        if (!pageContentResponse.success) {
          throw new Error(pageContentResponse.error || 'Failed to get page content');
        }
        
        const pageContent = pageContentResponse.content;
        
        // Format message with page context
        const enhancedMessage = `
The user is asking about this web page:
URL: ${pageContent.url}
Title: ${pageContent.title}
Description: ${pageContent.description || 'N/A'}

Here's a summary of the page content:
${pageContent.content.substring(0, 2000)}${pageContent.content.length > 2000 ? '...' : ''}

User's question: ${message}

Please respond to the user's question based on this context. If the question is not related to the page, you can answer it generally.
`;

        // Send enhanced message
        response = await chrome.runtime.sendMessage({
          action: 'chatMessage',
          messageText: enhancedMessage,
          model: selectedModel || 'llama3-8b-8192',
          apiKey: groqApiKey
        });
      } else {
        // Add message to history
        chatHistory.push({ role: 'user', content: message });
        
        // Send regular chat message
        response = await chrome.runtime.sendMessage({
          action: 'chatMessage',
          history: chatHistory,
          model: selectedModel || 'llama3-8b-8192',
          apiKey: groqApiKey
        });
      }
      
      // Remove thinking indicator
      removeThinkingIndicator(thinkingId);
      
      if (response && response.success) {
        // Add AI response to chat
        addMessageToChat('assistant', response.reply);
        
        // Add to chat history if not using page context
        if (!includePageContext.checked) {
          chatHistory.push({ role: 'assistant', content: response.reply });
        }
        
        // Save to analysis history if auto-save is enabled
        const { autoSaveHistory } = await chrome.storage.sync.get('autoSaveHistory');
        if (autoSaveHistory) {
          saveToHistory({
            type: 'chat',
            text: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            response: response.reply.substring(0, 150) + (response.reply.length > 150 ? '...' : ''),
            timestamp: Date.now()
          });
        }
      } else {
        throw new Error(response?.error || 'Failed to get response from API');
      }
    } catch (error) {
      // Remove thinking indicator
      removeThinkingIndicator(thinkingId);
      
      // Show error message
      console.error('Chat error:', error);
      addMessageToChat('error', `Error: ${error.message}`);
    }
  }
  
  // Function to add a message to the chat
  function addMessageToChat(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', type);
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    
    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // Function to add thinking indicator
  function addThinkingIndicator() {
    const thinkingDiv = document.createElement('div');
    const id = 'thinking-' + Date.now();
    thinkingDiv.id = id;
    thinkingDiv.classList.add('message', 'thinking');
    thinkingDiv.textContent = 'Thinking...';
    chatMessages.appendChild(thinkingDiv);
    
    // Scroll to the bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return id;
  }
  
  // Function to remove thinking indicator
  function removeThinkingIndicator(id) {
    const thinkingDiv = document.getElementById(id);
    if (thinkingDiv) {
      thinkingDiv.remove();
    }
  }
  
  // Function to clear the chat
  function clearChat() {
    // Confirm before clearing
    if (confirm("Are you sure you want to clear the conversation?")) {
      // Clear chat messages
      while (chatMessages.firstChild) {
        chatMessages.removeChild(chatMessages.firstChild);
      }
      
      // Add welcome message
      addMessageToChat('system', 'Welcome! Ask me anything about the current page or start a new conversation.');
      
      // Reset chat history
      chatHistory = [];
    }
  }
  
  // Function to toggle dark mode
  function toggleDarkMode() {
    const isDarkMode = chatContainer.classList.contains('theme-dark');
    setDarkMode(!isDarkMode);
    
    // Update the checkbox in settings
    darkModeToggle.checked = !isDarkMode;
    
    // Save preference
    chrome.storage.sync.set({ darkMode: !isDarkMode });
  }
  
  // Function to set dark mode
  function setDarkMode(isDarkMode) {
    if (isDarkMode) {
      chatContainer.classList.remove('theme-light');
      chatContainer.classList.add('theme-dark');
    } else {
      chatContainer.classList.remove('theme-dark');
      chatContainer.classList.add('theme-light');
    }
    
    // Save preference
    chrome.storage.sync.set({ darkMode: isDarkMode });
  }
  
  // Function to export chat history
  function exportChatHistory() {
    // Create a text representation of the chat
    let chatText = '# ScreenAnalyzer Chat History\n\n';
    chatText += `Exported on: ${new Date().toLocaleString()}\n\n`;
    
    // Get all messages
    const messages = chatMessages.querySelectorAll('.message');
    
    messages.forEach(message => {
      if (message.classList.contains('user')) {
        chatText += `## User:\n${message.textContent}\n\n`;
      } else if (message.classList.contains('assistant')) {
        chatText += `## Assistant:\n${message.textContent}\n\n`;
      } else if (message.classList.contains('system')) {
        chatText += `## System:\n${message.textContent}\n\n`;
      } else if (message.classList.contains('error')) {
        chatText += `## Error:\n${message.textContent}\n\n`;
      }
    });
    
    // Create a blob and download
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `screenanalyzer-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  // Function to save API key
  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert("Please enter an API key");
      return;
    }
    
    chrome.storage.sync.set({ groqApiKey: apiKey }, function() {
      // Show success message
      alert("API key saved successfully!");
      
      // Clear the input
      apiKeyInput.value = '';
    });
  }
  
  // Function to load settings
  function loadSettings() {
    chrome.storage.sync.get(['groqApiKey', 'selectedModel', 'darkMode', 'autoSaveHistory'], function(result) {
      // Set dark mode if saved
      if (result.darkMode) {
        setDarkMode(result.darkMode);
        darkModeToggle.checked = result.darkMode;
      }
      
      // Set selected model if saved
      if (result.selectedModel) {
        modelSelectSidebar.value = result.selectedModel;
      }
      
      // Set auto-save history if saved
      if (typeof result.autoSaveHistory !== 'undefined') {
        autoSaveHistory.checked = result.autoSaveHistory;
      }
      
      // Show API key status
      if (result.groqApiKey) {
        apiKeyInput.placeholder = "API key is set (hidden)";
      } else {
        apiKeyInput.placeholder = "Enter your API key";
      }
    });
  }
  
  // Function to save to history
  async function saveToHistory(entry) {
    try {
      const { analysisHistory = [] } = await chrome.storage.sync.get('analysisHistory');
      // Keep only the most recent 20 entries to avoid storage limits
      const updatedHistory = [entry, ...analysisHistory].slice(0, 20);
      await chrome.storage.sync.set({ analysisHistory: updatedHistory });
    } catch (error) {
      console.error('Error saving to history:', error);
    }
  }
  
  // Function to load history items
  function loadHistoryItems() {
    chrome.storage.sync.get('analysisHistory', function(result) {
      const history = result.analysisHistory || [];
      
      // Clear history list
      historyList.innerHTML = '';
      
      if (history.length === 0) {
        // Show empty state
        historyList.innerHTML = '<div class="empty-state">No recent analyses</div>';
        return;
      }
      
      // Add history items
      history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.classList.add('history-item');
        historyItem.setAttribute('data-index', index);
        
        // Format timestamp
        const date = new Date(item.timestamp);
        const formattedDate = date.toLocaleString();
        
        // Different layout based on history item type
        if (item.type === 'chat') {
          historyItem.innerHTML = `
            <div class="history-item-header">
              <div class="history-item-type">Chat</div>
              <div class="history-item-timestamp">${formattedDate}</div>
            </div>
            <div class="history-item-text">
              <strong>You:</strong> ${item.text}<br>
              <strong>AI:</strong> ${item.response}
            </div>
          `;
        } else {
          historyItem.innerHTML = `
            <div class="history-item-header">
              <div class="history-item-type">${item.type.charAt(0).toUpperCase() + item.type.slice(1)}</div>
              <div class="history-item-timestamp">${formattedDate}</div>
            </div>
            <div class="history-item-text">
              <strong>Summary:</strong> ${item.summary?.substring(0, 100)}${item.summary?.length > 100 ? '...' : ''}
            </div>
          `;
        }
        
        // Add click handler to view full history item
        historyItem.addEventListener('click', () => {
          viewHistoryItem(item);
        });
        
        historyList.appendChild(historyItem);
      });
    });
  }
  
  // Function to view a history item
  function viewHistoryItem(item) {
    // Switch to chat tab
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector('.tab-button[data-tab="chat"]').classList.add('active');
    document.getElementById('tab-chat').classList.add('active');
    
    // Add a system message about viewing history
    addMessageToChat('system', `Showing saved analysis from ${new Date(item.timestamp).toLocaleString()}`);
    
    if (item.type === 'chat') {
      // Add the chat messages
      addMessageToChat('user', item.text);
      addMessageToChat('assistant', item.response);
    } else {
      // Add the analysis results
      addMessageToChat('system', `Analysis type: ${item.type}`);
      
      if (item.text) {
        addMessageToChat('user', `Content: ${item.text}`);
      }
      
      if (item.summary) {
        addMessageToChat('assistant', `Summary: ${item.summary}`);
      }
      
      if (item.nextSteps) {
        addMessageToChat('assistant', `Next Steps: ${item.nextSteps}`);
      }
    }
  }
});