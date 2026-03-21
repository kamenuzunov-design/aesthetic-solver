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
    // Zoom & Pan стейт
    userZoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
    lastPinchDist: 0,
    lastSvgString: null, 
    paths: [],           
    selectedPathIdx: -1, 
    selectedNodes: [],   
    selectedSegments: [], 
    dragNode: null,      

    // Мащабиране 
    imgScale: 1,
    
    init: function() {
        this.canvas = document.getElementById('mainCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        window.addEventListener('resize', () => this.resize());
        this.attachListeners();
        this.resize();
    },

    resize: function() {
        const container = document.getElementById('canvas-wrapper');
        if (!container || !this.canvas) return;
        
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        if (this.bgImage.src && this.bgImage.width > 0) {
            this.imgScale = Math.min(this.canvas.width / this.bgImage.width, this.canvas.height / this.bgImage.height) * 0.9;
            console.log(`Resize: canvas=${this.canvas.width}x${this.canvas.height}, img=${this.bgImage.width}x${this.bgImage.height}, scale=${this.imgScale}`);
        }
        this.redraw();
    },

    applyTransform: function() {
        const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
        const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
        const s = this.imgScale * this.userZoom;
        
        const x = (this.canvas.width - imgW * s) / 2 + this.panX;
        const y = (this.canvas.height - imgH * s) / 2 + this.panY;
        
        console.log(`applyTransform: x=${x.toFixed(1)}, y=${y.toFixed(1)}, s=${s.toFixed(3)}, canvas=${this.canvas.width}x${this.canvas.height}, imgW=${imgW}`);
        this.ctx.translate(x, y);
        this.ctx.scale(s, s);
    },

    redraw: function() {
        if (!this.ctx) return;
        if (this.canvas.width === 0) this.resize();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.render();
        this.renderSvg();
    },

    runPotrace: function() {
        if (!window.Potrace) {
            console.error("Библиотеката Potrace не е намерена.");
            return;
        }
        if (!this.bgImage.src) return;
        
        // Използваме Potrace за векторизиране
        Potrace.setParameter({
            turdsize: 2,
            optcurve: true,
            alphamax: 1,
            opttolerance: 0.2
        });

        Potrace.loadImageFromUrl(this.bgImage.src);
        Potrace.process(() => {
            const svgString = Potrace.getSVG(1, "curve");
            this.lastSvgString = svgString;
            this.paths = JSON.parse(JSON.stringify(Potrace.getPathList())); // Дълбоко копие на пътищата
            
            // За съвместимост със стария метод (ако се ползва другаде)
            const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
            this.potraceImg = new Image();
            this.potraceImg.onload = () => {
                this.redraw();
            };
            this.potraceImg.src = url;
        });
    },

    renderSvg: function() {
        if (!this.paths || this.paths.length === 0) return;
        this.ctx.save();
        this.applyTransform();
        // Връщаме прозрачността на 1.0 за векторите
        this.ctx.globalAlpha = 1.0;
        this.ctx.lineWidth = 1 / (this.imgScale * this.userZoom);
        this.drawPaths();
        if (this.currentTool === 'node-edit' && this.selectedPathIdx !== -1) {
            this.renderNodes();
        }
        this.ctx.restore();
    },

    drawPaths: function() {
        this.paths.forEach((path, pathIdx) => {
            const curve = path.curve;
            const n = curve.n;
            
            for (let i = 0; i < n; i++) {
                this.ctx.beginPath();
                const prevIdx = (i - 1 + n) % n;
                this.ctx.moveTo(curve.c[prevIdx * 3 + 2].x, curve.c[prevIdx * 3 + 2].y);
                
                if (curve.tag[i] === "CURVE") {
                    this.ctx.bezierCurveTo(
                        curve.c[i * 3 + 0].x, curve.c[i * 3 + 0].y,
                        curve.c[i * 3 + 1].x, curve.c[i * 3 + 1].y,
                        curve.c[i * 3 + 2].x, curve.c[i * 3 + 2].y
                    );
                } else {
                    this.ctx.lineTo(curve.c[i * 3 + 1].x, curve.c[i * 3 + 1].y);
                    this.ctx.lineTo(curve.c[i * 3 + 2].x, curve.c[i * 3 + 2].y);
                }
                
                let color = "black";
                if (pathIdx === this.selectedPathIdx) {
                    color = (this.selectedSegments.includes(i)) ? "red" : "#0078d7";
                }
                
                this.ctx.strokeStyle = color;
                this.ctx.stroke();
            }
        });
    },

    renderNodes: function() {
        const path = this.paths[this.selectedPathIdx];
        if (!path) return;
        const curve = path.curve;
        const size = 3 / (this.imgScale * this.userZoom); // Квадрат 3х3 пиксела
        
        for (let i = 0; i < curve.n; i++) {
            const p = curve.c[i * 3 + 2];
            const isSelected = this.selectedNodes.includes(i);
            const isLast = (i === curve.n - 1);
            
            this.ctx.beginPath();
            if (isLast) {
                // Рисуваме триъгълник за края на полилинията
                const h = size * 1.5;
                this.ctx.moveTo(p.x, p.y + h/2);
                this.ctx.lineTo(p.x - h/2, p.y - h/2);
                this.ctx.lineTo(p.x + h/2, p.y - h/2);
                this.ctx.closePath();
            } else {
                // Рисуваме квадрат 3х3
                this.ctx.rect(p.x - size/2, p.y - size/2, size, size);
            }
            
            this.ctx.fillStyle = "white";
            this.ctx.fill();
            this.ctx.strokeStyle = isSelected ? "red" : "#0078d7";
            this.ctx.lineWidth = 0.5 / (this.imgScale * this.userZoom);
            this.ctx.stroke();
        }
    },

    getHitInfo: function(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = x - rect.left;
        const screenY = y - rect.top;
        
        const s = this.imgScale * this.userZoom;
        const imgW = this.bgImage.complete ? this.bgImage.width : 100;
        const imgH = this.bgImage.complete ? this.bgImage.height : 100;
        
        const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
        const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
        
        const potraceX = (screenX - offsetX) / s;
        const potraceY = (screenY - offsetY) / s;

        // 1. Проверка за възли (Nodes)
        if (this.currentTool === 'node-edit' && this.selectedPathIdx !== -1) {
            const path = this.paths[this.selectedPathIdx];
            const curve = path.curve;
            const threshold = 6 / (this.imgScale * this.userZoom);
            for (let i = 0; i < curve.n; i++) {
                const p = curve.c[i * 3 + 2];
                if (Math.hypot(p.x - potraceX, p.y - potraceY) < threshold) {
                    return { type: 'node', pathIdx: this.selectedPathIdx, nodeIdx: i };
                }
            }
        }

        // 2. Проверка за сегменти (Segments) и пътища (Paths)
        this.ctx.save();
        this.applyTransform();
        this.ctx.lineWidth = 10 / (this.imgScale * this.userZoom); // По-голям обхват за клик
        
        for (let i = this.paths.length - 1; i >= 0; i--) {
            const curve = this.paths[i].curve;
            for (let j = 0; j < curve.n; j++) {
                this.ctx.beginPath();
                const prevIdx = (j - 1 + curve.n) % curve.n;
                this.ctx.moveTo(curve.c[prevIdx * 3 + 2].x, curve.c[prevIdx * 3 + 2].y);
                
                if (curve.tag[j] === "CURVE") {
                    this.ctx.bezierCurveTo(curve.c[j*3].x, curve.c[j*3].y, curve.c[j*3+1].x, curve.c[j*3+1].y, curve.c[j*3+2].x, curve.c[j*3+2].y);
                } else {
                    this.ctx.lineTo(curve.c[j*3+1].x, curve.c[j*3+1].y);
                    this.ctx.lineTo(curve.c[j*3+2].x, curve.c[j*3+2].y);
                }
                
                if (this.ctx.isPointInStroke(screenX, screenY) || this.ctx.isPointInPath(screenX, screenY)) {
                    this.ctx.restore();
                    return { type: 'segment', pathIdx: i, segmentIdx: j };
                }
            }
        }
        this.ctx.restore();
        return null;
    },

    render: function() {
        if (!this.bgImage.src) return;
        this.ctx.save();
        this.applyTransform();
        
        // Рисуваме растерното изображение с прозрачност
        this.ctx.globalAlpha = parseFloat(this.imgOpacity);
        this.ctx.drawImage(this.bgImage, 0, 0, this.bgImage.width, this.bgImage.height);
        
        this.ctx.restore();
    },

    attachListeners: function() {
        // Премахнат е click listener-а, защото векторизацията се случва автоматично при качване.

        const upload = document.getElementById('imgUpload');
        if (upload) {
            upload.addEventListener('change', (e) => {
                const reader = new FileReader();
                reader.onload = (f) => {
                    this.bgImage.onload = () => {
                        this.userZoom = 1.0;
                        this.panX = 0;
                        this.panY = 0;
                        this.resize();
                        
                        // Автоматично нулираме на 10% прозрачност
                        this.imgOpacity = 0.1;
                        const opacityRange = document.getElementById('imgOpacity');
                        if (opacityRange) opacityRange.value = 0.1;

                        this.potraceImg = null; 
                        this.lastSvgString = null;
                        
                        // Рендерираме първоначалното полупрозрачно изображение, докато се векторизира (ако отнеме време)
                        this.redraw();
                        
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
            opacityRange.value = this.imgOpacity; 
            opacityRange.addEventListener('input', (e) => {
                this.imgOpacity = e.target.value;
                this.redraw();
            });
        }

        // Mouse Wheel Zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const delta = e.deltaY > 0 ? -zoomSpeed * this.userZoom : zoomSpeed * this.userZoom;
            const newZoom = Math.max(0.1, Math.min(10, this.userZoom + delta));
            
            // Zoom към курсора
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Корекция на Pan, за да остане точката под курсора
            const dx = (mouseX - this.canvas.width/2 - this.panX) * (delta / this.userZoom);
            const dy = (mouseY - this.canvas.height/2 - this.panY) * (delta / this.userZoom);
            
            this.panX -= dx;
            this.panY -= dy;
            this.userZoom = newZoom;
            
            this.redraw();
        }, { passive: false });

        // Mouse Pan & Selection & Node Edit
        this.canvas.addEventListener('mousedown', (e) => {
            const hit = this.getHitInfo(e.clientX, e.clientY);
            
            if (this.currentTool === 'select' || this.currentTool === 'node-edit') {
                const ctrlKey = e.ctrlKey || e.metaKey;
                
                if (hit) {
                    if (hit.type === 'segment') {
                        // Ако кликнем на сегмент, деселектираме точките
                        this.selectedPathIdx = hit.pathIdx;
                        this.selectedNodes = []; 
                        
                        if (ctrlKey) {
                            if (this.selectedSegments.includes(hit.segmentIdx)) {
                                this.selectedSegments = this.selectedSegments.filter(s => s !== hit.segmentIdx);
                            } else {
                                this.selectedSegments.push(hit.segmentIdx);
                            }
                        } else {
                            this.selectedSegments = [hit.segmentIdx];
                        }
                    } else if (hit.type === 'node') {
                        // Ако кликнем на точка, деселектираме сегментите
                        this.selectedPathIdx = hit.pathIdx;
                        this.selectedSegments = [];
                        
                        if (ctrlKey) {
                            if (this.selectedNodes.includes(hit.nodeIdx)) {
                                this.selectedNodes = this.selectedNodes.filter(n => n !== hit.nodeIdx);
                            } else {
                                this.selectedNodes.push(hit.nodeIdx);
                            }
                        } else {
                            this.selectedNodes = [hit.nodeIdx];
                        }
                        this.dragNode = { pathIdx: hit.pathIdx, nodeIdx: hit.nodeIdx };
                    }
                } else {
                    this.selectedPathIdx = -1;
                    this.selectedNodes = [];
                    this.selectedSegments = [];
                }
                this.redraw();
            }

            // Продължаваме с Pan логиката само ако не влачим възел
            if (!this.dragNode) {
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.dragNode) {
                // Пресмятаме новите координати на възела
                const rect = this.canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                
                const potraceX = (screenX - this.canvas.width/2 - this.panX) / (this.imgScale * this.userZoom) + (this.bgImage.width / 2);
                const potraceY = (screenY - this.canvas.height/2 - this.panY) / (this.imgScale * this.userZoom) + (this.bgImage.height / 2);
                
                const path = this.paths[this.dragNode.pathIdx];
                const curve = path.curve;
                const nodeIdx = this.dragNode.nodeIdx;
                
                // Актуализираме основната точка
                curve.c[nodeIdx * 3 + 2].x = potraceX;
                curve.c[nodeIdx * 3 + 2].y = potraceY;
                
                // Актуализираме и предходния/следващия сегмент за непрекъснатост, ако е необходимо
                // (Potrace структурите са леко сложни, тук правим базово местене)
                
                this.redraw();
                return;
            }

            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;
            this.panX += dx;
            this.panY += dy;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            this.redraw();
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.dragNode = null;
        });

        // Touch (Mobile)
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.lastMouseX = e.touches[0].clientX;
                this.lastMouseY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                this.isDragging = false;
                this.lastPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
            }
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && this.isDragging) {
                e.preventDefault();
                const dx = e.touches[0].clientX - this.lastMouseX;
                const dy = e.touches[0].clientY - this.lastMouseY;
                this.panX += dx;
                this.panY += dy;
                this.lastMouseX = e.touches[0].clientX;
                this.lastMouseY = e.touches[0].clientY;
                this.redraw();
            } else if (e.touches.length === 2) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (dist - this.lastPinchDist) / 100 * this.userZoom;
                this.userZoom = Math.max(0.1, Math.min(10, this.userZoom + delta));
                this.lastPinchDist = dist;
                this.redraw();
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.isDragging = false;
        });

        // Zoom Reset
        const zoomReset = document.getElementById('ui-geo-zoom-reset');
        if (zoomReset) {
            zoomReset.addEventListener('click', () => {
                this.resetZoom();
            });
        }
    },

    resetZoom: function() {
        this.userZoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.redraw();
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