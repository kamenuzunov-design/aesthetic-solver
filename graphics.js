/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 * Интерактивно етапно векторизиране
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
        this.resize();
        this.attachListeners();
    },

    resize: function() {
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
    },

    // --- ЕТАПИ НА ОБРАБОТКА ---

    nextStage: function() {
        if (!this.bgImage.src) return;
        
        this.currentStage = (this.currentStage + 1) % 5;
        console.log("Текущ етап:", this.currentStage);

        switch(this.currentStage) {
            case 0:
                this.render();
                break;
            case 1:
                this.applyGrayscale();
                break;
            case 2:
                this.applyBinary(200); 
                break;
            case 3:
                this.applyThinning();
                break;
            case 4:
                this.runTracing();
                break;
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

    applyBinary: function(threshold) {
        if (!this.stageData) this.applyGrayscale();
        const data = this.stageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const val = data[i] < threshold ? 0 : 255;
            data[i] = data[i+1] = data[i+2] = val;
        }
        this.renderStage();
    },

    applyThinning: function() {
        if (!this.stageData) this.applyBinary(200);
        const width = this.canvas.width;
        const height = this.canvas.height;
        const data = this.stageData.data;
        
        const result = new Uint8ClampedArray(data);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                if (data[idx] === 0) { 
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

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                
                if (data[idx * 4] === 0 && !visited[idx]) {
                    const path = this.tracePath(x, y, data, visited, width, height, searchRadius);
                    
                    if (path.length > 3) {
                        const simplified = this.douglasPeucker(path, simplifyTol);
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
                                cx = nx;
                                cy = ny;
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

        let dmax = 0;
        let index = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const d = this.distToSegment(points[i], points[0], points[end]);
            if (d > dmax) {
                index = i;
                dmax = d;
            }
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
        
        if (this.bgImage.src) {
            this.ctx.save();
            this.ctx.globalAlpha = parseFloat(this.imgOpacity);
            this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }

        if (this.currentStage === 4) {
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
                        this.canvas.width = this.bgImage.naturalWidth;
                        this.canvas.height = this.bgImage.naturalHeight;
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

/** ГЛОБАЛНИ ФУНКЦИИ **/
function setTool(tool) { 
    GraphicsManager.currentTool = tool; 
}

function exportSVG() { 
    alert("SVG Export е в процес на разработка."); 
}

function applyRelation(type) {
    console.log("Прилагане на връзка:", type);
}

window.addEventListener('load', () => GraphicsManager.init());