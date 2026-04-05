/**
 * Nominal Analysis & Aesthetic Harmonization Module (Hierarchical)
 */

const GeometryUtils = {
    getDistance: (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)),
    getCentroid: (path) => {
        if (!path || path.length === 0) return { x: 0, y: 0 };
        let x = 0, y = 0;
        path.forEach(p => { x += p.x; y += p.y; });
        return { x: x / path.length, y: y / path.length };
    },
    getAngleBetween: (p1, p2, p3) => {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (mag1 < 0.0001 || mag2 < 0.0001) return 0;
        const dot = v1.x * v2.x + v1.y * v2.y;
        let cos = dot / (mag1 * mag2);
        cos = Math.max(-1, Math.min(1, cos));
        return Math.acos(cos);
    }
};

const NominalManager = {
    nominalValue: 0,
    nominalUnit: 'mm',
    nominalType: 'width', 
    pxToUnitRatio: 1,
    answers: {},
    preferredSeries: [],
    isSplitView: false,
    isStepByStep: false,
    stepQueue: [],
    currentStepIdx: -1,
    originalPaths: [],
    _redrawInjected: false,
    harmonyScore: 0,
    savedOpacity: 1,

    fallbackBG: {
        "ui-quest-sec-1": "1. Основна информация и контекст",
        "ui-q1": "Какъв е произходът на обекта?",
        "ui-q1-o1": "Природен", "ui-q1-o2": "Създаден от човека",
        "ui-q2": "Какво е първоначалното визуално впечатление?",
        "ui-q2-o1": "Подчертано хармоничен", "ui-q2-o2": "По-скоро неутрален", "ui-q2-o3": "Дисхармоничен, 'грозен'",
        "ui-q3": "Каква е основната цел на анализа?",
        "ui-q3-o1": "Доказване на налична хармония", "ui-q3-o2": "Откриване на причина за дисхармония", "ui-q3-o3": "Корекция на формата",
        "ui-quest-sec-2": "2. Доминиращи размери и модулност",
        "ui-q4": "Има ли ясно изразен доминиращ размер (Номинал)?",
        "ui-q4-o1": "Да, височина", "ui-q4-o2": "Да, ширина", "ui-q4-o3": "Да, диагонал", "ui-q4-o4": "Не се откроява",
        "ui-q5": "Забелязва ли се базов модул (повтарящ се минимален размер)?",
        "ui-q5-o1": "Да, ясно изразен", "ui-q5-o2": "По-скоро не",
        "ui-q6": "Обектът вписва ли се в проста обграждаща рамка (bounding box)?",
        "ui-q6-o1": "Квадрат", "ui-q6-o2": "Правоъгълник", "ui-q6-o3": "Стандартен правоъгълник", "ui-q6-o4": "Кръг", "ui-q6-o5": "Друго",
        "ui-quest-sec-3": "3. Симетрия и баланс",
        "ui-q7": "Налична ли е ос на симетрия в основния контур?",
        "ui-q7-o1": "Да, вертикална", "ui-q7-o2": "Да, хоризонтална", "ui-q7-o3": "Да, множество оси", "ui-q7-o4": "Не",
        "ui-q8": "Има ли радиална (центрова) симетрия?",
        "ui-q8-o1": "Да", "ui-q8-o2": "Не",
        "ui-q9": "Какъв е визуалният баланс на вътрешните елементи?",
        "ui-q9-o1": "Напълно симетричен", "ui-q9-o2": "Асиметричен, но балансиран", "ui-q9-o3": "Дисбалансиран",
        "ui-quest-sec-4": "4. Членене (визуално делене) и ритъм",
        "ui-q10": "Как е разчленена формата вътрешно?",
        "ui-q10-o1": "На няколко големи части", "ui-q10-o2": "На множество малки детайли", "ui-q10-o3": "Монолитна е",
        "ui-q11": "Има ли ритмично повторение на контури или възли?",
        "ui-q11-o1": "Да, равномерно", "ui-q11-o2": "Да, градиращо", "ui-q11-o3": "Не",
        "ui-q12": "Как са разпределени празните (негативни) пространства?",
        "ui-q12-o1": "Пропорционално на запълнените", "ui-q12-o2": "Случайно", "ui-q12-o3": "Липсват",
        "ui-quest-sec-5": "5. Характер на векторизираните линии",
        "ui-q13": "Какви линии преобладават?",
        "ui-q13-o1": "Прави", "ui-q13-o2": "Извити", "ui-q13-o3": "Остри", "ui-q13-o4": "Смесени",
        "ui-q14": "Ъгли на пресичане?",
        "ui-q14-o1": "90°", "ui-q14-o2": "45°/60°", "ui-q14-o3": "Случайни",
        "ui-q15": "Има ли успоредност?",
        "ui-q15-o1": "Да", "ui-q15-o2": "Частично", "ui-q15-o3": "Не",
        "ui-quest-sec-6": "6. Фокус и насочване",
        "ui-q16": "Главна фокусна точка?",
        "ui-q16-o1": "Централна", "ui-q16-o2": "Периферна", "ui-q16-o3": "Няма", "ui-q16-o4": "Разпръсната",
        "ui-q17": "Фиксирани размери?",
        "ui-q17-o1": "Габаритни", "ui-q17-o2": "Вътрешни", "ui-q17-o3": "Не",
        "ui-q18": "Къде е Номиналът?",
        "ui-q18-o1": "В най-големият", "ui-q18-o2": "В детайла", "ui-q18-o3": "В рамката", "ui-q18-o4": "Автоматично",
        "ui-quest-sec-7": "7. Субективно усещане",
        "ui-q19": "Визуално тегло?",
        "ui-q19-o1": "Тежко", "ui-q19-o2": "Леко", "ui-q19-o3": "Балансирано",
        "ui-q20": "Движение?",
        "ui-q20-o1": "Статично", "ui-q20-o2": "Насочено", "ui-q20-o3": "Хаотично",
        "ui-q21": "Напрежение?",
        "ui-q21-o1": "В контура", "ui-q21-o2": "В детайла", "ui-q21-o3": "Не",
        "ui-quest-sec-8": "8. Характер на формата",
        "ui-q22": "Примитиви?",
        "ui-q22-o1": "Прави", "ui-q22-o2": "Остри", "ui-q22-o3": "Обли", "ui-q22-o4": "Смесени",
        "ui-q23": "Преливане?",
        "ui-q23-o1": "Резки граници", "ui-q23-o2": "Плавно", "ui-q23-o3": "Комбинация",
        "ui-analysis-original": "ОРИГИНАЛ", 
        "ui-analysis-overlay": "НАСЛАГВАНЕ",
        "ui-analysis-harmonized": "ХАРМОНИЗИРАН",
        "ui-harmony-score": "Хармоничност",
        "ui-step-init": "Инициализация на хармонизацията...",
        "ui-step-scaling": "Мащабиране на целият обект към Номинала...",
        "ui-step-segment": "Хармонизиране на сегмент {idx}: {val}{unit} (преди: {old}{unit})",
        "ui-step-closure": "Коригиране на затварянето на полилинията...",
        "ui-step-finished": "Хармонизацията завърши! Хармоничност: {score}%",
        "ui-step-click-next": "Кликнете върху полето за следваща стъпка",
        "ui-alert-select-segment": "Моля, изберете само един сегмент (използвайте инструмента за редактиране на сегменти)."
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
        const seg = GraphicsManager.getSelectedSegmentDetails();
        if (!seg) {
            alert(this.getT("ui-alert-select-segment") || "Моля, изберете само един сегмент.");
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

        // NEW: Get current segment length for scaling
        const seg = GraphicsManager.getSelectedSegmentDetails();
        if (!seg) return;

        // Calculate Scale Factor (Nominal / Pixel Length)
        this.pxToUnitRatio = this.nominalValue / seg.length;
        
        // 1. Transform all project coordinates
        this.originalPaths = JSON.parse(JSON.stringify(GraphicsManager.paths));
        GraphicsManager.applyGlobalScaling(this.pxToUnitRatio);
        this.pxToUnitRatio = 1.0; // After scaling, units = pixels

        // 2. Generate Preferred Series (III RPCH - 1.122)
        this.generatePreferredSeries(this.nominalValue, 1.122);

        this.closeNominalDialog();
        
        // Skip questionnaire for now
        this.performAnalysis();
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
        // Bypassing active inputs from survey for now
        
        this.originalPaths = JSON.parse(JSON.stringify(GraphicsManager.paths));
        
        // Structured Model Generation (Phase A & B)
        this.structuredModel = this.generateStructuredModel();
        
        this.isStepByStep = true;
        this.stepQueue = [];
        this.currentStepIdx = -1;
        this.harmonyScore = 0;
        this.totalSegments = 0;
        this.hits = 0;

        this.buildStepQueue();
        
        document.getElementById('ui-questionnaire-dialog').style.display = 'none';
        
        // Hide original image as requested
        const opacityRange = document.getElementById('imgOpacity');
        if (opacityRange) {
            this.savedOpacity = opacityRange.value;
            opacityRange.value = 0;
            GraphicsManager.imgOpacity = 0;
        }

        this.setupSplitViewRedraw();
        this.isSplitView = true;
        
        document.getElementById('ui-analysis-status').style.display = 'block';
        this.nextStep();
    },

    setupSplitViewRedraw: function() {
        if (this._redrawInjected) return;
        this._redrawInjected = true;
        
        const self = this;
        const originalRedraw = GraphicsManager.redraw.bind(GraphicsManager);
        
        GraphicsManager.redraw = function() {
            if (!self.isSplitView) {
                originalRedraw();
                return;
            }
            
            const ctx = GraphicsManager.ctx;
            const canvas = GraphicsManager.canvas;
            if (!ctx || !canvas) return;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const w = canvas.width / 3;
            const h = canvas.height;
            
            // 1. Original
            ctx.save();
            ctx.rect(0, 0, w, h);
            ctx.clip();
            self.drawLabel(ctx, 10, 25, self.getT('ui-analysis-original'));
            self.drawModel(ctx, self.originalPaths, 0, 0, w, h);
            ctx.restore();
            
            // 2. Overlay
            ctx.save();
            ctx.translate(w, 0);
            ctx.rect(0, 0, w, h);
            ctx.clip();
            self.drawLabel(ctx, 10, 25, self.getT('ui-analysis-overlay'));
            self.drawModel(ctx, self.originalPaths, 0, 0, w, h, 'rgba(200,200,200,0.3)');
            self.drawModel(ctx, GraphicsManager.paths, 0, 0, w, h);
            ctx.restore();
            
            // 3. Harmonized
            ctx.save();
            ctx.translate(2 * w, 0);
            ctx.rect(0, 0, w, h);
            ctx.clip();
            self.drawLabel(ctx, 10, 25, self.getT('ui-analysis-harmonized'));
            self.drawModel(ctx, GraphicsManager.paths, 0, 0, w, h);
            
            ctx.fillStyle = "#2c3e50";
            ctx.font = "bold 13px Arial";
            ctx.fillText(`${self.getT('ui-harmony-score')}: ${self.harmonyScore}%`, 10, h - 15);
            ctx.restore();
            
            // Grid/Separators
            ctx.strokeStyle = "#ddd";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(w, 0); ctx.lineTo(w, h);
            ctx.moveTo(w*2, 0); ctx.lineTo(w*2, h);
            ctx.stroke();
        };
    },

    drawLabel: function(ctx, x, y, text) {
        ctx.fillStyle = "rgba(44, 62, 80, 0.8)";
        ctx.font = "bold 11px Arial";
        ctx.fillText(text, x, y);
    },

    drawModel: function(ctx, paths, ox, oy, w, h, overrideColor) {
        if (!paths || paths.length === 0) return;
        
        ctx.save();
        // Scale to fit the 1/3 panel (with 80% enlargement boost)
        const bbox = this.getPathsBBox(paths);
        const scale = Math.min(w / bbox.width, h / bbox.height) * 0.8;
        
        ctx.translate(w/2, h/2);
        ctx.scale(scale, scale);
        ctx.translate(-(bbox.x + bbox.width/2), -(bbox.y + bbox.height/2));
        
        paths.forEach((path, pIdx) => {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            
            if (overrideColor) {
                ctx.strokeStyle = overrideColor;
            } else {
                ctx.strokeStyle = (GraphicsManager.highlightedSegment && GraphicsManager.highlightedSegment.pathIdx === pIdx) ? "#e74c3c" : "#3498db";
            }
            
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
        });
        ctx.restore();
    },

    getPathsBBox: function(paths) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        paths.forEach(path => {
            path.forEach(p => {
                minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
            });
        });
        if (minX === Infinity) return { x:0, y:0, width:1, height:1 };
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },

    generatePreferredSeries: function(nom, ratio) {
        this.preferredSeries = [];
        const MIN = 1;
        const MAX = 1000;
        
        // Reference point: nominal
        this.preferredSeries.push(Math.round(nom));

        // Downward
        let currentDown = nom;
        while (currentDown > MIN) {
            currentDown /= ratio;
            this.preferredSeries.push(Math.round(currentDown));
        }

        // Upward
        let currentUp = nom;
        while (currentUp < MAX) {
            currentUp *= ratio;
            this.preferredSeries.push(Math.round(currentUp));
        }

        // Final polishing
        this.preferredSeries = [...new Set(this.preferredSeries)]
            .filter(v => v >= MIN && v <= MAX)
            .sort((a, b) => a - b);

        console.log("Calculated Preferred Series (1.122):", this.preferredSeries);
    },

    generateStructuredModel: function() {
        const paths = GraphicsManager.paths.filter(p => p && p.length > 0);
        
        // Calculate Nominal Area based on selected segment's path
        const seg = GraphicsManager.getSelectedSegmentDetails();
        let nominalArea = 10000;
        if (seg) {
            const nominalPath = GraphicsManager.paths[seg.pathIdx];
            nominalArea = this.getPathArea(nominalPath);
            // If path is open or area is too small, use bounding box area as fallback
            if (nominalArea < 10) {
                const b = this.getPathsBBox([nominalPath]);
                nominalArea = b.width * b.height;
            }
        }
        
        const noiseThreshold = 0.02 * nominalArea;

        let contours = paths.map((p, idx) => {
            const bbox = this.getPathsBBox([p]);
            const centroid = GeometryUtils.getCentroid(p);
            const area = this.getPathArea(p);
            const isClosed = p[0].isClosed !== false;

            let segments = [];
            for (let i = 0; i < p.length; i++) {
                if (!isClosed && i === 0) continue;
                const p1 = p[(i - 1 + p.length) % p.length];
                const p2 = p[i];
                const p3 = p[(i + 1) % p.length];
                
                segments.push({
                    id: `S_${idx}_${i}`,
                    type: "line",
                    start: { x: p1.x, y: p1.y },
                    end: { x: p2.x, y: p2.y },
                    length: GeometryUtils.getDistance(p1, p2),
                    angle_to_next: isClosed || i < p.length - 1 ? GeometryUtils.getAngleBetween(p1, p2, p3) : 0,
                    relations: GraphicsManager.relations.filter(r => r.pathIdx === idx && r.segIdx === i)
                });
            }

            return {
                id: `C_${idx}`,
                figure_type: "unknown",
                is_closed: isClosed,
                centroid: centroid,
                bounding_box: bbox,
                area: area,
                is_noise: area < noiseThreshold,
                is_meta_group: false,
                segments: segments,
                original_index: idx
            };
        });

        // Phase A: Noise & Grouping
        contours = this.processPhaseA(contours);

        // Phase B: Qualification
        contours.forEach(c => {
            if (!c.is_noise) c.figure_type = this.qualifyFigure(c);
        });

        return contours;
    },

    processPhaseA: function(contours) {
        // Grouping (Pattern Recognition)
        // 1. Cluster objects with similar shape (area, segment count)
        for (let i = 0; i < contours.length; i++) {
            if (contours[i].is_meta_group || contours[i].is_noise) continue;
            
            let similarShapes = [contours[i]];
            for (let j = i + 1; j < contours.length; j++) {
                if (contours[j].is_meta_group || contours[j].is_noise) continue;
                
                const areaDiff = Math.abs(contours[i].area - contours[j].area) / Math.max(1, contours[i].area);
                const segDiff = Math.abs(contours[i].segments.length - contours[j].segments.length);
                
                if (areaDiff < 0.05 && segDiff === 0) {
                    similarShapes.push(contours[j]);
                }
            }

            // 2. Identify if similar shapes form a rhythmic array (bricks/keys)
            if (similarShapes.length >= 3) {
                // Sort by X or Y centroid to find sequence
                // For simplicity, sort by X first
                similarShapes.sort((a, b) => a.centroid.x - b.centroid.x);
                let xDistances = [];
                for (let k = 1; k < similarShapes.length; k++) {
                    xDistances.push(similarShapes[k].centroid.x - similarShapes[k-1].centroid.x);
                }
                
                const avgXDist = xDistances.reduce((a, b) => a + b, 0) / xDistances.length;
                const isRegularX = xDistances.every(d => Math.abs(d - avgXDist) < 10); // 10px tolerance

                if (isRegularX && avgXDist > 2) {
                    similarShapes.forEach(c => c.is_meta_group = true);
                } else {
                    // Try Y
                    similarShapes.sort((a, b) => a.centroid.y - b.centroid.y);
                    let yDistances = [];
                    for (let k = 1; k < similarShapes.length; k++) {
                        yDistances.push(similarShapes[k].centroid.y - similarShapes[k-1].centroid.y);
                    }
                    const avgYDist = yDistances.reduce((a, b) => a + b, 0) / yDistances.length;
                    const isRegularY = yDistances.every(d => Math.abs(d - avgYDist) < 10);
                    if (isRegularY && avgYDist > 2) {
                        similarShapes.forEach(c => c.is_meta_group = true);
                    }
                }
            }
        }
        return contours;
    },

    qualifyFigure: function(c) {
        const n = c.segments.length;
        if (n === 0) return "unknown";

        // Test for Rectangle (4 segments, ~90 deg angles)
        if (n === 4 && c.is_closed) {
            const all90 = c.segments.every(s => Math.abs(s.angle_to_next - 90) < 5 || Math.abs(s.angle_to_next - 270) < 5);
            if (all90) return "rectangle";
        }

        // Test for Circle (many segments, constant distance to centroid)
        if (n > 8 && c.is_closed) {
            const dists = c.segments.map(s => GeometryUtils.getDistance(s.end, c.centroid));
            const avgDist = dists.reduce((a, b) => a + b, 0) / n;
            const isCircle = dists.every(d => Math.abs(d - avgDist) / avgDist < 0.02);
            if (isCircle) return "circle";
        }

        // Test for Arc (open, constant angle_to_next)
        if (!c.is_closed && n > 3) {
            const angles = c.segments.slice(0, -1).map(s => s.angle_to_next);
            const avgAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
            const isArc = angles.every(a => Math.abs(a - avgAngle) < 2 && a > 90); // simple blunt angle check
            if (isArc) return "arc";
        }

        return "unknown";
    },

    buildStepQueue: function() {
        this.stepQueue.push({ type: 'init', desc: this.getT('ui-step-init') });

        // Phase A: Preliminary Processing
        this.stepQueue.push({ type: 'phase-a-parsing', desc: "Phase A: Parsing geometry database..." });
        this.stepQueue.push({ type: 'phase-a-noise', desc: "Phase A: Detecting noise (area < 2% of Nominal)..." });
        this.stepQueue.push({ type: 'phase-a-cleaning', desc: "Phase A: Cleaning detected noise vectors..." });
        this.stepQueue.push({ type: 'phase-a-grouping', desc: "Phase A: Global pattern recognition (bricks, keys, arrays)..." });

        // Phase 1: Nominal Polyline (after cleaning)
        const seg = GraphicsManager.getSelectedSegmentDetails();
        const nominalIdx = seg ? seg.pathIdx : -1;
        
        if (nominalIdx !== -1) {
            const c = this.structuredModel.find(m => m.original_index === nominalIdx);
            if (c) {
                this.stepQueue.push({ type: 'poly-harmonize', contourId: c.id, desc: "Harmonizing primary polyline (Nominal)..." });
            }
        }

        // Phase 2: Other polylines by size
        const sorted = [...this.structuredModel]
            .filter(c => !c.is_noise && c.original_index !== nominalIdx)
            .sort((a, b) => b.area - a.area);

        sorted.forEach(c => {
            this.stepQueue.push({ type: 'poly-harmonize', contourId: c.id, desc: `Harmonizing polyline ${c.id}...` });
        });

        this.stepQueue.push({ type: 'finish', desc: '' });
    },

    nextStep: function() {
        this.currentStepIdx++;
        if (this.currentStepIdx >= this.stepQueue.length) return;

        const step = this.stepQueue[this.currentStepIdx];
        const statusText = document.getElementById('ui-analysis-status-text');
        const isCorrection = this.answers['ui-q3'] === 'ui-q3-o3';

        if (step.type === 'init') {
            statusText.innerText = step.desc;
        } 
        else if (step.type === 'phase-a-parsing') {
            statusText.innerHTML = `<span style='color:#3498db'>${step.desc}</span><br><small>${this.getT("ui-analysis-click-next")}</small>`;
            // Ensure structured model is fresh
            this.structuredModel = this.generateStructuredModel();
        }
        else if (step.type === 'phase-a-noise') {
            statusText.innerHTML = `<span style='color:#e74c3c'>${step.desc}</span><br><small>${this.getT("ui-analysis-click-next")}</small>`;
            this.structuredModel.forEach(c => {
                if (c.is_noise) {
                    GraphicsManager.paths[c.original_index].tempColor = "red";
                }
            });
        }
        else if (step.type === 'phase-a-cleaning') {
            statusText.innerHTML = `<span style='color:#e74c3c'>${step.desc}</span><br><small>${this.getT("ui-analysis-click-next")}</small>`;
            this.structuredModel.forEach(c => {
                if (c.is_noise) {
                    GraphicsManager.paths[c.original_index].tempHidden = true;
                }
            });
        }
        else if (step.type === 'phase-a-grouping') {
            statusText.innerHTML = `<span style='color:#1abc9c'>${step.desc}</span><br><small>${this.getT("ui-analysis-click-next")}</small>`;
            this.structuredModel.forEach(c => {
                if (c.is_meta_group) {
                    GraphicsManager.paths[c.original_index].tempColor = "cyan";
                }
            });
        }
        else if (step.type === 'segment') {
            // Deprecated for poly-harmonize but left for partial compatibility
        }
        else if (step.type === 'poly-harmonize') {
            statusText.innerText = step.desc;
            this.harmonizePolylineRelativeToCenter(step.contourId);
        }
        else if (step.type === 'closure') {
            const path = GraphicsManager.paths[step.pathIdx];
            const head = path[0], tail = path[path.length - 1];
            if (isCorrection) {
                tail.x = head.x; tail.y = head.y;
            }
            statusText.innerText = step.desc;
            GraphicsManager.highlightedSegment = null;
        }
        else if (step.type === 'finish') {
            this.harmonyScore = this.totalSegments > 0 ? Math.round((this.hits / this.totalSegments) * 100) : 0;
            const msg = this.getT('ui-step-finished').replace('{score}', this.harmonyScore);
            statusText.innerText = msg;
            this.isStepByStep = false;
            this.isSplitView = false;
            document.getElementById('ui-geo-nominal-exit').style.display = 'inline-flex';
            document.getElementById('ui-geo-nominal').style.display = 'none';
            GraphicsManager.highlightedSegment = null;
        }

        GraphicsManager.redraw();
    },

    findBestSystem: function() {
        let bestRatio = AestheticSolver.ratios[4]; // Default to III RPCH (1.122)
        let maxHits = -1;
        const tol = 0.03;

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
        this.isStepByStep = false;
        this.isSplitView = false;
        document.getElementById('ui-analysis-status').style.display = 'none';
        document.getElementById('ui-geo-nominal-exit').style.display = 'none';
        document.getElementById('ui-geo-nominal').style.display = 'inline-flex';
        
        const opacityRange = document.getElementById('imgOpacity');
        if (opacityRange && this.savedOpacity !== undefined) {
            opacityRange.value = this.savedOpacity;
            GraphicsManager.imgOpacity = this.savedOpacity;
        }

        GraphicsManager.paths = JSON.parse(JSON.stringify(this.originalPaths));
        GraphicsManager.paths.forEach(p => {
            delete p.tempColor;
            delete p.tempHidden;
        });
        GraphicsManager.highlightedSegment = null;
        GraphicsManager.redraw();
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
            
            const drawBox = (paths, xCenter, label, opacity, showStatus, extraPaths = null) => {
                ctx.save();
                ctx.translate(xCenter, canvas.height / 2);
                ctx.scale(0.55, 0.55); // Adjusted scale for 3 panels
                
                if (extraPaths) { 
                    this.renderCentered(paths, opacity, showStatus); // Harmonized first
                    this.renderCentered(extraPaths, 0.4, false);     // Original on top (increased opacity slightly)
                } else {
                    this.renderCentered(paths, opacity, showStatus);
                }
                
                ctx.restore();
                ctx.fillStyle = "#2c3e50"; ctx.font = "bold 16px Segoe UI"; ctx.textAlign = "center";
                ctx.fillText(label, xCenter, 50);
                
                if (showStatus) {
                    ctx.fillStyle = this.getStatusColor(this.harmonyScore);
                    ctx.font = "bold 20px Segoe UI";
                    ctx.fillText(`${this.getT("ui-harmony-score")}: ${this.harmonyScore}%`, xCenter, canvas.height - 40);
                }
            };
            
            // 3-Panel Layout
            const w = canvas.width;
            drawBox(this.originalPaths, w * 0.16, this.getT("ui-analysis-original"), 0.6, false);
            drawBox(GraphicsManager.paths, w * 0.5, this.getT("ui-analysis-overlay"), 0.9, true, this.originalPaths);
            drawBox(GraphicsManager.paths, w * 0.84, `${this.getT("ui-analysis-harmonized")} (${this.detectedSystemName})`, 1.0, true);
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
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY, width: maxX - minX, height: maxY - minY };
    },

    harmonizePolylineRelativeToCenter: function(contourId) {
        const c = this.structuredModel.find(m => m.id === contourId);
        if (!c) return;

        const path = GraphicsManager.paths[c.original_index];
        if (!path || path.length === 0) return;

        const oldCentroid = GeometryUtils.getCentroid(path);
        
        // 1. Scaled nodes relative to centroid
        // (Actually, user said harmonize all segments)
        // We will scale distances to nodes from centroid to preferred series?
        // NO, user said "хармонизираме всички сегменти". 
        // This means we snap segment lengths while keeping the centroid fixed.

        for (let i = 1; i < path.length; i++) {
            const p1 = path[i-1], p2 = path[i];
            const currentLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const targetLen = this.getClosestInSeries(currentLen);
            
            if (targetLen !== currentLen) {
                const ratio = targetLen / currentLen;
                const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                p2.x = p1.x + Math.cos(ang) * targetLen;
                p2.y = p1.y + Math.sin(ang) * targetLen;
            }
            p2.analysisStatus = (Math.abs(currentLen - targetLen) < 1) ? 'hit' : 'miss';
        }

        // 2. Re-center the polyline
        const newCentroid = GeometryUtils.getCentroid(path);
        const dx = oldCentroid.x - newCentroid.x;
        const dy = oldCentroid.y - newCentroid.y;
        path.forEach(p => { p.x += dx; p.y += dy; });
        
        GraphicsManager.redraw();
    },

    getPathArea: function(path) {
        if (path.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < path.length; i++) {
            let j = (i + 1) % path.length;
            area += path[i].x * path[j].y;
            area -= path[j].x * path[i].y;
        }
        return Math.abs(area) / 2;
    },

    getDistanceBetweenPaths: function(pathA, pathB) {
        let minDist = Infinity;
        for (let pA of pathA) {
            for (let pB of pathB) {
                const d = Math.hypot(pA.x - pB.x, pA.y - pB.y);
                if (d < minDist) minDist = d;
            }
        }
        return minDist;
    },

    preProcessedData: {
        noises: [],
        metaObjects: [],
        lockedDistances: []
    },

    preProcessGraphics: function() {
        const nominalBBox = this.getSelectedBBox();
        const nominalArea = nominalBBox.width * nominalBBox.height;
        const noiseThreshold = 0.02 * nominalArea;
        
        this.preProcessedData = { noises: [], metaObjects: [], lockedDistances: [] };
        
        const pathInfos = GraphicsManager.paths.map((p, idx) => ({
            idx,
            area: this.getPathArea(p),
            bbox: this.getPathsBBox([p]),
            isHandled: false
        }));

        // 1. Identify Noise (excluding Nominal element)
        const selectedIdx = GraphicsManager.selectedPaths[0]; // The path chosen as Nominal
        pathInfos.forEach(info => {
            if (info.idx === selectedIdx) return; // Never noise
            if (info.area < noiseThreshold) {
                info.isNoise = true;
                this.preProcessedData.noises.push(info.idx);
            }
        });

        // 2. Group Noise into Meta-objects (Textures)
        const noiseIndices = pathInfos.filter(i => i.isNoise).map(i => i.idx);
        let clusters = this.clusterPaths(noiseIndices, 50); // 50px threshold for grouping noise
        clusters.forEach(cluster => {
            if (cluster.length > 1) {
                this.preProcessedData.metaObjects.push({
                    type: 'texture',
                    indices: cluster,
                    bbox: this.getPathsBBox(cluster.map(idx => GraphicsManager.paths[idx]))
                });
                cluster.forEach(idx => pathInfos[idx].isHandled = true);
            }
        });

        // 3. Array Recognition
        const potentialArrayIndices = pathInfos.filter(i => !i.isHandled && !i.isNoise).map(i => i.idx);
        for (let i = 0; i < potentialArrayIndices.length; i++) {
            const idxA = potentialArrayIndices[i];
            if (pathInfos[idxA].isHandled) continue;
            
            let currentArray = [idxA];
            let distances = [];
            
            for (let j = i + 1; j < potentialArrayIndices.length; j++) {
                const idxB = potentialArrayIndices[j];
                if (pathInfos[idxB].isHandled) continue;
                
                const areaDiff = Math.abs(pathInfos[idxA].area - pathInfos[idxB].area) / pathInfos[idxA].area;
                if (areaDiff < 0.05) {
                    const dist = this.getDistanceBetweenPaths(GraphicsManager.paths[idxA], GraphicsManager.paths[idxB]);
                    currentArray.push(idxB);
                    distances.push(dist);
                }
            }
            
            if (currentArray.length >= 3) {
                // Check for rhythmic spacing (+/- 2% tolerance)
                const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
                const isRegular = distances.every(d => Math.abs(d - avgDist) / avgDist < 0.02);
                
                if (isRegular) {
                    this.preProcessedData.metaObjects.push({
                        type: 'array',
                        indices: currentArray,
                        lockedDist: avgDist,
                        bbox: this.getPathsBBox(currentArray.map(idx => GraphicsManager.paths[idx]))
                    });
                    currentArray.forEach(idx => pathInfos[idx].isHandled = true);
                }
            }
        }

        // 4. Gap Analysis (locking already harmonic distances)
        // ... (can be extended to check distances between all top-level objects)
    },

    processPhaseC: function(contourId) {
        const current = this.structuredModel.find(c => c.id === contourId);
        if (!current) return;
        
        const tol = 0.02 * this.nominalValue;
        
        this.structuredModel.forEach(other => {
            if (other.id === current.id || other.is_noise) return;
            
            // Vertical gap
            const vGap = Math.abs(current.bounding_box.y - (other.bounding_box.y + other.bounding_box.height));
            const vGapUnits = vGap * this.pxToUnitRatio;
            const closestV = this.getClosestInSeries(vGapUnits);
            
            if (Math.abs(vGapUnits - closestV) < tol) {
                // Harmonic gap detected
            }
            
            // Horizontal gap
            const hGap = Math.abs(current.bounding_box.x - (other.bounding_box.x + other.bounding_box.width));
            const hGapUnits = hGap * this.pxToUnitRatio;
            const closestH = this.getClosestInSeries(hGapUnits);
            
            if (Math.abs(hGapUnits - closestH) < tol) {
                // Harmonic gap detected
            }
        });
    },

    clusterPaths: function(indices, threshold) {
        // ... (existing clustering)
        let clusters = [];
        let visited = new Set();
        
        indices.forEach(idx => {
            if (visited.has(idx)) return;
            let cluster = [];
            let queue = [idx];
            visited.add(idx);
            
            while (queue.length > 0) {
                let curr = queue.shift();
                cluster.push(curr);
                indices.forEach(next => {
                    if (!visited.has(next)) {
                        if (this.getDistanceBetweenPaths(GraphicsManager.paths[curr], GraphicsManager.paths[next]) < threshold) {
                            visited.add(next);
                            queue.push(next);
                        }
                    }
                });
            }
            clusters.push(cluster);
        });
        return clusters;
    },
};
window.NominalManager = NominalManager;
window.addEventListener('load', () => NominalManager.init());
