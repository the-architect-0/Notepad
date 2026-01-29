 const notepad = document.getElementById('notepad');
        const preview = document.getElementById('preview');
        const previewToggle = document.getElementById('previewToggle');
        const clearBtn = document.getElementById('clearBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const undoBtn = document.getElementById('undoBtn');
        const darkModeToggle = document.getElementById('darkModeToggle');
        const saveIndicator = document.getElementById('saveIndicator');
        const lastSaved = document.getElementById('lastSaved');
        const charCount = document.getElementById('charCount');
        const wordCount = document.getElementById('wordCount');

        // State Variables
        let saveTimer = null;
        let isPreviewMode = false;
        let undoStack = [];
        let redoStack = [];
        const MAX_UNDO_STEPS = 10;
        let lastContent = '';

        // Initialize the application
        function init() {
            // Load saved content from localStorage
            const savedContent = localStorage.getItem('notepad-content');
            if (savedContent) {
                notepad.value = savedContent;
                lastContent = savedContent;
                updateStats();
                updatePreview();
                updateLastSaved();
            }
            
            // Load dark mode preference
            const darkMode = localStorage.getItem('notepad-dark-mode') === 'true';
            if (darkMode) {
                document.body.classList.add('dark-mode');
                darkModeToggle.checked = true;
            }
            
            // Initialize undo stack
            undoStack.push(notepad.value);
            
            // Set up event listeners
            setupEventListeners();
            
            // Focus on textarea
            notepad.focus();
        }

        // Set up all event listeners
        function setupEventListeners() {
            // Auto-save with debouncing
            notepad.addEventListener('input', () => {
                updateStats();
                updatePreview();
                
                // Save for undo functionality
                if (notepad.value !== lastContent) {
                    addToUndoStack(lastContent);
                    lastContent = notepad.value;
                }
                
                // Debounced auto-save
                clearTimeout(saveTimer);
                saveTimer = setTimeout(saveToLocalStorage, 2000);
            });
            
            // Tab key inserts 2 spaces
            notepad.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    insertAtCursor('  ');
                }
                
                // Ctrl+Z for undo, Ctrl+Y for redo
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        undo();
                    } else if (e.key === 'z' && e.shiftKey) {
                        e.preventDefault();
                        redo();
                    } else if (e.key === 'y') {
                        e.preventDefault();
                        redo();
                    }
                }
            });
            
            // Preview toggle
            previewToggle.addEventListener('click', togglePreview);
            
            // Clear button with confirmation
            clearBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all content? This cannot be undone.')) {
                    notepad.value = '';
                    updateStats();
                    updatePreview();
                    saveToLocalStorage();
                    addToUndoStack(lastContent);
                    lastContent = '';
                }
            });
            
            // Download button
            downloadBtn.addEventListener('click', downloadAsTxt);
            
            // Undo button
            undoBtn.addEventListener('click', undo);
            
            // Dark mode toggle
            darkModeToggle.addEventListener('change', toggleDarkMode);
            
            // Update last saved time periodically
            setInterval(updateLastSaved, 60000); // Update every minute
        }

        // Save content to localStorage
        function saveToLocalStorage() {
            localStorage.setItem('notepad-content', notepad.value);
            localStorage.setItem('notepad-last-saved', new Date().toISOString());
            
            // Show save indicator
            saveIndicator.classList.add('show');
            setTimeout(() => {
                saveIndicator.classList.remove('show');
            }, 2000);
            
            updateLastSaved();
        }

        // Update character and word count
        function updateStats() {
            const text = notepad.value;
            const chars = text.length;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            
            charCount.textContent = `Chars: ${chars}`;
            wordCount.textContent = `Words: ${words}`;
        }

        // Update the last saved timestamp
        function updateLastSaved() {
            const savedTime = localStorage.getItem('notepad-last-saved');
            if (savedTime) {
                const date = new Date(savedTime);
                const now = new Date();
                const diffMs = now - date;
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                
                let displayTime;
                if (diffMins < 1) {
                    displayTime = 'Just now';
                } else if (diffMins < 60) {
                    displayTime = `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
                } else if (diffHours < 24) {
                    displayTime = `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
                } else {
                    displayTime = `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
                }
                
                lastSaved.textContent = `Last save: ${displayTime}`;
            }
        }

        // Toggle preview mode
        function togglePreview() {
            isPreviewMode = !isPreviewMode;
            
            if (isPreviewMode) {
                notepad.style.display = 'none';
                preview.classList.add('active');
                previewToggle.innerHTML = '<i class="fas fa-edit"></i> <span>Edit</span>';
                updatePreview();
            } else {
                notepad.style.display = 'block';
                preview.classList.remove('active');
                previewToggle.innerHTML = '<i class="fas fa-eye"></i> <span>Preview</span>';
            }
        }

        // Update markdown preview
        function updatePreview() {
            if (!isPreviewMode) return;
            
            const text = notepad.value;
            let html = '';
            
            // Split by lines for processing
            const lines = text.split('\n');
            let inCodeBlock = false;
            let codeBlockContent = '';
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                // Code blocks
                if (line.startsWith('```')) {
                    if (inCodeBlock) {
                        // End code block
                        html += `<pre><code>${escapeHtml(codeBlockContent)}</code></pre>`;
                        codeBlockContent = '';
                        inCodeBlock = false;
                    } else {
                        // Start code block
                        inCodeBlock = true;
                    }
                    continue;
                }
                
                if (inCodeBlock) {
                    codeBlockContent += line + '\n';
                    continue;
                }
                
                // Headers
                if (line.startsWith('# ')) {
                    html += `<h1>${parseInlineMarkdown(line.substring(2))}</h1>`;
                } else if (line.startsWith('## ')) {
                    html += `<h2>${parseInlineMarkdown(line.substring(3))}</h2>`;
                } else if (line.startsWith('### ')) {
                    html += `<h3>${parseInlineMarkdown(line.substring(4))}</h3>`;
                } else if (line.trim() === '') {
                    // Empty line
                    html += '<p><br></p>';
                } else if (line.startsWith('> ')) {
                    // Blockquote
                    html += `<blockquote>${parseInlineMarkdown(line.substring(2))}</blockquote>`;
                } else {
                    // Regular paragraph
                    html += `<p>${parseInlineMarkdown(line)}</p>`;
                }
            }
            
            // Handle case where code block isn't closed
            if (inCodeBlock) {
                html += `<pre><code>${escapeHtml(codeBlockContent)}</code></pre>`;
            }
            
            preview.innerHTML = html || '<p class="placeholder">Nothing to preview. Start typing to see your markdown rendered here.</p>';
        }

        // Parse inline markdown (bold, italic, code)
        function parseInlineMarkdown(text) {
            // Escape HTML first
            text = escapeHtml(text);
            
            // Bold: **text** or __text__
            text = text.replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>');
            
            // Italic: *text* or _text_
            text = text.replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>');
            
            // Inline code: `code`
            text = text.replace(/`(.*?)`/g, '<code>$1</code>');
            
            return text;
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Toggle dark mode
        function toggleDarkMode() {
            if (darkModeToggle.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('notepad-dark-mode', 'true');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('notepad-dark-mode', 'false');
            }
        }

        // Insert text at cursor position
        function insertAtCursor(text) {
            const start = notepad.selectionStart;
            const end = notepad.selectionEnd;
            const value = notepad.value;
            
            notepad.value = value.substring(0, start) + text + value.substring(end);
            notepad.selectionStart = notepad.selectionEnd = start + text.length;
            notepad.focus();
            
            // Trigger input event for auto-save
            notepad.dispatchEvent(new Event('input'));
        }

        // Download content as text file
        function downloadAsTxt() {
            const content = notepad.value;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `notepad-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Undo/redo functionality
        function addToUndoStack(content) {
            undoStack.push(content);
            if (undoStack.length > MAX_UNDO_STEPS) {
                undoStack.shift();
            }
            redoStack = []; // Clear redo stack when new change is made
        }

        function undo() {
            if (undoStack.length > 1) {
                redoStack.push(undoStack.pop());
                notepad.value = undoStack[undoStack.length - 1];
                lastContent = notepad.value;
                notepad.dispatchEvent(new Event('input'));
            }
        }

        function redo() {
            if (redoStack.length > 0) {
                undoStack.push(redoStack.pop());
                notepad.value = undoStack[undoStack.length - 1];
                lastContent = notepad.value;
                notepad.dispatchEvent(new Event('input'));
            }
        }

        // Initialize the app when DOM is loaded
        document.addEventListener('DOMContentLoaded', init);