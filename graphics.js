/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 */

const GraphicsManager = {
    canvas: null,
    ctx: null,
    bgImage: new Image(),
    imgOpacity: 0.5,
    gridSize: 20,
    
    points: [], // Масив от {x, y, id}
    lines: [],  // Масив от {p1, p2, id}
    
    currentTool: null,
    isDrawing: false,
    startPoint: null,
    tempEndPoint: null,
    
    init: function() {
        this.canvas = document.getElementById('mainCanvas');
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
        this.canvas.width = this.gridCanvas.width = wrapper.clientWidth;
        this.canvas.height = this.gridCanvas.height = wrapper.clientHeight;
    },

    drawGrid: function() {
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

    // Математическо "прилепване" към мрежата
    snapToGrid: function(val) {
        return Math.round(val / this.gridSize) * this.gridSize;
    },

    attachListeners: function() {
        // Качване на снимка
        document.getElementById('imgUpload').addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                this.bgImage.onload = () => this.render();
                this.bgImage.src = event.target.result;
            };
            reader.readAsDataURL(e.target.files[0]);
        });

        document.getElementById('imgOpacity').addEventListener('input', (e) => {
            this.imgOpacity = e.target.value;
            this.render();
        });

        // Работа с мишката върху Canvas
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        window.addEventListener('mouseup', () => this.handleMouseUp());
    },

    handleMouseDown: function(e) {
        const rect = this.canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const rawY = e.clientY - rect.top;
        
        const x = this.snapToGrid(rawX);
        const y = this.snapToGrid(rawY);

        if (this.currentTool === 'point') {
            this.addPoint(x, y);
        } else if (this.currentTool === 'line') {
            this.isDrawing = true;
            this.startPoint = { x, y };
            this.tempEndPoint = { x, y };
        }
        this.render();
    },

    handleMouseMove: function(e) {
        if (!this.isDrawing) return;
        const rect = this.canvas.getBoundingClientRect();
        this.tempEndPoint = {
            x: this.snapToGrid(e.clientX - rect.left),
            y: this.snapToGrid(e.clientY - rect.top)
        };
        this.render();
    },

    handleMouseUp: function() {
        if (this.isDrawing && this.currentTool === 'line') {
            if (this.startPoint.x !== this.tempEndPoint.x || this.startPoint.y !== this.tempEndPoint.y) {
                this.addLine(this.startPoint, this.tempEndPoint);
            }
        }
        this.isDrawing = false;
        this.startPoint = null;
        this.render();
    },

    addPoint: function(x, y) {
        if (!this.points.some(p => p.x === x && p.y === y)) {
            this.points.push({ x, y, id: Date.now() });
        }
    },

    addLine: function(p1, p2) {
        // Добавяме точките, ако не съществуват
        this.addPoint(p1.x, p1.y);
        this.addPoint(p2.x, p2.y);
        this.lines.push({ p1, p2, id: Date.now() });
    },

    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 1. Фоново изображение
        if (this.bgImage.src) {
            this.ctx.save();
            this.ctx.globalAlpha = this.imgOpacity;
            this.ctx.drawImage(this.bgImage, 0, 0);
            this.ctx.restore();
        }
        
        // 2. Рисуване на линиите
        this.ctx.strokeStyle = "#2d3d4c";
        this.ctx.lineWidth = 2;
        this.lines.forEach(line => {
            this.ctx.beginPath();
            this.ctx.moveTo(line.p1.x, line.p1.y);
            this.ctx.lineTo(line.p2.x, line.p2.y);
            this.ctx.stroke();
        });

        // 3. Рисуване на временна линия (докато чертаем)
        if (this.isDrawing && this.startPoint && this.tempEndPoint) {
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.moveTo(this.startPoint.x, this.startPoint.y);
            this.ctx.lineTo(this.tempEndPoint.x, this.tempEndPoint.y);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        // 4. Рисуване на точките
        this.ctx.fillStyle = "#ff4444";
        this.points.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
};

// Глобални функции за бутоните
function setTool(tool) {
    GraphicsManager.currentTool = tool;
}

// Стартиране
window.addEventListener('load', () => {
    GraphicsManager.init();
});