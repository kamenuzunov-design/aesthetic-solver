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
        const state = { paths: this.paths, relations: this.relations };
        const currentStateJson = JSON.stringify(state);
        if (this.history.length > 0) {
            const lastStateJson = JSON.stringify(this.history[this.history.length - 1]);
            if (currentStateJson === lastStateJson) {
                return; // Няма промяна
            }
        }
        this.history.push(JSON.parse(currentStateJson));
        if (this.history.length > 50) this.history.shift();
    },
    
    undo: function() {
        if (this.history.length > 0) {
            const state = this.history.pop();
            this.paths = state.paths;
            this.relations = state.relations || [];
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
    drawStartPt: null,      // За Rectangle/Round-Rect
    currentPoints: [],      // За Line tool
    relations: [],          // { type, pathIdx, segIdx, targetPathIdx, targetSegIdx }
    selectedRelation: null, 



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
        this.ctx.save();
        this.applyTransform();
        // Връщаме прозрачността на 1.0 за векторите
        this.ctx.globalAlpha = 1.0;
        this.ctx.lineWidth = 1 / (this.imgScale * this.userZoom);
        
        if (this.paths && this.paths.length > 0) {
            this.drawPaths();
        }
        
        // Рисуване на текущата линия в процес на чертане
        if (this.currentTool === 'line' && this.currentPoints.length > 0) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.currentPoints[0].x, this.currentPoints[0].y);
            for (let i = 1; i < this.currentPoints.length; i++) {
                this.ctx.lineTo(this.currentPoints[i].x, this.currentPoints[i].y);
            }
            // Показваме следващата точка към курсора
            if (this.lastMouseX !== undefined) {
                const rect = this.canvas.getBoundingClientRect();
                const s = this.imgScale * this.userZoom;
                const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
                const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
                const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
                const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
                const curX = (this.lastMouseX - rect.left - offsetX) / s;
                const curY = (this.lastMouseY - rect.top - offsetY) / s;
                this.ctx.lineTo(curX, curY);
            }
            this.ctx.strokeStyle = "#28a745"; // Green preview
            this.ctx.stroke();
        }

        // Рисуване на преглед за правоъгълник
        if ((this.currentTool === 'rect' || this.currentTool === 'round-rect') && this.drawStartPt && this.lastMouseX !== undefined) {
            const rect = this.canvas.getBoundingClientRect();
            const s = this.imgScale * this.userZoom;
            const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
            const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
            const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
            const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
            const curX = (this.lastMouseX - rect.left - offsetX) / s;
            const curY = (this.lastMouseY - rect.top - offsetY) / s;

            this.ctx.beginPath();
            if (this.currentTool === 'rect') {
                this.ctx.rect(this.drawStartPt.x, this.drawStartPt.y, curX - this.drawStartPt.x, curY - this.drawStartPt.y);
            } else {
                const pts = this.createRoundRectPoints(this.drawStartPt.x, this.drawStartPt.y, curX, curY);
                this.ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) this.ctx.lineTo(pts[i].x, pts[i].y);
                this.ctx.closePath();
            }
            this.ctx.strokeStyle = "#28a745"; // Green preview
            this.ctx.stroke();
        }

        if ((this.currentTool === 'node-edit' || this.currentTool === 'segment-edit') && this.activePathIdx !== -1) {
            this.renderNodes();
            this.renderRelations();
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

        // 3. Проверка за връзки (Relations)
        if (this.currentTool === 'segment-edit' && this.activePathIdx !== -1) {
            const rels = this.getSegmentRelations(this.activePathIdx);
            const size = 16 / (this.imgScale * this.userZoom);
            for (const [segIdx, list] of Object.entries(rels)) {
                const sIdx = parseInt(segIdx);
                const pos = this.getSegmentMidpoint(this.activePathIdx, sIdx);
                const gap = 4 / (this.imgScale * this.userZoom);
                for (let i = 0; i < list.length; i++) {
                    const rel = list[i];
                    const rx = pos.x + (i * (size + gap));
                    const ry = pos.y + 10 / (this.imgScale * this.userZoom);
                    if (potraceX >= rx - size/2 && potraceX <= rx + size/2 &&
                        potraceY >= ry - size/2 && potraceY <= ry + size/2) {
                        return { type: 'relation', relation: rel };
                    }
                }
            }
        }

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
            if ((e.code === 'KeyZ' || e.key.toLowerCase() === 'z' || e.key === 'я') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                this.undo();
            } else if (e.key === 'Escape' || e.key === 'Enter') {
                if (this.currentPoints.length > 1) {
                    this.saveState();
                    this.paths.push([...this.currentPoints]);
                }
                this.currentPoints = [];
                this.drawStartPt = null;

                // Връщаме се към активно селектирания инструмент от първата група
                const selectionGroup = ['select', 'segment-edit', 'node-edit'];
                const activeSelection = selectionGroup.find(t => document.getElementById('ui-geo-' + t)?.classList.contains('active'));
                if (activeSelection) {
                    this.currentTool = activeSelection;
                } else {
                    this.selectedPaths = [];
                }
                
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
                        // Махаме и връзките за този път
                        this.relations = this.relations.filter(r => r.pathIdx !== pIdx);
                        // Шифтваме индексите на останалите връзки
                        this.relations.forEach(r => { if (r.pathIdx > pIdx) r.pathIdx--; });
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
                    // При промяна на структурата на пътя, в момента е най-сигурно да изчистим връзките за този път
                    this.relations = this.relations.filter(r => r.pathIdx !== this.activePathIdx);
                    this.selectedSegments = [];
                    this.activePathIdx = -1;
                    this.redraw();
                } else if (this.selectedRelation) {
                    e.preventDefault();
                    this.saveState();
                    this.relations = this.relations.filter(r => r !== this.selectedRelation);
                    this.selectedRelation = null;
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
            
            // 1. Pan с десен или среден бутон
            if (e.button === 1 || e.button === 2) {
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                if (e.button === 2) e.preventDefault(); // За десен бутон
                return;
            }

            // Продължаваме само за ляв бутон (button 0)
            if (e.button !== 0) return;
            
            if (this.currentTool === 'mirror') {
                if (hit && this.selectedPaths.length > 0) {
                    if (hit.pathIdx !== this.selectedPaths[0]) {
                        this.executeSymmetry(this.selectedPaths[0], hit.pathIdx);
                    }
                }
                return;
            }
            
            if (hit && hit.type === 'relation') {
                this.selectedRelation = hit.relation;
                this.selectedSegments = [];
                this.selectedNodes = [];
                this.redraw();
                return;
            } else {
                this.selectedRelation = null;
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
            } else if (this.currentTool === 'line') {
                const rect = this.canvas.getBoundingClientRect();
                const s = this.imgScale * this.userZoom;
                const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
                const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
                const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
                const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
                const potraceX = (e.clientX - rect.left - offsetX) / s;
                const potraceY = (e.clientY - rect.top - offsetY) / s;

                if (this.currentPoints.length === 0) {
                    this.saveState();
                    this.currentPoints.push({ x: potraceX, y: potraceY, isClosed: false });
                } else {
                    this.currentPoints.push({ x: potraceX, y: potraceY });
                }
                this.redraw();
            } else if (this.currentTool === 'rect' || this.currentTool === 'round-rect') {
                const rect = this.canvas.getBoundingClientRect();
                const s = this.imgScale * this.userZoom;
                const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
                const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
                const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
                const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
                this.drawStartPt = {
                    x: (e.clientX - rect.left - offsetX) / s,
                    y: (e.clientY - rect.top - offsetY) / s
                };
            }

            // Продължаваме с Pan логиката само ако не влачим възел/сегмент, не сме в box select и не чертаем
            if (!this.dragTarget && !this.isBoxSelecting && !['line', 'rect', 'round-rect'].includes(this.currentTool)) {
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            const currentX = e.clientX;
            const currentY = e.clientY;

            if (this.isBoxSelecting) {
                this.boxSelectEnd = { x: currentX, y: currentY };
                this.redraw();
                return;
            }

            if (this.isDragging) {
                const dx = currentX - this.lastMouseX;
                const dy = currentY - this.lastMouseY;
                this.panX += dx;
                this.panY += dy;
                this.lastMouseX = currentX;
                this.lastMouseY = currentY;
                this.redraw();
                return;
            }

            this.lastMouseX = currentX;
            this.lastMouseY = currentY;

            if (this.currentTool === 'line' || this.currentTool === 'rect' || this.currentTool === 'round-rect') {
                this.redraw(); // За преглед при движение (preview)
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
                
                const points = (this.activePathIdx !== -1) ? this.paths[this.activePathIdx] : null;

                if (this.currentTool === 'select') {
                    this.selectedPaths.forEach(pIdx => {
                        const pts = this.paths[pIdx];
                        if (pts) {
                            pts.forEach(pt => { pt.x += dx; pt.y += dy; });
                        }
                    });
                } else if (this.currentTool === 'node-edit' && points) {
                    this.selectedNodes.forEach(idx => {
                        points[idx].x += dx;
                        points[idx].y += dy;
                    });
                } else if (this.currentTool === 'segment-edit' && points) {
                    const movedIndices = new Set();
                    this.selectedSegments.forEach(idx => {
                        const prevIdx = (idx - 1 + points.length) % points.length;
                        if (!movedIndices.has(idx)) {
                            points[idx].x += dx;
                            points[idx].y += dy;
                            movedIndices.add(idx);
                        }
                        if (!movedIndices.has(prevIdx)) {
                            points[prevIdx].x += dx;
                            points[prevIdx].y += dy;
                            movedIndices.add(prevIdx);
                        }
                    });
                }
                
                this.lastDragX = potraceX;
                this.lastDragY = potraceY;
                
                // Предаваме списък с фиксирани (влачени) точки на солвъра
                const fixed = [];
                if (this.currentTool === 'node-edit' && points) {
                    this.selectedNodes.forEach(idx => fixed.push({ pathIdx: this.activePathIdx, nodeIdx: idx }));
                } else if (this.currentTool === 'segment-edit' && this.activePathIdx !== -1) {
                    this.selectedSegments.forEach(idx => {
                        const prevIdx = (idx - 1 + points.length) % points.length;
                        fixed.push({ pathIdx: this.activePathIdx, nodeIdx: idx });
                        fixed.push({ pathIdx: this.activePathIdx, nodeIdx: prevIdx });
                    });
                } else if (this.currentTool === 'select') {
                    this.selectedPaths.forEach(pIdx => {
                        const pts = this.paths[pIdx];
                        pts.forEach((pt, idx) => fixed.push({ pathIdx: pIdx, nodeIdx: idx }));
                    });
                }
                
                this.solve(fixed);
                this.redraw();
                return;
            }

            if (this.currentTool === 'line' || this.currentTool === 'rect' || this.currentTool === 'round-rect') {
                this.redraw(); // За преглед при движение (preview)
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
            
            // Завършване на чертане (Rect / Round-Rect)
            if ((this.currentTool === 'rect' || this.currentTool === 'round-rect') && this.drawStartPt) {
                const rect = this.canvas.getBoundingClientRect();
                const s = this.imgScale * this.userZoom;
                const imgW = (this.bgImage.complete && this.bgImage.width > 0) ? this.bgImage.width : 100;
                const imgH = (this.bgImage.complete && this.bgImage.height > 0) ? this.bgImage.height : 100;
                const offsetX = (this.canvas.width - imgW * s) / 2 + this.panX;
                const offsetY = (this.canvas.height - imgH * s) / 2 + this.panY;
                const endPt = {
                    x: (e.clientX - rect.left - offsetX) / s,
                    y: (e.clientY - rect.top - offsetY) / s
                };

                if (Math.hypot(endPt.x - this.drawStartPt.x, endPt.y - this.drawStartPt.y) > 2) {
                    this.saveState();
                    if (this.currentTool === 'rect') {
                        const pathIdx = this.paths.length;
                        this.paths.push([
                            { x: this.drawStartPt.x, y: this.drawStartPt.y },
                            { x: endPt.x, y: this.drawStartPt.y },
                            { x: endPt.x, y: endPt.y },
                            { x: this.drawStartPt.x, y: endPt.y }
                        ]);
                        this.addRelation({ type: 'vertical', pathIdx, segIdx: 0 });
                        this.addRelation({ type: 'horizontal', pathIdx, segIdx: 1 });
                        this.addRelation({ type: 'vertical', pathIdx, segIdx: 2 });
                        this.addRelation({ type: 'horizontal', pathIdx, segIdx: 3 });
                    } else {
                        const pathIdx = this.paths.length;
                        this.paths.push(this.createRoundRectPoints(this.drawStartPt.x, this.drawStartPt.y, endPt.x, endPt.y));
                        this.addRelation({ type: 'horizontal', pathIdx, segIdx: 0 });
                        this.addRelation({ type: 'vertical', pathIdx, segIdx: 2 });
                        this.addRelation({ type: 'horizontal', pathIdx, segIdx: 4 });
                        this.addRelation({ type: 'vertical', pathIdx, segIdx: 6 });
                    }
                }
                this.drawStartPt = null;
                
                // Връщаме се към активаната селекция, ако е била натисната
                const selectionGroup = ['select', 'segment-edit', 'node-edit'];
                const activeSelection = selectionGroup.find(t => document.getElementById('ui-geo-' + t)?.classList.contains('active'));
                if (activeSelection) this.currentTool = activeSelection;
                
                this.redraw();
            }

            // Проверка за сближаване на крайни точки (Line Tool)
            if (this.currentTool === 'line' && this.currentPoints.length > 2) {
                const lastIdx = this.currentPoints.length - 1;
                const lastPt = this.currentPoints[lastIdx];
                const s = this.imgScale * this.userZoom;
                const SNAP_THRESHOLD_WORLD = 15 / s;

                let foundOther = null;
                for (let pIdx = 0; pIdx < this.paths.length; pIdx++) {
                    const pts = this.paths[pIdx];
                    const isOpen = pts[0].isClosed === false;
                    if (!isOpen) continue;
                    
                    const endpoints = [0, pts.length - 1];
                    for (const eIdx of endpoints) {
                        const dist = Math.hypot(pts[eIdx].x - lastPt.x, pts[eIdx].y - lastPt.y);
                        if (dist <= SNAP_THRESHOLD_WORLD) {
                            foundOther = { pathIdx: pIdx, nodeIdx: eIdx };
                            break;
                        }
                    }
                    if (foundOther) break;
                }
                // Проверка и към собственото начало (closing the loop)
                const distToStart = Math.hypot(this.currentPoints[0].x - lastPt.x, this.currentPoints[0].y - lastPt.y);
                if (!foundOther && distToStart <= SNAP_THRESHOLD_WORLD) {
                    foundOther = { pathIdx: -1, nodeIdx: 0 }; // Special marker for self-closing
                }

                if (foundOther) {
                    this.showConnectDialog(() => {
                        this.saveState();
                        if (foundOther.pathIdx === -1) {
                            // Self closing
                            delete this.currentPoints[0].isClosed;
                            this.paths.push(this.currentPoints);
                        } else {
                            // Join with other
                            const pathB = this.paths[foundOther.pathIdx];
                            let a = [...this.currentPoints];
                            let b = [...pathB];
                            if (foundOther.nodeIdx === b.length - 1) b.reverse();
                            const joined = a.concat(b.slice(1));
                            joined[0].isClosed = false;
                            this.paths[foundOther.pathIdx] = joined;
                        }
                        this.currentPoints = [];
                        
                        // Връщаме се към активаната селекция
                        const selectionGroup = ['select', 'segment-edit', 'node-edit'];
                        const activeSelection = selectionGroup.find(t => document.getElementById('ui-geo-' + t)?.classList.contains('active'));
                        if (activeSelection) this.currentTool = activeSelection;

                        this.redraw();
                    });
                }
            }

            // Проверка за сближаване на крайни точки след влачене (Node Edit)
            if (this.dragTarget && this.dragTarget.type === 'node' &&
                this.currentTool === 'node-edit' && this.activePathIdx !== -1) {
                
                const activePoints = this.paths[this.activePathIdx];
                const draggedNodeIdx = this.dragTarget.nodeIdx;
                const isOpen = activePoints[0].isClosed === false;
                const isStartNode = draggedNodeIdx === 0;
                const isEndNode = draggedNodeIdx === activePoints.length - 1;
                const isDraggedEndpoint = isOpen && (isStartNode || isEndNode);
                
                if (isDraggedEndpoint) {
                    const s = this.imgScale * this.userZoom;
                    const SNAP_THRESHOLD_PX = 15;
                    const SNAP_THRESHOLD_WORLD = SNAP_THRESHOLD_PX / s;
                    
                    const draggedPt = activePoints[draggedNodeIdx];
                    let foundOther = null;
                    
                    for (let pIdx = 0; pIdx < this.paths.length; pIdx++) {
                        const pts = this.paths[pIdx];
                        if (!pts || pts.length < 1) continue;
                        const otherIsOpen = (pIdx !== this.activePathIdx) ? pts[0].isClosed === false : true;
                        if (!otherIsOpen) continue;
                        
                        const endpointIndices = [];
                        if (pIdx === this.activePathIdx) {
                            // Същия контур – проверяваме дали крайната точка е близо до отсрещния край на същия път
                            if (draggedNodeIdx === 0 && pts.length > 1) endpointIndices.push(pts.length - 1);
                            else if (draggedNodeIdx === pts.length - 1 && pts.length > 1) endpointIndices.push(0);
                        } else {
                            // Друг отворен контур
                            endpointIndices.push(0, pts.length - 1);
                        }
                        
                        for (const eIdx of endpointIndices) {
                            const ep = pts[eIdx];
                            const dist = Math.hypot(ep.x - draggedPt.x, ep.y - draggedPt.y);
                            if (dist <= SNAP_THRESHOLD_WORLD) {
                                foundOther = { pathIdx: pIdx, nodeIdx: eIdx };
                                break;
                            }
                        }
                        if (foundOther) break;
                    }
                    
                    if (foundOther) {
                        this.showConnectDialog(() => {
                            this.executeJoin(
                                this.activePathIdx, draggedNodeIdx,
                                foundOther.pathIdx, foundOther.nodeIdx
                            );
                        });
                    }
                }
            }
            
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
    },

    showConnectDialog: function(onYes) {
        const dialog = document.getElementById('ui-connect-dialog');
        if (!dialog) { if (onYes) onYes(); return; }
        dialog.style.display = 'flex';
        
        const btnYes = document.getElementById('ui-btn-yes');
        const btnNo  = document.getElementById('ui-btn-no');
        
        const cleanup = () => { dialog.style.display = 'none'; btnYes.onclick = null; btnNo.onclick = null; };
        btnYes.onclick = () => { cleanup(); if (onYes) onYes(); };
        btnNo.onclick  = () => { cleanup(); this.redraw(); };
    },

    executeJoin: function(pathAIdx, nodeAIdx, pathBIdx, nodeBIdx) {
        this.saveState();
        
        const pathA = this.paths[pathAIdx];
        const pathB = this.paths[pathBIdx];
        if (!pathA || !pathB) return;
        
        // Същия път – затваряме контура
        if (pathAIdx === pathBIdx) {
            delete pathA[0].isClosed; // изтриваме отворения признак – става затворен
            this.selectedNodes = [];
            this.redraw();
            return;
        }
        
        // Реаранжираме така, че nodeA да е краят (last) на A, а nodeB да е началото (0) на B
        let a = [...pathA];
        let b = [...pathB];
        
        // Ако влачената точка е началото (0) на A, объръщаме A
        if (nodeAIdx === 0) a = a.reverse();
        // Ако закачваната точка е краят (last) на B, объръщаме B
        if (nodeBIdx === b.length - 1) b = b.reverse();
        
        // Свързваме: A (всички точки) + B (без първата, която е дубликат)
        const joined = a.concat(b.slice(1));
        // Понеже резултатът е отворен контур, маркираме isOpen
        joined[0].isClosed = false;
        
        // Заменяме A със слютия масив и изтриваме B
        this.paths[pathAIdx] = joined;
        // Изтриваме B (from the end to not disturb A's index)
        const bIdxToRemove = pathBIdx > pathAIdx ? pathBIdx : pathBIdx;
        this.paths.splice(bIdxToRemove, 1);
        
        this.activePathIdx = pathAIdx < bIdxToRemove ? pathAIdx : Math.max(0, pathAIdx - 1);
        this.selectedNodes = [];
        this.redraw();
    }
};

function setTool(tool) {
    GraphicsManager.currentTool = tool;
    
    // Дефинираме групи инструменти
    const selectionGroup = ['select', 'segment-edit', 'node-edit'];
    const geometryGroup = ['line', 'rect', 'round-rect', 'mirror'];
    
    if (selectionGroup.includes(tool)) {
        selectionGroup.forEach(t => document.getElementById('ui-geo-' + t)?.classList.remove('active'));
    } else if (geometryGroup.includes(tool)) {
        geometryGroup.forEach(t => document.getElementById('ui-geo-' + t)?.classList.remove('active'));
    }
    
    const activeBtn = document.getElementById('ui-geo-' + tool);
    if (activeBtn) activeBtn.classList.add('active');

    // Управление на бутоните за връзки (Relations)
    const relationsGroup = ['horizontal', 'vertical', 'equal', 'parallel', 'collinear'];
    relationsGroup.forEach(t => {
        const btn = document.getElementById('ui-rel-' + t);
        if (btn) {
            if (tool === 'segment-edit') {
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
                btn.style.filter = "none";
            } else {
                btn.style.opacity = "0.3";
                btn.style.pointerEvents = "none";
                btn.style.filter = "grayscale(1)";
            }
        }
    });

    // Трансформация на селектирани обекти
    if (GraphicsManager.selectedPaths.length > 0) {
        let transformed = false;
        if (tool === 'rect') {
            GraphicsManager.executeTransformToRect();
            transformed = true;
        } else if (tool === 'round-rect') {
            GraphicsManager.executeTransformToRoundRect();
            transformed = true;
        }
        
        // Управление на бутоните за подравняване (Alignment)
    const alignGroup = ['left', 'center', 'right', 'top', 'middle', 'bottom'];
    alignGroup.forEach(t => {
        const btn = document.getElementById('ui-align-' + t);
        if (btn) {
            if (tool === 'select') {
                btn.style.opacity = "1";
                btn.style.pointerEvents = "auto";
                btn.style.filter = "none";
            } else {
                btn.style.opacity = "0.3";
                btn.style.pointerEvents = "none";
                btn.style.filter = "grayscale(1)";
            }
        }
    });

    if (transformed) {
            // Връщаме се към последната селекция
            const geometryGroup = ['line', 'rect', 'round-rect', 'mirror'];
            geometryGroup.forEach(t => document.getElementById('ui-geo-' + t)?.classList.remove('active'));
            
            const selectionGroup = ['select', 'segment-edit', 'node-edit'];
            const activeSelection = selectionGroup.find(t => document.getElementById('ui-geo-' + t)?.classList.contains('active'));
            if (activeSelection) GraphicsManager.currentTool = activeSelection;
        }
    }
}

GraphicsManager.executeTransformToRect = function() {
    this.saveState();
    this.selectedPaths.forEach(pIdx => {
        const points = this.paths[pIdx];
        if (!points) return;
        const bbox = this.getBBox(points);
        this.paths[pIdx] = [
            { x: bbox.minX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.minY },
            { x: bbox.maxX, y: bbox.maxY },
            { x: bbox.minX, y: bbox.maxY }
        ];
        this.addRelation({ type: 'vertical', pathIdx: pIdx, segIdx: 0 });
        this.addRelation({ type: 'horizontal', pathIdx: pIdx, segIdx: 1 });
        this.addRelation({ type: 'vertical', pathIdx: pIdx, segIdx: 2 });
        this.addRelation({ type: 'horizontal', pathIdx: pIdx, segIdx: 3 });
    });
    this.redraw();
};

GraphicsManager.executeTransformToRoundRect = function() {
    this.saveState();
    this.selectedPaths.forEach(pIdx => {
        const points = this.paths[pIdx];
        if (!points) return;
        const bbox = this.getBBox(points);
        this.paths[pIdx] = this.createRoundRectPoints(bbox.minX, bbox.minY, bbox.maxX, bbox.maxY);
        this.addRelation({ type: 'horizontal', pathIdx: pIdx, segIdx: 0 });
        this.addRelation({ type: 'vertical', pathIdx: pIdx, segIdx: 2 });
        this.addRelation({ type: 'horizontal', pathIdx: pIdx, segIdx: 4 });
        this.addRelation({ type: 'vertical', pathIdx: pIdx, segIdx: 6 });
    });
    this.redraw();
};

GraphicsManager.createRoundRectPoints = function(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);
    const w = maxX - minX;
    const h = maxY - minY;
    const minSize = Math.min(w, h);
    
    let r = 5;
    let steps = 2; // две равни линии (chamfer)
    if (minSize < 15) {
        r = 2;
        steps = 1;
    }

    const pts = [];
    // Горна дясна крива
    if (steps === 2) {
        pts.push({ x: maxX - r, y: minY }, { x: maxX, y: minY + r });
        pts.push({ x: maxX, y: maxY - r }, { x: maxX - r, y: maxY });
        pts.push({ x: minX + r, y: maxY }, { x: minX, y: maxY - r });
        pts.push({ x: minX, y: minY + r }, { x: minX + r, y: minY });
    } else {
        pts.push({ x: maxX - r, y: minY }, { x: maxX, y: minY + r });
        pts.push({ x: maxX, y: maxY - r }, { x: maxX - r, y: maxY });
        pts.push({ x: minX + r, y: maxY }, { x: minX, y: maxY - r });
        pts.push({ x: minX, y: minY + r }, { x: minX + r, y: minY });
    }
    // Затваряме го по подразбиране (undefined isClosed)
    return pts;
};

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
function applyRelation(type) {
    GraphicsManager.applyRelation(type);
}

GraphicsManager.applyRelation = function(type) {
    if (this.currentTool !== 'segment-edit' || this.activePathIdx === -1 || this.selectedSegments.length === 0) {
        return;
    }
    this.saveState();
    const points = this.paths[this.activePathIdx];
    const n = points.length;

    if (type === 'horizontal' || type === 'vertical') {
        this.selectedSegments.forEach(segIdx => {
            const p2 = points[segIdx];
            const p1 = points[(segIdx - 1 + n) % n];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);
            let deg = Math.abs(angle * 180 / Math.PI);
            if (deg > 180) deg = 360 - deg;
            
            let canApply = false;
            let targetAngle = 0;

            if (type === 'horizontal') {
                const diff = Math.min(deg, Math.abs(180 - deg));
                if (diff < 70) {
                    canApply = true;
                    targetAngle = (deg > 90) ? Math.PI : 0;
                }
            } else {
                const diff = Math.min(Math.abs(90 - deg), Math.abs(270 - deg));
                if (diff < 70) {
                    canApply = true;
                    targetAngle = (angle > 0) ? Math.PI / 2 : -Math.PI / 2;
                }
            }

            if (canApply) {
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const len = Math.hypot(dx, dy);
                
                // Rotates around midpoint
                p1.x = midX - Math.cos(targetAngle) * len / 2;
                p1.y = midY - Math.sin(targetAngle) * len / 2;
                p2.x = midX + Math.cos(targetAngle) * len / 2;
                p2.y = midY + Math.sin(targetAngle) * len / 2;

                this.addRelation({ type, pathIdx: this.activePathIdx, segIdx });
            }
        });
    } else if (type === 'equal' || type === 'parallel' || type === 'collinear') {
        if (this.selectedSegments.length < 2) return;
        const refSegIdx = this.selectedSegments[0];
        const refP2 = points[refSegIdx];
        const refP1 = points[(refSegIdx - 1 + n) % n];
        const refLen = Math.hypot(refP2.x - refP1.x, refP2.y - refP1.y);
        const refAngle = Math.atan2(refP2.y - refP1.y, refP2.x - refP1.x);

        for (let i = 1; i < this.selectedSegments.length; i++) {
            const segIdx = this.selectedSegments[i];
            const p2 = points[segIdx];
            const p1 = points[(segIdx - 1 + n) % n];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            let currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            let currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

            if (type === 'equal') currentLen = refLen;
            if (type === 'parallel' || type === 'collinear') currentAngle = refAngle;

            if (type === 'collinear') {
                // Project midpoint onto the line of reference segment
                const dRefX = refP2.x - refP1.x;
                const dRefY = refP2.y - refP1.y;
                const refMag2 = dRefX * dRefX + dRefY * dRefY;
                const u = ((midX - refP1.x) * dRefX + (midY - refP1.y) * dRefY) / refMag2;
                const projX = refP1.x + u * dRefX;
                const projY = refP1.y + u * dRefY;
                
                p1.x = projX - Math.cos(refAngle) * currentLen / 2;
                p1.y = projY - Math.sin(refAngle) * currentLen / 2;
                p2.x = projX + Math.cos(refAngle) * currentLen / 2;
                p2.y = projY + Math.sin(refAngle) * currentLen / 2;
            } else {
                p1.x = midX - Math.cos(currentAngle) * currentLen / 2;
                p1.y = midY - Math.sin(currentAngle) * currentLen / 2;
                p2.x = midX + Math.cos(currentAngle) * currentLen / 2;
                p2.y = midY + Math.sin(currentAngle) * currentLen / 2;
            }
            this.addRelation({ type, pathIdx: this.activePathIdx, segIdx, targetSegIdx: refSegIdx });
        }
    }
    this.redraw();
};

GraphicsManager.addRelation = function(rel) {
    // Проверка за съществуваща връзка (включително и огледална за симетрични типове)
    const exists = this.relations.find(r => {
        if (r.type !== rel.type) return false;
        if (r.pathIdx !== rel.pathIdx) return false;
        
        // За H/V проверяваме директно
        if (rel.type === 'horizontal' || rel.type === 'vertical') {
            return r.segIdx === rel.segIdx;
        }
        
        // За Equal, Parallel и Collinear проверяваме и двете посоки (A-B и B-A)
        return (r.segIdx === rel.segIdx && r.targetSegIdx === rel.targetSegIdx) ||
               (r.segIdx === rel.targetSegIdx && r.targetSegIdx === rel.segIdx);
    });
    if (!exists) this.relations.push(rel);
};

GraphicsManager.solve = function(fixed = []) {
    // Подобрен солвър, който зачита фиксираните (влачени) точки
    for (let iter = 0; iter < 5; iter++) {
        let changed = false;
        this.relations.forEach(rel => {
            const points = this.paths[rel.pathIdx];
            if (!points) return;
            const n = points.length;
            const p2Idx = rel.segIdx;
            const p1Idx = (rel.segIdx - 1 + n) % n;
            const p2 = points[p2Idx];
            const p1 = points[p1Idx];
            
            const isP1Fixed = fixed.some(f => f.pathIdx === rel.pathIdx && f.nodeIdx === p1Idx);
            const isP2Fixed = fixed.some(f => f.pathIdx === rel.pathIdx && f.nodeIdx === p2Idx);

            if (rel.type === 'horizontal') {
                if (Math.abs(p1.y - p2.y) > 0.01) {
                    if (isP1Fixed && !isP2Fixed) p2.y = p1.y;
                    else if (!isP1Fixed && isP2Fixed) p1.y = p2.y;
                    else if (!isP1Fixed && !isP2Fixed) {
                        const midY = (p1.y + p2.y) / 2;
                        p1.y = p2.y = midY;
                    }
                    changed = true;
                }
            } else if (rel.type === 'vertical') {
                if (Math.abs(p1.x - p2.x) > 0.01) {
                    if (isP1Fixed && !isP2Fixed) p2.x = p1.x;
                    else if (!isP1Fixed && isP2Fixed) p1.x = p2.x;
                    else if (!isP1Fixed && !isP2Fixed) {
                        const midX = (p1.x + p2.x) / 2;
                        p1.x = p2.x = midX;
                    }
                    changed = true;
                }
            } else if (rel.type === 'equal') {
                const tp = this.paths[rel.pathIdx];
                const tp2Idx = rel.targetSegIdx;
                const tp1Idx = (tp2Idx - 1 + tp.length) % tp.length;
                const tp2 = tp[tp2Idx];
                const tp1 = tp[tp1Idx];
                
                const targetLen = Math.hypot(tp2.x - tp1.x, tp2.y - tp1.y);
                const currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                if (Math.abs(currentLen - targetLen) > 0.01) {
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                    
                    if (isP1Fixed && !isP2Fixed) {
                        p2.x = p1.x + Math.cos(angle) * targetLen;
                        p2.y = p1.y + Math.sin(angle) * targetLen;
                    } else if (!isP1Fixed && isP2Fixed) {
                        p1.x = p2.x - Math.cos(angle) * targetLen;
                        p1.y = p2.y - Math.sin(angle) * targetLen;
                    } else if (!isP1Fixed && !isP2Fixed) {
                        p1.x = midX - Math.cos(angle) * targetLen / 2;
                        p1.y = midY - Math.sin(angle) * targetLen / 2;
                        p2.x = midX + Math.cos(angle) * targetLen / 2;
                        p2.y = midY + Math.sin(angle) * targetLen / 2;
                    }
                    changed = true;
                }
            } else if (rel.type === 'parallel' || rel.type === 'collinear') {
                const tp = this.paths[rel.pathIdx];
                const tp2 = tp[rel.targetSegIdx];
                const tp1 = tp[(rel.targetSegIdx - 1 + tp.length) % tp.length];
                const targetAngle = Math.atan2(tp2.y - tp1.y, tp2.x - tp1.x);
                const currentAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                
                if (Math.abs(currentAngle - targetAngle) > 0.001) {
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    if (isP1Fixed && !isP2Fixed) {
                        p2.x = p1.x + Math.cos(targetAngle) * currentLen;
                        p2.y = p1.y + Math.sin(targetAngle) * currentLen;
                    } else if (!isP1Fixed && isP2Fixed) {
                        p1.x = p2.x - Math.cos(targetAngle) * currentLen;
                        p1.y = p2.y - Math.sin(targetAngle) * currentLen;
                    } else {
                        p1.x = midX - Math.cos(targetAngle) * currentLen / 2;
                        p1.y = midY - Math.sin(targetAngle) * currentLen / 2;
                        p2.x = midX + Math.cos(targetAngle) * currentLen / 2;
                        p2.y = midY + Math.sin(targetAngle) * currentLen / 2;
                    }
                    changed = true;
                }
                if (rel.type === 'collinear') {
                     const dRefX = tp2.x - tp1.x;
                     const dRefY = tp2.y - tp1.y;
                     const refMag2 = dRefX * dRefX + dRefY * dRefY;
                     const u = ((midX - tp1.x) * dRefX + (midY - tp1.y) * dRefY) / refMag2;
                     const projX = tp1.x + u * dRefX;
                     const projY = tp1.y + u * dRefY;
                     
                     if (isP1Fixed && !isP2Fixed) {
                         p2.x = projX + (p2.x > p1.x ? currentLen : -currentLen) / 2; // Rough fix
                         p2.y = projY + (p2.y > p1.y ? currentLen : -currentLen) / 2;
                     } // TODO: better collinear solve
                }
            }
        });
        if (!changed) break;
    }
};

GraphicsManager.align = function(type) {
    if (this.currentTool !== 'select' || this.selectedPaths.length < 2) return;
    
    this.saveState();
    
    // Последният селектиран обект е референтен
    const refPathIdx = this.selectedPaths[this.selectedPaths.length - 1];
    const refPoints = this.paths[refPathIdx];
    const refBBox = this.getBBox(refPoints);
    const refMidX = (refBBox.minX + refBBox.maxX) / 2;
    const refMidY = (refBBox.minY + refBBox.maxY) / 2;
    
    // Всички останали се подравняват спрямо него
    for (let i = 0; i < this.selectedPaths.length - 1; i++) {
        const pIdx = this.selectedPaths[i];
        const points = this.paths[pIdx];
        const bbox = this.getBBox(points);
        const midX = (bbox.minX + bbox.maxX) / 2;
        const midY = (bbox.minY + bbox.maxY) / 2;
        
        let dx = 0;
        let dy = 0;
        
        switch(type) {
            case 'left':   dx = refBBox.minX - bbox.minX; break;
            case 'center': dx = refMidX - midX; break;
            case 'right':  dx = refBBox.maxX - bbox.maxX; break;
            case 'top':    dy = refBBox.minY - bbox.minY; break;
            case 'middle': dy = refMidY - midY; break;
            case 'bottom': dy = refBBox.maxY - bbox.maxY; break;
        }
        
        if (dx !== 0 || dy !== 0) {
            points.forEach(p => {
                p.x += dx;
                p.y += dy;
            });
        }
    }
    
    // Връзките трябва да се актуализират (ако има такива между различните обекти)
    this.solve();
    this.redraw();
};

GraphicsManager.getSegmentRelations = function(pathIdx) {
    const res = {};
    this.relations.forEach(r => {
        // Проверяваме дали текущият път притежава единия или другия сегмент от връзката
        if (r.pathIdx === pathIdx) {
            if (!res[r.segIdx]) res[r.segIdx] = [];
            if (!res[r.segIdx].includes(r)) res[r.segIdx].push(r);
            
            // Визуализираме и на референтния (втория) сегмент за релационни типове
            if (r.targetSegIdx !== undefined) {
                if (!res[r.targetSegIdx]) res[r.targetSegIdx] = [];
                if (!res[r.targetSegIdx].includes(r)) res[r.targetSegIdx].push(r);
            }
        }
    });
    return res;
};

GraphicsManager.getSegmentMidpoint = function(pathIdx, segIdx) {
    const points = this.paths[pathIdx];
    const n = points.length;
    const p2 = points[segIdx];
    const p1 = points[(segIdx - 1 + n) % n];
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
};

GraphicsManager.renderRelations = function() {
    if (this.currentTool !== 'segment-edit' || this.activePathIdx === -1) return;
    
    const rels = this.getSegmentRelations(this.activePathIdx);
    const size = 16 / (this.imgScale * this.userZoom);
    const gap = 4 / (this.imgScale * this.userZoom);
    
    for (const [segIdx, list] of Object.entries(rels)) {
        const sIdx = parseInt(segIdx);
        const pos = this.getSegmentMidpoint(this.activePathIdx, sIdx);
        
        list.forEach((rel, i) => {
            const rx = pos.x + (i * (size + gap));
            const ry = pos.y + 10 / (this.imgScale * this.userZoom);
            
            this.ctx.save();
            this.ctx.fillStyle = "yellow";
            this.ctx.strokeStyle = (this.selectedRelation === rel) ? "red" : "black";
            this.ctx.lineWidth = 1 / (this.imgScale * this.userZoom);
            
            this.ctx.beginPath();
            this.ctx.rect(rx - size/2, ry - size/2, size, size);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Draw Icon
            this.ctx.strokeStyle = "black";
            this.ctx.beginPath();
            const iconSize = size * 0.6;
            if (rel.type === 'horizontal') {
                this.ctx.moveTo(rx - iconSize/2, ry);
                this.ctx.lineTo(rx + iconSize/2, ry);
            } else if (rel.type === 'vertical') {
                this.ctx.moveTo(rx, ry - iconSize/2);
                this.ctx.lineTo(rx, ry + iconSize/2);
            } else if (rel.type === 'equal') {
                this.ctx.moveTo(rx - iconSize/2, ry - 2);
                this.ctx.lineTo(rx + iconSize/2, ry - 2);
                this.ctx.moveTo(rx - iconSize/2, ry + 2);
                this.ctx.lineTo(rx + iconSize/2, ry + 2);
            } else if (rel.type === 'parallel') {
                this.ctx.moveTo(rx - 2, ry - iconSize/2);
                this.ctx.lineTo(rx + 2, ry + iconSize/2);
                this.ctx.moveTo(rx - 6, ry - iconSize/2);
                this.ctx.lineTo(rx - 2, ry + iconSize/2);
            } else if (rel.type === 'collinear') {
                this.ctx.setLineDash([2 / (this.imgScale * this.userZoom)]);
                this.ctx.moveTo(rx - iconSize/2, ry);
                this.ctx.lineTo(rx + iconSize/2, ry);
            }
            this.ctx.stroke();
            this.ctx.restore();
        });
    }
};

window.addEventListener('load', () => GraphicsManager.init());