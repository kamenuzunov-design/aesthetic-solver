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

    // ПОДОБРЕНО ВЕКТОРИЗИРАНЕ
    runAutoVectorization: function() {
        if (!this.bgImage.src) return;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCtx.drawImage(this.bgImage, 0, 0, tempCanvas.width, tempCanvas.height);

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        this.lines = this.extractVectors(imageData);
        this.rebuildPoints();
        this.render();
    },

    extractVectors: function(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data;
        const vectors = [];
        const step = 15; // По-малък ход за по-голяма прецизност
        const threshold = 40; // Праг на чувствителност

        for (let y = step; y < height - step; y += step) {
            for (let x = step; x < width - step; x += step) {
                const idx = (y * width + x) * 4;
                const brightness = (pixels[idx] + pixels[idx+1] + pixels[idx+2]) / 3;

                // Проверка за Вертикален ръб (разлика по X)
                const rightIdx = (y * width + (x + 2)) * 4;
                const rightB = (pixels[rightIdx] + pixels[rightIdx+1] + pixels[rightIdx+2]) / 3;
                if (Math.abs(brightness - rightB) > threshold) {
                    vectors.push({
                        p1: { x: this.snap(x), y: this.snap(y) },
                        p2: { x: this.snap(x), y: this.snap(y + step) },
                        id: Math.random()
                    });
                }

                // Проверка за Хоризонтален ръб (разлика по Y)
                const downIdx = ((y + 2) * width + x) * 4;
                const downB = (pixels[downIdx] + pixels[downIdx+1] + pixels[downIdx+2]) / 3;
                if (Math.abs(brightness - downB) > threshold) {
                    vectors.push({
                        p1: { x: this.snap(x), y: this.snap(y) },
                        p2: { x: this.snap(x + step), y: this.snap(y) },
                        id: Math.random()
                    });
                }
            }
        }
        return vectors;
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

        // Толеранс 5 пиксела за хващане
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
function applyRelation(type) { 
    if (type === 'horizontal') {
        if (GraphicsManager.lines.length > 0) {
            let line = GraphicsManager.lines[GraphicsManager.lines.length - 1];
            line.p2.y = line.p1.y;
            GraphicsManager.rebuildPoints();
            GraphicsManager.render();
        }
    }
}

window.addEventListener('load', () => GraphicsManager.init());