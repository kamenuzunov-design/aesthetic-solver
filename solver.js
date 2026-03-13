/**
 * Aesthetic Solver - Основна логика за изчисление
 * Включва "Права задача", Хармоничен анализ и Специфично закръгляне.
 */

const AestheticSolver = {
    // 1. Дефиниране на шестте системи
    ratios: [
        { name: "II РПЧ", val: 1.059, id_key: "rpch2" },
        { name: "III РПЧ", val: 1.122, id_key: "rpch3" },
        { name: "IV РПЧ", val: 1.259, id_key: "rpch4" },
        { name: "РЗС", val: 1.272, id_key: "rzs" },
        { name: "РЗВ", val: 1.309, id_key: "rzv" },
        { name: "ЗС", val: 1.618, id_key: "zs" }
    ],

    // 2. Генератор на колона
    generateColumn: (nom, ratio, displayName) => {
        let col = new Array(62).fill(null);
        const MIN = 10;
        const MAX = 1000;

        col[30] = displayName;
        col[31] = nom;

        let currentDown = nom;
        for (let i = 29; i >= 0; i--) {
            currentDown /= ratio;
            if (currentDown < MIN) break;
            col[i] = Number(currentDown.toFixed(2));
        }

        let currentUp = nom;
        for (let i = 32; i < 62; i++) {
            currentUp *= ratio;
            if (currentUp > MAX) break;
            col[i] = Number(currentUp.toFixed(2));
        }
        return col;
    },

    // 3. Функция за проверка на 2% отклонение
    isHarmonic: (target, reference) => {
        if (!target || !reference || isNaN(target) || isNaN(reference)) return false;
        const diff = Math.abs(target - reference);
        return (diff / reference) <= 0.02;
    }
};

let currentMatrix = []; // Глобална променлива за данните

/**
 * Основна функция за генериране на таблицата
 */
function calculate() {
    const inputField = document.getElementById('baseNum');
    const table = document.getElementById('propsTable');
    if (!inputField || !table) return;

    const nom = parseFloat(inputField.value) || 200;
    const lang = window.currentLangData || {};
    const txtNo = lang["th-no"] || "№";
    const txtP = lang["row-p"] || "P"; 
    const txtN = lang["row-n"] || "N";

    let displayNames = AestheticSolver.ratios.map(r => {
        const optEl = document.getElementById(`opt-${r.id_key}`);
        return optEl ? optEl.innerText : r.name;
    });

    let html = `<thead><tr><th style="border: 1px solid #ccc; padding: 5px;">${txtNo}</th>`;
    displayNames.forEach((name, idx) => {
        html += `<th onclick="runHarmonyAnalysis(${idx})" style="cursor:pointer; background:#f0f0f0; border:1px solid #ccc; padding: 10px;">${name}</th>`;
    });
    html += '</tr></thead><tbody>';

    currentMatrix = AestheticSolver.ratios.map((r, idx) => 
        AestheticSolver.generateColumn(nom, r.val, displayNames[idx])
    );

    for (let i = 0; i < 62; i++) {
        let rowStyle = (i === 30 || i === 31) ? 'style="background-color: #D3D3D3; font-weight: bold;"' : '';
        let rowLabel = (i < 30) ? `m${30 - i}` : (i === 30 ? txtP : (i === 31 ? txtN : `M${i - 31}`));
        
        html += `<tr ${rowStyle}><td style="border: 1px solid #eee; padding: 3px; font-weight: bold;">${rowLabel}</td>`;
        for (let j = 0; j < currentMatrix.length; j++) {
            let val = currentMatrix[j][i] || "";
            html += `<td id="cell-${j}-${i}" style="border: 1px solid #eee; padding: 3px;">${val}</td>`;
        }
        html += '</tr>';
    }
    table.innerHTML = html + '</tbody>';
}

/**
 * Функция за сравнителен анализ спрямо избрана колона (±2%)
 * С два нюанса на зеленото.
 */
function runHarmonyAnalysis(refColIdx) {
    const colorPrimary = "#77dd77"; // Наситено зелено
    const colorMatch = "#e2f3e2";   // Бледо зелено

    const allCells = document.querySelectorAll('#propsTable td');
    allCells.forEach(c => {
        if (c.id) {
            const rowIdx = parseInt(c.id.split('-')[2]);
            if (rowIdx !== 30 && rowIdx !== 31) c.style.backgroundColor = "";
        }
    });

    const reference