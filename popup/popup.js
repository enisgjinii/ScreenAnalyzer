document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const modelSelect = document.getElementById('modelSelect');
  const analyzeBtn = document.getElementById('analyzeScreen');
  const analyzeScreenshotBtn = document.getElementById('analyzeScreenshot');
  const resultContainer = document.getElementById('resultContainer');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const summaryContent = document.getElementById('summaryContent');
  const nextStepsContent = document.getElementById('nextStepsContent');
  const ocrProgressDiv = document.createElement('div'); // Create progress div
  ocrProgressDiv.id = 'ocrProgress';
  resultContainer.parentNode.insertBefore(ocrProgressDiv, resultContainer.nextSibling); // Insert after result container

  // Load saved settings
  loadSettings();

  // Event listeners
  saveApiKeyBtn.addEventListener('click', saveApiKey);
  modelSelect.addEventListener('change', saveSelectedModel);
  analyzeBtn.addEventListener('click', analyzeCurrentScreen);
  analyzeScreenshotBtn.addEventListener('click', analyzeScreenshot);

  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.getAttribute('data-tab');
      
      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Show selected tab content
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(tab).classList.add('active');
    });
  });

  // Save API key to chrome.storage
  function saveApiKey() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      alert('Please enter a valid GroqCloud API key');
      return;
    }
    
    chrome.storage.sync.set({ groqApiKey: apiKey }, () => {
      alert('API key saved successfully');
    });
  }

  // Save selected model
  function saveSelectedModel() {
    const selectedModel = modelSelect.value;
    chrome.storage.sync.set({ selectedModel: selectedModel });
  }

  // Load saved settings from chrome.storage
  function loadSettings() {
    chrome.storage.sync.get(['groqApiKey', 'selectedModel'], (result) => {
      if (result.groqApiKey) {
        apiKeyInput.value = result.groqApiKey;
      }
      
      if (result.selectedModel) {
        modelSelect.value = result.selectedModel;
      }
    });
  }

  // Analyze current screen (Text)
  function analyzeCurrentScreen() {
    chrome.storage.sync.get(['groqApiKey', 'selectedModel'], (result) => {
      if (!result.groqApiKey) {
        alert('Please set your GroqCloud API key first');
        return;
      }

      // Show loading state
      showLoadingState('Analyzing page text...');

      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTab = tabs[0];
        chrome.scripting.executeScript({
          target: {tabId: activeTab.id},
          function: capturePageContent
        }, (results) => {
          if (chrome.runtime.lastError || !results || results.length === 0) {
            handleAnalysisError('Could not analyze this page.');
            return;
          }
          const pageContent = results[0].result;
          sendContentForAnalysis({ type: 'pageContent', data: pageContent });
        });
      });
    });
  }

  // NEW: Analyze Screenshot
  async function analyzeScreenshot() {
    chrome.storage.sync.get(['groqApiKey', 'selectedModel'], async (result) => {
      if (!result.groqApiKey) {
        alert('Please set your GroqCloud API key first');
        return;
      }

      showLoadingState('Capturing screenshot...');
      ocrProgressDiv.textContent = ''; // Clear previous progress
      ocrProgressDiv.style.display = 'block'; // Show progress area

      try {
        // 1. Request screenshot from background script
        const response = await chrome.runtime.sendMessage({ action: 'captureScreenshot' });
        if (!response || !response.success || !response.dataUrl) {
          throw new Error(response.error || 'Failed to capture screenshot.');
        }

        showLoadingState('Processing image (OCR)... This may take a moment.');

        // 2. Perform OCR using Tesseract.js
        const worker = await Tesseract.createWorker({
          logger: m => {
            if (m.status === 'recognizing text') {
              ocrProgressDiv.textContent = `OCR Progress: ${Math.round(m.progress * 100)}%`;
            }
          }
        });
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data: { text } } = await worker.recognize(response.dataUrl);
        await worker.terminate();

        ocrProgressDiv.textContent = 'OCR Complete.';
        showLoadingState('Analyzing extracted text...');

        // 3. Send extracted text for analysis
        sendContentForAnalysis({ type: 'plainText', data: text });

      } catch (error) {
        console.error('Screenshot analysis error:', error);
        handleAnalysisError(`Screenshot analysis failed: ${error.message}`);
        ocrProgressDiv.style.display = 'none'; // Hide progress on error
      }
    });
  }

  // NEW: Generic function to show loading/thinking state
  function showLoadingState(message) {
    resultContainer.classList.remove('hidden');
    summaryContent.innerHTML = `<div class="message thinking">${message}</div>`;
    nextStepsContent.innerHTML = '';
    ocrProgressDiv.textContent = ''; // Clear OCR progress when starting new analysis
    ocrProgressDiv.style.display = 'none'; // Hide OCR progress area initially
    document.querySelector('.tab-btn[data-tab="summary"]').click();
  }

  // NEW: Generic function to handle analysis errors
  function handleAnalysisError(errorMessage) {
    summaryContent.innerHTML = ''; // Clear thinking message
    summaryContent.textContent = `Error: ${errorMessage}`;
    nextStepsContent.textContent = '';
    addCopyButton(summaryContent, `Error: ${errorMessage}`); // Add copy button even for errors
    ocrProgressDiv.style.display = 'none';
  }

  // NEW: Send content (text or screenshot OCR) to background for analysis
  function sendContentForAnalysis(contentPayload) {
    chrome.storage.sync.get(['groqApiKey', 'selectedModel'], (settings) => {
      chrome.runtime.sendMessage({
        action: 'analyzeGenericContent', // Use a new generic action
        payload: contentPayload,
        model: settings.selectedModel,
        apiKey: settings.groqApiKey
      }, (response) => {
        ocrProgressDiv.style.display = 'none'; // Hide progress after analysis
        if (response && response.success) {
          summaryContent.innerHTML = ''; // Clear thinking message
          summaryContent.textContent = response.summary;
          nextStepsContent.textContent = response.nextSteps;
          // Add copy buttons
          addCopyButton(summaryContent, response.summary);
          addCopyButton(nextStepsContent, response.nextSteps);
        } else {
          handleAnalysisError(response?.error || 'Failed to analyze content.');
        }
      });
    });
  }

  // NEW: Add Copy Button functionality
  function addCopyButton(element, textToCopy) {
    // Remove existing button first
    const existingBtn = element.querySelector('.copy-btn');
    if (existingBtn) existingBtn.remove();

    if (!textToCopy) return; // Don't add button if no text

    const button = document.createElement('button');
    button.textContent = 'Copy';
    button.classList.add('copy-btn');
    button.title = 'Copy to clipboard';
    button.addEventListener('click', () => {
      navigator.clipboard.writeText(textToCopy).then(() => {
        button.textContent = 'Copied!';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 1500);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
        button.textContent = 'Error';
      });
    });
    element.appendChild(button);
  }

  // Function to capture page content (will be injected into the active tab)
  function capturePageContent() {
    // Get visible text content from the page
    const bodyText = document.body.innerText;
    
    // Get the page title
    const pageTitle = document.title;
    
    // Get meta description if available
    let metaDescription = '';
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDescription = metaDesc.getAttribute('content');
    }
    
    // Get URL
    const pageUrl = window.location.href;
    
    return {
      title: pageTitle,
      url: pageUrl,
      description: metaDescription,
      content: bodyText.substring(0, 15000) // Limiting content size
    };
  }
});