# Smart Bookmark Manager - Chrome Extension

A Chrome extension that automatically organizes and cleans up your bookmarks using AI-powered categorization.

## Features

- **Automatic Bookmark Scanning**: Reads all bookmarks from your browser
- **Accessibility Check**: Tests which bookmarks are still accessible  
- **AI-Powered Categorization**: Analyzes website content to categorize bookmarks
- **Modern UI**: Clean, user-friendly interface with real-time progress
- **Multi-language Support**: Available in 9 languages with automatic detection
- **Smart Organization**: Automatically creates category folders and moves bookmarks
- **Broken Link Removal**: Identifies and removes inaccessible bookmarks
- **Customizable Settings**: Configure API keys and organization preferences

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The Smart Bookmark Manager icon will appear in your extensions toolbar

## Usage

### Basic Organization
1. Click the extension icon to open the popup
2. Click "Scan Bookmarks" to analyze your bookmarks
3. Review the categorization results
4. Click "Apply Organization" to reorganize your bookmarks

### Settings
- **LLM API Settings**: Configure AI-powered categorization
- **Organization Settings**: Choose how to handle broken bookmarks
- **UI Settings**: Select your preferred language

## Languages Supported

- 🇺🇸 English
- 🇨🇳 简体中文 (Simplified Chinese)
- 🇹🇼 繁體中文 (Traditional Chinese)
- 🇯🇵 日本語 (Japanese)
- 🇰🇷 한국어 (Korean)
- 🇫🇷 Français (French)
- 🇩🇪 Deutsch (German)
- 🇪🇸 Español (Spanish)
- 🇷🇺 Русский (Russian)

## How It Works

1. **Bookmark Collection**: Uses Chrome's bookmarks API to get all saved bookmarks
2. **Accessibility Testing**: Tests each URL to determine if it's still accessible
3. **Content Analysis**: Analyzes website content to determine category and purpose
4. **Smart Categorization**: Groups bookmarks by type (Development, Entertainment, Shopping, etc.)
5. **Organization**: Creates organized folder structure and removes broken links

## Categories

The extension automatically categorizes bookmarks into:
- 💻 Development (programming, coding, software tools)
- 🎬 Entertainment (videos, movies, music, games)  
- 🛒 Shopping (e-commerce, online stores)
- 🔧 Search/Tools (search engines, utilities)
- 📱 Social Media (social networks, messaging)
- 💼 Professional (business, career, work tools)
- 📰 News (news sites, journalism)
- 📚 Reference (documentation, wikis, learning)
- 👥 Community (forums, discussion boards)
- ✅ Productivity (task management, notes, collaboration)
- 🎓 Education (learning platforms, courses)
- 📄 Other (uncategorized items)

## Browser Compatibility

### ✅ Supported Browsers:
- **Chrome** (Recommended)
- **Edge** (Chromium-based)
- **Brave**
- **Other Chromium-based browsers**

### ⚠️ Limited Support:
- **Arc Browser**: Due to Arc's unique architecture and proprietary features (like Pinned Tabs), this extension currently has limited functionality in Arc. Arc users may experience:
  - Inability to detect/organize Pinned Tabs
  - Limited bookmark scanning capabilities
  - Potential compatibility issues

**Note**: Arc browser support is under investigation, but technical limitations with Arc's proprietary APIs currently prevent full functionality.

## Technical Details

### Files Structure
```
bookmarkmanager/
├── manifest.json       # Extension configuration
├── background.js       # Service worker for bookmark operations
├── popup.html         # Main interface
├── popup.js           # Frontend logic
├── styles.css         # UI styling
├── i18n.js           # Internationalization
├── locales/          # Language files
└── icons/            # Extension icons
```

### Permissions
- `bookmarks`: Read and modify bookmarks
- `activeTab`: Access current tab information
- `storage`: Save user settings
- `http://*/*`, `https://*/*`: Check URL accessibility

## Privacy & Security

- No data is sent to external servers without explicit API key configuration
- All bookmark processing happens locally in your browser
- API keys are stored securely in Chrome's sync storage
- Basic categorization works entirely offline

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on supported browsers
5. Submit a pull request

## License

MIT License - see LICENSE file for details