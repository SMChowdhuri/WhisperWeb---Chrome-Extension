# Web Annotator Chrome Extension

A Chrome extension that allows users to highlight text and add anonymous feedback on any webpage.

## Features

- **Highlight Text**: Select text on any webpage and highlight it with customizable colors
- **Add Feedback**: Add anonymous notes and comments on webpages
- **Persistent Annotations**: Highlights and notes are saved across browser sessions
- **Anonymous Sharing**: Share feedback anonymously with other users of the extension
- **AI Summary**: Generate summaries of feedback using Google Gemini AI (when available)

## Installation

1. Clone the repository: `git clone https://github.com/SMChowdhuri/WhisperWeb---Chrome-Extension.git`
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension will be loaded and ready to use

## Usage

1. Click the extension icon in the Chrome toolbar to open the popup
2. Select annotation mode: Highlight or Add Feedback
3. For highlighting: Select text on the webpage to highlight it
4. For feedback: Click on the webpage to add a note at that location
5. View feedback from all users in the dashboard or popup

## Configuration

- Configure highlight colors in the options page
- Set up AI API keys in `ai-config.js` for summary features
- Database configuration is in `supabase-config.js`

## License

ISC
