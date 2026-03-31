/**
 * Language Management Module
 */

window.currentLangData = {}; 

async function setLanguage(langCode) {
    try {
        const response = await fetch(`lang/${langCode}.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`File ${langCode}.json not found`);
        
        const data = await response.json();
        
        // 1. Записваме данните в глобалния обект (чрез референция)
        Object.assign(window.currentLangData, data);
        // За всеки случай презаписваме и самата променлива
        window.currentLangData = data; 

        // 2. Обновяваме статичните елементи в DOM
        Object.keys(data).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.classList.contains('geo-toolbar-btn')) {
                    element.title = data[key];
                } else if (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit')) {
                    element.value = data[key];
                } else {
                    element.textContent = data[key];
                }
            }
        });
 
        localStorage.setItem('preferredLang', langCode);

        if (typeof calculate === "function") calculate();
        
        console.log(`Language set to: ${langCode}`, Object.keys(data).length, "keys loaded.");
    } catch (error) {
        console.error("Localization error:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'bg';
    setLanguage(savedLang);
});