(() => {
    // --- State Variables ---
    let currentMode = 'select'; // 'select' or 'draw'
    let highlightColor = '#ffff00';
    let drawColor = '#ff0000';
    let brushSize = 5;
    
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    let annotations = {
        highlights: [],
        drawings: []
    };

    // --- DOM Elements ---
    let canvas = null;
    let ctx = null;

    // --- Storage ---
    const pageUrl = window.location.href;
    const storageKey = `web-annotator-${pageUrl}`;

    // --- Helper Functions ---

    /**
     * Creates a unique CSS selector for a given element.
     * @param {Element} el - The element to find a path for.
     * @returns {string} A CSS selector.
     */
    function getCssPath(el) {
        if (!(el instanceof Element)) return;
        const path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id.replace(/(:|\.|\[|\]|,|=|@)/g, "\\$1");
                path.unshift(selector);
                break; // ID is unique, stop
            } else {
                let sib = el;
                let nth = 1;
                while (sib = sib.previousElementSibling) {
                    if (sib.nodeName.toLowerCase() === selector) nth++;
                }
                if (nth !== 1) {
                    selector += `:nth-of-type(${nth})`;
                }
            }
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(' > ');
    }

    /**
     * Finds an element and text node from a CSS path and offset.
     * @param {string} path - CSS selector.
     * @param {number} offset - Offset within the text node.
     * @returns {{node: Node, offset: number} | null}
     */
    function findNodeByPath(path, offset) {
        try {
            const el = document.querySelector(path);
            if (!el) return null;

            // Find the correct text node
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
            let cumulativeOffset = 0;
            let node;
            while (node = walker.nextNode()) {
                const nodeLength = node.textContent.length;
                if (cumulativeOffset + nodeLength >= offset) {
                    return { node: node, offset: offset - cumulativeOffset };
                }
                cumulativeOffset += nodeLength;
            }
            // Fallback: use last text node
            if (el.lastChild && el.lastChild.nodeType === Node.TEXT_NODE) {
                 return { node: el.lastChild, offset: Math.min(offset, el.lastChild.textContent.length) };
            }
            return null;

        } catch (e) {
            console.error('Web Annotator: Error finding node by path', e);
            return null;
        }
    }

    // --- Canvas Setup ---
    function setupCanvas() {
        canvas = document.createElement('canvas');
        canvas.id = 'web-annotator-canvas';
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.zIndex = '99998'; // Below popup, above most content
        canvas.style.pointerEvents = 'none';
        canvas.style.display = 'none';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');

        // Add canvas event listeners
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        window.addEventListener('resize', resizeCanvas);
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        redrawAll(); // Redraw annotations on resize
    }

    function setCanvasMode(mode) {
        if (!canvas) setupCanvas();
        if (mode === 'draw') {
            canvas.style.display = 'block';
            canvas.style.pointerEvents = 'auto';
        } else {
            canvas.style.display = 'none';
            canvas.style.pointerEvents = 'none';
        }
    }

    // --- Drawing Logic ---
    let currentDrawingPath = null;

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = [e.offsetX, e.offsetY];
        currentDrawingPath = {
            type: 'draw',
            color: drawColor,
            size: brushSize,
            points: [[lastX, lastY]]
        };
    }

    function draw(e) {
        if (!isDrawing) return;
        
        ctx.strokeStyle = drawColor;
        ctx.lineWidth = brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();

        [lastX, lastY] = [e.offsetX, e.offsetY];
        currentDrawingPath.points.push([lastX, lastY]);
    }

    function stopDrawing() {
        if (!isDrawing) return;
        isDrawing = false;
        if (currentDrawingPath && currentDrawingPath.points.length > 1) {
            annotations.drawings.push(currentDrawingPath);
            saveAnnotations();
        }
        currentDrawingPath = null;
    }

    function redrawAll() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        annotations.drawings.forEach(path => {
            if (path.points.length < 2) return;
            
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.size;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo(path.points[0][0], path.points[0][1]);
            for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i][0], path.points[i][1]);
            }
            ctx.stroke();
        });
    }

    // --- Highlighting Logic ---
    function handleMouseUp(e) {
        if (currentMode !== 'select' || isDrawing) return;

        // Don't highlight on our own canvas
        if (e.target && e.target.id === 'web-annotator-canvas') return;

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
            return;
        }

        const range = selection.getRangeAt(0);

        // Check if selection starts/ends inside an existing highlight
        if (range.startContainer.parentElement.closest('.web-annotator-highlight') ||
            range.endContainer.parentElement.closest('.web-annotator-highlight')) {
            selection.removeAllRanges();
            return; // Don't allow nested highlights
        }

        try {
            const startPath = getCssPath(range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer);
            const endPath = getCssPath(range.endContainer.nodeType === 3 ? range.endContainer.parentElement : range.endContainer);
            
            if (!startPath || !endPath) {
                console.error("Web Annotator: Could not create CSS path for selection.");
                selection.removeAllRanges();
                return;
            }

            const highlightData = {
                type: 'highlight',
                id: `hl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                color: highlightColor,
                startPath: startPath,
                startOffset: range.startOffset,
                endPath: endPath,
                endOffset: range.endOffset,
                text: selection.toString()
            };

            applyHighlight(highlightData);
            
            annotations.highlights.push(highlightData);
            saveAnnotations();
            
            selection.removeAllRanges();

        } catch (error) {
            console.error("Web Annotator: Error applying highlight.", error);
            selection.removeAllRanges();
        }
    }

    function applyHighlight(data) {
        try {
            const startNodeInfo = findNodeByPath(data.startPath, data.startOffset);
            const endNodeInfo = findNodeByPath(data.endPath, data.endOffset);

            if (!startNodeInfo || !endNodeInfo) {
                console.warn('Web Annotator: Could not find nodes for highlight', data);
                return;
            }

            const range = document.createRange();
            range.setStart(startNodeInfo.node, startNodeInfo.offset);
            range.setEnd(endNodeInfo.node, endNodeInfo.offset);
            
            const span = document.createElement('span');
            span.className = 'web-annotator-highlight';
            span.style.backgroundColor = data.color;
            span.dataset.highlightId = data.id;
            
            range.surroundContents(span);

        } catch (e) {
            console.error('Web Annotator: Error applying highlight', e, data);
        }
    }

    function reapplyAllHighlights() {
        // Remove existing highlight spans to avoid duplicates
        document.querySelectorAll('.web-annotator-highlight').forEach(span => {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            parent.normalize(); // Join adjacent text nodes
        });

        // Re-apply from stored data
        annotations.highlights.forEach(applyHighlight);
    }

    // --- Storage Logic ---
    function saveAnnotations() {
        try {
            chrome.storage.local.set({ [storageKey]: annotations });
        } catch (e) {
            console.error("Web Annotator: Error saving annotations.", e);
            if (e.name === 'QuotaExceededError') {
                alert("Web Annotator: Could not save annotations. Storage limit reached.");
            }
        }
    }

    function loadAnnotations() {
        chrome.storage.local.get([storageKey], (result) => {
            if (result[storageKey]) {
                annotations = result[storageKey];
                
                // Ensure annotations has both keys
                if (!annotations.highlights) annotations.highlights = [];
                if (!annotations.drawings) annotations.drawings = [];
                
                reapplyAllHighlights();
                if (annotations.drawings.length > 0) {
                    if (!canvas) setupCanvas();
                    redrawAll();
                }
            } else {
                annotations = { highlights: [], drawings: [] };
            }
        });
    }

    function clearAllAnnotations() {
        // Clear highlights
        document.querySelectorAll('.web-annotator-highlight').forEach(span => {
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
            parent.normalize();
        });

        // Clear drawings
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Clear data
        annotations = { highlights: [], drawings: [] };
        chrome.storage.local.remove(storageKey);
    }

    // --- Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
            case 'setMode':
                currentMode = request.payload;
                setCanvasMode(currentMode);
                break;
            case 'setHighlightColor':
                highlightColor = request.payload;
                break;
            case 'setDrawColor':
                drawColor = request.payload;
                break;
            case 'setBrushSize':
                brushSize = request.payload;
                break;
            case 'clearAnnotations':
                clearAllAnnotations();
                sendResponse({ success: true });
                break;
            case 'getAnnotations':
                sendResponse({ data: annotations });
                break;
            case 'importAnnotations':
                annotations = request.payload;
                saveAnnotations();
                sendResponse({ success: true });
                // Page will be reloaded by popup.js
                break;
        }
        return true; // Keep message channel open for async response
    });

    // --- Initialization ---
    // Load annotations when the page is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        loadAnnotations();
    } else {
        window.addEventListener('load', loadAnnotations, { once: true });
    }
    
    // Add main highlight listener
    document.addEventListener('mouseup', handleMouseUp);

})();