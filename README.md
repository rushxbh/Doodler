# Annotate Layer - Chrome Extension

A powerful Chrome extension that allows you to **highlight text** and **draw freeform doodles** on any webpage with full local persistence.

## Features

✨ **Text Highlighting**
- Select any text on a webpage to create persistent highlights
- Custom color selection for each highlight
- Highlights persist between browser sessions

🎨 **Freeform Drawing**
- Draw directly on any webpage with a canvas overlay
- Adjustable brush size and color
- Smooth, responsive drawing experience

💾 **Local Persistence**
- All annotations stored locally using Chrome Storage API
- Per-page isolation - each URL maintains its own annotations
- Import/Export sessions as JSON files

🔧 **Full Control**
- Toggle between Select and Draw modes
- Clear all annotations with one click
- Draggable toolbar with all essential controls

## Installation

### Method 1: Load Unpacked (Development)

1. **Clone or download this repository**
   ```bash
   cd Downloads
   # Repository is already at: doodler-extension
   ```

2. **Open Chrome Extensions page**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

3. **Load the extension**
   - Click "Load unpacked"
   - Select the `doodler-extension` folder
   - Extension icon will appear in your toolbar

4. **Generate PNG icons (optional)**
   ```bash
   # If you have ImageMagick or similar tool:
   cd icons
   # Convert SVG to PNG at different sizes
   # Or use the placeholder icon48.png already included
   ```

### Method 2: Package and Install

```bash
npm run package
# This creates annotate-layer-v0.1.zip
# Install via "Load unpacked" or share the zip file
```

## Usage

### Getting Started

1. **Navigate to any webpage** (blog, article, etc.)

2. **Open the extension popup** by clicking the extension icon

3. **Click "Enable Annotate Mode"** to inject the annotation overlay

### Highlighting Text

1. Click **"Switch to Select Mode"** in the popup (or toolbar)
2. Select any text on the page with your mouse
3. The selection will be automatically highlighted
4. Change colors using the color picker in the on-page toolbar

### Drawing Doodles

1. Click **"Switch to Draw Mode"** in the popup (or toolbar)
2. Use your mouse/trackpad to draw on the page
3. Adjust brush size with the slider in the toolbar
4. Change colors using the color picker

### Managing Annotations

**Export Session**
- Click "Export Session" to download all annotations as JSON
- Filename includes page name and timestamp

**Import Session**
- Click "Import Session" and select a previously exported JSON file
- All highlights and doodles will be restored

**Clear All**
- Click "Clear All Annotations" to remove everything from the current page
- Confirmation dialog prevents accidental deletion

## Architecture

### File Structure

```
doodler-extension/
├── manifest.json         # Extension configuration (Manifest V3)
├── background.js        # Service worker for extension lifecycle
├── content.js          # Content script - auto-injected on all pages
├── overlay.js          # Core annotation logic (injected dynamically)
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic and messaging
├── styles.css          # Styles for highlights and UI elements
├── package.json        # NPM package configuration
└── icons/
    ├── icon.svg        # Vector icon source
    └── icon48.png      # Rasterized icon (48x48)
```

### Technical Details

**Manifest V3 Compliance**
- Uses service worker for background tasks
- Content scripts with proper CSP handling
- Web-accessible resources for dynamic injection

**Storage Strategy**
- Each page identified by `origin + pathname`
- Storage key format: `annotate_${PAGE_KEY}`
- Data structure:
  ```json
  {
    "strokes": [
      {
        "id": "uuid",
        "points": [[x1, y1], [x2, y2], ...],
        "color": "#ff6a00",
        "width": 3,
        "pageRect": { "width": 1920, "height": 1080 },
        "createdAt": 1699420800000
      }
    ],
    "highlights": [
      {
        "id": "uuid",
        "selector": "html > body > article > p:nth-of-type(2)",
        "startOffset": 45,
        "endOffset": 60,
        "text": "highlighted phrase",
        "color": "#ffe14a"
      }
    ]
  }
  ```

**Highlight Reconstruction**
- CSS path generation for stable element targeting
- Text node walking with offset calculation
- Range-based wrapping for accurate positioning

**Canvas Drawing**
- Fixed viewport positioning with pointer-events control
- Device pixel ratio scaling for crisp rendering
- Incremental drawing with `requestAnimationFrame` optimization

## Development

### Local Testing

1. Make changes to any file
2. Go to `chrome://extensions/`
3. Click the reload icon on the extension card
4. Refresh the webpage to see changes

### Debugging

**Content Script**
- Open DevTools on the webpage
- Check Console for `[Annotate Layer]` messages

**Background Service Worker**
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"

**Popup**
- Right-click the extension icon → "Inspect popup"

### Performance Optimization

- Strokes saved on `pointerup` to prevent data loss
- Debounced storage writes (500ms delay)
- Viewport resize triggers canvas redraw
- Best-effort persistence on `beforeunload` and `visibilitychange`

## Known Limitations

⚠️ **Dynamic DOM pages**
- Highlights may break on heavily dynamic pages (React, Vue with frequent re-renders)
- Workaround: Use drawing mode for such pages

⚠️ **Cross-origin iframes**
- Cannot annotate content inside iframes from different origins

⚠️ **Storage Limits**
- Chrome Storage API: 10MB sync, unlimited local
- Large drawing sessions stored efficiently as point arrays

⚠️ **Fixed positioning**
- Canvas overlay uses fixed positioning
- Pages with complex z-index stacking may have overlay issues

## Future Enhancements

🚀 **Planned Features**
- [ ] Real-time collaboration via WebRTC
- [ ] Comment threads on highlights
- [ ] Keyboard shortcuts for mode switching
- [ ] Undo/Redo for drawing strokes
- [ ] Screenshot export (HTML → Canvas)
- [ ] Cloud sync with optional backend
- [ ] Search annotations across all pages
- [ ] Tagging and categorization

## Security & Privacy

🔒 **Privacy-First Design**
- All data stored locally on your device
- No network requests or external servers
- No tracking or analytics
- No permissions beyond storage and active tab

## Troubleshooting

**Extension not working?**
1. Ensure Developer Mode is enabled
2. Check for errors in the Extensions page
3. Try reloading the extension
4. Clear browser cache and reload page

**Highlights not persisting?**
1. Check Chrome Storage usage in DevTools
2. Ensure storage permission is granted
3. Verify page URL hasn't changed (hash/query params)

**Canvas not drawing?**
1. Make sure you're in Draw mode
2. Check if another extension is blocking pointer events
3. Reload the extension and page

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

**Version**: 0.1.0  
**Manifest**: V3  
**Compatibility**: Chrome 88+, Edge 88+

