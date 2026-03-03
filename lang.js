// lang.js
const translations = {
    bg: {
        welcome: "Естетически анализатор и софтуер за пропорциониране",
        labelNom: "Основно число (Nom):",
        btnCalc: "Анализ",
        tableHeadRow: "Ред / Коефициент",
        tableHeadVal: "Стойност",
        msgConnect: "Системата е готова за работа."
    },
    en: {
        welcome: "Aesthetic Analyzer and Proportioning Software",
        labelNom: "Base Number (Nom):",
        btnCalc: "Analysis",
        tableHeadRow: "Series / Ratio",
        tableHeadVal: "Value",
        msgConnect: "System is ready."
    }
};

function setLanguage(lang) {
    document.getElementById('ui-welcome').innerText = translations[lang].welcome;
    document.getElementById('ui-label-nom').innerText = translations[lang].labelNom;
    document.getElementById('ui-btn-calc').innerText = translations[lang].btnCalc;
    
    // Обновяване на заглавията на таблицата
    const cells = document.getElementById('ui-table-head').getElementsByTagName('th');
    cells[0].innerText = translations[lang].tableHeadRow;
    cells[1].innerText = translations[lang].tableHeadVal;

    // Запазваме избрания език в паметта на браузъра
    localStorage.setItem('preferredLang', lang);
}

// Изпълнява се при зареждане
window.onload = () => {
    const savedLang = localStorage.getItem('preferredLang') || 'bg';
    setLanguage(savedLang);
};
