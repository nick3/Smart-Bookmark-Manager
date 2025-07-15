// Popup script for Smart Bookmark Manager
class BookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.categorizedBookmarks = {};
        this.brokenBookmarks = [];
        this.settings = {
            apiBaseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            modelName: 'gpt-3.5-turbo',
            enableLLMAnalysis: true,
            autoRemoveBroken: true,
            createFolders: true,
            selectedLanguage: 'en'
        };
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadSettings();
        this.switchTab('organize');
        this.initializeLanguageSelector();
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchTab(tab);
            });
        });

        // Main actions
        document.getElementById('scanBookmarks').addEventListener('click', () => {
            this.scanBookmarks();
        });

        document.getElementById('organizeBookmarks').addEventListener('click', () => {
            this.organizeBookmarks();
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            this.saveSettings();
        });

        document.getElementById('testConnection').addEventListener('click', () => {
            this.testApiConnection();
        });

        // Language selector
        document.getElementById('languageSelect').addEventListener('change', (e) => {
            this.switchLanguage(e.target.value);
        });
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });
        document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    }

    async scanBookmarks() {
        this.showProgress(true);
        this.updateProgress(0, i18n.t('ui.progress.getting'));
        
        try {
            // Get all bookmarks
            const bookmarks = await this.sendMessage({ action: 'getAllBookmarks' });
            this.bookmarks = bookmarks;
            this.updateProgress(20, i18n.t('ui.progress.getting') + ` ${bookmarks.length} ${i18n.t('ui.progress.checking')}...`);

            // Check accessibility and categorize
            const results = await this.processBookmarks(bookmarks);
            
            this.updateProgress(100, i18n.t('ui.progress.complete'));
            
            setTimeout(() => {
                this.showProgress(false);
                this.displayResults(results);
            }, 1000);

        } catch (error) {
            console.error('Error scanning bookmarks:', error);
            this.showProgress(false);
            alert('Error scanning bookmarks. Please try again.');
        }
    }

    async processBookmarks(bookmarks) {
        const accessible = [];
        const broken = [];
        const categories = {};
        const processingErrors = [];

        for (let i = 0; i < bookmarks.length; i++) {
            const bookmark = bookmarks[i];
            const progress = 20 + (i / bookmarks.length) * 70;
            
            this.updateProgress(progress, i18n.t('ui.progress.checking') + ` ${bookmark.title}...`);

            try {
                // Check accessibility with timeout
                const accessibilityResult = await Promise.race([
                    this.sendMessage({
                        action: 'checkUrl',
                        url: bookmark.url
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Accessibility check timeout')), 30000)
                    )
                ]);

                if (accessibilityResult.accessible) {
                    try {
                        // Analyze and categorize with timeout
                        const analysisResult = await Promise.race([
                            this.sendMessage({
                                action: 'analyzeWebsite',
                                url: bookmark.url,
                                settings: this.settings
                            }),
                            new Promise((_, reject) => 
                                setTimeout(() => reject(new Error('Analysis timeout')), 45000)
                            )
                        ]);

                        bookmark.category = analysisResult.category;
                        bookmark.confidence = analysisResult.confidence;
                        bookmark.description = analysisResult.description;
                        bookmark.method = analysisResult.method;
                        
                        accessible.push(bookmark);

                        // Group by category
                        if (!categories[analysisResult.category]) {
                            categories[analysisResult.category] = [];
                        }
                        categories[analysisResult.category].push(bookmark);
                    } catch (analysisError) {
                        console.warn(`Analysis failed for ${bookmark.title}:`, analysisError);
                        // Use fallback category
                        bookmark.category = 'Other';
                        bookmark.confidence = 0.1;
                        bookmark.description = 'Analysis failed - using fallback category';
                        bookmark.method = 'fallback';
                        
                        accessible.push(bookmark);
                        if (!categories['Other']) {
                            categories['Other'] = [];
                        }
                        categories['Other'].push(bookmark);
                        
                        processingErrors.push(`Analysis failed for ${bookmark.title}: ${analysisError.message}`);
                    }
                } else {
                    bookmark.error = accessibilityResult.error;
                    bookmark.permanent = accessibilityResult.permanent;
                    broken.push(bookmark);
                }
            } catch (error) {
                console.error(`Processing failed for ${bookmark.title}:`, error);
                bookmark.error = error.message;
                broken.push(bookmark);
                processingErrors.push(`Processing failed for ${bookmark.title}: ${error.message}`);
            }

            // Small delay to prevent overwhelming the browser
            await this.delay(100);
        }

        this.categorizedBookmarks = categories;
        this.brokenBookmarks = broken;
        this.processingErrors = processingErrors;

        return {
            accessible: accessible.length,
            broken: broken.length,
            total: bookmarks.length,
            categories,
            errors: processingErrors
        };
    }

    displayResults(results) {
        // Update statistics
        document.getElementById('totalBookmarks').textContent = results.total;
        document.getElementById('accessibleBookmarks').textContent = results.accessible;
        document.getElementById('inaccessibleBookmarks').textContent = results.broken;

        // Show processing errors if any
        if (results.errors && results.errors.length > 0) {
            this.showProcessingErrors(results.errors);
        }

        // Display categorized bookmarks
        this.displayCategorizedBookmarks();
        
        // Display broken bookmarks
        this.displayBrokenBookmarks();

        // Show results section and enable organize button
        document.getElementById('results-section').classList.remove('hidden');
        document.getElementById('organizeBookmarks').disabled = false;
    }

    showProcessingErrors(errors) {
        const errorSection = document.createElement('div');
        errorSection.className = 'processing-errors';
        errorSection.innerHTML = `
            <div class="error-summary">
                <h4 style="color: #e74c3c; margin-bottom: 10px;">
                    ⚠️ Processing Issues (${errors.length})
                </h4>
                <details style="margin-bottom: 15px;">
                    <summary style="cursor: pointer; color: #667eea;">View Details</summary>
                    <div style="margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                        ${errors.map(error => `<p style="margin: 5px 0; font-size: 12px; color: #666;">${error}</p>`).join('')}
                    </div>
                </details>
            </div>
        `;
        
        // Insert error section at the top of results
        const resultsSection = document.getElementById('results-section');
        const statsSection = resultsSection.querySelector('.stats');
        statsSection.insertAdjacentElement('afterend', errorSection);
    }

    displayCategorizedBookmarks() {
        const container = document.getElementById('categorizedBookmarks');
        container.innerHTML = '';

        Object.entries(this.categorizedBookmarks).forEach(([category, bookmarks]) => {
            const categoryElement = this.createCategoryElement(category, bookmarks);
            container.appendChild(categoryElement);
        });
    }

    createCategoryElement(category, bookmarks) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-group';

        const header = document.createElement('div');
        header.className = 'category-header';
        header.innerHTML = `
            <span>${this.getCategoryIcon(category)} ${i18n.translateCategory(category)}</span>
            <span class="category-count">${bookmarks.length}</span>
        `;

        categoryDiv.appendChild(header);

        bookmarks.forEach(bookmark => {
            const bookmarkElement = this.createBookmarkElement(bookmark, true);
            categoryDiv.appendChild(bookmarkElement);
        });

        return categoryDiv;
    }

    displayBrokenBookmarks() {
        const container = document.getElementById('brokenBookmarks');
        container.innerHTML = '';

        if (this.brokenBookmarks.length === 0) {
            container.innerHTML = `<p style="text-align: center; color: #666; padding: 20px;">${i18n.t('ui.sections.noBrokenBookmarks')}</p>`;
            return;
        }

        this.brokenBookmarks.forEach(bookmark => {
            const bookmarkElement = this.createBookmarkElement(bookmark, false);
            container.appendChild(bookmarkElement);
        });
    }

    createBookmarkElement(bookmark, accessible) {
        const div = document.createElement('div');
        div.className = 'bookmark-item';

        const favicon = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=16`;
        
        div.innerHTML = `
            <img src="${favicon}" alt="" class="bookmark-favicon" onerror="this.src='data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 16 16\"><rect width=\"16\" height=\"16\" fill=\"%23ddd\"/></svg>'">
            <div style="flex: 1; min-width: 0;">
                <div class="bookmark-title">${bookmark.title}</div>
                <div class="bookmark-url">${bookmark.url}</div>
            </div>
            <span class="bookmark-status ${accessible ? 'status-accessible' : 'status-broken'}">
                ${accessible ? i18n.t('ui.status.accessible') : i18n.t('ui.status.broken')}
            </span>
        `;

        return div;
    }

    getCategoryIcon(category) {
        const icons = {
            'Development': '💻',
            'Entertainment': '🎬',
            'Shopping': '🛒',
            'Search/Tools': '🔧',
            'Social Media': '📱',
            'Professional': '💼',
            'News': '📰',
            'Reference': '📚',
            'Community': '👥',
            'Productivity': '✅',
            'Education': '🎓',
            'Other': '📄'
        };
        return icons[category] || '📄';
    }

    async organizeBookmarks() {
        if (confirm(i18n.t('ui.messages.confirmOrganization'))) {
            try {
                document.getElementById('organizeBookmarks').disabled = true;
                document.getElementById('organizeBookmarks').innerHTML = `<span class="btn-icon">📁</span><span>${i18n.t('ui.status.organizing')}</span>`;

                const result = await this.applyOrganization();
                
                // Create detailed success/partial success message
                let message = '';
                if (result.success) {
                    message = i18n.t('ui.messages.organizationSuccess');
                    if (result.organized > 0) {
                        message += `\n✅ ${result.organized} bookmarks organized`;
                    }
                    if (result.removed > 0) {
                        message += `\n🗑️ ${result.removed} broken bookmarks removed`;
                    }
                } else {
                    message = i18n.t('ui.messages.organizationError');
                }

                // Show errors if any
                if (result.errors && result.errors.length > 0) {
                    const errorCount = result.errors.length;
                    message += `\n\n⚠️ ${errorCount} issues encountered:`;
                    
                    // Show first 3 errors
                    const displayErrors = result.errors.slice(0, 3);
                    displayErrors.forEach(error => {
                        message += `\n• ${error}`;
                    });
                    
                    if (result.errors.length > 3) {
                        message += `\n• ... and ${result.errors.length - 3} more`;
                    }
                }

                // Show partial success if applicable
                if (result.partialSuccess) {
                    message += '\n\n⚠️ Some operations failed but overall process completed with partial success.';
                }
                
                alert(message);
                
                // Reset UI
                document.getElementById('results-section').classList.add('hidden');
                document.getElementById('organizeBookmarks').disabled = false;
                document.getElementById('organizeBookmarks').innerHTML = `<span class="btn-icon">📁</span><span data-i18n="ui.actions.organizeBookmarks">${i18n.t('ui.actions.organizeBookmarks')}</span>`;
                
            } catch (error) {
                console.error('Error organizing bookmarks:', error);
                let errorMessage = i18n.t('ui.messages.organizationError');
                if (error.message) {
                    errorMessage += `\n\nError details: ${error.message}`;
                }
                alert(errorMessage);
                document.getElementById('organizeBookmarks').disabled = false;
                document.getElementById('organizeBookmarks').innerHTML = `<span class="btn-icon">📁</span><span data-i18n="ui.actions.organizeBookmarks">${i18n.t('ui.actions.organizeBookmarks')}</span>`;
            }
        }
    }

    async applyOrganization() {
        // Call the background script to actually organize bookmarks
        const result = await this.sendMessage({
            action: 'organizeBookmarks',
            categorizedBookmarks: this.categorizedBookmarks,
            brokenBookmarks: this.brokenBookmarks,
            settings: this.settings
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to organize bookmarks');
        }

        return result;
    }

    showProgress(show) {
        const progressSection = document.getElementById('progress-section');
        if (show) {
            progressSection.classList.remove('hidden');
        } else {
            progressSection.classList.add('hidden');
        }
    }

    updateProgress(percent, text) {
        document.querySelector('.progress-fill').style.width = `${percent}%`;
        document.querySelector('.progress-text').textContent = text;
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['bookmarkManagerSettings']);
            if (result.bookmarkManagerSettings) {
                this.settings = { ...this.settings, ...result.bookmarkManagerSettings };
                this.updateSettingsUI();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            this.settings.apiBaseUrl = document.getElementById('apiBaseUrl').value;
            this.settings.apiKey = document.getElementById('apiKey').value;
            this.settings.modelName = document.getElementById('modelName').value;
            this.settings.enableLLMAnalysis = document.getElementById('enableLLMAnalysis').checked;
            this.settings.autoRemoveBroken = document.getElementById('autoRemoveBroken').checked;
            this.settings.createFolders = document.getElementById('createFolders').checked;
            this.settings.selectedLanguage = document.getElementById('languageSelect').value;

            await chrome.storage.sync.set({ bookmarkManagerSettings: this.settings });
            
            // Show success feedback
            const btn = document.getElementById('saveSettings');
            const originalText = btn.textContent;
            btn.textContent = i18n.t('ui.status.saved');
            btn.style.background = '#51cf66';
            
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
            
        } catch (error) {
            console.error('Error saving settings:', error);
            alert(i18n.t('ui.messages.settingsError'));
        }
    }

    async testApiConnection() {
        const btn = document.getElementById('testConnection');
        const originalText = btn.textContent;
        btn.textContent = i18n.t('ui.status.testing');
        btn.disabled = true;

        try {
            const testResult = await Promise.race([
                this.sendMessage({
                    action: 'testLLMConnection',
                    settings: {
                        apiBaseUrl: document.getElementById('apiBaseUrl').value,
                        apiKey: document.getElementById('apiKey').value,
                        modelName: document.getElementById('modelName').value
                    }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Connection test timeout')), 30000)
                )
            ]);

            if (testResult.success) {
                btn.textContent = i18n.t('ui.status.connected');
                btn.style.background = '#51cf66';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }, 2000);
            } else {
                throw new Error(testResult.error || 'Connection failed');
            }
        } catch (error) {
            console.error('API connection test failed:', error);
            btn.textContent = i18n.t('ui.status.failed');
            btn.style.background = '#dc3545';
            
            let errorMessage = `${i18n.t('ui.messages.connectionError')} ${error.message}`;
            if (error.message.includes('timeout')) {
                errorMessage += '\n\nTip: Check if your API endpoint is correct and accessible.';
            }
            
            alert(errorMessage);
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
                btn.disabled = false;
            }, 2000);
        }
    }

    initializeLanguageSelector() {
        const selector = document.getElementById('languageSelect');
        selector.innerHTML = '';
        
        const languages = i18n.getSupportedLanguages();
        Object.entries(languages).forEach(([code, name]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = name;
            selector.appendChild(option);
        });
        
        selector.value = i18n.getCurrentLanguage();
    }

    async switchLanguage(language) {
        await i18n.switchLanguage(language);
        this.settings.selectedLanguage = language;
        // Update placeholders and default values
        this.updateSettingsUI();
    }

    updateSettingsUI() {
        document.getElementById('apiBaseUrl').value = this.settings.apiBaseUrl || 'https://api.openai.com/v1';
        document.getElementById('apiKey').value = this.settings.apiKey || '';
        document.getElementById('modelName').value = this.settings.modelName || 'gpt-3.5-turbo';
        document.getElementById('enableLLMAnalysis').checked = this.settings.enableLLMAnalysis !== false;
        document.getElementById('autoRemoveBroken').checked = this.settings.autoRemoveBroken;
        document.getElementById('createFolders').checked = this.settings.createFolders;
        document.getElementById('languageSelect').value = this.settings.selectedLanguage || 'en';
    }

    sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the bookmark manager when the popup loads
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for i18n to be ready
    if (typeof i18n === 'undefined') {
        // If i18n is not ready, wait a bit and try again
        setTimeout(() => {
            if (typeof i18n !== 'undefined') {
                new BookmarkManager();
            }
        }, 100);
    } else {
        new BookmarkManager();
    }
});