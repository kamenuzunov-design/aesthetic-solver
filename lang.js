const translations = {
    bg: {
        title: "Естетическо пропорциониране",
        base: "Номинал:",
        btn: "Анализ",
        thLabel: "№"
    },
    en: {
        title: "Aesthetic Solver",
        base: "Base Number(Nom):",
        btn: "Analysis",
        thLabel: "№"
    }
};

function setLanguage(lang) {
    const titleEl = document.getElementById('ui-title');
    const baseEl = document.getElementById('ui-base-num');
    const btnEl = document.getElementById('ui-calculate');

    if (titleEl) titleEl.innerText = translations[lang].title;
    if (baseEl) baseEl.innerText = translations[lang].base;
    if (btnEl) btnEl.innerText = translations[lang].btn;

    localStorage.setItem('preferredLang', lang);
}

window.onload = () => {
    const savedLang = localStorage.getItem('preferredLang') || 'bg';
    setLanguage(savedLang);
};
