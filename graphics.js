/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 * Potrace интеграция, автоматично векторизиране и мащабиране
 */

window.isPlusKeyPressed = false;
window.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') window.isPlusKeyPressed = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') window.isPlusKeyPressed = false;
});

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
    history: [],
    
    saveState: function() {
        if (!this.paths) return;
        const currentPathsJson = JSON.stringify(this.paths);
        if (this.history.length > 0) {
            const lastPathsJson = JSON.stringify(this.history[this.history.length - 1]);
            if (currentPathsJson === lastPathsJson) {
                return; // Няма промяна във векторите
            }
        }
        this.history.push(JSON.parse(currentPathsJson));
        if (this.history.length > 50) this.history.shift();
    },
    
    undo: function() {
        if (this.history.length > 0) {
            this.paths = this.history.pop();
            this.selectedPaths = [];
            this.activePathIdx = -1;
            this.selectedNodes = [];
            this.selectedSegments = [];
            this.redraw();
        }
    },
    isDragging: false,
    isBoxSelecting: false,
    boxSelectStart: {x: 0, y: 0},
    boxSelectEnd: {x: 0, y: 0},
    lastMouseX: 0,
    lastMouseY: 0,
    lastPinchDist: 0,
    lastSvgString: null, 
    paths: [],           
    selectedPaths: [],   
    activePathIdx: -1,   
    selectedNodes: [],   
    selectedSegments: [], 
    dragTarget: null,      

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
        
        // Рисуване на Box Selection Overlay
        if (this.isBoxSelecting) {
            const rect = this.canvas.getBoundingClientRect();
            const startX = this.boxSelectStart.x - rect.left;
            const startY = this.boxSelectStart.y - rect.top;
            const endX = this.boxSelectEnd.x - rect.left;
            const endY = this.boxSelectEnd.y - rect.top;
            
            this.ctx.save();
            this.ctx.fillStyle = "rgba(0, 120, 215, 0.2)";
            this.ctx.strokeStyle = "#0078d7";
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([5, 5]);
            
            const w = endX - startX;
            const h = endY - startY;
            
            this.ctx.fillRect(startX, startY, w, h);
            this.ctx.strokeRect(startX, startY, w, h);
            this.ctx.restore();
        }
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
            const rawPaths = Potrace.getPathList();
            this.paths = rawPaths.map(path => {
                const points = [];
                for (let i = 0; i < path.curve.n; i++) {
                    points.push({ x: path.curve.c[i * 3 + 2].x, y: path.curve.c[i * 3 + 2].y });
                }
                return points;
            });
            this.history = []; // Изчистваме историята
            
            // За съвместимост 
            const svgString = Potrace.getSVG(1, "curve");
            this.lastSvgString = svgString;
            const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
            this.potraceImg = new Image();
            this.potraceImg.onload = () => {
                this.redraw();
            };
            this.potraceImg.src = url;
        });
    },

    applySymmetry: function() {
        if (this.selectedPaths.length === 2) {
            this.executeSymmetry(this.selectedPaths[0], this.selectedPaths[1]);
        } else if (this.selectedPaths.length === 1) {
            if (typeof setTool === 'function') setTool('mirror');
            else this.currentTool = 'mirror'; // fallback
        } else {
            alert("Моля, селектирайте 1 или 2 полилинии чрез инструмента 'Селекция' първо.");
        }
    },
    
    getBBox: function(points) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        points.forEach(p => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });
        return { minX, minY, maxX, maxY };
    },

    executeSymmetry: function(pathAIdx, pathBIdx) {
        this.saveState();
        
        const pathA = this.paths[pathAIdx];
        const pathB = this.paths[pathBIdx];
        if (!pathA || !pathB) return;
        
        const bboxA = this.getBBox(pathA);
        const bboxB = this.getBBox(pathB);
        
        const cxA = (bboxA.minX + bboxA.maxX) / 2;
        const cyA = (bboxA.minY + bboxA.maxY) / 2;
        const cxB = (bboxB.minX + bboxB.maxX) / 2;
        const cyB = (bboxB.minY + bboxB.maxY) / 2;
        
        const midX = (cxA + cxB) / 2;
        const midY = (cyA + cyB) / 2;
        
        const isHorizontal = Math.abs(cxA - cxB) > Math.abs(cyA - cyB);
        
        // Създаваме огледално копие на B
        const mirroredB = pathB.map(p => {
            if (isHorizontal) {
                // Отражение по вертикалната ос x = midX (хоризонтално разположение)
                return { x: 2 * midX - p.x, y: p.y };
            } else {
                // Отражение по хоризонталната ос y = midY (вертикално разположение)
                return { x: p.x, y: 2 * midY - p.y };
            }
        });
        
        // Реверсираме реда на точките, за да запазим правилния order на полигона
        mirroredB.reverse();
        
        // Заменяме A с mirrored B
        this.paths[pathAIdx] = mirroredB;
        
        if (typeof setTool === 'function') setTool('select');
        else this.currentTool = 'select'; // fallback
        
        this.selectedPaths = [pathAIdx, pathBIdx];
        this.redraw();
    },

    renderSvg: function() {
        if (!this.paths || this.paths.length === 0) return;
        this.ctx.save();
        this.applyTransform();
        // Връщаме прозрачността на 1.0 за векторите
        this.ctx.globalAlpha = 1.0;
        this.ctx.lineWidth = 1 / (this.imgScale * this.userZoom);
        this.drawPaths();
        if ((this.currentTool === 'node-edit' || this.currentTool === 'segment-edit') && this.activePathIdx !== -1) {
            this.renderNodes();
        }
        this.ctx.restore();
    },

    drawPaths: function() {
        this.paths.forEach((points, pathIdx) => {
            const n = points.length;
            if (n < 2) return;
            const isClosed = points[0].isClosed !== false;
            
            for (let i = 0; i < n; i++) {
                if (!isClosed && i === 0) continue; // Пропускаме затварящия сегмент за отворени пътища
                
                this.ctx.beginPath();
                const prevIdx = (i - 1 + n) % n;
                this.ctx.moveTo(points[prevIdx].x, points[prevIdx].y);
                this.ctx.lineTo(points[i].x, points[i].y);
                
                let color = "black";
                if (this.currentTool === 'select') {
                    if (this.selectedPaths.includes(pathIdx)) color = "#0078d7";
                } else if (this.currentTool === 'node-edit' || this.currentTool === 'segment-edit') {
                    if (pathIdx === this.activePathIdx) {
                        color = (this.currentTool === 'segment-edit' && this.selectedSegments.includes(i)) ? "red" : "#0078d7";
                    }
                }
                
                this.ctx.strokeStyle = color;
                this.ctx.stroke();
            }
        });
    },

    renderNodes: function() {
        const points = this.paths[this.activePathIdx];
        if (!points) return;
        const size = 8 / (this.imgScale * this.userZoom); // Квадрат 8х8 пиксела
        
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const isSelected = this.currentTool === 'node-edit' && this.selectedNodes.includes(i);
            const isLast = (i === points.length - 1);
            
            this.ctx.beginPath();
            if (isLast) {
                // Рисуваме триъгълник за края на полилинията
                const h = size * 1.5; // 12
                this.ctx.moveTo(p.x, p.y + h/2);
                this.ctx.lineTo(p.x - h/2, p.y - h/2);
                this.ctx.lineTo(p.x + h/2, p.y - h/2);
                this.ctx.closePath();
            } else {
                // Рисуваме квадрат 6х6
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
        const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
        const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
        
        const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
        const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
        
        const potraceX = (screenX - offsetX) / s;
        const potraceY = (screenY - offsetY) / s;

        // 1. Проверка за възли (Nodes)
        if (this.currentTool === 'node-edit' && this.activePathIdx !== -1) {
            const points = this.paths[this.activePathIdx];
            const threshold = 16 / (this.imgScale * this.userZoom);
            for (let i = 0; i < points.length; i++) {
                const p = points[i];
                if (Math.hypot(p.x - potraceX, p.y - potraceY) < threshold) {
                    return { type: 'node', pathIdx: this.activePathIdx, nodeIdx: i };
                }
            }
        }

        // 2. Проверка за сегменти (Segments) и пътища (Paths)
        this.ctx.save();
        this.applyTransform();
        this.ctx.lineWidth = 10 / (this.imgScale * this.userZoom); // По-голям обхват за клик
        
        for (let i = this.paths.length - 1; i >= 0; i--) {
            const points = this.paths[i];
            const n = points.length;
            for (let j = 0; j < n; j++) {
                this.ctx.beginPath();
                const prevIdx = (j - 1 + n) % n;
                this.ctx.moveTo(points[prevIdx].x, points[prevIdx].y);
                this.ctx.lineTo(points[j].x, points[j].y);
                
                if (this.ctx.isPointInStroke(screenX, screenY) || this.ctx.isPointInPath(screenX, screenY)) {
                    this.ctx.restore();
                    return { type: (this.currentTool === 'select' ? 'path' : 'segment'), pathIdx: i, segmentIdx: j };
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
                        
                        // Рендерираме първоначалното полупрозрачно изображение, докато се векторизира
                        this.redraw();
                        
                        // Автоматично започваме векторизирането
                        this.runPotrace();
                    };
                    this.bgImage.src = f.target.result;
                };
                if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.undo();
            } else if (e.key === 'Escape') {
                this.selectedPaths = [];
                this.activePathIdx = -1;
                this.selectedNodes = [];
                this.selectedSegments = [];
                this.isBoxSelecting = false;
                this.redraw();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (this.currentTool === 'node-edit' && this.activePathIdx !== -1 && this.selectedNodes.length > 0) {
                    e.preventDefault();
                    this.saveState();
                    const points = this.paths[this.activePathIdx];
                    const sortedNodes = [...this.selectedNodes].sort((a,b) => b-a);
                    sortedNodes.forEach(idx => {
                        // Оставяме поне 2 точки, за да не счупим масива напълно
                        if (points.length > 2) {
                            points.splice(idx, 1);
                        }
                    });
                    this.selectedNodes = [];
                    this.redraw();
                } else if (this.currentTool === 'select' && this.selectedPaths.length > 0) {
                    e.preventDefault();
                    this.saveState();
                    const sortedPaths = [...this.selectedPaths].sort((a,b) => b-a);
                    sortedPaths.forEach(pIdx => {
                        this.paths.splice(pIdx, 1);
                    });
                    this.selectedPaths = [];
                    this.redraw();
                } else if (this.currentTool === 'segment-edit' && this.activePathIdx !== -1 && this.selectedSegments.length > 0) {
                    e.preventDefault();
                    this.saveState();
                    
                    let points = this.paths[this.activePathIdx];
                    let isClosed = points[0].isClosed !== false;
                    
                    let cutSegments = new Set(this.selectedSegments);
                    if (!isClosed) cutSegments.add(0);
                    
                    if (isClosed && cutSegments.size === 1) {
                         const idx = this.selectedSegments[0];
                         let rotatedPoints = points.slice(idx).concat(points.slice(0, idx));
                         rotatedPoints[0].isClosed = false;
                         this.paths[this.activePathIdx] = rotatedPoints;
                    } else {
                         let newPaths = [];
                         let currentPath = [];
                         
                         if (!cutSegments.has(0)) {
                             let firstCut = 0;
                             for (let i=0; i<points.length; i++) {
                                 if (cutSegments.has(i)) { firstCut = i; break; }
                             }
                             points = points.slice(firstCut).concat(points.slice(0, firstCut));
                             let shiftedCuts = new Set();
                             cutSegments.forEach(idx => {
                                 shiftedCuts.add((idx - firstCut + points.length) % points.length);
                             });
                             cutSegments = shiftedCuts;
                         }

                         for (let i = 0; i < points.length; i++) {
                              if (cutSegments.has(i)) {
                                  if (currentPath.length > 0) {
                                      currentPath[0].isClosed = false;
                                      newPaths.push(currentPath);
                                  }
                                  currentPath = [points[i]];
                              } else {
                                  currentPath.push(points[i]);
                              }
                         }
                         if (currentPath.length > 0) {
                             currentPath[0].isClosed = false;
                             newPaths.push(currentPath);
                         }
                         
                         // Ако пътят се разцепи изцяло до единични точки, те също ще останат
                         // Изолираните точки (length === 1) не се рендват като линии, но съществуват като възли
                         this.paths.splice(this.activePathIdx, 1, ...newPaths);
                    }
                    this.selectedSegments = [];
                    this.activePathIdx = -1;
                    this.redraw();
                }
            }
        });

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
            
            if (this.currentTool === 'mirror') {
                if (hit && this.selectedPaths.length > 0) {
                    if (hit.pathIdx !== this.selectedPaths[0]) {
                        this.executeSymmetry(this.selectedPaths[0], hit.pathIdx);
                    }
                }
                return;
            }
            
            if (this.currentTool === 'select' || this.currentTool === 'node-edit' || this.currentTool === 'segment-edit') {
                const ctrlKey = e.ctrlKey || e.metaKey;
                
                if (hit) {
                    this.saveState(); // Запазваме състоянието за Undo преди местене
                    
                    if (this.currentTool === 'select') {
                        // Работа с цели пътища
                        if (ctrlKey) {
                            if (this.selectedPaths.includes(hit.pathIdx)) {
                                this.selectedPaths = this.selectedPaths.filter(p => p !== hit.pathIdx);
                            } else {
                                this.selectedPaths.push(hit.pathIdx);
                            }
                        } else {
                            if (!this.selectedPaths.includes(hit.pathIdx)) {
                                this.selectedPaths = [hit.pathIdx];
                            }
                        }
                    } else if (this.currentTool === 'segment-edit') {
                        // Работа със сегменти
                        this.activePathIdx = hit.pathIdx;
                        this.selectedNodes = []; 
                        
                        if (ctrlKey) {
                            if (this.selectedSegments.includes(hit.segmentIdx)) {
                                this.selectedSegments = this.selectedSegments.filter(s => s !== hit.segmentIdx);
                            } else {
                                this.selectedSegments.push(hit.segmentIdx);
                            }
                        } else {
                            if (!this.selectedSegments.includes(hit.segmentIdx)) {
                                this.selectedSegments = [hit.segmentIdx];
                            }
                        }
                    } else if (this.currentTool === 'node-edit') {
                        // Работа с възли
                        this.activePathIdx = hit.pathIdx;
                        this.selectedSegments = [];
                        
                        if (hit.type === 'segment' && window.isPlusKeyPressed) {
                            const points = this.paths[this.activePathIdx];
                            const idx = hit.segmentIdx;
                            const prevIdx = (idx - 1 + points.length) % points.length;
                            const p1 = points[prevIdx];
                            const p2 = points[idx];
                            
                            // Изчисляваме Potrace координатите на мишката
                            const rect = this.canvas.getBoundingClientRect();
                            const s = this.imgScale * this.userZoom;
                            const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
                            const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
                            const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
                            const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
                            const potraceX = (e.clientX - rect.left - offsetX) / s;
                            const potraceY = (e.clientY - rect.top - offsetY) / s;
                            
                            // Проджектираме върху линията за точност
                            const atob = { x: p2.x - p1.x, y: p2.y - p1.y };
                            const atop = { x: potraceX - p1.x, y: potraceY - p1.y };
                            const len2 = atob.x * atob.x + atob.y * atob.y;
                            let t = 0.5;
                            if (len2 > 0) {
                                const dot = atop.x * atob.x + atop.y * atob.y;
                                t = Math.min(1, Math.max(0, dot / len2));
                            }
                            const newPt = { x: p1.x + atob.x * t, y: p1.y + atob.y * t };
                            
                            points.splice(idx, 0, newPt);
                            this.selectedNodes = [idx];
                            
                            // Правим новата точка dragTarget, за да се движи при влачене
                            hit.type = 'node';
                            hit.nodeIdx = idx;
                        } else if (hit.type === 'node') {
                            if (ctrlKey) {
                                if (this.selectedNodes.includes(hit.nodeIdx)) {
                                    this.selectedNodes = this.selectedNodes.filter(n => n !== hit.nodeIdx);
                                } else {
                                    this.selectedNodes.push(hit.nodeIdx);
                                }
                            } else {
                                if (!this.selectedNodes.includes(hit.nodeIdx)) {
                                    this.selectedNodes = [hit.nodeIdx];
                                }
                            }
                        } else {
                            if (!ctrlKey) this.selectedNodes = [];
                        }
                    }
                    this.dragTarget = hit;
                    this.lastDragX = null;
                    this.lastDragY = null;
                } else {
                    if (!ctrlKey) {
                        if (this.currentTool === 'select') {
                            // Не разселектираме веднага пътищата, ако може би започваме box select
                        } else {
                            this.selectedNodes = [];
                            this.selectedSegments = [];
                        }
                    }
                    this.dragTarget = null;
                    
                    if (e.button === 0) { // Ляв клик за Box Select
                        this.isBoxSelecting = true;
                        this.boxSelectStart = { x: e.clientX, y: e.clientY };
                        this.boxSelectEnd = { x: e.clientX, y: e.clientY };
                    }
                }
                this.redraw();
            }

            // Продължаваме с Pan логиката само ако не влачим възел/сегмент и не сме в box select
            if (!this.dragTarget && !this.isBoxSelecting) {
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isBoxSelecting) {
                this.boxSelectEnd = { x: e.clientX, y: e.clientY };
                this.redraw();
                return;
            }
            if (this.dragTarget) {
                const rect = this.canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                
                const s = this.imgScale * this.userZoom;
                const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
                const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
                
                const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
                const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
                
                const potraceX = (screenX - offsetX) / s;
                const potraceY = (screenY - offsetY) / s;
                
                if (this.lastDragX === null) {
                    this.lastDragX = potraceX;
                    this.lastDragY = potraceY;
                    return;
                }
                
                const dx = potraceX - this.lastDragX;
                const dy = potraceY - this.lastDragY;
                
                if (this.currentTool === 'select') {
                    this.selectedPaths.forEach(pIdx => {
                        const points = this.paths[pIdx];
                        if (points) {
                            points.forEach(pt => { pt.x += dx; pt.y += dy; });
                        }
                    });
                } else if (this.currentTool === 'node-edit' && this.activePathIdx !== -1) {
                    const points = this.paths[this.activePathIdx];
                    if (points) {
                        this.selectedNodes.forEach(idx => {
                            points[idx].x += dx;
                            points[idx].y += dy;
                        });
                    }
                } else if (this.currentTool === 'segment-edit' && this.activePathIdx !== -1) {
                    const points = this.paths[this.activePathIdx];
                    if (points) {
                        this.selectedSegments.forEach(idx => {
                            const prevIdx = (idx - 1 + points.length) % points.length;
                            points[idx].x += dx;
                            points[idx].y += dy;
                            points[prevIdx].x += dx;
                            points[prevIdx].y += dy;
                        });
                    }
                }
                
                this.lastDragX = potraceX;
                this.lastDragY = potraceY;
                
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

        window.addEventListener('mouseup', (e) => {
            if (this.isBoxSelecting) {
                this.isBoxSelecting = false;
                
                const rect = this.canvas.getBoundingClientRect();
                const startX = this.boxSelectStart.x - rect.left;
                const startY = this.boxSelectStart.y - rect.top;
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;
                
                const s = this.imgScale * this.userZoom;
                const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
                const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
                
                const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
                const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
                
                const minX = (Math.min(startX, endX) - offsetX) / s;
                const minY = (Math.min(startY, endY) - offsetY) / s;
                const maxX = (Math.max(startX, endX) - offsetX) / s;
                const maxY = (Math.max(startY, endY) - offsetY) / s;
                
                // Пропускаме, ако кутията е твърде малка (просто кликване)
                if (Math.abs(startX - endX) > 5 || Math.abs(startY - endY) > 5) {
                    
                    let foundPaths = [];
                    let bestPathIdx = -1;
                    let selectedItems = [];
                    
                    for (let pIdx = 0; pIdx < this.paths.length; pIdx++) {
                        const points = this.paths[pIdx];
                        
                        if (this.currentTool === 'select') {
                            let allIn = true;
                            for (let i = 0; i < points.length; i++) {
                                const p = points[i];
                                if (!(p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)) {
                                    allIn = false; break;
                                }
                            }
                            if (allIn && points.length > 0) Object.keys(points).length && foundPaths.push(pIdx);
                        } else {
                            let itemsInBox = [];
                            if (this.currentTool === 'node-edit') {
                                for (let i = 0; i < points.length; i++) {
                                    const p = points[i];
                                    if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) itemsInBox.push(i);
                                }
                            } else if (this.currentTool === 'segment-edit') {
                                for (let i = 0; i < points.length; i++) {
                                    const p1 = points[i];
                                    const p2 = points[(i-1+points.length)%points.length];
                                    if (p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY &&
                                        p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY) {
                                        itemsInBox.push(i);
                                    }
                                }
                            }
                            
                            if (itemsInBox.length > 0) {
                                if (this.activePathIdx !== -1 && pIdx === this.activePathIdx) {
                                    bestPathIdx = pIdx; selectedItems = itemsInBox; break;
                                }
                                if (bestPathIdx === -1) {
                                    bestPathIdx = pIdx; selectedItems = itemsInBox;
                                }
                            }
                        }
                    }
                    
                    const ctrlKey = e.ctrlKey || e.metaKey;

                    if (this.currentTool === 'select') {
                        if (foundPaths.length > 0) {
                            if (ctrlKey) {
                                foundPaths.forEach(p => { if (!this.selectedPaths.includes(p)) this.selectedPaths.push(p); });
                            } else {
                                this.selectedPaths = foundPaths;
                            }
                        } else if (!ctrlKey) {
                            this.selectedPaths = [];
                        }
                    } else {
                        if (bestPathIdx !== -1) {
                            this.activePathIdx = bestPathIdx;
                            if (this.currentTool === 'node-edit') {
                                if (ctrlKey) {
                                    selectedItems.forEach(item => { if (!this.selectedNodes.includes(item)) this.selectedNodes.push(item); });
                                } else {
                                    this.selectedNodes = selectedItems;
                                }
                                this.selectedSegments = [];
                            } else {
                                if (ctrlKey) {
                                    selectedItems.forEach(item => { if (!this.selectedSegments.includes(item)) this.selectedSegments.push(item); });
                                } else {
                                    this.selectedSegments = selectedItems;
                                }
                                this.selectedNodes = [];
                            }
                        } else if (!ctrlKey) {
                            this.selectedNodes = [];
                            this.selectedSegments = [];
                        }
                    }
                } else {
                    const ctrlKey = e.ctrlKey || e.metaKey;
                    if (!ctrlKey && this.currentTool === 'select') {
                        this.selectedPaths = [];
                    }
                }
                
                this.redraw();
            }

            this.isDragging = false;
            this.dragTarget = null;
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

function setTool(tool) {
    GraphicsManager.currentTool = tool;
    
    // Премахваме active класа от всички инструменти и го слагаме на избрания
    document.querySelectorAll('#sec-geometric .geo-toolbar-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('ui-geo-' + tool);
    if (activeBtn) activeBtn.classList.add('active');
}
function exportSVG() {
    if (!GraphicsManager.paths || GraphicsManager.paths.length === 0) {
        alert("Няма векторно изображение за запис.");
        return;
    }
    
    const w = GraphicsManager.bgImage.complete ? GraphicsManager.bgImage.width : 500;
    const h = GraphicsManager.bgImage.complete ? GraphicsManager.bgImage.height : 500;
    
    let svg = `<svg version="1.1" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">\n`;
    svg += '<path d="';
    
    GraphicsManager.paths.forEach(points => {
        const n = points.length;
        if (n < 2) return;
        const isClosed = points[0].isClosed !== false;
        
        svg += `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)} `;
        for (let i = 1; i < n; i++) {
            svg += `L ${points[i].x.toFixed(2)} ${points[i].y.toFixed(2)} `;
        }
        if (isClosed) {
            svg += 'Z ';
        }
    });
    
    // Fill "evenodd" follows Potrace logic for nested loops, but using fill="none" matches the structural canvas wireframe view exactly
    svg += '" stroke="black" stroke-width="2" fill="none" />\n</svg>';
    
    const blob = new Blob([svg], {type: "image/svg+xml;charset=utf-8"});
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