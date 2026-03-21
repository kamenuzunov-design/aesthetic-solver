/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 * Potrace интеграция, автоматично векторизиране и мащабиране
 */

const GraphicsManager = {
    canvas: null,
    ctx: null,
    bgImage: new Image(),
    imgOpacity: 0.1,
    potraceImg: null, // Кешираме генерирания SVG обект
    lastSvgString: null, // Стринг за експорт
     
    // Мащабиране и центриране
    imgScale: 1,
    scaledW: 0,
    scaledH: 0,
    offsetX: 0,
    offsetY: 0,
    
    init: function() {
        this.canvas = document.getElementById('mainCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        window.addEventListener('resize', () => this.resize());
        this.attachListeners();
        this.resize();
    },

    calcScale: function() {
        if (!this.bgImage.src || !this.bgImage.naturalWidth) return;
        
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;

        const padding = 40; // 20px отстояние от всяка страна
        const maxWidth = wrapper.clientWidth - padding;
        const maxHeight = wrapper.clientHeight - padding;
        
        // Намираме най-доброто съотношение, за да се събере изцяло
        const ratio = Math.min(maxWidth / this.bgImage.naturalWidth, maxHeight / this.bgImage.naturalHeight);
        
        this.imgScale = ratio;
        this.scaledW = this.bgImage.naturalWidth * ratio;
        this.scaledH = this.bgImage.naturalHeight * ratio;
        
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
        
        this.offsetX = (wrapper.clientWidth - this.scaledW) / 2;
        this.offsetY = (wrapper.clientHeight - this.scaledH) / 2;
    },

    resize: function() {
        if (this.bgImage.src) {
            this.calcScale();
            if (this.potraceImg) {
                this.renderSvg();
            } else {
                this.render();
            }
        } else {
            const wrapper = document.getElementById('canvas-wrapper');
            if (wrapper) {
                this.canvas.width = wrapper.clientWidth;
                this.canvas.height = wrapper.clientHeight;
            }
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
            alphamax: 0,
            optcurve: false,
            opttolerance: 0.2,
            turdsize: 100,
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
        
        // Рисуваме оригиналното изображение отдолу с прозрачност
        this.ctx.save();
        this.ctx.globalAlpha = parseFloat(this.imgOpacity);
        this.ctx.drawImage(this.bgImage, this.offsetX, this.offsetY, this.scaledW, this.scaledH);
        this.ctx.restore();

        // Рисуваме Potrace вектора отгоре, мащабиран по същия начин
        this.ctx.drawImage(this.potraceImg, this.offsetX, this.offsetY, this.scaledW, this.scaledH);
    },

    render: function() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.bgImage.src && this.scaledW) {
            this.ctx.save();
            this.ctx.globalAlpha = parseFloat(this.imgOpacity);
            this.ctx.drawImage(this.bgImage, this.offsetX, this.offsetY, this.scaledW, this.scaledH);
            this.ctx.restore();
        }
    },

    attachListeners: function() {
        // Премахнат е click listener-а, защото векторизацията се случва автоматично при качване.

        const upload = document.getElementById('imgUpload');
        if (upload) {
            upload.addEventListener('change', (e) => {
                const reader = new FileReader();
                reader.onload = (f) => {
                    this.bgImage.onload = () => {
                        this.calcScale();
                        
                        // Автоматично нулираме на 10% прозрачност
                        this.imgOpacity = 0.1;
                        const opacityRange = document.getElementById('imgOpacity');
                        if (opacityRange) opacityRange.value = 0.1;

                        this.potraceImg = null; 
                        this.lastSvgString = null;
                        
                        // Рендерираме първоначалното полупрозрачно изображение, докато се векторизира (ако отнеме време)
                        this.render();
                        
                        // Автоматично започваме векторизирането
                        this.runPotrace();
                    };
                    this.bgImage.src = f.target.result;
                };
                if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
            });
        }

        const opacityRange = document.getElementById('imgOpacity');
        if (opacityRange) {
            // Уверяваме се, че при зареждане първоначалната позиция е каквото е в html (по-късно се пренаписва от кода при качване)
            opacityRange.value = this.imgOpacity; 
            
            opacityRange.addEventListener('input', (e) => {
                this.imgOpacity = e.target.value;
                if (this.potraceImg) {
                    this.renderSvg();
                } else {
                    this.render();
                }
            });
        }
    }
};

function setTool(tool) { GraphicsManager.currentTool = tool; }
function exportSVG() {
    if (!GraphicsManager.lastSvgString) {
        alert("Няма векторно изображение за запис.");
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