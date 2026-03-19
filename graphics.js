/**
 * Aesthetic Solver - Графичен модул (graphics.js)
 */

const GraphicsManager = {
    canvas: null,
    ctx: null,
    bgImage: new Image(),
    imgOpacity: 0.5,
    
    points: [], 
    lines: [],  
    
    // Настройки на алгоритъма
    threshold: 110,      // Праг за черно/бяло
    searchRadius: 3,     // Радиус на търсене (според статията)
    simplifyTol: 1.5,    // Толеранс за опростяване (Douglas-Peucker)

    init: function() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.attachListeners();
    },

    resize: function() {
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper) return;
        this.canvas.width = wrapper.clientWidth;
        this.canvas.height = wrapper.clientHeight;
    },

    // 1. ПОДГОТОВКА: Превръщане в черно-бяла матрица
    getBinaryMatrix: function() {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        tempCtx.drawImage(this.bgImage, 0, 0, tempCanvas.width, tempCanvas.height);

        const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imgData.data;
        const matrix = new Uint8Array(tempCanvas.width * tempCanvas.height);

        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
            matrix[i / 4] = brightness < this.threshold ? 1 : 0;
        }
        return { matrix, width: tempCanvas.width, height: tempCanvas.height };
    },

    // 2. ВЕКТОРИЗИРАНЕ: Проследяване на пиксели
    runAutoVectorization: function() {
        if (!this.bgImage.src) return;
        const { matrix, width, height } = this.getBinaryMatrix();
        const visited = new Uint8Array(matrix.length);
        const allLines = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                // Ако намерим черен пиксел, който не е посетен
                if (matrix[idx] === 1 && !visited[idx]) {
                    const path = this.tracePath(x, y, matrix, visited, width, height);
                    if (path.length > 5) { // Игнорираме прекалено малки шумови точки
                        const simplified = this.douglasPeucker(path, this.simplifyTol);
                        this.addAsVectorLines(simplified, allLines);
                    }
                }
            }
        }
        this.lines = allLines;
        this.rebuildPoints();
        this.render();
    },

    tracePath: function(startX, startY, matrix, visited, width, height) {
        const path = [];
        let cx = startX;
        let cy = startY;

        while (true) {
            path.push({ x: cx, y: cy });
            visited[cy * width + cx] = 1;

            let foundNext = false;
            // Търсене в радиус (от 1 до searchRadius)
            for (let r = 1; r <= this.searchRadius; r++) {
                for (let dy = -r; dy <= r; dy++) {
                    for (let dx = -r; dx <= r; dx++) {
                        const nx = cx + dx;
                        const ny = cy + dy;
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = ny * width + nx;
                            if (matrix[nIdx] === 1 && !visited[nIdx]) {
                                cx = nx;
                                cy = ny;
                                foundNext = true;
                                break;
                            }
                        }
                    }
                    if (foundNext) break;
                }
                if (foundNext) break;
            }
            if (!foundNext) break;
        }
        return path;
    },

    // 3. ОПРОСТЯВАНЕ: Douglas-Peucker (Твоят SimplifyInt2D)
    douglasPeucker: function(points, tolerance) {
        if (points.length <= 2) return points;

        let dmax = 0;
        let index = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const d = this.distToSegment(points[i], points[0], points[end]);
            if (d > dmax) {
                index = i;
                dmax = d;
            }
        }

        if (dmax > tolerance) {
            const res1 = this.douglasPeucker(points.slice(0, index + 1), tolerance);
            const res2 = this.douglasPeucker(points.slice(index), tolerance);
            return res1.slice(0, res1.length - 1).concat(res2);
        } else {
            return [points[0], points[end]];
        }
    },

    distToSegment: function(p, a, b) {
        const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
        if (l2 === 0) return Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.sqrt(Math.pow(p.x - (a.x + t * (b.x - a.x)), 2) + Math.pow(p.y - (a.y + t * (b.y - a.y)), 2));
    },

    addAsVectorLines: function(points, targetArray) {
        for (let i = 0; i < points.length - 1; i++) {
            targetArray.push({
                p1: { x: points[i].x, y: points[i].y },
                p2: { x: points[i + 1].x, y: points[i + 1].y },
                id: Math.random()
            });
        }
    },

    rebuildPoints: function() {
        this.points = [];
        const seen = new Set();
        this.lines.forEach(l => {
            [l.p1, l.p2].forEach(p => {
                const key = `${p.x},${p.y}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    this.points.push({ ...p, id: Math.random() });
                }
            });
        });
    },

    render: function() {
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

        this.ctx.fillStyle = "#ff4444";
        this.points.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        });
    },

    attachListeners: function() {
        document.getElementById('imgUpload').addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (f) => {
                this.bgImage.onload = () => {
                    this.canvas.width = this.bgImage.naturalWidth; // Ползваме реалния размер
                    this.canvas.height = this.bgImage.naturalHeight;
                    this.runAutoVectorization();
                };
                this.bgImage.src = f.target.result;
            };
            if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
        });
    }
};

window.addEventListener('load', () => GraphicsManager.init());