/**
 * Nominal Analysis & Aesthetic Harmonization Module (Hierarchical)
 */

const NominalManager = {
    nominalValue: 0,
    nominalUnit: 'mm',
    nominalType: 'width', 
    pxToUnitRatio: 1,
    answers: {},
    preferredSeries: [],
    isSplitView: false,
    originalPaths: [],
    _redrawInjected: false,
    harmonyScore: 0,

    fallbackBG: {
        "ui-quest-sec-1": "6.1. Основна информация и контекст",
        "ui-q1": "Какъв е произходът на обекта?",
        "ui-q1-o1": "Природен", "ui-q1-o2": "Създаден от човека",
        "ui-q2": "Какво е първоначалното визуално впечатление?",
        "ui-q2-o1": "Подчертано хармоничен", "ui-q2-o2": "По-скоро неутрален", "ui-q2-o3": "Дисхармоничен, 'грозен'",
        "ui-q3": "Каква е основната цел на анализа?",
        "ui-q3-o1": "Доказване на налична хармония", "ui-q3-o2": "Откриване на причина за дисхармония", "ui-q3-o3": "Корекция на формата",
        "ui-quest-sec-2": "6.2. Доминиращи размери и модулност",
        "ui-q4": "Има ли ясно изразен доминиращ размер (Номинал)?",
        "ui-q4-o1": "Да, височина", "ui-q4-o2": "Да, ширина", "ui-q4-o3": "Да, диагонал", "ui-q4-o4": "Не се откроява",
        "ui-q5": "Забелязва ли се базов модул (повтарящ се минимален размер)?",
        "ui-q5-o1": "Да, ясно изразен", "ui-q5-o2": "По-скоро не",
        "ui-q6": "Обектът вписва ли се в проста обграждаща рамка (bounding box)?",
        "ui-q6-o1": "Квадрат", "ui-q6-o2": "Правоъгълник", "ui-q6-o3": "Стандартен правоъгълник", "ui-q6-o4": "Кръг", "ui-q6-o5": "Друго",
        "ui-quest-sec-3": "6.3. Симетрия и баланс",
        "ui-q7": "Налична ли е ос на симетрия в основния контур?",
        "ui-q7-o1": "Да, вертикална", "ui-q7-o2": "Да, хоризонтална", "ui-q7-o3": "Да, множество оси", "ui-q7-o4": "Не",
        "ui-q8": "Има ли радиална (центрова) симетрия?",
        "ui-q8-o1": "Да", "ui-q8-o2": "Не",
        "ui-q9": "Какъв е визуалният баланс на вътрешните елементи?",
        "ui-q9-o1": "Напълно симетричен", "ui-q9-o2": "Асиметричен, но балансиран", "ui-q9-o3": "Дисбалансиран",
        "ui-quest-sec-4": "6.4. Членене (визуално делене) и ритъм",
        "ui-q10": "Как е разчленена формата вътрешно?",
        "ui-q10-o1": "На няколко големи части", "ui-q10-o2": "На множество малки детайли", "ui-q10-o3": "Монолитна е",
        "ui-q11": "Има ли ритмично повторение на контури или възли?",
        "ui-q11-o1": "Да, равномерно", "ui-q11-o2": "Да, градиращо", "ui-q11-o3": "Не",
        "ui-q12": "Как са разпределени празните (негативни) пространства?",
        "ui-q12-o1": "Пропорционално на запълнените", "ui-q12-o2": "Случайно", "ui-q12-o3": "Липсват",
        "ui-quest-sec-5": "6.5. Характер на векторизираните линии",
        "ui-q13": "Какви линии преобладават?",
        "ui-q13-o1": "Прави", "ui-q13-o2": "Извити", "ui-q13-o3": "Остри", "ui-q13-o4": "Смесени",
        "ui-q14": "Ъгли на пресичане?",
        "ui-q14-o1": "90°", "ui-q14-o2": "45°/60°", "ui-q14-o3": "Случайни",
        "ui-q15": "Има ли успоредност?",
        "ui-q15-o1": "Да", "ui-q15-o2": "Частично", "ui-q15-o3": "Не",
        "ui-quest-sec-6": "6.6. Фокус и насочване",
        "ui-q16": "Главна фокусна точка?",
        "ui-q16-o1": "Централна", "ui-q16-o2": "Периферна", "ui-q16-o3": "Няма", "ui-q16-o4": "Разпръсната",
        "ui-q17": "Фиксирани размери?",
        "ui-q17-o1": "Габаритни", "ui-q17-o2": "Вътрешни", "ui-q17-o3": "Не",
        "ui-q18": "Къде е Номиналът?",
        "ui-q18-o1": "В най-големият", "ui-q18-o2": "В детайла", "ui-q18-o3": "В рамката", "ui-q18-o4": "Автоматично",
        "ui-quest-sec-7": "6.7. Субективно усещане",
        "ui-q19": "Визуално тегло?",
        "ui-q19-o1": "Тежко", "ui-q19-o2": "Леко", "ui-q19-o3": "Балансирано",
        "ui-q20": "Движение?",
        "ui-q20-o1": "Статично", "ui-q20-o2": "Насочено", "ui-q20-o3": "Хаотично",
        "ui-q21": "Напрежение?",
        "ui-q21-o1": "В контура", "ui-q21-o2": "В детайла", "ui-q21-o3": "Не",
        "ui-quest-sec-8": "6.8. Характер на формата",
        "ui-q22": "Примитиви?",
        "ui-q22-o1": "Прави", "ui-q22-o2": "Остри", "ui-q22-o3": "Обли", "ui-q22-o4": "Смесени",
        "ui-q23": "Преливане?",
        "ui-q23-o1": "Резки граници", "ui-q23-o2": "Плавно", "ui-q23-o3": "Комбинация",
        "ui-analysis-original": "ОРИГИНАЛ", "ui-analysis-harmonized": "ХАРМОНИЗИРАН",
        "ui-harmony-score": "Хармоничност"
    },

    init: function() {
        const btnNext = document.getElementById('ui-btn-nominal-next');
        if (btnNext) btnNext.onclick = () => this.handleNominalNext();
        const btnCancel = document.getElementById('ui-btn-nominal-cancel');
        if (btnCancel) btnCancel.onclick = () => this.closeNominalDialog();
        const valInput = document.getElementById('nominal-value');
        if (valInput) valInput.oninput = () => this.validateNominalInput();
        const btnBack = document.getElementById('ui-btn-quest-back');
        if (btnBack) btnBack.onclick = () => this.showNominalDialog();
        const btnAnalyze = document.getElementById('ui-btn-quest-analyze');
        if (btnAnalyze) btnAnalyze.onclick = () => this.performAnalysis();
    },

    getT: function(key) {
        if (window.currentLangData && window.currentLangData[key]) return window.currentLangData[key];
        return this.fallbackBG[key] || key;
    },

    showNominalDialog: function() {
        if (GraphicsManager.selectedPaths.length === 0) {
            alert(this.getT("ui-alert-select-path") || "Моля, изберете обект.");
            return;
        }
        document.getElementById('ui-questionnaire-dialog').style.display = 'none';
        document.getElementById('ui-nominal-dialog').style.display = 'flex';
        this.validateNominalInput();
    },

    closeNominalDialog: function() {
        document.getElementById('ui-nominal-dialog').style.display = 'none';
    },

    validateNominalInput: function() {
        const val = parseFloat(document.getElementById('nominal-value').value);
        const unit = document.getElementById('nominal-unit').value;
        const warnDiv = document.getElementById('nominal-warning');
        if (!warnDiv) return;
        if (isNaN(val) || val <= 0) { warnDiv.style.display = 'none'; return; }
        let warning = "";
        if (val < 10 && unit === 'mm') warning = this.getT("ui-nominal-warn-small").replace('{unit}', unit);
        else if (val > 5000 && unit === 'mm') warning = this.getT("ui-nominal-warn-large").replace('{unit}', unit);
        if (warning && warning.indexOf('ui-') === -1) {
            warnDiv.textContent = warning;
            warnDiv.style.display = 'block';
        } else { warnDiv.style.display = 'none'; }
    },

    handleNominalNext: function() {
        const val = parseFloat(document.getElementById('nominal-value').value);
        if (isNaN(val) || val <= 0) {
            alert(this.getT("ui-alert-invalid-value") || "Моля, въведете стойност.");
            return;
        }
        this.nominalValue = val;
        this.nominalUnit = document.getElementById('nominal-unit').value;
        this.nominalType = document.getElementById('nominal-type').value;

        const bbox = this.getSelectedBBox();
        let pxSize = (this.nominalType === 'width') ? bbox.width : (this.nominalType === 'height' ? bbox.height : this.getPathLength(GraphicsManager.paths[GraphicsManager.selectedPaths[0]]));
        
        this.pxToUnitRatio = this.nominalValue / pxSize;
        this.closeNominalDialog();
        this.showQuestionnaire();
    },

    getSelectedBBox: function() {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        GraphicsManager.selectedPaths.forEach(pIdx => {
            GraphicsManager.paths[pIdx].forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        });
        return { width: maxX - minX, height: maxY - minY };
    },

    getPathLength: function(path) {
        let len = 0;
        for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i-1].x, path[i].y - path[i-1].y);
        return len;
    },

    showQuestionnaire: function() {
        const container = document.getElementById('questionnaire-content');
        if (!container) return;
        container.innerHTML = '';
        for (let s = 1; s <= 8; s++) {
            const secDiv = document.createElement('div');
            secDiv.style.cssText = 'margin-bottom:15px; padding:12px; border:1px solid #ddd; border-radius:6px; background:#fff;';
            secDiv.innerHTML = `<h4 style="margin:0 0 10px 0; color:#2c3e50; border-bottom:1px solid #eee;">${this.getT(`ui-quest-sec-${s}`)}</h4>`;
            this.getQuestionsForSection(s).forEach(q => {
                const qDiv = document.createElement('div');
                qDiv.style.margin = '10px 0';
                qDiv.innerHTML = `<p style="font-weight:bold; font-size:13px; margin-bottom:5px;">${this.getT(q.id)}</p>`;
                const grid = document.createElement('div');
                grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:5px;';
                q.options.forEach(optId => {
                    const label = document.createElement('label');
                    label.style.cssText = 'font-size:12px; display:flex; align-items:center; gap:5px; cursor:pointer;';
                    label.innerHTML = `<input type="radio" name="${q.id}" value="${optId}"> ${this.getT(optId)}`;
                    grid.appendChild(label);
                });
                qDiv.appendChild(grid);
                secDiv.appendChild(qDiv);
            });
            container.appendChild(secDiv);
        }
        document.getElementById('ui-questionnaire-dialog').style.display = 'flex';
    },

    getQuestionsForSection: function(s) {
        const map = {
            1: [{id:'ui-q1', options:['ui-q1-o1','ui-q1-o2']},{id:'ui-q2', options:['ui-q2-o1','ui-q2-o2','ui-q2-o3']},{id:'ui-q3', options:['ui-q3-o1','ui-q3-o2','ui-q3-o3']}],
            2: [{id:'ui-q4', options:['ui-q4-o1','ui-q4-o2','ui-q4-o3','ui-q4-o4']},{id:'ui-q5', options:['ui-q5-o1','ui-q5-o2']},{id:'ui-q6', options:['ui-q6-o1','ui-q6-o2','ui-q6-o3','ui-q6-o4','ui-q6-o5']}],
            3: [{id:'ui-q7', options:['ui-q7-o1','ui-q7-o2','ui-q7-o3','ui-q7-o4']},{id:'ui-q8', options:['ui-q8-o1','ui-q8-o2']},{id:'ui-q9', options:['ui-q9-o1','ui-q9-o2','ui-q9-o3']}],
            4: [{id:'ui-q10', options:['ui-q10-o1','ui-q10-o2','ui-q10-o3']},{id:'ui-q11', options:['ui-q11-o1','ui-q11-o2','ui-q11-o3']},{id:'ui-q12', options:['ui-q12-o1','ui-q12-o2','ui-q12-o3']}],
            5: [{id:'ui-q13', options:['ui-q13-o1','ui-q13-o2','ui-q13-o3','ui-q13-o4']},{id:'ui-q14', options:['ui-q14-o1','ui-q14-o2','ui-q14-o3']},{id:'ui-q15', options:['ui-q15-o1','ui-q15-o2','ui-q15-o3']}],
            6: [{id:'ui-q16', options:['ui-q16-o1','ui-q16-o2','ui-q16-o3','ui-q16-o4']},{id:'ui-q17', options:['ui-q17-o1','ui-q17-o2','ui-q17-o3']},{id:'ui-q18', options:['ui-q18-o1','ui-q18-o2','ui-q18-o3','ui-q18-o4']}],
            7: [{id:'ui-q19', options:['ui-q19-o1','ui-q19-o2','ui-q19-o3']},{id:'ui-q20', options:['ui-q20-o1','ui-q20-o2','ui-q20-o3']},{id:'ui-q21', options:['ui-q21-o1','ui-q21-o2','ui-q21-o3']}],
            8: [{id:'ui-q22', options:['ui-q22-o1','ui-q22-o2','ui-q22-o3','ui-q22-o4']},{id:'ui-q23', options:['ui-q23-o1','ui-q23-o2','ui-q23-o3']}]
        }; return map[s] || [];
    },

    performAnalysis: function() {
        this.answers = {};
        document.querySelectorAll('#questionnaire-content input:checked').forEach(i => this.answers[i.name] = i.value);
        
        // --- NEW: Dynamic System Detection ---
        const best = this.findBestSystem();
        const optEl = document.getElementById(`opt-${best.id_key}`);
        this.detectedSystemName = optEl ? optEl.innerText : best.name;
        
        const series = AestheticSolver.generateColumn(this.nominalValue, best.val, "Analysis");
        this.preferredSeries = series.filter(v => typeof v === 'number');
        
        this.originalPaths = JSON.parse(JSON.stringify(GraphicsManager.paths));
        this.harmonizePathsHierarchy();
        
        document.getElementById('ui-questionnaire-dialog').style.display = 'none';
        document.getElementById('ui-geo-nominal-exit').style.display = 'inline-flex';
        document.getElementById('ui-geo-nominal').style.display = 'none';
        
        this.isSplitView = true;
        this.setupSplitViewRedraw();
        GraphicsManager.redraw();
    },

    findBestSystem: function() {
        let bestRatio = AestheticSolver.ratios[4]; // Default to III RPCH (1.122)
        let maxHits = -1;
        const tol = 0.03; // Slightly wider tolerance for detection

        AestheticSolver.ratios.forEach(r => {
            const series = AestheticSolver.generateColumn(this.nominalValue, r.val, "Test");
            const numericSeries = series.filter(v => typeof v === 'number');
            let currentHits = 0;

            GraphicsManager.selectedPaths.forEach(pIdx => {
                const path = GraphicsManager.paths[pIdx];
                for (let i = 1; i < path.length; i++) {
                    const unitLen = Math.hypot(path[i].x - path[i-1].x, path[i].y - path[i-1].y) * this.pxToUnitRatio;
                    const closest = numericSeries.reduce((prev, curr) => Math.abs(curr - unitLen) < Math.abs(prev - unitLen) ? curr : prev, numericSeries[0]);
                    if (Math.abs(unitLen - closest) / closest <= tol) currentHits++;
                }
            });

            if (currentHits > maxHits) {
                maxHits = currentHits;
                bestRatio = r;
            }
        });
        return bestRatio;
    },

    exitAnalysis: function() {
        this.isSplitView = false;
        document.getElementById('ui-geo-nominal-exit').style.display = 'none';
        document.getElementById('ui-geo-nominal').style.display = 'inline-flex';
        GraphicsManager.paths = JSON.parse(JSON.stringify(this.originalPaths));
        GraphicsManager.redraw();
    },

    harmonizePathsHierarchy: function() {
        const tol = 0.02;
        const isCorrection = this.answers['ui-q3'] === 'ui-q3-o3';
        let totalSegments = 0, hits = 0;

        GraphicsManager.paths.forEach((path, pIdx) => {
            // LEVEL 1: Polyline Scaling (Global Uniform Scale)
            if (isCorrection) {
                const bbox = this.getPathsBBox([path]);
                const w = (bbox.maxX - bbox.minX) * this.pxToUnitRatio;
                const h = (bbox.maxY - bbox.minY) * this.pxToUnitRatio;
                const closestW = this.getClosestInSeries(w);
                const closestH = this.getClosestInSeries(h);

                // If BBox is close enough to harmonic values, scale the whole thing
                if (Math.abs(w - closestW)/closestW < 0.05 || Math.abs(h - closestH)/closestH < 0.05) {
                    const scaleFactor = Math.abs(w - closestW)/closestW < Math.abs(h - closestH)/closestH ? closestW/w : closestH/h;
                    const cX = (bbox.minX + bbox.maxX)/2, cY = (bbox.minY + bbox.maxY)/2;
                    path.forEach(p => {
                        p.x = cX + (p.x - cX) * scaleFactor;
                        p.y = cY + (p.y - cY) * scaleFactor;
                    });
                }
            }

            // LEVEL 2 & 3: Segments & Points
            for (let i = 1; i < path.length; i++) {
                totalSegments++;
                const p1 = path[i-1], p2 = path[i];
                const unitLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) * this.pxToUnitRatio;
                const closest = this.getClosestInSeries(unitLen);
                
                if (Math.abs(unitLen - closest) / closest <= tol) {
                    p2.analysisStatus = 'hit'; hits++;
                } else {
                    p2.analysisStatus = 'miss';
                    if (isCorrection) {
                        let ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                        
                        // RELATION AWARE: Level 2
                        const rel = GraphicsManager.relations.find(r => r.pathIdx === pIdx && r.segIdx === i);
                        if (rel) {
                            if (rel.type === 'horizontal') ang = (Math.abs(ang) < Math.PI/2) ? 0 : Math.PI;
                            else if (rel.type === 'vertical') ang = (ang > 0) ? Math.PI/2 : -Math.PI/2;
                            else if (rel.type === 'parallel' || rel.type === 'collinear') {
                                const targetPath = GraphicsManager.paths[rel.pathIdx];
                                const targetP1 = targetPath[rel.targetSegIdx-1], targetP2 = targetPath[rel.targetSegIdx];
                                if (targetP1 && targetP2) ang = Math.atan2(targetP2.y - targetP1.y, targetP2.x - targetP1.x);
                            }
                        } else {
                            // Orthogonality snap (Level 3 fallback)
                            [0, Math.PI/2, Math.PI, -Math.PI/2, Math.PI/4, -Math.PI/4].forEach(target => {
                                if (Math.abs(ang - target) < 0.08) ang = target;
                            });
                        }
                        
                        const targetPx = closest / this.pxToUnitRatio;
                        p2.x = p1.x + Math.cos(ang) * targetPx;
                        p2.y = p1.y + Math.sin(ang) * targetPx;
                    }
                }
            }
            if (path[0].isClosed) {
                const head = path[0], tail = path[path.length - 1];
                if (Math.hypot(head.x - tail.x, head.y - tail.y) < 30) { tail.x = head.x; tail.y = head.y; }
            }
        });
        this.harmonyScore = totalSegments > 0 ? Math.round((hits / totalSegments) * 100) : 0;
    },

    getClosestInSeries: function(v) {
        if (!this.preferredSeries || this.preferredSeries.length === 0) return v;
        return this.preferredSeries.reduce((prev, curr) => Math.abs(curr - v) < Math.abs(prev - v) ? curr : prev, this.preferredSeries[0]);
    },

    setupSplitViewRedraw: function() {
        if (this._redrawInjected) return;
        this._redrawInjected = true;
        const originalRedraw = GraphicsManager.redraw.bind(GraphicsManager);
        GraphicsManager.redraw = () => {
            if (!this.isSplitView) { originalRedraw(); return; }
            const ctx = GraphicsManager.ctx, canvas = GraphicsManager.canvas;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const drawBox = (paths, xCenter, label, opacity, showStatus) => {
                ctx.save();
                ctx.translate(xCenter, canvas.height / 2);
                ctx.scale(0.63, 0.63);
                this.renderCentered(paths, opacity, showStatus);
                ctx.restore();
                ctx.fillStyle = "#2c3e50"; ctx.font = "bold 18px Segoe UI"; ctx.textAlign = "center";
                ctx.fillText(label, xCenter, 50);
                if (showStatus) {
                    ctx.fillStyle = this.getStatusColor(this.harmonyScore);
                    ctx.font = "bold 22px Segoe UI";
                    ctx.fillText(`${this.getT("ui-harmony-score")}: ${this.harmonyScore}%`, xCenter, canvas.height - 40);
                }
            };
            drawBox(this.originalPaths, canvas.width * 0.25, this.getT("ui-analysis-original"), 0.3, false);
            drawBox(GraphicsManager.paths, canvas.width * 0.75, `${this.getT("ui-analysis-harmonized")} (${this.detectedSystemName})`, 1.0, true);
        };
    },

    getStatusColor: function(score) {
        if (score > 80) return "#28a745";
        if (score > 50) return "#ffc107";
        return "#dc3545";
    },

    renderCentered: function(paths, opacity, showStatus) {
        const ctx = GraphicsManager.ctx;
        const bbox = this.getPathsBBox(paths);
        const cX = (bbox.minX + bbox.maxX)/2, cY = (bbox.minY + bbox.maxY)/2;
        
        ctx.globalAlpha = opacity; 
        ctx.lineWidth = 1; // Fixed: Now 1px thickness as requested
        ctx.lineCap = 'round'; 
        ctx.lineJoin = 'round';
        
        paths.forEach(pts => {
            if (pts.length < 2) return;
            const isClosed = pts[0].isClosed !== false;
            const n = pts.length;

            for (let i = 0; i < n; i++) {
                if (!isClosed && i === 0) continue; // Skip closure for open paths
                
                const p2 = pts[i];
                const p1 = pts[(i - 1 + n) % n];
                
                ctx.beginPath();
                ctx.moveTo(p1.x - cX, p1.y - cY);
                ctx.lineTo(p2.x - cX, p2.y - cY);
                
                if (showStatus) {
                    ctx.strokeStyle = (p2.analysisStatus === 'hit') ? '#28a745' : '#dc3545';
                } else {
                    ctx.strokeStyle = '#999';
                }
                ctx.stroke();
            }
        });
        ctx.globalAlpha = 1.0;
    },

    getPathsBBox: function(paths) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        paths.forEach(pts => pts.forEach(p => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        }));
        return { minX: minX-20, minY: minY-20, maxX: maxX+20, maxY: maxY+20 };
    }
};
window.addEventListener('load', () => NominalManager.init());
