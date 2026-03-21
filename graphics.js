/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 * 6-етапно векторизиране с послойна скелетизация (БЕЗ проверка за припокриване)
 */

const GraphicsManager = {
    canvas: null,
    ctx: null,
    bgImage: new Image(),
    imgOpacity: 0.5,
    
    currentStage: 0,
    stageData: null, 
    
    points: [], 
    lines: [],  

    init: function() {
        this.canvas = document.getElementById('mainCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.attachListeners();
    },

    resize: function() {
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
    },

    nextStage: function() {
        if (!this.bgImage.src) return;
        
        this.currentStage = (this.currentStage + 1) % 6;
        console.log("Текущ етап:", this.currentStage);

        switch(this.currentStage) {
            case 0: this.render(); break;
            case 1: this.applyGrayscale(); break;
            case 2: this.applyQuantize10(); break;
            case 3: this.applyNoiseReduction(); break;
            case 4: this.applyLayeredThinning(); break;
            case 5: this.runTracing(); break;
        }
    },

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

    applyQuantize10: function() {
        if (!this.stageData) this.applyGrayscale();
        const data = this.stageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const v = data[i];
            const p = (255 - v) / 255; 
            
            let val;
            if (p <= 0.10) {
                val = 255; // Бяло
            } else if (p >= 0.90) {
                val = 0;   // Черно
            } else {
                const bin = Math.floor(p * 10); 
                const midP = bin * 0.10 + 0.05; 
                val = Math.round(255 * (1 - midP));
            }
            data[i] = data[i+1] = data[i+2] = val;
        }
        this.renderStage();
    },

    applyNoiseReduction: function() {
        if (!this.stageData) this.applyQuantize10();
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.stageData.data;
        const result = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let vals = [];
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        vals.push(data[((y + dy) * width + (x + dx)) * 4]);
                    }
                }
                vals.sort((a, b) => a - b);
                let median = vals[4];
                
                const idx = (y * width + x) * 4;
                result[idx] = result[idx+1] = result[idx+2] = median;
            }
        }
        this.stageData.data.set(result);
        this.renderStage();
    },

    // 4. Послойна скелетизация (Директно наслагване)
    applyLayeredThinning: function() {
        if (!this.stageData) this.applyNoiseReduction();
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.stageData.data;
        
        let uniqueVals = new Set();
        for(let i = 0; i < data.length; i += 4) {
            if (data[i] < 255) uniqueVals.add(data[i]);
        }
        let layers = Array.from(uniqueVals).sort((a, b) => b - a);

        const masterSkeleton = new Uint8Array(width * height);

        for (let val of layers) {
            const binary = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (data[(y * width + x) * 4] === val) binary[y * width + x] = 1;
                }
            }

            const thinned = new Uint8Array(width * height);
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = y * width + x;
                    if (binary[idx] === 1) {
                        let neighbors = 0;
                        if (binary[(y - 1) * width + x] === 1) neighbors++;
                        if (binary[(y + 1) * width + x] === 1) neighbors++;
                        if (binary[y * width + x - 1] === 1) neighbors++;
                        if (binary[y * width + x + 1] === 1) neighbors++;
                        
                        if (neighbors <= 3) thinned[idx] = 1;
                    }
                }
            }

            // Обединяване директно в мастър скелета
            for (let i = 0; i < thinned.length; i++) {
                if (thinned[i] === 1) {
                    masterSkeleton[i] = 1;
                }
            }
        }

        const result = new Uint8ClampedArray(data.length);
        for (let i =