// ==========================================
// app.js - Ver 12.7 (レシピ端末読み込み対応・ONNXテスト版)
// ==========================================
const UPDATE_VERSION = "Ver 12.7 (レシピ端末読み込み対応・ONNX版)";

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

#smithing-grid { display: grid; gap: 4px; justify-content: center; margin: 20px auto; padding: 10px; background: #222; border-radius: 8px; width: fit-content; }
.forge-cell-container { width: 60px; height: 180px; position: relative; }
.forge-cell-container.blank { background: rgba(255,255,255,0.05); border: 1px dashed #444; cursor: pointer; }
.forge-cell { width: 100%; height: 100%; position: absolute; top:0; left:0; background: #333; border: 2px solid #555; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.forge-cell-container.targeting { border-color: #00bcd4; box-shadow: 0 0 12px #00bcd4 inset; }
.gauge-target-zone { position: absolute; width: 100%; background: rgba(76, 175, 80, 0.4); border-top: 2px solid #4CAF50; border-bottom: 2px solid #4CAF50; z-index: 1; }
.gauge-fill { width: 100%; background: #e09f3e; transition: height 0.3s ease-out; z-index: 2; position: absolute; bottom: 0; }
.gauge-text { position: absolute; width: 100%; text-align: center; top: 5px; color: white; font-weight: bold; text-shadow: 1px 1px 2px black; z-index: 3; }
.cell-lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; text-shadow: 0 0 5px #000; pointer-events: none; z-index: 10; }
.shining-cell { box-shadow: 0 0 20px #ffeb3b inset; border-color: #ffeb3b; }
#jigane-buff-display { text-align: center; font-weight: bold; color: #ffeb3b; margin: 10px; min-height: 24px; font-size: 1.1em; }
.skill-btn.finish-btn { background: #4CAF50; border-color: #388E3C; font-weight: bold; width: 100%; margin-top: 10px; }
.import-box { background: #2a2a2a; border: 2px dashed #e09f3e; padding: 12px; border-radius: 6px; margin: 15px 0; text-align: center; }
`;
document.head.appendChild(style);

// ※ FOCUS_BY_LEVEL, EQUIP_LAYOUTS, SKILLS は data.js にあるためここでは宣言しません。
if (typeof window.RECIPES === "undefined") {
    window.RECIPES = []; // レシピが読み込めなかった場合の初期化
}

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 0;
let maxFocus = 0;
let playerLevel = 80;
let gridState = []; 
let history = []; 
let turnCount = 0;

let buffDouble = false, buffHalf = false, buffFocusHalf = false, buffFocusCrit = false;
let shiningCellIdx = -1;

let currentActionState = "idle";
let selectedSkill = null;
let multiHitQueue = [];
let multiHitResults = [];

let aiSession = null;
const CATEGORIES_ONNX = ["アタマ", "小盾", "大盾", "からだ上", "からだ下", "ウデ", "足"];
const JIGANE_TYPES_ONNX = ["普通", "集中変化", "光", "戻り", "倍半"];

const ACTION_NAMES = [
    "通常打ち(マスA)", "通常打ち(マスB)", "通常打ち(マスC)", "通常打ち(マスD)",
    "通常打ち(マスE)", "通常打ち(マスF)", "通常打ち(マスG)", "通常打ち(マスH)",
    "ねらい打ち(マスA)", "ねらい打ち(マスB)", "ねらい打ち(マスC)", "ねらい打ち(マスD)",
    "ねらい打ち(マスE)", "ねらい打ち(マスF)", "ねらい打ち(マスG)", "ねらい打ち(マスH)",
    "てかげん打ち", "2倍打ち", "3倍打ち", "上下打ち", "左右打ち", "ななめ打ち", "4連打ち", "超4連打ち", 
    "熱風おろし", "みだれ打ち", "火力上げ", "冷やし込み", "弱ねらい打ち", "しあげる"
];

async function initAiModel() {
    try {
        aiSession = await ort.InferenceSession.create('./blacksmith_ai.onnx');
        const aiBox = document.getElementById("ai-suggestion");
        if(aiBox) aiBox.innerHTML = "<div style='color:#4CAF50;'>🤖 ONNXモデル読込完了！</div>";
    } catch (e) {
        console.error(e);
        const aiBox = document.getElementById("ai-suggestion");
        if(aiBox) aiBox.innerHTML = "<div style='color:red;'>🤖 モデル読込失敗(ファイルがないか読めません)</div>";
    }
}

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

    setupImportUI();

    setTimeout(() => {
        renderRecipeList();
    }, 100);

    initAiModel();
});

function setupImportUI() {
    const recipeSection = document.getElementById("recipe-list");
    if (!recipeSection) return;
    
    const importBox = document.createElement("div");
    importBox.className = "import-box";
    importBox.innerHTML = `
        <label style="cursor: pointer; font-weight: bold; color: #e09f3e;">
            📂 レシピデータ(.json)を端末から読み込む
            <input type="file" id="json-file-input" accept=".json" style="display: none;">
        </label>
        <div style="font-size: 0.8em; color: #aaa; margin-top: 5px;">作成したレシピの json ファイルを選択してください</div>
    `;
    
    recipeSection.parentNode.insertBefore(importBox, recipeSection);

    document.getElementById("json-file-input").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    window.RECIPES = importedData;
                } else {
                    window.RECIPES = [importedData];
                }
                renderRecipeList();
                alert("レシピのインポートに成功しました！");
            } catch (err) {
                alert("JSONの読み込みに失敗しました。\nエラー: " + err.message);
            }
        };
        reader.readAsText(file);
    });
}

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    if (!listElement) return;
    listElement.innerHTML = ""; 
    
    if (!window.RECIPES || window.RECIPES.length === 0) {
        listElement.innerHTML = "<li style='color:#aaa;'>レシピデータがありません。上のボタンからJSONファイルを読み込んでください。</li>";
        return;
    }

    window.RECIPES.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> (${recipe.category} / 地金: ${recipe.jiganeType || recipe.jigane})`;
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
    document.getElementById("current-recipe-name").textContent = recipe.name;
    document.getElementById("display-jigane").textContent = `地金: ${recipe.jiganeType || recipe.jigane}`;
    
    playerLevel = 80;
    maxFocus = (typeof FOCUS_BY_LEVEL !== "undefined" ? FOCUS_BY_LEVEL[playerLevel] : 207) + 45; 
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
}

function renderGrid() {
    const gridContainer = document.getElementById("smithing-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    
    if (typeof EQUIP_LAYOUTS === "undefined") {
        alert("エラー: 装備レイアウトデータ(data.js)が見つかりません。");
        return;
    }

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
                cellIndex++;
            } else {
                wrapper.classList.add("blank");
            }
            
            wrapper.addEventListener("click", () => {
                if (currentActionState !== "skillSelected") { alert("先にスキルを選んでください。"); return; }
                handleGridClick(parseInt(wrapper.dataset.x), parseInt(wrapper.dataset.y));
            });
            gridContainer.appendChild(wrapper);
        }
    }
}

function getHitCoords(skillName, ox, oy, layout) {
    if (ox >= layout.w || oy >= layout.h) return null;
    let coords = [];
    if (["たたく", "2倍打ち", "3倍打ち", "てかげん打ち", "ねらい打ち", "弱ねらい打ち", "熱風おろし"].includes(skillName)) coords = [{x: ox, y: oy}];
    else if (skillName === "上下打ち") coords = [{x: ox, y: oy}, {x: ox, y: oy+1}];
    else if (skillName === "左右打ち") coords = [{x: ox, y: oy}, {x: ox+1, y: oy}];
    else if (skillName === "ななめ打ち") coords = [{x: ox+1, y: oy}, {x: ox, y: oy+1}];
    else if (["4連打ち", "超4連打ち"].includes(skillName)) coords = [{x: ox, y: oy}, {x: ox+1, y: oy}, {x: ox, y: oy+1}, {x: ox+1, y: oy+1}];
    return coords.filter(c => c.x < layout.w && c.y < layout.h);
}

function getHitCellsFromCoords(coords, layout) {
    if(!coords) return null;
    let cells = [];
    let cellIdx = 0;
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            if (layout.map[y * layout.w + x] === 1) {
                if (coords.some(c => c.x === x && c.y === y)) cells.push(cellIdx);
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
    
    if (typeof SKILLS === "undefined") return;

    SKILLS.forEach(skill => {
        if (playerLevel >= skill.req_lv) {
            const btn = document.createElement("button");
            btn.className = "skill-btn";
            let cost = skill.cost;
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
    document.getElementById("float-quick-input").classList.add("hidden");
    renderGrid();
    setupSkills();
}

function handleSkillSelect(skill) {
    let cost = skill.cost;
    if (currentFocus < cost) { alert("集中力が足りません"); return; }
    selectedSkill = { ...skill, actualCost: cost };
    
    if (skill.type === "temp") {
        if(confirm(`${skill.name} を実行しますか？`)) { currentFocus -= cost; currentTemp += skill.temp_change; checkJiganeTriggersAndEnd(); }
    } else if (skill.type === "finish") {
        if(confirm(`鍛冶を終了して「しあげる」を実行しますか？`)) executeFinish();
    } else if (skill.type === "random") {
        if(confirm(`${skill.name} を実行しますか？`)) {
            currentFocus -= cost;
            multiHitQueue = Array.from({length:4}, () => Math.floor(Math.random() * gridState.length));
            multiHitResults = [];
            showNextMiniPopup();
        }
    } else {
        currentActionState = "skillSelected";
        renderGrid(); 
    }
}

function handleGridClick(x, y) {
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    const coords = getHitCoords(selectedSkill.name, x, y, layout);
    const hitCells = getHitCellsFromCoords(coords, layout);
    
    if (!hitCells || hitCells.length === 0) { alert("その位置には打てません！"); return; }
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

function showNextMiniPopup() {
    if (multiHitQueue.length === 0) { finalizeMultiHit(); return; }
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
        let btn = document.createElement("button");
        btn.className = "float-btn crit-val";
        btn.textContent = dmg * 2;
        btn.addEventListener("click", () => recordCellResult(dmg * 2, true)); 
        btnGroupCrit.appendChild(btn);
    });
    floatUI.appendChild(btnGroupCrit);

    floatUI.classList.remove("hidden");
    const cell = document.getElementById(`forge-cell-${tIndex}`);
    if (cell) {
        const rect = cell.getBoundingClientRect();
        floatUI.style.left = `${rect.left + window.scrollX + (rect.width / 2)}px`;
        floatUI.style.top = `${rect.bottom + window.scrollY + 10}px`;
        floatUI.style.transform = "translate(-50%, 0)";
    }
}

function recordCellResult(val, isCrit) {
    const tIndex = multiHitQueue.shift(); 
    multiHitResults.push({ target: tIndex, value: val, isCrit: isCrit });
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
    currentTemp -= (selectedSkill.temp_drop || 50);
    checkJiganeTriggersAndEnd();
}

function getExactDamageDistribution(temp, mult) {
    const bMin = Math.floor(temp / 200) + 7 + (temp >= 1600 ? 1 : 0);
    const bMax = Math.floor(temp / 100) + 8 - (temp >= 2000 ? 1 : 0);
    let dist = [];
    for (let i = 0; i < 7; i++) dist.push(Math.round(bMin + (bMax - bMin) * (i / 6)));
    return [...new Set(dist.map(v => Math.floor(v * mult)))].sort((a,b)=>a-b);
}

function checkJiganeTriggersAndEnd() {
    turnCount++;
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
    alert(`鍛冶終了！(誤差スコア: ${errorSum.toFixed(1)})`);
    resetSelectionState();
}

async function calculateAI() {
    if (!aiSession) return;
    const aiBox = document.getElementById("ai-suggestion");
    if (aiBox) aiBox.innerHTML = "<div style='color:#00bcd4;'>🤖 AI推論中...</div>";

    const vals = [], mins = [], maxs = [];
    for (let i = 0; i < 8; i++) {
        if (i < currentRecipe.targets.length) {
            vals.push(gridState[i] ? gridState[i].value : 0);
            mins.push(currentRecipe.targets[i].min);
            maxs.push(currentRecipe.targets[i].max);
        } else { vals.push(0); mins.push(0); maxs.push(0); }
    }

    const catVec = CATEGORIES_ONNX.map(c => c === currentRecipe.category ? 1.0 : 0.0);
    const jiganeType = currentRecipe.jiganeType || currentRecipe.jigane;
    const jiganeVec = JIGANE_TYPES_ONNX.map(j => j === jiganeType ? 1.0 : 0.0);
    const buffVec = [0.0, 0.0, 0.0, 0.0, 0.0];
    const shineVec = Array.from({length: 8}, (_, i) => shiningCellIdx === i ? 1.0 : 0.0);

    const inputData = new Float32Array([...vals, ...mins, ...maxs, currentTemp, currentFocus, ...catVec, ...jiganeVec, ...buffVec, ...shineVec]);

    try {
        const tensor = new ort.Tensor('float32', inputData, [1, 51]);
        const results = await aiSession.run({ observation: tensor });
        const actionId = Number(results.action.data[0]);

        const actionName = ACTION_NAMES[actionId] || `不明(${actionId})`;
        if (aiBox) {
            aiBox.innerHTML = `<div style="font-size:1.1em; font-weight:bold; color:#00bcd4;">💡 ONNX推奨手: ${actionName}</div>`;
        }
    } catch (e) {
        console.error("推論エラー:", e);
        if (aiBox) aiBox.innerHTML = `<div style="color:red;">AIエラー: ${e.message}</div>`;
    }
}
