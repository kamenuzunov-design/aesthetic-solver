/**
 * Nominal Analysis Module - New Implementation (Phase A)
 */

const GeometryUtils = {
    getDistance: (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)),
    
    getCentroid: (path) => {
        if (!path || path.length === 0) return { x: 0, y: 0 };
        let x = 0, y = 0;
        path.forEach(p => { x += p.x; y += p.y; });
        return { x: x / path.length, y: y / path.length };
    },

    getPathArea: (path) => {
        if (!path || path.length < 2) return 0;
        let area = 0;
        // Shoelace formula for closed paths
        for (let i = 0; i < path.length; i++) {
            let p1 = path[i];
            let p2 = path[(i + 1) % path.length];
            area += (p1.x * p2.y) - (p2.x * p1.y);
        }
        area = Math.abs(area) / 2;
        
        // Fallback for open paths or tiny areas (use BBox area)
        if (area < 1 || path[0].isClosed === false) {
            const bbox = GeometryUtils.getBBox(path);
            area = bbox.width * bbox.height;
        }
        return area;
    },

    getBBox: (path) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        path.forEach(p => {
            minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    },

    getAngleAtNode: (p1, p2, p3) => {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (mag1 < 0.0001 || mag2 < 0.0001) return 180;
        let angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * (180 / Math.PI);
        return angle;
    },

    getCrossProduct: (p1, p2, p3) => {
        return (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);
    },

    getPerimeter: (path) => {
        let p = 0;
        const n = path.length;
        if (n < 2) return 0;
        for (let i = 0; i < n; i++) {
            p += GeometryUtils.getDistance(path[i], path[(i + 1) % n]);
        }
        return p;
    },

    getCircularity: (area, perimeter) => {
        if (perimeter <= 0) return 0;
        return (4 * Math.PI * area) / (perimeter * perimeter);
    },

    isEffectivelyClosed: (path) => {
        if (!path || path.length < 3) return false;
        if (path[0].isClosed) return true;
        // Check distance between start and end
        const dist = GeometryUtils.getDistance(path[0], path[path.length - 1]);
        return dist < 1.0; // Tolerance for closure
    }
};

const NominalManager = {
    isAnalysisActive: false,
    isStepByStep: false,
    currentStepIdx: -1,
    stepQueue: [],
    
    // Internal State
    nominalValue: 0,
    nominalUnit: 'mm',
    pxToUnitRatio: 1,
    nominalArea: 0, 
    _canvasClickListener: null, // Local listener for better control
    originalPaths: [],
    structuredModel: [],
    selectedSegmentDetails: null,

    init: function() {
        console.log("NominalManager initialized.");
        const btnNext = document.getElementById('ui-btn-nominal-next');
        if (btnNext) btnNext.onclick = () => this.handleNominalNext();
        
        const btnCancel = document.getElementById('ui-btn-nominal-cancel');
        if (btnCancel) btnCancel.onclick = () => this.closeNominalDialog();

        // Listen for Esc key
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isAnalysisActive) {
                this.exitAnalysis();
            }
        });
    },

    showNominalDialog: function() {
        this.selectedSegmentDetails = GraphicsManager.getSelectedSegmentDetails();
        if (!this.selectedSegmentDetails) {
            alert("Please select exactly one segment using the Segment Edit tool.");
            return;
        }
        document.getElementById('ui-nominal-dialog').style.display = 'flex';
    },

    closeNominalDialog: function() {
        document.getElementById('ui-nominal-dialog').style.display = 'none';
    },

    handleNominalNext: function() {
        const val = parseFloat(document.getElementById('nominal-value').value);
        if (isNaN(val) || val <= 0) {
            alert("Please enter a valid nominal value.");
            return;
        }

        this.nominalValue = val;
        this.nominalUnit = document.getElementById('nominal-unit').value;
        this.pxToUnitRatio = this.nominalValue / this.selectedSegmentDetails.length;

        this.closeNominalDialog();
        this.startAnalysis();
    },

    startAnalysis: function() {
        this.isAnalysisActive = true;
        this.isStepByStep = true;
        this.currentStepIdx = -1;
        this.stepQueue = [];

        // Save original paths for restoration
        this.originalPaths = JSON.parse(JSON.stringify(GraphicsManager.paths));
        
        // Build Step Queue for Phase A & B
        this.stepQueue.push({ id: 'PARSING', desc: "Phase A Step 1: Parsing SVG geometry..." });
        this.stepQueue.push({ id: 'NOISE', desc: "Phase A Step 2: Noise Filtering..." });
        this.stepQueue.push({ id: 'PATTERNS', desc: "Phase A Step 3: Pattern Recognition..." });
        this.stepQueue.push({ id: 'QUALIFY', desc: "Phase B Step 4: Geometric Form Qualification..." });

        document.getElementById('ui-analysis-status').style.display = 'block';
        
        // Show exit button in toolbar
        if (document.getElementById('ui-geo-nominal-exit')) document.getElementById('ui-geo-nominal-exit').style.display = 'inline-flex';
        if (document.getElementById('ui-geo-nominal')) document.getElementById('ui-geo-nominal').style.display = 'none';

        // Add local click listener to ensure nextStep is called reliably
        const canvas = document.getElementById('mainCanvas');
        if (canvas) {
            this._canvasClickListener = (e) => {
                // Only left click, and only if we are in step-by-step mode
                if (e.button === 0 && this.isAnalysisActive) {
                    this.nextStep();
                }
            };
            // Use capture to be first in line or just a regular listener
            canvas.addEventListener('mousedown', this._canvasClickListener);
        }

        this.nextStep();
    },

    nextStep: function() {
        this.currentStepIdx++;
        if (this.currentStepIdx >= this.stepQueue.length) {
            this.updateStatus("Phase A Completed. Waiting for Phase B instructions...");
            return;
        }

        const step = this.stepQueue[this.currentStepIdx];
        this.updateStatus(step.desc);

        switch (step.id) {
            case 'PARSING':
                this.performParsing();
                break;
            case 'NOISE':
                this.performNoiseFilter();
                break;
            case 'PATTERNS':
                this.performPatternRecognition();
                break;
            case 'QUALIFY':
                this.performQualification();
                break;
        }

        GraphicsManager.redraw();
    },

    updateStatus: function(text) {
        const statusEl = document.getElementById('ui-analysis-status-text');
        if (statusEl) {
            const progress = `[${this.currentStepIdx + 1}/${this.stepQueue.length}]`;
            statusEl.innerHTML = `<span style="color: #f1c40f;">${progress}</span> <b>${text}</b><br><small style="opacity: 0.8;">Click canvas to continue (or ESC to exit)</small>`;
        }
    },

    // Phase A Implementations
    performParsing: function() {
        // Find reference Nominal Area from the path containing the selected segment
        const nominalPath = GraphicsManager.paths[this.selectedSegmentDetails.pathIdx];
        this.nominalArea = GeometryUtils.getPathArea(nominalPath);

        // Convert paths to structured objects
        let formsCount = 0;
        let artifactsCount = 0;

        this.structuredModel = GraphicsManager.paths.map((p, idx) => {
            const area = GeometryUtils.getPathArea(p);
            const bbox = GeometryUtils.getBBox(p);
            
            // Sub-pixel "dust" (less than 0.5px area) is tagged as artifact
            const isArtifact = area < 0.5;
            if (isArtifact) artifactsCount++; else formsCount++;

            return {
                id: `CTR_${idx}`,
                originalIndex: idx,
                points: p,
                area: area,
                bbox: bbox,
                is_noise: false,
                is_artifact: isArtifact,
                is_meta_group: false,
                is_nominal: (idx === this.selectedSegmentDetails.pathIdx)
            };
        });
        this.updateStatus(`Step 1: Parsed ${formsCount} major forms + ${artifactsCount} artifacts.`);
    },

    performNoiseFilter: function() {
        if (this.nominalArea <= 0) return;
        const threshold = 0.008 * this.nominalArea;
        let majorNoise = 0;
        let artifactNoise = 0;

        this.structuredModel.forEach(contour => {
            if (contour.area < threshold || contour.is_artifact) {
                contour.is_noise = true;
                GraphicsManager.paths[contour.originalIndex].tempColor = "red";
                if (contour.is_artifact) artifactNoise++; else majorNoise++;
            } else {
                GraphicsManager.paths[contour.originalIndex].tempColor = "#34495e"; 
            }
        });

        this.updateStatus(`Step 2: Noise filtered. (${majorNoise} significant items + ${artifactNoise} artifacts).`);
    },

    performPatternRecognition: function() {
        let groupCount = 0;
        // Robust shape matching: same area (5%), same segment count, and similar BBox proportions
        for (let i = 0; i < this.structuredModel.length; i++) {
            let c1 = this.structuredModel[i];
            if (c1.is_noise || c1.is_meta_group) continue;

            let similarOnes = [c1];
            for (let j = i + 1; j < this.structuredModel.length; j++) {
                let c2 = this.structuredModel[j];
                if (c2.is_noise || c2.is_meta_group) continue;

                const areaDiff = Math.abs(c1.area - c2.area) / (c1.area || 1);
                const ptsDiff = Math.abs(c1.points.length - c2.points.length);
                const dimDiff = Math.abs(c1.bbox.width - c2.bbox.width) / (c1.bbox.width || 1) + 
                                Math.abs(c1.bbox.height - c2.bbox.height) / (c1.bbox.height || 1);

                if (areaDiff < 0.1 && ptsDiff === 0 && dimDiff < 0.2) {
                    similarOnes.push(c2);
                }
            }

            if (similarOnes.length >= 2) { // Changed to 2 or more for better visibility
                similarOnes.forEach(c => {
                    c.is_meta_group = true;
                    GraphicsManager.paths[c.originalIndex].tempColor = "#00ffff"; // Cyan for groups
                });
                groupCount++;
            }
        }
        this.updateStatus(`Phase A Step 3: Identified ${groupCount} meta-groups of identical elements.`);
    },

    performQualification: function() {
        let counts = { rect: 0, circle: 0, ellipse: 0, arc: 0, rrect: 0 };
        let metaShapeStatus = {}; 

        this.structuredModel.forEach(contour => {
            if (contour.is_noise) {
                GraphicsManager.paths[contour.originalIndex].tempHidden = true;
                return;
            }

            let figureDetected = false;
            const pts = contour.points;
            const n = pts.length;
            const area = contour.area;
            const perimeter = GeometryUtils.getPerimeter(pts);
            const circularity = GeometryUtils.getCircularity(area, perimeter);
            const bbox = contour.bbox;
            const bboxArea = bbox.width * bbox.height;
            const fillRatio = area / (bboxArea || 1);
            
            // Critical: Use robust closed-path detection
            const isClosed = GeometryUtils.isEffectivelyClosed(pts);

            if (isClosed) {
                // 1. Rectangle (Structure-based: 4-5 points OR high boxiness)
                if (fillRatio > 0.92 || (n >= 4 && n <= 6 && this.testRectangle(contour))) {
                    contour.figureType = 'rectangle';
                    GraphicsManager.paths[contour.originalIndex].tempColor = "#27ae60"; 
                    counts.rect++; figureDetected = true;
                }
                // 2. Circle (Property-based)
                else if (circularity > 0.65 && Math.abs(1 - bbox.width/bbox.height) < 0.2) {
                    contour.figureType = 'circle';
                    GraphicsManager.paths[contour.originalIndex].tempColor = "#f39c12"; 
                    counts.circle++; figureDetected = true;
                } 
                // 3. Ellipse (Area ratio)
                else if (this.testEllipse(contour, area)) {
                    contour.figureType = 'ellipse';
                    GraphicsManager.paths[contour.originalIndex].tempColor = "#e67e22";
                    counts.ellipse++; figureDetected = true;
                } 
                // 4. Rounded Rectangle (Fill ratio check)
                else if (fillRatio > 0.70 && fillRatio <= 0.92) {
                    contour.figureType = 'rounded_rectangle';
                    GraphicsManager.paths[contour.originalIndex].tempColor = "#2ecc71";
                    counts.rrect++; figureDetected = true;
                }
            } else {
                // 5. Arc (Only for truly open paths)
                if (this.testArc(contour)) {
                    contour.figureType = 'arc';
                    GraphicsManager.paths[contour.originalIndex].tempColor = "#8e44ad"; 
                    counts.arc++; figureDetected = true;
                }
            }

            if (contour.is_meta_group && figureDetected) {
                const type = contour.figureType;
                metaShapeStatus[type] = (metaShapeStatus[type] || 0) + 1;
            }

            if (contour.is_nominal) {
                GraphicsManager.paths[contour.originalIndex].tempColor = "#f1c40f"; 
            } else if (contour.is_meta_group && !figureDetected) {
                GraphicsManager.paths[contour.originalIndex].tempColor = "#00ffff";
            } else if (!figureDetected) {
                GraphicsManager.paths[contour.originalIndex].tempColor = "#34495e";
            }
        });

        const nominal = this.structuredModel.find(c => c.is_nominal);
        const nominalStr = nominal ? (nominal.figureType || "Complex Form") : "None";
        
        let groupSummary = "";
        for (let type in metaShapeStatus) {
            groupSummary += `${metaShapeStatus[type]} ${type}s in groups, `;
        }
        if (groupSummary) groupSummary = " (" + groupSummary.slice(0, -2) + ")";

        const totalUseful = this.structuredModel.filter(c => !c.is_noise).length;
        this.updateStatus(`Step 4: ${totalUseful} useful forms. Nominal: ${nominalStr}. Details: ${counts.circle} Circles, ${counts.ellipse} Ellipses, ${counts.rect} Rects, ${counts.rrect} R-Rects, ${counts.arc} Arcs.${groupSummary}`);
    },

    testCircle: function(contour) {
        if (contour.points.length < 8 || !contour.points[0].isClosed) return false;
        const centroid = GeometryUtils.getCentroid(contour.points);
        let dists = contour.points.map(p => GeometryUtils.getDistance(p, centroid));
        const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length;
        const maxDev = Math.max(...dists.map(d => Math.abs(d - avgDist))) / avgDist;
        return maxDev < 0.05; // 5% tolerance for "Potrace" circles
    },

    testEllipse: function(contour, actualArea) {
        if (contour.points.length < 8) return false;
        const bbox = contour.bbox;
        const a = bbox.width / 2;
        const b = bbox.height / 2;
        const theoreticalArea = Math.PI * a * b;
        
        // Ellipse area ratio check (usually 1.0 but Potrace might be slightly off)
        const ratio = actualArea / theoreticalArea;
        return ratio > 0.85 && ratio < 1.15;
    },

    testRectangle: function(contour, isRounded = false) {
        if (!contour.points[0].isClosed) return false;
        
        const pts = contour.points;
        const n = pts.length;
        let rightAngles = 0;
        
        for (let i = 0; i < n; i++) {
            const pPrev = pts[(i - 1 + n) % n];
            const pCurr = pts[i];
            const pNext = pts[(i + 1) % n];
            const angle = GeometryUtils.getAngleAtNode(pPrev, pCurr, pNext);
            
            // Relaxed tolerance for Potrace noise
            const isRight = Math.abs(angle - 90) < 20 || Math.abs(angle - 270) < 20;
            if (isRight) rightAngles++;
        }

        if (isRounded) {
            // Rounded rectangles might have fewer sharp corners but still 4 "turning" areas
            return rightAngles >= 2 && n >= 8;
        } else {
            return rightAngles >= 4;
        }
    },

    testArc: function(contour) {
        if (contour.points.length < 5) return false;
        const pts = contour.points;
        let directions = [];

        for (let i = 1; i < pts.length - 1; i++) {
            const cp = GeometryUtils.getCrossProduct(pts[i-1], pts[i], pts[i+1]);
            if (Math.abs(cp) > 0.1) { // Ignore tiny jitters
                directions.push(Math.sign(cp));
            }
        }
        
        if (directions.length < 3) return false;
        
        // Percentage of segments bending in the same direction
        const posCount = directions.filter(d => d > 0).length;
        const negCount = directions.filter(d => d < 0).length;
        const consistency = Math.max(posCount, negCount) / directions.length;

        return consistency > 0.85; // Curvature is consistent
    },

    exitAnalysis: function() {
        this.isAnalysisActive = false;
        this.isStepByStep = false;
        document.getElementById('ui-analysis-status').style.display = 'none';
        
        // Remove local click listener
        const canvas = document.getElementById('mainCanvas');
        if (canvas && this._canvasClickListener) {
            canvas.removeEventListener('mousedown', this._canvasClickListener);
        }

        // Restore buttons
        const exitBtn = document.getElementById('ui-geo-nominal-exit');
        if (exitBtn) exitBtn.style.display = 'none';
        const startBtn = document.getElementById('ui-geo-nominal');
        if (startBtn) startBtn.style.display = 'inline-flex';

        // Restore original paths
        if (this.originalPaths.length > 0) {
            GraphicsManager.paths = JSON.parse(JSON.stringify(this.originalPaths));
        }
        
        GraphicsManager.redraw();
        console.log("Analysis terminated.");
    }
};

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    NominalManager.init();
});
