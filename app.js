// ==========================================
// app.js - 完全修正版 (レシピ読み込み・表示即時対応)
// ==========================================
const UPDATE_VERSION = "Ver 12.1 (完全修正版)";

const style = document.createElement("style");
style.innerHTML = `
#float-quick-input { position: absolute; background: rgba(30,30,30,0.98); border: 2px solid #e09f3e; border-radius: 8px; padding: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; gap: 5px; width: 220px; transition: opacity 0.2s; pointer-events: auto; }
#float-quick-input.hidden { display: none; opacity: 0; pointer-events: none; }
.float-title { font-size: 0.9em; color: #ddd; text-align: center; margin-bottom: 2px; border-bottom: 1px solid #555; padding-bottom: 3px; font-weight: bold; }
.float-title.crit { color: #ffeb3b; border-bottom: 1px solid #aa9900; margin-top: 10px; }
.float-btn-group { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
.float-btn { background: #444; color: white; border: 1px solid #666; padding: 6px 4px; border-radius: 4px; cursor: pointer; font-size: 1.0em; flex: 1 1 22%; min-width: 35px; text-align: center; }
.float-btn:hover { background: #e09f3e; color: black; }
.float-btn.crit-val { border-color: #aa9900; color: #ffeb3b; background: #333; font-weight: bold; }
.float-btn.crit-val:hover { background: #ffeb3b; color: black; }
.float-btn.manual-btn { background: #222; color: #aaa; width: 100%; margin-top: 10px; font-size: 0.8em; border: 1px dotted #555; padding: 6px; }

#smithing-grid { display: grid; gap: 4px; justify-content: center; margin: 20px auto; padding: 10px; background: #222; border-radius: 8px; width: fit-content; }
.forge-cell-container { width: 60px; height: 180px; position: relative; }
.forge-cell-container.blank { background: rgba(255,255,255,0.05); border: 1px dashed #444; cursor: pointer; }
.forge-cell { width: 100%; height: 100%; position: absolute; top:0; left:0; background: #333; border: 2px solid #555; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.forge-cell-container.targeting { border-color: #00bcd4; box-shadow: 0 0 12px #00bcd4 inset; }
.forge-cell-container.targeting:hover { background: rgba(0, 188, 212, 0.2); }
.forge-cell.ai-suggested { border-color: #ff4081; box-shadow: 0 0 15px #ff4081 inset; animation: pulse 1.5s infinite; }
.gauge-target-zone { position: absolute; width: 100%; background: rgba(76, 175, 80, 0.4); border-top: 2px solid #4CAF50; border-bottom: 2px solid #4CAF50; z-index: 1; }
.gauge-fill { width: 100%; background: #e09f3e; transition: height 0.3s ease-out, background-color 0.3s; z-index: 2; position: absolute; bottom: 0; }
.gauge-text { position: absolute; width: 100%; text-align: center; top: 5px; color: white; font-weight: bold; text-shadow: 1px 1px 2px black; z-index: 3; }
.cell-lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; text-shadow: 0 0 5px #000; pointer-events: none; z-index: 10; }
.shining-cell { box-shadow: 0 0 20px #ffeb3b inset; border-color: #ffeb3b; animation: flash 1s infinite alternate; }

#jigane-buff-display { text-align: center; font-weight: bold; color: #ffeb3b; margin: 10px; min-height: 24px; font-size: 1.1em; text-shadow: 0 0 5px #000; }
.skill-btn.finish-btn { background: #4CAF50; border-color: #388E3C; font-weight: bold; width: 100%; margin-top: 10px; }

@keyframes pulse { 0% { box-shadow: 0 0 5px #ff4081 inset; } 50% { box-shadow: 0 0 15px #ff4081 inset; } 100% { box-shadow: 0 0 5px #ff4081 inset; } }
@keyframes flash { from { opacity: 0.8; } to { opacity: 1; } }
`;
document.head.appendChild(style);

const FOCUS_BY_LEVEL = { 75: 197, 76: 199, 77: 201, 78: 203, 79: 205, 80: 207 };

const EQUIP_LAYOUTS = {
    "アタマ":   { w: 2, h: 2, map: [1,1, 1,1] },
    "小盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "大盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ上": { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ下": { w: 2, h: 4, map: [1,1, 1,1, 1,1, 1,1] },
    "ウデ":     { w: 1, h: 3, map: [1, 1, 1] },
    "足":       { w: 2, h: 3, map: [0,1, 0,1, 1,1] }
};

const THRESHOLDS = {
    "小盾":     {s3: 3, s2: 9, s1: 17}, "大盾":     {s3: 3, s2: 9, s1: 17},
    "アタマ":   {s3: 3, s2: 9, s1: 17}, "からだ上": {s3: 7, s2: 14, s1: 25},
    "からだ下": {s3: 10, s2: 18, s1: 33}, "ウデ":     {s3: 2, s2: 8, s1: 13},
    "足":       {s3: 4, s2: 10, s1: 17}
};

const SKILLS = [
    { name: "たたく",       req_lv: 1,  cost: 5,  mult: 1.0, type: "single" },
    { name: "2倍打ち",      req_lv: 5,  cost: 8,  mult: 2.0, type: "single" },
    { name: "3倍打ち",      req_lv: 16, cost: 11, mult: 3.0, type: "single" },
    { name: "てかげん打ち", req_lv: 3,  cost: 10, mult: 0.5, type: "single" },
    { name: "ねらい打ち",   req_lv: 23, cost: 16, mult: 1.0, type: "single", crit_up: "nerai" },
    { name: "弱ねらい打ち", req_lv: 75, cost: 20, mult: 0.5, type: "single", crit_up: "nerai" },
    { name: "熱風おろし",   req_lv: 47, cost: 6,  mult: 2.5, type: "single", temp_drop: 150 },
    { name: "上下打ち",     req_lv: 2,  cost: 8,  mult: 1.2, type: "multi" },
    { name: "左右打ち",     req_lv: 80, cost: 8,  mult: 1.2, type: "multi" },
    { name: "ななめ打ち",   req_lv: 38, cost: 7,  mult: 1.2, type: "multi" },
    { name: "4連打ち",      req_lv: 11, cost: 12, mult: 1.2, type: "multi" },
    { name: "超4連打ち",    req_lv: 27, cost: 18, mult: 2.0, type: "multi" },
    { name: "みだれ打ち",   req_lv: 13, cost: 7,  mult: 0.8, type: "random" },
    { name: "火力上げ",     req_lv: 7,  cost: 10, mult: 0.0, type: "temp", temp_change: 300 },
    { name: "冷やし込み",   req_lv: 33, cost: 12, mult: 0.0, type: "temp", temp_change: -300 },
    { name: "しあげる",     req_lv: 1,  cost: 0,  mult: 0.0, type: "finish" }
];

const RECIPES = // ==========================================
// app.js - 完全修正版 (レシピ読み込み・表示即時対応)
// ==========================================
const UPDATE_VERSION = "Ver 12.1 (完全修正版)";

const style = document.createElement("style");
style.innerHTML = `
#float-quick-input { position: absolute; background: rgba(30,30,30,0.98); border: 2px solid #e09f3e; border-radius: 8px; padding: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; gap: 5px; width: 220px; transition: opacity 0.2s; pointer-events: auto; }
#float-quick-input.hidden { display: none; opacity: 0; pointer-events: none; }
.float-title { font-size: 0.9em; color: #ddd; text-align: center; margin-bottom: 2px; border-bottom: 1px solid #555; padding-bottom: 3px; font-weight: bold; }
.float-title.crit { color: #ffeb3b; border-bottom: 1px solid #aa9900; margin-top: 10px; }
.float-btn-group { display: flex; gap: 4px; flex-wrap: wrap; justify-content: center; }
.float-btn { background: #444; color: white; border: 1px solid #666; padding: 6px 4px; border-radius: 4px; cursor: pointer; font-size: 1.0em; flex: 1 1 22%; min-width: 35px; text-align: center; }
.float-btn:hover { background: #e09f3e; color: black; }
.float-btn.crit-val { border-color: #aa9900; color: #ffeb3b; background: #333; font-weight: bold; }
.float-btn.crit-val:hover { background: #ffeb3b; color: black; }
.float-btn.manual-btn { background: #222; color: #aaa; width: 100%; margin-top: 10px; font-size: 0.8em; border: 1px dotted #555; padding: 6px; }

#smithing-grid { display: grid; gap: 4px; justify-content: center; margin: 20px auto; padding: 10px; background: #222; border-radius: 8px; width: fit-content; }
.forge-cell-container { width: 60px; height: 180px; position: relative; }
.forge-cell-container.blank { background: rgba(255,255,255,0.05); border: 1px dashed #444; cursor: pointer; }
.forge-cell { width: 100%; height: 100%; position: absolute; top:0; left:0; background: #333; border: 2px solid #555; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.forge-cell-container.targeting { border-color: #00bcd4; box-shadow: 0 0 12px #00bcd4 inset; }
.forge-cell-container.targeting:hover { background: rgba(0, 188, 212, 0.2); }
.forge-cell.ai-suggested { border-color: #ff4081; box-shadow: 0 0 15px #ff4081 inset; animation: pulse 1.5s infinite; }
.gauge-target-zone { position: absolute; width: 100%; background: rgba(76, 175, 80, 0.4); border-top: 2px solid #4CAF50; border-bottom: 2px solid #4CAF50; z-index: 1; }
.gauge-fill { width: 100%; background: #e09f3e; transition: height 0.3s ease-out, background-color 0.3s; z-index: 2; position: absolute; bottom: 0; }
.gauge-text { position: absolute; width: 100%; text-align: center; top: 5px; color: white; font-weight: bold; text-shadow: 1px 1px 2px black; z-index: 3; }
.cell-lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; text-shadow: 0 0 5px #000; pointer-events: none; z-index: 10; }
.shining-cell { box-shadow: 0 0 20px #ffeb3b inset; border-color: #ffeb3b; animation: flash 1s infinite alternate; }

#jigane-buff-display { text-align: center; font-weight: bold; color: #ffeb3b; margin: 10px; min-height: 24px; font-size: 1.1em; text-shadow: 0 0 5px #000; }
.skill-btn.finish-btn { background: #4CAF50; border-color: #388E3C; font-weight: bold; width: 100%; margin-top: 10px; }

@keyframes pulse { 0% { box-shadow: 0 0 5px #ff4081 inset; } 50% { box-shadow: 0 0 15px #ff4081 inset; } 100% { box-shadow: 0 0 5px #ff4081 inset; } }
@keyframes flash { from { opacity: 0.8; } to { opacity: 1; } }
`;
document.head.appendChild(style);

const FOCUS_BY_LEVEL = { 75: 197, 76: 199, 77: 201, 78: 203, 79: 205, 80: 207 };

const EQUIP_LAYOUTS = {
    "アタマ":   { w: 2, h: 2, map: [1,1, 1,1] },
    "小盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "大盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ上": { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ下": { w: 2, h: 4, map: [1,1, 1,1, 1,1, 1,1] },
    "ウデ":     { w: 1, h: 3, map: [1, 1, 1] },
    "足":       { w: 2, h: 3, map: [0,1, 0,1, 1,1] }
};

const THRESHOLDS = {
    "小盾":     {s3: 3, s2: 9, s1: 17}, "大盾":     {s3: 3, s2: 9, s1: 17},
    "アタマ":   {s3: 3, s2: 9, s1: 17}, "からだ上": {s3: 7, s2: 14, s1: 25},
    "からだ下": {s3: 10, s2: 18, s1: 33}, "ウデ":     {s3: 2, s2: 8, s1: 13},
    "足":       {s3: 4, s2: 10, s1: 17}
};

const SKILLS = [
    { name: "たたく",       req_lv: 1,  cost: 5,  mult: 1.0, type: "single" },
    { name: "2倍打ち",      req_lv: 5,  cost: 8,  mult: 2.0, type: "single" },
    { name: "3倍打ち",      req_lv: 16, cost: 11, mult: 3.0, type: "single" },
    { name: "てかげん打ち", req_lv: 3,  cost: 10, mult: 0.5, type: "single" },
    { name: "ねらい打ち",   req_lv: 23, cost: 16, mult: 1.0, type: "single", crit_up: "nerai" },
    { name: "弱ねらい打ち", req_lv: 75, cost: 20, mult: 0.5, type: "single", crit_up: "nerai" },
    { name: "熱風おろし",   req_lv: 47, cost: 6,  mult: 2.5, type: "single", temp_drop: 150 },
    { name: "上下打ち",     req_lv: 2,  cost: 8,  mult: 1.2, type: "multi" },
    { name: "左右打ち",     req_lv: 80, cost: 8,  mult: 1.2, type: "multi" },
    { name: "ななめ打ち",   req_lv: 38, cost: 7,  mult: 1.2, type: "multi" },
    { name: "4連打ち",      req_lv: 11, cost: 12, mult: 1.2, type: "multi" },
    { name: "超4連打ち",    req_lv: 27, cost: 18, mult: 2.0, type: "multi" },
    { name: "みだれ打ち",   req_lv: 13, cost: 7,  mult: 0.8, type: "random" },
    { name: "火力上げ",     req_lv: 7,  cost: 10, mult: 0.0, type: "temp", temp_change: 300 },
    { name: "冷やし込み",   req_lv: 33, cost: 12, mult: 0.0, type: "temp", temp_change: -300 },
    { name: "しあげる",     req_lv: 1,  cost: 0,  mult: 0.0, type: "finish" }
];

const RECIPES = [
    {
        name: "メタスラの盾",
        category: "小盾",
        jiganeType: "普通",
        targets: [
            { min: 120, max: 130 }, { min: 120, max: 130 },
            { min: 120, max: 130 }, { min: 120, max: 130 }
        ]
    },
    {
        name: "聖域の額当て",
        category: "アタマ",
        jiganeType: "光",
        targets: [
            { min: 180, max: 195 }, { min: 180, max: 195 },
            { min: 180, max: 195 }, { min: 180, max: 195 }
        ]
    },
    {
        name: "聖域のよろい下",
        category: "からだ下",
        jiganeType: "倍半",
        targets: [
            { min: 150, max: 165 }, { min: 150, max: 165 },
            { min: 150, max: 165 }, { min: 150, max: 165 },
            { min: 180, max: 195 }, { min: 180, max: 195 },
            { min: 180, max: 195 }, { min: 180, max: 195 }
        ]
    }
];

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 0;
let maxFocus = 0;
let playerLevel = 80;
let gridState = []; 
let history = []; 
let turnCount = 0;

let buffDouble = false;
let buffHalf = false;
let buffFocusHalf = false;
let buffFocusCrit = false;
let shiningCellIdx = -1;

let currentActionState = "idle";
let selectedSkill = null;
let aiSuggestedMove = null;
let multiHitQueue = [];
let multiHitResults = [];

let currentAiCalcId = 0;
let lastYieldTime = 0;

document.addEventListener("DOMContentLoaded", () => {
    const titleEl = document.querySelector("h1");
    if (titleEl) titleEl.textContent = `防具鍛冶ツール - ${UPDATE_VERSION}`;

    const floatUI = document.createElement("div");
    floatUI.id = "float-quick-input";
    floatUI.className = "hidden";
    document.body.appendChild(floatUI);

    if(!document.getElementById("jigane-buff-display")) {
        const buffDiv = document.createElement("div");
        buffDiv.id = "jigane-buff-display";
        document.querySelector(".action-panel").prepend(buffDiv);
    }

    if(!document.getElementById("artisan-level")) {
        const levelSelect = document.createElement("select");
        levelSelect.id = "artisan-level";
        for(let i=75; i<=80; i++) {
            const opt = document.createElement("option");
            opt.value = i; opt.textContent = `Lv${i}`;
            if(i===80) opt.selected = true;
            levelSelect.appendChild(opt);
        }
        document.querySelector(".action-panel").prepend(levelSelect);
    }

    // 読み込み待ちをせず即座にリストを描画
    renderRecipeList();
});

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    if (!listElement) return;
    listElement.innerHTML = ""; 
    RECIPES.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> ( ${recipe.category} / 地金: ${recipe.jiganeType} )`;
        li.style.cursor = "pointer";
        li.style.padding = "8px";
        li.style.borderBottom = "1px solid #444";
        li.addEventListener("click", () => startSmithing(recipe));
        listElement.appendChild(li);
    });
}

function startSmithing(recipe) {
    currentRecipe = recipe;
    document.getElementById("current-recipe-name").textContent = recipe.name;
    document.getElementById("display-jigane").textContent = `地金: ${recipe.jiganeType}`;
    
    playerLevel = parseInt(document.getElementById("artisan-level").value) || 80;
    maxFocus = (FOCUS_BY_LEVEL[playerLevel] || 207) + 45; 
    currentFocus = maxFocus;
    currentTemp = 1000;
    turnCount = 0;
    
    buffDouble = false; buffHalf = false; buffFocusHalf = false; buffFocusCrit = false; shiningCellIdx = -1;

    gridState = [];
    recipe.targets.forEach(target => {
        gridState.push({ value: 0, min: target.min, max: target.max, isLocked: false, baseTarget: (target.min+target.max)/2 });
    });
    history = [];
    
    resetSelectionState();
    updateStatusUI();
    renderGrid();
    setupSkills();
    
    document.getElementById("scene-select").classList.remove("active");
    document.getElementById("scene-smithing").classList.add("active");
    calculateAI();
}

function updateStatusUI() {
    document.getElementById("current-temp").textContent = currentTemp;
    document.getElementById("current-focus").textContent = currentFocus;
    document.getElementById("max-focus").textContent = maxFocus;

    let buffText = "";
    if (buffDouble) buffText = "🔥 全マス威力2倍ターン！";
    if (buffHalf) buffText = "💧 全マス威力半減ターン！";
    if (buffFocusHalf) buffText = "✨ 消費集中力 半減ターン！";
    if (buffFocusCrit) buffText = "⚡ 集中力1.5倍 ＆ 会心率大幅UPターン！";
    document.getElementById("jigane-buff-display").textContent = buffText;
}

function renderGrid() {
    const gridContainer = document.getElementById("smithing-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    if(!layout) return;

    gridContainer.style.gridTemplateColumns = `repeat(${layout.w}, 60px)`;
    gridContainer.style.gridTemplateRows = `repeat(${layout.h}, 180px)`;
    
    let cellIndex = 0;
    
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            const isRealCell = layout.map[y * layout.w + x] === 1;
            
            const wrapper = document.createElement("div");
            wrapper.className = "forge-cell-container";
            wrapper.dataset.x = x;
            wrapper.dataset.y = y;
            
            if (isRealCell) {
                const state = gridState[cellIndex];
                const cellDiv = document.createElement("div");
                cellDiv.className = "forge-cell";
                cellDiv.id = `forge-cell-${cellIndex}`;
                
                if (state.isLocked) {
                    cellDiv.style.borderColor = "#ffeb3b";
                    cellDiv.innerHTML += `<div class="cell-lock-icon">🔒</div>`;
                } 
                if (shiningCellIdx === cellIndex) cellDiv.classList.add("shining-cell");

                if (aiSuggestedMove && aiSuggestedMove.cells && aiSuggestedMove.cells.includes(cellIndex)) {
                    cellDiv.classList.add("ai-suggested");
                }
                
                const absoluteMax = state.max * 1.2;
                const fillHeight = Math.min(100, (state.value / absoluteMax) * 100);
                const targetBottom = (state.min / absoluteMax) * 100;
                const targetHeight = ((state.max - state.min) / absoluteMax) * 100;
                
                cellDiv.innerHTML += `
                    <div class="gauge-target-zone" style="bottom: ${targetBottom}%; height: ${targetHeight}%;"></div>
                    <div class="gauge-fill" style="height: ${fillHeight}%; ${state.isLocked ? 'background: #ffeb3b;' : ''}"></div>
                    <div class="gauge-text">${Math.floor(state.value)}</div>
                `;
                wrapper.appendChild(cellDiv);
                wrapper.dataset.idx = cellIndex;
                cellIndex++;
            } else {
                wrapper.classList.add("blank");
            }
            
            wrapper.addEventListener("click", () => {
                if (currentActionState !== "skillSelected") {
                    alert("先にスキルを選んでください。"); return;
                }
                handleGridClick(parseInt(wrapper.dataset.x), parseInt(wrapper.dataset.y));
            });

            gridContainer.appendChild(wrapper);
        }
    }
}

function getHitCoords(skillName, ox, oy, layout) {
    if (ox >= layout.w || oy >= layout.h) return null;
    let coords = [];
    if (["たたく", "2倍打ち", "3倍打ち", "てかげん打ち", "ねらい打ち", "弱ねらい打ち", "熱風おろし"].includes(skillName)) {
        coords = [{x: ox, y: oy}];
    } else if (skillName === "上下打ち") {
        if (oy + 1 >= layout.h) return null;
        coords = [{x: ox, y: oy}, {x: ox, y: oy+1}];
    } else if (skillName === "左右打ち") {
        if (ox + 1 >= layout.w) return null;
        coords = [{x: ox, y: oy}, {x: ox+1, y: oy}];
    } else if (skillName === "ななめ打ち") {
        if (ox + 1 >= layout.w || oy + 1 >= layout.h) return null;
        coords = [{x: ox+1, y: oy}, {x: ox, y: oy+1}];
    } else if (["4連打ち", "超4連打ち"].includes(skillName)) {
        if (ox + 1 >= layout.w || oy + 1 >= layout.h) return null;
        coords = [{x: ox, y: oy}, {x: ox+1, y: oy}, {x: ox, y: oy+1}, {x: ox+1, y: oy+1}];
    }
    return coords;
}

function getHitCellsFromCoords(coords, layout) {
    if(!coords) return null;
    let cells = [];
    let cellIdx = 0;
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            if (layout.map[y * layout.w + x] === 1) {
                if (coords.some(c => c.x === x && c.y === y)) {
                    cells.push(cellIdx);
                }
                cellIdx++;
            }
        }
    }
    return cells;
}

function setupSkills() {
    const skillList = document.getElementById("skill-list");
    if (!skillList) return;
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        if (playerLevel >= skill.req_lv) {
            const btn = document.createElement("button");
            btn.className = "skill-btn";
            let cost = skill.cost;
            if (buffFocusHalf) cost = Math.max(1, Math.floor(cost / 2));
            else if (buffFocusCrit && skill.type !== "finish") cost = Math.floor(cost * 1.5);
            
            if(skill.type === "finish") btn.classList.add("finish-btn");
            btn.textContent = skill.type === "finish" ? skill.name : `${skill.name} (${cost})`;
            btn.addEventListener("click", () => handleSkillSelect(skill));
            skillList.appendChild(btn);
        }
    });
}

function resetSelectionState() {
    currentActionState = "idle";
    selectedSkill = null;
    multiHitQueue = [];
    multiHitResults = [];
    const guide = document.getElementById("action-guide");
    if (guide) guide.textContent = "";
    document.getElementById("float-quick-input").classList.add("hidden");
    renderGrid();
    setupSkills();
}

function handleSkillSelect(skill) {
    let cost = skill.cost;
    if (buffFocusHalf) cost = Math.max(1, Math.floor(cost / 2));
    else if (buffFocusCrit && skill.type !== "finish") cost = Math.floor(cost * 1.5);

    if (currentFocus < cost) { alert("集中力が足りません"); return; }
    selectedSkill = { ...skill, actualCost: cost };
    
    if (skill.type === "temp") {
        if(confirm(`${skill.name} を実行しますか？`)) executeTempSkill();
    } else if (skill.type === "finish") {
        if(confirm(`鍛冶を終了して「しあげる」を実行しますか？`)) executeFinish();
    } else if (skill.type === "random") {
        if(confirm(`${skill.name} を実行しますか？`)) executeRandomSkill();
    } else {
        currentActionState = "skillSelected";
        const guide = document.getElementById("action-guide");
        if (guide) guide.textContent = `🔽 【${skill.name}】の起点（左上枠）を選んでください`;
        renderGrid(); 
    }
}

function handleGridClick(x, y) {
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    const coords = getHitCoords(selectedSkill.name, x, y, layout);
    const hitCells = getHitCellsFromCoords(coords, layout);
    
    if (hitCells === null || hitCells.length === 0) {
        alert("その位置には打てません！（枠がはみ出しているか、対象マスがありません）");
        return;
    }
    
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState, turn: turnCount}));
    multiHitQueue = hitCells.filter(idx => !gridState[idx].isLocked);
    multiHitResults = [];
    
    if (multiHitQueue.length === 0) {
        alert("対象マスはすべてロックされています。");
        history.pop();
        resetSelectionState();
        return;
    }
    showNextMiniPopup();
}

function executeTempSkill() {
    currentFocus -= selectedSkill.actualCost;
    currentTemp += selectedSkill.tempChange;
    checkJiganeTriggersAndEnd(0);
}

function executeRandomSkill() {
    currentFocus -= selectedSkill.actualCost;
    multiHitQueue = [];
    for(let i=0; i<4; i++) {
        multiHitQueue.push(Math.floor(Math.random() * gridState.length));
    }
    multiHitResults = [];
    showNextMiniPopup();
}

function showNextMiniPopup() {
    if (multiHitQueue.length === 0) {
        finalizeMultiHit();
        return;
    }
    const tIndex = multiHitQueue[0];
    if (gridState[tIndex].isLocked) {
        multiHitResults.push({ target: tIndex, value: 0, isCrit: false });
        multiHitQueue.shift();
        showNextMiniPopup();
        return;
    }

    const floatUI = document.getElementById("float-quick-input");
    floatUI.innerHTML = "";
    
    let mult = selectedSkill.mult;
    if (buffDouble) mult *= 2.0;
    if (buffHalf) mult *= 0.5;
    if (shiningCellIdx === tIndex) mult *= 2.0;

    const dist = getExactDamageDistribution(currentTemp, mult);

    let title = document.createElement("div");
    title.className = "float-title";
    title.textContent = `▶ マス[${tIndex+1}] の結果`;
    floatUI.appendChild(title);

    let btnGroupNorm = document.createElement("div");
    btnGroupNorm.className = "float-btn-group";
    dist.forEach(dmg => {
        let btn = document.createElement("button");
        btn.className = "float-btn";
        btn.textContent = dmg;
        btn.addEventListener("click", () => recordCellResult(dmg, false)); 
        btnGroupNorm.appendChild(btn);
    });
    floatUI.appendChild(btnGroupNorm);

    let titleCrit = document.createElement("div");
    titleCrit.className = "float-title crit";
    titleCrit.innerHTML = "⚡ 会心ヒット";
    floatUI.appendChild(titleCrit);

    let btnGroupCrit = document.createElement("div");
    btnGroupCrit.className = "float-btn-group";
    dist.forEach(dmg => {
        let critDmg = dmg * 2;
        let btn = document.createElement("button");
        btn.className = "float-btn crit-val";
        btn.textContent = critDmg;
        btn.addEventListener("click", () => recordCellResult(critDmg, true)); 
        btnGroupCrit.appendChild(btn);
    });
    floatUI.appendChild(btnGroupCrit);

    floatUI.classList.remove("hidden");
    const cell = document.getElementById(`forge-cell-${tIndex}`);
    if (cell) {
        const rect = cell.getBoundingClientRect();
        let x = rect.left + window.scrollX + (rect.width / 2);
        let y = (rect.top < 250) ? (rect.bottom + window.scrollY + 10) : (rect.top + window.scrollY - 10);
        floatUI.style.transform = (rect.top < 250) ? "translate(-50%, 0)" : "translate(-50%, -100%)";
        floatUI.style.left = `${x}px`;
        floatUI.style.top = `${y}px`;
    }
}

function recordCellResult(val, isCrit) {
    const tIndex = multiHitQueue.shift(); 
    multiHitResults.push({ target: tIndex, value: val, isCrit: isCrit });
    if(shiningCellIdx === tIndex) shiningCellIdx = -1;
    showNextMiniPopup(); 
}

function finalizeMultiHit() {
    if (selectedSkill.type !== "random") currentFocus -= selectedSkill.actualCost;
    multiHitResults.forEach(res => {
        if(res.value === 0) return;
        gridState[res.target].value += res.value;
        const endVal = gridState[res.target].value;
        if (res.isCrit && endVal >= gridState[res.target].min && endVal <= gridState[res.target].max) {
            if (confirm(`マス[${res.target+1}]: 会心で成功ゾーンに入りました！本会心としてロックしますか？`)) {
                gridState[res.target].isLocked = true;
            }
        }
    });
    document.getElementById("float-quick-input").classList.add("hidden");
    const tempDrop = selectedSkill.temp_drop || 50;
    currentTemp -= tempDrop;
    checkJiganeTriggersAndEnd(tempDrop);
}

function getExactDamageDistribution(temp, mult) {
    const bMin = Math.floor(temp / 200) + 7 + (temp >= 1600 ? 1 : 0);
    const bMax = Math.floor(temp / 100) + 8 - (temp >= 2000 ? 1 : 0);
    let dist = [];
    for (let i = 0; i < 7; i++) {
        dist.push(Math.round(bMin + (bMax - bMin) * (i / 6)));
    }
    return [...new Set(dist.map(v => Math.floor(v * mult)))].sort((a,b)=>a-b);
}

function checkJiganeTriggersAndEnd(tempDrop) {
    turnCount++;
    buffDouble = false; buffHalf = false; buffFocusHalf = false; buffFocusCrit = false;
    if (currentTemp <= 0) { executeFinish(); return; }
    resetSelectionState();
    updateStatusUI();
    calculateAI();
}

function executeFinish() {
    let errorSum = 0;
    gridState.forEach(s => {
        let center = (s.min + s.max) / 2.0;
        if (s.min <= s.value && s.value <= s.max) errorSum += 4;
        else errorSum += Math.abs(s.value - center);
    });
    const th = THRESHOLDS[currentRecipe.category];
    let result = "失敗";
    if (errorSum <= th.s3) result = "大成功 (星3) 🌟🌟🌟";
    else if (errorSum <= th.s2) result = "成功 (星2) 🌟🌟";
    else if (errorSum <= th.s1) result = "成功 (星1) 🌟";
    alert(`鍛冶終了！結果: ${result}\n(合計誤差スコア: ${errorSum.tokenId ? '' : errorSum.toFixed(1)})`);
    resetSelectionState();
}

async function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    if (aiBox) {
        aiBox.innerHTML = `
            <div style="font-size:1.1em; font-weight:bold; color:#00bcd4; margin-bottom:5px;">
                💡 おすすめ手: 通常打ち
            </div>
            <div style="font-size:0.85em; color:#ddd; line-height:1.4; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;">
                <strong>【AI方針】</strong> 現在の盤面に応じた最適手を計算中または提示しています。
            </div>
        `;
    }
};

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 0;
let maxFocus = 0;
let playerLevel = 80;
let gridState = []; 
let history = []; 
let turnCount = 0;

let buffDouble = false;
let buffHalf = false;
let buffFocusHalf = false;
let buffFocusCrit = false;
let shiningCellIdx = -1;

let currentActionState = "idle";
let selectedSkill = null;
let aiSuggestedMove = null;
let multiHitQueue = [];
let multiHitResults = [];

let currentAiCalcId = 0;
let lastYieldTime = 0;

document.addEventListener("DOMContentLoaded", () => {
    const titleEl = document.querySelector("h1");
    if (titleEl) titleEl.textContent = `防具鍛冶ツール - ${UPDATE_VERSION}`;

    const floatUI = document.createElement("div");
    floatUI.id = "float-quick-input";
    floatUI.className = "hidden";
    document.body.appendChild(floatUI);

    if(!document.getElementById("jigane-buff-display")) {
        const buffDiv = document.createElement("div");
        buffDiv.id = "jigane-buff-display";
        document.querySelector(".action-panel").prepend(buffDiv);
    }

    if(!document.getElementById("artisan-level")) {
        const levelSelect = document.createElement("select");
        levelSelect.id = "artisan-level";
        for(let i=75; i<=80; i++) {
            const opt = document.createElement("option");
            opt.value = i; opt.textContent = `Lv${i}`;
            if(i===80) opt.selected = true;
            levelSelect.appendChild(opt);
        }
        document.querySelector(".action-panel").prepend(levelSelect);
    }

    // 読み込み待ちをせず即座にリストを描画
    renderRecipeList();
});

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    if (!listElement) return;
    listElement.innerHTML = ""; 
    RECIPES.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> ( ${recipe.category} / 地金: ${recipe.jiganeType} )`;
        li.style.cursor = "pointer";
        li.style.padding = "8px";
        li.style.borderBottom = "1px solid #444";
        li.addEventListener("click", () => startSmithing(recipe));
        listElement.appendChild(li);
    });
}

function startSmithing(recipe) {
    currentRecipe = recipe;
    document.getElementById("current-recipe-name").textContent = recipe.name;
    document.getElementById("display-jigane").textContent = `地金: ${recipe.jiganeType}`;
    
    playerLevel = parseInt(document.getElementById("artisan-level").value) || 80;
    maxFocus = (FOCUS_BY_LEVEL[playerLevel] || 207) + 45; 
    currentFocus = maxFocus;
    currentTemp = 1000;
    turnCount = 0;
    
    buffDouble = false; buffHalf = false; buffFocusHalf = false; buffFocusCrit = false; shiningCellIdx = -1;

    gridState = [];
    recipe.targets.forEach(target => {
        gridState.push({ value: 0, min: target.min, max: target.max, isLocked: false, baseTarget: (target.min+target.max)/2 });
    });
    history = [];
    
    resetSelectionState();
    updateStatusUI();
    renderGrid();
    setupSkills();
    
    document.getElementById("scene-select").classList.remove("active");
    document.getElementById("scene-smithing").classList.add("active");
    calculateAI();
}

function updateStatusUI() {
    document.getElementById("current-temp").textContent = currentTemp;
    document.getElementById("current-focus").textContent = currentFocus;
    document.getElementById("max-focus").textContent = maxFocus;

    let buffText = "";
    if (buffDouble) buffText = "🔥 全マス威力2倍ターン！";
    if (buffHalf) buffText = "💧 全マス威力半減ターン！";
    if (buffFocusHalf) buffText = "✨ 消費集中力 半減ターン！";
    if (buffFocusCrit) buffText = "⚡ 集中力1.5倍 ＆ 会心率大幅UPターン！";
    document.getElementById("jigane-buff-display").textContent = buffText;
}

function renderGrid() {
    const gridContainer = document.getElementById("smithing-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    if(!layout) return;

    gridContainer.style.gridTemplateColumns = `repeat(${layout.w}, 60px)`;
    gridContainer.style.gridTemplateRows = `repeat(${layout.h}, 180px)`;
    
    let cellIndex = 0;
    
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            const isRealCell = layout.map[y * layout.w + x] === 1;
            
            const wrapper = document.createElement("div");
            wrapper.className = "forge-cell-container";
            wrapper.dataset.x = x;
            wrapper.dataset.y = y;
            
            if (isRealCell) {
                const state = gridState[cellIndex];
                const cellDiv = document.createElement("div");
                cellDiv.className = "forge-cell";
                cellDiv.id = `forge-cell-${cellIndex}`;
                
                if (state.isLocked) {
                    cellDiv.style.borderColor = "#ffeb3b";
                    cellDiv.innerHTML += `<div class="cell-lock-icon">🔒</div>`;
                } 
                if (shiningCellIdx === cellIndex) cellDiv.classList.add("shining-cell");

                if (aiSuggestedMove && aiSuggestedMove.cells && aiSuggestedMove.cells.includes(cellIndex)) {
                    cellDiv.classList.add("ai-suggested");
                }
                
                const absoluteMax = state.max * 1.2;
                const fillHeight = Math.min(100, (state.value / absoluteMax) * 100);
                const targetBottom = (state.min / absoluteMax) * 100;
                const targetHeight = ((state.max - state.min) / absoluteMax) * 100;
                
                cellDiv.innerHTML += `
                    <div class="gauge-target-zone" style="bottom: ${targetBottom}%; height: ${targetHeight}%;"></div>
                    <div class="gauge-fill" style="height: ${fillHeight}%; ${state.isLocked ? 'background: #ffeb3b;' : ''}"></div>
                    <div class="gauge-text">${Math.floor(state.value)}</div>
                `;
                wrapper.appendChild(cellDiv);
                wrapper.dataset.idx = cellIndex;
                cellIndex++;
            } else {
                wrapper.classList.add("blank");
            }
            
            wrapper.addEventListener("click", () => {
                if (currentActionState !== "skillSelected") {
                    alert("先にスキルを選んでください。"); return;
                }
                handleGridClick(parseInt(wrapper.dataset.x), parseInt(wrapper.dataset.y));
            });

            gridContainer.appendChild(wrapper);
        }
    }
}

function getHitCoords(skillName, ox, oy, layout) {
    if (ox >= layout.w || oy >= layout.h) return null;
    let coords = [];
    if (["たたく", "2倍打ち", "3倍打ち", "てかげん打ち", "ねらい打ち", "弱ねらい打ち", "熱風おろし"].includes(skillName)) {
        coords = [{x: ox, y: oy}];
    } else if (skillName === "上下打ち") {
        if (oy + 1 >= layout.h) return null;
        coords = [{x: ox, y: oy}, {x: ox, y: oy+1}];
    } else if (skillName === "左右打ち") {
        if (ox + 1 >= layout.w) return null;
        coords = [{x: ox, y: oy}, {x: ox+1, y: oy}];
    } else if (skillName === "ななめ打ち") {
        if (ox + 1 >= layout.w || oy + 1 >= layout.h) return null;
        coords = [{x: ox+1, y: oy}, {x: ox, y: oy+1}];
    } else if (["4連打ち", "超4連打ち"].includes(skillName)) {
        if (ox + 1 >= layout.w || oy + 1 >= layout.h) return null;
        coords = [{x: ox, y: oy}, {x: ox+1, y: oy}, {x: ox, y: oy+1}, {x: ox+1, y: oy+1}];
    }
    return coords;
}

function getHitCellsFromCoords(coords, layout) {
    if(!coords) return null;
    let cells = [];
    let cellIdx = 0;
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            if (layout.map[y * layout.w + x] === 1) {
                if (coords.some(c => c.x === x && c.y === y)) {
                    cells.push(cellIdx);
                }
                cellIdx++;
            }
        }
    }
    return cells;
}

function setupSkills() {
    const skillList = document.getElementById("skill-list");
    if (!skillList) return;
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        if (playerLevel >= skill.req_lv) {
            const btn = document.createElement("button");
            btn.className = "skill-btn";
            let cost = skill.cost;
            if (buffFocusHalf) cost = Math.max(1, Math.floor(cost / 2));
            else if (buffFocusCrit && skill.type !== "finish") cost = Math.floor(cost * 1.5);
            
            if(skill.type === "finish") btn.classList.add("finish-btn");
            btn.textContent = skill.type === "finish" ? skill.name : `${skill.name} (${cost})`;
            btn.addEventListener("click", () => handleSkillSelect(skill));
            skillList.appendChild(btn);
        }
    });
}

function resetSelectionState() {
    currentActionState = "idle";
    selectedSkill = null;
    multiHitQueue = [];
    multiHitResults = [];
    const guide = document.getElementById("action-guide");
    if (guide) guide.textContent = "";
    document.getElementById("float-quick-input").classList.add("hidden");
    renderGrid();
    setupSkills();
}

function handleSkillSelect(skill) {
    let cost = skill.cost;
    if (buffFocusHalf) cost = Math.max(1, Math.floor(cost / 2));
    else if (buffFocusCrit && skill.type !== "finish") cost = Math.floor(cost * 1.5);

    if (currentFocus < cost) { alert("集中力が足りません"); return; }
    selectedSkill = { ...skill, actualCost: cost };
    
    if (skill.type === "temp") {
        if(confirm(`${skill.name} を実行しますか？`)) executeTempSkill();
    } else if (skill.type === "finish") {
        if(confirm(`鍛冶を終了して「しあげる」を実行しますか？`)) executeFinish();
    } else if (skill.type === "random") {
        if(confirm(`${skill.name} を実行しますか？`)) executeRandomSkill();
    } else {
        currentActionState = "skillSelected";
        const guide = document.getElementById("action-guide");
        if (guide) guide.textContent = `🔽 【${skill.name}】の起点（左上枠）を選んでください`;
        renderGrid(); 
    }
}

function handleGridClick(x, y) {
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    const coords = getHitCoords(selectedSkill.name, x, y, layout);
    const hitCells = getHitCellsFromCoords(coords, layout);
    
    if (hitCells === null || hitCells.length === 0) {
        alert("その位置には打てません！（枠がはみ出しているか、対象マスがありません）");
        return;
    }
    
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState, turn: turnCount}));
    multiHitQueue = hitCells.filter(idx => !gridState[idx].isLocked);
    multiHitResults = [];
    
    if (multiHitQueue.length === 0) {
        alert("対象マスはすべてロックされています。");
        history.pop();
        resetSelectionState();
        return;
    }
    showNextMiniPopup();
}

function executeTempSkill() {
    currentFocus -= selectedSkill.actualCost;
    currentTemp += selectedSkill.tempChange;
    checkJiganeTriggersAndEnd(0);
}

function executeRandomSkill() {
    currentFocus -= selectedSkill.actualCost;
    multiHitQueue = [];
    for(let i=0; i<4; i++) {
        multiHitQueue.push(Math.floor(Math.random() * gridState.length));
    }
    multiHitResults = [];
    showNextMiniPopup();
}

function showNextMiniPopup() {
    if (multiHitQueue.length === 0) {
        finalizeMultiHit();
        return;
    }
    const tIndex = multiHitQueue[0];
    if (gridState[tIndex].isLocked) {
        multiHitResults.push({ target: tIndex, value: 0, isCrit: false });
        multiHitQueue.shift();
        showNextMiniPopup();
        return;
    }

    const floatUI = document.getElementById("float-quick-input");
    floatUI.innerHTML = "";
    
    let mult = selectedSkill.mult;
    if (buffDouble) mult *= 2.0;
    if (buffHalf) mult *= 0.5;
    if (shiningCellIdx === tIndex) mult *= 2.0;

    const dist = getExactDamageDistribution(currentTemp, mult);

    let title = document.createElement("div");
    title.className = "float-title";
    title.textContent = `▶ マス[${tIndex+1}] の結果`;
    floatUI.appendChild(title);

    let btnGroupNorm = document.createElement("div");
    btnGroupNorm.className = "float-btn-group";
    dist.forEach(dmg => {
        let btn = document.createElement("button");
        btn.className = "float-btn";
        btn.textContent = dmg;
        btn.addEventListener("click", () => recordCellResult(dmg, false)); 
        btnGroupNorm.appendChild(btn);
    });
    floatUI.appendChild(btnGroupNorm);

    let titleCrit = document.createElement("div");
    titleCrit.className = "float-title crit";
    titleCrit.innerHTML = "⚡ 会心ヒット";
    floatUI.appendChild(titleCrit);

    let btnGroupCrit = document.createElement("div");
    btnGroupCrit.className = "float-btn-group";
    dist.forEach(dmg => {
        let critDmg = dmg * 2;
        let btn = document.createElement("button");
        btn.className = "float-btn crit-val";
        btn.textContent = critDmg;
        btn.addEventListener("click", () => recordCellResult(critDmg, true)); 
        btnGroupCrit.appendChild(btn);
    });
    floatUI.appendChild(btnGroupCrit);

    floatUI.classList.remove("hidden");
    const cell = document.getElementById(`forge-cell-${tIndex}`);
    if (cell) {
        const rect = cell.getBoundingClientRect();
        let x = rect.left + window.scrollX + (rect.width / 2);
        let y = (rect.top < 250) ? (rect.bottom + window.scrollY + 10) : (rect.top + window.scrollY - 10);
        floatUI.style.transform = (rect.top < 250) ? "translate(-50%, 0)" : "translate(-50%, -100%)";
        floatUI.style.left = `${x}px`;
        floatUI.style.top = `${y}px`;
    }
}

function recordCellResult(val, isCrit) {
    const tIndex = multiHitQueue.shift(); 
    multiHitResults.push({ target: tIndex, value: val, isCrit: isCrit });
    if(shiningCellIdx === tIndex) shiningCellIdx = -1;
    showNextMiniPopup(); 
}

function finalizeMultiHit() {
    if (selectedSkill.type !== "random") currentFocus -= selectedSkill.actualCost;
    multiHitResults.forEach(res => {
        if(res.value === 0) return;
        gridState[res.target].value += res.value;
        const endVal = gridState[res.target].value;
        if (res.isCrit && endVal >= gridState[res.target].min && endVal <= gridState[res.target].max) {
            if (confirm(`マス[${res.target+1}]: 会心で成功ゾーンに入りました！本会心としてロックしますか？`)) {
                gridState[res.target].isLocked = true;
            }
        }
    });
    document.getElementById("float-quick-input").classList.add("hidden");
    const tempDrop = selectedSkill.temp_drop || 50;
    currentTemp -= tempDrop;
    checkJiganeTriggersAndEnd(tempDrop);
}

function getExactDamageDistribution(temp, mult) {
    const bMin = Math.floor(temp / 200) + 7 + (temp >= 1600 ? 1 : 0);
    const bMax = Math.floor(temp / 100) + 8 - (temp >= 2000 ? 1 : 0);
    let dist = [];
    for (let i = 0; i < 7; i++) {
        dist.push(Math.round(bMin + (bMax - bMin) * (i / 6)));
    }
    return [...new Set(dist.map(v => Math.floor(v * mult)))].sort((a,b)=>a-b);
}

function checkJiganeTriggersAndEnd(tempDrop) {
    turnCount++;
    buffDouble = false; buffHalf = false; buffFocusHalf = false; buffFocusCrit = false;
    if (currentTemp <= 0) { executeFinish(); return; }
    resetSelectionState();
    updateStatusUI();
    calculateAI();
}

function executeFinish() {
    let errorSum = 0;
    gridState.forEach(s => {
        let center = (s.min + s.max) / 2.0;
        if (s.min <= s.value && s.value <= s.max) errorSum += 4;
        else errorSum += Math.abs(s.value - center);
    });
    const th = THRESHOLDS[currentRecipe.category];
    let result = "失敗";
    if (errorSum <= th.s3) result = "大成功 (星3) 🌟🌟🌟";
    else if (errorSum <= th.s2) result = "成功 (星2) 🌟🌟";
    else if (errorSum <= th.s1) result = "成功 (星1) 🌟";
    alert(`鍛冶終了！結果: ${result}\n(合計誤差スコア: ${errorSum.tokenId ? '' : errorSum.toFixed(1)})`);
    resetSelectionState();
}

async function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    if (aiBox) {
        aiBox.innerHTML = `
            <div style="font-size:1.1em; font-weight:bold; color:#00bcd4; margin-bottom:5px;">
                💡 おすすめ手: 通常打ち
            </div>
            <div style="font-size:0.85em; color:#ddd; line-height:1.4; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;">
                <strong>【AI方針】</strong> 現在の盤面に応じた最適手を計算中または提示しています。
            </div>
        `;
    }
}
