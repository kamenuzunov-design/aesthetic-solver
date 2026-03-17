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
    
    points: [], // {x, y, id}
    lines: [],  // {p1, p2, id}
    
    currentTool: null,
    isDrawing: false,
    draggedPoint: null,
    selectedObjects: [],
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
        const maxWidth = wrapper.clientWidth;
        const maxHeight = wrapper.clientHeight;

        const ratio = Math.min(maxWidth / this.bgImage.naturalWidth, maxHeight / this.bgImage.naturalHeight);

        const newWidth = this.bgImage.naturalWidth * ratio;
        const newHeight = this.bgImage.naturalHeight * ratio;

        this.canvas.width = this.gridCanvas.width = newWidth;
        this.canvas.height = this.gridCanvas.height = newHeight;

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
        const step = 20; 

        for (let y = step; y < height - step; y += step) {
            for (let x = step; x < width - step; x += step) {
                const offset = (y * width + x) * 4;
                const brightness = (pixels[offset] + pixels[offset+1] + pixels[offset+2]) / 3;
                const rightB = (pixels[(y * width + (x + 1)) * 4] + pixels[(y * width + (x + 1)) * 4 + 1] + pixels[(y * width + (x + 1)) * 4 + 2]) / 3;
                const downB = (pixels[((y + 1) * width + x) * 4] + pixels[((y + 1) * width + x) * 4 + 1] + pixels[((y + 1) * width + x) * 4 + 2]) / 3;
                
                if (Math.abs(brightness - rightB) > 30 || Math.abs(brightness - downB) > 30) {
                    vectors.push({
                        p1: { x: this.snap(x), y: this.snap(y) },
                        p2: { x: this.snap(x), y: this.snap(y + step) },
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

        const upload = document.getElementById('imgUpload');
        if (upload) {
            upload.addEventListener('change', (e) => {
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
        }

        const opacityRange = document.getElementById('imgOpacity');
        if (opacityRange) {
            opacityRange.addEventListener('input', (e) => {
                this.imgOpacity = e.target.value;
                this.render();
            });
        }
    },

    handleDown: function(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = this.snap(e.clientX - rect.left);
        const y = this.snap(e.clientY - rect.top);

        this.draggedPoint = this.points.find(p => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10);

        if (!this.draggedPoint && this.currentTool === 'line') {
            this.isDrawing = true;
            this.startPoint = { x, y };
            this.tempEndPoint = { x, y };
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
        if (this.isDrawing && this.currentTool === 'line') {
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
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.startPoint.x, this.startPoint.y);
            this.ctx.lineTo(this.tempEndPoint.x, this.tempEndPoint.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        this.points.forEach(p => {
            this.ctx.fillStyle = (this.draggedPoint === p) ? "#28a745" : "#ff4444";
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); 
            this.ctx.fill();
        });
    }
};

/** ГЛОБАЛНИ ФУНКЦИИ ЗА БУТОНИТЕ **/
function setTool(tool) { 
    GraphicsManager.currentTool = tool; 
}

function exportSVG() { 
    alert("SVG Export logic is being developed."); 
}

function applyRelation(type) {
    console.log("Прилагане на връзка:", type);
}

// Инициализация
window.addEventListener('load', () => {
    GraphicsManager.init();
});