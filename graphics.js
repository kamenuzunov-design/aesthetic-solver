/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 * Оригинална Potrace интеграция
 */

const GraphicsManager = {
    canvas: null,
    ctx: null,
    bgImage: new Image(),
    imgOpacity: 0.5,
    potraceImg: null, // Кешираме генерирания SVG обект
    lastSvgString: null, // Стринг за експорт
    
    currentStage: 0,
    
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
        
        this.currentStage = (this.currentStage + 1) % 2; 
        console.log("Текущ етап:", this.currentStage === 0 ? "Оригинал" : "Potrace Векторизация");

        if (this.currentStage === 0) {
            this.render();
        } else {
            this.runPotrace();
        }
    },

    runPotrace: function() {
        if (!window.Potrace) {
            console.error("Библиотеката Potrace не е намерена.");
            return;
        }

        if (this.potraceImg) {
            this.renderSvg(); // Използваме кешираното изображение, ако вече сме го генерирали
            return;
        }

        Potrace.setParameter({
            alphamax: 1,
            optcurve: true,
            opttolerance: 0.2,
            turdsize: 2,
            turnpolicy: "black"
        });

        Potrace.loadImageFromUrl(this.bgImage.src);
        Potrace.process(() => {
            const svgString = Potrace.getSVG(1, "curve");
            this.lastSvgString = svgString;
            
            const DOMURL = window.URL || window.webkitURL || window;
            const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
            const url = DOMURL.createObjectURL(svgBlob);
            
            const img = new Image();
            img.onload = () => {
                this.potraceImg = img;
                this.renderSvg();
                DOMURL.revokeObjectURL(url);
            };
            img.src = url;
        });
    },

    renderSvg: function() {
        if (!this.potraceImg) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуваме оригиналното изображение отдолу с определена прозрачност
        this.ctx.save();
        this.ctx.globalAlpha = parseFloat(this.imgOpacity);
        this.ctx.drawImage(this.bgImage, 1, 1, this.bgImage.naturalWidth, this.bgImage.naturalHeight);
        this.ctx.restore();

        // Рисуваме Potrace вектора отгоре
        this.ctx.drawImage(this.potraceImg, 1, 1);
    },

    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.bgImage.src) {
            this.ctx.save();
            this.ctx.globalAlpha = parseFloat(this.imgOpacity);
            this.ctx.drawImage(this.bgImage, 1, 1, this.bgImage.naturalWidth, this.bgImage.naturalHeight);
            this.ctx.restore();
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
                        this.potraceImg = null; // Нулираме кеша при нова снимка
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
                if (this.currentStage === 0) {
                    this.render();
                } else {
                    this.renderSvg();
                }
            });
        }
    }
};

function setTool(tool) { GraphicsManager.currentTool = tool; }
function exportSVG() {
    if (!GraphicsManager.lastSvgString) {
        alert("Няма векторно изображение за запис. Моля, кликнете върху платното за векторизиране.");
        return;
    }
    const blob = new Blob([GraphicsManager.lastSvgString], {type: "image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vectorized_image.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
function applyRelation(type) {}

window.addEventListener('load', () => GraphicsManager.init());