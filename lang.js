async function setLanguage(langCode) {
    try {
        // 1. Зареждаме съответния JSON файл
        const response = await fetch(`${langCode}.json`);
        const data = await response.json();

        // 2. Обновяваме елементите по ID
        const elements = {
            'ui-title': data.title,
            'ui-label-nom': data.label_nomin,
            'ui-btn-calc': data.btn_als,
            'ui-tab-about': data.tab_about,
            'ui-tab-num': data.tab_num_calc,
            'ui-tab-graph': data.tab_graph_calc
        };

        for (const [id, text] of Object.entries(elements)) {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        }

        // 3. Запазваме избора в браузъра
        localStorage.setItem('preferredLang', langCode);
        
        // 4. Ако таблицата вече е генерирана, я обновяваме
        if (typeof calculate === "function") calculate();

    } catch (error) {
        console.error("Грешка при зареждане на езика:", error);
    }
}

// Извиква се при стартиране
window.addEventListener('load', () => {
    const savedLang = localStorage.getItem('preferredLang') || 'bg';
    setLanguage(savedLang);
});