// Internationalization (i18n) manager
class I18nManager {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.supportedLanguages = {
            'en': 'English',
            'zh-CN': '简体中文',
            'zh-TW': '繁體中文',
            'ja': '日本語',
            'ko': '한국어',
            'fr': 'Français',
            'de': 'Deutsch',
            'es': 'Español',
            'ru': 'Русский'
        };
        this.init();
    }

    async init() {
        // Detect browser language
        const browserLang = this.detectBrowserLanguage();
        
        // Load saved language preference or use browser language
        const savedLang = await this.getSavedLanguage();
        this.currentLanguage = savedLang || browserLang || 'en';
        
        // Load translations
        await this.loadTranslations(this.currentLanguage);
    }

    detectBrowserLanguage() {
        const lang = navigator.language || navigator.userLanguage;
        
        // Map browser language codes to our supported languages
        const langMap = {
            'zh-CN': 'zh-CN',
            'zh-TW': 'zh-TW',
            'zh-HK': 'zh-TW',
            'ja': 'ja',
            'ja-JP': 'ja',
            'ko': 'ko',
            'ko-KR': 'ko',
            'fr': 'fr',
            'fr-FR': 'fr',
            'de': 'de',
            'de-DE': 'de',
            'es': 'es',
            'es-ES': 'es',
            'ru': 'ru',
            'ru-RU': 'ru'
        };

        return langMap[lang] || langMap[lang.split('-')[0]] || 'en';
    }

    async getSavedLanguage() {
        try {
            const result = await chrome.storage.sync.get(['selectedLanguage']);
            return result.selectedLanguage;
        } catch (error) {
            console.error('Error loading saved language:', error);
            return null;
        }
    }

    async saveLanguage(language) {
        try {
            await chrome.storage.sync.set({ selectedLanguage: language });
        } catch (error) {
            console.error('Error saving language:', error);
        }
    }

    async loadTranslations(language) {
        try {
            const response = await fetch(`locales/${language}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${language} translations`);
            }
            this.translations = await response.json();
        } catch (error) {
            console.error('Error loading translations:', error);
            // Fallback to English if translation loading fails
            if (language !== 'en') {
                await this.loadTranslations('en');
            }
        }
    }

    async switchLanguage(language) {
        if (this.supportedLanguages[language]) {
            this.currentLanguage = language;
            await this.loadTranslations(language);
            await this.saveLanguage(language);
            this.updateUI();
        }
    }

    t(key, defaultValue = '') {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) {
                console.warn(`Translation missing for key: ${key}`);
                return defaultValue || key;
            }
        }
        
        return value || defaultValue || key;
    }

    updateUI() {
        // Update all translatable elements
        this.updateElementsWithAttribute('data-i18n');
        this.updateElementsWithAttribute('data-i18n-placeholder');
        this.updateElementsWithAttribute('data-i18n-title');
        
        // Update language selector
        this.updateLanguageSelector();
    }

    updateElementsWithAttribute(attribute) {
        const elements = document.querySelectorAll(`[${attribute}]`);
        elements.forEach(element => {
            const key = element.getAttribute(attribute);
            const translation = this.t(key);
            
            if (attribute === 'data-i18n-placeholder') {
                element.placeholder = translation;
            } else if (attribute === 'data-i18n-title') {
                element.title = translation;
            } else {
                element.textContent = translation;
            }
        });
    }

    updateLanguageSelector() {
        const selector = document.getElementById('languageSelect');
        if (selector) {
            selector.value = this.currentLanguage;
        }
    }

    getSupportedLanguages() {
        return this.supportedLanguages;
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Helper method to translate category names
    translateCategory(categoryKey) {
        return this.t(`ui.categories.${categoryKey}`, categoryKey);
    }
}

// Global i18n instance
let i18n;

// Initialize i18n when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    i18n = new I18nManager();
    await i18n.init();
    i18n.updateUI();
});