// ==========================================
// app.js - Ver 12.0 (完全仕様・DQXガチシミュレータ版)
// ==========================================
const UPDATE_VERSION = "Ver 12.0 (完全仕様対応・DQXガチシミュレータ)";

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

/* グリッドレイアウト用 */
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

// -------------------------
// 定数・マスタデータ定義
// -------------------------
const FOCUS_BY_LEVEL = {
    75: 197, 76: 199, 77: 201, 78: 203, 79: 205, 80: 207
};

// 0: 空白マス, 1: 叩けるマス
const EQUIP_LAYOUTS = {
    "アタマ":   { w: 2, h: 2, map: [1,1, 1,1] },
    "小盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "大盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ上": { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ下": { w: 2, h: 4, map: [1,1, 1,1, 1,1, 1,1] },
    "ウデ":     { w: 1, h: 3, map: [1, 1, 1] },
    "足":       { w: 2, h: 3, map: [0,1, 0,1, 1,1] } // 上段右, 中段右, 下段左, 下段右
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

// -------------------------
// 状態変数
// -------------------------
let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 0;
let maxFocus = 0;
let playerLevel = 80;
let gridState = []; // 実在するマスのみの配列
let history = []; 
let turnCount = 0;

// バフ状態
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

// AI用
let currentAiCalcId = 0;
let lastYieldTime = 0;

// -------------------------
// 初期化処理
// -------------------------
document.addEventListener("DOMContentLoaded", async () => {
    const titleEl = document.querySelector("h1");
    if (titleEl) titleEl.textContent = `防具鍛冶ツール - ${UPDATE_VERSION}`;

    const floatUI = document.createElement("div");
    floatUI.id = "float-quick-input";
    floatUI.className = "hidden";
    document.body.appendChild(floatUI);

    // バフ表示用の要素を追加
    if(!document.getElementById("jigane-buff-display")) {
        const buffDiv = document.createElement("div");
        buffDiv.id = "jigane-buff-display";
        document.querySelector(".action-panel").prepend(buffDiv);
    }

    // レベル選択UIの挿入（無ければ）
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

    try {
        await loadRecipeData();
        renderRecipeList();
        document.getElementById("btn-load-recipes").addEventListener("click", () => {
            renderRecipeList();
        });
    } catch (e) {
        document.getElementById("recipe-list").innerHTML = `<li style="color:red">エラー: レシピの読み込みに失敗しました。</li>`;
    }
});

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    listElement.innerHTML = ""; 
    RECIPES.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> ( ${recipe.category} / 地金: ${recipe.jiganeType} )`;
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

// -------------------------
// 新グリッド描画システム
// -------------------------
function renderGrid() {
    const gridContainer = document.getElementById("smithing-grid");
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
            
            wrapper.addEventListener("click", (e) => {
                if (currentActionState !== "skillSelected") {
                    alert("先にスキルを選んでください。"); return;
                }
                handleGridClick(parseInt(wrapper.dataset.x), parseInt(wrapper.dataset.y));
            });

            // ホバー時のターゲティング表示
            wrapper.addEventListener("mouseenter", () => {
                if (currentActionState === "skillSelected" && selectedSkill) {
                    document.querySelectorAll('.forge-cell-container').forEach(c => c.classList.remove('targeting'));
                    const coords = getHitCoords(selectedSkill.name, x, y, layout);
                    if (coords) {
                        coords.forEach(c => {
                            const targetWrapper = document.querySelector(`.forge-cell-container[data-x="${c.x}"][data-y="${c.y}"]`);
                            if (targetWrapper) targetWrapper.classList.add('targeting');
                        });
                    }
                }
            });
            wrapper.addEventListener("mouseleave", () => {
                document.querySelectorAll('.forge-cell-container').forEach(c => c.classList.remove('targeting'));
            });

            gridContainer.appendChild(wrapper);
        }
    }
}

// カーソル枠の取得（はみ出し厳格チェック）
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
        // 右上(ox+1, oy) と 左下(ox, oy+1) のみ許可
        if (ox + 1 >= layout.w || oy + 1 >= layout.h) return null;
        coords = [{x: ox+1, y: oy}, {x: ox, y: oy+1}];
    } else if (["4連打ち", "超4連打ち"].includes(skillName)) {
        if (ox + 1 >= layout.w || oy + 1 >= layout.h) return null;
        coords = [{x: ox, y: oy}, {x: ox+1, y: oy}, {x: ox, y: oy+1}, {x: ox+1, y: oy+1}];
    } else {
        return []; // みだれ打ちなどはUIでクリック不要なので後処理
    }
    return coords;
}

// Coordsから実在するセルのインデックスを取得
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
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        if (playerLevel >= skill.reqLevel) {
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
    document.getElementById("action-guide").textContent = "";
    document.getElementById("float-quick-input").classList.add("hidden");
    renderGrid();
    setupSkills();
}

function abortAICalculation() {
    currentAiCalcId++;
    const aiBox = document.getElementById("ai-suggestion");
    if (aiBox && aiBox.textContent.includes("AI思考中")) {
        aiBox.textContent = "手動操作を検知したため、AI予測を中断しました。";
    }
}

function handleSkillSelect(skill) {
    abortAICalculation(); 

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
        document.getElementById("action-guide").textContent = `🔽 【${skill.name}】の起点（左上枠）を選んでください`;
        renderGrid(); 
    }
}

function handleGridClick(x, y) {
    abortAICalculation(); 
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    const coords = getHitCoords(selectedSkill.name, x, y, layout);
    const hitCells = getHitCellsFromCoords(coords, layout);
    
    // はみ出し、または実在するマスが1つも無い場合は無効
    if (hitCells === null || hitCells.length === 0) {
        alert("その位置には打てません！（枠がはみ出しているか、対象マスがありません）");
        return;
    }
    
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState, turn: turnCount, buffD: buffDouble, buffH: buffHalf, buffFH: buffFocusHalf, buffFC: buffFocusCrit, shine: shiningCellIdx}));
    
    // ロックされていないマスだけをキューに追加
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
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState, turn: turnCount, buffD: buffDouble, buffH: buffHalf, buffFH: buffFocusHalf, buffFC: buffFocusCrit, shine: shiningCellIdx}));
    currentFocus -= selectedSkill.actualCost;
    currentTemp += selectedSkill.tempChange;
    checkJiganeTriggersAndEnd(0);
}

function executeRandomSkill() {
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState, turn: turnCount, buffD: buffDouble, buffH: buffHalf, buffFH: buffFocusHalf, buffFC: buffFocusCrit, shine: shiningCellIdx}));
    currentFocus -= selectedSkill.actualCost;
    
    // 完全にランダムに4回選ぶ（ロックされているマスにも吸われる）
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
    // ロック済マスにみだれうちが吸われた場合はスキップ処理（ダメージ0）
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

    // 手入力
    let manualBtn = document.createElement("button");
    manualBtn.className = "float-btn manual-btn";
    manualBtn.innerHTML = "手入力 (選択肢にない場合)";
    manualBtn.addEventListener("click", () => {
        floatUI.innerHTML = `
            <div style="margin-bottom:10px; text-align:center;">
                <input type="number" id="manual-val-input" style="width:80px; font-size:1.2em; text-align:center; padding:5px;">
                <label style="color:#ffeb3b; font-weight:bold; margin-left:10px;"><input type="checkbox" id="manual-crit-check"> 会心</label>
            </div>
            <button id="btn-manual-enter" class="float-btn" style="width:100%">決定</button>
        `;
        document.getElementById("btn-manual-enter").addEventListener("click", () => {
            let val = parseInt(document.getElementById("manual-val-input").value);
            let isCrit = document.getElementById("manual-crit-check").checked;
            if(!isNaN(val)) recordCellResult(val, isCrit);
        });
    });
    floatUI.appendChild(manualBtn);

    floatUI.classList.remove("hidden");
    const cell = document.getElementById(`forge-cell-${tIndex}`);
    const rect = cell.getBoundingClientRect();
    
    let x = rect.left + window.scrollX + (rect.width / 2);
    let y = (rect.top < 250) ? (rect.bottom + window.scrollY + 10) : (rect.top + window.scrollY - 10);
    floatUI.style.transform = (rect.top < 250) ? "translate(-50%, 0)" : "translate(-50%, -100%)";
    floatUI.style.left = `${x}px`;
    floatUI.style.top = `${y}px`;
    
    document.querySelectorAll('.forge-cell-container').forEach(c => c.classList.remove('targeting'));
    cell.parentElement.classList.add('targeting');
}

function recordCellResult(val, isCrit) {
    const tIndex = multiHitQueue.shift(); 
    multiHitResults.push({ target: tIndex, value: val, isCrit: isCrit });
    if(shiningCellIdx === tIndex) shiningCellIdx = -1; // 光消費
    showNextMiniPopup(); 
}

function finalizeMultiHit() {
    if (selectedSkill.type !== "random") currentFocus -= selectedSkill.actualCost;
    
    multiHitResults.forEach(res => {
        if(res.value === 0) return; // ロック被弾
        gridState[res.target].value += res.value;
        const endVal = gridState[res.target].value;
        
        if (res.isCrit && endVal >= gridState[res.target].min && endVal <= gridState[res.target].max) {
            const isTrueCrit = confirm(`マス[${res.target+1}]: 会心で成功ゾーンに入りました！\n特殊な演出（ピタリと止まる音や光）が出ましたか？\n・はい ＝ 本会心としてロック\n・いいえ ＝ 偽会心`);
            if (isTrueCrit) gridState[res.target].isLocked = true;
        }
    });
    
    document.getElementById("float-quick-input").classList.add("hidden");
    const tempDrop = selectedSkill.temp_drop || 50;
    currentTemp -= tempDrop;
    
    checkJiganeTriggersAndEnd(tempDrop);
}

// -------------------------
// ダメージ分布計算 (DQX近似)
// -------------------------
function getExactDamageDistribution(temp, mult) {
    const bMin = Math.floor(temp / 200) + 7 + (temp >= 1600 ? 1 : 0);
    const bMax = Math.floor(temp / 100) + 8 - (temp >= 2000 ? 1 : 0);
    let dist = [];
    for (let i = 0; i < 7; i++) {
        dist.push(Math.round(bMin + (bMax - bMin) * (i / 6)));
    }
    return [...new Set(dist.map(v => Math.floor(v * mult)))].sort((a,b)=>a-b);
}

// -------------------------
// 地金トリガー判定と終了判定
// -------------------------
function checkJiganeTriggersAndEnd(tempDrop) {
    turnCount++;
    buffDouble = false; buffHalf = false; buffFocusHalf = false; buffFocusCrit = false;
    
    if (currentTemp <= 0) {
        executeFinish();
        return;
    }
    
    // 一気に通り越した場合は発動しない仕様
    if (currentTemp % 200 === 0 && tempDrop > 0) {
        const j = currentRecipe.jiganeType;
        if (j === "戻り") {
            let valid = gridState.map((s, i) => ({s, i})).filter(x => x.s.value > 0 && !(x.s.min <= x.s.value && x.s.value <= x.s.max));
            if (valid.length > 0) {
                // はみ出ている場所優先
                let over = valid.filter(x => x.s.value > x.s.max);
                let targets = over.length > 0 ? over : valid;
                let maxVal = Math.max(...targets.map(x => x.s.value));
                let candidates = targets.filter(x => x.s.value === maxVal);
                let target = candidates[Math.floor(Math.random() * candidates.length)];
                let ret = Math.floor(Math.random() * 5) + 12; // 12~16
                alert(`【戻り地金 発動】マス[${target.i+1}] が ${ret} 戻りました！`);
                gridState[target.i].value = Math.max(0, gridState[target.i].value - ret);
            }
        } else if (j === "倍半") {
            if (currentTemp % 400 === 0) buffDouble = true;
            else buffHalf = true;
        } else if (j === "集中変化") {
            if (currentTemp % 400 === 0) buffFocusCrit = true;
            else buffFocusHalf = true;
        } else if (j === "光") {
            let valid = gridState.map((s, i) => ({s, i})).filter(x => x.s.value < x.s.min);
            if (valid.length > 0) {
                shiningCellIdx = valid[Math.floor(Math.random() * valid.length)].i;
            }
        }
    }
    
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
    
    alert(`鍛冶終了！結果: ${result}\n(合計誤差スコア: ${errorSum.toFixed(1)})`);
    resetSelectionState();
}

// -------------------------
// 高速概算AI (Ver 12.0)
// -------------------------
async function calculateAI() {
    currentAiCalcId++;
    const myCalcId = currentAiCalcId;
    lastYieldTime = Date.now();

    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "AI思考中... ⚡";
    aiSuggestedMove = null;
    await new Promise(resolve => setTimeout(resolve, 10)); 
    
    // AI目標温度の設定
    let maxShortfall = 0;
    gridState.forEach(s => {
        if (s.value < s.min) maxShortfall = Math.max(maxShortfall, s.min - s.value);
    });
    let optimalTemp = currentRecipe.jiganeType === "光" ? 2000 : (maxShortfall > 220 ? 1600 : (maxShortfall > 90 ? 1300 : 1000));
    
    let isCooling = false;
    if (history.length > 0) {
        let maxTempInHistory = Math.max(...history.map(h => JSON.parse(h).temp), currentTemp);
        if (maxTempInHistory - currentTemp >= 100) isCooling = true;
    }

    // 全合法手の生成（グリッド指定を全て展開）
    let legalMoves = [];
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    
    let allInZone = true, hasUnlocked = false;
    gridState.forEach(s => {
        if (!s.isLocked) {
            hasUnlocked = true;
            if (s.value < s.min || s.value > s.max) allInZone = false;
        }
    });
    if (hasUnlocked && allInZone) legalMoves.push({ skill: SKILLS.find(s=>s.type==="finish"), ox: 0, oy: 0, cells: [] });
    
    SKILLS.forEach(skill => {
        if (skill.type === "finish" || playerLevel < skill.req_lv) return;
        if (skill.name === "火力上げ" && (currentTemp >= optimalTemp || isCooling)) return;
        if (skill.name === "冷やし込み" && currentTemp <= 1000) return;
        
        let cost = skill.cost;
        if (buffFocusHalf) cost = Math.max(1, Math.floor(cost / 2));
        else if (buffFocusCrit && skill.type !== "finish") cost = Math.floor(cost * 1.5);
        if (currentFocus < cost) return;

        if (skill.type === "temp" || skill.type === "random") {
            legalMoves.push({ skill, ox: 0, oy: 0, cells: [] });
        } else {
            for (let y = 0; y < layout.h; y++) {
                for (let x = 0; x < layout.w; x++) {
                    const coords = getHitCoords(skill.name, x, y, layout);
                    const hitCells = getHitCellsFromCoords(coords, layout);
                    if (hitCells && hitCells.length > 0) {
                        legalMoves.push({ skill, ox: x, oy: y, cells: hitCells });
                    }
                }
            }
        }
    });

    let bestMove = null;
    let bestScore = -Infinity;

    try {
        for (let move of legalMoves) {
            if (currentAiCalcId !== myCalcId) return; 
            let score = await evalMoveApprox(move, gridState, currentTemp, currentFocus, optimalTemp, 4, myCalcId);
            if (score > bestScore) { bestScore = score; bestMove = move; }
        }
    } catch (e) {
        if (e.message === "AI_CANCELLED") return; throw e;
    }

    if (currentAiCalcId !== myCalcId) return; 

    if (bestMove && bestMove.skill) {
        aiSuggestedMove = bestMove;
        let targetText = bestMove.cells.length > 0 ? `(マス ${bestMove.cells.map(i=>i+1).join(",")})` : "";
        if(bestMove.skill.type === "temp" || bestMove.skill.type === "random") targetText = "(全体)";
        
        aiBox.innerHTML = `
            <div style="font-size:1.1em; font-weight:bold; color:#00bcd4; margin-bottom:5px;">
                💡 おすすめ手: ${bestMove.skill.name} ${targetText}
            </div>
            <div style="font-size:0.85em; color:#ddd; line-height:1.4; background:rgba(0,0,0,0.3); padding:8px; border-radius:4px;">
                <strong>【AI方針】</strong> 予測期待値が最も高い行動です。<br>
                ※AIは誤差合計（星3判定）を最小化するよう計算しています。
            </div>
        `;
        renderGrid(); 
    } else {
        aiBox.innerHTML = `おすすめの手が見つかりません。`;
    }
}

async function evalMoveApprox(move, state, temp, focus, optTemp, depth, myCalcId) {
    if (Date.now() - lastYieldTime > 16) { await new Promise(r => setTimeout(r, 0)); lastYieldTime = Date.now(); }
    if (currentAiCalcId !== myCalcId) throw new Error("AI_CANCELLED");

    let cost = move.skill.cost;
    if (buffFocusHalf) cost = Math.max(1, Math.floor(cost / 2));
    else if (buffFocusCrit && move.skill.type !== "finish") cost = Math.floor(cost * 1.5);

    let nextFocus = focus - cost;
    if (move.skill.type === 'finish') return evalState(state, temp, nextFocus, optTemp);
    if (move.skill.type === 'temp') return evalState(state, temp + move.skill.temp_change, nextFocus, optTemp) - 500;
    
    let dist = getExactDamageDistribution(temp, move.skill.mult);
    if (dist.length === 0) return -999999;
    
    let avgDmg = (dist[0] + dist[dist.length - 1]) / 2;
    let critRate = 0.062;
    if (move.skill.crit_up) critRate += 0.372;
    if (buffFocusCrit) critRate += 0.310;
    let expectedDmg = avgDmg * (1 + critRate);
    
    let nextState = state.map(s => ({ value: s.value, min: s.min, max: s.max, isLocked: s.isLocked }));
    
    if (move.skill.type === 'random') {
        let hitPerCell = 4 / state.length;
        nextState.forEach((s, i) => { if (!s.isLocked) s.value += (expectedDmg * hitPerCell); });
    } else {
        move.cells.forEach(idx => {
            if (!nextState[idx].isLocked) {
                let m = expectedDmg;
                if (buffDouble) m *= 2;
                if (buffHalf) m *= 0.5;
                if (shiningCellIdx === idx) m *= 2.0;
                nextState[idx].value += m;
            }
        });
    }
    
    return evalState(nextState, Math.max(0, temp - (move.skill.temp_drop || 50)), nextFocus, optTemp);
}

function evalState(state, temp, focus, optTemp) {
    let score = 0, allDone = true;
    state.forEach(s => {
        let center = (s.min + s.max) / 2.0;
        if (s.isLocked) score += 100000;
        else if (s.value > s.max) { score -= 30000; allDone = false; }
        else if (s.min <= s.value && s.value <= s.max) { score += 30000 - Math.abs(s.value - center)*10; }
        else { allDone = false; score -= (s.min - s.value)*50; if (s.value+30 > s.max) score -= 1500; }
    });
    if (allDone) score += 500000;
    return score - Math.abs(temp - optTemp)*15 + focus*150;
}
