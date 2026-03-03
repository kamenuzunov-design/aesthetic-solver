// lang.js
const translations = {
    bg: {
        title: "Aesthetic Solver",
        base: "Основно число (Nom):",
        btn: "Анализ",
        th1: "Система",
        th2: "Стойност"
    },
    en: {
        title: "Aesthetic Solver",
        base: "Base Number (Nom):",
        btn: "Analysis",
        th1: "System",
        th2: "Value"
    }
};

function setLanguage(lang) {
    document.getElementById('ui-title').innerText = translations[lang].title;
    document.getElementById('ui-base-num').innerText = translations[lang].base;
    document.getElementById('ui-calculate').innerText = translations[lang].btn;
    
    const cells = document.getElementById('ui-table-head').getElementsByTagName('th');
    cells[0].innerText = translations[lang].th1;
    cells[1].innerText = translations[lang].th2;

    localStorage.setItem('preferredLang', lang);
}

window.onload = () => {
    const savedLang = localStorage.getItem('preferredLang') || 'bg';
    setLanguage(savedLang);
};
