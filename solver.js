const AestheticSolver = {
    // 1. Дефиниране на шестте системи
    ratios: [
        { name: "II РПЧ", val: 1.059 },
        { name: "III РПЧ", val: 1.122 },
        { name: "IV РПЧ", val: 1.259 },
        { name: "РЗС", val: 1.272 },
        { name: "РЗВ", val: 1.309 },
        { name: "ЗС", val: 1.618 }
    ],

    // 2. Генератор на колона (Минори и Мажори)
    generateColumn: (nom, ratio, name) => {
        let col = new Array(62).fill(null);
        const MIN = 10;
        const MAX = 1000;

        // Ред 31 (Индекс 30): Текст с името на системата
        col[30] = `${name} ${ratio}`;
        // Ред 32 (Индекс 31): Стойност на Номинала
        col[31] = nom;

        // Изчисляване на Минори
        let currentDown = nom;
        for (let i = 29; i >= 0; i--) {
            currentDown /= ratio;
            if (currentDown < MIN) break;
            col[i] = Number(currentDown.toFixed(2));
        }

        // Изчисляване на Мажори
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

let currentMatrix = []; // Тук съхраняваме данните за анализа

function calculate() {
    const inputField = document.getElementById('baseNum');
    const table = document.getElementById('propsTable');
    if (!inputField || !table) return;

    const nom = parseFloat(inputField.value);
    
    let html = '<thead><tr><th style="border: 1px solid #ccc; padding: 5px;">№</th>';
    AestheticSolver.ratios.forEach((r, idx) => {
        html += `<th onclick="runHarmonyAnalysis(${idx})" style="border: 1px solid #ccc; padding: 5px; cursor: pointer; background: #f0f0f0;" title="Кликни за сравнителен анализ">${r.name}<br>(${r.val})</th>`;
    });
    html += '</tr></thead><tbody>';

    // Генерираме данните (подаваме и r.name)
    currentMatrix = AestheticSolver.ratios.map(r => AestheticSolver.generateColumn(nom, r.val, r.name));

    for (let i = 0; i < 62; i++) {
        let rowStyle = (i === 30 || i === 31) ? 'style="background-color: #D3D3D3; font-weight: bold;"' : '';
        
        let rowLabel = "";
        if (i < 30) rowLabel = `m${30 - i}`;      
        else if (i === 30) rowLabel = "P";        
        else if (i === 31) rowLabel = "N";        
        else rowLabel = `M${i - 31}`;             
        
        html += `<tr ${rowStyle}><td style="border: 1px solid #eee; padding: 3px; font-weight: bold;">${rowLabel}</td>`;
        
        for (let j = 0; j < currentMatrix.length; j++) {
            let val = currentMatrix[j][i] || "";
            // Слагаме ID на всяка клетка, за да можем да я оцветяваме
            html += `<td id="cell-${j}-${i}" style="border: 1px solid #eee; padding: 3px;">${val}</td>`;
        }
        html += '</tr>';
    }
    
    table.innerHTML = html + '</tbody>';
}

// Функцията за Хармоничен анализ (±2%)
function runHarmonyAnalysis(refColIdx) {
    // Изчистваме старото оцветяване
    const allCells = document.querySelectorAll('#propsTable td');
    allCells.forEach(c => {
        // Проверяваме дали редът не е от сивите (30 или 31), за да не им махаме цвета
        const rowIdx = parseInt(c.id.split('-')[2]);
        if (rowIdx !== 30 && rowIdx !== 31) {
            c.style.backgroundColor = "";
        }
    });

    const referenceValues = currentMatrix[refColIdx].filter(v => typeof v === 'number');

    for (let col = 0; col < currentMatrix.length; col++) {
        if (col === refColIdx) continue;

        for (let row = 0; row < 62; row++) {
            let targetVal = currentMatrix[col][row];
            if (typeof targetVal !== 'number') continue;

            const hasMatch = referenceValues.some(refVal => AestheticSolver.isHarmonic(targetVal, refVal));

            if (hasMatch && row !== 30 && row !== 31) {
                const cell = document.getElementById(`cell-${col}-${row}`);
                if (cell) cell.style.backgroundColor = "#90EE90"; // Светлозелено
            }
        }
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
