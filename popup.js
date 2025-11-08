document.addEventListener('DOMContentLoaded', () => {
    const selectModeBtn = document.getElementById('select-mode');
    const drawModeBtn = document.getElementById('draw-mode');
    const highlightControls = document.getElementById('highlight-controls');
    const drawControls = document.getElementById('draw-controls');
    
    const highlightColorInput = document.getElementById('highlight-color');
    const drawColorInput = document.getElementById('draw-color');
    const brushSizeInput = document.getElementById('brush-size');
    const clearAllBtn = document.getElementById('clear-all');
    const exportBtn = document.getElementById('export-json');
    const importInput = document.getElementById('import-json');
    const toolbar = document.getElementById('toolbar');
    const dragHandle = document.getElementById('drag-handle');

    // --- Save and Load Preferences ---
    // Load saved preferences from local storage
    chrome.storage.local.get(['annotatorPrefs'], (result) => {
        if (result.annotatorPrefs) {
            const prefs = result.annotatorPrefs;
            highlightColorInput.value = prefs.highlightColor || '#ffff00';
            drawColorInput.value = prefs.drawColor || '#ff0000';
            brushSizeInput.value = prefs.brushSize || 5;

            // Apply initial state to content script
            sendMessageToContentScript('setHighlightColor', prefs.highlightColor);
            sendMessageToContentScript('setDrawColor', prefs.drawColor);
            sendMessageToContentScript('setBrushSize', prefs.brushSize);
        }
    });

    // Save preferences when they change
    function savePreferences() {
        const prefs = {
            highlightColor: highlightColorInput.value,
            drawColor: drawColorInput.value,
            brushSize: brushSizeInput.value,
        };
        chrome.storage.local.set({ annotatorPrefs: prefs });
    }

    highlightColorInput.addEventListener('input', () => {
        sendMessageToContentScript('setHighlightColor', highlightColorInput.value);
        savePreferences();
    });

    drawColorInput.addEventListener('input', () => {
        sendMessageToContentScript('setDrawColor', drawColorInput.value);
        savePreferences();
    });

    brushSizeInput.addEventListener('input', () => {
        sendMessageToContentScript('setBrushSize', brushSizeInput.value);
        savePreferences();
    });

    // --- Mode Switching ---
    selectModeBtn.addEventListener('click', () => {
        setMode('select');
    });

    drawModeBtn.addEventListener('click', () => {
        setMode('draw');
    });

    function setMode(mode) {
        if (mode === 'select') {
            selectModeBtn.classList.add('active');
            drawModeBtn.classList.remove('active');
            highlightControls.style.display = 'flex';
            drawControls.style.display = 'none';
        } else {
            selectModeBtn.classList.remove('active');
            drawModeBtn.classList.add('active');
            highlightControls.style.display = 'none';
            drawControls.style.display = 'flex';
        }
        sendMessageToContentScript('setMode', mode);
    }

    // --- Other Controls ---
    clearAllBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all annotations for this page?')) {
            sendMessageToContentScript('clearAnnotations');
        }
    });

    // --- Import / Export ---
    exportBtn.addEventListener('click', () => {
        // 1. Ask content script for data
        sendMessageToContentScript('getAnnotations', null, (response) => {
            if (response && response.data) {
                // 2. Create and download the file
                const dataStr = JSON.stringify(response.data, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `annotations-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                alert('No annotations found to export.');
            }
        });
    });

    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    // Send data to content script to import and reload
                    sendMessageToContentScript('importAnnotations', data, () => {
                         // Reload the active tab to apply imported annotations
                         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs[0] && tabs[0].id) {
                                chrome.tabs.reload(tabs[0].id);
                            }
                        });
                    });
                } catch (error) {
                    alert('Error: Invalid JSON file.');
                    console.error('Failed to parse import file:', error);
                }
            };
            reader.readAsText(file);
            // Reset input so the same file can be loaded again
            event.target.value = null;
        }
    });

    // --- Helper to send messages ---
    function sendMessageToContentScript(action, payload, callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].id) {
                chrome.tabs.sendMessage(tabs[0].id, { action, payload }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Handle error (e.g., content script not injected)
                        console.warn("Could not send message:", chrome.runtime.lastError.message);
                    } else if (callback) {
                        callback(response);
                    }
                });
            } else {
                console.warn("No active tab found to send message to.");
            }
        });
    }

    // --- Draggable Toolbar Logic ---
    let isDragging = false;
    let offsetX, offsetY;
    
    // Note: The popup window is not draggable by default.
    // This script makes the *content* of the popup draggable,
    // which gives the *effect* of a draggable window IF the extension
    // is "pinned" and opens as a panel.
    // For a true draggable toolbar, it would need to be injected
    // as an iframe into the page, which is much more complex.
    // This simple drag handle is for user familiarity.
    dragHandle.addEventListener('mousedown', (e) => {
        // This won't work as expected in a standard popup.
        // This logic is more for an injected UI.
        // We'll leave it as a visual cue.
        console.log("Drag handle clicked. In a real injected-UI, dragging would start.");
    });

    // Set initial state on load
    setMode('select');
    // Load initial preferences from storage
    chrome.storage.local.get(['annotatorPrefs'], (result) => {
        if (result.annotatorPrefs) {
            highlightColorInput.value = result.annotatorPrefs.highlightColor;
            drawColorInput.value = result.annotatorPrefs.drawColor;
            brushSizeInput.value = result.annotatorPrefs.brushSize;
        }
        // Send initial state to content script
        sendMessageToContentScript('setHighlightColor', highlightColorInput.value);
        sendMessageToContentScript('setDrawColor', drawColorInput.value);
        sendMessageToContentScript('setBrushSize', brushSizeInput.value);
        sendMessageToContentScript('setMode', 'select');
    });

});