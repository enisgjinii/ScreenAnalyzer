// Content script for ScreenAnalyzer extension

// Wait for DOM to be fully loaded before injecting UI elements
function initializeUI() {
  // Check if document body exists, if not wait for it
  if (!document.body) {
    window.addEventListener('DOMContentLoaded', initializeUI);
    return;
  }

  // Create and inject notification container
  const notificationContainer = document.createElement('div');
  notificationContainer.id = 'screenanalyzer-notification-container';
  notificationContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 300px;
    z-index: 10000;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  `;
  document.body.appendChild(notificationContainer);

  // Create results panel container
  const resultsPanel = document.createElement('div');
  resultsPanel.id = 'screenanalyzer-results-panel';
  resultsPanel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 350px;
    max-height: 80vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    overflow-y: auto;
    display: none;
    padding: 16px;
    border: 1px solid #e4e4e7;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  `;
  document.body.appendChild(resultsPanel);
}

// Initialize UI as soon as possible
initializeUI();

// Function to show notification
function showNotification(message, isError = false) {
  const notificationContainer = document.getElementById('screenanalyzer-notification-container');
  if (!notificationContainer) {
    console.error('Notification container not found');
    return;
  }

  const notification = document.createElement('div');
  notification.classList.add('screenanalyzer-notification');
  notification.innerHTML = `
    <div style="
      padding: 12px 16px;
      margin: 10px 0;
      border-radius: 8px;
      background-color: ${isError ? '#fee2e2' : '#f0fdfa'};
      color: ${isError ? '#b91c1c' : '#10403a'};
      border: 1px solid ${isError ? '#fca5a5' : '#99f6e4'};
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    ">
      <div style="flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" 
          stroke="${isError ? '#dc2626' : '#059669'}" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" 
            d="${isError 
              ? 'M6 18L18 6M6 6l12 12' 
              : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'}" />
        </svg>
      </div>
      <div>${message}</div>
    </div>
  `;
  
  notificationContainer.appendChild(notification);
  
  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      notification.remove();
    }, 500);
  }, 5000);
}

// Function to show analysis results
function showAnalysisResults(results) {
  const resultsPanel = document.getElementById('screenanalyzer-results-panel');
  if (!resultsPanel) {
    console.error('Results panel not found');
    return;
  }
  
  // Configure results panel
  resultsPanel.style.display = 'block';
  
  // Generate results HTML
  resultsPanel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #18181b;">Analysis Results</h3>
      <button id="screenanalyzer-close-results" style="
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" 
          stroke="#71717a" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div style="margin-bottom: 16px; padding: 12px; background-color: #fafafa; border-radius: 8px; border: 1px solid #e4e4e7;">
      <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 500; color: #18181b;">Summary</h4>
      <p style="margin: 0; color: #3f3f46;">${results.summary || 'No summary available.'}</p>
    </div>
    ${results.nextSteps ? `
    <div style="margin-bottom: 16px; padding: 12px; background-color: #f7fee7; border-radius: 8px; border: 1px solid #d9f99d;">
      <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 500; color: #365314;">Next Steps</h4>
      <p style="margin: 0; color: #3f3f46;">${results.nextSteps}</p>
    </div>
    ` : ''}
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button id="screenanalyzer-open-sidebar" style="
        background-color: #0f766e;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
      ">
        Open in Sidebar
      </button>
    </div>
  `;
  
  // Add event listener to close button
  document.getElementById('screenanalyzer-close-results').addEventListener('click', () => {
    resultsPanel.style.display = 'none';
  });
  
  // Add event listener to sidebar button
  document.getElementById('screenanalyzer-open-sidebar').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSidePanel' });
  });
}

// Function to get page metadata and content
function getPageContent() {
  // Get basic page metadata
  const title = document.title;
  const url = window.location.href;
  
  // Get meta description
  let description = '';
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    description = metaDescription.getAttribute('content');
  }
  
  // Get main content (simplified approach)
  let content = '';
  
  // Prioritize content from certain elements
  const mainElements = document.querySelectorAll('main, article, .content, .main, [role="main"]');
  if (mainElements.length > 0) {
    // Use the first main element content
    content = mainElements[0].innerText;
  } else {
    // Fallback to body content with common elements removed
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = document.body.innerHTML;
    
    // Remove script, style, nav, footer, header, aside elements
    const elementsToRemove = tempDiv.querySelectorAll('script, style, noscript, nav, footer, header, aside');
    elementsToRemove.forEach(el => el.remove());
    
    // Get text content
    content = tempDiv.innerText;
  }
  
  // Clean up content (remove extra whitespace)
  content = content.replace(/\s+/g, ' ').trim();
  
  return {
    title,
    url,
    description,
    content,
    lastUpdated: new Date().toISOString()
  };
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle ping message (used to check if content script is available)
  if (message.action === 'ping') {
    sendResponse({ success: true });
  } else if (message.action === 'showNotification') {
    showNotification(message.message, message.isError);
    sendResponse({ success: true });
  } else if (message.action === 'showAnalysisResults') {
    showAnalysisResults(message.results);
    sendResponse({ success: true });
  } else if (message.action === 'getPageContent') {
    const pageContent = getPageContent();
    sendResponse(pageContent);
  }
  
  return true; // Keep message channel open for async response
});