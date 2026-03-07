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
        const MIN = 10;
        const MAX = 1000;

        // Ред 31 (Индекс 30): Използваме преведеното име от интерфейса
        col[30] = `${displayName} (${ratio})`;
        // Ред 32 (Индекс 31): Стойност на Номинала
        col[31] = nom;

        // Изчисляване на Минори (нагоре)
        let currentDown = nom;
        for (let i = 29; i >= 0; i--) {
            currentDown /= ratio;
            if (currentDown < MIN) break;
            col[i] = Number(currentDown.toFixed(2));
        }

        // Изчисляване на Мажори (надолу)
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

    const nom = parseFloat(inputField.value);
    
    // Взимаме актуалните преводи от глобалния обект (зареден от lang.js)
    const lang = window.currentLangData || {};
    const txtNo = lang["th-no"] || "№";
    const txtP = lang["row-p"] || "P"; 
    const txtN = lang["row-n"] || "N";

    // Първо извличаме преведените имена от селектора в HTML за всяка система
    let displayNames = AestheticSolver.ratios.map(r => {
        const optEl = document.getElementById(`opt-${r.id_key}`);
        return optEl ? optEl.innerText : r.name;
    });

    // Изграждане на заглавната част (thead)
    let html = `<thead><tr><th style="border: 1px solid #ccc; padding: 5px;">${txtNo}</th>`;
    displayNames.forEach((name, idx) => {
        html += `<th onclick="runHarmonyAnalysis(${idx})" style="cursor:pointer; background:#f0f0f0; border:1px solid #ccc; padding: 10px;">${name}</th>`;
    });
    html += '</tr></thead><tbody>';

    // Генериране на матрицата (6 колони по 62 реда)
    currentMatrix = AestheticSolver.ratios.map((r, idx) => 
        AestheticSolver.generateColumn(nom, r.val, displayNames[idx])
    );

    // Изграждане на тялото на таблицата (tbody)
    for (let i = 0; i < 62; i++) {
        // Оцветяване на редовете за Пропорция (P) и Номинал (N)
        let rowStyle = (i === 30 || i === 31) ? 'style="background-color: #D3D3D3; font-weight: bold;"' : '';
        
        // Определяне на етикета в първата колона
        let rowLabel = "";
        if (i < 30) rowLabel = `m${30 - i}`;      
        else if (i === 30) rowLabel = txtP;  
        else if (i === 31) rowLabel = txtN;  
        else rowLabel = `M${i - 31}`;             
        
        html += `<tr ${rowStyle}><td style="border: 1px solid #eee; padding: 3px; font-weight: bold;">${rowLabel}</td>`;
        
        for (let j = 0; j < currentMatrix.length; j++) {
            let val = currentMatrix[j][i] || "";
            // ID-то на клетката е важно за оцветяването при анализ
            html += `<td id="cell-${j}-${i}" style="border: 1px solid #eee; padding: 3px;">${val}</td>`;
        }
        html += '</tr>';
    }
    
    table.innerHTML = html + '</tbody>';
}

/**
 * Функция за сравнителен анализ спрямо избрана колона (±2%)
 */
function runHarmonyAnalysis(refColIdx) {
    // Изчистване на предишни оцветявания (без да пипаме сивите редове)
    const allCells = document.querySelectorAll('#propsTable td');
    allCells.forEach(c => {
        if (c.id) {
            const rowIdx = parseInt(c.id.split('-')[2]);
            if (rowIdx !== 30 && rowIdx !== 31) {
                c.style.backgroundColor = "";
            }
        }
    });

    // Вземаме само числовите стойности от референтната колона
    const referenceValues = currentMatrix[refColIdx].filter(v => typeof v === 'number');

    for (let col = 0; col < currentMatrix.length; col++) {
        if (col === refColIdx) continue; // Пропускаме избраната колона

        for (let row = 0; row < 62; row++) {
            let targetVal = currentMatrix[col][row];
            if (typeof targetVal !== 'number') continue;

            // Сравняваме с всяка стойност от референтната колона
            const hasMatch = referenceValues.some(refVal => AestheticSolver.isHarmonic(targetVal, refVal));

            if (hasMatch && row !== 30 && row !== 31) {
                const cell = document.getElementById(`cell-${col}-${row}`);
                if (cell) cell.style.backgroundColor = "#90EE90"; // Светлозелено съвпадение
            }
        }
    }
}

/**
 * Управление на графичната работна площ (Canvas)
 */
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

/**
 * Инициализация при зареждане на страницата
 */
window.addEventListener('load', () => {
    CanvasManager.init();
    // Тук НЕ викаме calculate директно, 
    // защото lang.js ще го извика след като зареди JSON файла.
});