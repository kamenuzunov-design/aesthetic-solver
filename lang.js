window.currentLangData = {}; // Глобален обект, достъпен за solver.js

async function setLanguage(langCode) {
    try {
        const response = await fetch(`lang/${langCode}.json`);
        if (!response.ok) throw new Error(`Файлът ${langCode}.json не е намерен`);
        
        const data = await response.json();
        window.currentLangData = data; // Запазваме данните

        // АВТОМАТИЧНО ОБНОВЯВАНЕ ПО ID
        Object.keys(data).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                element.innerText = data[key];
            }
        });

        localStorage.setItem('preferredLang', langCode);

        // Обновяваме таблицата, за да се сменят динамичните текстове (P, N и др.)
        if (typeof calculate === "function") {
            calculate();
        }

    } catch (error) {
        console.error("Грешка при локализацията:", error);
    }
}