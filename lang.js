async function setLanguage(langCode) {
    try {
        // Указваме пътя до папка lang/
        const response = await fetch(`lang/${langCode}.json`);
        
        if (!response.ok) throw new Error(`Неуспешно зареждане на: ${langCode}.json`);
        
        const data = await response.json();

        // Обновяваме основните елементи
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

        localStorage.setItem('preferredLang', langCode);
        
        // Обновяваме таблицата, за да се сменят заглавията (ако функцията съществува)
        if (typeof calculate === "function") {
            calculate();
        }

    } catch (error) {
        console.error("Грешка при зареждане на езика:", error);
    }
}