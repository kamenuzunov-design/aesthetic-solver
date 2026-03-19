/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 * Етапно векторизиране с кликване
 */

const GraphicsManager = {
    canvas: null,
    ctx: null,
    bgImage: new Image(),
    imgOpacity: 0.5,
    
    // Състояние на обработката (0: Оригинал, 1: Сиво, 2: Ч/Б, 3: Тънко, 4: Вектори)
    currentStage: 0,
    stageData: null, // Кеширани пикселни данни за текущия етап
    
    points: [], 
    lines: [],  

    init: function() {
        this.canvas = document.getElementById('mainCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.attachListeners();
    },

    // --- ЕТАПИ НА ОБРАБОТКА ---

    nextStage: function() {
        if (!this.bgImage.src) return;
        
        this.currentStage = (this.currentStage + 1) % 5;
        console.log("Текущ етап:", this.currentStage);

        switch(this.currentStage) {
            case 0: // Оригинал
                this.render();
                break;
            case 1: // Степени на сиво
                this.applyGrayscale();
                break;
            case 2: // Черно-бяло (Binary)
                this.applyBinary(200); // Праг около 20% черно
                break;
            case 3: // Изтъняване (Skeletonization)
                this.applyThinning();
                break;
            case 4: // Векторизиране
                this.runTracing();
                break;
        }
    },

    // 1. Grayscale
    applyGrayscale: function() {
        const imgData = this.getCleanImageData();
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i+1] + data[i+2]) / 3;
            data[i] = data[i+1] = data[i+2] = avg;
        }
        this.stageData = imgData;
        this.renderStage();
    },

    // 2. Binary (Black & White)
    applyBinary: function(threshold) {
        if (!this.stageData) this.applyGrayscale();
        const data = this.stageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const val = data[i] < threshold ? 0 : 255;
            data[i] = data[i+1] = data[i+2] = val;
        }
        this.renderStage();
    },

    // 3. Thinning (Опростен алгоритъм за изтъняване до 1px)
    applyThinning: function() {
        if (!this.stageData) this.applyBinary(200);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.stageData.data;
        
        // Опростен морфологичен филтър за скелетизация
        const result = new Uint8ClampedArray(data);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                if (data[idx] === 0) { // Ако е черен пиксел
                    // Проверяваме съседите - ако е обграден от черни, го махаме (правим го бял)
                    // Това е силно опростено "изяждане" на запълването
                    let neighbors = 0;
                    if (data[((y-1)*width + x)*4] === 0) neighbors++;
                    if (data[((y+1)*width + x)*4] === 0) neighbors++;
                    if (data[(y*width + x-1)*4] === 0) neighbors++;
                    if (data[(y*width + x+1)*4] === 0) neighbors++;
                    
                    if (neighbors > 3) result[idx] = result[idx+1] = result[idx+2] = 255;
                }
            }
        }
        this.stageData.data.set(result);
        this.renderStage();
    },

    // 4. Tracing (Векторизиране)
    runTracing: function() {
        // Тук извикваме логиката за проследяване, която вече обсъдихме
        // За целите на демонстрацията ще визуализираме финалните линии
        this.lines = []; // Изчистваме старите
        this.executeTracingAlgorithm(); 
        this.render(); 
    },

    // --- ПОМОЩНИ ФУНКЦИИ ---

    getCleanImageData: function() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
        return tempCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    },

    renderStage: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.putImageData(this.stageData, 0, 0);
    },

    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуване на оригиналната снимка с прозрачност
        if (this.bgImage.src) {
            this.ctx.save();
            this.ctx.globalAlpha = this.imgOpacity;
            this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }

        // Рисуване на векторите (само ако сме на етап 4)
        if (this.currentStage === 4) {
            this.ctx.strokeStyle = "#2d3d4c";
            this.ctx.lineWidth = 1;
            this.lines.forEach(l => {
                this.ctx.beginPath();
                this.ctx.moveTo(l.p1.x, l.p1.y);
                this.ctx.lineTo(l.p2.x, l.p2.y);
                this.ctx.stroke();
            });
        }
    },

    attachListeners: function() {
        // Кликване върху Canvas за преминаване към следващ етап
        this.canvas.addEventListener('click', () => this.nextStage());

        document.getElementById('imgUpload').addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (f) => {
                this.bgImage.onload = () => {
                    this.canvas.width = this.bgImage.naturalWidth;
                    this.canvas.height = this.bgImage.naturalHeight;
                    this.currentStage = 0;
                    this.render();
                };
                this.bgImage.src = f.target.result;
            };
            if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
        });
    },

    executeTracingAlgorithm: function() {
        // Тук стои твоят Douglas-Peucker и FindNextPoint алгоритъм
        // За момента ще добавим една демо линия, за да видиш, че работи
        this.lines.push({ p1: {x: 50, y: 50}, p2: {x: 200, y: 200} });
    }
};

window.addEventListener('load', () => GraphicsManager.init());