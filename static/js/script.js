let map, districtLayer, stateLayer;
let ghostMap, ghostLayer, ghostStateLayer; // Added ghostStateLayer
let globalGeoJSON, globalDataMap, globalStateGeoJSON; // Added globalStateGeoJSON
let allDistricts = [];
let stateStats = {};
let ghostDataCache = [];
let currentModule = 'map'; 
let logisticsMap, logisticsLayer, logisticsFlowLayer;
let logisticsDataCache = null;
let logisticsStateLayer; // To hold state labels
let logisticsLabelLayer; // To hold specific district labels
let currentTerminalPage = 1;
const ITEMS_PER_PAGE = 8;
let currentMigPincodePage = 1;     // For Migration Sidebar
const MIG_PINCODES_PER_PAGE = 8;   // 8 items per page

let currentLogTablePage = 1;       // For Logistics District Panel (Table)
const LOG_TABLE_PER_PAGE = 5;      // 5 items per page
let currentMigPage = 1;
const MIG_ROWS_PER_PAGE = 12; // [FIX] Show 12 items per page to fill the view
let currentMigData = [];
let fullMigData = [];
let currentMigCategory = 3; // [NEW] Stores the category (color) for pagination
const canvasRenderer = L.canvas({ padding: 0.5 });
let currentLogisticsFilterDistrict = null; // To filter the sidebar list by district
const LOG_ITEMS_PER_PAGE = 10;     // Increased to fill the sidebar better
// [CHANGE] "World" bounds so the map NEVER cuts off in any direction
const INDIA_BOUNDS = [
    [-90, -180],  // South West (Bottom Left of World)
    [90, 180]     // North East (Top Right of World)
];

let currentLeaderboardLimit = 5; // Default view for Risk Leaderboard
const myRenderer = L.canvas({ padding: 0.5 });
let currentForensicData = []; // Stores the real data from API
let currentForensicPage = 1;  // Tracks current page
const ROWS_PER_PAGE = 8   // Rows to show per page
let ghostStateLabelMap = new Map(); // Global storage for ghost state labels
let globalBiThresholds = null;
let currentBiBins = new Map(); // Stores {DistrictName: BinIndex(0-8)}
const currentBiColors = [
    '#e74c3c', '#c0392b', '#8e44ad', // Row 1 (Top)
    '#e67e22', '#95a5a6', '#9b59b6', // Row 2 (Mid)
    '#f1c40f', '#3498db', '#2980b9'  // Row 3 (Bot)
];
// --- SANKALP REAL-TIME ENGINE ---

// --- SANKALP REAL-TIME ENGINE ---

// --- SANKALP REAL-TIME ENGINE ---

const formatCurrency = (value) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)} Lakhs`;
    return `₹${Math.floor(value).toLocaleString('en-IN')}`;
};

function updateSimulationTicker(mode, dataInput, isSingleDistrict = false) {
    // 1. SAFE ELEMENT SELECTION (Prevents Crashes)
    const value1 = document.getElementById('ticker-value-1');
    const value2 = document.getElementById('ticker-value-2');
    const value3 = document.getElementById('ticker-value-3');

    // Stop if the core ticker elements don't exist yet
    if (!value1 || !value2 || !value3) return;

    // Select Labels & Descriptions safely
    const label1 = document.getElementById('ticker-label-1');
    const desc1  = document.getElementById('ticker-desc-1');
    const label2 = document.getElementById('ticker-label-2');
    const desc2  = document.getElementById('ticker-desc-2');
    const desc3  = document.getElementById('ticker-desc-3');
    
    // Safe sibling selection for Label 3
    const label3 = value3.previousElementSibling; 

    // Convert single object to array for uniform math
    const dataSet = isSingleDistrict ? [dataInput] : dataInput;
    
    let totalSavings = 0;
    let totalRisk = 0;
    let totalPeople = 0;

    // --- MODULE 1: MIGRATION MAP (LOGIC UNCHANGED) ---
    if (mode === 'map') {
        // [Restore Standard Labels]
        if (label1) label1.innerText = "MONEY WE CAN SAVE";
        if (desc1)  desc1.innerText  = "Value of idle kits available for recovery";
        
        if (label2) label2.innerText = "RISK OF LOSS";
        if (desc2)  desc2.innerText  = "Potential subsidy leakage (Gap × Cost)";
        
        if (label3) label3.innerText = "PEOPLE AFFECTED";
        if (desc3)  desc3.innerText  = "Total citizens in this view";

        // Logic
        if (dataSet) {
            dataSet.forEach(d => {
                totalPeople += ((d.adult || 0) + (d.child || 0));
                
                let baseRisk = 15000; 
                let baseSavings = 25000;

                if (d.category === 3) { // RED (Worker)
                    totalSavings += (20 * 150000); 
                    totalRisk += ((d.compliance_gap || 0) * 100) + baseRisk;
                } else if (d.category === 2) { // ORANGE (Transit)
                    totalSavings += (10 * 150000); 
                    totalRisk += ((d.compliance_gap || 0) * 250) + baseRisk;
                } else if (d.category === 0) { // BLUE (Family)
                    totalSavings += baseSavings; 
                    totalRisk += ((d.compliance_gap || 0) * 500) + baseRisk;
                } else { // GREEN (Balanced)
                    totalSavings += (2 * 150000); 
                    totalRisk += ((d.compliance_gap || 0) * 200) + baseRisk;
                }
            });
        }

        value1.innerText = formatCurrency(totalSavings);
        value1.className = "fw-bold text-success";
        value2.innerText = formatCurrency(totalRisk);
        value2.className = "fw-bold text-warning";
        value3.innerText = totalPeople >= 1000000 ? `${(totalPeople/1000000).toFixed(2)} M` : totalPeople.toLocaleString('en-IN');
    }

    // --- MODULE 3: LOGISTICS (THE ROI ENGINE) ---
    // --- MODULE 3: LOGISTICS (THE ROI ENGINE) ---
    else if (mode === 'logistics') {
        
        // 1. DIFFERENTIAL COST VALUES (The Math)
        // Logic: Moving an existing kit is cheaper than buying a new one.
        const COST_BUY_NEW = 150000;   // ₹1.5 Lakhs (Price of new Aadhaar Kit)
        const COST_TRANSPORT = 5000;   // ₹5,000 (Cost to move a kit)
        const PEOPLE_PER_KIT = 1000;   // Capacity added per kit

        // 2. DEFAULT LABELS (Gov Terminology)
        if (label1) label1.innerText = "CAPEX AVOIDANCE";
        if (desc1)  desc1.innerText  = "Savings vs. procurement of new hardware";
        
        if (label2) label2.innerText = "DEPLOYMENT OPEX";
        if (desc2)  desc2.innerText  = "Cost for logistics & transport";
        
        if (label3) label3.innerText = "CAPACITY ADDED";
        if (desc3)  desc3.innerText  = "Citizens served by re-allocated units";

        // 3. GET REAL DATA FROM PYTHON
        const allRoutes = window.logisticsRawRoutes || [];
        const allNodes = window.logisticsRawNodes || [];

        let movingKits = 0;
        let peopleCount = 0;
        let savings = 0;
        let cost = 0;

        // --- DRILL DOWN VIEW (Single District) ---
        if (isSingleDistrict && dataSet && dataSet[0]) {
            const d = dataSet[0]; 
            const distName = d.District;
            
            // Find the full node data to get the Real Backlog and Z-Score
            const nodeData = allNodes.find(n => n.District === distName) || d;
            const realBacklog = Math.abs(nodeData.backlog || 0); 

            // SCENARIO A: RECEIVER (Red/Critical) - They are GETTING kits
            // Logic: Money Saved = (Kits * New Price) - (Kits * Transport Price)
            if ((nodeData.z_score || 0) > 0.5) {
                movingKits = allRoutes
                    .filter(r => r.to_dist === distName)
                    .reduce((sum, r) => sum + (r.amount || 0), 0);
                
                savings = (movingKits * COST_BUY_NEW) - (movingKits * COST_TRANSPORT);
                cost = movingKits * COST_TRANSPORT;
                peopleCount = realBacklog; // People waiting here

                if (label1) label1.innerText = "NET SAVINGS";
                if (desc1)  desc1.innerText  = `Saved by reusing ${movingKits} kits`;
                if (label3) label3.innerText = "PEOPLE WAITING"; 
                if (desc3)  desc3.innerText  = "Citizens in backlog here";
            } 
            // SCENARIO B: SENDER (Green/Surplus) - They are SENDING kits
            // Logic: Savings = Value of Assets Unlocked (Inventory put to use)
            else if ((nodeData.z_score || 0) < -0.5) {
                movingKits = allRoutes
                    .filter(r => r.from_dist === distName)
                    .reduce((sum, r) => sum + (r.amount || 0), 0);

                savings = movingKits * COST_BUY_NEW; // Value of the hardware unlocked
                cost = movingKits * COST_TRANSPORT;
                peopleCount = Math.abs(movingKits * PEOPLE_PER_KIT);

                if (label1) label1.innerText = "ASSETS UNLOCKED";
                if (desc1)  desc1.innerText  = "Value of idle inventory activated";
                if (label3) label3.innerText = "IMPACT POTENTIAL"; 
                if (desc3)  desc3.innerText  = "Citizens helped elsewhere";
            }
            // SCENARIO C: BALANCED
            else {
                savings = 0; cost = 0; peopleCount = 0;
                if (label1) label1.innerText = "OPTIMIZED";
                if (desc1)  desc1.innerText  = "No intervention required";
                if (label2) label2.innerText = "ZERO COST";
                if (desc2)  desc2.innerText  = "No movement needed";
            }

        } 
        // --- NATIONAL VIEW (Aggregate) ---
        else {
            movingKits = allRoutes.reduce((sum, r) => sum + (r.amount || 0), 0);
            
            // Total Savings = (Buying New) - (Moving Old)
            const totalBuyCost = movingKits * COST_BUY_NEW;
            const totalMoveCost = movingKits * COST_TRANSPORT;
            
            savings = totalBuyCost - totalMoveCost;
            cost = totalMoveCost;
            peopleCount = Math.abs(movingKits * PEOPLE_PER_KIT);
        }

        // 5. UPDATE DISPLAY
        value1.innerText = formatCurrency(savings);
        value1.className = "fw-bold text-success";

        value2.innerText = formatCurrency(cost);
        value2.className = "fw-bold text-white";

        value3.innerText = peopleCount.toLocaleString('en-IN');
        value3.className = "fw-bold text-info";
    }
    // --- MODULE 2: FRAUD CHECK (UPDATED FINANCIAL LOGIC) ---
    else if (mode === 'risks') {
        
        // 1. LABELS FOR FRAUD
        if (label1) label1.innerText = "FUNDS SECURED";
        if (desc1)  desc1.innerText  = "Subsidy money safely reaching real people";
        
        if (label2) label2.innerText = "DETECTED LEAKAGE";
        if (desc2)  desc2.innerText  = "Monthly loss to fake/ghost accounts";
        
        if (label3) label3.innerText = "PENDING VERIFICATION";
        if (desc3)  desc3.innerText  = "Citizens who need to update biometrics";

        // 2. MATH
        let securedMoney = 0;
        let leakageMoney = 0;
        let pendingPeople = 0;

        if (dataSet) {
            dataSet.forEach(d => {
                securedMoney += ((d.bio || 0) * 500); 
                leakageMoney += ((d.compliance_gap || 0) * 500);
                pendingPeople += (d.compliance_gap || 0);
            });
        }

        // 3. CONTEXT AWARE COLORS
        if (isSingleDistrict && dataSet && dataSet[0]) {
            const d = dataSet[0];
            
            if (d.risk_label === 'HIGH RISK') {
                if (label2) label2.innerText = "CRITICAL LEAKAGE";
                value2.className = "fw-bold text-danger"; 
                if (desc2) desc2.innerText  = "Immediate action required here";
            } else if (d.risk_label === 'SAFE') {
                if (label1) label1.innerText = "100% SECURED";
                value1.className = "fw-bold text-success"; 
                if (desc1) desc1.innerText  = "No leakage detected here";
                
                if (label2) label2.innerText = "ZERO LOSS";
                value2.className = "fw-bold text-muted"; 
            }
        } else {
            value1.className = "fw-bold text-success";
            value2.className = "fw-bold text-danger";
        }

        // 4. UPDATE VALUES
        value1.innerText = formatCurrency(securedMoney);
        value2.innerText = formatCurrency(leakageMoney);
        
        value3.innerText = pendingPeople >= 1000000 
            ? `${(pendingPeople/1000000).toFixed(2)} M` 
            : pendingPeople.toLocaleString('en-IN');
    }
}

let logisticsStateLabelMap = new Map();    // Store State Text Labels
let logisticsDistrictLabelMap = new Map(); // Store District Text Labels
let logisticsStateFlows = []; // Stores aggregated State Data
let logisticsDistrictFlows = []; // Stores raw District Data
let currentLogisticsView = 'STATE'; // 'STATE' or 'DISTRICT'
let currentLogisticsPage = 1;
let currentFilterState = null; // Which state are we drilling down into?
let ghostLabelMap = new Map();
let activeScannerFilter = null; // null = Default Map, 0-8 = Scanner Active
let pulseLayerGroup = L.layerGroup();
let activeLogisticsDistricts = new Set(); 
const biDetails = [
    // ROW 1: HIGH WORKFORCE (Top)
    { 
        title: "PURE WORKFORCE", 
        desc: "<b>[High Work / Low Family]</b><br>Industrial hubs. Mostly solo workers." 
    },
    { 
        title: "INDUSTRIAL CENTRE", 
        desc: "<b>[High Work / Medium Family]</b><br>Factory towns with some families." 
    },
    { 
        title: "METRO CITY", 
        desc: "<b>[High Work / High Family]</b><br>Big cities. Jobs plus full families." 
    },

    // ROW 2: MEDIUM WORKFORCE (Middle)
    { 
        title: "TRANSIT HUB", 
        desc: "<b>[Medium Work / Low Family]</b><br>Transport stops. Floating population." 
    },
    { 
        title: "AVERAGE TOWN", 
        desc: "<b>[Medium Work / Medium Family]</b><br>Standard mix of homes and jobs." 
    },
    { 
        title: "COMMUTER ZONE", 
        desc: "<b>[Medium Work / High Family]</b><br>Suburbs. People sleep here, work elsewhere." 
    },

    // ROW 3: LOW WORKFORCE (Bottom)
    { 
        title: "RETIREMENT AREA", 
        desc: "<b>[Low Work / Low Family]</b><br>Mostly elderly residents." 
    },
    { 
        title: "OUT-MIGRATION", 
        desc: "<b>[Low Work / Medium Family]</b><br>Young people left. Seniors & kids remain." 
    },
    { 
        title: "SOURCE VILLAGE", 
        desc: "<b>[Low Work / High Family]</b><br>Rural areas sending money home." 
    }
];

let comparisonList = [];
let compareMode = false;
let districtLabelMap = new Map(); // Store district label markers
let stateLabelMap = new Map();    // Store state label markers
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Main Map with Bounds
    map = L.map('map-canvas', {
        
    zoomControl: true, zoomSnap: 0.5, zoomDelta: 0.5, attributionControl: false,
    minZoom: 4,
    maxZoom: 10,
    maxBounds: INDIA_BOUNDS,
    maxBoundsViscosity: 0.6 // Changed from 1.0 to 0.6 (Allows partial dragging)
}).setView([22.5, 82], 4.5);
    // 2. Fetch Data
    try {
        const [districtRes, stateRes, dataRes, statsRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson'),
            fetch('https://raw.githubusercontent.com/geohacker/india/master/state/india_state.geojson'),
            fetch('/api/map-data'),
            fetch('/api/stats')
        ]);

        const districtGeoJSON = await districtRes.json();
        const stateGeoJSON = await stateRes.json();
        const mapData = await dataRes.json();
        const statsData = await statsRes.json();

        globalGeoJSON = districtGeoJSON;
        globalStateGeoJSON = stateGeoJSON; // Save for Ghost Map
        globalDataMap = new Map(mapData.map(d => [d.District, d]));
        allDistricts = mapData;
        stateStats = statsData.states;

        // 3. Update Sidebar KPIs
        if(document.getElementById('kpi-total')) document.getElementById('kpi-total').innerText = statsData.global.total;
        if(document.getElementById('kpi-risk')) document.getElementById('kpi-risk').innerText = statsData.global.critical;
        if(document.getElementById('kpi-ghosts')) document.getElementById('kpi-ghosts').innerText = statsData.global.high_risk_districts;

        populateSearch(mapData, stateGeoJSON);
        initGhostLab(mapData);
        
        // 4. Initialize Map Layers
        initMapLayers(districtGeoJSON, stateGeoJSON);

    } catch (err) {
        console.error("Error loading data:", err);
    }
});
function getPolicyTooltip(d, name) {
    if (!d) return `<div style="padding:4px; font-weight:bold; color:#0f172a;">${name}</div>`;

    let status = "BALANCED AREA";
    let message = "Equal mix of workers and families.";
    let color = "#27ae60"; 
    let action = "Monitor Quarterly";
    let actionLabel = "STATUS";

    if (d.category === 3) { 
        status = "WORKER HUB";
        message = "High influx of labor force.";
        color = "#c0392b"; 
        action = "Deploy Labor Housing";
        actionLabel = "RECOMMENDATION";
    } else if (d.category === 0) { 
        status = "FAMILY ZONE";
        message = "High remittance dependency.";
        color = "#2980b9"; 
        action = "Audit Welfare Schemes";
        actionLabel = "RECOMMENDATION";
    } else if (d.category === 2) { 
        status = "TRANSIT NODE";
        message = "Floating population detected.";
        color = "#f39c12"; 
        action = "Increase Transport Frequency";
        actionLabel = "RECOMMENDATION";
    }

    const workerPct = d.adult_share.toFixed(1);
    const familyPct = d.child_share.toFixed(1);

    return `
    <div style="font-family:'Segoe UI', sans-serif; min-width: 160px; max-width: 180px; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); background: #0f172a; border: 1px solid rgba(255,255,255,0.2);">
        <div style="background: ${color}; color: white; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-size: 10px; opacity: 0.9; letter-spacing: 0.5px;">DISTRICT PROFILE</div>
                <div style="font-weight: 800; font-size: 11px;">${name.toUpperCase()}</div>
            </div>
        </div>
        
        <div style="padding: 8px 10px; color: #f8fafc;">
            <div style="margin-bottom: 6px;">
                <div style="font-size: 9px; color: #94a3b8; text-transform:uppercase;">Classification</div>
                <div style="font-weight: bold; font-size: 10px; color: ${color};">${status}</div>
                <div style="font-size: 9px; color: #cbd5e1; margin-top:1px; line-height: 1.2;">${message}</div>
            </div>

            <div style="background: rgba(255,255,255,0.05); padding: 6px; border-radius: 4px; margin-top: 6px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 9px;">
                    <span style="color: #94a3b8;">Workers</span>
                    <strong style="color: #fff;">${workerPct}%</strong>
                </div>
                <div style="height: 3px; width: 100%; background: #334155; border-radius: 2px; margin-bottom: 5px; overflow: hidden;">
                    <div style="height: 100%; width: ${workerPct}%; background: #c0392b;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 9px;">
                    <span style="color: #94a3b8;">Families</span>
                    <strong style="color: #fff;">${familyPct}%</strong>
                </div>
                <div style="height: 3px; width: 100%; background: #334155; border-radius: 2px; overflow: hidden;">
                    <div style="height: 100%; width: ${familyPct}%; background: #2980b9;"></div>
                </div>
            </div>
        </div>

        <div style="background: rgba(255,255,255,0.05); padding: 6px 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 9px; color: #f8fafc; white-space: normal; line-height: 1.3;">
            <span style="color: #94a3b8; font-weight:bold;">${actionLabel}:</span> ${action}
        </div>
    </div>`;
}
function getScannerTooltip(d, name, info) {
    const color = currentBiColors[activeScannerFilter];
    
    // Very Simple Math Display
    const avg = 95; 
    const diff = (d.adult_share - avg).toFixed(0);
    // Changed "adults" to "workers" here
    const text = diff > 0 ? "More workers than avg" : "Fewer workers than avg";

    return `
    <div style="font-family:'Segoe UI', sans-serif; min-width:150px; box-shadow:0 4px 15px rgba(0,0,0,0.15);">
        <div style="border-left:5px solid ${color}; background:white; padding:8px;">
            
            <div style="font-size:12px; font-weight:bold; color:#2c3e50;">${name.toUpperCase()}</div>
            <div style="font-size:10px; color:#888; margin-bottom:5px;">${d.State}</div>

            <div style="background:${color}20; color:${color}; font-size:9px; font-weight:bold; padding:3px 6px; display:inline-block; border-radius:3px; margin-bottom:5px;">
                ${info.title}
            </div>
            
            <div style="background:#f4f4f4; padding:5px; border-radius:4px;">
                <div style="font-size:10px; font-weight:bold; color:#333;">
                    ${text}
                </div>
                <div style="font-size:9px; color:#555;">
                    Workers: ${d.adult_share.toFixed(0)}%
                </div>
            </div>
        </div>
    </div>`;
}
const svgRenderer = L.svg({ padding: 0.5 });   // For Visuals (Animation)
function initLogisticsMap() {
    if (logisticsMap) return;

    // [FIX] Updated style: Removed "border: 1px solid white"
    const style = document.createElement('style');
    style.innerHTML = `
        .red-dot-dynamic {
            width: 12px; height: 12px;
            background: #c0392b; 
            border: none; /* REMOVED WHITE BORDER */
            border-radius: 50%;
            box-shadow: 0 0 5px rgba(192, 57, 43, 0.8);
            transition: all 0.3s ease;
        }
        .zoom-out-mode .red-dot-dynamic {
            width: 6px !important; height: 6px !important;
            border: none !important; box-shadow: none !important;
            transform: translate(3px, 3px);
        }
    `;
    document.head.appendChild(style);

    logisticsMap = L.map('logistics-map', {
        zoomControl: false, 
        attributionControl: false,
        minZoom: 4, maxZoom: 10,
        maxBounds: INDIA_BOUNDS, 
        maxBoundsViscosity: 0.0,
        preferCanvas: true // <--- THIS IS THE KEY FIX FOR LAG
    }).setView([22.5, 82], 4.5);
    logisticsMap.on('click', function(e) {
        // If we are currently filtered, clicking empty space resets the view
        if (logisticsMap.isFiltered) {
            resetLogisticsMapFilter();
        }
    });
    L.control.zoom({ position: 'topleft' }).addTo(logisticsMap);
    logisticsMap.on('click', (e) => {
        if (logisticsMap && logisticsMap._tooltip) {
            try { logisticsMap.closeTooltip(); } catch(e) { }
        }
        closeLogisticsPanel();
        resetToNationalView(); 
        if (logisticsFlowLayer) {
            logisticsFlowLayer.eachLayer(layer => {
                 if (layer._path) layer._path.classList.add('flow-line-anim'); 
            });
        }
    });

    logisticsLayer = L.geoJSON(globalGeoJSON, {
        style: { fillColor: '#1e293b', weight: 0.5, opacity: 1, color: '#334155', fillOpacity: 0.4 },
        interactive: false 
    }).addTo(logisticsMap);

    // [FIND THIS SECTION INSIDE initLogisticsMap]
    logisticsStateLayer = L.geoJSON(globalStateGeoJSON, {
        style: { 
            fill: true, fillColor: '#1e293b', fillOpacity: 0.0, 
            color: '#94a3b8', weight: 1.5, opacity: 0.8 
        }, 
        onEachFeature: (feature, layer) => {
            let name = feature.properties.NAME_1;

            // --- NAME CLEANUP ---
            if(name === "Orissa") name = "Odisha";
            if(name === "Uttaranchal") name = "Uttarakhand";

            layer.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                $('#log-state-filter').val(name).trigger('change'); // Use corrected name
            });

            if (feature.properties && feature.properties.NAME_1) {
                // --- APPLY COORDINATE FIX ---
                let center = layer.getBounds().getCenter();
                if (STATE_LABEL_FIXES[name]) {
                    center = L.latLng(STATE_LABEL_FIXES[name]);
                }

                const icon = L.divIcon({
                    className: 'log-state-label text-secondary',
                    html: `<div>${name}</div>`,
                    iconSize: [100, 20], iconAnchor: [50, 10]
                });
                const marker = L.marker(center, {icon: icon, interactive: false}).addTo(logisticsMap);
                logisticsStateLabelMap.set(name, marker); // Use corrected name as key
            }
        }
    }).addTo(logisticsMap);

    logisticsFlowLayer = L.layerGroup().addTo(logisticsMap);  
    logisticsLabelLayer = L.layerGroup().addTo(logisticsMap); 

    // --- UPDATED LEGEND WITH LINE INDICATOR ---
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'logistics-legend');
        div.style.background = "rgba(15, 23, 42, 0.95)"; // Dark Slate Theme
        div.style.padding = "10px";
        div.style.borderRadius = "6px";
        div.style.border = "1px solid #334155";
        div.style.color = "#f8fafc";
        div.style.fontSize = "10px";
        div.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
        div.style.minWidth = "140px";

        div.innerHTML = `
            <div style="font-weight:800; color:#94a3b8; margin-bottom:8px; letter-spacing:0.5px;">NETWORK STATUS</div>
            
            <div style="display:flex; align-items:center; margin-bottom:6px;">
                <div style="width:10px; height:10px; background:#c0392b; border-radius:50%; margin-right:8px; box-shadow: 0 0 4px #c0392b;"></div>
                <span style="color:#fff;">Critical Deficit (Import)</span>
            </div>
            
            <div style="display:flex; align-items:center; margin-bottom:6px;">
                <div style="width:8px; height:8px; background:#2ecc71; border-radius:50%; margin-right:10px; margin-left:1px; box-shadow: 0 0 4px #2ecc71;"></div>
                <span style="color:#ccc;">Surplus Hub (Export)</span>
            </div>

            <div style="display:flex; align-items:center;">
                <div style="width:20px; height:2px; background:#f1c40f; margin-right:8px; margin-left:0px;"></div>
                <span style="color:#f1c40f;">Active Transit Route</span>
            </div>
        `;
        return div;
    };
    legend.addTo(logisticsMap);

    logisticsMap.on('zoomend', () => {
        if (currentFilterState && currentFilterState !== 'ALL') return; 
        const zoom = logisticsMap.getZoom();
        if (zoom < 6) {
            logisticsStateLabelMap.forEach(m => m.setOpacity(1));
            logisticsDistrictLabelMap.forEach(m => m.setOpacity(0)); 
        } else {
            logisticsStateLabelMap.forEach(m => m.setOpacity(0));
            logisticsDistrictLabelMap.forEach(m => m.setOpacity(1)); 
        }
    });
}

function closeLogisticsPanel() {
    const sidebar = document.getElementById('logistics-right-sidebar');
    if(sidebar) sidebar.style.right = "-360px"; // Hide
    
    // UNLOCK Filter
    if (logisticsMap) logisticsMap.isFiltered = false;

    // 1. Reset Lines (Restore visibility AND animation)
    if(logisticsFlowLayer) {
        logisticsFlowLayer.eachLayer(layer => {
            // Restore default style (faint yellow)
            if (layer.setStyle) {
                layer.setStyle({ opacity: 0.9, weight: 2, color: '#f1c40f' }); 
            }
            
            // [CRITICAL] Restore the dotted line animation class
            if (layer._path) layer._path.classList.add('flow-line-anim');
        });
    }

    // 2. Reset Dots (Restore visibility)
    if(logisticsLabelLayer) {
        logisticsLabelLayer.eachLayer(layer => {
            // [FIX] Safety Check: Only call setOpacity if the layer supports it (Markers)
            // CircleMarkers (hit zones) do not have this method and will crash otherwise.
            if (typeof layer.setOpacity === 'function') {
                layer.setOpacity(1);
            }
        });
    }

    // 3. Reset Labels based on Zoom
    if (logisticsMap) {
        const zoom = logisticsMap.getZoom();
        if (zoom < 6) {
            logisticsStateLabelMap.forEach(m => m.setOpacity(1));
            logisticsDistrictLabelMap.forEach(m => m.setOpacity(0));
        } else {
            logisticsStateLabelMap.forEach(m => m.setOpacity(0));
            logisticsDistrictLabelMap.forEach(m => m.setOpacity(1));
        }
    }
}
// --- FINANCIAL HUD UTILITY ---
function updateFinancialHUD(savings, risk) {
    const elSavings = document.getElementById('ticker-savings');
    const elRisk = document.getElementById('ticker-risk');

    if (elSavings) {
        // Only animate/update if the value is a number
        if (typeof savings === 'number') {
            animateValue(elSavings, 0, savings, 1000); // Optional animation
            elSavings.innerText = formatMoney(savings);
        } else {
            elSavings.innerText = savings;
        }
    }
    
    if (elRisk) {
        if (typeof risk === 'number') {
            elRisk.innerText = formatMoney(risk);
        } else {
            elRisk.innerText = risk;
        }
    }
}
function formatMoney(amount) {
    // If it's a raw number, format it
    if (typeof amount === 'number') {
        if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} Lakhs`;
        return `₹${amount.toLocaleString('en-IN')}`; // Adds commas: 1,50,000
    }
    return amount; // Return as-is if it's already text
}

// --- 2. CONTEXT-AWARE TICKER MANAGER ---
function setTickerMode(mode) {
    const lblSavings = document.getElementById('label-savings');
    const valSavings = document.getElementById('ticker-savings');
    const lblRisk = document.getElementById('label-risk');
    const valRisk = document.getElementById('ticker-risk');

    if (!lblSavings) return;

    // Reset Animations or Styles here if needed
    valSavings.style.color = "#fff"; 
    valRisk.style.color = "#fff";

    // --- DEFINE STATIC DEFAULT VALUES FOR EACH VIEW ---
    // These appear immediately when you click the tab
    switch(mode) {
        case 'map': // Migration Map
            lblSavings.innerText = "💰 Idle Kit Savings:";
            valSavings.innerText = "₹14.50 Lakhs"; // Static Demo Number
            
            lblRisk.innerText = "🛡️ Service Gap Risk:";
            valRisk.innerText = "₹2.45 Cr"; // Static Demo Number
            break;

        case 'risks': // Fraud Check
            lblSavings.innerText = "🚫 Potential Fraud Blocked:";
            valSavings.innerText = "₹85.00 Lakhs"; // Static Demo Number
            valSavings.style.color = "#2ecc71"; // Green for good news
            
            lblRisk.innerText = "⚠️ Active Leakage Risk:";
            valRisk.innerText = "₹12.50 Lakhs"; 
            valRisk.style.color = "#e74c3c"; // Red for bad news
            break;

        case 'logistics': // Logistics
            lblSavings.innerText = "🏛️ Asset Utilization Gain:";
            valSavings.innerText = "₹1.20 Cr"; 
            
            lblRisk.innerText = "⚡ Allocation Efficiency:";
            valRisk.innerText = "94% Optimal"; 
            break;

        
    }
}
function filterMapToDistrictConnections(districtName) {
    if (!logisticsFlowLayer || !logisticsLabelLayer) return;

    logisticsMap.isFiltered = true; 

    // --- 1. DATA PREPARATION ---
    const connectedDistricts = new Set();
    const connectedStates = new Set();
    connectedDistricts.add(districtName);

    // Register the clicked district's state
    const dData = globalDataMap.get(districtName);
    if (dData && dData.State) connectedStates.add(dData.State);

    // Find ONLY the relevant routes from the raw data
    const relevantRoutes = window.logisticsRawRoutes.filter(r => {
        const isConnected = (r.from_dist === districtName || r.to_dist === districtName);
        if (isConnected) {
            connectedDistricts.add(r.from_dist);
            connectedDistricts.add(r.to_dist);
            
            // Register neighbor states for labels
            const s1 = globalDataMap.get(r.from_dist);
            const s2 = globalDataMap.get(r.to_dist);
            if (s1) connectedStates.add(s1.State);
            if (s2) connectedStates.add(s2.State);
        }
        return isConnected;
    });

    // --- 2. LINE REDRAW (FIXES GHOST HOVER & VISIBILITY) ---
    // Instead of iterating existing layers (which leaves "Ghosts"),
    // we clear and redraw ONLY the connected routes.
    
    // A. Clear current lines (Removes Ghosts)
    logisticsFlowLayer.clearLayers();
    
    // B. Draw only relevant lines (Ensures Visibility)
    drawEqualizerMap(window.logisticsRawNodes, relevantRoutes);

    // C. Force "Solid Line" Style (No Animation for Selection)
    // We iterate the newly created layers to remove the dashing
    logisticsFlowLayer.eachLayer(layer => {
        // Target the Visual SVG Line (The one with the animation class)
        if (layer.options.className === 'flow-line-anim' || layer.options.renderer === svgRenderer) {
            if (layer._path) {
                layer._path.classList.remove('flow-line-anim'); // Stop dashing
            }
            // Make it solid, thick, and fully opaque
            layer.setStyle({ weight: 4, opacity: 1, color: '#f1c40f' });
        }
    });

    // --- 3. STRICT MARKER FILTERING (Keep existing logic) ---
    logisticsLabelLayer.eachLayer(layer => {
        const dName = layer.options.district_name; 
        
        let opacity = 0; 
        if (dName && connectedDistricts.has(dName)) {
            opacity = 1;
        }

        if (typeof layer.setOpacity === 'function') {
            // Marker (Dot/Icon)
            layer.setOpacity(opacity);
        } else if (typeof layer.setStyle === 'function') {
            // CircleMarker (Hit Area) - Hide if not connected
            // IMPORTANT: If we hide the circle, we must also ensure it doesn't block clicks
            if (opacity === 0) {
                layer.setStyle({ opacity: 0, fillOpacity: 0 });
                // Note: We can't easily remove hit area on canvas without redraw, 
                // but usually dots are small enough not to cause major ghosting issues compared to lines.
            } else {
                 layer.setStyle({ opacity: 0, fillOpacity: 0 }); // Keep hit area invisible but present
            }
        }
    });

    // --- 4. FILTER TEXT LABELS ---
    logisticsDistrictLabelMap.forEach((layer, name) => {
        if (connectedDistricts.has(name)) layer.setOpacity(1);
        else layer.setOpacity(0);
    });

    logisticsStateLabelMap.forEach((layer, stateName) => {
        if (connectedStates.has(stateName)) layer.setOpacity(1);
        else layer.setOpacity(0);
    });
}

function resetLogisticsMapFilter() {
    // 1. Reset State
    logisticsMap.isFiltered = false;
    currentLogisticsFilterDistrict = null;

    console.log("⚡ Resetting Map to Full View");

    // 2. Re-Draw Full Data
    // This brings back all routes and dots cleanly.
    if (window.logisticsRawRoutes) {
        drawEqualizerMap(window.logisticsRawNodes, window.logisticsRawRoutes);
    }
}

function updateLogisticsLabels() {
    if (!logisticsMap) return;
    const zoom = logisticsMap.getZoom();
    const threshold = 6; // Zoom level switch

    // We only manage the Active Red/Green labels now.
    // Everything else is permanently hidden by default.

    logisticsLabelLayer.eachLayer(layer => {
        if (layer.getTooltip()) {
            if (zoom >= threshold) {
                // [FIX] Safety check: Ensure layer is actually on the map before opening tooltip
                // This prevents errors if the layer is being removed asynchronously
                if (layer._map) {
                    layer.openTooltip();
                }
            } else {
                // Zoomed Out: Hide text, keep only the dots visible
                layer.closeTooltip();
            }
        }
    });
}
function calculateQuantiles(data, key) {

    if (data.length === 0) return [0, 0];
    const sorted = [...data].map(d => d[key]).sort((a,b) => a - b);
    const p33 = sorted[Math.floor(sorted.length * 0.33)];
    const p66 = sorted[Math.floor(sorted.length * 0.66)];
    return [p33, p66];
}
function getDistrictCenter(name) {
    if (!name) return null;

    // 1. CLEAN INPUT
    const cleanInput = name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // 2. HARDCODED CENTERS (The "Missing District" Fix)
    const HARDCODED_CENTERS = {
        // --- DELHI & NCR ---
        "najafgarh": [28.6090, 76.9855],
        "southwest": [28.5900, 77.0500],
        "southwestdelhi": [28.5900, 77.0500],
        "shahdara": [28.6980, 77.2925],
        "northeast": [28.7130, 77.2700],
        "northeastdelhi": [28.7130, 77.2700],
        "eastdelhi": [28.6280, 77.3000],
        "east": [28.6280, 77.3000],
        "newdelhi": [28.6139, 77.2090],
        "centraldelhi": [28.6448, 77.2167],
        "central": [28.6448, 77.2167],
        "nuh": [28.1110, 77.0110],

        // --- GARBAGE DATA (Explicitly Nullified) ---
        "100000": null,
        "idplcolony": null,
        "nearuniversitythana": null,
        "5thcross": null,
        "neardhyanaashram": null,
        "nearudaynagar": null,
        "nearudaynagarnitgarden": null,
        "nearmeerahospital": null,
        "?": null,

        // --- NORTH EAST INDIA (New Districts) ---
        "kamle": [27.8000, 94.2000], // Arunachal
        "tamulpur": [26.6300, 91.5700], // Assam
        "tamulpurdistrict": [26.6300, 91.5700],
        "niuland": [25.9000, 93.8000], // Nagaland
        "shiyomi": [28.6000, 94.5000], // Arunachal
        "sribhumi": [24.8000, 92.3000], // (Karimganj area)
        "pherzawl": [24.2500, 93.1000], // Manipur
        "chumukedima": [25.8000, 93.7700], // Nagaland
        "sepahijala": [23.6000, 91.3000], // Tripura
        "anjaw": [27.9000, 96.3000], // Arunachal
        "kakching": [24.4000, 93.9000], // Manipur
        "noklak": [26.2000, 95.0000], // Nagaland
        "majuli": [26.9500, 94.1000], // Assam
        "jiribam": [24.8000, 93.1000], // Manipur
        "meluri": [25.6000, 94.6000], // Nagaland
        "kradaadi": [27.5000, 93.5000], // Arunachal
        "southsalmaramankachar": [25.7000, 89.9000], // Assam
        "longleng": [26.4000, 94.8000], // Nagaland
        "charaideo": [27.0000, 94.8000], // Assam
        "leparada": [27.8500, 94.7000],
        "pakkekessang": [27.1000, 93.1000],
        "dimahasao": [25.1800, 93.0300],
        "bajali": [26.5000, 91.1500],
        "hnahthial": [22.9600, 92.9300],
        "kangpokpi": [25.1500, 93.9800],
        "tseminyu": [25.9000, 94.2000],
        "shamator": [26.0500, 94.8500],
        "mangan": [27.5000, 88.5300],
        "namchi": [27.1700, 88.3500],
        "khowai": [24.0600, 91.6000],
        "gomati": [23.5500, 91.5000],

        // --- NORTH INDIA ---
        "charkhidadri": [28.6000, 76.2000], // Haryana
        "leh": [34.1500, 77.5700], // Ladakh
        "bandipur": [34.4200, 74.6500], // J&K (Bandipora)
        "shupiyan": [33.7200, 74.8300], // J&K
        "shopian": [33.7200, 74.8300],
        "mohali": [30.7046, 76.7179],
        "sasnagar": [30.7046, 76.7179],
        "sasnagarmohali": [30.7046, 76.7179],

        // --- WEST/CENTRAL INDIA ---
        "bardez": [15.6000, 73.8000], // Goa
        "tapi": [21.4000, 73.5000], // Gujarat
        "agarmalwa": [23.7000, 76.0000], // MP
        "niwari": [25.3500, 78.8800],
        "mumbaisuburban": [19.1550, 72.8490],
        "mumbaicity": [18.9398, 72.8354],
        "mumbai": [19.0760, 72.8777],
        "diu": [20.7144, 70.9874],
        "bicholim": [15.5800, 73.9500],
        "tiswadi": [15.5000, 73.9000],

        // --- EAST INDIA ---
        "anugul": [20.8500, 85.1500], // Odisha
        "domjur": [22.6400, 88.2200], // WB
        "ballyjagachha": [22.6500, 88.3400], // WB
        "hooghiy": [22.9000, 88.4000], // WB (Hooghly)
        "hooghly": [22.9000, 88.4000],
        "khunti": [23.0700, 85.2700], // Jharkhand
        "southdumdumm": [22.6100, 88.4000], // WB
        "dinajpurdakshin": [25.2200, 88.7600],
        "medinipurwest": [22.4200, 87.3200],
        "balianta": [20.3500, 85.8800],
        "balangir": [20.7100, 83.4800],
        "arwal": [25.2400, 84.6700],

        // --- SOUTH INDIA ---
        "chengalpattu": [12.6900, 79.9700], // TN
        "bapatla": [15.9000, 80.4700], // AP
        "viluppuram": [11.9401, 79.4861],
        "ranipet": [12.9292, 79.3324],
        "tuticorin": [8.7642, 78.1348],
        "kadiriroad": [14.1100, 78.1500],
        "bengalurusouth": [12.9200, 77.5500],
        "bengaluruurban": [12.9716, 77.5946],
        "lakshadweep": [10.5667, 72.6417],
        
        // --- CHHATTISGARH & TELANGANA ---
        "mohallamanpurambagarhchowki": [20.5800, 80.7500],
        "mohlamanpurambagarhchouki": [20.5800, 80.7500],
        "manendragarhchirmiribharatpur": [23.2100, 82.2000],
        "sarangarhbilaigarh": [21.5900, 83.0800],
        "khairagarhchhuikhadangandai": [21.4200, 80.9800],
        "gaurelapendramarwahi": [22.7500, 82.0200],
        "sakti": [22.0200, 82.9600],
        "medchalmalkajgiri": [17.6200, 78.4800],
        "medchal": [17.6200, 78.4800],
        "yadgir": [16.7630, 77.1440]
    };

    // Check Hardcoded list first
    if (Object.prototype.hasOwnProperty.call(HARDCODED_CENTERS, cleanInput)) {
        const val = HARDCODED_CENTERS[cleanInput];
        if (val === null) return null; // Explicitly ignored garbage
        return L.latLng(val);
    }

    // 3. LAYER LOOKUP
    if (!logisticsLayer) return null;

    const OVERRIDES = {
        "salumbar": "udaipur",
        "kotputlibehror": "jaipur",
        "didwanakuchaman": "nagaur",
        "khairthaltijara": "alwar",
        "deeg": "bharatpur",
        "shahpura": "bhilwara",
        "gangapurcity": "sawaimadhopur",
        "phalodi": "jodhpur",
        "balotra": "barmer",
        "sanchore": "jalore"
    };

    let target = OVERRIDES[cleanInput] || cleanInput;
    let center = null;

    logisticsLayer.eachLayer(layer => {
        if (center) return; 

        if (layer.feature && layer.feature.properties) {
            const mapName = layer.feature.properties.NAME_2 || layer.feature.properties.Name || "";
            const cleanMapName = mapName.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (cleanMapName === target) {
                center = layer.getBounds().getCenter();
            } else if ((cleanMapName.includes(target) || target.includes(cleanMapName)) && target.length > 3) {
                center = layer.getBounds().getCenter();
            }
        }
    });

    return center;
}

async function openLogisticsPanel(viewType, contextName, dataObj) {
    const sidebar = document.getElementById('logistics-right-sidebar');
    const contentArea = document.getElementById('right-panel-content');
    const titleArea = document.getElementById('right-panel-title');
    const badge = document.getElementById('right-panel-badge');
    
    // 1. RESOLVE DATA CONTEXT
    let activeNodeData = dataObj;
    
    // Toggle Ticker Button
    const btn = document.getElementById('btn-ticker-reset');
    if(btn) btn.style.display = (viewType === 'NATIONAL') ? 'none' : 'block';

    if (viewType === 'DISTRICT' && window.logisticsRawNodes) {
        const found = window.logisticsRawNodes.find(n => n.District === contextName);
        if (found) activeNodeData = found;
        else {
            const globalD = globalDataMap.get(contextName);
            if (globalD) activeNodeData = globalD;
        }
    }

    // 2. UPDATE HEADER & TICKER
    if (viewType === 'DISTRICT') updateSimulationTicker('logistics', activeNodeData, true);
    else if (viewType === 'NATIONAL') updateSimulationTicker('logistics', window.logisticsRawRoutes, false);

    if (viewType === 'ROUTE') updateLogisticsHeader('DISTRICT', dataObj.to_dist, window.logisticsRawRoutes); 
    else updateLogisticsHeader(viewType, contextName, window.logisticsRawRoutes);

    if(!sidebar) return;
    sidebar.style.right = "0px"; 

    // 3. DETERMINE STATUS (Red/Green/Neutral)
    let districtStatus = 'NEUTRAL';
    if (viewType === 'DISTRICT' && activeNodeData) {
        if ((activeNodeData.z_score || 0) > 0.5) districtStatus = 'CRITICAL';
        else if ((activeNodeData.z_score || 0) < -0.5) districtStatus = 'SURPLUS';
    }

    // 4. SET TITLES
    if (viewType === 'NATIONAL') {
        titleArea.innerText = "NATIONAL OVERVIEW";
        badge.innerText = "ALL INDIA"; badge.className = "badge bg-dark";
    } else if (viewType === 'DISTRICT') {
        titleArea.innerHTML = `${contextName}`;
        if (districtStatus === 'CRITICAL') {
            badge.innerText = "🔴 HIGH DEMAND"; badge.className = "badge bg-danger";
        } else if (districtStatus === 'SURPLUS') {
            badge.innerText = "🟢 IDLE ASSETS"; badge.className = "badge bg-success";
        } else {
            badge.innerText = "BALANCED"; badge.className = "badge bg-secondary";
        }
    } else if (viewType === 'ROUTE') {
        titleArea.innerHTML = `TRIP: <span class="text-warning">${contextName}</span>`; 
        badge.innerText = "IN TRANSIT"; badge.className = "badge bg-warning text-dark";
    }

    // 5. RENDER LOADER
    contentArea.innerHTML = '<div class="d-flex justify-content-center align-items-center h-100"><div class="spinner-border text-primary" role="status"></div></div>';

    // 6. FETCH REAL DATA & RENDER
    try {
        let realPincodeData = [];
        
        // Only fetch pincodes if looking at a District
        if (viewType === 'DISTRICT') {
            const res = await fetch(`/api/district-details?district=${contextName}`);
            const json = await res.json();
            realPincodeData = json.pincodes || [];
        }

        contentArea.innerHTML = ""; 
        
        if (viewType === 'NATIONAL') {
            renderNationalCharts(contentArea, window.logisticsRawNodes); 
        } 
        else if (viewType === 'DISTRICT') {
            if (districtStatus === 'CRITICAL') {
                renderCriticalHubCharts(contentArea, contextName, activeNodeData);
                // PASS REAL DATA HERE
                renderLogisticsPincodeTable(contentArea, contextName, 'CRITICAL', realPincodeData);
            } else if (districtStatus === 'SURPLUS') {
                renderSurplusHubCharts(contentArea, contextName, activeNodeData);
                // PASS REAL DATA HERE
                renderLogisticsPincodeTable(contentArea, contextName, 'SURPLUS', realPincodeData);
            } else {
                renderNeutralHubCharts(contentArea, contextName, activeNodeData);
                renderLogisticsPincodeTable(contentArea, contextName, 'NEUTRAL', realPincodeData);
            }
        } 
        else if (viewType === 'ROUTE') {
            renderRouteCharts(contentArea, dataObj);
        }

    } catch (e) {
        console.error("Logistics Panel Error:", e);
        contentArea.innerHTML = `<div class="text-danger p-3">Error loading logistics data.</div>`;
    }
}
function renderLogisticsPincodeTable(container, districtName, status, realData) {
    if (!realData || realData.length === 0) {
        container.innerHTML += `<div class="text-muted small text-center mt-3">No granular data available.</div>`;
        return;
    }

    // 1. PROCESS REAL DATA
    let rows = realData.map(d => {
        const backlog = d.gap || 0;       
        const throughput = d.bio || 1;    
        const burnRate = Math.ceil(throughput / 30);
        const daysToClear = burnRate > 0 ? (backlog / burnRate).toFixed(1) : "> 30";
        const kitsNeeded = Math.ceil(backlog / 50);

        return {
            pin: d.pin,
            backlog: backlog,
            burnRate: burnRate,
            daysToClear: parseFloat(daysToClear),
            kitsNeeded: kitsNeeded,
            utilization: Math.min(100, (throughput / (throughput + backlog)) * 100)
        };
    });

    // 2. SORTING
    if (status === 'CRITICAL') rows.sort((a,b) => b.backlog - a.backlog);
    else rows.sort((a,b) => a.backlog - b.backlog);

    // [FIX] REMOVED THE HARD SLICE (slice(0,5))
    
    // 3. PAGINATION
    const totalPages = Math.ceil(rows.length / LOG_TABLE_PER_PAGE);
    if (currentLogTablePage < 1) currentLogTablePage = 1;
    if (currentLogTablePage > totalPages) currentLogTablePage = totalPages;

    const start = (currentLogTablePage - 1) * LOG_TABLE_PER_PAGE;
    const end = start + LOG_TABLE_PER_PAGE;
    const pageRows = rows.slice(start, end);

    // 4. BUILD TABLE HTML
    let headers = [];
    let tableHtml = "";

    if (status === 'CRITICAL') {
        headers = ['PINCODE', 'BACKLOG', 'DELAY RISK', 'ACTION'];
        pageRows.forEach(r => {
            let riskLabel = r.daysToClear > 10 ? `<span class="badge bg-danger">Critical (${r.daysToClear}d)</span>` 
                          : `<span class="badge bg-warning text-dark">High (${r.daysToClear}d)</span>`;
            tableHtml += `
            <tr>
                <td class="ps-2 fw-bold font-monospace text-dark">${r.pin}</td>
                <td class="fw-bold text-danger">${r.backlog.toLocaleString()}</td>
                <td>${riskLabel}</td>
                <td class="text-end pe-2">
                    <button class="btn btn-sm py-0 px-2 fw-bold text-white shadow-sm" style="font-size:9px; background:#c0392b; border:none;">+${r.kitsNeeded} KITS</button>
                </td>
            </tr>`;
        });
    } else if (status === 'SURPLUS') {
        headers = ['PINCODE', 'ACTIVITY', 'UTILIZATION', 'ACTION'];
        pageRows.forEach(r => {
            let actionBtn = r.utilization < 30 
                ? `<button class="btn btn-sm py-0 px-2 fw-bold text-white shadow-sm" style="font-size:9px; background:#27ae60;">RECOVER</button>`
                : `<span class="text-muted" style="font-size:9px;">Keep</span>`;

            tableHtml += `
            <tr>
                <td class="ps-2 fw-bold font-monospace text-dark">${r.pin}</td>
                <td class="text-dark">${r.burnRate}/day</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height:4px; background:#e9ecef; width:40px;">
                            <div class="progress-bar bg-success" style="width:${r.utilization}%"></div>
                        </div>
                        <span style="font-size:9px;">${r.utilization.toFixed(0)}%</span>
                    </div>
                </td>
                <td class="text-end pe-2">${actionBtn}</td>
            </tr>`;
        });
    } else {
        headers = ['PINCODE', 'LOAD', 'STATUS', ''];
        pageRows.forEach(r => {
            tableHtml += `
            <tr>
                <td class="ps-2 fw-bold font-monospace">${r.pin}</td>
                <td>${r.backlog}</td>
                <td><span class="badge bg-light text-dark border">Stable</span></td>
                <td></td>
            </tr>`;
        });
    }

    // 5. RENDER CONTAINER
    let containerTitle = status === 'CRITICAL' ? '🚨 HIGH-PRIORITY NODES' : (status === 'SURPLUS' ? '📦 ASSET RECOVERY' : '📍 NETWORK STATUS');

    let html = `
    <div class="mt-3 animate-fade-in">
        <div class="d-flex justify-content-between align-items-center mb-2 px-1">
            <h6 class="fw-bold text-secondary m-0" style="font-size:10px; letter-spacing:0.5px;">${containerTitle}</h6>
            <span class="badge bg-white text-secondary border" style="font-size:9px;">LIVE DATA</span>
        </div>
        
        <div class="table-responsive border rounded bg-white shadow-sm">
            <table class="table table-sm table-hover m-0 align-middle" style="font-size:10px;">
                <thead class="bg-light border-bottom">
                    <tr>
                        <th class="ps-2 text-muted py-2">${headers[0]}</th>
                        <th class="text-muted py-2">${headers[1]}</th>
                        <th class="text-muted py-2">${headers[2]}</th>
                        <th class="text-end pe-2 text-muted py-2">${headers[3]}</th>
                    </tr>
                </thead>
                <tbody>${tableHtml}</tbody>
            </table>
        </div>
        
        <div class="d-flex justify-content-between align-items-center mt-2 px-1">
            <button class="btn btn-sm btn-light border py-0 px-2" style="font-size:10px;" 
                onclick="changeLogTablePage(-1, '${container.id}', '${districtName}', '${status}')" ${currentLogTablePage === 1 ? 'disabled' : ''}>Prev</button>
            <span class="text-muted" style="font-size:9px;">${currentLogTablePage} / ${totalPages}</span>
            <button class="btn btn-sm btn-light border py-0 px-2" style="font-size:10px;" 
                onclick="changeLogTablePage(1, '${container.id}', '${districtName}', '${status}')" ${currentLogTablePage === totalPages ? 'disabled' : ''}>Next</button>
        </div>
    </div>`;
    
    // Append instead of overwrite (so charts stay)
    const div = document.createElement('div');
    div.innerHTML = html;
    container.appendChild(div);
    
    // Store data globally for pagination to work
    window.currentLogTableData = realData; 
}

// Helper for Logistics Table Page Change
function changeLogTablePage(dir, containerId, dName, stat) {
    currentLogTablePage += dir;
    const container = document.getElementById(containerId);
    if(container) {
        // Remove the old table part (last child)
        if(container.lastChild) container.removeChild(container.lastChild);
        renderLogisticsPincodeTable(container, dName, stat, window.currentLogTableData);
    }
}
// [IN script.js] REPLACE renderRouteCharts FUNCTION

function renderRouteCharts(container, data) {
    // 1. SAFETY FALLBACKS (Prevents "undefined")
    // If backend data is missing, we calculate it on the fly from the score
    let velocity = data.velocity_gain;
    let efficiency = data.efficiency;

    if (!velocity) {
        const score = data.score || 10;
        velocity = `${(score * 0.8).toFixed(1)} Hours`;
    }
    
    if (!efficiency) {
        const score = data.score || 10;
        efficiency = score.toFixed(1);
    }

    // 2. RENDER THE DASHBOARD
    container.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 w-100 animate-fade-in">
            <div class="mb-4 text-center">
                <h3 class="display-6 fw-bold text-warning mb-0" style="text-shadow: 0 2px 10px rgba(241, 196, 15, 0.3);">
                    ${velocity}
                </h3>
                <span class="text-muted small text-uppercase fw-bold" style="font-size:10px; letter-spacing:1px;">
                    ⚡ Time Saved vs New Procurement
                </span>
            </div>
            
            <div style="width:40%; border-top:1px solid #eee; margin-bottom:20px;"></div>
            
            <div class="text-center">
                <h4 class="fw-bold text-success mb-0" style="font-size: 2rem;">
                    ${efficiency}σ
                </h4>
                <span class="text-muted small text-uppercase fw-bold" style="font-size:10px; letter-spacing:1px;">
                    Efficiency Rating (Gravity Model)
                </span>
            </div>

            <div class="mt-4 p-2 bg-light border rounded text-center w-75">
                <div class="small text-muted" style="font-size:9px;">
                    OPTIMIZATION LOGIC
                </div>
                <div class="text-dark fw-bold" style="font-size:10px;">
                    Direct Re-routing • No Warehousing
                </div>
            </div>
        </div>
    `;
}// [REPLACE THIS FUNCTION IN script.js]
function renderDistrictCharts(container, name, data) {
    container.innerHTML = `
        <div class="mb-4">
            <h6 class="text-muted small fw-bold mb-2">STOCK LEVEL FORECAST</h6>
            <div id="chart-district-1" style="width:100%; height: 200px;"></div>
        </div>
        <div class="border-top my-3"></div>
        <div class="mb-2">
            <h6 class="text-muted small fw-bold mb-2">COST SAVINGS</h6>
            <div id="chart-district-2" style="width:100%; height: 200px;"></div>
        </div>
    `;

    const layout = {
        autosize: true, margin: {t:10, b:30, l:35, r:10}, 
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { size: 10 }, height: 200
    };

    Plotly.newPlot('chart-district-1', [{
        x: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], y: [100, 80, 60, 40, 20, 0],
        type: 'scatter', mode: 'lines+markers', fill: 'tozeroy', 
        line: {color: '#c0392b', width: 2}, marker: {size: 4}
    }], { ...layout, yaxis: {range:[0,100], ticksuffix: '%'} }, {displayModeBar: false});

    Plotly.newPlot('chart-district-2', [{
        x: ['Old Cost', 'New Cost'], // Was: Old, New
        y: [50000, 15000], type: 'bar', 
        marker: {color: ['#95a5a6', '#27ae60']},
        text: ['50k', '15k'], textposition: 'auto'
    }], layout, {displayModeBar: false});
}
// [IN script.js] ADD THESE NEW FUNCTIONS

// 🔴 CHART SET 1: CRITICAL (Red District)
// Graph: "Burn Down" - Shows stock plummeting to 0. Very dramatic.
function renderCriticalHubCharts(container, name, data) {
    const demand = data.total_demand || 1200;
    
    container.innerHTML = `
        <div class="mb-4">
<h6 class="text-danger fw-bold small mb-2 text-uppercase">📉 Capacity Drain Forecast</h6>
<div class="small text-muted mb-2">Service will hit ZERO in <b class="text-danger">4 Hours</b> without intervention.</div>

<div id="chart-critical-burn" style="width:100%; height: 200px;"></div>
        </div>
        
        <div class="border-top my-3"></div>
        
        <div class="mb-2">
            <h6 class="text-dark fw-bold small mb-2 text-uppercase">⚠️ Pending Request Queue</h6>
            <div id="chart-critical-bar" style="width:100%; height: 180px;"></div>
        </div>
        
<div class="alert alert-success d-flex align-items-center mt-3 p-2" role="alert" style="font-size: 10px;">
   <div style="font-size: 16px; margin-right: 10px;"></div>
   <div>
<br>
Available for immediate export. <b>Relocation Cost: Low.</b>
   </div>
</div>

`;

    // 1. BURN DOWN CHART (Stock vs Time)
    // Simulates stock dropping rapidly
    const times = ['Now', '+1h', '+2h', '+3h', '+4h', '+5h'];
    const currentStock = Math.floor(demand * 0.2); // Low stock
    const stockLevels = [currentStock, currentStock*0.8, currentStock*0.5, currentStock*0.2, 0, 0];
    
    Plotly.newPlot('chart-critical-burn', [
        {
            x: times,
            y: stockLevels,
            type: 'scatter',
            mode: 'lines+markers',
            fill: 'tozeroy',
            line: { color: '#c0392b', width: 3, shape: 'spline' },
            marker: { size: 6, color: '#e74c3c' },
            name: 'Stock Level'
        },
        {
            x: times,
            y: [10, 10, 10, 10, 10, 10], // Critical Threshold
            mode: 'lines',
            line: { color: '#333', width: 1, dash: 'dot' },
            name: 'Critical Limit'
        }
    ], {
        // [FIX] Increased margins to prevent Label Cutoff
        margin: {t: 20, b: 30, l: 40, r: 20}, 
        autosize: true, // [FIX] Ensures it stays inside container
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { showgrid: false, tickfont: {size: 9} },
        yaxis: { showgrid: true, gridcolor: '#eee', tickfont: {size: 9} },
        showlegend: false,
        height: 160, // [FIX] Made smaller to fit panel
        annotations: [{
            x: '+4h', y: 0,
            xref: 'x', yref: 'y',
            text: 'STOCKOUT',
            showarrow: true, arrowhead: 2, ax: 0, ay: -25,
            font: {color: '#c0392b', weight: 'bold', size: 9}
        }]
    }, {displayModeBar: false, responsive: true});

    // 2. DEMAND COMPOSITION
    Plotly.newPlot('chart-critical-bar', [{
        x: ['High Priority', 'Standard', 'Low Priority'],
        y: [Math.floor(demand*0.6), Math.floor(demand*0.3), Math.floor(demand*0.1)],
        type: 'bar',
        marker: { color: ['#c0392b', '#e67e22', '#f1c40f'] },
        textposition: 'auto'
    }], {
        margin: {t:0, b:20, l:30, r:0},
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        height: 180,
        xaxis: { tickfont: {size: 9} }
    }, {displayModeBar: false});
}
// [REPLACE THE ENTIRE CONFIG OBJECT AT THE TOP OF script.js]
const STATE_LABEL_FIXES = {
    // --- NORTH INDIA (Spacing Fixes) ---
    "Jammu and Kashmir": [33.5, 74.5], // Shifted West to center in the polygon
    "Himachal Pradesh": [31.8, 77.2],  // Moved East to stop covering Punjab
    "Punjab": [30.9, 75.0],            // Moved West away from Himachal/Haryana
    "Haryana": [29.1, 76.0],           // Moved South
    "Delhi": [28.65, 77.1],            // Pinned exactly to New Delhi
    "Uttarakhand": [30.0, 79.2],       // Centered
    
    // --- WESTERN UTs (Under Gujarat) ---
    // Centered South of Gujarat coast
    "Dadra and Nagar Haveli and Daman and Diu": [20.3, 72.9], 

    // --- EAST & NORTH EAST (Restoration) ---
    "Odisha": [20.5, 84.4],
    "Meghalaya": [25.5, 91.2],         // Fixed missing label
    "Bihar": [25.6, 85.8],
    "Jharkhand": [23.6, 85.5],
    "West Bengal": [23.2, 87.8],
    "Assam": [26.2, 92.9],
    "Tripura": [23.8, 91.3],
    "Mizoram": [23.1, 92.8],
    "Manipur": [24.8, 93.9],
    "Nagaland": [26.1, 94.5],
    "Arunachal Pradesh": [28.0, 94.6],

    // --- SOUTH & CENTRAL ---
    "Andhra Pradesh": [15.0, 79.5],
    "Telangana": [17.8, 79.2],
    "Karnataka": [14.8, 75.8],
    "Kerala": [10.5, 76.3],
    "Tamil Nadu": [11.0, 78.5],
    "Maharashtra": [19.2, 76.0],
    "Madhya Pradesh": [23.2, 77.4],
    "Chhattisgarh": [21.2, 82.0],
    "Rajasthan": [26.5, 73.8],
    "Gujarat": [22.3, 71.5],
    "Goa": [15.4, 74.0]
};

// Graph: "Idle Capacity" - Shows waste. 
function renderSurplusHubCharts(container, name, data) {
    const surplusAmount = Math.abs(data.z_score * 500).toFixed(0);
    
    container.innerHTML = `
        <div class="mb-4">
<h6 class="text-success fw-bold small mb-2 text-uppercase">📦 Underutilized Assets</h6>
<div class="small text-muted mb-2"><b>${surplusAmount} units</b> have been inactive for > 48 hours.</div>
            <div id="chart-surplus-age" style="width:100%; height: 200px;"></div>
        </div>
        
        <div class="border-top my-3"></div>
        
        <div class="mb-2">
            <h6 class="text-dark fw-bold small mb-2 text-uppercase">📊 Warehouse Utilization</h6>
            <div id="chart-surplus-gauge" style="width:100%; height: 180px;"></div>
        </div>
        
        <div class="alert alert-success d-flex align-items-center mt-3 p-2" role="alert" style="font-size: 10px;">
           <div style="font-size: 16px; margin-right: 10px;"></div>
           <div>
<br>

Available for immediate export. <b>Relocation Cost: Low.</b>
           </div>
        </div>
    `;

    // 1. INVENTORY AGING (Area Chart)
    Plotly.newPlot('chart-surplus-age', [{
        x: ['0-24h', '24-48h', '48-72h', '>72h'],
        y: [15, 35, 40, 10], 
        type: 'scatter',
        fill: 'tozeroy',
        mode: 'lines+markers',
        line: { color: '#27ae60', shape: 'spline' }, 
        marker: { color: '#2ecc71' }
    }], {
        // [FIX] Increased Bottom Margin for Axis Title
        margin: {t: 10, b: 40, l: 40, r: 10},
        autosize: true,
        paper_bgcolor: 'rgba(0,0,0,0)', 
        plot_bgcolor: 'rgba(0,0,0,0)',
        xaxis: { title: 'Time Sitting Idle', titlefont:{size:10}, tickfont:{size:9} },
        yaxis: { showgrid: true, gridcolor: '#eee', tickfont:{size:9} },
        height: 160 // [FIX] Made smaller
    }, {displayModeBar: false, responsive: true});

    // 2. UTILIZATION GAUGE
    // Shows low utilization (waste)
    Plotly.newPlot('chart-surplus-gauge', [{
        type: "indicator",
        mode: "gauge+number",
        value: 35, // Low utilization
        title: { text: "Capacity Used", font: { size: 12 } },
        gauge: {
            axis: { range: [null, 100], tickwidth: 1, tickcolor: "#333" },
            bar: { color: "#27ae60" },
            bgcolor: "white",
            borderwidth: 1,
            bordercolor: "#ccc",
            steps: [
                { range: [0, 50], color: "#e8f5e9" }, // Light green
                { range: [50, 80], color: "#fcf3cf" },
                { range: [80, 100], color: "#fadbd8" }
            ]
        }
    }], {
        margin: { t: 25, b: 25, l: 25, r: 25 },
        height: 180,
        paper_bgcolor: 'rgba(0,0,0,0)'
    }, {displayModeBar: false});
}

// ⚪ CHART SET 3: NEUTRAL (Grey District)
function renderNeutralHubCharts(container, name, data) {
    container.innerHTML = `
        <div class="text-center p-4">
            <h6 class="text-muted fw-bold">Balanced Operations</h6>
            <p class="small text-muted">Supply matches demand within optimal parameters.</p>
            <div style="font-size: 40px; opacity: 0.2;">⚖️</div>
        </div>
    `;
}
// Global variable to track Logistics limit (Default 5)
let currentLogisticsLimit = 5;

// [IN script.js] REPLACE renderNationalCharts FUNCTION

// [IN script.js] REPLACE renderNationalCharts FUNCTION

// [IN script.js] REPLACE renderNationalCharts FUNCTION

function renderNationalCharts(container, nodes) {
    if (!nodes) return;

    // 1. SETUP HTML STRUCTURE
    container.innerHTML = `
        <div class="mb-4">
            <div class="d-flex justify-content-between align-items-center mb-1" style="height: 30px;">
                <h6 class="text-dark fw-bold small m-0 text-uppercase" style="letter-spacing:0.5px; white-space:nowrap;">
                    1. Supply & Demand Gap
                </h6>
                
                <select id="supply-limit-select" class="form-select form-select-sm border-secondary text-dark fw-bold shadow-none" 
                        style="width:auto; font-size:10px; padding:2px 20px 2px 8px; height:24px; background-position: right 4px center; cursor:pointer;">
                    <option value="5" selected>Top 5</option>
                    <option value="10">Top 10</option>
                    <option value="15">Top 15</option>
                    <option value="20">Top 20</option>
                </select>
            </div>
            <div class="small text-muted mb-2" style="font-size:9px;">Districts with highest surplus vs deficit.</div>
            
            <div id="chart-national-1" style="width:100%;"></div>
        </div>

        <div class="border-top my-3"></div>

        <div class="mb-4">
            <h6 class="text-dark fw-bold small mb-2 text-uppercase" style="letter-spacing:0.5px;">2. Inventory Aging Analysis</h6>
            <div class="small text-muted mb-2">Age of surplus kits sitting idle in warehouses.</div>
            <div id="chart-national-2" style="width:100%; height: 180px;"></div>
        </div>

        <div class="border-top my-3"></div>

        <div class="mb-2">
            <h6 class="text-dark fw-bold small mb-2 text-uppercase" style="letter-spacing:0.5px;">3. Projected Efficiency Gains</h6>
            <div class="small text-muted mb-2">Expected improvement after AI optimization.</div>
            <div id="chart-national-3" style="width:100%; height: 200px;"></div>
        </div>
    `;

    // --- CHART 1 LOGIC (Dynamic Top N) ---
    const allDeficits = nodes.filter(d => d.z_score > 0).sort((a,b) => b.z_score - a.z_score);
    const allSurplus  = nodes.filter(d => d.z_score < 0).sort((a,b) => a.z_score - b.z_score);

    const drawSupplyChart = (limit) => {
        const deficits = allDeficits.slice(0, limit);
        const surplus  = allSurplus.slice(0, limit);
        
        // Auto-Resize Height based on items (approx 25px per bar)
        const graphHeight = Math.max(220, limit * 35);

        Plotly.newPlot('chart-national-1', [
            { 
                x: surplus.map(d => d.z_score), y: surplus.map(d => d.District), 
                type: 'bar', orientation: 'h', name: 'Has Extra', 
                marker: { color: '#2ecc71', width: 0.7 } 
            },
            { 
                x: deficits.map(d => d.z_score), y: deficits.map(d => d.District), 
                type: 'bar', orientation: 'h', name: 'Needs Help', 
                marker: { color: '#c0392b', width: 0.7 } 
            }
        ], {
            barmode: 'relative', 
            margin: {t:30, b:20, l:80, r:10}, // Increased Top margin for Legend
            xaxis: { visible: false }, 
            yaxis: { tickfont: {size:10, family:'Segoe UI'}, automargin: true },
            
            // LEGEND FIXED: Top Right, Horizontal
            showlegend: true, 
            legend: {
                orientation: 'h', 
                x: 1, 
                y: 1.15, // Pushes it above the graph
                xanchor: 'right',
                yanchor: 'bottom',
                font: {size: 9}
            },
            
            height: graphHeight, 
            paper_bgcolor: 'rgba(0,0,0,0)', 
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});
    };

    // Initial Render (Top 5)
    drawSupplyChart(5);

    // Dropdown Listener
    const dropdown = document.getElementById('supply-limit-select');
    if(dropdown) {
        dropdown.addEventListener('change', function() {
            drawSupplyChart(parseInt(this.value));
        });
    }

    // --- CHART 2: INVENTORY AGING ---
    Plotly.newPlot('chart-national-2', [{
        x: [150, 420, 310, 120], 
        y: ['< 1 Month', '1-3 Months', '3-6 Months', '> 6 Months'],
        type: 'bar', orientation: 'h',
        marker: { color: ['#bdc3c7', '#95a5a6', '#f39c12', '#c0392b'] },
        text: ['150', '420', '310', '120'], textposition: 'auto'
    }], {
        margin: { t: 0, b: 20, l: 80, r: 20 },
        xaxis: { visible: false }, 
        yaxis: { tickfont: {size:10, family:'Segoe UI'} },
        height: 180, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
    }, {displayModeBar: false});

    // --- CHART 3: PROJECTED EFFICIENCY GAINS ---
    const traceBefore = {
        x: ['Wait Time', 'Logistics Cost', 'Stockouts'],
        y: [14, 100, 45], 
        name: 'Current', type: 'bar', marker: { color: '#95a5a6' } 
    };

    const traceAfter = {
        x: ['Wait Time', 'Logistics Cost', 'Stockouts'],
        y: [4, 65, 5], 
        name: 'Optimized', type: 'bar', marker: { color: '#27ae60' } 
    };

    Plotly.newPlot('chart-national-3', [traceBefore, traceAfter], {
        barmode: 'group',
        margin: { t: 30, b: 30, l: 30, r: 10 },

        xaxis: { tickfont: {size:10} },
        yaxis: { showgrid: true, gridcolor: '#eee' },
        legend: {
    orientation: 'h',
    x: 0.98,
    y: 1.18,
    xanchor: 'right',
    yanchor: 'bottom',
    font: { size: 9 },
    itemwidth: 30,
    tracegroupgap: 4
},

        height: 200, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
    }, {displayModeBar: false});
}

function resetToNationalView() {
    // 1. Reset the State Filter Dropdown to "ALL"
    const $dropdown = $('#log-state-filter');
    
    if ($dropdown.val() !== 'ALL') {
        // This triggers the 'change' listener which reloads the map
        $dropdown.val('ALL').trigger('change'); 
    } else {
        // If already ALL, force a refresh anyway
        if(typeof runLogisticsOptimizer === 'function') {
            runLogisticsOptimizer(false);
        }
    }
    
    // 2. Reset Sidebar UI
    const titleEl = document.getElementById('log-sidebar-title');
    if(titleEl) titleEl.innerText = "NATIONAL DISPATCH";
    
    // 3. Close the side panel if open
    closeLogisticsPanel();
}
// NEW HELPER: Handles the graph drawing so the dropdown can call it
function drawLogisticsNationalGraphs(nodes, limit) {
    if(!nodes) return;
    
    // 1. FILTER DATA BASED ON DROPDOWN LIMIT
    const deficits = nodes.filter(d => d.z_score > 0).sort((a,b) => b.z_score - a.z_score).slice(0, limit);
    const surplus  = nodes.filter(d => d.z_score < 0).sort((a,b) => a.z_score - b.z_score).slice(0, limit);

    // --- CHART 1: NEEDS VS EXTRAS (Updated Limit) ---
    Plotly.newPlot('chart-national-1', [
        { 
            x: surplus.map(d => d.z_score), 
            y: surplus.map(d => d.District), 
            type: 'bar', orientation: 'h', 
            name: 'Has Extra', 
            marker: { color: '#2ecc71' } 
        },
        { 
            x: deficits.map(d => d.z_score), 
            y: deficits.map(d => d.District), 
            type: 'bar', orientation: 'h', 
            name: 'Needs Help', 
            marker: { color: '#c0392b' } 
        }
    ], {
        barmode: 'relative', 
        margin: {t:0, b:20, l:120, r:10}, 
        xaxis: { visible: false }, yaxis: { tickfont: {size:9} },
        showlegend: true, legend: {orientation: 'h', y: -0.1}, height: 250,
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
    }, {displayModeBar: false, responsive: true});


    // --- CHART 2: GREEN ANALYST GRAPH (Asset Recovery) ---
    // Plots "Surplus Magnitude" (X) vs "Efficiency/Idle Time" (Y)
    // Helping find the "Sweet Spot" for recovery.
    
    // Get top 20 Green nodes for analysis (regardless of Limit, to show context)
    const greenNodes = nodes.filter(d => d.z_score < -0.5).sort((a,b) => a.z_score - b.z_score).slice(0, 20);
    
    const trace = {
        x: greenNodes.map(d => Math.abs(d.z_score)), // Surplus Magnitude
        y: greenNodes.map(d => Math.random() * 40 + 60), // Simulated "Idle Time" (Days) or "Recovery Ease"
        mode: 'markers',
        type: 'scatter',
        text: greenNodes.map(d => d.District),
        marker: {
            size: greenNodes.map(d => Math.abs(d.z_score) * 8), // Bigger surplus = Bigger dot
            color: greenNodes.map(d => Math.abs(d.z_score)), 
            colorscale: 'Greens',
            line: { color: '#1e8449', width: 1 },
            opacity: 0.8
        },
        hovertemplate: "<b>%{text}</b><br>Surplus: %{x:.1f}σ<br>Idle Days: %{y:.0f}<extra></extra>"
    };

    const layout = {
        margin: { t: 10, b: 30, l: 40, r: 10 },
        xaxis: { title: 'Surplus Magnitude (σ)', titlefont: {size:9}, tickfont: {size:9} },
        yaxis: { title: 'Avg Idle Time (Days)', titlefont: {size:9}, tickfont: {size:9} },
        height: 220,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };

    Plotly.newPlot('chart-national-2', [trace], layout, {displayModeBar: false});
}

// Triggered by the new Dropdown
function updateLogisticsCharts(val) {
    currentLogisticsLimit = parseInt(val);
    drawLogisticsNationalGraphs(window.cachedLogisticsNodes, currentLogisticsLimit);
}
async function runLogisticsOptimizer(forceRefresh = true) {
    try {
        // 1. GET DATA (Fetch Fresh or Use Cache)
        let routes, nodes;

        if (forceRefresh || !window.logisticsRawRoutes) {
            const res = await fetch('/api/logistics');
            const data = await res.json();
            
            nodes = data.chart;
            routes = data.transfers;
            window.logisticsStateStats = data.states;

            // Store in Global Cache
            window.logisticsRawNodes = nodes;
            window.logisticsRawRoutes = routes;

            // Populate State Filter Options (Use ALL routes so options exist)
            populateLogisticsFilters(routes);
        } else {
            // Use Cached Data (Instant Filter Mode)
            nodes = window.logisticsRawNodes;
            routes = window.logisticsRawRoutes;
        }

        // 2. APPLY UI FILTERS (State & Density)
        const stateFilter = $('#log-state-filter').val();
        const limitVal = $('#route-limit-select').val();
        const limit = limitVal ? parseInt(limitVal) : 40; // Default to Top 40

        let displayRoutes = [...routes];

        // A. Apply State Filter
        if (stateFilter && stateFilter !== 'ALL') {
            displayRoutes = displayRoutes.filter(r => 
                r.from_state === stateFilter || r.to_state === stateFilter
            );
        }

        // B. Apply Density Limit (Slice top N)
        // Since backend data is Round-Robin sorted, slicing gives perfect diversity
        displayRoutes = displayRoutes.slice(0, limit);

        // 3. UPDATE UI COMPONENTS
        updateSimulationTicker('logistics', displayRoutes, false);

        // Update Sidebar Count
        $('#log-total-count').text(displayRoutes.length);

        // Draw Map (With Filtered Data)
        drawEqualizerMap(nodes, displayRoutes);

        // Render Sidebar List
        logisticsDistrictFlows = displayRoutes; 
        currentLogisticsPage = 1;
        renderLogisticsList(); 
        
        // Open National Panel (Default View)
        // Only reset if we are looking at ALL states, otherwise keep context
        if (!stateFilter || stateFilter === 'ALL') {
            openLogisticsPanel('NATIONAL', null, null);
        }

        // 4. [NEW] BIND DROPDOWN EVENTS (One-Time Setup)
        // This ensures changing the "Top 40" dropdown updates map instantly
        $('#route-limit-select').off('change').on('change', function() {
            runLogisticsOptimizer(false); // false = Don't fetch, just filter
        });
        
        // Ensure State Filter triggers update too (if not handled by HTML onchange)
        $('#log-state-filter').off('change').on('change', function() {
            // We use setTimeout to allow the HTML onchange to fire first if needed
            setTimeout(() => runLogisticsOptimizer(false), 10);
        });

    } catch (e) {
        console.error("Logistics Engine Error", e);
    }
}

function updateLogisticsHeader(viewLevel, contextData, passedRoutes) {
    const container = document.getElementById('log-metrics-bar');
    if (!container) return;

    let html = "";
    const routes = passedRoutes || window.logisticsRawRoutes || [];

    // 1. NATIONAL VIEW
    if (viewLevel === 'NATIONAL') {
        const totalUnits = routes.reduce((sum, r) => sum + (r.amount || 0), 0);
        const criticalHubs = window.logisticsRawNodes ? window.logisticsRawNodes.filter(n => n.z_score > 2.0).length : 12;
        const savings = (routes.length * 0.065).toFixed(2); 
        const capexAvoided = totalRoutes * 150000; // Buying new kits avoided
        const transportCost = totalRoutes * 5000;  // Transport cost incurred
        const netLogisticsSavings = capexAvoided - transportCost;

        updateFinancialHUD(netLogisticsSavings, 0);

        html = `
            <div class="border-end pe-3 me-1" style="min-width: 140px;">
                <span class="text-muted small fw-bold" style="font-size: 9px; display:block;">MONEY SAVED</span>
                <span class="fw-bold text-success fs-6">₹ ${savings} Cr</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">MOVING NOW</span> 
                <span class="fw-bold text-primary fs-6">${totalUnits.toLocaleString()} Kits</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">AVG TIME</span> 
                <span class="fw-bold text-warning fs-6">4.5 Hours</span>
            </div>
            <div class="small">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">NEEDS HELP</span> 
                <span class="fw-bold text-danger fs-6">${criticalHubs} Places</span>
            </div>
        `;
    } 
    
    // 2. STATE VIEW
    else if (viewLevel === 'STATE') {
        const stateRoutes = routes.filter(r => {
            const dFrom = globalDataMap.get(r.from_dist);
            const dTo = globalDataMap.get(r.to_dist);
            return (dFrom && dFrom.State === contextData) || (dTo && dTo.State === contextData);
        });

        const activeTransfers = stateRoutes.length || 0; 
        const netDeficit = Math.floor(activeTransfers * 15) + 50;
        const idleSurplus = Math.floor(activeTransfers * 8) + 20;

        html = `
            <div class="border-end pe-3 me-1" style="min-width: 140px;">
                <span class="text-muted small fw-bold" style="font-size: 9px; display:block;">SHORTAGE</span>
                <span class="fw-bold text-danger fs-6">-${netDeficit} Kits</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">EXTRA STOCK</span> 
                <span class="fw-bold text-success fs-6">+${idleSurplus} Kits</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">ACTIVE TRIPS</span> 
                <span class="fw-bold text-primary fs-6">${activeTransfers}</span>
            </div>
            <div class="small">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">SCORE</span> 
                <span class="fw-bold fs-6" style="color: #8e44ad;">94%</span>
            </div>
        `;
    } 
    
    // 3. DISTRICT VIEW (SIMPLIFIED ENGLISH)
    else if (viewLevel === 'DISTRICT') {
        let d = window.logisticsRawNodes ? window.logisticsRawNodes.find(n => n.District === contextData) : null;
        if (!d) d = globalDataMap.get(contextData);

        let status = "OKAY";
        let statusColor = "text-success";
        let inventory = 100;
        let queue = 0;
        let eta = "Stable";
        let etaColor = "text-muted";
        let etaLabel = "TIME LEFT";

        if (d) {
            const z = d.z_score !== undefined ? d.z_score : 0;
            const demand = d.total_demand || 0;

            if (z > 0.5) {
                // RED / CRITICAL
                statusColor = "text-danger";

                if (z > 3.0) status = "EMPTY SOON";
                else if (z > 2.0) status = "VERY LOW";
                else status = "LOW";

                inventory = Math.max(0, Math.floor(50 - (z * 10)));
                queue = demand > 0 ? demand : Math.floor(z * 4000) + 1200;
                
                const hours = Math.max(0.5, (12 / z)).toFixed(1);
                eta = `${hours} Hours`;
                etaColor = "text-danger";
                etaLabel = "EMPTY IN";

            } else if (z < -0.5) {
                // GREEN / SURPLUS
                statusColor = "text-success";

                if (z < -2.0) status = "FULL";
                else status = "HAS EXTRA";

                inventory = Math.floor(100 + (Math.abs(z) * 40));
                queue = demand > 0 ? demand : Math.floor(Math.random() * 150);
                
                eta = "> 7 Days";
                etaColor = "text-success";
                etaLabel = "SAFE FOR";

            } else {
                // NEUTRAL
                status = "OKAY";
                statusColor = "text-primary";
                inventory = 85;
                queue = demand > 0 ? demand : 450;
                eta = "Stable";
                etaLabel = "STATUS";
            }
        }

        html = `
            <div class="border-end pe-3 me-1" style="min-width: 140px;">
                <span class="text-muted small fw-bold" style="font-size: 9px; display:block;">STATUS</span>
                <span class="fw-bold ${statusColor} fs-6">${status}</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">STOCK</span> 
                <span class="fw-bold text-dark fs-6">${inventory} Kits</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">WAITING</span> 
                <span class="fw-bold fs-6" style="color: #e67e22;">${queue.toLocaleString()}</span>
            </div>
            <div class="small">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">${etaLabel}</span> 
                <span class="fw-bold ${etaColor} fs-6">${eta}</span>
            </div>
        `;
    }

    container.innerHTML = html;
}function updateLogisticsHeader(viewLevel, contextData, allRoutes = []) {
    const container = document.getElementById('log-metrics-bar');
    if (!container) return;

    let html = "";

    // 1. NATIONAL VIEW (Strategic Overview)
    if (viewLevel === 'NATIONAL') {
        const totalRoutes = allRoutes.length;
        const totalUnits = allRoutes.reduce((sum, r) => sum + (r.amount || 0), 0);
        const criticalHubs = window.logisticsRawNodes ? window.logisticsRawNodes.filter(n => n.z_score > 2.0).length : 12;
        const avgTime = allRoutes.length > 0 
            ? (allRoutes.reduce((sum, r) => sum + (parseInt(r.velocity_gain)||0), 0) / allRoutes.length).toFixed(1) 
            : "4.5";
        
        const savings = (totalRoutes * 0.065).toFixed(2); 

        html = `
            
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">UNITS RE-DEPLOYED</span> 
                <span class="fw-bold text-primary fs-6">${totalUnits.toLocaleString()} Units</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">REDEPLOYMENT TIME</span> 
                <span class="fw-bold text-warning fs-6">${avgTime} Hours</span>
            </div>
            <div class="small">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">SERVICE GAPS</span> 
                <span class="fw-bold text-danger fs-6">${criticalHubs} Zones</span>
            </div>
        `;
    } 
    
    // 2. STATE VIEW (Tactical Management)
    else if (viewLevel === 'STATE') {
        const stateRoutes = allRoutes.filter(r => {
            const dFrom = globalDataMap.get(r.from_dist);
            const dTo = globalDataMap.get(r.to_dist);
            return (dFrom && dFrom.State === contextData) || (dTo && dTo.State === contextData);
        });

        const activeTransfers = stateRoutes.length;
        const netDeficit = Math.floor(activeTransfers * -15) - 50; 
        const idleSurplus = Math.floor(activeTransfers * 5) + 20;
        const optScore = Math.min(99, 85 + activeTransfers);

        html = `
            <div class="border-end pe-3 me-1" style="min-width: 140px;">
                <span class="text-muted small fw-bold" style="font-size: 9px; display:block;">SHORTAGE</span>
                <span class="fw-bold text-danger fs-6">${netDeficit} Kits</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">EXTRA STOCK</span> 
                <span class="fw-bold text-success fs-6">+${idleSurplus} Kits</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">LOCAL TRANSFERS</span> 
                <span class="fw-bold text-primary fs-6">${activeTransfers} Active</span>
            </div>
            <div class="small">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">EFFICIENCY</span> 
                <span class="fw-bold fs-6" style="color: #8e44ad;">${optScore}%</span>
            </div>
        `;
    } 
    
    // 3. DISTRICT VIEW (Field Operations)
    else if (viewLevel === 'DISTRICT') {
        // A. FIND THE CORRECT DATA
        // Try to find the Logistics Node first (contains z_score, demand, etc.)
        let d = window.logisticsRawNodes ? window.logisticsRawNodes.find(n => n.District === contextData) : null;
        
        // Fallback to global map if not found in logistics nodes
        if (!d) d = globalDataMap.get(contextData);

        // B. DEFAULT VALUES
        let status = "OPERATIONAL";
        let statusColor = "text-success";
        let inventory = 150; // Baseline
        let queue = 450;
        let eta = "Stable";
        let etaColor = "text-muted";

        if (d) {
            // Use Z-Score if available (Logistics Logic), otherwise default to 0
            const z = d.z_score !== undefined ? d.z_score : 0;
            const demand = d.total_demand || 0;

            // --- C. DYNAMIC LOGIC BASED ON Z-SCORE ---
            
            // 🔴 CRITICAL (Red Dot) logic: High Positive Z-Score
            if (z > 0.5) {
                statusColor = "text-danger";

                // 1. Status Text
                if (z > 3.0) status = "CRITICAL FAILURE";
                else if (z > 2.0) status = "DANGEROUSLY LOW";
                else status = "RUNNING LOW";

                // 2. Inventory: Higher Z = Lower Stock (Simulated)
                // Formula: 50 minus severity. Min 0.
                inventory = Math.max(0, Math.floor(60 - (z * 15)));

                // 3. Queue: Use real demand from backend
                queue = demand > 0 ? demand : Math.floor(z * 800) + 1000;

                // 4. ETA: Higher Z = Faster depletion
                const hours = Math.max(0.5, (10 / z)).toFixed(1);
                eta = `Empty in ${hours} Hrs`;
                etaColor = "text-danger";
            } 
            
            // 🟢 SURPLUS (Green Dot) logic: High Negative Z-Score
            else if (z < -0.5) {
                statusColor = "text-success";

                // 1. Status Text
                if (z < -2.0) status = "MAX CAPACITY";
                else status = "SURPLUS STOCK";

                // 2. Inventory: Base 150 + Extra based on Z magnitude
                inventory = Math.floor(150 + (Math.abs(z) * 50));

                // 3. Queue: Usually low for surplus areas
                queue = demand > 0 ? demand : Math.floor(Math.random() * 100);
                
                // 4. ETA
                eta = "> 7 Days";
                etaColor = "text-success";
            } 
            
            // ⚪ NEUTRAL logic
            else {
                status = "STABLE";
                statusColor = "text-primary";
                inventory = 100;
                queue = demand > 0 ? demand : 350;
                eta = "Normal";
            }
        }

        html = `
            <div class="border-end pe-3 me-1" style="min-width: 140px;">
                <span class="text-muted small fw-bold" style="font-size: 9px; display:block;">OPERATIONAL STATUS</span>
                <span class="fw-bold ${statusColor} fs-6">${status}</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">KIT CAPACITY</span> 
                <span class="fw-bold text-dark fs-6">${inventory} Units</span>
            </div>
            <div class="small border-end pe-3 me-1">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">CITIZEN QUEUE</span> 
                <span class="fw-bold fs-6" style="color: #e67e22;">${queue.toLocaleString()}</span>
            </div>
            <div class="small">
                <span class="text-muted fw-bold" style="font-size: 9px; display:block;">SERVICE HALT IN</span> 
                <span class="fw-bold ${etaColor} fs-6">${eta}</span>
            </div>
        `;
    }

    container.innerHTML = html;
}

function populateLogisticsFilters(routes) {
    if (!globalDataMap || !globalStateGeoJSON) return;

    const $stateSel = $('#log-state-filter');
    const $distSel = $('#log-dist-filter');
    
    // [FIX] 1. Setup State Dropdown with EMPTY option for Placeholder
    $stateSel.empty();
    $stateSel.append('<option></option>'); // Required for Select2 Placeholder
    $stateSel.append('<option value="ALL">Show All States</option>');
    
    const allStates = globalStateGeoJSON.features.map(f => f.properties.NAME_1).sort();
    allStates.forEach(s => $stateSel.append(new Option(s, s)));
    
    // [FIX] 2. Setup District Dropdown with EMPTY option
    $distSel.empty();
    $distSel.append('<option></option>'); // Required for Select2 Placeholder
    
    // [FIX] 3. Initialize Select2 with "allowClear" and specific placeholder
    $stateSel.select2({ 
        width: '100%', 
        placeholder: "Type to search state...", // This now appears in the box
        allowClear: true,
        dropdownParent: $stateSel.parent() 
    });
    
    $distSel.select2({ 
        width: '100%', 
        placeholder: "Type to search district...", 
        allowClear: true,
        dropdownParent: $distSel.parent() 
    });

    // 4. Add Layout Spacing
    $stateSel.parent().addClass('mb-3'); 
    $distSel.parent().addClass('mt-2');
}
const highPerfRenderer = L.canvas({ padding: 0.5 });
function filterLogisticsByState(state, routes) {
    currentFilterState = state; 

    const $dropdown = $('#log-state-filter');
    const $distSel = $('#log-dist-filter');

    // [CRITICAL FIX] Force the Dropdown Label to Match Selected State
    // We update the value and trigger ONLY the visual update ('change.select2')
    // This prevents the label from reverting to "All States".
    if ($dropdown.val() !== state) {
        $dropdown.val(state).trigger('change.select2');
    }

    // Reset District Dropdown
    $distSel.empty().append('<option></option>'); // Keep placeholder slot
    $distSel.append('<option value="">Select District...</option>');
    $distSel.prop('disabled', (!state || state === 'ALL'));

    // --- CASE A: NATIONAL VIEW ---
    if (!state || state === 'ALL') {
        openLogisticsPanel('NATIONAL', null, null); 
        $('#log-total-count').text(routes.length);
        closeLogisticsPanel(); 
        if(typeof map !== 'undefined') map.setView([22.5, 82], 4.5);
        
        // Reset Visual Layers
        if (logisticsStateLayer) {
            logisticsStateLayer.eachLayer(l => l.setStyle({ weight: 1.5, color: '#94a3b8', fillOpacity: 0.0, opacity: 0.8 }));
        }
        if (logisticsFlowLayer) {
            logisticsFlowLayer.eachLayer(l => l.setStyle({ opacity: 0.8, weight: 2 }));
        }
        if (logisticsLabelLayer) {
            logisticsLabelLayer.eachLayer(l => { 
                if(typeof l.setOpacity === 'function') l.setOpacity(1); 
            });
        }
        logisticsDistrictLabelMap.forEach(l => {
            if(typeof l.setOpacity === 'function') l.setOpacity(0);
        });

        updateLogisticsHeader('NATIONAL', null, routes);
        return; 
    }

    // --- CASE B: STATE VIEW ---
    closeLogisticsPanel();
    const filteredRoutes = routes.filter(r => r.from_state === state || r.to_state === state);

    // Identify districts
    const mapDistrictNames = new Set();
    const dropdownDistrictNames = new Set();
    filteredRoutes.forEach(r => {
        mapDistrictNames.add(r.from_dist);
        mapDistrictNames.add(r.to_dist);
        if (r.from_state === state) dropdownDistrictNames.add(r.from_dist);
        if (r.to_state === state) dropdownDistrictNames.add(r.to_dist);
    });

    $('#log-total-count').text(filteredRoutes.length);
    if(logisticsMap) logisticsMap.isFiltered = true;

    // Highlight State
    if (logisticsStateLayer) {
        logisticsStateLayer.eachLayer(layer => {
            if (layer.feature.properties.NAME_1 === state) {
                layer.setStyle({ weight: 3, color: '#f1c40f', fillColor: '#34495e', fillOpacity: 0.1, opacity: 1 });
                if(layer.bringToFront) layer.bringToFront();
            } else {
                layer.setStyle({ weight: 0.5, color: '#334155', fillOpacity: 0, opacity: 0.1 });
            }
        });
    }

    // Filter Lines
    if (logisticsFlowLayer) {
        logisticsFlowLayer.eachLayer(l => {
            // Check if this layer is a line (has options.weight)
            // We use the Bezier points to match geometry to filtered routes
            // Or easier: checks if the layer has _latlngs
            
            if (l._latlngs) { 
                // Because we didn't attach metadata to the invisible line in the previous step,
                // we rely on the clear/redraw logic of 'drawEqualizerMap' usually.
                // However, for pure CSS filtering:
                
                // If it's the Hit Line (weight 25) or Visual Line (weight 2 or 4)
                // We just hide everything and let the redraw handle it if 'runLogisticsOptimizer' is called.
                // But specific to this function's current logic:
                
                // NOTE: 'filterLogisticsByState' usually redraws the list but hides layers via opacity.
                // Since we created new lines, they might not have 'from_dist' props attached.
                
                // FIX: It is actually safer to let runLogisticsOptimizer redraw the map 
                // than to try and toggle opacity on raw layers here. 
                // But to keep existing logic working, we just ensure opacity is 0.
                
                l.setStyle({ opacity: 0, fillOpacity: 0 });
            }
        });
        
        // RE-DRAW filtered lines freshly (This is the cleanest way)
        drawEqualizerMap(window.logisticsRawNodes, filteredRoutes);
    }

    // Filter Labels
    if (logisticsLabelLayer) {
        logisticsLabelLayer.eachLayer(l => {
            const shouldShow = mapDistrictNames.has(l.options.district_name) ? 1 : 0;
            if (typeof l.setOpacity === 'function') l.setOpacity(shouldShow);
        });
    }

    logisticsDistrictLabelMap.forEach((l, n) => {
        const shouldShow = mapDistrictNames.has(n) ? 1 : 0;
        if (typeof l.setOpacity === 'function') l.setOpacity(shouldShow);
    });

    // Populate District Dropdown (Preserve Placeholder)
    Array.from(dropdownDistrictNames).sort().forEach(d => $distSel.append(new Option(d, d)));

    // Zoom
    if (typeof map !== 'undefined') {
        zoomToStateBounds(state);
    }
    
    logisticsDistrictFlows = filteredRoutes;
    currentLogisticsPage = 1;
    renderLogisticsList(); 
    updateLogisticsHeader('STATE', state, filteredRoutes); 
}
function renderEqualizerCharts(nodes, routes) {

    // ---------------------------------------------------------
    // 1. DIVERGING BAR CHART ("The Equalizer")
    // ---------------------------------------------------------
    // Top 8 Critical (Red, Positive Z) vs Top 8 Surplus (Green, Negative Z)
    const critical = nodes.filter(d => d.z_score > 0).sort((a,b) => b.z_score - a.z_score).slice(0, 8);
    const surplus = nodes.filter(d => d.z_score < 0).sort((a,b) => a.z_score - b.z_score).slice(0, 8);

    const traceCrit = {
        y: critical.map(d => d.District),
        x: critical.map(d => d.z_score),
        type: 'bar', orientation: 'h', name: 'Overload',
        marker: { color: '#c0392b' }
    };
    const traceSurp = {
        y: surplus.map(d => d.District),
        x: surplus.map(d => d.z_score),
        type: 'bar', orientation: 'h', name: 'Idle',
        marker: { color: '#27ae60' }
    };

    // Plotly render for the small chart
    if(document.getElementById('log-diverging-chart')) {
        Plotly.newPlot('log-diverging-chart', [traceSurp, traceCrit], {
            barmode: 'relative',
            margin: {t:0, b:20, l:70, r:10},
            xaxis: { visible: false },
            yaxis: { tickfont: {size:9} },
            showlegend: false,
            height: 160,
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});
    }

    // [FIX] REMOVED "LIVE DISPATCH TERMINAL" BLOCK
    // This allows renderLogisticsList() to handle the list and pagination correctly
    // without being overwritten by the static "black box" HTML.

    const titleEl = document.getElementById('log-sidebar-title');
    if(titleEl) titleEl.innerText = "NATIONAL DISPATCH";
}function showDrillDown(district, route) {
    // 1. Simulate "Before vs After" Data
    const title = route ? `SIMULATION: ${route.from_dist} ➔ ${route.to_dist}` : `ANALYSIS: ${district.District}`;
    document.getElementById('log-sidebar-title').innerText = title; // Re-use sidebar header for mobile
    
    // In a real app, we'd update a specific div. 
    // For now, let's inject a "Mission Control" panel into the logistics list area for demo
    const container = document.getElementById('logistics-list-container');
    
    container.innerHTML = `
        <div class="p-3 text-dark bg-light h-100">
            <h6 class="fw-bold border-bottom pb-2">🚀 TRANSFER MANIFEST</h6>
            
            <div class="d-flex justify-content-between mb-2 small">
                <span>Origin Load:</span> <b class="text-success">-1.5σ</b>
            </div>
            <div class="d-flex justify-content-between mb-2 small">
                <span>Dest Load:</span> <b class="text-danger">+2.8σ</b>
            </div>
            
            <div class="alert alert-warning py-1 small my-2">
                ⚡ <b>Velocity Gain:</b> 450 Man-Hours
            </div>
            
            <button class="btn btn-dark btn-sm w-100 mt-2" onclick="resetLogisticsView()">
                ✅ APPROVE TRANSFER
            </button>
        </div>
    `;
}

function drawEqualizerMap(nodes, routes) {
    // 1. SAFETY: FORCE CLOSE ANY ACTIVE TOOLTIPS
    logisticsLabelLayer.clearLayers(); 
    logisticsFlowLayer.clearLayers();
    try {
        if (typeof logisticsMap !== 'undefined' && logisticsMap) {
            logisticsMap.closeTooltip();
        }
    } catch (e) { /* Ignore */ }

    // 2. CLEAR LAYERS
    if (logisticsLabelLayer) logisticsLabelLayer.clearLayers();
    if (logisticsFlowLayer) logisticsFlowLayer.clearLayers();
    if (logisticsDistrictLabelMap) logisticsDistrictLabelMap.clear();

    // 3. DISABLE STATE LAYER INTERACTIVITY
    if (typeof logisticsStateLayer !== 'undefined' && logisticsStateLayer) {
        logisticsStateLayer.eachLayer(layer => {
            try {
                if (layer.setStyle) layer.setStyle({ interactive: false }); 
            } catch (e) { /* Ignore */ }
        });
    }

    // 4. DATA LOOKUP
    const logMap = new Map(nodes.map(n => [n.District, n]));

    // 5. TOOLTIP GENERATORS (Kept exactly the same as your original code)
    const getNodeTooltip = (d) => {
        if (!d) return "";
        const isCritical = d.logistics_status === 'CRITICAL';
        const isSurplus  = d.logistics_status === 'SURPLUS';
        
        const utilization = isCritical ? 98 : (isSurplus ? 42 : 76);
        const forecast = isCritical ? "Stockout in < 4h" : (isSurplus ? "Idle for > 3 Days" : "Stable");
        const queue = Math.floor(Math.abs(d.z_score * 850)) + 120;
        let color = '#f39c12'; let status = 'STABLE'; 
        let bgAction = 'rgba(255, 255, 255, 0.05)';
        let actionText = "Monitor Operations";
        
        if (isCritical) { 
            color = '#c0392b'; status = 'CRITICAL FAIL'; 
            actionText = `Divert ${Math.floor(queue/3)} Units Here`;
        }
        if (isSurplus) { 
            color = '#2ecc71'; status = 'OVERSTOCKED'; 
            actionText = `Export Available Stock`;
        }

        return `
        <div style="font-family:'Segoe UI', sans-serif; min-width: 160px; max-width: 180px; border-radius: 6px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.5); background: #0f172a;">
            <div style="background: ${color}; color: white; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-size: 10px; opacity: 0.9; letter-spacing: 0.5px;">ENROLMENT CENTER</div>
                    <div style="font-weight: 800; font-size: 11px;">${d.District.toUpperCase()}</div>
                </div>
            </div>
            <div style="padding: 8px 10px; color: #f8fafc;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 10px;">
                    <span style="color: #94a3b8;">Status:</span>
                    <b style="color: ${color};">${status}</b>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px;">
                    <div style="background: rgba(255,255,255,0.1); padding: 4px; border-radius: 4px; text-align: center;">
                        <div style="font-size: 8px; color: #94a3b8;">LOAD</div>
                        <div style="font-weight: bold; font-size: 10px; color: #fff;">${d.z_score.toFixed(1)}σ</div>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 4px; border-radius: 4px; text-align: center;">
                        <div style="font-size: 8px; color: #94a3b8;">QUEUE</div>
                        <div style="font-weight: bold; font-size: 10px; color: #fff;">${queue}</div>
                    </div>
                </div>
            </div>
            <div style="background: ${bgAction}; padding: 6px 10px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 9px; color: #f8fafc;">
                ${actionText}
            </div>
        </div>`;
    };

    const getRouteTooltip = (r) => {
        const eff = r.score ? `+${parseFloat(r.score).toFixed(1)}σ` : "High";
        return `<div style="padding: 6px 10px; background: rgba(15, 23, 42, 0.95); color: #fff; border-radius: 4px; font-size: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-left: 3px solid #f1c40f;">
            <div style="color: #f1c40f; font-weight: bold; margin-bottom: 2px;">OPTIMIZATION PATH</div>
            <div>📦 Transfer: <b>${r.amount} Units</b></div>
            <div style="color: #ccc; font-size: 9px;">⚡ Efficiency: ${eff}</div>
        </div>`;
    };

// 6. DRAW LOOP (HYBRID RENDERER FOR PERFORMANCE)
    routes.forEach(r => {
        const start = getDistrictCenter(r.from_dist);
        const end = getDistrictCenter(r.to_dist);
        
        if (!start || !end) return;
        
        const dSource = logMap.get(r.from_dist) || globalDataMap.get(r.from_dist);
        const dDest   = logMap.get(r.to_dist)   || globalDataMap.get(r.to_dist);
        
        // --- A. SOURCE NODE ---
        L.marker(start, {
            icon: L.divIcon({ className: 'marker-surplus-glow', html: ``, iconSize: [10, 10], iconAnchor: [5, 5] }),
            interactive: false, district_name: r.from_dist
        }).addTo(logisticsLabelLayer);

        const sourceHit = L.circleMarker(start, {
            radius: 20, stroke: false, fill: true, fillOpacity: 0, 
            interactive: true, pane: 'markerPane', district_name: r.from_dist,
            renderer: canvasRenderer // Use Canvas for dots too
        }).addTo(logisticsLabelLayer);

        if(dSource) sourceHit.bindTooltip(getNodeTooltip(dSource), { direction: "top", offset: [0, -10], opacity: 1 });
        
        sourceHit.on('click', (e) => { 
            L.DomEvent.stopPropagation(e); 
            filterMapToDistrictConnections(r.from_dist); 
            openLogisticsPanel('DISTRICT', r.from_dist, r); 
        });

        // --- B. DESTINATION NODE ---
        L.marker(end, {
            icon: L.divIcon({ className: '', html: `<div class="red-dot-dynamic"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] }),
            zIndexOffset: 1000, interactive: false, district_name: r.to_dist 
        }).addTo(logisticsLabelLayer);

        const destHit = L.circleMarker(end, {
            radius: 20, stroke: false, fill: true, fillOpacity: 0, 
            interactive: true, pane: 'markerPane', district_name: r.to_dist,
            renderer: canvasRenderer // Use Canvas for dots too
        }).addTo(logisticsLabelLayer);

        if(dDest) destHit.bindTooltip(getNodeTooltip(dDest), { direction: "top", offset: [0, -10], opacity: 1 });
        
        destHit.on('click', (e) => { 
            L.DomEvent.stopPropagation(e); 
            filterMapToDistrictConnections(r.to_dist); 
            openLogisticsPanel('DISTRICT', r.to_dist, r); 
        });

        // --- C. FLOW LINES (BUFFER TECHNIQUE) ---
        const latlngs = getBezierPoints(start, end);
        
        // 1. VISUAL LINE (Must be SVG for CSS Animations)
        const visibleLine = L.polyline(latlngs, { 
            color: '#f1c40f', 
            weight: 2, 
            opacity: 0.6, 
            className: 'flow-line-anim', 
            interactive: false, // Visuals ignore mouse
            renderer: svgRenderer // <--- FORCE SVG (Restores Animation)
        }).addTo(logisticsFlowLayer);

        // 2. HIT LINE (Must be Canvas for Performance)
        const hitLine = L.polyline(latlngs, {
            color: '#fff', 
            weight: 25,         // Wide hit area
            opacity: 0.0,       // Almost invisible (0.0 keeps it "active" in some browsers)
            interactive: true,  // Captures mouse
            renderer: canvasRenderer // <--- FORCE CANVAS (Fixes Lag)
        }).addTo(logisticsFlowLayer);
        
        // Bind Tooltip to the HIT LINE
        hitLine.bindTooltip(getRouteTooltip(r), { sticky: true, opacity: 1 });

        // Hover Logic
        hitLine.on('mouseover', (e) => { 
            if (logisticsMap.isFiltered) return;
            visibleLine.setStyle({ weight: 4, opacity: 1.0, color: '#fff' }); 
        });
        
        hitLine.on('mouseout',  (e) => { 
            if (logisticsMap.isFiltered) return;
            visibleLine.setStyle({ weight: 2, opacity: 0.6, color: '#f1c40f' }); 
        });
        
        hitLine.on('click', (e) => { 
            L.DomEvent.stopPropagation(e); 
            openLogisticsPanel('ROUTE', `${r.from_dist} > ${r.to_dist}`, r); 
        });

        sourceHit.bringToFront();
        destHit.bringToFront();

        createDistrictLabel(r.from_dist, start);
        createDistrictLabel(r.to_dist, end);
    });
}

function createDistrictLabel(name, latlng) {
    const labelIcon = L.divIcon({
        className: 'log-district-label',
        html: `<div>${name}</div>`,
        iconSize: [100, 12], iconAnchor: [50, 18] // Offset below marker
    });
    const label = L.marker(latlng, {icon: labelIcon, interactive: false}).addTo(logisticsLabelLayer);
    logisticsDistrictLabelMap.set(name, label);
}
function getLogisticsTooltip(type, data) {
    // Note: Removed black color classes, using text-muted (lighter in CSS)
    if(type === 'critical') {
        return `
        <div class="p-2">
            <div class="fw-bold text-danger">⚠️ CRITICAL: ${data.to_dist}</div>
            <div class="small text-light">Deficit: <b class="text-white">-${data.amount} Units</b></div>
            <div class="small text-muted">Stockout: 2 Hours</div>
            <div class="mt-2 pt-1 border-top border-secondary small text-muted fst-italic">
                AI: "Immediate import recommended."
            </div>
        </div>`;
    } else {
        return `
        <div class="p-2">
            <div class="fw-bold text-success">✅ AVAILABLE: ${data.from_dist}</div>
            <div class="small text-light">Surplus: <b class="text-white">+${Math.abs(data.from_z).toFixed(1)}σ</b></div>
            <div class="small text-muted">Utilization: 42%</div>
        </div>`;
    }
}
function getBezierPoints(start, end) {
    // Simple Quadratic Bezier logic
    const midLat = (start.lat + end.lat) / 2;
    const midLng = (start.lng + end.lng) / 2;
    
    // Add an arc offset (makes the line curve upward/sideways)
    // We adjust magnitude based on distance to prevent huge loops for short trips
    const dist = Math.sqrt(Math.pow(end.lat - start.lat, 2) + Math.pow(end.lng - start.lng, 2));
    const offset = dist * 0.2; 

    const controlPoint = {
        lat: midLat + offset, 
        lng: midLng + offset 
    };
    
    // Leaflet can't draw true Bezier natively with L.polyline, so we interpolate points
    const points = [];
    for (let t = 0; t <= 1; t += 0.2) { 
        // This reduces calculation overhead by 50%
        const lat = (1-t)*(1-t)*start.lat + 2*(1-t)*t*controlPoint.lat + t*t*end.lat;
        const lng = (1-t)*(1-t)*start.lng + 2*(1-t)*t*controlPoint.lng + t*t*end.lng;
        points.push([lat, lng]);
    }
    return points;
}
function drawZScoreMarkers(districtStats) {
    // Clear old markers from the label layer
    logisticsLabelLayer.clearLayers();

    districtStats.forEach(d => {
        const center = getDistrictCenter(d.District);
        if (!center) return;

        // LOGIC: VISUALS BASED ON Z-SCORE
        
        // 1. 🔴 Red Pulse (Crisis): Z-Score > +2.0
        if (d.z_score > 2.0) {
            // Size proportional to deficit (capped max size)
            const size = Math.min(24, 12 + (d.z_score * 2)); 
            
            const icon = L.divIcon({
                className: 'marker-pulse-red',
                iconSize: [size, size],
                iconAnchor: [size/2, size/2]
            });

            // [FIX] Added district_name property so filters can identify this marker
            L.marker(center, {icon: icon, district_name: d.District}).addTo(logisticsLabelLayer)
             .bindTooltip(`
                <div class='text-center'>
                    <b class='text-danger'>${d.District}</b><br>
                    Deficit: ${(d.z_score).toFixed(1)}σ
                </div>`, 
             { direction: "top", offset: [0, -10] });
        }

        // 2. 🟢 Green Solid (Surplus): Z-Score < -1.0
        else if (d.z_score < -1.0) {
            const icon = L.divIcon({
                className: 'marker-solid-green',
                iconSize: [10, 10], // Standard size
                iconAnchor: [5, 5]
            });

            // [FIX] Added district_name property so filters can identify this marker
            L.marker(center, {icon: icon, district_name: d.District}).addTo(logisticsLabelLayer)
             .bindTooltip(`
                <div class='text-center'>
                    <b class='text-success'>${d.District}</b><br>
                    Surplus: ${Math.abs(d.z_score).toFixed(1)}σ
                </div>`, 
             { direction: "top", offset: [0, -10] });
        }
    });
}
function resetLogisticsView() {
    currentLogisticsView = 'STATE';
    currentFilterState = null;
    currentLogisticsFilterDistrict = null; // [FIX] Clear district filter
    currentLogisticsPage = 1;
    
    document.getElementById('log-sidebar-title').innerText = "LIVE SHIPMENTS";
    
    // Redraw map and list
    if (window.logisticsRawRoutes) {
         filterLogisticsByState('ALL', window.logisticsRawRoutes);
    }
}
// [REPLACE IN script.js]
// [REPLACE IN script.js]
function renderLogisticsList(overrideRoutes = null) {
    const list = document.getElementById('logistics-list-container');
    list.innerHTML = '';

    let routes = overrideRoutes || logisticsDistrictFlows || [];
    
    // --- 1. GARBAGE FILTER (The Fix) ---
    // We strictly remove any route that involves these junk names
    const GARBAGE_NAMES = [
        "100000", "idplcolony", "nearuniversitythana", "5thcross", 
        "neardhyanaashram", "nearudaynagar", "nearudaynagarnitgarden", 
        "nearmeerahospital", "?", "undefined", "null"
    ];

    routes = routes.filter(r => {
        const s = r.from_dist.toLowerCase().replace(/[^a-z0-9]/g, '');
        const d = r.to_dist.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // If source or destination matches garbage, SKIP IT
        const isGarbage = GARBAGE_NAMES.some(junk => s.includes(junk) || d.includes(junk));
        return !isGarbage;
    });
    // -----------------------------------

    // 2. GROUP BY SOURCE
    const groupedData = {};
    routes.forEach(r => {
        if (!groupedData[r.from_dist]) {
            groupedData[r.from_dist] = {
                source: r.from_dist,
                state: r.from_state,
                total_kits: 0,
                destinations: []
            };
        }
        groupedData[r.from_dist].total_kits += (r.amount || 0);
        groupedData[r.from_dist].destinations.push(r);
    });

    const groupedArray = Object.values(groupedData);

    // 3. HANDLE EMPTY STATE
    if (groupedArray.length === 0) {
        list.innerHTML = '<div class="text-center p-4 text-muted small">No active transfers found.</div>';
        return;
    }

    // 4. PAGINATION
    const totalPages = Math.ceil(groupedArray.length / LOG_ITEMS_PER_PAGE);
    if (currentLogisticsPage > totalPages) currentLogisticsPage = 1;
    document.getElementById('log-page-indicator').innerText = `Page ${currentLogisticsPage}/${totalPages}`;
    
    const pageItems = groupedArray.slice((currentLogisticsPage - 1) * LOG_ITEMS_PER_PAGE, currentLogisticsPage * LOG_ITEMS_PER_PAGE);

    // 5. RENDER CARDS
    pageItems.forEach(group => {
        let destListHTML = '';
        group.destinations.forEach(d => {
            // Destination in RED (Critical/Deficit)
            destListHTML += `
                <div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom border-light">
                    <div class="d-flex align-items-center">
                        <i class="bi bi-arrow-return-right text-muted me-2" style="font-size: 10px;"></i>
                        <span class="small fw-bold text-danger">${d.to_dist}</span>
                    </div>
                    <span class="badge bg-light text-dark border" style="font-size: 9px;">${d.amount}</span>
                </div>
            `;
        });

        const card = document.createElement('div');
        card.className = 'p-3 border-bottom hover-bg-light cursor-pointer';
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="d-flex align-items-center gap-2">
                        <h6 class="m-0 fw-bold text-success">${group.source}</h6>
                        <span class="badge bg-secondary" style="font-size: 9px;">${group.state}</span>
                    </div>
                    <div class="text-muted small mt-1">
                        Sending to <strong class="text-dark">${group.destinations.length} locations</strong>
                    </div>
                </div>
                <div class="text-end">
                    <div class="h5 m-0 fw-bold text-success">${group.total_kits}</div>
                    <div class="text-muted" style="font-size: 8px;">TOTAL UNITS</div>
                </div>
            </div>
            
            <div class="mt-2 ps-2 border-start border-2 border-success bg-light rounded p-2" style="font-size: 0.85rem;">
                <div class="text-muted fw-bold mb-1" style="font-size: 9px;">DESTINATIONS (CRITICAL):</div>
                ${destListHTML}
            </div>
        `;
        // Click to Zoom to this Hub
        card.onclick = () => zoomToLogisticsDistrict(group.source);
        list.appendChild(card);
    });
}
function changeLogisticsPage(dir) {
    // 1. Determine the exact data source used by the list renderer
    let data = logisticsDistrictFlows || [];
    
    if (currentFilterState && currentFilterState !== 'ALL') {
         data = data.filter(t => t.from_state === currentFilterState || t.to_state === currentFilterState);
    }
    
    // 2. Calculate limits based on filtered data
    const maxPage = Math.ceil(data.length / LOG_ITEMS_PER_PAGE) || 1;
    
    // 3. Update Page
    currentLogisticsPage += dir;
    if (currentLogisticsPage < 1) currentLogisticsPage = 1;
    if (currentLogisticsPage > maxPage) currentLogisticsPage = maxPage;
    
    // 4. Re-render
    renderLogisticsList();
}
function getStateCenter(stateName) {
    // 1. Check Hardcoded Fixes First
    if (STATE_LABEL_FIXES[stateName]) {
        return L.latLng(STATE_LABEL_FIXES[stateName]);
    }
    
    // 2. Fallback to Polygon Centroid
    let center = null;
    if(globalStateGeoJSON) {
        globalStateGeoJSON.features.forEach(f => {
            if(f.properties.NAME_1 === stateName) {
                const layer = L.geoJSON(f);
                center = layer.getBounds().getCenter();
            }
        });
    }
    return center;
}
function zoomToStateBounds(stateName) {
    if(globalStateGeoJSON && logisticsMap) {
        // Find the feature for the selected state
        const feature = globalStateGeoJSON.features.find(f => f.properties.NAME_1 === stateName);
        if (feature) {
            const layer = L.geoJSON(feature);
            logisticsMap.fitBounds(layer.getBounds(), { padding: [20, 20] });
        }
    }
}
function zoomToLogisticsDistrict(districtName) {
    if (!districtName) return;

    // 1. UPDATE DROPDOWN VISUALS (Fixing the Sync Issue)
    // We find which state this district belongs to and force the State Dropdown to match
    const districtNode = window.logisticsRawNodes.find(n => n.District === districtName);
    if (districtNode) {
        const stateName = districtNode.State;
        const $stateDrop = $('#log-state-filter');
        
        // Only update if it's different, to avoid loops
        if ($stateDrop.val() !== stateName) {
            // Update value and UI, but suppress the 'change' event to prevent re-filtering
            $stateDrop.val(stateName).trigger('change.select2'); 
            currentFilterState = stateName;
        }
    }

    // 2. FIND ALL CONNECTIONS (The Spiderweb Fix)
    // CRITICAL: We search 'window.logisticsRawRoutes' (The Full Dataset), 
    // NOT the currently filtered view. This ignores the "Top 40" limit.
    const allRoutes = window.logisticsRawRoutes || [];
    
    const districtRoutes = allRoutes.filter(r => 
        r.from_dist === districtName || r.to_dist === districtName
    );

    // 3. FORCE DRAW (Override the Map)
    // We draw specific routes regardless of what the filters say
    drawEqualizerMap(window.logisticsRawNodes, districtRoutes);
    
    // 4. UPDATE SIDEBAR LIST
    logisticsDistrictFlows = districtRoutes;
    renderLogisticsList();

    // 5. UPDATE HEADER
    // Show how many connections were found
    const type = (districtRoutes.length > 1) ? "HUB NETWORK" : "CONNECTION";
    $('#log-sidebar-title').html(`${districtName} <span class="badge bg-warning text-dark">${type}</span>`);
    $('#log-total-count').text(districtRoutes.length);

    // 6. ZOOM TO THE NETWORK
    const center = getDistrictCenter(districtName);
    const bounds = L.latLngBounds();
    if (center) bounds.extend(center);
    
    districtRoutes.forEach(r => {
        const otherName = (r.from_dist === districtName) ? r.to_dist : r.from_dist;
        const otherCenter = getDistrictCenter(otherName);
        if (otherCenter) bounds.extend(otherCenter);
    });

    if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 8 });
    }
    
    // 7. Update District Dropdown
    $('#log-dist-filter').val(districtName);
}
function drillDownToState(stateName) {
    currentLogisticsView = 'DISTRICT';
    currentFilterState = stateName;
    currentLogisticsPage = 1;
    currentFilterState = stateName;
    currentTerminalPage = 1;
    renderLogisticsTerminal();
    
    document.getElementById('log-sidebar-title').innerText = `🔎 ${stateName.toUpperCase()} DETAILS`;
    document.getElementById('btn-back-state').style.display = 'block';

    // Filter flows involving this state
    const relevantFlows = logisticsDistrictFlows.filter(t => 
        t.from_state === stateName || t.to_state === stateName
    );

    // Draw thin District arcs
    drawLogisticsMapLayer(relevantFlows, false);
    renderLogisticsList();
    
    // Zoom to State
    zoomToStateBounds(stateName);
}
function renderLogisticsCharts(chartData, transfers) {
    
    // A. "Balance of Power" (Diverging Bar)
    // Filter top 10 Deficit (Red) and top 10 Surplus (Green)
    const deficits = chartData.filter(d => d.z_score > 1.0).sort((a,b) => b.z_score - a.z_score).slice(0,8);
    const surplus  = chartData.filter(d => d.z_score < -1.0).sort((a,b) => a.z_score - b.z_score).slice(0,8);
    
    const divTraceRed = {
        y: deficits.map(d => d.District),
        x: deficits.map(d => d.z_score),
        type: 'bar', orientation: 'h', name: 'Deficit',
        marker: { color: '#e74c3c' }
    };
    const divTraceGreen = {
        y: surplus.map(d => d.District),
        x: surplus.map(d => d.z_score), // Negative values
        type: 'bar', orientation: 'h', name: 'Surplus',
        marker: { color: '#2ecc71' }
    };

    Plotly.newPlot('log-diverging-chart', [divTraceGreen, divTraceRed], {
        barmode: 'relative',
        margin: {t:10, b:20, l:80, r:10},
        xaxis: { visible: false },
        yaxis: { tickfont: {color:'#ccc', size:9}, tickcolor: 'rgba(0,0,0,0)' },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    }, {displayModeBar: false});

    // B. "Z-Score" Bell Curve
    // Create a histogram of z-scores
    const zValues = chartData.map(d => d.z_score);
    const bellTrace = {
        x: zValues,
        type: 'histogram',
        marker: { color: '#3498db', opacity: 0.7 },
        nbinsx: 20
    };
    
    Plotly.newPlot('log-bell-chart', [bellTrace], {
        margin: {t:10, b:20, l:20, r:10},
        xaxis: { title: 'Z-Score Deviation', titlefont:{size:9, color:'#888'}, tickfont:{color:'#ccc', size:9} },
        yaxis: { visible: false },
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        shapes: [
            { type: 'line', x0: 2, x1: 2, y0: 0, y1: 1, yref: 'paper', line: {color: '#e74c3c', dash:'dot'} }, // Crisis Line
            { type: 'line', x0: -1, x1: -1, y0: 0, y1: 1, yref: 'paper', line: {color: '#2ecc71', dash:'dot'} } // Surplus Line
        ]
    }, {displayModeBar: false});

    // C. System Health Gauge
    const optimizedPercent = 100 - (deficits.length * 5); // Simple logic: fewer deficits = higher score
    
    Plotly.newPlot('log-gauge-chart', [{
        type: "indicator", mode: "gauge+number",
        value: Math.max(0, optimizedPercent),
        number: { suffix: "%", font: { size: 20, color: "white" } },
        gauge: {
            axis: { range: [null, 100], tickwidth: 0, tickcolor: "transparent", visible: false },
            bar: { color: "#f1c40f" },
            bgcolor: "rgba(255,255,255,0.1)",
            borderwidth: 0
        }
    }], {
        margin: { t: 0, b: 0, l: 20, r: 20 },
        paper_bgcolor: 'rgba(0,0,0,0)'
    }, {displayModeBar: false});
}
function drawLogisticsMapLayer(flows, isStateLevel) {
    logisticsFlowLayer.clearLayers();
    
    flows.forEach(f => {
        let start, end;
        
        if (isStateLevel) {
            start = getStateCenter(f.from);
            end = getStateCenter(f.to);
        } else {
            start = getDistrictCenter(f.from_dist);
            end = getDistrictCenter(f.to_dist);
        }

        if (start && end) {
            // Visuals: Dark colors for visibility on white map
            const color = isStateLevel ? '#c0392b' : '#8e44ad'; // Red for State, Purple for Dist
            const weight = isStateLevel ? 3 : 2;
            const opacity = isStateLevel ? 0.8 : 0.6;
            
            // Draw Line
            L.polyline([start, end], {
                color: color, weight: weight, opacity: opacity, dashArray: '5, 5'
            }).addTo(logisticsFlowLayer);

            // Add Arrow Head
            L.circleMarker(end, { radius: 3, color: color, fillOpacity: 1 }).addTo(logisticsFlowLayer);
        }
    });
}


function drawLiveLogistics(transfers, allDistrictsData) {
    const logFeed = document.getElementById('logistics-feed');
    if(logFeed) logFeed.innerHTML = ""; 

    // 1. Draw MARKERS
    allDistrictsData.forEach(d => {
        const center = getDistrictCenter(d.District);
        if(!center) return;

        if (d.z_score > 2.0) {
            const size = Math.min(20, 10 + (d.z_score * 2)); 
            const icon = L.divIcon({
                className: 'log-marker-pulse',
                iconSize: [size, size],
                iconAnchor: [size/2, size/2]
            });
            L.marker(center, {icon: icon}).addTo(logisticsLabelLayer)
             .bindTooltip(`<b>${d.District}</b><br>CRITICAL DEFICIT`, {direction: "top", offset:[0,-10]});
        }
        else if (d.z_score < -1.0) {
            L.circleMarker(center, {
                radius: 4, color: '#2ecc71', fillColor: '#2ecc71', fillOpacity: 1
            }).addTo(logisticsLabelLayer);
        }
    });

    // 2. Draw SOLID FLIGHT PATHS
    transfers.forEach((t, i) => {
        const start = getDistrictCenter(t.from_dist);
        const end = getDistrictCenter(t.to_dist);
        
        if (start && end) {
            // Draw Simple Solid Line
            const curve = L.polyline([start, end], {
                color: '#f1c40f', 
                weight: 2, 
                opacity: 0.7,
                className: 'log-flow-line' // Optimized CSS class
            }).addTo(logisticsFlowLayer);

            const tooltipHTML = `
                <div style="background:#111; color:#fff; padding:5px; border:1px solid #f1c40f;">
                    <div style="font-size:10px; color:#f1c40f; font-weight:bold;">ROUTE #TR-${900+i}</div>
                    <div style="font-size:11px;">${t.from_dist} ➔ ${t.to_dist}</div>
                    <div style="font-size:10px; color:#aaa;">Cargo: ${t.amount} Units</div>
                </div>
            `;
            curve.bindTooltip(tooltipHTML, {sticky: true, direction: "top"});
            
            // Simplified Log Feed Logic
            setTimeout(() => {
                const logItem = `
                    <div class="log-card" onclick="zoomToRoute('${t.from_dist}')">
                        <div class="d-flex justify-content-between text-warning" style="font-size:10px;">
                            <span>[PRIORITY: ${t.priority}]</span>
                            <span>#TR-${900+i}</span>
                        </div>
                        <div style="font-size:11px; margin:2px 0;">
                            Dispatching <b>${t.amount} units</b> from ${t.from_dist} to ${t.to_dist}.
                        </div>
                    </div>
                `;
                if(logFeed) logFeed.innerHTML = logItem + logFeed.innerHTML;
            }, i * 100); 
        }
    });
}
function zoomToRoute(districtName) {
    if(logisticsMap) {
        const center = getDistrictCenter(districtName);
        if(center) logisticsMap.flyTo(center, 8);
    }
}

function updateEqualizer(chartData) {
    // Sort by Z-Score to show the "Curve"
    const sorted = [...chartData].sort((a,b) => a.z_score - b.z_score);
    
    const trace = {
        x: sorted.map(d => d.District),
        y: sorted.map(d => d.z_score),
        type: 'bar',
        marker: {
            color: sorted.map(d => {
                if(d.z_score > 1.5) return '#e74c3c'; // Red
                if(d.z_score < -1.0) return '#3498db'; // Blue
                return '#2ecc71'; // Green
            })
        }
    };

    const layout = {
        title: false,
        margin: { t: 10, b: 0, l: 30, r: 10 },
        xaxis: { showticklabels: false, title: 'Districts (Sorted by Load)' },
        yaxis: { title: 'Z-Score (Deviation)' },
        shapes: [
            { type: 'line', x0: 0, x1: sorted.length, y0: 1.5, y1: 1.5, line: { color: 'red', dash: 'dot', width: 1 } },
            { type: 'line', x0: 0, x1: sorted.length, y0: -1.0, y1: -1.0, line: { color: 'blue', dash: 'dot', width: 1 } }
        ]
    };

    Plotly.newPlot('logistics-equalizer', [trace], layout, {displayModeBar: false, responsive: true});
}
function applyMapFilters() {
    // 1. GET VALUES
    const stateSelect = document.getElementById('filter-state-select');
    const selectedState = stateSelect ? stateSelect.value : "ALL";
    const minAdult = parseInt(document.getElementById('slider-workforce').value);
    const maxChild = parseInt(document.getElementById('slider-family').value); 
    
    // Checkboxes (Now includes Green)
    const showRed = document.getElementById('toggle-red').checked;
    const showOrange = document.getElementById('toggle-orange').checked;
    const showBlue = document.getElementById('toggle-primary').checked;
    const showGreen = document.getElementById('toggle-green').checked; // <--- NEW
    
    // Update Slider Labels
    if(document.getElementById('val-workforce')) document.getElementById('val-workforce').innerText = `${minAdult}% +`;
    if(document.getElementById('val-family')) document.getElementById('val-family').innerText = `< ${maxChild}%`;

    // 2. STATE LOGIC (Zoom)
    if (selectedState !== "ALL" && stateLayer) {
        stateLayer.eachLayer(l => {
            if (l.feature.properties.NAME_1 === selectedState) map.fitBounds(l.getBounds());
        });
    }

    const visibleDistricts = []; 
    const visibleStates = new Set();
    const stateGrouping = {};    
    let totalCount = 0;

    // 3. DISTRICT FILTERING
    if (!districtLayer) return;

    districtLayer.eachLayer(layer => {
        const props = layer.feature.properties;
        const name = props.NAME_2;
        const d = globalDataMap.get(name);
        const polyEl = layer.getElement();
        const labelMarker = districtLabelMap.get(name);
        
        if (!d || !polyEl) return; 

        let isMatch = true;

        // A. State Filter
        if (selectedState !== "ALL" && d.State !== selectedState) isMatch = false;
        
        // B. Category Filters (Red/Orange/Blue/Green)
        if (isMatch) {
            if (d.category === 3 && !showRed) isMatch = false;       // Worker
            else if (d.category === 2 && !showOrange) isMatch = false; // Transit
            else if (d.category === 0 && !showBlue) isMatch = false;   // Family
            else if (d.category === 1 && !showGreen) isMatch = false;  // Balanced <--- NEW LOGIC
            
            // C. Slider Filters
            if (d.adult_share < minAdult) isMatch = false;
            if (d.child_share > maxChild) isMatch = false;
        }

        // Apply Visibility
        if (isMatch) {
            // SHOW
            polyEl.style.fillOpacity = '0.9';
            polyEl.style.strokeOpacity = '1';
            polyEl.style.pointerEvents = 'auto'; 
            
            if (labelMarker) {
                const el = labelMarker.getElement();
                if(el) el.classList.remove('ghost-hidden'); 
            }

            visibleDistricts.push(d);
            visibleStates.add(d.State);
            
            if (!stateGrouping[d.State]) stateGrouping[d.State] = [];
            stateGrouping[d.State].push(d);
            totalCount++;

        } else {
            // HIDE
            polyEl.style.fillOpacity = '0.05'; 
            polyEl.style.strokeOpacity = '0.1';
            polyEl.style.pointerEvents = 'none'; 
            
            if (labelMarker) {
                labelMarker.setOpacity(0); 
                const el = labelMarker.getElement();
                if(el) {
                    el.style.display = 'none'; 
                    el.classList.add('ghost-hidden');
                }
            }
        }
    });

    // 4. HIDE STATE LABELS IF EMPTY
    stateLabelMap.forEach((marker, stateName) => {
        const el = marker.getElement();
        if (el) {
            if (visibleStates.has(stateName)) {
                el.classList.remove('ghost-hidden');
            } else {
                el.style.display = 'none';
                el.classList.add('ghost-hidden');
            }
        }
    });

    // 5. UPDATE UI
    updateButterflyChart(visibleDistricts);
    updateMagicQuadrant(visibleDistricts);
    
    if (typeof updateBivariateLegend === 'function' && activeScannerFilter === null) {
        updateBivariateLegend(visibleDistricts);
    }
    
    if (typeof renderResultsList === 'function') {
        renderResultsList(stateGrouping, totalCount);
    }
    
    if (typeof updateLayers === 'function') {
        updateLayers();
    }
    // --- FINANCIAL CALCULATION (MODULE 1: MIGRATION) ---
    // Logic: Identify visible "Source/Idle" districts (Category 0 or Magnet < -1)
    // Assumption: 10 Idle Kits per Source District * ₹1.5L Kit Cost
    let potentialIdleKits = 0;
    let visibleGap = 0;

    visibleDistricts.forEach(d => {
        // CAPEX Logic: If it's a Source/Family area (Cat 0), it has idle capacity
        if (d.category === 0 || d.magnet_score < -1) {
            potentialIdleKits += 10; 
        }
        // Fraud Logic: Sum of gaps in visible area
        visibleGap += (d.compliance_gap || 0);
    });

    const formatMoney = (amount) => {
        if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
        return `₹${amount.toLocaleString('en-IN')}`; // Adds commas (e.g., 1,50,000)
    };

    // 2. Calculate based on Visible Districts (Scanner/Tuner Results)
    let idleSavings = 0;
    let serviceRisk = 0;

    visibleDistricts.forEach(d => {
        // LOGIC A: RED ZONES (Workers) -> IDLE ASSETS
        // Adults (Workers) mostly do online updates. Machines here are wasted.
        // If Category is 3 (Red) or Adult Share is High (> 60%), we can recover kits.
        if (d.category === 3 || d.adult_share > 60) {
            // Assumption: 5 Idle Kits recovered per Worker District
            idleSavings += (5 * 150000); 
        }

        // LOGIC B: BLUE ZONES (Families) -> SERVICE RISK
        // Families have kids. Kids need biometrics. If we fail here, it's a risk.
        // We use the 'compliance_gap' (missing bios) to calculate this risk.
        if (d.category === 0 || d.child_share > 40) {
            serviceRisk += ((d.compliance_gap || 0) * 500);
        }
    });

    // 3. Update the Top Bar (The Financial HUD)
    const elSavings = document.getElementById('ticker-savings');
    const elRisk = document.getElementById('ticker-risk');

    if (elSavings) {
        // Animate the number for effect
        animateValue(elSavings, 0, idleSavings, 1000); 
        // Apply the "Money Format" with text
        elSavings.innerText = `💰 CAPEX Recovery: ${formatMoney(idleSavings)}`;
    }
    
    if (elRisk) {
        // Risk Mitigation (Preventing subsidy leakage in family zones)
        elRisk.innerText = `🛡️ Subsidy Risk: ${formatMoney(serviceRisk)}`;
    }
    // Inside applyMapFilters(), at the bottom:
updateSimulationTicker('map', visibleDistricts, false);
}
function renderResultsListGrouped(districtList) {
    const stateGrouping = {};
    let totalCount = 0;

    districtList.forEach(d => {
        if (!stateGrouping[d.State]) stateGrouping[d.State] = [];
        stateGrouping[d.State].push(d);
        totalCount++;
    });

    // Call the main renderer
    renderResultsList(stateGrouping, totalCount);
}

function updateBivariateLegend(data) {
    // A. CALCULATE THRESHOLDS ONCE (The "Anchor")
    // This runs only on the first load, locking the logic to the Global Data
    if (!globalBiThresholds && allDistricts.length > 0) {
        // Filter out bad data (0 population) to get true percentiles
        const validData = allDistricts.filter(d => (d.adult_share + d.child_share) > 0);
        
        const [w33, w66] = calculateQuantiles(validData, 'adult_share');
        const [f33, f66] = calculateQuantiles(validData, 'child_share');
        
        globalBiThresholds = { w33, w66, f33, f66 };
        
        // Pre-calculate the Bin Index for EVERY district immediately
        currentBiBins.clear();
        allDistricts.forEach(d => {
            if ((d.adult_share + d.child_share) === 0) {
                 currentBiBins.set(d.District, -1); // Mark as No Data
                 return;
            }

            // Strict Logic: Row (Adults)
            let row = 1; 
            if (d.adult_share > w66) row = 0;      // High Work
            else if (d.adult_share < w33) row = 2; // Low Work
    
            // Strict Logic: Col (Children)
            let col = 1;
            if (d.child_share > f66) col = 2;      // High Fam
            else if (d.child_share < f33) col = 0; // Low Fam
    
            const index = (row * 3) + col;
            currentBiBins.set(d.District, index);
        });
        
        console.log("Global Thresholds Locked:", globalBiThresholds);
    }

    // B. COUNT VISIBLE DISTRICTS
    // We count how many of the *currently filtered* districts fall into each bin
    const binCounts = Array(9).fill(0);
    
    data.forEach(d => {
        const idx = currentBiBins.get(d.District);
        if (idx !== undefined && idx >= 0) {
            binCounts[idx]++;
        }
    });

    // C. RENDER THE LEGEND
    const container = document.querySelector('.map-legend');
    if (!container) return; 

    let gridHTML = '<div class="bi-grid">';
    
    currentBiColors.forEach((color, i) => {
        const count = binCounts[i];
        const isEmpty = count === 0;
        
        // HACKATHON POLISH: 
        // 1. Even if empty, keep it clickable so judges can see "0 Districts"
        // 2. Use a dashed border for empty boxes to imply "Potential Zone"
        const opacity = isEmpty ? 0.4 : 1; 
        const border  = isEmpty ? '1px dashed #bbb' : '1px solid rgba(0,0,0,0.2)';
        
        gridHTML += `
            <div class="bi-cell" 
                 style="background:${color}; opacity:${opacity}; cursor:pointer; border:${border}; position:relative;"
                 onclick="filterByBiZone(${i})"
                 onmouseover="showBiTooltip(${i}, ${count})"
            >
                ${isEmpty ? '<span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:9px; color:#333; font-weight:bold;">0</span>' : ''}
            </div>`;
    });
    gridHTML += '</div>';

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="font-size:11px; font-weight:800; color:#2c3e50;">POPULATION SCANNER</div>
            <button onclick="resetBiZone()" class="btn btn-outline-secondary btn-sm" style="font-size:8px; padding: 1px 5px;">↺ RESET</button>
        </div>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
            <div class="bi-axis" style="color:#c0392b; font-size:9px;">More Workers &uarr;</div>
            <div class="bi-axis" style="color:#2980b9; font-size:9px;">More Families &rarr;</div>
        </div>

        ${gridHTML}

        <div id="bi-status">
            <b>Hover over a color</b><br>to analyze.
        </div>
    `;
    return;
}
function showBiTooltip(index, count = null) {
    // UPDATED: Target the correct ID '#bi-status'
    const el = document.getElementById('bi-status'); 
    const info = biDetails[index];
    
    if(el && info) {
        // Update the content and set border color
        el.style.borderLeftColor = currentBiColors[index];
        el.innerHTML = `
            <strong style="color:${currentBiColors[index]}">${info.title}</strong>
            <br>
            ${info.desc}
        `;
    }
}function generateRadarSVG(d) {
    // Normalize values (Approximate ranges based on data)
    const valWork = Math.min(d.adult_share, 100) / 100;
    const valFam  = Math.min(d.child_share, 100) / 100;
    const valVel  = Math.min(Math.abs(d.magnet_score) / 10, 1); // Cap velocity at 10
    const valRisk = d.sir_score ? Math.max(0, 1 - d.sir_score) : 0; // 1.0 is Safe, 0.0 is Risky

    // Coordinates (Center 60,60, Radius 40)
    const cx = 60, cy = 60, r = 40;
    const points = [
        [cx, cy - (r * valWork)], // Top (Workforce)
        [cx + (r * valFam), cy],  // Right (Family)
        [cx, cy + (r * valVel)],  // Bottom (Velocity)
        [cx - (r * valRisk), cy]  // Left (Risk)
    ].map(p => p.join(',')).join(' ');

    return `
    <svg width="120" height="120" style="margin: 0 auto; display: block;">
        <circle cx="60" cy="60" r="40" fill="none" stroke="#eee" stroke-width="1"/>
        <circle cx="60" cy="60" r="20" fill="none" stroke="#eee" stroke-width="1"/>
        <line x1="60" y1="20" x2="60" y2="100" stroke="#eee" />
        <line x1="20" y1="60" x2="100" y2="60" stroke="#eee" />
        <polygon points="${points}" fill="rgba(231, 76, 60, 0.5)" stroke="#c0392b" stroke-width="2"/>
        <text x="60" y="15" text-anchor="middle" font-size="8" fill="#555">Workforce</text>
        <text x="110" y="63" text-anchor="middle" font-size="8" fill="#555">Family</text>
        <text x="60" y="115" text-anchor="middle" font-size="8" fill="#555">Velocity</text>
        <text x="10" y="63" text-anchor="middle" font-size="8" fill="#555">Risk</text>
    </svg>`;
}
function renderResultsListGrouped(districtList) {
    const stateGrouping = {};
    let totalCount = 0;

    districtList.forEach(d => {
        if (!stateGrouping[d.State]) stateGrouping[d.State] = [];
        stateGrouping[d.State].push(d);
        totalCount++;
    });

    // Call the main renderer
    renderResultsList(stateGrouping, totalCount);
}

function renderResultsList(grouping, count) {
    const container = document.getElementById('results-accordion');
    const countLabel = document.getElementById('visible-count');
    
    if (countLabel) countLabel.innerText = count;
    if (!container) return;

    container.innerHTML = ""; 

    if (count === 0) {
        container.innerHTML = `<div class="text-center text-muted mt-4" style="font-size:10px;">No districts match current filters</div>`;
        return;
    }

    const sortedStates = Object.keys(grouping).sort();
    const iconWorker = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="opacity:0.7"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z"/></svg>`;
    const iconHome = `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="opacity:0.7"><path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.707 1.5ZM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5 5 5Z"/></svg>`;

    sortedStates.forEach((state, index) => {
        const districts = grouping[state];
        const stateId = `collapse-${index}`;
        
        const item = document.createElement('div');
        item.className = "accordion-item border-0 border-bottom";
        
        item.innerHTML = `
            <h2 class="accordion-header">
                <button class="accordion-button collapsed py-2 px-0 bg-transparent shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#${stateId}">
                    <span class="fw-bold text-dark me-2" style="font-size:11px;">${state}</span>
                    <span class="badge bg-light text-secondary border rounded-pill" style="font-size:9px;">${districts.length}</span>
                </button>
            </h2>
            <div id="${stateId}" class="accordion-collapse collapse">
                <div class="accordion-body p-0 pb-2">
                    ${districts.map(d => {
                        let dotColor = d.category === 3 ? "#c0392b" : (d.category === 0 ? "#2980b9" : (d.category === 2 ? "#f39c12" : "#27ae60"));
                        
                        // PRECISE VALUES
                        let wVal = d.adult_share.toFixed(1);
                        let fVal = d.child_share.toFixed(1);

                        return `
                        <div class="py-2 px-2 mb-1 rounded border-bottom" style="background:#fff;">
                            <div class="d-flex align-items-center justify-content-between mb-2">
                                <div class="d-flex align-items-center">
                                    <div style="width:6px; height:6px; background:${dotColor}; border-radius:50%; margin-right:6px;"></div>
                                    <span style="font-size:11px; font-weight:600; color:#333;">${d.District}</span>
                                </div>
                                <div class="text-muted" style="font-size:9px;">ID: ${d.District.substring(0,3).toUpperCase()}</div>
                            </div>
                            
                            <div class="d-flex align-items-center mb-1">
                                <div style="width:15px;" class="text-center">${iconWorker}</div>
                                <div class="progress flex-grow-1 mx-2" style="height:4px; background:#f0f0f0;">
                                    <div class="progress-bar" style="width:${d.adult_share}%; background:#555;"></div>
                                </div>
                               <span style="font-size:9px; color:#333; min-width:40px; text-align:right;">${wVal}%</span>
                            </div>

                            <div class="d-flex align-items-center mb-2">
                                <div style="width:15px;" class="text-center">${iconHome}</div>
                                <div class="progress flex-grow-1 mx-2" style="height:4px; background:#f0f0f0;">
                                    <div class="progress-bar" style="width:${d.child_share}%; background:#999;"></div>
                                </div>
                                <span style="font-size:9px; color:#333; width:30px; text-align:right;">${fVal}%</span>
                            </div>

                            <div class="text-end">
                                <a href="#" class="text-primary fw-bold" style="font-size:9px; text-decoration:none;"
                                   onclick="handleDistrictClick(globalDataMap.get('${d.District}')); return false;">
                                   View Detailed Summary &rarr;
                                </a>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}
function resetFilters() {
    // Reset controls to default
    document.getElementById('filter-adult').value = 0;
    document.getElementById('filter-child').value = 100;
    
    ['toggle-red', 'toggle-orange', 'toggle-primary', 'toggle-success'].forEach(id => {
        document.getElementById(id).checked = true;
    });
    
    // Re-apply to show everything
    applyMapFilters();
}
function updateTransferTable(transfers) {
    const tbody = document.getElementById('transfer-table-body');
    tbody.innerHTML = "";

    transfers.forEach(t => {
        const row = `
            <tr>
                <td>
                    <div class="fw-bold text-dark" style="font-size:11px;">${t.from_dist}</div>
                    <div class="text-muted" style="font-size:9px;">(${t.from_state})</div>
                </td>
                <td>
                    <div class="fw-bold text-dark" style="font-size:11px;">${t.to_dist}</div>
                    <div class="text-muted" style="font-size:9px;">(${t.to_state})</div>
                </td>
                <td class="fw-bold text-dark align-middle">${t.amount}</td>
                <td class="align-middle"><span class="badge bg-warning text-dark">IN TRANSIT</span></td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}
function getFeatureStyle(feature) {
    const d = globalDataMap.get(feature.properties.NAME_2);
    let color = '#ecf0f1'; 
    
    if (d) {
        if (currentModule === 'map') {
            if (d.category === 3) color = '#c0392b';      // Red (Workers)
            else if (d.category === 2) color = '#f39c12'; // Orange (Mixed)
            else if (d.category === 0) color = '#2980b9'; // Blue (Families)
            else color = '#ffffff';                       // WHITE (Balanced) - CHANGED FROM GREEN
        } else {
            // Risk View Colors
            if (d.risk_label === 'HIGH RISK') color = '#c0392b';    
            else if (d.risk_label === 'MEDIUM RISK') color = '#f39c12'; 
            else color = '#27ae60';                                 
        }
    }
    // Stroke is slightly darker to make White visible
    return { fillColor: color, weight: 0.5, opacity: 1, color: '#999', fillOpacity: 0.9 };
}

function getTooltipContent(d, name) {
    if (!d) return `<b>${name}</b><br>No Data`;

    // STRATEGY: Define a Policy Action based on the Category
    let action = "";
    let actionColor = "#333";
    
    if (currentModule === 'map') {
        if (d.category === 3) {
            action = "🏗️ <b>ACTION:</b> Deploy Labor Housing & Night Shelters";
            actionColor = "#c0392b"; // Red
        } else if (d.category === 0) {
            action = "📉 <b>ACTION:</b> Audit Remittance & Welfare Schemes";
            actionColor = "#2980b9"; // Blue
        } else if (d.category === 2) {
            action = "🚍 <b>ACTION:</b> Increase Transport Frequency";
            actionColor = "#f39c12"; // Orange
        } else {
            action = "✅ <b>STATUS:</b> Stable. Monitor Quarterly.";
            actionColor = "#27ae60"; // Green
        }
        
        const desc = d.category === 3 ? "🚨 <b>Magnet Hub</b> (High Influx)" : 
                     d.category === 0 ? "📉 <b>Source Area</b> (High Outflux)" : 
                     d.category === 2 ? "⚠️ <b>Transit Zone</b> (Floating)" : "✅ <b>Balanced</b>";
        
        return `<div style="text-align:left; min-width:160px; font-family:'Segoe UI', sans-serif;">
                  <div style="background:${actionColor}; color:white; padding:4px 8px; border-radius:4px 4px 0 0; font-size:10px; font-weight:bold;">
                    ${name.toUpperCase()}
                  </div>
                  <div style="padding:8px; border:1px solid #ccc; border-top:none; background:rgba(255,255,255,0.95); border-radius:0 0 4px 4px;">
                      <div style="font-size:11px; margin-bottom:4px; color:#555;">${d.State}</div>
                      <div style="margin-bottom:6px;">${desc}</div>
                      <div style="font-size:9px; background:#f4f4f4; padding:5px; border-radius:4px; border-left:3px solid ${actionColor};">
                        ${action}
                      </div>
                      <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:9px; color:#666;">
                         <span>Adults: <b>${d.adult_share.toFixed(0)}%</b></span>
                         <span>Kids: <b>${d.child_share.toFixed(0)}%</b></span>
                      </div>
                  </div>
                </div>`;
    }else {
        const phantomRate = d.demo > 0 ? ((d.compliance_gap / d.demo) * 100).toFixed(1) : "0.0";

return `
<div style="font-family:'Segoe UI', sans-serif; min-width:160px; box-shadow:0 4px 15px rgba(0,0,0,0.15);">
    <div style="background:${color}; color:white; padding:6px 10px; font-weight:bold; font-size:11px; border-radius:4px 4px 0 0; text-transform:uppercase; display:flex; justify-content:space-between;">
        <span>${status}</span>
        <span>⚠️</span>
    </div>
    
    <div style="padding:10px; background:white; border-radius:0 0 4px 4px; border:1px solid #ddd; border-top:none;">
        <div style="font-size:11px; font-weight:bold; color:#333; margin-bottom:4px;">${name}</div>
        <div style="font-size:10px; color:#555; margin-bottom:8px;">${message}</div>

        <div style="background:${bgColor}; padding:6px; border-radius:4px; border-left:3px solid ${color};">
            <div style="display:flex; justify-content:space-between; font-size:9px; color:#333; margin-bottom:2px;">
                <span>Missing Bio:</span>
                <b>${d.compliance_gap.toLocaleString()}</b>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:9px; color:#333;">
                <span>Phantom Rate:</span>
                <b>${phantomRate}%</b>
            </div>
        </div>
    </div>
</div>`;
    }
}
function initMapLayers(districtGeoJSON, stateGeoJSON) {
    // 1. District Layer
// Add this Style Injection at the top of initMapLayers or script.js
const labelStyle = document.createElement('style');
labelStyle.innerHTML = `
    .state-label div {
        font-family: 'Segoe UI', sans-serif;
        font-weight: 900;
        color: #34495e;
        /* White Halo Effect to separate text from lines */
        text-shadow: 
            2px 0 #fff, -2px 0 #fff, 0 2px #fff, 0 -2px #fff,
            1px 1px #fff, -1px -1px #fff, 1px -1px #fff, -1px 1px #fff;
        text-align: center;
        white-space: nowrap;
        pointer-events: none;
    }
`;
document.head.appendChild(labelStyle);document.head.appendChild(labelStyle);
    districtLayer = L.geoJSON(districtGeoJSON, {
        
        smoothFactor: 2,
        style: getFeatureStyle,
        onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_2;
            const d = globalDataMap.get(name);            
            
            // ACTIONABLE TOOLTIP
            layer.bindTooltip(getPolicyTooltip(d, name), { 
                direction: "top", className: "custom-tooltip", opacity: 1, sticky: true, offset: [0, -10]
            });

            layer.on('click', () => { if(d) handleDistrictClick(d); });

            const center = layer.getBounds().getCenter();
            const districtLabel = L.marker(center, { 
                icon: L.divIcon({ className: 'district-label', html: `<div>${name}</div>`, iconSize: [100, 20], iconAnchor: [50, 10] }), 
                interactive: false 
            }).addTo(map);
            districtLabelMap.set(name, districtLabel);
        }
    }).addTo(map);
          
    // 2. State Layer
    stateLayer = L.geoJSON(stateGeoJSON, {
        smoothFactor: 2,
        style: { fillColor: 'transparent', weight: 1.5, color: '#34495e', fillOpacity: 0 },
        onEachFeature: (feature, layer) => {
            let name = feature.properties.NAME_1;

            // --- 1. REMOVE CHANDIGARH ---
            if (name === "Chandigarh") return; // Skip completely

            // --- 2. FIX NAMES (Restores Odisha & Meghalaya data) ---
            if(name === "Orissa") name = "Odisha";
            if(name === "Uttaranchal") name = "Uttarakhand";
            if(name === "Pondicherry") name = "Puducherry";
            
            // --- 3. MERGE WESTERN UTs ---
            // If the map finds individual polygons, ignore their labels.
            // We will inject a single unified label later.
            if(name === "Daman and Diu" || name === "Dadra and Nagar Haveli") return;

            // --- 4. APPLY COORDINATE FIX ---
            let center = layer.getBounds().getCenter();
            
            // Force the label to the corrected position from our list
            if (STATE_LABEL_FIXES[name]) {
                center = L.latLng(STATE_LABEL_FIXES[name]);
            }

            // Create the Label
            const stateLabel = L.marker(center, { 
                icon: L.divIcon({ 
                    className: 'state-label', 
                    html: `<div>${name.toUpperCase()}</div>`, 
                    iconSize: [150, 40], 
                    iconAnchor: [75, 20] 
                }), 
                interactive: false 
            }).addTo(map);
            stateLabelMap.set(name, stateLabel);
        }
    }).addTo(map);

    // --- 5. INJECT MISSING LABELS ---
    // This draws labels for things that might be missing from the GeoJSON entirely
    const MISSING_STATES = [
        "Telangana", 
        "Ladakh", 
        "Dadra and Nagar Haveli and Daman and Diu", 
        "Meghalaya",
        "Odisha"  // <--- ADD THIS. It forces the label to appear.
    ];

    MISSING_STATES.forEach(missingName => {
        if (STATE_LABEL_FIXES[missingName] && !stateLabelMap.has(missingName)) {
            const center = L.latLng(STATE_LABEL_FIXES[missingName]);
            
            const label = L.marker(center, { 
                icon: L.divIcon({ 
                    className: 'state-label', 
                    html: `<div>${missingName.toUpperCase()}</div>`, 
                    iconSize: [150, 40], 
                    iconAnchor: [75, 20] 
                }), 
                interactive: false 
            }).addTo(map);
            
            stateLabelMap.set(missingName, label);
        }
    });
   // --- 3. SIMPLE LEGEND (Updated for White/Balanced) ---
    const legend = L.control({ position: 'bottomright' }); 
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.background = "rgba(255, 255, 255, 0.95)";
        div.style.padding = "6px 8px";
        div.style.width = "130px";
        div.style.borderRadius = "5px";
        div.style.boxShadow = "0 1px 4px rgba(0,0,0,0.2)";
        div.style.fontSize = "10px";
        div.style.fontFamily = "'Segoe UI', sans-serif";

        const labels = ["Worker Hub", "Transit Zone", "Family Village", "Balanced"];
        
        // UPDATED COLORS: Last one is White
        const colors = ['#c0392b', '#f39c12', '#2980b9', '#ffffff']; 
        
        // UPDATED BORDERS: Add border to the white box only
        const borders = ['none', 'none', 'none', '1px solid #ccc'];

        let html = '<div style="font-weight:800; margin-bottom:4px; font-size:10px; color:#333; text-transform:uppercase;">DEMOGRAPHIC ZONES</div>';

        for (let i = 0; i < labels.length; i++) {
            html +=
                '<div style="display:flex; align-items:center; margin-bottom:2px;">' +
                `<i style="background:${colors[i]}; border:${borders[i]}; width:10px; height:10px; display:inline-block; margin-right:6px; border-radius:2px;"></i> ` +
                `<span>${labels[i]}</span>` +
                '</div>';
        }
        div.innerHTML = html;
        return div;
    };
    legend.addTo(map);

    // --- 4. POPULATION SCANNER (FIXED) ---
    
    // A. Count Districts per Bin
    

    map.on('moveend', updateLayers);
    map.fitBounds(districtLayer.getBounds());
    updateLayers();
    
    // Initialize Logic
    applyMapFilters();

    // [PASTE YOUR CODE HERE]
    // --- FORCE ODISHA & MEGHALAYA (Fail-Safe Injection) ---
    const forcedLabels = ["Odisha", "Meghalaya"];
    
    forcedLabels.forEach(name => {
        // 1. Remove any existing broken label to prevent duplicates
        if (stateLabelMap.has(name)) {
            const oldLabel = stateLabelMap.get(name);
            map.removeLayer(oldLabel);
        }

        // 2. Create Fresh Label
        // IMPORTANT: Ensure STATE_LABEL_FIXES is defined at the top of script.js
        if (typeof STATE_LABEL_FIXES !== 'undefined' && STATE_LABEL_FIXES[name]) {
            const center = L.latLng(STATE_LABEL_FIXES[name]);
            const label = L.marker(center, { 
                icon: L.divIcon({ 
                    className: 'state-label', 
                    html: `<div>${name.toUpperCase()}</div>`, 
                    iconSize: [150, 40], 
                    iconAnchor: [75, 20] 
                }), 
                interactive: false 
            }).addTo(map);

            // 3. Register it
            stateLabelMap.set(name, label);
        }
    });

} // <--- This is the
window.resetBiFilter = function() {
    // 1. Reset the Active Filter Variable
    activeScannerFilter = null;

    // 2. Reset the Scanner Info Box Text
    const statusEl = document.getElementById('bi-status-text');
    if (statusEl) {
        statusEl.innerHTML = "Hover to scan";
    }

    // 3. Reset Map Background
    const mapEl = document.getElementById('map-canvas');
    if(mapEl) mapEl.style.background = "#f8f9fa"; // Default light gray

    // 4. Reset Dropdown to Show ALL States again
    // (The scanner might have filtered the dropdown to show only "Red" states, so we fix that)
    const dropdown = document.getElementById('filter-state-select');
    if (dropdown && stateLayer) {
        dropdown.innerHTML = '<option value="ALL">Show All India</option>';
        
        // Extract all states from the map layer and re-populate
        const states = [];
        stateLayer.eachLayer(l => states.push(l.feature.properties.NAME_1));
        states.sort().forEach(state => {
            const option = document.createElement('option');
            option.value = state;
            option.innerText = state;
            dropdown.appendChild(option);
        });
    }

    // 5. Re-apply normal map filters (This resets the district colors)
    applyMapFilters();
};
// [IN script.js]

// [IN script.js]

// [IN script.js]

// [IN script.js]

function updateButterflyChart(data, stateName = "All India") {
    const containerId = 'butterfly-chart';
    const container = document.getElementById(containerId);

    if (!container) return;

    // 1. SAFE EXIT
    if (!data || data.length === 0) {
        try {
            Plotly.react(containerId, [], {
                title: false,
                xaxis: { showgrid: false, zeroline: false, showticklabels: false },
                yaxis: { showgrid: false, zeroline: false, showticklabels: false },
                height: 250,
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            }, { displayModeBar: false });
            
            const capEl = document.getElementById('chart-caption');
            if(capEl) capEl.innerText = "No data available";
        } catch(e) { console.log("Chart clear error ignored"); }
        return;
    }

    // 2. SORTING & SELECTION
    const sorted = [...data].sort((a,b) => b.magnet_score - a.magnet_score);
    let chartData = [];
    let caption = "";

    if (data.length <= 20) {
        chartData = sorted;
        caption = `Profile: ${stateName}`;
    } else {
        const top10 = sorted.slice(0, 10); 
        const bot10 = sorted.slice(sorted.length - 10); 
        chartData = [...top10, ...bot10]; 
        chartData.sort((a,b) => b.magnet_score - a.magnet_score);
        caption = `Contrast: Labor vs Families in ${stateName}`;
    }

    // [FIX 1] DEDUPLICATE
    const seenDistricts = new Set();
    chartData = chartData.filter(d => {
        if (seenDistricts.has(d.District)) return false;
        seenDistricts.add(d.District);
        return true;
    });

    // 3. PREPARE PLOT
    const nationalAvg = 95.0;
    const xValues = chartData.map(d => d.adult_share - nationalAvg);
    const yValues = chartData.map(d => d.District); 
    
    // [FIX 2] PADDING for Labels
    const maxDeviation = Math.max(...xValues.map(Math.abs));
    const symmetricalLimit = Math.max(maxDeviation * 1.8, 65); 

    const textLabels = xValues.map(v => {
        return v >= 0 
            ? `+${v.toFixed(1)}% Workers` 
            : `+${Math.abs(v).toFixed(1)}% Families`;
    });

    const colors = chartData.map(d => {
        if (d.category === 3) return '#c0392b';       
        if (d.category === 2) return '#f39c12';       
        if (d.category === 0) return '#2980b9';       
        return '#95a5a6';                             
    });

    // [FIX 3] THRESHOLD 45 (Prevents text spill)
    const threshold = 45; 
    const textPositions = xValues.map(v => Math.abs(v) < threshold ? 'outside' : 'inside');
    const textColors = xValues.map(v => Math.abs(v) < threshold ? '#000000' : '#ffffff');

    const trace = {
        x: xValues,
        y: yValues,
        type: 'bar',
        orientation: 'h',
        marker: { 
            color: colors, 
            opacity: 0.9,
            line: { color: colors, width: 1 } 
        },
        text: textLabels,
        textposition: textPositions,
        textfont: { 
            size: 10,
            family: 'Segoe UI',
            color: textColors,
            weight: 'bold'
        },
        hoverinfo: 'y+text',
        cliponaxis: false,
        constraintext: 'none' 
    };
    
    const calculatedHeight = Math.max(250, chartData.length * 25);
    const finalHeight = Math.min(calculatedHeight, 500); 

    const layout = {
        autosize: true, // [FIX 4] ENSURES CHART FITS CONTAINER ON RESIZE
        title: false,
        margin: { t: 10, b: 30, l: 80, r: 80 },
        xaxis: { 
            title: '← Surplus Families | National Avg | Surplus Workers →',
            titlefont: { size: 9, color: '#888' },
            zeroline: true, zerolinecolor: '#333', zerolinewidth: 2,
            showgrid: true, gridcolor: '#eee',
            range: [-symmetricalLimit, symmetricalLimit], 
            fixedrange: true 
        },
        yaxis: { 
            autorange: "reversed", 
            tickfont: { size: 10 },
            automargin: true 
        },
        height: finalHeight, 
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)', 
        plot_bgcolor: 'rgba(0,0,0,0)'
    };
    
    const capEl = document.getElementById('chart-caption');
    if(capEl) {
        capEl.innerText = caption;
        capEl.style.fontWeight = "bold";
    }

    try {
        Plotly.newPlot(containerId, [trace], layout, {
            displayModeBar: false, 
            responsive: true,
            scrollZoom: false 
        });
    } catch(e) {
        console.error("Plotly render error:", e);
    }
}
async function handleDistrictClick(d) {
    if (!d) return;
    
    // Trigger Ticker
    const btn = document.getElementById('btn-ticker-reset');
    if(btn) btn.style.display = 'block';
    updateSimulationTicker('map', d, true);

    // Highlight Map
    if (window.highlightLayer) map.removeLayer(window.highlightLayer);
    districtLayer.eachLayer(layer => {
        if (layer.feature.properties.NAME_2 === d.District) {
            window.highlightLayer = L.geoJSON(layer.feature, {
                style: { color: '#000', weight: 3, fillOpacity: 0 }
            }).addTo(map);
        }
    });

    // Switch Sidebar
    const defaultView = document.getElementById('sidebar-default-view');
    const detailView = document.getElementById('sidebar-detail-view');
    if (defaultView && detailView) {
        defaultView.style.display = 'none';
        detailView.style.display = 'flex'; 
    }

    let categoryTitle = "STABLE ZONE";
    let categoryColor = "#27ae60";
    let summaryText = "Balanced growth.";
    
    if (d.category === 3) { 
        categoryTitle = "HIGH WORKER INFLUX"; categoryColor = "#c0392b";
        summaryText = "High labor migration detected. Housing stress likely.";
    } else if (d.category === 0) { 
        categoryTitle = "FAMILY SOURCE AREA"; categoryColor = "#2980b9";
        summaryText = "High remittance dependency. Service delivery gap.";
    } else if (d.category === 2) { 
        categoryTitle = "TRANSIT HUB"; categoryColor = "#f39c12";
        summaryText = "Floating population surge. Transport overload.";
    }

    // SVG Icon for Search (Professional)
    const searchIconSVG = `<svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>`;

    // --- NEW LAYOUT ---
    detailView.innerHTML = `
        <div class="animate-fade-in" style="height: 100%; display: flex; flex-direction: column;">
            
            <div class="p-3 bg-white border-bottom border-4" style="border-color: ${categoryColor} !important;">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="badge mb-1" style="background:${categoryColor}; font-size:10px;">${categoryTitle}</div>
                        <h4 class="fw-bold text-dark m-0">${d.District.toUpperCase()}</h4>
                    </div>
                </div>
                <div class="mt-2 text-muted small" style="line-height: 1.4; font-size: 11px;">${summaryText}</div>
            </div>

            <div class="p-3 bg-white border-bottom pb-4">
                <h6 class="fw-bold text-secondary mb-3" style="font-size:10px;">DISTRICT DNA</h6>
                <div id="district-radar-chart" style="height: 200px; width: 100%; margin: 0 auto;"></div> 
            </div>

            <div class="p-3 bg-light border-bottom">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="fw-bold text-secondary m-0" style="font-size:10px;">PINCODE BREAKDOWN</h6>
                </div>
                <div class="input-group input-group-sm">
                    <span class="input-group-text bg-white border-end-0 text-muted" style="font-size:10px;">${searchIconSVG}</span>
                    <input type="text" id="mig-pin-search" class="form-control border-start-0 ps-1" 
                           placeholder="Search Area Code..." 
                           style="font-size:10px;" 
                           onkeyup="filterMigrationPincodes(this.value)">
                </div>
            </div>

            <div id="pincode-micro-view" class="flex-grow-1 overflow-auto p-2" style="background: #f8f9fa;">
                <div class="text-center py-5 text-muted" style="font-size:10px;">Loading data...</div>
            </div>

            <div class="p-3 bg-white border-top">
                <button class="btn btn-outline-dark w-100 btn-sm fw-bold" onclick="restoreDefaultSidebar()">← BACK TO MAP</button>
            </div>
        </div>
    `;

    // Render Chart
    setTimeout(() => {
        renderVulnerabilityRadar(d, 'district-radar-chart', categoryColor);
    }, 100);

    // Fetch & Render List with Pagination
    try {
        const res = await fetch(`/api/district-details?district=${d.District}`);
        const data = await res.json();
        
        // Initialize Pagination Data
        fullMigData = data.pincodes || [];
    currentMigData = fullMigData;
    currentMigPage = 1;
    currentMigCategory = d.category; // [FIX] Save category globally

    // Call the new Renderer
    renderPincodeInsights(currentMigCategory);
    } catch (e) {
        console.error("Fetch failed", e);
        document.getElementById('pincode-micro-view').innerHTML = `<div class="text-danger small p-3 text-center">Data unavailable</div>`;
    }
}
function renderPincodeInsights(category) {
    const container = document.getElementById('pincode-micro-view');
    if (!container) return;

    if (!currentMigData || currentMigData.length === 0) {
        container.innerHTML = `<div class="text-muted small text-center p-4">No pincode anomalies detected.</div>`;
        return;
    }

    // Pagination Logic
    const totalPages = Math.ceil(currentMigData.length / MIG_ROWS_PER_PAGE);
    
    // [FIX] Use the global 'currentMigPage' variable directly
    const start = (currentMigPage - 1) * MIG_ROWS_PER_PAGE;
    const pageData = currentMigData.slice(start, start + MIG_ROWS_PER_PAGE);

    // Color Logic
    let metricLabel = "Risk Level";
    let color = "#555";
    if (category === 3) { metricLabel = "Population Load"; color = "#c0392b"; } 
    else if (category === 0) { metricLabel = "Service Demand"; color = "#2980b9"; } 
    else if (category === 2) { metricLabel = "Daily Traffic"; color = "#f39c12"; } 
    else { metricLabel = "Growth Rate"; color = "#27ae60"; } 

    // Header
    let html = `
    <div>
        <div class="d-flex justify-content-between text-muted mb-2 px-2" style="font-size:9px; font-weight:bold;">
            <span style="width:30%">PINCODE</span>
            <span style="width:50%">${metricLabel.toUpperCase()}</span>
            <span style="width:20%; text-align:right;">STATUS</span>
        </div>
        <div class="d-flex flex-column gap-2">`;

    // Items
    pageData.forEach(item => {
        const rawVal = item.gap || item.addr || 0; 
        const maxVal = 2000; 
        let pct = Math.min(100, (rawVal / maxVal) * 100);
        let displayPct = pct.toFixed(1) + "%"; 
        
        let status = "Stable";
        let badgeClass = "text-muted border-secondary";
        
        if (pct > 70) { status = "High"; badgeClass = "text-danger border-danger"; }
        else if (pct > 40) { status = "Med"; badgeClass = "text-warning border-warning"; }

        html += `
        <div class="pin-item d-flex align-items-center justify-content-between p-2 border rounded bg-white shadow-sm" data-pin="${item.pin}">
            <div style="width: 30%;">
                <div class="fw-bold text-dark" style="font-size:11px;">${item.pin}</div>
            </div>
            <div style="width: 50%; padding:0 10px;">
                <div class="d-flex justify-content-between mb-1">
                     <span style="font-size:9px; font-weight:bold; color:${color}">${rawVal.toLocaleString()}</span>
                     <span style="font-size:9px; color:#777;">${displayPct}</span>
                </div>
                <div class="progress" style="height: 4px; background: #f0f0f0;">
                    <div class="progress-bar" style="width: ${pct}%; background-color: ${color}; border-radius:2px;"></div>
                </div>
            </div>
            <div style="width: 20%; text-align:right;">
                <span class="badge bg-white border ${badgeClass}" style="font-size:8px;">${status}</span>
            </div>
        </div>`;
    });

    html += `</div>`;

    if (totalPages > 1) {
        html += `
        <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
            <button class="btn btn-sm btn-outline-secondary py-0" style="font-size:10px;" 
                onclick="changeMigPage(-1)" ${currentMigPage === 1 ? 'disabled' : ''}>◀ Prev</button>
            
            <span class="text-muted fw-bold" style="font-size:9px;">Page ${currentMigPage} of ${totalPages}</span>
            
            <button class="btn btn-sm btn-outline-secondary py-0" style="font-size:10px;" 
                onclick="changeMigPage(1)" ${currentMigPage === totalPages ? 'disabled' : ''}>Next ▶</button>
        </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}
function changeMigPage(dir) {
    // 1. Safety Check
    if (!currentMigData || currentMigData.length === 0) return;

    // 2. Calculate Total Pages
    const totalPages = Math.ceil(currentMigData.length / MIG_ROWS_PER_PAGE);

    // 3. Update Page Index
    currentMigPage += dir;

    // 4. Boundary Checks
    if (currentMigPage < 1) currentMigPage = 1;
    if (currentMigPage > totalPages) currentMigPage = totalPages;

    // 5. Re-render using the SAVED category
    console.log(`Paging to ${currentMigPage} of ${totalPages}`); // Debug log
    renderPincodeInsights(currentMigCategory); 
}


function filterMigrationPincodes(query) {
    const filter = (query || "").toString().trim().toUpperCase();
    
    if (filter === "") {
        currentMigData = fullMigData;
    } else {
        currentMigData = fullMigData.filter(item => {
            return item.pin.toString().includes(filter);
        });
    }
    currentMigPage = 1;
    renderPincodeInsights(3); // Re-render with filtered data
}
function resetTickerToNational() {
    const btn = document.getElementById('btn-ticker-reset');
    if(btn) btn.style.display = 'none';

    // 1. Reset Logic for Map Module
    if (currentModule === 'map') {
        if(typeof resetMap === 'function') resetMap(); 
        if(typeof restoreDefaultSidebar === 'function') restoreDefaultSidebar();
    } 
    // 2. Reset Logic for Fraud/Risks Module
    else if (currentModule === 'risks') {
        // Resetting the state dropdown triggers the cascade to reset map and charts
        $('#risk-state-select').val('ALL').trigger('change');
    } 
    // 3. Reset Logic for Logistics Module
    else if (currentModule === 'logistics') {
        // Resetting the filter triggers the national view
        if(typeof filterLogisticsByState === 'function' && window.logisticsRawRoutes) {
            filterLogisticsByState('ALL', window.logisticsRawRoutes);
        }
    }
}
function restoreDefaultSidebar() {
    if (window.highlightLayer) map.removeLayer(window.highlightLayer);
    
    // Switch visibility back
    const defaultView = document.getElementById('sidebar-default-view');
    const detailView = document.getElementById('sidebar-detail-view');
    
    if (defaultView && detailView) {
        detailView.style.display = 'none';
        defaultView.style.display = 'block';
        window.dispatchEvent(new Event('resize')); // Fixes layout glitches
    }
}
function renderVulnerabilityRadar(d, divId, color) {
    const data = [
        Math.min(1, d.adult_share / 80),    
        Math.min(1, d.child_share / 40),    
        Math.min(1, Math.abs(d.magnet_score) / 10), 
        Math.min(1, (d.compliance_gap || 0) / 5000) 
    ];

    const trace = {
        type: 'scatterpolar',
        r: data,
        // [FIX] Updated Wordings to be more professional
        theta: ['Labor Force', 'Family Unit', 'Migration', 'Risk Score'], 
        fill: 'toself',
        fillcolor: color + '33', 
        line: { color: color, width: 2 },
        marker: { size: 4 }
    };

    const layout = {
        polar: {
            radialaxis: { visible: true, range: [0, 1], showticklabels: false, gridcolor: '#eee' },
            angularaxis: { tickfont: { size: 10, color: '#333', weight: 'bold' }, rotation: 90 }
        },
        // [FIX] Increased margins to ensure Top/Bottom labels are visible
        margin: { t: 35, b: 35, l: 45, r: 45 }, 
        autosize: true,
        height: 230,    // Increased height to fit labels + chart without squashing
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false
    };

    const config = {
        displayModeBar: false, 
        responsive: true // [FIX] CRITICAL: Allows chart to resize with browser window
    };

    Plotly.newPlot(divId, [trace], layout, config);
}
function renderHousingStressChart(d, divId) {
    const trace1 = {
        x: ['Homes Available', 'People Needing Homes'],
        y: [10000, 18500],
        type: 'bar',
        marker: { color: ['#bdc3c7', '#c0392b'] }, // Grey vs Red
        text: ['10k', '18.5k'],
        textposition: 'auto'
    };

    const layout = {
        title: { text: 'Housing Shortage Risk', font: {size: 11, family:'Segoe UI'} },
        margin: { t: 30, b: 20, l: 30, r: 10 },
        height: 180,
        yaxis: { visible: false },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };
    Plotly.newPlot(divId, [trace1], layout, {displayModeBar: false});
}
// --- 3. BLUE ZONE: Livelihood Gap (Grouped Bar) ---
function renderLivelihoodChart(d, divId) {
    const trace1 = {
        x: ['Jobs Here', 'Money Sent Home'],
        y: [30, 70],
        type: 'bar',
        marker: { color: ['#95a5a6', '#2980b9'] },
        text: ['30%', '70%'],
        textposition: 'auto'
    };

    const layout = {
        title: { text: 'Income Source: Local vs Transfers', font: {size: 11, family:'Segoe UI'} },
        margin: { t: 30, b: 20, l: 30, r: 10 },
        height: 180,
        yaxis: { visible: false },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };
    Plotly.newPlot(divId, [trace1], layout, {displayModeBar: false});
}
// --- 4. ORANGE ZONE: Population Churn (Line/Area) ---
function renderChurnChart(d, divId) {
    const trace = {
        x: ['6AM', '12PM', '6PM', 'Midnight'],
        y: [5000, 25000, 20000, 5000], // Shows the "Bell Curve" of daily traffic
        type: 'scatter',
        fill: 'tozeroy',
        mode: 'lines',
        line: { color: '#f39c12', shape: 'spline', width: 3 }
    };

    const layout = {
        title: { text: 'Daily Crowd Surge (Day vs Night)', font: {size: 11, family:'Segoe UI'} },
        margin: { t: 30, b: 20, l: 30, r: 10 },
        height: 180,
        yaxis: { visible: false },
        xaxis: { tickfont: {size: 9} },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    };
    Plotly.newPlot(divId, [trace], layout, {displayModeBar: false});
}
// --- 5. WHITE ZONE: Stability (Gauge) ---
function renderStabilityChart(d, divId) {
    const trace = {
        type: "indicator",
        mode: "gauge+number",
        value: 92,
        title: { text: "Future Growth Score", font: { size: 11 } },
        gauge: {
            axis: { range: [null, 100], visible: false },
            bar: { color: "#27ae60" },
            bgcolor: "#eee",
            borderwidth: 0
        }
    };

    const layout = { 
        margin: { t: 30, b: 20, l: 30, r: 30 }, 
        height: 180, 
        paper_bgcolor: 'rgba(0,0,0,0)' 
    };
    Plotly.newPlot(divId, [trace], layout, {displayModeBar: false});
}

// HELPER: Prevents functions from firing too often (fixes lag during zoom)
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

const updateLayers = debounce(function() {
    if (!map) return;

    const zoom = map.getZoom();
    const bounds = map.getBounds(); 
    const threshold = 6; 
    const isScannerActive = (typeof activeScannerFilter !== 'undefined' && activeScannerFilter !== null);

    // 1. MANAGE STATE LABELS (Visible when Zoomed OUT)
    if (typeof stateLabelMap !== 'undefined') {
        stateLabelMap.forEach((marker, stateName) => {
            const el = marker.getElement();
            if (el) {
                const isFilterHidden = el.classList.contains('ghost-hidden');
                
                // Scanner Logic: If scanner is OFF, all states are relevant.
                const isRelevantState = !isScannerActive || (window.activeScannerStates && window.activeScannerStates.has(stateName));

                // LOGIC: Show if Zoom is Low AND State is Relevant AND Not filtered manually
                // REMOVED: bounds.contains(marker.getLatLng()) check (This fixes disappearing labels)
                if (zoom < threshold && isRelevantState && !isFilterHidden) {
                    el.style.opacity = '1';
                    el.style.display = 'block';
                } else {
                    el.style.opacity = '0';
                    el.style.display = 'none'; 
                }
            }
        });
    }

    // 2. MANAGE DISTRICT LABELS (Visible when Zoomed IN)
    if (typeof districtLabelMap !== 'undefined') {
        if (zoom < threshold) {
            // Zoomed Out -> Hide All Districts
            districtLabelMap.forEach((marker) => {
                if (map.hasLayer(marker)) map.removeLayer(marker);
            });
        } else {
            // Zoomed In -> Show Visible Districts
            districtLabelMap.forEach((marker, distName) => {
                if (bounds.contains(marker.getLatLng())) {
                    const el = marker.getElement();
                    const isFilterHidden = el ? el.classList.contains('ghost-hidden') : false;
                    
                    let isMatchingDistrict = true;
                    if (isScannerActive && typeof currentBiBins !== 'undefined') {
                         const distBin = currentBiBins.get(distName);
                         isMatchingDistrict = (distBin === activeScannerFilter);
                    }

                    if (isMatchingDistrict && !isFilterHidden) {
                        if (!map.hasLayer(marker)) map.addLayer(marker);
                        const newEl = marker.getElement();
                        if (newEl) { newEl.style.opacity = '1'; newEl.style.display = 'block'; }
                    } else {
                        if (map.hasLayer(marker)) map.removeLayer(marker);
                    }
                } else {
                    if (map.hasLayer(marker)) map.removeLayer(marker);
                }
            });
        }
    }

    // 3. OPTIMIZE POINTER EVENTS
    if (typeof districtLayer !== 'undefined' && typeof stateLayer !== 'undefined') {
        const distEvents = (zoom >= threshold) ? 'auto' : 'none';
        const stateEvents = (zoom < threshold) ? 'auto' : 'none';
        
        districtLayer.eachLayer(l => { if(l.getElement()) l.getElement().style.pointerEvents = distEvents; });
        stateLayer.eachLayer(l => { if(l.getElement()) l.getElement().style.pointerEvents = stateEvents; });
    }
}, 75);

// [IN script.js]

function updateMagicQuadrant(data) {
    if(!document.getElementById('magic-quadrant-chart')) return;
    
    // Limit to 100 points for performance
    const plotData = data.length > 100 ? data.slice(0, 100) : data;

    // 1. DYNAMIC COLORS (MATCHING MAP CONSISTENCY)
    // We change the default (Balanced) from Gray (#95a5a6) to White (#ffffff)
    const pointColors = plotData.map(d => {
        if (d.category === 3) return '#c0392b';       // Red
        if (d.category === 2) return '#f39c12';       // Orange
        if (d.category === 0) return '#2980b9';       // Blue
        return '#ffffff';                             // White (Balanced)
    });

    // 2. DYNAMIC BORDERS (VISIBILITY FIX)
    // White dots on a white background need a dark border to be seen.
    // Colored dots look better with a white border.
    const borderColors = plotData.map(d => {
        // If the dot is White (Balanced), give it a Grey border
        if (d.category !== 3 && d.category !== 2 && d.category !== 0) return '#999999';
        // Otherwise, give colored dots a White border (Standard look)
        return '#ffffff';
    });

    const trace = {
        x: plotData.map(d => d.child_share),
        y: plotData.map(d => d.adult_share),
        text: plotData.map(d => d.District),
        mode: 'markers',
        type: 'scatter',
        marker: {
            size: 8, 
            color: pointColors, 
            line: { color: borderColors, width: 1 }, // Applied Dynamic Borders
            opacity: 0.9 // Increased opacity slightly for the white dots
        },
        hovertemplate: '<b>%{text}</b><br>Family: %{x:.1f}%<br>Workers: %{y:.1f}%<extra></extra>'
    };

    const layout = {
        margin: { t: 20, b: 35, l: 40, r: 10 },
        xaxis: { 
            title: 'Families (%)', 
            titlefont: { size: 10, color: '#555', weight: 'bold' },
            range: [-2, 20], 
            showgrid: true, gridcolor: '#f0f0f0', zeroline: false
        },
        yaxis: { 
            title: 'Workers (%)', 
            titlefont: { size: 10, color: '#555', weight: 'bold' },
            range: [80, 105], 
            showgrid: true, gridcolor: '#f0f0f0', zeroline: false
        },
        
        // 3. CALIBRATED ZONES (Kept from previous fix)
        shapes: [
            { type: 'rect', x0: -2, x1: 4, y0: 96, y1: 105, fillcolor: 'rgba(231, 76, 60, 0.08)', line: {width: 0} },
            { type: 'rect', x0: 4, x1: 9, y0: 91, y1: 96, fillcolor: 'rgba(243, 156, 18, 0.08)', line: {width: 0} },
            { type: 'rect', x0: 9, x1: 20, y0: 80, y1: 91, fillcolor: 'rgba(41, 128, 185, 0.08)', line: {width: 0} }
        ],
        
        annotations: [
            { x: 1, y: 103, text: "WORK HUBS", showarrow: false, font: {size: 9, color: '#c0392b', weight: 'bold'} },
            { x: 14, y: 82, text: "FAMILY ZONES", showarrow: false, font: {size: 9, color: '#2980b9', weight: 'bold'} },
            { x: 6.5, y: 93.5, text: "TRANSIT", showarrow: false, font: {size: 8, color: '#d35400', weight: 'bold'} }
        ],
        
        hovermode: 'closest',
        showlegend: false,
        height: 240, 
        autosize: true
    };

    Plotly.react('magic-quadrant-chart', [trace], layout, {displayModeBar: false});
}
window.filterByBiZone = function(targetIndex) {
    if(!districtLayer) return;
    
    // 1. SETUP
    activeScannerFilter = targetIndex; 
    window.activeScannerStates = new Set(); 
    
    const targetColor = currentBiColors[targetIndex];
    const info = biDetails[targetIndex];
    const visibleDistricts = [];
    let totalCount = 0;
    
    document.getElementById('map-canvas').style.background = "#f4f4f4";

    // 2. COLOR THE MAP
    districtLayer.eachLayer(layer => {
        const d = globalDataMap.get(layer.feature.properties.NAME_2);
        if(!d) return;

        const binIndex = currentBiBins.get(d.District);
        const el = layer.getElement();
        
        if (el) {
            // --- CRITICAL FIX: SAFELY REMOVE OLD TOOLTIP ---
            // We check if it exists first to avoid the "null" error
            if (layer.getTooltip()) {
                layer.closeTooltip();
                layer.unbindTooltip();
            }

            if (binIndex === targetIndex) {
                // HIGHLIGHT
                el.style.fillOpacity = 0.9;
                el.style.fill = targetColor; 
                el.style.stroke = "#fff";    
                el.style.strokeWidth = "1.5px";
                if(layer.bringToFront) layer.bringToFront();

                // Bind New Scanner Tooltip
                layer.bindTooltip(getScannerTooltip(d, d.District, info), { 
                    direction: "top", className: "custom-tooltip-clean", opacity: 1, sticky: true 
                });
                
                // Track Data
                visibleDistricts.push(d);
                window.activeScannerStates.add(d.State); 
                totalCount++;

            } else {
                // DIM OTHERS
                el.style.fillOpacity = 0.05; 
                el.style.fill = "#ccc"; 
                el.style.stroke = "transparent";
                // No tooltip for dimmed layers
            }
        }
    });
updateSimulationTicker('map', visibleDistricts, false);
    // 3. UPDATE UI
    const stateSelect = $('#filter-state-select');
    stateSelect.empty().append(new Option(`Show All (${totalCount} Districts)`, "ALL"));
    
    updateButterflyChart(visibleDistricts);
    updateMagicQuadrant(visibleDistricts);
    renderResultsListGrouped(visibleDistricts);
    
    const el = document.getElementById('bi-status');
    if(el) {
        el.style.borderLeftColor = targetColor;
        el.innerHTML = `<strong style="color:${targetColor}; text-transform:uppercase;">${info.title}</strong><div style="font-size:9px; font-weight:bold; color:#555;">Found: ${totalCount} Districts</div><div style="color:#333;">${info.desc}</div>`;
    }

    updateLayers();

    if(visibleDistricts.length > 0) {
        const group = L.featureGroup(Object.values(districtLayer._layers).filter(l => {
               const d = globalDataMap.get(l.feature.properties.NAME_2);
               return d && currentBiBins.get(d.District) === targetIndex;
        }));
        map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 8 });
    }
};
function changeTerminalPage(dir) {
    currentTerminalPage += dir;
    renderLogisticsTerminal();
}
window.resetBiZone = function() {
    // 1. CLEAR FILTERS
    activeScannerFilter = null; 
    window.activeScannerStates = null;
    document.getElementById('map-canvas').style.background = "#dcebf7"; 

    // 2. Reset Info Box
    const statusLabel = document.getElementById('bi-status');
    if(statusLabel) {
        statusLabel.style.borderLeft = "3px solid #ccc";
        statusLabel.innerHTML = "<b>Hover over a color</b><br>to analyze.";
    }

    // 3. Reset Dropdown
    const stateSelect = $('#filter-state-select');
    if (stateSelect.length && globalStateGeoJSON) {
        stateSelect.empty().append(new Option("All India", "ALL"));
        const states = globalStateGeoJSON.features.map(f => f.properties.NAME_1).sort();
        states.forEach(s => stateSelect.append(new Option(s, s)));
        stateSelect.val("ALL").trigger('change'); 
    }

    // 4. Reset District Styles & Tooltips
    if (districtLayer) {
        districtLayer.eachLayer(layer => {
            const d = globalDataMap.get(layer.feature.properties.NAME_2);
            const el = layer.getElement();
            if(el && d) {
                const featureStyle = getFeatureStyle(layer.feature);
                el.style.fill = featureStyle.fillColor;
                el.style.fillOpacity = featureStyle.fillOpacity;
                el.style.stroke = featureStyle.color;
                el.style.strokeWidth = "0.5px"; 
                
                // --- CRITICAL FIX: SAFELY REMOVE TOOLTIP ---
                if (layer.getTooltip()) {
                    layer.closeTooltip();
                    layer.unbindTooltip();
                }
                
                // Re-bind Standard Tooltip
                layer.bindTooltip(getPolicyTooltip(d, d.District), { 
                    direction: "top", className: "custom-tooltip", opacity: 1, sticky: true 
                });
            }
        });
    }

    // 5. UPDATE LAYERS
    updateLayers();
    map.setView([22.5, 82], 4.5); 
    applyMapFilters(); 
};
window.updateGhostCharts = function(passedData = null) {
    // -----------------------------------------------------------
    // 🚨 SAFETY CHECK: STOP if chart containers don't exist
    // This prevents the "Uncaught Error" that crashes the app
    // -----------------------------------------------------------
    if (!document.getElementById('ghost-pie-chart') || !document.getElementById('ghost-main-chart')) {
        // console.warn("Ghost Charts: Containers not found. Skipping render.");
        return; 
    }

    // 1. GET SETTINGS
    const stateFilter = $('#mod2-state-filter').val() || "ALL"; // Added fallback
    const useRatio = document.getElementById('gm-ratio') && document.getElementById('gm-ratio').checked; 
    
    // 2. PREPARE DATA
    let plotData = passedData || allDistricts; // Use passed data if available
    let isNationalView = (stateFilter === "ALL");

    if (!isNationalView && !passedData) {
        plotData = allDistricts.filter(d => d.State === stateFilter);
    }
    let riskCounts = { 'Critical': 0, 'Warning': 0, 'Secure': 0 };
    plotData.forEach(d => {
        if (d.risk_label === 'HIGH RISK') riskCounts['Critical']++;
        else if (d.risk_label === 'MEDIUM RISK') riskCounts['Warning']++;
        else riskCounts['Secure']++;
    });

    const pieTrace = {
        labels: Object.keys(riskCounts),
        values: Object.values(riskCounts),
        type: 'pie',
        hole: 0.6, 
        marker: { colors: ['#c0392b', '#f39c12', '#27ae60'] },
        textinfo: 'none', 
        hoverinfo: 'label+value'
    };

    Plotly.newPlot('ghost-pie-chart', [pieTrace], {
        showlegend: true,
        legend: { orientation: 'h', x: 0, y: -0.2, font: {size: 9} }, // Legend below
        margin: { t: 10, b: 10, l: 10, r: 10 },
        height: 180,
        paper_bgcolor: 'rgba(0,0,0,0)',
    }, {displayModeBar: false, responsive: true});

    // --- CHART 2: THE "BAD NEWS" (Top Risky Areas) ---
    let sortedRisky, yVal, yText;
    
    if (useRatio) {
        sortedRisky = [...plotData].filter(d => d.demo > 100).sort((a,b) => a.sir_score - b.sir_score).slice(0, 15);
        yVal = d => (d.sir_score * 100).toFixed(1);
        yText = 'Security Score (0-100)';
    } else {
        sortedRisky = [...plotData].sort((a,b) => b.compliance_gap - a.compliance_gap).slice(0, 15);
        yVal = d => d.compliance_gap;
        yText = 'People Missing Updates';
    }

    const barTrace = {
        x: sortedRisky.map(d => d.District),
        y: sortedRisky.map(yVal),
        type: 'bar',
        marker: { color: sortedRisky.map(d => '#c0392b') }, 
        text: sortedRisky.map(yVal),
        textposition: 'auto'
    };

    Plotly.newPlot('ghost-main-chart', [barTrace], {
        title: isNationalView ? 'Top 15 Most Risky Districts' : `Top Risky in ${stateFilter}`,
        yaxis: { title: yText },
        margin: { b: 50, t: 30 }
    }, {displayModeBar: false, responsive: true});


    // --- LOGIC BRANCH: NATIONAL VS STATE VIEW ---
    if (isNationalView) {
        if($('#container-state-leaderboard').length) $('#container-state-leaderboard').show();
        if($('#container-safe-zones').length) $('#container-safe-zones').hide();

        // Check if element exists before plotting
        if(document.getElementById('ghost-state-chart')) {
            const stateAgg = {};
            allDistricts.forEach(d => {
                if (!stateAgg[d.State]) stateAgg[d.State] = 0;
                stateAgg[d.State] += d.compliance_gap;
            });
            
            const stateList = Object.keys(stateAgg).map(k => ({ state: k, val: stateAgg[k] }));
            stateList.sort((a,b) => b.val - a.val); 
            const topStates = stateList.slice(0, 10); 

            const stateTrace = {
                x: topStates.map(s => s.state),
                y: topStates.map(s => s.val),
                type: 'bar',
                marker: { color: '#e67e22' } 
            };
            
            Plotly.newPlot('ghost-state-chart', [stateTrace], {
                xaxis: { title: 'State' },
                yaxis: { title: 'Missing Updates' },
                margin: { t: 10, b: 30, l: 30, r: 10 }
            }, {displayModeBar: false, responsive: true});
        }

    } else {
        if($('#container-state-leaderboard').length) $('#container-state-leaderboard').hide();
        if($('#container-safe-zones').length) $('#container-safe-zones').show();

        if(document.getElementById('ghost-safe-chart')) {
            const safeDistricts = plotData.filter(d => d.compliance_gap === 0 || d.risk_label === 'SAFE')
                                          .sort((a,b) => a.compliance_gap - b.compliance_gap)
                                          .slice(0, 15); 

            if (safeDistricts.length > 0) {
                const safeTrace = {
                    x: safeDistricts.map(d => d.District),
                    y: safeDistricts.map(d => d.bio),
                    type: 'bar',
                    marker: { color: '#27ae60' },
                    text: safeDistricts.map(d => "✅ Secure"),
                    textposition: 'auto'
                };

                Plotly.newPlot('ghost-safe-chart', [safeTrace], {
                    title: `Safest Districts`,
                    yaxis: { title: 'Updates' },
                    margin: { t: 30, b: 30 }
                }, {displayModeBar: false, responsive: true});
            } else {
                document.getElementById('ghost-safe-chart').innerHTML = 
                    "<div class='text-muted text-center p-4'>No fully safe districts found here.</div>";
            }
        }
    }

    // --- CHART 4: SCATTER PATTERN ---
    if(document.getElementById('ghost-scatter-chart')) {
        const scatterTrace = {
            x: plotData.map(d => d.demo),
            y: plotData.map(d => d.bio),
            mode: 'markers',
            type: 'scatter',
            text: plotData.map(d => d.District),
            marker: { 
                color: plotData.map(d => d.risk_label === 'HIGH RISK' ? '#c0392b' : (d.risk_label === 'MEDIUM RISK' ? '#f39c12' : '#2ecc71')), 
                size: 6,
                opacity: 0.6
            },
            hovertemplate: "<b>%{text}</b><br>Addr: %{x}<br>Bio: %{y}<extra></extra>"
        };
        
        const maxVal = Math.max(...plotData.map(d => d.demo)) || 1000;
        
        Plotly.newPlot('ghost-scatter-chart', [scatterTrace], {
            xaxis: { title: 'New Addresses' },
            yaxis: { title: 'Biometrics' },
            margin: { t: 10, b: 30, l: 40, r: 10 },
            shapes: [
                { type: 'line', x0: 0, y0: 0, x1: maxVal, y1: maxVal, line: {color: 'green', dash: 'dot', width: 1} }
            ]
        }, {displayModeBar: false, responsive: true});
    }
};
// [REPLACE] The existing getRiskTooltip function
function getRiskTooltip(d, name) {
    if (!d) return `<div style="padding:4px; font-weight:bold;">${name}</div>`;

    const rawIntegrity = d.demo > 0 ? (d.bio / d.demo) * 100 : 100;
    const integrityScore = Math.min(Math.max(rawIntegrity, 0), 100).toFixed(1);
    const riskValue = (d.compliance_gap || 0) * 500; 
    const riskStr = riskValue > 10000000 
        ? `₹${(riskValue/10000000).toFixed(2)} Cr` 
        : `₹${(riskValue/100000).toFixed(2)} L`;

    let color = "#27ae60"; 
    let status = "VERIFIED";
    let icon = ""; // Removed Icon
    
    if (d.risk_label === 'HIGH RISK') { 
        color = "#c0392b"; status = "CRITICAL FAIL"; 
    } else if (d.risk_label === 'MEDIUM RISK') { 
        color = "#f39c12"; status = "ANOMALY"; 
    }

    // [FIX] Dark Theme (Blue Background, White Border)
    return `
    <div style="font-family:'Segoe UI', sans-serif; min-width:160px; box-shadow:0 6px 15px rgba(0,0,0,0.5); border-radius:6px; overflow:hidden; background:#0f172a; border: 1px solid rgba(255,255,255,0.2);">
        <div style="background:${color}; color:white; padding:6px 10px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight:bold; font-size:11px;">INTEGRITY CHECK</span>
        </div>
        
        <div style="padding:8px 10px; background:#0f172a; color:#f8fafc;">
            <div style="font-weight:bold; font-size:11px; color:#fff; margin-bottom:6px;">${name.toUpperCase()}</div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span style="font-size:10px; color:#94a3b8;">Integrity Score</span>
                    <span style="font-weight:bold; font-size:12px; color:${color};">${integrityScore}%</span>
                </div>
            
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:10px; color:#94a3b8;">Est. Leakage</span>
                <span style="font-weight:bold; font-size:11px; color:#f1f5f9;">${riskStr}</span>
            </div>
        </div>
        <div style="background:rgba(255,255,255,0.05); border-top:1px solid rgba(255,255,255,0.1); padding:4px 10px; font-size:9px; color:${color}; font-weight:bold; text-align:center;">
            STATUS: ${status}
        </div>
    </div>`;
}

function initGhostLab(data) {
    ghostDataCache = data;
    
    const $stateSel = $('#risk-state-select');
    const $distSel = $('#risk-district-select');

    // 1. Populate State Dropdown
    const states = [...new Set(data.map(d => d.State).filter(s => s))].sort();
    
    $stateSel.empty();
    $stateSel.append('<option></option>'); // Required for Placeholder
    $stateSel.append('<option value="ALL">National View</option>');
    states.forEach(s => $stateSel.append(new Option(s, s)));

    // 2. Init Select2
    $stateSel.select2({ 
        width: '100%', 
        placeholder: "Type to search state...",
        allowClear: true,
        dropdownParent: $stateSel.parent() 
    });
    
    $distSel.empty();
    $distSel.append('<option></option>'); // Required for Placeholder
    $distSel.select2({ 
        width: '100%', 
        placeholder: "Type to search district...",
        allowClear: true,
        dropdownParent: $distSel.parent() 
    });

    // Spacing - Force a larger gap
    // Select2 wraps the original select, so we target the container it creates
    $stateSel.next('.select2-container').css('margin-bottom', '15px');
    $distSel.next('.select2-container').css('margin-top', '5px');

    // Listeners
    $stateSel.on('change', function() {
        const state = $(this).val();
        handleRiskStateChange(state);
    });

    $distSel.on('change', function() {
        const distName = $(this).val();
        if(distName) {
            const d = globalDataMap.get(distName);
            if(d) handleRiskDistrictDrillDown(d);
        }
    });

    renderRiskDashboard('NATIONAL', null);
    updateRiskKPIs(data);
}
function handleRiskStateChange(state) {
    const $distSel = $('#risk-district-select');
    
    // 1. Reset District Dropdown
    $distSel.empty().append('<option value="">Select District...</option>');
    $distSel.prop('disabled', state === "ALL");
    
    closeForensicPanel(); // Reset Layer 3

    if(state === "ALL") {
        renderRiskDashboard('NATIONAL', null);
        applyGhostFilters();
        ghostMap.setView([22.5, 82], 4.5); // Reset Zoom
    } else {
        // 2. Filter & Populate
        const stateDistricts = ghostDataCache.filter(d => d.State === state).sort((a,b) => a.District.localeCompare(b.District));
        stateDistricts.forEach(d => {
            $distSel.append(new Option(d.District, d.District));
        });

        // [FIX] Enable Search on this dropdown now that it has data
        $distSel.select2({ width: '100%', placeholder: "Select District...", dropdownParent: $distSel.parent() });

        // 3. Render State Dashboard
        renderRiskDashboard('STATE', stateDistricts);
        
        // 4. MAP AUTO-ZOOM (The Fix)
        // We look through the ghostStateLayer to find the polygon matching the selected state
        if (ghostStateLayer) {
            ghostStateLayer.eachLayer(layer => {
                if (layer.feature.properties.NAME_1 === state) {
                    ghostMap.fitBounds(layer.getBounds(), { padding: [20, 20] });
                }
            });
        }
        applyGhostFilters(); 
    }
}

function renderRiskDashboard(level, data) {
    const chartA = 'dynamic-chart-a';
    const chartB = 'dynamic-chart-b';
    const hitListChart = 'pincode-hitlist-chart';

    // Helper for common font styles
    const titleFont = { size: 9, family: 'Segoe UI, sans-serif', color: '#555', weight: 'bold' };
    const tickFont = { size: 8, family: 'Segoe UI, sans-serif' };

    // --- LEVEL 1: NATIONAL VIEW ---
    if (level === 'NATIONAL') {
        const titleEl = document.getElementById('chart-a-title');
        titleEl.innerText = "COMPLIANCE LEADERBOARD (5-TIER)";

        // 1. INJECT DROPDOWN (If not present)
        if (!document.getElementById('leaderboard-limit-select')) {
            const container = titleEl.parentElement; 
            const select = document.createElement('select');
            select.id = 'leaderboard-limit-select';
            select.className = "form-select form-select-sm d-inline-block w-auto ms-2 border-0 bg-light text-secondary fw-bold";
            select.style.fontSize = "10px";
            select.style.padding = "0px 20px 0px 5px";
            select.style.height = "20px";
            select.style.cursor = "pointer";

            [5, 10, 15, 20].forEach(num => {
                const opt = document.createElement('option');
                opt.value = num;
                opt.innerText = `Top ${num} Each`;
                if (num === currentLeaderboardLimit) opt.selected = true;
                select.appendChild(opt);
            });

            titleEl.parentNode.insertBefore(select, titleEl.nextSibling);

            select.addEventListener('change', function(e) {
                currentLeaderboardLimit = parseInt(e.target.value);
                renderRiskDashboard('NATIONAL', data); 
            });
        }

        document.getElementById('chart-b-title').innerText = "FORENSIC TREND ANALYSIS";

        // 2. DATA PROCESSING (5-Color Logic)
        const allStates = Object.keys(stateStats || {}).map(k => {
            const d = stateStats[k];
            // Calculate Score (0 = Critical, 100 = Safe)
            // If total_gap exists, we inverse it to get a safety score.
            const score = (d.total_gap > 0 ? (100 - (d.total_gap / d.total / 100)) : 100);
            
            // [UPDATED] 5-Color Categorization
            let category, color;
        if (score < 70) { 
            category = 'HIGH'; 
            color = '#c0392b'; // Standard Red
        } else if (score < 85) { 
            category = 'MEDIUM'; 
            color = '#f39c12'; // Standard Orange
        } else { 
            category = 'SAFE'; 
            color = '#27ae60'; // Standard Green
        }
            
            return { name: k, score: score, category: category, color: color };
        });

        const limit = currentLeaderboardLimit;

        const categories = ['SAFE', 'MEDIUM', 'HIGH'];
        let plotData = [];

        categories.forEach(cat => {
            // [FIX] Filter out items with 0 score or empty names to prevent ghost bars
            const inCat = allStates.filter(s => s.category === cat && s.score > 0 && s.name);
            
            if (cat === 'SAFE' || cat === 'MODERATE') {
                inCat.sort((a,b) => b.score - a.score);
            } else {
                inCat.sort((a,b) => a.score - b.score);
            }
            
            plotData.push(...inCat.slice(0, limit));
        });

        // 4. DYNAMIC HEIGHT & SCROLLBAR [FIXED]
        const barHeight = 25; 
        const chartHeight = Math.max(200, plotData.length * barHeight); 
        
        const chartContainer = document.getElementById(chartA);
        if (chartContainer) {
            chartContainer.parentElement.style.overflowY = 'auto'; // Allow Vertical
            chartContainer.parentElement.style.overflowX = 'hidden'; // BLOCK Horizontal
            chartContainer.parentElement.style.maxHeight = '350px'; 
            chartContainer.parentElement.style.paddingRight = '5px'; 
        }

        Plotly.react(chartA, [{
            x: plotData.map(d => d.score),
            y: plotData.map(d => d.name),
            type: 'bar', orientation: 'h',
            name: 'Score', 
            // [FIX] Ensure text is inside or hidden if too small
            marker: { color: plotData.map(d => d.color), opacity: 0.9, line: {width: 0} },
            text: plotData.map(d => d.score.toFixed(0)), 
            textposition: 'auto',
            textfont: { size: 9, color: 'white' }
        }], {
            // [FIX] Increased Left Margin (l: 160) to prevent text overlap
            margin: { t: 10, b: 20, l: 160, r: 10 }, 
            xaxis: { title: '', fixedrange: true, tickfont: tickFont, showgrid: true, range: [0, 105] },
            yaxis: { fixedrange: true, tickfont: tickFont, automargin: true }, // automargin helps too
            showlegend: false, 
            height: chartHeight, 
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});

        // Chart B (Trend - Unchanged)
        Plotly.react(chartB, [{
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            y: [120, 115, 118, 110, 105, 98],
            type: 'scatter', mode: 'lines+markers',
            name: 'Risk Volume',
            line: { color: '#2980b9', width: 2 },
            marker: { size: 4 }
        }], {
            // [FIX] Increased Left Margin (l: 50) and added automargin
            margin: { t: 10, b: 25, l: 50, r: 10 }, 
            xaxis: { title: { text: 'MONTH', font: titleFont }, tickfont: tickFont, fixedrange: true },
            yaxis: { 
                title: { text: 'VOL (M)', font: titleFont }, 
                tickfont: tickFont, 
                fixedrange: true,
                automargin: true // Ensures title isn't cut off
            },
            showlegend: false,
            height: 140,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});
    }

    // --- LEVEL 2: STATE VIEW (SIDEBAR) ---
    else if (level === 'STATE') {
        document.getElementById('chart-a-title').innerText = "DISTRICT COMPLIANCE";
        document.getElementById('chart-b-title').innerText = "RISK BREAKDOWN";

        // Remove dropdown if switching to State view
        const drop = document.getElementById('leaderboard-limit-select');
        if(drop) drop.remove();

        const sorted = data.sort((a,b) => b.compliance_gap - a.compliance_gap).slice(0, 15);
        const autoHeight = Math.max(200, sorted.length * 30); // Dynamic height here too

        const chartContainer = document.getElementById(chartA);
        if (chartContainer) {
            chartContainer.parentElement.style.overflowY = 'auto';
            chartContainer.parentElement.style.maxHeight = '350px';
        }

        // CHART A: Compliance Stack (Sidebar)
        Plotly.react(chartA, [
            {
                x: sorted.map(d => d.bio),
                y: sorted.map(d => d.District),
                name: 'Verified', orientation: 'h', type: 'bar', 
                marker: { color: '#27ae60' }
            },
            {
                x: sorted.map(d => d.compliance_gap),
                y: sorted.map(d => d.District),
                name: 'Risk Gap', orientation: 'h', type: 'bar', 
                marker: { color: '#c0392b' }
            }
        ], {
            barmode: 'stack',
            margin: { t: 10, b: 20, l: 90, r: 60 }, 
            xaxis: { title: { text: 'PROFILES', font: titleFont }, tickfont: tickFont, fixedrange: true, showgrid: true },
            yaxis: { tickfont: tickFont, fixedrange: true, automargin: true },
            legend: { orientation: 'v', x: 1.05, y: 1, xanchor: 'left', yanchor: 'top', font: { size: 8 } },
            height: autoHeight,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});

        // CHART B: Donut
        const riskCounts = { 'Critical': 0, 'Warning': 0, 'Safe': 0 };
        data.forEach(d => {
            if(d.risk_label === 'HIGH RISK') riskCounts.Critical++;
            else if(d.risk_label === 'MEDIUM RISK') riskCounts.Warning++;
            else riskCounts.Safe++;
        });

        Plotly.react(chartB, [{
            labels: Object.keys(riskCounts),
            values: Object.values(riskCounts),
            type: 'pie', hole: 0.5,
            marker: { colors: ['#c0392b', '#f39c12', '#27ae60'] },
            textinfo: 'percent', 
            textposition: 'inside'
        }], {
            margin: { t: 0, b: 0, l: 0, r: 0 },
            showlegend: true,
            legend: { orientation: 'v', x: 1.0, y: 0.5, font: { size: 9 } },
            height: 140,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});
    }

    // --- LEVEL 3: DISTRICT VIEW (BOTTOM PANEL) ---
    else if (level === 'DISTRICT') {
        // Remove dropdown if switching to District view
        const drop = document.getElementById('leaderboard-limit-select');
        if(drop) drop.remove();

        const districtInfo = data.districtInfo || {};
        let trendData = data.trend || [];
        
        // --- ROBUST TREND DATA FALLBACK ---
        if (!trendData.length || trendData.every(t => t.value === 0)) {
            let baseRisk = districtInfo.compliance_gap || 500;
            trendData = [];
            for (let i = 0; i < 6; i++) {
                trendData.push({ week: `W-${i+1}`, value: baseRisk, type: 'Actual' });
            }
            for (let i = 6; i < 9; i++) {
                baseRisk = Math.max(0, baseRisk - 50); 
                trendData.push({ week: `W-${i+1}`, value: baseRisk, type: 'Forecast' });
            }
        }

        const pincodeData = data.pincodes || [];

        document.getElementById('chart-a-title').innerText = "RISK FORECAST (LINEAR REGRESSION)";
        document.getElementById('chart-b-title').innerText = "DATA INTEGRITY SCORE";

        // CHART A: ACTUAL vs FORECAST SPLIT
        const past = trendData.filter(d => d.type === 'Actual');
        const future = trendData.filter(d => d.type === 'Forecast');

        if (past.length === 0 && future.length === 0) {
            past.push(...trendData);
        }

        Plotly.react(chartA, [
            {
                x: past.map(d => d.week),
                y: past.map(d => d.value),
                name: 'History', 
                type: 'scatter', mode: 'lines+markers',
                fill: 'tozeroy', 
                line: { color: '#34495e', width: 2 },
                marker: { size: 4, color: '#2c3e50' }
            },
            {
                x: future.map(d => d.week),
                y: future.map(d => d.value),
                name: 'AI Forecast', 
                type: 'scatter', mode: 'lines+markers',
                line: { color: '#e74c3c', width: 2, dash: 'dot' }, 
                marker: { size: 6, symbol: 'diamond', color: '#c0392b' }
            }
        ], {
            margin: { t: 25, b: 25, l: 40, r: 10 }, 
            xaxis: { tickfont: {size:9}, fixedrange: true },
            yaxis: { title: '', tickfont: {size:9}, fixedrange: true },
            showlegend: true,
            legend: { orientation: 'h', x: 0, y: 1.1, font: {size: 9} },
            height: 150,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});

        // CHART B: PROFESSIONAL HEALTH GAUGE
        const gap = districtInfo.compliance_gap || 0;
        let rawScore = 100;
        if (gap > 0) {
            rawScore = Math.max(0, 100 - (Math.log10(gap) * 12)); 
        }
        
        const safetyScore = Math.round(rawScore); 
        const gaugeColor = safetyScore > 85 ? "#27ae60" : (safetyScore > 60 ? "#f39c12" : "#c0392b");

        Plotly.react(chartB, [{
            type: "indicator", 
            mode: "gauge+number",
            value: safetyScore, 
            number: { suffix: "%", font: { size: 26, color: gaugeColor, family: "Segoe UI, sans-serif", weight: "bold" } },
            title: { text: "AUDIT SCORE", font: { size: 10, color: '#888', letterSpacing: '1px' } },
            gauge: {
                axis: { range: [0, 100], visible: false }, 
                bar: { color: gaugeColor, thickness: 0.2 }, 
                bgcolor: "white",
                borderwidth: 0,
                shape: "angular",
                steps: [ { range: [0, 100], color: "#f4f4f4" } ]
            }
        }], {
            margin: { t: 25, b: 10, l: 25, r: 25 },
            height: 140,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});

        // CHART C: PINCODE HIT-LIST
        const topPins = pincodeData.slice(0, 5); 
        const criticalPins = topPins.filter(d => d.gap > 500); 
        const warningPins = topPins.filter(d => d.gap <= 500);

        const traces = [];
        if (criticalPins.length > 0) {
            traces.push({
                x: criticalPins.map(d => d.gap),
                y: criticalPins.map(d => `PIN ${d.pin}`),
                type: 'bar', orientation: 'h', name: 'Critical',
                marker: { color: '#c0392b' },
                text: criticalPins.map(d => d.gap), textposition: 'auto', textfont: { color: 'white', size: 9 }
            });
        }
        if (warningPins.length > 0) {
            traces.push({
                x: warningPins.map(d => d.gap),
                y: warningPins.map(d => `PIN ${d.pin}`),
                type: 'bar', orientation: 'h', name: 'Warning',
                marker: { color: '#f39c12' },
                text: warningPins.map(d => d.gap), textposition: 'auto'
            });
        }

        Plotly.react(hitListChart, traces, {
            barmode: 'stack',
            margin: { t: 10, b: 20, l: 60, r: 10 }, 
            xaxis: { title: '', fixedrange: true, tickfont: {size:8}, showgrid: false },
            yaxis: { fixedrange: true, tickfont: {size:10, weight:'bold'} },
            showlegend: false,
            height: 160,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)'
        }, {displayModeBar: false});
    }
}
async function handleRiskDistrictDrillDown(d) {
    const btn = document.getElementById('btn-ticker-reset');
    if(btn) btn.style.display = 'block';
    
    // [FIX START] -----------------------------------------
    // 1. Update the Top Right KPI Cards (Biometric, Gap, Integrity)
    // We pass [d] as an array because the function expects a list of districts
    updateRiskKPIs([d]);

    // 2. Update the Top Financial Ticker (Funds Secured, Leakage)
    // We pass 'd' as an object and set isSingleDistrict=true
    updateSimulationTicker('risks', d, true);
    // [FIX END] -------------------------------------------

    ghostLayer.eachLayer(layer => {
        if(layer.feature.properties.NAME_2 === d.District) {
            ghostMap.fitBounds(layer.getBounds(), { maxZoom: 9 });
        }
    });

    const panel = document.getElementById('forensic-panel');
    panel.style.height = "400px";

    // SVG Icon for Search
    const searchIconSVG = `<svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/></svg>`;

    // Updated HTML with SVG Icon
    document.getElementById('forensic-panel').querySelector('.bg-light').innerHTML = `
        <div class="d-flex align-items-center w-100">
            <div class="me-3">
                <h6 class="fw-bold text-dark m-0" style="font-size: 12px; letter-spacing: 0.5px;">
                    <span class="badge bg-danger me-2">LIVE AUDIT</span>
                    ${d.District.toUpperCase()}
                </h6>
            </div>

            <div class="input-group input-group-sm me-auto" style="width: 180px;">
                <span class="input-group-text bg-white border-end-0 text-muted" style="font-size:10px;">${searchIconSVG}</span>
                <input type="text" id="forensic-search-input" class="form-control border-start-0 ps-1" 
                       placeholder="Search Pincode..." style="font-size: 10px;"
                       onkeyup="applyForensicSearch(this.value)">
            </div>

            <button class="btn btn-sm btn-outline-secondary border-0 fw-bold" onclick="closeForensicPanel()">✖ Close</button>
        </div>
    `;

    document.getElementById('forensic-table-body').innerHTML = 
    `<tr><td colspan="5" class="text-center text-muted py-5"><h6 class="fw-bold">⏳ Retrieving records...</h6></td></tr>`;
    
    try {
        const res = await fetch(`/api/district-details?district=${d.District}`);
        const jsonRes = await res.json();
        
        currentForensicData = jsonRes.pincodes || []; 
        window.fullForensicData = currentForensicData; 
        
        if(currentForensicData.length === 0) {
             document.getElementById('forensic-table-body').innerHTML = 
                `<tr><td colspan="5" class="text-center text-danger py-5">No granular data found.</td></tr>`;
             return;
        }

        currentForensicPage = 1;
        renderForensicTable(); 

        if (typeof renderRiskDashboard === 'function') {
            renderRiskDashboard('DISTRICT', { 
                trend: jsonRes.trend, 
                pincodes: jsonRes.pincodes,
                districtInfo: d 
            });
        }
    } catch(err) {
        console.error("Error fetching details:", err);
    }
}
function applyForensicSearch(query) {
    const term = query.toString().trim().toLowerCase();
    
    if (!term) {
        // Restore all data if search is empty
        currentForensicData = window.fullForensicData;
    } else {
        // Filter based on pincode
        currentForensicData = window.fullForensicData.filter(row => 
            row.pin.toString().includes(term)
        );
    }
    
    // Reset to page 1 and re-render
    currentForensicPage = 1;
    renderForensicTable();
}

// [REPLACE] The existing renderForensicTable function
function renderForensicTable() {
    const tbody = document.getElementById('forensic-table-body');
    tbody.innerHTML = "";
    
    const start = (currentForensicPage - 1) * ROWS_PER_PAGE;
    const end = start + ROWS_PER_PAGE;
    const pageData = currentForensicData.slice(start, end);
    
    pageData.forEach(row => {
        const totalOps = row.addr + row.bio + 1; 
        let riskRatio = (row.gap / totalOps) * 100;
        riskRatio = Math.min(riskRatio * 1.5, 100); 

        let barColor = "bg-success";
        let statusLabel = "VERIFIED"; // [FIX] Properly capitalised
        let urgencyText = "Safe";
        
        if (row.gap > 1000 || riskRatio > 60) {
            barColor = "bg-danger";
            statusLabel = "CRITICAL";
            urgencyText = "Urgent";
        } else if (row.gap > 300 || riskRatio > 30) {
            barColor = "bg-warning";
            statusLabel = "REVIEW";
            urgencyText = "Check";
        }

        // [FIX] Improved Layout for "Status Verified"
        const actionHTML = `
            <div class="d-flex flex-column justify-content-center" style="height: 100%;">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold text-dark" style="font-size: 9px; text-transform: uppercase;">${statusLabel}</span>
                    <span class="text-muted" style="font-size: 9px;">${riskRatio.toFixed(0)}%</span>
                </div>
                <div class="progress" style="height: 5px; background-color: #eee; border-radius: 2px;">
                    <div class="progress-bar ${barColor}" role="progressbar" 
                         style="width: ${riskRatio}%;" 
                         aria-valuenow="${riskRatio}" aria-valuemin="0" aria-valuemax="100">
                    </div>
                </div>
            </div>
        `;

        tbody.innerHTML += `
            <tr>
                <td class="fw-bold text-secondary font-monospace ps-3 align-middle" style="font-size:10px;">PIN-${row.pin}</td>
                <td class="align-middle" style="font-weight:500;">${row.addr.toLocaleString()} <span class="text-muted small">Reqs</span></td>
                <td class="align-middle" style="font-weight:500;">${row.bio.toLocaleString()} <span class="text-muted small">Scans</span></td>
                <td class="fw-bold text-danger align-middle">${row.gap.toLocaleString()}</td>
                <td class="align-middle" style="padding: 6px 10px;">${actionHTML}</td>
            </tr>
        `;
    });

    renderPaginationControls(tbody);
}

function renderPaginationControls(tbody) {
    const totalPages = Math.ceil(currentForensicData.length / ROWS_PER_PAGE);

    const oldNav = tbody.querySelector('.pagination-row');
    if (oldNav) oldNav.remove();

    const navRow = document.createElement('tr');
    navRow.className = 'pagination-row';

    navRow.innerHTML = `
        <td colspan="5" class="p-3 bg-white border-top sticky-bottom" style="bottom: 0;">
            <div class="d-flex justify-content-between align-items-center px-2">
                
                <button class="btn btn-outline-dark btn-sm px-3 fw-bold"
                        onclick="changeForensicPage(-1)"
                        ${currentForensicPage <= 1 ? 'disabled' : ''}>
                    &larr; Previous
                </button>

                <span class="text-muted fw-bold" style="font-size: 11px;">
                    PAGE ${currentForensicPage} / ${totalPages}
                </span>

                <button class="btn btn-primary btn-sm px-3 fw-bold"
                        onclick="changeForensicPage(1)"
                        ${currentForensicPage >= totalPages ? 'disabled' : ''}>
                    Next &rarr;
                </button>
            </div>
        </td>
    `;
    tbody.appendChild(navRow);
}
function changeForensicPage(direction) {
    const totalPages = Math.ceil(currentForensicData.length / ROWS_PER_PAGE);

    currentForensicPage += direction;

    // HARD CLAMP (important)
    if (currentForensicPage < 1) currentForensicPage = 1;
    if (currentForensicPage > totalPages) currentForensicPage = totalPages;

    renderForensicTable();
}

function closeForensicPanel() {
    const panel = document.getElementById('forensic-panel');
    if (panel) panel.style.height = "0px";
}

function updateGhostCharts(passedData = null) {
    try {
        // 1. SAFETY CHECK (Stops crash if main chart is missing)
        if (!document.getElementById('ghost-main-chart')) return;
        
        // 2. DATA PREPARATION
        let plotData = passedData;

        // If no data passed, filter manually
        if (!plotData) {
            if (typeof ghostDataCache === 'undefined' || !ghostDataCache || ghostDataCache.length === 0) return;
            
            const selectedState = $('#mod2-state-filter').val();
            const selectedDistricts = $('#mod2-dist-compare').val() || [];
            
            plotData = ghostDataCache;
            
            if (selectedDistricts.length > 0) {
                plotData = ghostDataCache.filter(d => selectedDistricts.includes(d.District));
            } else if (selectedState !== "ALL" && selectedState) {
                plotData = ghostDataCache.filter(d => d.State === selectedState);
            }
        }

        if (plotData.length === 0) return;

        // --- CHART 1: SUBSIDY LEAKAGE BUBBLE ---
        const bubbleChart = document.getElementById('leakage-bubble-chart');
        if (bubbleChart) {
            const subsidyPerHead = 2000; 
            const leakageRate = 0.15;    

            const leakageData = plotData.map(d => ({
                district: d.District,
                gap: d.compliance_gap,
                leakage: (d.compliance_gap * leakageRate * subsidyPerHead) / 10000000, 
                riskScore: (1 - d.sir_score) * 10
            })).sort((a,b) => b.leakage - a.leakage).slice(0, 20);

            const traceLeakage = {
                x: leakageData.map(d => d.gap),
                y: leakageData.map(d => d.leakage),
                text: leakageData.map(d => d.district),
                mode: 'markers',
                marker: {
                    size: leakageData.map(d => Math.max(d.riskScore * 5, 10)),
                    color: leakageData.map(d => d.leakage),
                    colorscale: 'Reds',
                    opacity: 0.8,
                    line: { color: 'white', width: 1 }
                },
                hovertemplate: "<b>%{text}</b><br>Risk Gap: %{x}<br>Est. Loss: ₹%{y:.2f} Cr<extra></extra>"
            };

            Plotly.react('leakage-bubble-chart', [traceLeakage], {
                title: false,
                xaxis: { title: 'Unverified Gap' },
                yaxis: { title: 'Loss (₹ Cr)' },
                margin: { t: 10, l: 40, r: 10, b: 40 },
                hovermode: 'closest',
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)'
            }, {displayModeBar: false});
        }

        // --- CHART 2: MAIN JAWS CHART ---
        if (document.getElementById('ghost-main-chart')) {
            const limit = (plotData.length > 20) ? 20 : plotData.length;
            const topGap = [...plotData].sort((a,b) => b.compliance_gap - a.compliance_gap).slice(0, limit);

            const traceDemo = {
                x: topGap.map(d => d.District),
                y: topGap.map(d => d.demo),
                name: 'Address (Convenience)',
                type: 'bar', marker: { color: '#3498db', opacity: 0.4 }
            };

            const traceBio = {
                x: topGap.map(d => d.District),
                y: topGap.map(d => d.bio),
                name: 'Biometric (Security)',
                type: 'bar', marker: { color: '#c0392b' }, width: 0.4
            };

            Plotly.react('ghost-main-chart', [traceDemo, traceBio], {
    title: false, barmode: 'overlay', 
    margin: { t: 10, l: 40, r: 10, b: 40 },
    legend: { orientation: 'h', y: 1.1 },
    
    // CHANGE THIS LINE:
    yaxis: { title: 'No. of Records' } 
}, {displayModeBar: false});
        }

        // --- CHART 3: PEER COMPARISON ---
        const peerChart = document.getElementById('peer-compare-chart');
        if (peerChart && plotData.length >= 2) {
            const sorted = [...plotData].sort((a,b) => b.compliance_gap - a.compliance_gap);
            const worst = sorted[0]; 
            const best = sorted[sorted.length - 1]; 

            const pTraceWorst = {
                x: ['Gap', 'Bio'], y: [worst.compliance_gap, worst.bio],
                name: `Risk: ${worst.District}`, type: 'bar', marker: { color: '#c0392b' }
            };

            const pTraceBest = {
                x: ['Gap', 'Bio'], y: [best.compliance_gap, best.bio],
                name: `Safe: ${best.District}`, type: 'bar', marker: { color: '#27ae60' }
            };

            Plotly.react('peer-compare-chart', [pTraceWorst, pTraceBest], {
                barmode: 'group',
                margin: { t: 30, l: 30, r: 10, b: 30 },
                showlegend: true, legend: { orientation: 'h', y: -0.2 },
                height: 200
            }, { displayModeBar: false });
        }

        // --- CHART 4: SCATTER PLOT ---
        if (document.getElementById('ghost-scatter-chart')) {
            const traceScatter = {
                x: plotData.map(d => d.demo),
                y: plotData.map(d => d.bio),
                mode: 'markers', type: 'scatter',
                text: plotData.map(d => d.District),
                marker: {
                    size: 8, color: plotData.map(d => d.sir_score), 
                    colorscale: 'RdYlGn', showscale: false
                }
            };

            Plotly.react('ghost-scatter-chart', [traceScatter], {
                title: false, xaxis: { title: 'Address Changes' }, yaxis: { title: 'Biometrics' },
                margin: { t: 10, l: 40, r: 10, b: 40 }
            }, {displayModeBar: false});
        }
        
        // --- CHART 5: STATE LEADERBOARD ---
        if (document.getElementById('ghost-state-chart')) {
            const stateAgg = {};
            plotData.forEach(d => {
                if (!stateAgg[d.State]) stateAgg[d.State] = 0;
                stateAgg[d.State] += d.compliance_gap;
            });
            const stateSorted = Object.entries(stateAgg).sort((a,b) => b[1] - a[1]).slice(0, 10);

            Plotly.react('ghost-state-chart', [{
                x: stateSorted.map(s => s[1]),
                y: stateSorted.map(s => s[0]),
                type: 'bar', orientation: 'h', marker: { color: '#e67e22' }
            }], {
                title: false, margin: { t: 10, l: 100, r: 10, b: 30 }
            }, {displayModeBar: false});
        }
    } catch (e) {
        console.warn("Chart update skipped: ", e);
    }
}

function switchView(mode) {
    const btn = document.getElementById('btn-ticker-reset');
    if(btn) btn.style.display = 'none';

    console.log(`[DEBUG] Switching View to: ${mode.toUpperCase()}`);
    console.log(`[DEBUG] Switching View to: ${mode.toUpperCase()}`);
    currentModule = mode;

    // 1. FORCE VISIBILITY
    ['map', 'risks', 'logistics', 'analytics'].forEach(m => {
        const el = document.getElementById(`view-${m}`);
        if (el) {
            if (m === mode) {
                el.style.display = (m === 'logistics') ? 'flex' : 'block'; 
                el.style.visibility = 'visible';
                el.style.zIndex = '100';
                el.classList.add('active');
            } else {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
                el.style.zIndex = '0';
                el.classList.remove('active');
            }
        }
    });

    // 2. TRIGGER MODULE UPDATES
    setTimeout(() => {
        window.dispatchEvent(new Event('resize')); 

        // --- MODULE 3: LOGISTICS ---
        if (mode === 'logistics') {
            if (!logisticsMap) initLogisticsMap();
            if (logisticsMap) {
                logisticsMap.invalidateSize(); 
                if (!logisticsMap.isFiltered) {
                    logisticsMap.setView([22.5, 82], 4.5);
                }
            }
            if (typeof runLogisticsOptimizer === 'function') runLogisticsOptimizer();
             // Resize charts
            const divChart = document.getElementById('log-diverging-chart');
            const bellChart = document.getElementById('log-bell-chart');
            if(divChart && window.Plotly) Plotly.Plots.resize(divChart);
            if(bellChart && window.Plotly) Plotly.Plots.resize(bellChart);
        }
        
        // --- MODULE 2: FRAUD CHECK ---
        if (mode === 'risks') {
            if (!ghostMap) initGhostMap();
            if (ghostMap) {
                ghostMap.invalidateSize(); 
                if (ghostLayer && ghostLayer.getBounds().isValid()) {
                    ghostMap.fitBounds(ghostLayer.getBounds());
                } else {
                    ghostMap.setView([22.5, 82], 4.5);
                }
            }
            if (typeof updateGhostCharts === 'function') updateGhostCharts();

            // [NEW] UPDATE TICKER TO "FRAUD MODE" IMMEDIATELY
            if (typeof ghostDataCache !== 'undefined' && ghostDataCache.length > 0) {
                 updateSimulationTicker('risks', ghostDataCache, false);
            }
        }

        // --- MODULE 1: MAP ---
        if (mode === 'map') {
            if (map) map.invalidateSize();
            // [NEW] RESTORE TICKER TO "MIGRATION MODE"
            if (typeof allDistricts !== 'undefined' && allDistricts.length > 0) {
                // Check if any filters are active, otherwise use all
                const dataToUse = (typeof visibleDistricts !== 'undefined' && visibleDistricts.length > 0) ? visibleDistricts : allDistricts;
                updateSimulationTicker('map', dataToUse, false);
            }
        }

    }, 200); 
}
function renderCompactLogisticsCharts(chartData) {
    // 1. Prepare Data for Diverging Bar (Balance of Power)
    // Get top 5 Deficits (Red) and top 5 Surplus (Green)
    const deficits = chartData.filter(d => d.z_score > 0.5).sort((a,b) => b.z_score - a.z_score).slice(0, 5);
    const surplus  = chartData.filter(d => d.z_score < -0.5).sort((a,b) => a.z_score - b.z_score).slice(0, 5);
    
    // Trace 1: Surplus (Green, Negative direction visually)
    const traceSurplus = {
        x: surplus.map(d => d.z_score), 
        y: surplus.map(d => d.District), // Tooltip only
        type: 'bar', orientation: 'h', 
        marker: { color: '#2ecc71' },
        hoverinfo: 'y+x'
    };

    // Trace 2: Deficit (Red, Positive direction)
    const traceDeficit = {
        x: deficits.map(d => d.z_score), 
        y: deficits.map(d => d.District),
        type: 'bar', orientation: 'h', 
        marker: { color: '#e74c3c' },
        hoverinfo: 'y+x'
    };

    // Layout: Ultra compact, no axis labels, transparent background
    const layoutBar = {
        barmode: 'relative',
        margin: { t: 0, b: 0, l: 0, r: 0 },
        xaxis: { visible: false, fixedrange: true },
        yaxis: { visible: false, fixedrange: true },
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        height: 80 // Matches CSS height
    };
    
    // 2. Prepare Data for Bell Curve (Z-Score Distribution)
    const traceHist = {
        x: chartData.map(d => d.z_score),
        type: 'histogram',
        marker: { color: '#3498db', opacity: 0.8 },
        nbinsx: 15 // Coarse bins for small size
    };

    const layoutBell = {
        margin: { t: 0, b: 0, l: 0, r: 0 },
        xaxis: { visible: false, fixedrange: true },
        yaxis: { visible: false, fixedrange: true },
        showlegend: false,
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        height: 80,
        shapes: [
            // Center Line (0)
            { type: 'line', x0: 0, x1: 0, y0: 0, y1: 1, yref: 'paper', line: {color: '#888', width: 1, dash: 'dot'} }
        ]
    };

    // 3. Render
    if(document.getElementById('log-diverging-chart')) {
        Plotly.newPlot('log-diverging-chart', [traceSurplus, traceDeficit], layoutBar, {displayModeBar: false});
    }
    if(document.getElementById('log-bell-chart')) {
        Plotly.newPlot('log-bell-chart', [traceHist], layoutBell, {displayModeBar: false});
    }
}
function initGhostMap() {
    if (!globalGeoJSON || !globalStateGeoJSON || ghostMap) return;

    console.log("[SYSTEM] 🛡️ Initializing Fraud Check Map...");

    // 1. MAP SETUP (Locked to India)
    ghostMap = L.map('ghost-map-canvas', {
    zoomControl: false, // <--- CHANGE THIS to false (was true)
    zoomSnap: 0.5, 
    zoomDelta: 0.5, 
    attributionControl: false,
    minZoom: 4, 
    maxZoom: 10,
    maxBounds: INDIA_BOUNDS,
    maxBoundsViscosity: 1.0
}).setView([22.5, 82], 4.5);

// ADD THIS LINE immediately after:
L.control.zoom({ position: 'bottomright' }).addTo(ghostMap);

    pulseLayerGroup.addTo(ghostMap); 

    // [INSIDE initGhostMap - REPLACE ghostStateLayer BLOCK]
    // [REPLACE ghostStateLayer BLOCK]
    ghostStateLayer = L.geoJSON(globalStateGeoJSON, {
        style: { fillColor: 'transparent', weight: 1.5, color: '#34495e', fillOpacity: 0 },
        onEachFeature: (feature, layer) => {
            let name = feature.properties.NAME_1;
            
            if (name === "Chandigarh") return; // Remove Chandigarh
            if (name === "Orissa") name = "Odisha"; // Fix Odisha
            if (name === "Uttaranchal") name = "Uttarakhand";
            if (name === "Daman and Diu" || name === "Dadra and Nagar Haveli") return; // Hide individual UTs

            let center = layer.getBounds().getCenter();
            if (STATE_LABEL_FIXES[name]) center = L.latLng(STATE_LABEL_FIXES[name]);

            const stateLabel = L.marker(center, { 
                icon: L.divIcon({ className: 'state-label', html: `<div>${name.toUpperCase()}</div>`, iconSize: [150, 40], iconAnchor: [75, 20] }), 
                interactive: false 
            }).addTo(ghostMap);
            ghostStateLabelMap.set(name, stateLabel);
        }
    }).addTo(ghostMap);

    // [FIND THIS LIST INSIDE initGhostMap AND UPDATE IT]
    ["Telangana", "Ladakh", "Meghalaya", "Dadra and Nagar Haveli and Daman and Diu", "Odisha"].forEach(n => {
        if (STATE_LABEL_FIXES[n] && !ghostStateLabelMap.has(n)) {
            const l = L.marker(L.latLng(STATE_LABEL_FIXES[n]), { 
                icon: L.divIcon({ className: 'state-label', html: `<div>${n.toUpperCase()}</div>`, iconSize: [150, 40], iconAnchor: [75, 20] }), 
                interactive: false 
            }).addTo(ghostMap);
            ghostStateLabelMap.set(n, l);
        }
    });

    // 3. DISTRICT LAYER (Districts + Labels)
    ghostLayer = L.geoJSON(globalGeoJSON, {
        smoothFactor: 2,
        style: (feature) => {
            
             return { fillColor: '#ecf0f1', weight: 0.5, opacity: 1, color: '#999', fillOpacity: 0.9 };
        },
        onEachFeature: (feature, layer) => {
            const name = feature.properties.NAME_2;
            const d = globalDataMap.get(name);
            
            if(d) {
                // Rich Tooltip
                layer.bindTooltip(getRiskTooltip(d, name), { 
                    direction: "top", className: "custom-tooltip", opacity: 1, sticky: true, offset: [0, -10]
                });

                // Click Interaction
                layer.on('click', () => {
                    $('#risk-district-select').val(name).trigger('change');
                    handleRiskDistrictDrillDown(d);
                });    

                // District Label Marker
                const center = layer.getBounds().getCenter();
                const label = L.marker(center, { 
                    icon: L.divIcon({ 
                        className: 'district-label', // Reusing the same CSS class
                        html: `<div>${name}</div>`, 
                        iconSize: [100, 20], 
                        iconAnchor: [50, 10] 
                    }), 
                    interactive: false 
                }).addTo(ghostMap);
                ghostLabelMap.set(name, label);
            }
        }
    }).addTo(ghostMap);

    // 4. CONNECT ZOOM HANDLER
    ghostMap.on('zoomend', updateGhostLayers);
    
    // 5. LEGEND
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = () => {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
            <div class="legend-title" style="font-size:10px; text-transform:uppercase; color:#555;">Risk Levels</div>
            <div class="legend-item" style="display:flex; align-items:center; margin-bottom:2px;">
                <div style="background:#c0392b; width:10px; height:10px; margin-right:5px; border-radius:2px;"></div>
                <span style="font-size:10px;">High Risk</span>
            </div>
            <div class="legend-item" style="display:flex; align-items:center; margin-bottom:2px;">
                <div style="background:#f39c12; width:10px; height:10px; margin-right:5px; border-radius:2px;"></div>
                <span style="font-size:10px;">Medium Risk</span>
            </div>
            <div class="legend-item" style="display:flex; align-items:center;">
                <div style="background:#27ae60; width:10px; height:10px; margin-right:5px; border-radius:2px;"></div>
                <span style="font-size:10px;">Secure</span>
            </div>
        `;
        return div;
    };
    legend.addTo(ghostMap);

    // 6. FINAL INIT
    setTimeout(() => { 
        applyGhostFilters(); 
        updateGhostLayers(); // Force labels to update immediately
    }, 500);
["Odisha", "Meghalaya"].forEach(name => {
        if (ghostStateLabelMap.has(name)) {
            ghostMap.removeLayer(ghostStateLabelMap.get(name));
        }

        const center = L.latLng(STATE_LABEL_FIXES[name]);
        const label = L.marker(center, { 
            icon: L.divIcon({ 
                className: 'state-label', 
                html: `<div>${name.toUpperCase()}</div>`, 
                iconSize: [150, 40], 
                iconAnchor: [75, 20] 
            }), 
            interactive: false 
        }).addTo(ghostMap);
        
        ghostStateLabelMap.set(name, label);
    });
}

function updateGhostLayers() {
    if (!ghostMap) return;
    const zoom = ghostMap.getZoom();
    const threshold = 6; 

    // 1. STATE LABELS (Low Zoom)
    if (typeof ghostStateLabelMap !== 'undefined') {
        ghostStateLabelMap.forEach((marker) => {
            const el = marker.getElement();
            if (el) {
                if (zoom < threshold) {
                    el.style.opacity = '1';
                    el.style.display = 'flex';
                } else {
                    el.style.opacity = '0';
                    el.style.display = 'none';
                }
            }
        });
    }

    // 2. DISTRICT LABELS (High Zoom) - ONLY IF NOT FILTERED
    if (typeof ghostLabelMap !== 'undefined') {
        ghostLabelMap.forEach((marker) => {
            const el = marker.getElement();
            if (el) {
                // Check if this district was hidden by the checkboxes
                const isFilteredOut = el.classList.contains('filtered-hidden');

                if (zoom >= threshold && !isFilteredOut) {
                    el.style.opacity = '1';
                    el.style.display = 'block';
                } else {
                    el.style.opacity = '0';
                    el.style.display = 'none';
                }
            }
        });
    }
}

function updateRiskKPIs(data) {
    if(!data || data.length === 0) return;

    let totalGap = 0;
    let totalBio = 0;
    let totalDemo = 0;

    data.forEach(d => {
        totalGap += d.compliance_gap || 0;
        totalBio += d.bio || 0;
        totalDemo += d.demo || 0;
    });

    // 1. CLAMPING LOGIC (Fixing the 103% issue)
    let rawRate = totalDemo > 0 ? (totalBio / totalDemo * 100) : 0;
    const complianceRate = Math.min(rawRate, 100); 
    
    const unverifiedRate = totalDemo > 0 ? (totalGap / totalDemo * 100) : 0;

    // 2. DEFINE ALL ELEMENTS (Fixing the "kpiComp is not defined" error)
    const kpiGhost = document.getElementById('kpi-ghost-count');
    const kpiUnverified = document.getElementById('kpi-unverified-rate');
    const kpiComp = document.getElementById('kpi-compliance'); 

    // 3. SAFE UPDATES (Fixing the "0" display issue)
    if(kpiGhost) {
        kpiGhost.innerText = totalGap === 0 ? "None" : totalGap.toLocaleString();
    }
    
    if(kpiUnverified) {
         kpiUnverified.innerText = unverifiedRate > 0 ? unverifiedRate.toFixed(1) : "0.0";
    }
    
    if (kpiComp) {
        kpiComp.innerText = complianceRate.toFixed(1);
        
        // Optional: Dynamic Color Update for the Integrity Card
        const parent = kpiComp.closest('.card-body');
        if(parent) {
             // Keep existing classes but swap border color
             let baseClass = "card-body py-1 px-3 border-start border-4 d-flex flex-column justify-content-center";
             parent.className = complianceRate < 65 
                ? `${baseClass} border-danger` 
                : `${baseClass} border-primary`;
        }
    }
}
function generateForensicData(districtName, riskScore, baseGap) {
    const pincodes = [];
    const count = 5;
    const basePin = Math.floor(100000 + Math.random() * 800000); 

    for(let i=0; i<count; i++) {
        const pin = basePin + i;
        const gap = Math.floor((baseGap / count) * (0.8 + Math.random() * 0.4)); 
        const bio = Math.floor(gap * (riskScore > 0.6 ? 0.5 : 0.1)); 
        const addr = gap + bio;
        
        // PROFESSIONAL VERDICTS
        let verdict = "Review Required";
        let color = "text-warning";
        
        if (riskScore < 0.4) {
            verdict = "Critical Gap";
            color = "text-danger fw-bold";
        } else if (riskScore > 0.8) {
            verdict = "Verified";
            color = "text-success";
        }

        // Added 'Download' text to button for clarity
        pincodes.push({ 
            pin, addr, bio, gap, verdict, color,
            btnText: "Export" 
        });
    }
    
    // Sort and return table rows
    // Note: This logic assumes you handle the HTML generation in the drilldown function below
    return pincodes.sort((a,b) => b.gap - a.gap);
}

// [CHANGE] Updated to include Sensitivity Slider Logic
function applyGhostFilters() {
    if (!ghostLayer || !ghostMap) return;

    // 1. GET SLIDER VALUES & UPDATE BADGE
    const slider = document.getElementById('risk-sensitivity-slider');
    const sensitivityVal = slider ? parseInt(slider.value) : 12;
    const sigma = sensitivityVal / 10; // Convert 12 -> 1.2 Sigma

    // Update the UI Badge
    const badge = document.getElementById('risk-threshold-badge');
    if (badge) {
        badge.innerText = `Threshold (${sigma.toFixed(1)}σ)`;
        // Dynamic color for the badge
        if (sensitivityVal < 10) badge.className = "badge bg-danger text-white"; // Loose
        else if (sensitivityVal > 20) badge.className = "badge bg-success text-white"; // Strict
        else badge.className = "badge bg-warning text-dark"; // Standard
    }

    const stateVal = $('#risk-state-select').val() || "ALL"; 
    
    // Checkbox State
    const elHigh = document.getElementById('chk-high-risk');
    const elMed = document.getElementById('chk-med-risk');
    const elSafe = document.getElementById('chk-safe');

    const showHigh = elHigh ? elHigh.checked : true;
    const showMed = elMed ? elMed.checked : true;
    const showSafe = elSafe ? elSafe.checked : true;

    let visibleDistricts = [];
    let totalLeakage = 0;

    ghostLayer.eachLayer(layer => {        
        const name = layer.feature.properties.NAME_2;
        const d = globalDataMap.get(name);
        const el = layer.getElement();
        const labelMarker = ghostLabelMap.get(name); 

        if (!d || !el) return;

        // [NEW] DYNAMIC RISK CALCULATION
        // Override the static label based on the slider's sigma value
        let dynamicRisk = 'SAFE';
        let zScore = d.gap_z_score || 0; // Ensure we have a score

        if (zScore > sigma) {
            dynamicRisk = 'HIGH RISK';
        } else if (zScore > (sigma * 0.5)) { 
            // Medium risk is defined as half the high threshold
            dynamicRisk = 'MEDIUM RISK';
        }

        let isVisible = true;
        
        // A. Geography Filter
        if (stateVal !== "ALL" && d.State !== stateVal) isVisible = false;

        // B. Risk Category Filter (Using DYNAMIC label)
        if (isVisible) {
            if (dynamicRisk === 'HIGH RISK' && !showHigh) isVisible = false;
            else if (dynamicRisk === 'MEDIUM RISK' && !showMed) isVisible = false;
            else if (dynamicRisk === 'SAFE' && !showSafe) isVisible = false;
        }

        // C. RENDER
        if (isVisible) {
            // Colors (Dynamic)
            let color = '#27ae60'; // Safe (Green)
            if (dynamicRisk === 'HIGH RISK') color = '#c0392b'; // Red
            else if (dynamicRisk === 'MEDIUM RISK') color = '#f39c12'; // Orange

            el.style.display = 'block';
            el.style.fill = color;
            el.style.fillOpacity = 0.85;
            el.style.stroke = '#fff';
            el.style.strokeOpacity = 0.4;
            el.style.pointerEvents = 'auto';

            if (labelMarker && labelMarker.getElement()) {
                labelMarker.getElement().classList.remove('filtered-hidden');
            }

            visibleDistricts.push(d);
            if (dynamicRisk === 'HIGH RISK') totalLeakage += (d.compliance_gap * 1200);

        } else {
            // HIDE LAYER
            el.style.display = 'none';
            el.style.pointerEvents = 'none';
            
            if (labelMarker && labelMarker.getElement()) {
                labelMarker.getElement().classList.add('filtered-hidden');
                labelMarker.getElement().style.display = 'none'; 
            }
        }
    });

    // 2. Clear Red Dots (Pulse)
    pulseLayerGroup.clearLayers(); 

    // 3. Update KPIs and Charts
    updateRiskKPIs(visibleDistricts);
    updateGhostLayers(); // Refresh labels
    
    // Update Financials
    const totalRiskMitigation = totalLeakage; // Simplified for visual
    updateFinancialHUD(totalRiskMitigation, totalRiskMitigation);
    updateSimulationTicker('risks', visibleDistricts, false);
}

window.updateMigrationCharts = function() {
    // Safety Guard: Stop if elements are missing
    if (!document.getElementById('mig-pie-chart')) return;

    const stateFilter = $('#mig-state-filter').val();
    let plotData = allDistricts;
    
    if (stateFilter !== "ALL" && stateFilter) {
        plotData = allDistricts.filter(d => d.State === stateFilter);
    }
    
    if (plotData.length === 0) return;

    // --- CHART 1: WORKER VS DEPENDENT (Donut) ---
    // "Who lives here?"
    let totalAdults = 0;
    let totalChildren = 0;
    
    // Sum raw values (reconstructed from shares roughly or sum raw cols if available)
    // Since we only have shares in d.adult_share, let's avg them for visualization
    // OR better: count districts by dominant type
    let industrial = 0; // Adult share > Child share significantly
    let residential = 0; // Balanced
    
    plotData.forEach(d => {
        if (d.magnet_score > 5) industrial++;
        else residential++;
    });

    Plotly.newPlot('mig-pie-chart', [{
        labels: ['Job Hubs (Worker Dominant)', 'Residential / Source'],
        values: [industrial, residential],
        type: 'pie',
        hole: 0.6,
        marker: { colors: ['#e74c3c', '#3498db'] },
        textinfo: 'percent'
    }], {
        showlegend: true, legend: { orientation: 'h', y: -0.2 },
        margin: { t: 0, b: 0, l: 0, r: 0 }
    }, {displayModeBar: false, responsive: true});


    // --- CHART 2: TOP MAGNETS (Bar) ---
    // "Where is everyone going?"
    const topMagnets = [...plotData].sort((a,b) => b.magnet_score - a.magnet_score).slice(0, 10);
    
    Plotly.newPlot('mig-bar-chart', [{
        x: topMagnets.map(d => d.District),
        y: topMagnets.map(d => d.magnet_score),
        type: 'bar',
        marker: { color: '#e74c3c' }
    }], {
        title: false,
        xaxis: { title: '' },
        yaxis: { title: 'Migration Intensity' },
        margin: { t: 20, b: 60, l: 40, r: 20 }
    }, {displayModeBar: false, responsive: true});


    // --- CHART 3: TOP SOURCES (Bar) ---
    // "Where are they leaving from?"
    // Sort Ascending (Negative scores are sources)
    const topSources = [...plotData].sort((a,b) => a.magnet_score - b.magnet_score).slice(0, 15);
    
    // Make values positive for chart display
    Plotly.newPlot('mig-source-chart', [{
        x: topSources.map(d => d.District),
        y: topSources.map(d => Math.abs(d.magnet_score)), // Show as positive magnitude
        type: 'bar',
        marker: { color: '#3498db' }
    }], {
        title: false,
        xaxis: { title: '' },
        yaxis: { title: 'Out-Migration Intensity' },
        margin: { t: 20, b: 80, l: 40, r: 20 }
    }, {displayModeBar: false, responsive: true});
}
function populateSearch(data, stateGeo) {
    const $select = $('#region-search');
    
    // 1. ANALYTICS: Enable Search for "Signal Tuner"
    const $filterState = $('#filter-state-select');
    if ($filterState.length) {
        $filterState.empty().append(new Option("Show All India", "ALL"));
        const states = stateGeo.features.map(f => f.properties.NAME_1).sort();
        states.forEach(s => $filterState.append(new Option(s, s)));
        
        $filterState.select2({ 
            width: '100%', 
            placeholder: "Type to search state...",
            dropdownParent: $filterState.parent() 
        });
    }

    // 2. MAIN SEARCH BAR (Top)
    const states = stateGeo.features.map(f => f.properties.NAME_1).sort();
    const stateGroup = $('<optgroup label="States">');
    states.forEach(s => stateGroup.append(new Option(s, `STATE:${s}`)));
    $select.append(stateGroup);

    const $migState = $('#mig-state-filter');
    if ($migState.length) {
        $migState.empty().append(new Option("Show All India", "ALL"));
        states.forEach(s => $migState.append(new Option(s, s)));
        // Add Placeholder to Migration Filter
        $migState.select2({
            width: '100%',
            placeholder: "Type to search state...",
            dropdownParent: $migState.parent()
        });
    }

    const districts = data.map(d => d.District).sort();
    const distGroup = $('<optgroup label="Districts">');
    districts.forEach(d => {
        const opt = new Option(d, `DIST:${d}`);
        distGroup.append(opt);
    });
    $select.append(distGroup);

    // Main Search Placeholder
    $select.select2({ placeholder: "Type to search state or district..." });
    
    $select.on('select2:select', function (e) {
        const val = e.params.data.id;
        const [type, name] = val.split(':');
        
        if (currentModule !== 'map') {
            $('#btn-map').prop('checked', true);
            switchView('map');
        }
        
        if (type === 'STATE') {
            stateLayer.eachLayer(l => { if (l.feature.properties.NAME_1 === name) map.fitBounds(l.getBounds()); });
        } else {
            districtLayer.eachLayer(l => { if (l.feature.properties.NAME_2 === name) map.flyToBounds(l.getBounds(), { maxZoom: 9 }); });
        }
    });

    // 3. RISK INTELLIGENCE: Enable Search for State Dropdown (Duplicate check handled in initGhostLab)
    // We leave this block small or remove it if initGhostLab handles it, 
    // but keeping it safe in case populateSearch runs first.
    const $riskState = $('#risk-state-select');
    if ($riskState.length && !$riskState.data('select2')) {
        $riskState.select2({ width: '100%', placeholder: "Type to search state...", dropdownParent: $riskState.parent() });
    }
}
function resetMap() {
map.fitBounds(districtLayer.getBounds());
    $('#region-search').val(null).trigger('change');
    updateSimulationTicker('map', allDistricts, false);
}
$(document).ready(function() {
    console.log("✅ Logistics Event Listeners Attached");

    // 1. Density Dropdown Listener
    $(document).on('change', '#route-limit-select', function() {
        console.log("⚡ Density Changed: " + $(this).val());
        runLogisticsOptimizer(false); 
    });

    // 2. SINGLE ROBUST STATE LISTENER
    // This handles both User Clicks and Programmatic Triggers
    $(document).off('change', '#log-state-filter').on('change', '#log-state-filter', function(e) {
        const val = $(this).val();
        
        // LOOP BREAKER:
        // If the selected value is already active (e.g., triggered by code loop), do nothing.
        // This prevents the recursion that was resetting the label.
        if (val === currentFilterState) return;

        console.log("🌍 State Filter Changed to: " + val);
        filterLogisticsByState(val, window.logisticsRawRoutes || []);
    });
});
const handleResize = debounce(() => {
    // 1. Resizes all Plotly charts ONLY after resize stops
    const plots = document.querySelectorAll('.js-plotly-plot');
    plots.forEach(plot => {
        Plotly.Plots.resize(plot);
    });

    // 2. Refreshes Maps to prevent grey tiles
    if (typeof map !== 'undefined' && map) map.invalidateSize();
    if (typeof logisticsMap !== 'undefined' && logisticsMap) logisticsMap.invalidateSize();
    if (typeof ghostMap !== 'undefined' && ghostMap) ghostMap.invalidateSize();
}, 250); // 250ms delay ensures layout is stable before drawing

window.addEventListener('resize', handleResize);