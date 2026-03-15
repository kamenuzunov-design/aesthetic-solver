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
    selectedObjects: [],
    
    init: function() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridCanvas = document.getElementById('gridCanvas');
        this.gridCtx = this.gridCanvas.getContext('2d');
        
        this.resize();
        this.drawGrid();
        this.attachListeners();
    },

    resize: function() {
        const wrapper = document.getElementById('canvas-wrapper');
        this.canvas.width = this.gridCanvas.width = wrapper.clientWidth;
        this.canvas.height = this.gridCanvas.height = wrapper.clientHeight;
    },

    drawGrid: function() {
        this.gridCtx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);
        this.gridCtx.strokeStyle = "#e0e0e0";
        this.gridCtx.beginPath();
        for (let x = 0; x <= this.gridCanvas.width; x += this.gridSize) {
            this.gridCtx.moveTo(x, 0);
            this.gridCtx.lineTo(x, this.gridCanvas.height);
        }
        for (let y = 0; y <= this.gridCanvas.height; y += this.gridSize) {
            this.gridCtx.moveTo(0, y);
            this.gridCtx.lineTo(this.gridCanvas.width, y);
        }
        this.gridCtx.stroke();
    },

    attachListeners: function() {
        // Логика за качване на снимка
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
    },

    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуване на фоновото изображение
        if (this.bgImage.src) {
            this.ctx.globalAlpha = this.imgOpacity;
            this.ctx.drawImage(this.bgImage, 0, 0);
            this.ctx.globalAlpha = 1.0;
        }
        
        // Тук ще добавим рисуването на векторите
    }
};

// Инициализация при показване на секцията
function setTool(tool) { console.log("Инструмент:", tool); }