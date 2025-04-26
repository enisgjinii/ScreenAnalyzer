# ScreenAnalyzer - Browser Extension

A Chrome/Edge extension that uses GroqCloud API to analyze screen content.

## Features

- Add your GroqCloud API key to access AI capabilities
- Select from different AI models (Llama-3, Mixtral, Gemma)
- Analyze current webpage content to get:
  - Concise summary of what's on the screen
  - Suggested next steps based on the content

## Installation

### Development Mode

1. Download/clone this repository
2. Open Chrome or Edge and go to the Extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Enable "Developer mode" (toggle in the top right)
4. Click "Load unpacked" and select the ScreenAnalyzer folder
5. The extension icon should appear in your browser toolbar

### Using the Extension

1. Click the extension icon to open the popup
2. Enter your GroqCloud API key and click "Save"
3. Select your preferred AI model from the dropdown
4. Click "Analyze Current Screen" to analyze the page you're currently viewing
5. View the results in the Summary and Next Steps tabs

## Requirements

- GroqCloud API key (sign up at https://console.groq.com/)
- Chrome/Edge browser

## Privacy

This extension does not store or transmit your webpage data beyond sending it to the GroqCloud API for analysis. Your API key is stored locally in your browser's secure storage and is never shared.