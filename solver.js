/**
 * Aesthetic Solver - Основна логика за изчисление
 */

const AestheticSolver = {
    ratios: [
		{ name: "II ФСЗ", val: 1.028, id_key: "fsz2" }, // Ново
        { name: "I РПЧ", val: 1.030, id_key: "rpch1" }, // Ново
        { name: "II РПЧ", val: 1.059, id_key: "rpch2" },
        { name: "I ФЗС", val: 1.118, id_key: "fsz1" }, // Ново
        { name: "III РПЧ", val: 1.122, id_key: "rpch3" },
        { name: "IV РПЧ", val: 1.259, id_key: "rpch4" },
        { name: "РЗС", val: 1.272, id_key: "rzs" },
        { name: "РЗВ", val: 1.309, id_key: "rzv" },
        { name: "ЗС", val: 1.618, id_key: "zs" }
    ],

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

    isHarmonic: (target, reference) => {
        if (!target || !reference || isNaN(target) || isNaN(reference)) return false;
        const diff = Math.abs(target - reference);
        return (diff / reference) <= 0.02;
    }
};

let currentMatrix = [];

/**
 * Основна функция за генериране на таблицата (Права задача)
 * Параметърът keepInverse позволява да запазим резултатите от обратната задача, ако е true
 */
function calculate(keepInverse = false) {
    // Скриваме резултатите от Обратната задача САМО ако не сме поискали изрично да ги запазим
    if (!keepInverse) {
        const inverseResults = document.getElementById('inverse-results');
        if (inverseResults) {
            inverseResults.style.display = 'none';
        }
    }

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

function runRecommendedAnalysis() {
    const select = document.getElementById('ratioSelect');
    if (!select) return;
    const index = AestheticSolver.ratios.findIndex(r => r.id_key === select.value);
    if (index !== -1) {
        runHarmonyAnalysis(index);
        generateChain(index);
    }
}

function runHarmonyAnalysis(refColIdx) {
    // 1. СИНХРОНИЗАЦИЯ: Намираме ID-то на системата и обновяваме падащото меню
    const systemId = AestheticSolver.ratios[refColIdx].id_key;
    const select = document.getElementById('ratioSelect');
    if (select) {
        select.value = systemId;
    }

    // 2. Генерираме веригата от числа (същата логика като бутона)
    generateChain(refColIdx);

    // --- Останалата част от функцията за оцветяване си остава същата ---
    const colorPrimary = "#77dd77"; 
    const colorMatch = "#e2f3e2";   
    const allCells = document.querySelectorAll('#propsTable td');
    allCells.forEach(c => {
        if (c.id) {
            const rowIdx = parseInt(c.id.split('-')[2]);
            if (rowIdx !== 30 && rowIdx !== 31) c.style.backgroundColor = "";
        }
    });
    const referenceValues = currentMatrix[refColIdx].filter(v => typeof v === 'number');
    for (let col = 0; col < currentMatrix.length; col++) {
        for (let row = 0; row < 62; row++) {
            if (row === 30 || row === 31) continue;
            let targetVal = currentMatrix[col][row];
            if (typeof targetVal !== 'number') continue;
            const cell = document.getElementById(`cell-${col}-${row}`);
            if (!cell) continue;
            if (col === refColIdx) {
                cell.style.backgroundColor = colorPrimary;
            } else {
                if (referenceValues.some(refVal => AestheticSolver.isHarmonic(targetVal, refVal))) {
                    cell.style.backgroundColor = colorMatch;
                }
            }
        }
    }
}

function generateChain(refColIdx) {
    let recommended = [];
    const refValues = currentMatrix[refColIdx];
    for (let row = 0; row < 62; row++) {
        let targetVal = refValues[row];
        if (typeof targetVal !== 'number') continue;
        let matchCount = 1;
        for (let col = 0; col < currentMatrix.length; col++) {
            if (col === refColIdx) continue;
            if (currentMatrix[col].some(val => typeof val === 'number' && AestheticSolver.isHarmonic(targetVal, val))) {
                matchCount++;
            }
        }
        if (matchCount >= 3) {
            recommended.push(applyHarmonyRounding(targetVal));
        }
    }
    let uniqueChain = [...new Set(recommended)].sort((a, b) => a - b);
    const chainInput = document.getElementById('resultChain');
    if (chainInput) chainInput.value = uniqueChain.join(', ');
}

/**
 * Функция за Обратно пропорциониране (Анализ на верига)
 * Намира най-добрата система и номинал за подадена поредица от числа.
 */
function runInverseAnalysis() {
    const input = document.getElementById('inputChain').value;
    // Почистваме входа и сортираме числата
    const nums = input.split(/[, \n\t]+/).map(n => parseFloat(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);

    if (nums.length < 5) {
        const txtMin = (window.currentLangData && window.currentLangData["ui-alert-min"]) || "Моля, въведете поне 5 числа за коректен анализ.";
        alert(txtMin);
        return;
    }

    // --- 1. АВТОМАТИЧЕН ИЗБОР НА НОМИНАЛ (ИНТЕЛИГЕНТЕН) ---
    const middleIndex = Math.floor(nums.length / 2);
    
    // Помощна функция за намиране на най-близкото число до средата на масива
    const getClosestToMiddle = (candidates) => {
        if (candidates.length === 0) return null;
        return candidates.reduce((prev, curr) => {
            const prevDist = Math.abs(nums.indexOf(prev) - middleIndex);
            const currDist = Math.abs(nums.indexOf(curr) - middleIndex);
            return (currDist < prevDist) ? curr : prev;
        });
    };

    // Филтрираме кандидатите по йерархия: 00 -> 0 -> средно
    const doubles = nums.filter(n => n % 100 === 0);
    const singles = nums.filter(n => n % 10 === 0);

    let nominal;
    if (doubles.length > 0) {
        nominal = getClosestToMiddle(doubles);
    } else if (singles.length > 0) {
        nominal = getClosestToMiddle(singles);
    } else {
        nominal = nums[middleIndex];
    }

    // --- 2. ТЪРСЕНЕ НА НАЙ-ДОБРА ПРОПОРЦИЯ ---
    let bestMatch = { ratioIdx: -1, removed: [], exact: [], score: -1 };

    AestheticSolver.ratios.forEach((ratioObj, idx) => {
        const idealCol = AestheticSolver.generateColumn(nominal, ratioObj.val, ratioObj.name);
        let currentMatches = [];
        let currentRemoved = [];

        nums.forEach(n => {
            const found = idealCol.some(idealV => typeof idealV === 'number' && AestheticSolver.isHarmonic(n, idealV));
            if (found) currentMatches.push(n);
            else currentRemoved.push(n);
        });

        // Точкуване на база брой съвпадения
        if (currentMatches.length > bestMatch.score) {
            bestMatch = { ratioIdx: idx, removed: currentRemoved, exact: currentMatches, score: currentMatches.length };
        }
    });

    // --- 3. СИНХРОНИЗАЦИЯ И ВИЗУАЛИЗАЦИЯ ---
    if (bestMatch.ratioIdx !== -1) {
        const txtNone = (window.currentLangData && window.currentLangData["ui-none"]) || "Няма";
        
        // Показваме панела с резултати
        document.getElementById('inverse-results').style.display = 'block';
        document.getElementById('res-system').innerText = AestheticSolver.ratios[bestMatch.ratioIdx].name;
        document.getElementById('res-nominal').innerText = nominal;
        document.getElementById('res-removed').innerText = bestMatch.removed.join(', ') || txtNone;
        document.getElementById('res-exact').innerText = bestMatch.exact.join(', ');

        // АВТОМАТИЧНО ОБНОВЯВАНЕ НА ОСНОВНАТА ТАБЛИЦА
        const baseNumInput = document.getElementById('baseNum');
        if (baseNumInput) baseNumInput.value = nominal;

        const select = document.getElementById('ratioSelect');
        if (select) {
            select.value = AestheticSolver.ratios[bestMatch.ratioIdx].id_key;
        }
        
        // Преизчисляваме таблицата (keepInverse = true, за да не скрием току-що показаните резултати)
        calculate(true);
        
        // Оцветяваме намерената колона и нейните съвпадения
        runHarmonyAnalysis(bestMatch.ratioIdx);
    }
}

function applyHarmonyRounding(val) {
    let rounded = Math.round(val);
    if (rounded <= 20) return rounded;
    const allowed = [0, 2, 4, 5, 6, 8];
    if (allowed.includes(rounded % 10)) return rounded;
    return rounded + 1;
}

function copyAndShare() {
    const copyText = document.getElementById("resultChain");
    if (!copyText || !copyText.value) return;
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    const btn = document.getElementById("ui-copy-share");
    if (btn) {
        const original = btn.innerText;
        btn.innerText = "OK!";
        setTimeout(() => btn.innerText = original, 2000);
    }
}

const CanvasManager = {
    init: () => {
        const canvas = document.getElementById('mainCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 400;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 600, 400);
    }
};

window.addEventListener('load', () => {
    CanvasManager.init();
});