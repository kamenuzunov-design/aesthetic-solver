window.currentLangData = {}; 

async function setLanguage(langCode) {
    try {
        const response = await fetch(`lang/${langCode}.json?v=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`Файлът ${langCode}.json не е намерен`);
        
        const data = await response.json();
        window.currentLangData = data; 

        // Обновяваме всички статични елементи (Title, Labels, Buttons)
        Object.keys(data).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = data[key];
            }
        });

        localStorage.setItem('preferredLang', langCode);

        // ЕДВА СЕГА викаме calculate, когато езикът е зареден в window.currentLangData
        if (typeof calculate === "function") {
            calculate();
        }
    } catch (error) {
        console.error("Грешка при локализацията:", error);
    }
}

// Изпълнява се веднага при зареждане
document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'bg';
    setLanguage(savedLang);
});