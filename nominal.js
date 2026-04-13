/**
 * Nominal Analysis Module - New Implementation (Phase A)
 */

const ANG_TOL = 2; // Degrees
const LEN_TOL = 0.02; // 2% of Nominal

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
        const isClosed = path[0].isClosed !== false;
        for (let i = 0; i < n; i++) {
            if (!isClosed && i === 0) continue;
            p += GeometryUtils.getDistance(path[(i-1+n)%n], path[i]);
        }
        return p;
    },

    getCircularity: (area, perimeter) => {
        if (perimeter <= 0) return 0;
        return (4 * Math.PI * area) / (perimeter * perimeter);
    },

    isEffectivelyClosed: (path) => {
        if (!path || path.length < 3) return false;
        // 1. Check for explicit flag (set by Potrace, SVG parser, or Project loader)
        const hasFlag = path.some(p => p.isClosed === true);
        if (hasFlag) return true;
        
        // 2. Check for explicit OPEN flag
        const openFlag = path.some(p => p.isClosed === false);
        if (openFlag) return false;
        
        // 3. Fallback: Epsilon-based endpoint matching
        const p0 = path[0];
        const pn = path[path.length - 1];
        return Math.abs(p0.x - pn.x) < 0.1 && Math.abs(p0.y - pn.y) < 0.1;
    },

    normalizeContour: (path) => {
        if (!path || path.length < 2) return path || [];
        
        // Remove consecutive duplicate points
        let pts = [path[0]];
        for (let i = 1; i < path.length; i++) {
            if (GeometryUtils.getDistance(path[i-1], path[i]) > 0.05) {
                pts.push(path[i]);
            }
        }

        if (pts.length < 3) return pts;

        const isClosed = GeometryUtils.isEffectivelyClosed(pts);
        let result = [...pts];
        let hasChanges = true;
        let iter = 0;

        while (hasChanges && iter < 5) {
            hasChanges = false;
            iter++;
            let nextResult = [];
            const n = result.length;
            
            for (let i = 0; i < n; i++) {
                const prev = result[(i - 1 + n) % n];
                const curr = result[i];
                const next = result[(i + 1) % n];
                
                // Respect endpoints: NEVER remove start/end of array
                if (i === 0 || i === n - 1) {
                    nextResult.push(curr);
                    continue;
                }

                const angle = GeometryUtils.getAngleAtNode(prev, curr, next);
                if (Math.abs(angle - 180) < ANG_TOL || Math.abs(angle) < ANG_TOL) {
                    hasChanges = true;
                } else {
                    nextResult.push(curr);
                }
            }
            result = nextResult;
            if (result.length < 3) break;
        }
        
        return result;
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
        this.stepQueue.push({ id: 'QUALIFY', desc: "Phase A Step 4: Geometric Form Qualification..." });
        this.stepQueue.push({ id: 'REPORT', desc: "Phase A Step 5: Element Details Report" });

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
        if (this.currentStepIdx === this.stepQueue.length - 1) {
            // Already at the last step, don't advance further so report stays open
            return;
        }

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
            case 'REPORT':
                this.performReporting();
                break;
        }

        GraphicsManager.redraw();
    },

    updateStatus: function(text) {
        const containerEl = document.getElementById('ui-analysis-status');
        const statusEl = document.getElementById('ui-analysis-status-text');
        if (statusEl && containerEl) {
            // Re-enable pointer events so buttons inside can be clicked
            containerEl.style.pointerEvents = 'auto';
            
            const progress = `[${this.currentStepIdx + 1}/${this.stepQueue.length}]`;
            let hint = `<small style="opacity: 0.8;">Click canvas to continue (or ESC to exit)</small>`;
            if (this.currentStepIdx === this.stepQueue.length - 1) {
                hint = `<small style="opacity: 0.8; color: #3498db;">Press ESC to exit Nominal Analysis</small>`;
            }
            statusEl.innerHTML = `<span style="color: #f1c40f;">${progress}</span> <b>${text}</b><br>${hint}`;
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
            // Apply normalization immediately in Step 1
            const normalizedPoints = GeometryUtils.normalizeContour(p);
            
            const area = GeometryUtils.getPathArea(normalizedPoints);
            const bbox = GeometryUtils.getBBox(normalizedPoints);
            
            // Sub-pixel "dust" (less than 0.5px area) is tagged as artifact
            const isArtifact = area < 0.5;
            if (isArtifact) artifactsCount++; else formsCount++;

            const isClosed = GeometryUtils.isEffectivelyClosed(normalizedPoints);
            let N = normalizedPoints.length - 1;
            if (normalizedPoints.length > 1) {
                const p0 = normalizedPoints[0];
                const pn = normalizedPoints[normalizedPoints.length - 1];
                const isClosingPt = Math.abs(p0.x - pn.x) < 0.1 && Math.abs(p0.y - pn.y) < 0.1;
                if (isClosed) {
                    N = isClosingPt ? (normalizedPoints.length - 1) : normalizedPoints.length;
                }
            }

            return {
                id: `CTR_${idx}`,
                originalIndex: idx,
                points: normalizedPoints, // Use clean geometry
                segmentCount: N, // Accurate logical segment count
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
                const ptsDiff = Math.abs(c1.segmentCount - c2.segmentCount);
                
                // Allow for 90-degree rotated clones by comparing longest & shortest sides
                const max1 = Math.max(c1.bbox.width, c1.bbox.height);
                const min1 = Math.min(c1.bbox.width, c1.bbox.height);
                const max2 = Math.max(c2.bbox.width, c2.bbox.height);
                const min2 = Math.min(c2.bbox.width, c2.bbox.height);
                
                const dimDiff = Math.abs(max1 - max2) / (max1 || 1) + 
                                Math.abs(min1 - min2) / (min1 || 1);

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
        let segmentStats = {}; 
        let metaShapeStatus = {}; 

        this.structuredModel.forEach(contour => {
            if (contour.is_noise) {
                GraphicsManager.paths[contour.originalIndex].tempHidden = true;
                return;
            }

            const points = contour.points;
            if (!points || points.length < 2) return;

            const isClosed = GeometryUtils.isEffectivelyClosed(points);
            const N = contour.segmentCount;
            const p0 = points[0];
            const pn = points[points.length - 1];
            const isClosingPt = Math.abs(p0.x - pn.x) < 0.1 && Math.abs(p0.y - pn.y) < 0.1;

            // Tally segment stats dynamically
            segmentStats[N] = (segmentStats[N] || 0) + 1;

            let type = "polygon";

            if (isClosed) {
                switch(N) {
                    case 3: type = "triangle"; break;
                    case 4: 
                        type = "quad";
                        let allRight = true;
                        // For a closed quad with P points, check angles between segments
                        // If p0 == pn, we check p0-p1-p2, p1-p2-p3, p2-p3-p4, p3-p4-p0
                        const checkPoints = isClosingPt ? points.slice(0, -1) : points;
                        for (let i = 0; i < 4; i++) {
                            const cp1 = checkPoints[i];
                            const cp2 = checkPoints[(i+1)%4];
                            const cp3 = checkPoints[(i+2)%4];
                            const angle = GeometryUtils.getAngleAtNode(cp1, cp2, cp3);
                            if (Math.abs(angle - 90) > ANG_TOL) allRight = false;
                        }
                        if (allRight) {
                            const d1 = GeometryUtils.getDistance(checkPoints[0], checkPoints[1]);
                            const d2 = GeometryUtils.getDistance(checkPoints[1], checkPoints[2]);
                            const tol = this.nominalValue > 0 ? (LEN_TOL * (this.nominalValue / this.pxToUnitRatio)) : 2.0;
                            type = (Math.abs(d1 - d2) < tol) ? "square" : "rectangle";
                        }
                        break;
                    case 8: type = "rrect"; break;
                    default: {
                        // Topographical Check for Arch (Свод)
                        const checkPoints = isClosingPt ? points.slice(0, -1) : points;
                        let corners90 = [];
                        let isSmoothElse = true;
                        let signs = [];
                        
                        for (let i = 0; i < N; i++) {
                            const p1 = checkPoints[(i - 1 + N) % N];
                            const p2 = checkPoints[i];
                            const p3 = checkPoints[(i + 1) % N];
                            
                            const cp = GeometryUtils.getCrossProduct(p1, p2, p3);
                            if (Math.abs(cp) > 0.1) signs.push(Math.sign(cp));
                            
                            const angle = GeometryUtils.getAngleAtNode(p1, p2, p3);
                            if (Math.abs(angle - 90) < 15) { // Allow 75-105 deg for manual architectural base
                                corners90.push(i);
                            } else if (angle < 120) {
                                isSmoothElse = false;
                            }
                        }
                        
                        const isConvex = signs.length > 0 && signs.every(s => s === signs[0]);
                        
                        if (isConvex && corners90.length === 2 && isSmoothElse) {
                            const diff = Math.abs(corners90[0] - corners90[1]);
                            if (diff === 1 || diff === N - 1) {
                                type = "arch";
                                break;
                            }
                        }

                        // Fallback to Circle, Ellipse, or N-gon
                        if (N > 8) {
                            const centroid = GeometryUtils.getCentroid(checkPoints);
                            let dists = checkPoints.map(p => GeometryUtils.getDistance(p, centroid));
                            const Rmax = Math.max(...dists);
                            const Rmin = Math.min(...dists);
                            
                            if ((Rmax - Rmin) / (Rmax || 1) <= 0.15) {
                                type = "circle";
                            } else {
                                type = "ellipse";
                            }
                        } else {
                            type = `${N}-gon`;
                        }
                        break;
                    }
                }
            } else {
                // Open paths
                if (N === 1) type = "line";
                else if (N >= 3) {
                    let isSmooth = true;
                    let signs = [];
                    for (let i = 1; i < points.length - 1; i++) {
                        const angle = GeometryUtils.getAngleAtNode(points[i-1], points[i], points[i+1]);
                        if (angle < 90) isSmooth = false; // Angles smaller than 90 indicate sharp jagged turns, not an arc
                        const cp = GeometryUtils.getCrossProduct(points[i-1], points[i], points[i+1]);
                        if (Math.abs(cp) > 0.1) signs.push(Math.sign(cp));
                    }
                    if (isSmooth && signs.length > 0 && signs.every(s => s === signs[0])) type = "arc";
                    else type = "polyline";
                } else {
                    type = "polyline";
                }
            }

            contour.figureType = type;
            
            // Visuals
            const palette = {
                triangle: "#e74c3c", square: "#2ecc71", rectangle: "#27ae60", quad: "#1abc9c",
                circle: "#f1c40f", ellipse: "#f39c12", rrect: "#d35400", arc: "#9b59b6",
                arch: "#8e44ad", // Deep Purple for Vaults/Arches
                line: "#3498db", polyline: "#7f8c8d", polygon: "#34495e"
            };
            GraphicsManager.paths[contour.originalIndex].tempColor = palette[type] || "#34495e";

            if (contour.is_meta_group) {
                metaShapeStatus[type] = (metaShapeStatus[type] || 0) + 1;
            }
            if (contour.is_nominal) {
                GraphicsManager.paths[contour.originalIndex].tempColor = "#00ffff"; 
            }
        });

        // Build segment report
        let segmentReport = [];
        Object.keys(segmentStats).sort((a,b) => a-b).forEach(n => {
            segmentReport.push(`${n}seg: ${segmentStats[n]}`);
        });

        const nominal = this.structuredModel.find(c => c.is_nominal);
        const nominalStr = nominal ? `Nominal: ${nominal.figureType.toUpperCase()}` : "Nominal: Unknown";
        
        let groups = [];
        for (let t in metaShapeStatus) { 
            const label = t.charAt(0).toUpperCase() + t.slice(1);
            groups.push(`${metaShapeStatus[t]} ${label}s`); 
        }
        const groupsStr = groups.length > 0 ? `Groups: ${groups.join(", ")}` : "No Groups";

        const msg = `<span style='font-size:14px'><b>${nominalStr}</b> | ${segmentReport.join(", ")}<br><small>${groupsStr} | Note: Nominal element is excluded from Group counts</small></span>`;
        this.updateStatus(msg);
    },

    performReporting: function() {
        let lines = [];
        let plainLines = []; // For clipboard
        
        this.structuredModel.forEach((c) => {
            if (c.is_noise) return;
            const type = c.figureType ? c.figureType.toUpperCase() : "UNKNOWN";
            const N = c.segmentCount;
            const prefixHtml = c.is_nominal ? "<strong style='color:#00ffff'>[NOMINAL]</strong> " : 
                               (c.is_meta_group ? "<span style='color:#00ffff'>[GROUPED]</span> " : "");
            const prefixPlain = c.is_nominal ? "[NOMINAL] " : (c.is_meta_group ? "[GROUPED] " : "");
            
            const w = c.bbox.width.toFixed(1);
            const h = c.bbox.height.toFixed(1);
            
            lines.push(`&bull; ID: ${c.id.replace('CTR_','')} | ${N}seg | ${type} | ${prefixHtml} (W: ${w}, H: ${h})`);
            plainLines.push(`ID: ${c.id.replace('CTR_','')} | ${N}seg | ${type} | ${prefixPlain} (W: ${w}, H: ${h})`);
        });

        // Store for clipboard access
        this._lastReportText = `Elements Report:\n` + plainLines.join("\n");

        const scrollBox = `<div style="max-height:200px; overflow-y:auto; text-align:left; background:rgba(0,0,0,0.5); padding:8px; margin-top:5px; border-radius:4px; font-family:monospace; line-height:1.4;">
            ${lines.join("<br>")}
        </div>`;

        const copyBtn = `<button onclick="navigator.clipboard.writeText(NominalManager._lastReportText).then(()=>alert('Скопирано в клипборда!'))" style="background:#3498db; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:11px; margin-left: 10px;">Copy Report</button>`;

        this.updateStatus(`Detailed Elements Report (${lines.length} items) ${copyBtn}<br>${scrollBox}`);
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
