/**
 * Aesthetic Solver - Основна логика за изчисление
 * Включва "Права задача" с 62 реда и динамична езикова поддръжка.
 */

const AestheticSolver = {
    // 1. Дефиниране на шестте системи с техните ID-та за връзка с интерфейса
    ratios: [
        { name: "II РПЧ", val: 1.059, id_key: "rpch2" },
        { name: "III РПЧ", val: 1.122, id_key: "rpch3" },
        { name: "IV РПЧ", val: 1.259, id_key: "rpch4" },
        { name: "РЗС", val: 1.272, id_key: "rzs" },
        { name: "РЗВ", val: 1.309, id_key: "rzv" },
        { name: "ЗС", val: 1.618, id_key: "zs" }
    ],

    // 2. Генератор на колона (изчислява 30 минора и 30 мажора)
    generateColumn: (nom, ratio, displayName) => {
        let col = new Array(62).fill(null);
        const MIN = 1;
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

    // 3. Функция за проверка на 2% отклонение (Хармоничен анализ)
    isHarmonic: (target, reference) => {
        if (!target || !reference || isNaN(target) || isNaN(reference)) return false;
        const diff = Math.abs(target - reference);
        return (diff / reference) <= 0.02;
    }
};

let currentMatrix = []; // Глобална променлива за съхранение на изчислените данни

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
        let rowLabel = "";
        if (i < 30) rowLabel = `m${30 - i}`;      
        else if (i === 30) rowLabel = txtP;  
        else if (i === 31) rowLabel = txtN;  
        else rowLabel = `M${i - 31}`;             
        
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
 * Функция за бутона "Препоръчани числа"
 */
function runRecommendedAnalysis() {
    const select = document.getElementById('ratioSelect');
    if (!select) return;
    
    const selectedValue = select.value;
    const index = AestheticSolver.ratios.findIndex(r => r.id_key === selectedValue);
    
    if (index !== -1) {
        runHarmonyAnalysis(index);
        generateChain(index); // Генерираме веригата при натискане на бутона
    }
}

/**
 * Функция за сравнителен анализ спрямо избрана колона (±2%)
 */
function runHarmonyAnalysis(refColIdx) {
    const colorPrimary = "#77dd77"; 
    const colorMatch = "#e2f3e2";   

    const allCells = document.querySelectorAll('#propsTable td');
    allCells.forEach(c => {
        if (c.id) {
            const rowIdx = parseInt(c.id.split('-')[2]);
            if (rowIdx !== 30 && rowIdx !== 31) {
                c.style.backgroundColor = "";
            }
        }
    });

    const referenceValues = currentMatrix[refColIdx].filter(v => typeof v === 'number');

    for (let col = 0; col < currentMatrix.length; col++) {
        for (let row = 0; row < 62; row++) {
            if (row === 30 || row === 31) continue;

            let targetVal = currentMatrix[col][row];
            if (typeof targetVal !== 'number') continue;

            const cell = document.getElementById(`cell-${col}-${row}`);