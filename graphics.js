/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 * 6-етапно векторизиране с послойна скелетизация и 3px отстояние
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
        
        // Общо 6 етапа (0 до 5)
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

    // 1. Стандартно сиво
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

    // 2. Сиво през 10% (0-10% Бяло, 90-100% Черно)
    applyQuantize10: function() {
        if (!this.stageData) this.applyGrayscale();
        const data = this.stageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const v = data[i];
            const p = (255 - v) / 255; // Процент сиво (0.0 = бяло, 1.0 = черно)
            
            let val;
            if (p <= 0.10) {
                val = 255; // Бяло
            } else if (p >= 0.90) {
                val = 0;   // Черно
            } else {
                // Изчисляване на средната стойност за съответната десетица
                const bin = Math.floor(p * 10); 
                const midP = bin * 0.10 + 0.05; 
                val = Math.round(255 * (1 - midP));
            }
            data[i] = data[i+1] = data[i+2] = val;
        }
        this.renderStage();
    },

    // 3. Медианен филтър за премахване на шум
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
                let median = vals[4]; // Взимаме средния елемент
                
                const idx = (y * width + x) * 4;
                result[idx] = result[idx+1] = result[idx+2] = median;
            }
        }
        this.stageData.data.set(result);
        this.renderStage();
    },

    // 4. Послойна скелетизация с проверка за припокриване (3px)
    applyLayeredThinning: function() {
        if (!this.stageData) this.applyNoiseReduction();
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.stageData.data;
        
        // Намиране на всички уникални нюанси (без бялото)
        let uniqueVals = new Set();
        for(let i = 0; i < data.length; i += 4) {
            if (data[i] < 255) uniqueVals.add(data[i]);
        }
        // Сортиране от най-светло (най-висока RGB стойност) към най-тъмно (0)
        let layers = Array.from(uniqueVals).sort((a, b) => b - a);

        // Мастър масив за крайния скелет (0 = бяло пространство, 1 = черна линия)
        const masterSkeleton = new Uint8Array(width * height);

        for (let val of layers) {
            // Създаване на маска за текущия слой
            const binary = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (data[(y * width + x) * 4] === val) binary[y * width + x] = 1;
                }
            }

            // Изтъняване (запазваме само контура, където няма 4 съседа)
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
                        
                        // Ако пикселът е на границата, го запазваме в този слой
                        if (neighbors <= 3) thinned[idx] = 1;
                    }
                }
            }

            // Обединяване с мастър масива (Проверка за 3px радиус)
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    if (thinned[y * width + x] === 1) {
                        let overlap = false;
                        // Проверка в радиус 3 пиксела (Евклидово разстояние <= 3)
                        for (let dy = -3; dy <= 3; dy++) {
                            for (let dx = -3; dx <= 3; dx++) {
                                if (dx*dx + dy*dy <= 9) {
                                    const ny = y + dy;
                                    const nx = x + dx;
                                    if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                                        if (masterSkeleton[ny * width + nx] === 1) {
                                            overlap = true;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (overlap) break;
                        }
                        // Ако няма друга линия наблизо, добавяме тази
                        if (!overlap) {
                            masterSkeleton[y * width + x] = 1;
                        }
                    }
                }
            }
        }

        // Записване на мастър скелета обратно в stageData
        const result = new Uint8ClampedArray(data.length);
        for (let i = 0; i < masterSkeleton.length; i++) {
            const color = masterSkeleton[i] === 1 ? 0 : 255; // 1 става Черно (0), 0 става Бяло (255)
            result[i * 4] = result[i * 4 + 1] = result[i * 4 + 2] = color;
            result[i * 4 + 3] = 255;
        }
        this.stageData.data.set(result);
        this.renderStage();
    },

    // 5. Векторизиране
    runTracing: function() {
        this.executeTracingAlgorithm(); 
        this.render(); 
    },

    executeTracingAlgorithm: function() {
        if (!this.stageData) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.stageData.data;
        const visited = new Uint8Array(width * height);
        
        this.lines = [];
        const searchRadius = 3;  
        const simplifyTol = 1.5; 
        const angleTol = 5 * (Math.PI / 180); 
        const spikeTol = 45 * (Math.PI / 180); 
        const orthoTol = 5; 

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                // В Етап 4 черните линии имат RGB = 0
                if (data[idx * 4] === 0 && !visited[idx]) {
                    const path = this.tracePath(x, y, data, visited, width, height, searchRadius);
                    
                    if (path.length > 3) {
                        let simplified = this.douglasPeucker(path, simplifyTol);
                        simplified = this.removeSpikes(simplified, 5, spikeTol);
                        simplified = this.optimizePolyline(simplified, angleTol);
                        simplified = this.orthogonalizePolyline(simplified, orthoTol);
                        
                        this.addAsVectorLines(simplified);
                    }
                }
            }
        }
        this.rebuildPoints();
    },

    tracePath: function(startX, startY, data, visited, width, height, searchRadius) {
        const path = [];
        let cx = startX;
        let cy = startY;

        while (true) {
            path.push({ x: cx, y: cy });
            visited[cy * width + cx] = 1;

            let foundNext = false;
            for (let r = 1; r <= searchRadius; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        
                        const nx = cx + dx;
                        const ny = cy + dy;
                        
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = ny * width + nx;
                            if (data[nIdx * 4] === 0 && !visited[nIdx]) {
                                cx = nx; cy = ny;
                                foundNext = true;
                                break;
                            }
                        }
                    }
                    if (foundNext) break;
                }
                if (foundNext) break;
            }
            if (!foundNext) break;
        }
        return path;
    },

    douglasPeucker: function(points, tolerance) {
        if (points.length <= 2) return points;
        let dmax = 0, index = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const d = this.distToSegment(points[i], points[0], points[end]);
            if (d > dmax) { index = i; dmax = d; }
        }

        if (dmax > tolerance) {
            const res1 = this.douglasPeucker(points.slice(0, index + 1), tolerance);
            const res2 = this.douglasPeucker(points.slice(index), tolerance);
            return res1.slice(0, res1.length - 1).concat(res2);
        } else {
            return [points[0], points[end]];
        }
    },

    distToSegment: function(p, a, b) {
        const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
        if (l2 === 0) return Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt(Math.pow(p.x - (a.x + t * (b.x - a.x)), 2) + Math.pow(p.y - (a.y + t * (b.y - a.y)), 2));
    },

    removeSpikes: function(points, maxDist, minAngle) {
        if (points.length <= 2) return points;
        const result = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = result[result.length - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            const dist1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
            const dist2 = Math.hypot(next.x - curr.x, next.y - curr.y);
            const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
            
            let diff = Math.abs(angle1 - angle2);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            
            if ((dist1 <= maxDist || dist2 <= maxDist) && diff > minAngle) continue; 
            result.push(curr);
        }
        result.push(points[points.length - 1]);
        return result;
    },

    optimizePolyline: function(points, angleTolerance) {
        if (points.length <= 2) return points;
        const optimized = [points[0]];
        for (let i = 1; i < points.length - 1; i++) {
            const prev = optimized[optimized.length - 1];
            const curr = points[i];
            const next = points[i + 1];
            
            const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
            
            let diff = Math.abs(angle1 - angle2);
            if (diff > Math.PI) diff = 2 * Math.PI - diff; 
            
            if (diff > angleTolerance) optimized.push(curr);
        }
        optimized.push(points[points.length - 1]);
        return optimized;
    },

    orthogonalizePolyline: function(points, tolerance) {
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            if (Math.abs(p1.y - p2.y) <= tolerance) {
                const avgY = (p1.y + p2.y) / 2;
                p1.y = p2.y = avgY;
            } else if (Math.abs(p1.x - p2.x) <= tolerance) {
                const avgX = (p1.x + p2.x) / 2;
                p1.x = p2.x = avgX;
            }
        }
        return points;
    },

    addAsVectorLines: function(points) {
        for (let i = 0; i < points.length - 1; i++) {
            this.lines.push({
                p1: { x: points[i].x, y: points[i].y },
                p2: { x: points[i + 1].x, y: points[i + 1].y },
                id: Math.random()
            });
        }
    },

    rebuildPoints: function() {
        this.points = [];
        const seen = new Set();
        this.lines.forEach(l => {
            [l.p1, l.p2].forEach(p => {
                const key = `${p.x},${p.y}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    this.points.push({ ...p, id: Math.random() });
                }
            });
        });
    },

    // 1px бяло поле (Padding)
    getCleanImageData: function() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = "#ffffff";
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.drawImage(this.bgImage, 1, 1, this.bgImage.naturalWidth, this.bgImage.naturalHeight);
        
        return tempCtx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    },

    renderStage: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.putImageData(this.stageData, 0, 0);
    },

    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.bgImage.src) {
            this.ctx.save();
            this.ctx.globalAlpha = parseFloat(this.imgOpacity);
            this.ctx.drawImage(this.bgImage, 1, 1, this.bgImage.naturalWidth, this.bgImage.naturalHeight);
            this.ctx.restore();
        }

        if (this.currentStage === 5) {
            this.ctx.strokeStyle = "#2d3d4c";
            this.ctx.lineWidth = 1;
            this.lines.forEach(l => {
                this.ctx.beginPath();
                this.ctx.moveTo(l.p1.x, l.p1.y);
                this.ctx.lineTo(l.p2.x, l.p2.y);
                this.ctx.stroke();
            });

            this.ctx.fillStyle = "#ff4444";
            this.points.forEach(p => {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    },

    attachListeners: function() {
        this.canvas.addEventListener('click', () => this.nextStage());

        const upload = document.getElementById('imgUpload');
        if (upload) {
            upload.addEventListener('change', (e) => {
                const reader = new FileReader();
                reader.onload = (f) => {
                    this.bgImage.onload = () => {
                        this.canvas.width = this.bgImage.naturalWidth + 2;
                        this.canvas.height = this.bgImage.naturalHeight + 2;
                        this.currentStage = 0;
                        this.render();
                    };
                    this.bgImage.src = f.target.result;
                };
                if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
            });
        }

        const opacityRange = document.getElementById('imgOpacity');
        if (opacityRange) {
            opacityRange.addEventListener('input', (e) => {
                this.imgOpacity = e.target.value;
                this.render();
            });
        }
    }
};

window.addEventListener('load', () => GraphicsManager.init());