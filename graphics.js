/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 */

const GraphicsManager = {
    canvas: null,
    ctx: null,
    gridCanvas: null,
    gridCtx: null,
    bgImage: new Image(),
    imgOpacity: 0.5,
    gridSize: 20,
    
    points: [], 
    lines: [],  
    
    currentTool: null,
    isDrawing: false,
    draggedPoint: null,
    startPoint: null,
    tempEndPoint: null,

    // Параметри за векторизиране
    threshold: 128,
    minSegmentLength: 3,

    init: function() {
        this.canvas = document.getElementById('mainCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.gridCanvas = document.getElementById('gridCanvas');
        this.gridCtx = this.gridCanvas.getContext('2d');
        
        this.resize();
        this.drawGrid();
        this.attachListeners();
        this.render();
    },

    resize: function() {
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;
        this.canvas.width = this.gridCanvas.width = wrapper.clientWidth;
        this.canvas.height = this.gridCanvas.height = wrapper.clientHeight;
    },

    resizeToImage: function() {
        if (!this.bgImage.src) return;
        const wrapper = document.getElementById('canvas-wrapper');
        const ratio = Math.min(wrapper.clientWidth / this.bgImage.naturalWidth, wrapper.clientHeight / this.bgImage.naturalHeight);
        this.canvas.width = this.gridCanvas.width = this.bgImage.naturalWidth * ratio;
        this.canvas.height = this.gridCanvas.height = this.bgImage.naturalHeight * ratio;
        this.drawGrid();
    },

    drawGrid: function() {
        if (!this.gridCtx) return;
        this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        this.gridCtx.strokeStyle = "#e0e0e0";
        this.gridCtx.lineWidth = 0.5;
        this.gridCtx.beginPath();
        for (let x = 0; x <= this.gridCanvas.width; x += this.gridSize) {
            this.gridCtx.moveTo(x, 0); this.gridCtx.lineTo(x, this.gridCanvas.height);
        }
        for (let y = 0; y <= this.gridCanvas.height; y += this.gridSize) {
            this.gridCtx.moveTo(0, y); this.gridCtx.lineTo(this.gridCanvas.width, y);
        }
        this.gridCtx.stroke();
    },

    snap: function(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    },

    // --- АЛГОРИТЪМ ЗА ВЕКТОРИЗИРАНЕ ---

    runAutoVectorization: function() {
        if (!this.bgImage.src) return;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCtx.drawImage(this.bgImage, 0, 0, tempCanvas.width, tempCanvas.height);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const binaryData = this.preprocessImage(imageData);
        
        this.lines = this.traceImage(binaryData, tempCanvas.width, tempCanvas.height);
        this.rebuildPoints();
        this.render();
    },

    // 1. Превръщане в черно-бяло (Binary Threshold)
    preprocessImage: function(imageData) {
        const data = imageData.data;
        const binary = new Uint8Array(data.length / 4);
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i+1] + data[i+2]) / 3;
            binary[i / 4] = avg < this.threshold ? 1 : 0; // 1 е черна точка (линия)
        }
        return binary;
    },

    // 2. Проследяване на пиксели (Tracing)
    traceImage: function(binary, width, height) {
        const lines = [];
        const visited = new Uint8Array(binary.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                if (binary[idx] === 1 && !visited[idx]) {
                    const polyline = this.findNextPoints(x, y, binary, visited, width, height);
                    if (polyline.length >= this.minSegmentLength) {
                        const simplified = this.simplifyPolyline(polyline, 2.0);
                        this.convertPolyToLines(simplified, lines);
                    }
                }
            }
        }
        return lines;
    },

    findNextPoints: function(startX, startY, binary, visited, width, height) {
        const points = [];
        let currX = startX;
        let currY = startY;

        while (true) {
            points.push({ x: currX, y: currY });
            visited[currY * width + currX] = 1;

            let next = this.getBestNeighbor(currX, currY, binary, visited, width, height);
            if (!next) break;
            currX = next.x;
            currY = next.y;
        }
        return points;
    },

    getBestNeighbor: function(cx, cy, binary, visited, width, height) {
        // Търсене в 8 посоки (радиус 1)
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = cx + dx;
                const ny = cy + dy;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const idx = ny * width + nx;
                    if (binary[idx] === 1 && !visited[idx]) return { x: nx, y: ny };
                }
            }
        }
        return null;
    },

    // 3. Опростяване (Douglas-Peucker / SimplifyInt2D)
    simplifyPolyline: function(points, tolerance) {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let index = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const d = this.perpendicularDistance(points[i], points[0], points[end]);
            if (d > maxDist) {
                index = i;
                maxDist = d;
            }
        }

        if (maxDist > tolerance) {
            const left = this.simplifyPolyline(points.slice(0, index + 1), tolerance);
            const right = this.simplifyPolyline(points.slice(index), tolerance);
            return left.slice(0, left.length - 1).concat(right);
        } else {
            return [points[0], points[end]];
        }
    },

    perpendicularDistance: function(p, a, b) {
        const area = Math.abs(0.5 * (a.x * (b.y - p.y) + b.x * (p.y - a.y) + p.x * (a.y - b.y)));
        const bottom = Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
        return (area / bottom) * 2;
    },

    convertPolyToLines: function(poly, lines) {
        for (let i = 0; i < poly.length - 1; i++) {
            let p1 = { x: this.snap(poly[i].x), y: this.snap(poly[i].y) };
            let p2 = { x: this.snap(poly[i + 1].x), y: this.snap(poly[i + 1].y) };
            
            // Автоматично изправяне (CheckLinePropertis)
            if (Math.abs(p1.x - p2.x) < 5) p2.x = p1.x;
            if (Math.abs(p1.y - p2.y) < 5) p2.y = p1.y;

            lines.push({ p1, p2, id: Math.random() });
        }
    },

    rebuildPoints: function() {
        const unique = new Set();
        this.points = [];
        this.lines.forEach(l => {
            [l.p1, l.p2].forEach(p => {
                const key = `${p.x},${p.y}`;
                if (!unique.has(key)) {
                    unique.add(key);
                    this.points.push({ x: p.x, y: p.y, id: Math.random() });
                }
            });
        });
    },

    // --- СЪБИТИЯ И ВИЗУАЛИЗАЦИЯ ---

    attachListeners: function() {
        this.canvas.addEventListener('mousedown', (e) => this.handleDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMove(e));
        window.addEventListener('mouseup', () => this.handleUp());

        document.getElementById('imgUpload').addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (f) => {
                this.bgImage.onload = () => { 
                    this.resizeToImage();
                    this.runAutoVectorization();
                    this.render(); 
                };
                this.bgImage.src = f.target.result;
            };
            if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
        });

        document.getElementById('imgOpacity').addEventListener('input', (e) => {
            this.imgOpacity = e.target.value;
            this.render();
        });
    },

    handleDown: function(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Хващане с толеранс 5 пиксела
        this.draggedPoint = this.points.find(p => Math.abs(p.x - mouseX) <= 5 && Math.abs(p.y - mouseY) <= 5);

        if (!this.draggedPoint && this.currentTool === 'line') {
            this.isDrawing = true;
            this.startPoint = { x: this.snap(mouseX), y: this.snap(mouseY) };
            this.tempEndPoint = { x: this.snap(mouseX), y: this.snap(mouseY) };
        }
        this.render();
    },

    handleMove: function(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = this.snap(e.clientX - rect.left);
        const y = this.snap(e.clientY - rect.top);

        if (this.draggedPoint) {
            const oldX = this.draggedPoint.x;
            const oldY = this.draggedPoint.y;
            this.draggedPoint.x = x;
            this.draggedPoint.y = y;
            this.lines.forEach(l => {
                if (l.p1.x === oldX && l.p1.y === oldY) { l.p1.x = x; l.p1.y = y; }
                if (l.p2.x === oldX && l.p2.y === oldY) { l.p2.x = x; l.p2.y = y; }
            });
        } else if (this.isDrawing) {
            this.tempEndPoint = { x, y };
        }
        this.render();
    },

    handleUp: function() {
        if (this.isDrawing) {
            if (this.startPoint.x !== this.tempEndPoint.x || this.startPoint.y !== this.tempEndPoint.y) {
                this.lines.push({ p1: {...this.startPoint}, p2: {...this.tempEndPoint}, id: Math.random() });
                this.rebuildPoints();
            }
        }
        this.draggedPoint = null;
        this.isDrawing = false;
        this.render();
    },

    render: function() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.bgImage.src) {
            this.ctx.globalAlpha = this.imgOpacity;
            this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.strokeStyle = "#2d3d4c";
        this.ctx.lineWidth = 1;
        this.lines.forEach(l => {
            this.ctx.beginPath();
            this.ctx.moveTo(l.p1.x, l.p1.y);
            this.ctx.lineTo(l.p2.x, l.p2.y);
            this.ctx.stroke();
        });

        if (this.isDrawing) {
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.startPoint.x, this.startPoint.y);
            this.ctx.lineTo(this.tempEndPoint.x, this.tempEndPoint.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        this.ctx.fillStyle = "#ff4444";
        this.points.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); 
            this.ctx.fill();
        });
    }
};

/** ГЛОБАЛНИ ФУНКЦИИ **/
function setTool(tool) { GraphicsManager.currentTool = tool; }
function exportSVG() { alert("SVG Export..."); }
function applyRelation(type) { console.log("Relation:", type); }

window.addEventListener('load', () => GraphicsManager.init());