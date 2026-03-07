window.currentLangData = {}; 

async function setLanguage(langCode) {
    try {
        const response = await fetch(`lang/${langCode}.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`Файлът ${langCode}.json не е намерен`);
        
        const data = await response.json();
        window.currentLangData = data; 

        // Обновяване на всички текстове по ID
        Object.keys(data).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = data[key];
            }
        });

        localStorage.setItem('preferredLang', langCode);

        // Веднага извикваме изчисленията, за да се обнови таблицата
        if (typeof calculate === "function") {
            calculate();
        }

    } catch (error) {
        console.error("Грешка при локализацията:", error);
    }
}

// Зареждане при стартиране
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'bg';
    setLanguage(savedLang);
});