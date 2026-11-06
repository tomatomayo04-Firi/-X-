// ==========================================
// app.js - レシピインポート機能搭載版
// ==========================================
const UPDATE_VERSION = "Ver 12.3 (レシピインポート対応版)";

// スタイル適用
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
.gauge-target-zone { position: absolute; width: 100%; background: rgba(76, 175, 80, 0.4); border-top: 2px solid #4CAF50; border-bottom: 2px solid #4CAF50; z-index: 1; }
.gauge-fill { width: 100%; background: #e09f3e; transition: height 0.3s ease-out; z-index: 2; position: absolute; bottom: 0; }
.gauge-text { position: absolute; width: 100%; text-align: center; top: 5px; color: white; font-weight: bold; text-shadow: 1px 1px 2px black; z-index: 3; }
.cell-lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; z-index: 10; }
#jigane-buff-display { text-align: center; font-weight: bold; color: #ffeb3b; margin: 10px; font-size: 1.1em; }
.skill-btn.finish-btn { background: #4CAF50; border-color: #388E3C; font-weight: bold; width: 100%; margin-top: 10px; }

.import-box { background: #2a2a2a; border: 2px dashed #e09f3e; padding: 12px; border-radius: 6px; margin: 15px 0; text-align: center; }
`;
document.head.appendChild(style);

// マスタデータ
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

const SKILLS = [
    { name: "たたく", req_lv: 1, cost: 5, mult: 1.0, type: "single" },
    { name: "2倍打ち", req_lv: 5, cost: 8, mult: 2.0, type: "single" },
    { name: "3倍打ち", req_lv: 16, cost: 11, mult: 3.0, type: "single" },
    { name: "てかげん打ち", req_lv: 3, cost: 10, mult: 0.5, type: "single" },
    { name: "ねらい打ち", req_lv: 23, cost: 16, mult: 1.0, type: "single", crit_up: "nerai" },
    { name: "上下打ち", req_lv: 2, cost: 8, mult: 1.2, type: "multi" },
    { name: "左右打ち", req_lv: 80, cost: 8, mult: 1.2, type: "multi" },
    { name: "火力上げ", req_lv: 7, cost: 10, mult: 0.0, type: "temp", temp_change: 300 },
    { name: "冷やし込み", req_lv: 33, cost: 12, mult: 0.0, type: "temp", temp_change: -300 },
    { name: "しあげる", req_lv: 1, cost: 0, mult: 0.0, type: "finish" }
];

// 初期レシピ
let RECIPES = // ==========================================
// app.js - レシピインポート機能搭載版
// ==========================================
const UPDATE_VERSION = "Ver 12.3 (レシピインポート対応版)";

// スタイル適用
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
.gauge-target-zone { position: absolute; width: 100%; background: rgba(76, 175, 80, 0.4); border-top: 2px solid #4CAF50; border-bottom: 2px solid #4CAF50; z-index: 1; }
.gauge-fill { width: 100%; background: #e09f3e; transition: height 0.3s ease-out; z-index: 2; position: absolute; bottom: 0; }
.gauge-text { position: absolute; width: 100%; text-align: center; top: 5px; color: white; font-weight: bold; text-shadow: 1px 1px 2px black; z-index: 3; }
.cell-lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; z-index: 10; }
#jigane-buff-display { text-align: center; font-weight: bold; color: #ffeb3b; margin: 10px; font-size: 1.1em; }
.skill-btn.finish-btn { background: #4CAF50; border-color: #388E3C; font-weight: bold; width: 100%; margin-top: 10px; }

.import-box { background: #2a2a2a; border: 2px dashed #e09f3e; padding: 12px; border-radius: 6px; margin: 15px 0; text-align: center; }
`;
document.head.appendChild(style);

// マスタデータ
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

const SKILLS = [
    { name: "たたく", req_lv: 1, cost: 5, mult: 1.0, type: "single" },
    { name: "2倍打ち", req_lv: 5, cost: 8, mult: 2.0, type: "single" },
    { name: "3倍打ち", req_lv: 16, cost: 11, mult: 3.0, type: "single" },
    { name: "てかげん打ち", req_lv: 3, cost: 10, mult: 0.5, type: "single" },
    { name: "ねらい打ち", req_lv: 23, cost: 16, mult: 1.0, type: "single", crit_up: "nerai" },
    { name: "上下打ち", req_lv: 2, cost: 8, mult: 1.2, type: "multi" },
    { name: "左右打ち", req_lv: 80, cost: 8, mult: 1.2, type: "multi" },
    { name: "火力上げ", req_lv: 7, cost: 10, mult: 0.0, type: "temp", temp_change: 300 },
    { name: "冷やし込み", req_lv: 33, cost: 12, mult: 0.0, type: "temp", temp_change: -300 },
    { name: "しあげる", req_lv: 1, cost: 0, mult: 0.0, type: "finish" }
];

// 初期レシピ
let RECIPES = [
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
    }
];

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 207 + 45;
let gridState = [];
let playerLevel = 80;

document.addEventListener("DOMContentLoaded", () => {
    // インポート用ファイル選択ボックスを画面に動的追加
    setupImportUI();
    renderRecipeList();
});

function setupImportUI() {
    const recipeSection = document.getElementById("recipe-list") || document.body;
    const importBox = document.createElement("div");
    importBox.className = "import-box";
    importBox.innerHTML = `
        <label style="cursor: pointer; font-weight: bold; color: #e09f3e;">
            📂 レシピJSONファイルをインポート
            <input type="file" id="json-file-input" accept=".json" style="display: none;">
        </label>
        <div style="font-size: 0.8em; color: #aaa; margin-top: 5px;">自作のレシピデータ（.json）を選択して追加できます</div>
    `;
    
    // レシピリストの真上に挿入
    const parent = recipeSection.parentNode;
    if (parent) {
        parent.insertBefore(importBox, recipeSection);
    } else {
        document.body.prepend(importBox);
    }

    document.getElementById("json-file-input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    RECIPES = RECIPES.concat(importedData);
                } else {
                    RECIPES.push(importedData);
                }
                renderRecipeList();
                alert("レシピのインポートに成功しました！");
            } catch (err) {
                alert("JSONの読み込みに失敗しました。ファイル形式を確認してください。\nエラー: " + err.message);
            }
        };
        reader.readAsText(file);
    });
}

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    if (!listElement) return;
    listElement.innerHTML = ""; 
    RECIPES.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> (${recipe.category} / 地金: ${recipe.jiganeType})`;
        li.style.cursor = "pointer";
        li.style.padding = "10px";
        li.style.background = "#333";
        li.style.margin = "5px 0";
        li.style.borderRadius = "5px";
        li.addEventListener("click", () => startSmithing(recipe));
        listElement.appendChild(li);
    });
}

function startSmithing(recipe) {
    currentRecipe = recipe;
    const nameEl = document.getElementById("current-recipe-name");
    if(nameEl) nameEl.textContent = recipe.name;
    const jiganeEl = document.getElementById("display-jigane");
    if(jiganeEl) jiganeEl.textContent = `地金: ${recipe.jiganeType}`;
    
    gridState = recipe.targets.map(t => ({ value: 0, min: t.min, max: t.max, isLocked: false }));
    currentTemp = 1000;
    
    renderGrid();
    setupSkills();
    
    const sceneSelect = document.getElementById("scene-select");
    const sceneSmithing = document.getElementById("scene-smithing");
    if(sceneSelect) sceneSelect.classList.remove("active");
    if(sceneSmithing) sceneSmithing.classList.add("active");
}

function renderGrid() {
    const gridContainer = document.getElementById("smithing-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    
    gridContainer.style.gridTemplateColumns = `repeat(${layout.w}, 60px)`;
    gridContainer.style.gridTemplateRows = `repeat(${layout.h}, 180px)`;
    
    let cellIndex = 0;
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            const isReal = layout.map[y * layout.w + x] === 1;
            const wrapper = document.createElement("div");
            wrapper.className = "forge-cell-container";
            
            if (isReal) {
                const state = gridState[cellIndex];
                const cellDiv = document.createElement("div");
                cellDiv.className = "forge-cell";
                cellDiv.innerHTML = `<div class="gauge-text">${state.value}</div>`;
                wrapper.appendChild(cellDiv);
                cellIndex++;
            } else {
                wrapper.classList.add("blank");
            }
            gridContainer.appendChild(wrapper);
        }
    }
}

function setupSkills() {
    const skillList = document.getElementById("skill-list");
    if (!skillList) return;
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        const btn = document.createElement("button");
        btn.className = "skill-btn";
        btn.textContent = `${skill.name} (${skill.cost})`;
        skillList.appendChild(btn);
    });
};

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 207 + 45;
let gridState = [];
let playerLevel = 80;

document.addEventListener("DOMContentLoaded", () => {
    // インポート用ファイル選択ボックスを画面に動的追加
    setupImportUI();
    renderRecipeList();
});

function setupImportUI() {
    const recipeSection = document.getElementById("recipe-list") || document.body;
    const importBox = document.createElement("div");
    importBox.className = "import-box";
    importBox.innerHTML = `
        <label style="cursor: pointer; font-weight: bold; color: #e09f3e;">
            📂 レシピJSONファイルをインポート
            <input type="file" id="json-file-input" accept=".json" style="display: none;">
        </label>
        <div style="font-size: 0.8em; color: #aaa; margin-top: 5px;">自作のレシピデータ（.json）を選択して追加できます</div>
    `;
    
    // レシピリストの真上に挿入
    const parent = recipeSection.parentNode;
    if (parent) {
        parent.insertBefore(importBox, recipeSection);
    } else {
        document.body.prepend(importBox);
    }

    document.getElementById("json-file-input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    RECIPES = RECIPES.concat(importedData);
                } else {
                    RECIPES.push(importedData);
                }
                renderRecipeList();
                alert("レシピのインポートに成功しました！");
            } catch (err) {
                alert("JSONの読み込みに失敗しました。ファイル形式を確認してください。\nエラー: " + err.message);
            }
        };
        reader.readAsText(file);
    });
}

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    if (!listElement) return;
    listElement.innerHTML = ""; 
    RECIPES.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> (${recipe.category} / 地金: ${recipe.jiganeType})`;
        li.style.cursor = "pointer";
        li.style.padding = "10px";
        li.style.background = "#333";
        li.style.margin = "5px 0";
        li.style.borderRadius = "5px";
        li.addEventListener("click", () => startSmithing(recipe));
        listElement.appendChild(li);
    });
}

function startSmithing(recipe) {
    currentRecipe = recipe;
    const nameEl = document.getElementById("current-recipe-name");
    if(nameEl) nameEl.textContent = recipe.name;
    const jiganeEl = document.getElementById("display-jigane");
    if(jiganeEl) jiganeEl.textContent = `地金: ${recipe.jiganeType}`;
    
    gridState = recipe.targets.map(t => ({ value: 0, min: t.min, max: t.max, isLocked: false }));
    currentTemp = 1000;
    
    renderGrid();
    setupSkills();
    
    const sceneSelect = document.getElementById("scene-select");
    const sceneSmithing = document.getElementById("scene-smithing");
    if(sceneSelect) sceneSelect.classList.remove("active");
    if(sceneSmithing) sceneSmithing.classList.add("active");
}

function renderGrid() {
    const gridContainer = document.getElementById("smithing-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    
    gridContainer.style.gridTemplateColumns = `repeat(${layout.w}, 60px)`;
    gridContainer.style.gridTemplateRows = `repeat(${layout.h}, 180px)`;
    
    let cellIndex = 0;
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            const isReal = layout.map[y * layout.w + x] === 1;
            const wrapper = document.createElement("div");
            wrapper.className = "forge-cell-container";
            
            if (isReal) {
                const state = gridState[cellIndex];
                const cellDiv = document.createElement("div");
                cellDiv.className = "forge-cell";
                cellDiv.innerHTML = `<div class="gauge-text">${state.value}</div>`;
                wrapper.appendChild(cellDiv);
                cellIndex++;
            } else {
                wrapper.classList.add("blank");
            }
            gridContainer.appendChild(wrapper);
        }
    }
}

function setupSkills() {
    const skillList = document.getElementById("skill-list");
    if (!skillList) return;
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        const btn = document.createElement("button");
        btn.className = "skill-btn";
        btn.textContent = `${skill.name} (${skill.cost})`;
        skillList.appendChild(btn);
    });
}
