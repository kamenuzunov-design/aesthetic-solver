// lang.js
const translations = {
    bg: { title: "Aesthetic Solver", base: "Основно число (Nom):", btn: "Анализ" },
    en: { title: "Aesthetic Solver", base: "Base Number (Nom):", btn: "Analysis" }
};

function setLanguage(lang) {
    document.getElementById('ui-title').innerText = translations[lang].title;
    document.getElementById('ui-base-num').innerText = translations[lang].base;
    document.getElementById('ui-calculate').innerText = translations[lang].btn;
}
