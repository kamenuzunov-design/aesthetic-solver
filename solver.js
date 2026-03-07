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
    generateColumn: (nom, ratio) => {
        let col = new Array(62).fill(null);
        const MIN = 10;
        const MAX = 1000;

        // Ред 31 (Индекс 30): Текст "Пропорция"
        col[30] = `${name} ${ratio}`;
        // Ред 32 (Индекс 31): Стойност на Номинала
        col[31] = nom;

        // Изчисляване на Минори (нагоре в таблицата, индекси 29 до 0)
        let currentDown = nom;
        for (let i = 29; i >= 0; i--) {
            currentDown /= ratio;
            if (currentDown < MIN) break;
            col[i] = Number(currentDown.toFixed(2));
        }

        // Изчисляване на Мажори (надолу в таблицата, индекси 32 до 61)
        let currentUp = nom;
        for (let i = 32; i < 62; i++) {
            currentUp *= ratio;
            if (currentUp > MAX) break;
            col[i] = Number(currentUp.toFixed(2));
        }
        return col;
    }
};

function calculate() {
    const inputField = document.getElementById('baseNum');
    const table = document.getElementById('propsTable');
    if (!inputField || !table) return;

    const nom = parseFloat(inputField.value);
    
    // Генерираме заглавията (7 колони: № + 6-те системи)
    let html = '<thead><tr><th style="border: 1px solid #ccc; padding: 5px;">№</th>';
    AestheticSolver.ratios.forEach(r => {
        html += `<th style="border: 1px solid #ccc; padding: 5px; cursor: pointer;" title="Кликни за сравнителен анализ">${r.name}<br>(${r.val})</th>`;
    });
    html += '</tr></thead><tbody>';

    // Генерираме данните за всяка система
    let matrix = AestheticSolver.ratios.map(r => AestheticSolver.generateColumn(nom, r.val));

    // Изграждаме 62-та реда
    for (let i = 0; i < 62; i++) {
        // Оцветяване на ред 31 и 32 в 20% сиво (#D3D3D3)
        let rowStyle = (i === 30 || i === 31) ? 'style="background-color: #D3D3D3; font-weight: bold;"' : '';
        
        // Етикетиране на №
        let rowLabel = "";
        if (i < 30) rowLabel = `m${30 - i}`;      // Минори
        else if (i === 30) rowLabel = "P";        // Пропорция
        else if (i === 31) rowLabel = "N";        // Номинал
        else rowLabel = `M${i - 31}`;             // Мажори
        
        html += `<tr ${rowStyle}><td style="border: 1px solid #eee; padding: 3px; font-weight: bold;">${rowLabel}</td>`;
        
        for (let j = 0; j < matrix.length; j++) {
            let val = matrix[j][i] || "";
            html += `<td style="border: 1px solid #eee; padding: 3px;">${val}</td>`;
        }
        html += '</tr>';
    }
    
    table.innerHTML = html + '</tbody>';
}

// Запазваме CanvasManager за бъдещото рисуване
const CanvasManager = {
    init: () => {
        const canvas = document.getElementById('mainCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 400;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 600, 400);
        ctx.strokeStyle = "#f0f0f0";
        for(let i=0; i<600; i+=50) {
            ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,400); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(600,i); ctx.stroke();
        }
    }
};

// Стартиране при зареждане на страницата
window.addEventListener('load', () => {
    // 1. Инициализираме Canvas-а (въпреки че е скрит, добре е да е готов)
    CanvasManager.init();
    
    // 2. Стартираме автоматично изчисление с номинала по подразбиране (200)
    calculate();
});
