// Глобална променлива, която ще пази текущия превод
window.currentLangData = {};

async function setLanguage(langCode) {
    try {
        const response = await fetch(`lang/${langCode}.json`);
        if (!response.ok) throw new Error(`Неуспешно зареждане`);
        const data = await response.json();
        
        // Запазваме данните глобално
        window.currentLangData = data;

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
        
        // Преизчисляваме таблицата, за да се сменят текстовете вътре в нея
        if (typeof calculate === "function") calculate();

    } catch (error) {
        console.error("Грешка:", error);
    }
}