// solver.js
const AestheticSolver = {
    // 1. Коригирани специфични коефициенти по твоите изисквания
    ratios: {
        rpch2: 1.059,  // II Ред от Предпочитани Числа
        rpch3: 1.122,  // III Ред от Предпочитани Числа
        rpch4: 1.259,  // IV Ред от Предпочитани Числа
        rzs:   1.272,  // Равнинно Златно Сечение
        rzv:   1.309,  // Равнинен Златен Вурф
        zs:    1.618   // Златно сечение
    },

    // 2. Еквивалент на твоята Delphi функция koren_n(p, q, n1)
    calcKorenN: (p, q, n1) => Math.exp((p / q) * Math.log(n1)),

    // 3. Логика за генериране на пропорционален ред
    generateSeries: (nom, ratio) => {
        let series = [];
        // Нагоре (7 стъпки)
        let val = nom;
        for (let i = 0; i < 7; i++) {
            series.push({ label: `↑ ${i}`, value: val.toFixed(2) });
            val *= ratio;
        }
        // Надолу (7 стъпки)
        val = nom / ratio;
        for (let i = 1; i < 8; i++) {
            series.unshift({ label: `↓ ${i}`, value: val.toFixed(2) });
            val /= ratio;
        }
        return series;
    }
};

// Функция за бутона "Анализ"
function calculate() {
    const inputField = document.getElementById('baseNum');
    if (!inputField) return;
    
    const nom = parseFloat(inputField.value);
    const tableBody = document.querySelector('#propsTable tbody');
    if (!tableBody) return;
    
    tableBody.innerHTML = ''; // Изчистваме старата таблица

    // Тук правим анализ по Златното сечение (ЗС) като пример
    // Можем по-късно да добавим падащо меню за избор на конкретен коефициент
    const results = AestheticSolver.generateSeries(nom, AestheticSolver.ratios.zs);

    results.forEach(item => {
        const row = `<tr>
            <td>${item.label} (ЗС 1.618)</td>
            <td><strong>${item.value}</strong></td>
        </tr>`;
        tableBody.innerHTML += row;
    });

    console.log("Анализът приключи за Nom:", nom);
}

// 4. Графично управление (Canvas)
const CanvasManager = {
    ctx: null,
    canvas: null,

    init: () => {
        CanvasManager.canvas = document.getElementById('mainCanvas');
        if (!CanvasManager.canvas) {
            console.error("Canvas елементът не е намерен!");
            return;
        }
        CanvasManager.ctx = CanvasManager.canvas.getContext('2d');
        // Задаваме размер на платното
        CanvasManager.canvas.width = 600;
        CanvasManager.canvas.height = 400;
        CanvasManager.drawBackground();
    },

    drawBackground: () => {
        const ctx = CanvasManager.ctx;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 600, 400);
        
        // Помощна мрежа
        ctx.strokeStyle = "#f0f0f0";
        for(let i=0; i<600; i+=50) {
            ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,400); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(600,i); ctx.stroke();
        }
    }
};

// Стартиране при зареждане
window.addEventListener('load', () => {
    CanvasManager.init();
});
