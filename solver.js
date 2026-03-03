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
