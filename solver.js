// solver.js
const AestheticSolver = {
    // Еквивалент на koren_n(p, q, n1)
    calcKorenN: (p, q, n1) => Math.exp((p / q) * Math.log(n1)),

    // Логика за генериране на пропорционален ред
    generateSeries: (baseNum, ratio, direction = 'both') => {
        let results = [baseNum];
        let up = baseNum, down = baseNum;
        
        for(let i=0; i<10; i++) { // Генерираме 10 стъпки
            up *= ratio;
            down /= ratio;
            results.push(Number(up.toFixed(3)));
            results.push(Number(down.toFixed(3)));
        }
        return results.sort((a, b) => a - b);
    }
};
const AestheticSolver = {
    // Твоите основни коефициенти
    ratios: {
        golden: 1.6180339, // Златно сечение
        sqrt2: 1.4142135,  // Корен от 2
        sqrt3: 1.7320508,  // Корен от 3
        music: 1.0594631   // Корен 12-ти от 2 (музикален полутон)
    },

    // Генерира прогресия нагоре и надолу от Nom
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

function calculate() {
    const nom = parseFloat(document.getElementById('nom').value);
    const tableBody = document.querySelector('#propsTable tbody');
    tableBody.innerHTML = ''; // Изчистваме старата таблица

    // Използваме Златното сечение като основен пример (можем да добавим и другите)
    const results = AestheticSolver.generateSeries(nom, AestheticSolver.ratios.golden);

    results.forEach(item => {
        const row = `<tr>
            <td>${item.label} (Φ)</td>
            <td><strong>${item.value}</strong></td>
        </tr>`;
        tableBody.innerHTML += row;
    });

    console.log("Анализът приключи за Nom:", nom);
}
