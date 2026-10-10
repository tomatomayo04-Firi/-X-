// ==========================================
// app.js - 高速ハイブリッド・スマート思考版
// ==========================================
const UPDATE_VERSION = "Ver 8.0 (高速ハイブリッド思考)";

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
.forge-cell { position: relative; }
.forge-cell.targeting { border-color: #00bcd4; box-shadow: 0 0 12px #00bcd4; cursor: pointer; }
.forge-cell.targeting:hover { background: rgba(0, 188, 212, 0.2); }
.forge-cell.ai-suggested { border-color: #ff4081; animation: pulse 1.5s infinite; }
.cell-lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; text-shadow: 0 0 5px #000; pointer-events: none; z-index: 10; }
@keyframes pulse { 0% { box-shadow: 0 0 5px #ff4081; } 50% { box-shadow: 0 0 15px #ff4081; } 100% { box-shadow: 0 0 5px #ff4081; } }
#action-guide { text-align: center; font-weight: bold; color: #00bcd4; margin-bottom: 10px; min-height: 20px; }
.skill-btn.finish-btn { background: #4CAF50; border-color: #388E3C; font-weight: bold; }
.skill-btn.finish-btn:hover { background: #66BB6A; }
`;
document.head.appendChild(style);

if (!SKILLS.find(s => s.name === "しあげる (完成)")) {
    SKILLS.push({ id: "しあげる", name: "しあげる (完成)", type: "finish", mult: 0, focus: 0, reqLevel: 1 });
}

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 0;
let maxFocus = 0;
let gridState = []; 
let history = []; 

let currentActionState = "idle";
let selectedSkill = null;
let aiSuggestedMove = null;

let multiHitQueue = [];
let multiHitResults = [];

document.addEventListener("DOMContentLoaded", async () => {
    const titleEl = document.querySelector("h1");
    if (titleEl) titleEl.textContent = `防具鍛冶ツール - ${UPDATE_VERSION}`;

    const floatUI = document.createElement("div");
    floatUI.id = "float-quick-input";
    floatUI.className = "hidden";
    document.body.appendChild(floatUI);

    try {
        await loadRecipeData();
        renderRecipeList();
        
        document.getElementById("filter-type").addEventListener("change", renderRecipeList);
        document.getElementById("filter-jigane").addEventListener("change", renderRecipeList);
        document.getElementById("filter-crystal").addEventListener("change", renderRecipeList);
        document.getElementById("btn-load-recipes").addEventListener("click", async () => {
            document.getElementById("recipe-list").innerHTML = '<li class="loading">再読み込み中...</li>';
            await loadRecipeData();
            renderRecipeList();
        });
        
        document.getElementById("btn-auto-execute").addEventListener("click", () => {
            if (!aiSuggestedMove || !aiSuggestedMove.skill) return;
            handleSkillSelect(aiSuggestedMove.skill);
            
            if (aiSuggestedMove.skill.type !== "temp" && aiSuggestedMove.skill.type !== "finish") {
                let target = Array.isArray(aiSuggestedMove.targets) ? aiSuggestedMove.targets[0] : aiSuggestedMove.targets;
                if (target !== undefined) {
                    setTimeout(() => handleCellClick(target, true), 10);
                }
            }
        });
    } catch (e) {
        document.getElementById("recipe-list").innerHTML = `<li style="color:red">エラー: ${e.message}</li>`;
    }
});

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    listElement.innerHTML = window.recipeLoadWarning || ""; 
    const filteredRecipes = RECIPES.filter(recipe => {
        const type = document.getElementById("filter-type").value;
        const jigane = document.getElementById("filter-jigane").value;
        const crystal = document.getElementById("filter-crystal").checked;
        if (type !== "all" && recipe.category !== type) return false;
        if (jigane !== "all" && recipe.jiganeType !== jigane) return false;
        if (crystal && !recipe.isCrystal) return false;
        return true;
    });

    if (filteredRecipes.length === 0) { listElement.innerHTML += "<li>レシピが見つかりません。</li>"; return; }
    filteredRecipes.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> <span class="recipe-meta">( ${recipe.category} / 装備Lv${recipe.equipLv} / 地金: ${recipe.jiganeType} )</span>`;
        li.addEventListener("click", () => startSmithing(recipe));
        listElement.appendChild(li);
    });
}

function startSmithing(recipe) {
    currentRecipe = recipe;
    document.getElementById("current-recipe-name").textContent = recipe.name;
    document.getElementById("display-jigane").textContent = `地金: ${recipe.jiganeType}`;
    currentTemp = 1000;
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    maxFocus = (FOCUS_BY_LEVEL[level] || 207) + 45; 
    currentFocus = maxFocus;
    
    gridState = [];
    recipe.targets.forEach(target => gridState.push({ value: 0, min: target.min, max: target.max, isLocked: false }));
    history = [];
    
    if(!document.getElementById("action-guide")) {
        const guide = document.createElement("div");
        guide.id = "action-guide";
        document.querySelector(".action-panel").prepend(guide);
    }
    
    resetSelectionState();
    updateStatusUI();
    renderGrid();
    setupSkills(level);
    
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
    gridContainer.innerHTML = "";
    const layout = EQUIP_LAYOUTS[currentRecipe.category] || { rows: 2, cols: 2, cells: ["A","B","C","D"] };
    gridContainer.style.gridTemplateColumns = `repeat(${layout.cols}, 60px)`;
    
    let targetIndex = 0;
    layout.cells.forEach((cellName) => {
        if (cellName === null) {
            gridContainer.appendChild(document.createElement("div"));
            return;
        }
        if (targetIndex >= gridState.length) return;
        
        const state = gridState[targetIndex];
        const cellDiv = document.createElement("div");
        cellDiv.className = "forge-cell";
        cellDiv.id = `forge-cell-${targetIndex}`;
        
        if (state.isLocked) {
            cellDiv.style.borderColor = "#ffeb3b";
            cellDiv.style.boxShadow = "0 0 10px #ffeb3b";
            cellDiv.innerHTML += `<div class="cell-lock-icon">🔒</div>`;
        } 
        if (currentActionState === "skillSelected" && !state.isLocked) cellDiv.classList.add("targeting");
        if (aiSuggestedMove && aiSuggestedMove.targets && aiSuggestedMove.targets.includes(targetIndex)) cellDiv.classList.add("ai-suggested");
        
        const absoluteMax = state.max * 1.2;
        const fillHeight = Math.min(100, (state.value / absoluteMax) * 100);
        const targetBottom = (state.min / absoluteMax) * 100;
        const targetHeight = ((state.max - state.min) / absoluteMax) * 100;
        
        cellDiv.innerHTML += `
            <div class="gauge-target-zone" style="bottom: ${targetBottom}%; height: ${targetHeight}%;"></div>
            <div class="gauge-fill" style="height: ${fillHeight}%; ${state.isLocked ? 'background: #ffeb3b;' : ''}"></div>
            <div class="gauge-text">${state.value}</div>
        `;
        
        let currentIndex = targetIndex;
        cellDiv.addEventListener("click", (e) => {
            if (state.isLocked) { alert("このマスは本会心でロックされています！"); return; }
            if (currentActionState === "skillSelected") handleCellClick(currentIndex, false, e);
            else alert("先にスキルを選んでください。");
        });
        gridContainer.appendChild(cellDiv);
        targetIndex++;
    });
}

function getMultiHitTargets(skillName, startIndex) {
    const layout = EQUIP_LAYOUTS[currentRecipe.category] || { rows: 2, cols: 2, cells: ["A","B","C","D"] };
    const cols = layout.cols;
    let targets = [startIndex];
    
    if (skillName === "上下打ち") {
        let down = startIndex + cols;
        if (down < gridState.length && layout.cells[down] !== null && !gridState[down].isLocked) targets.push(down);
    } else if (skillName === "左右打ち") {
        if ((startIndex % cols) !== (cols - 1)) {
            let right = startIndex + 1;
            if (right < gridState.length && layout.cells[right] !== null && !gridState[right].isLocked) targets.push(right);
        }
    } else if (skillName === "4連打ち" || skillName === "超4連打ち" || skillName === "ななめ打ち") {
        let right = startIndex + 1;
        let down = startIndex + cols;
        let downright = startIndex + cols + 1;
        if ((startIndex % cols) !== (cols - 1)) {
            if (right < gridState.length && layout.cells[right] !== null && !gridState[right].isLocked) targets.push(right);
            if (down < gridState.length && layout.cells[down] !== null && !gridState[down].isLocked) targets.push(down);
            if (downright < gridState.length && layout.cells[downright] !== null && !gridState[downright].isLocked) targets.push(downright);
        }
        if (skillName === "ななめ打ち") targets = [targets[0], targets[targets.length - 1]].filter(t => t !== undefined);
    }
    return [...new Set(targets)]; 
}

function setupSkills(level) {
    const skillList = document.getElementById("skill-list");
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        if (level >= skill.reqLevel) {
            const btn = document.createElement("button");
            btn.className = "skill-btn";
            if(skill.type === "finish") btn.classList.add("finish-btn");
            btn.textContent = skill.type === "finish" ? skill.name : `${skill.name} (${skill.focus})`;
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
    document.getElementById("modal-input").classList.add("hidden");
    renderGrid();
}

function handleSkillSelect(skill) {
    if (currentFocus < skill.focus) { alert("集中力が足りません"); return; }
    selectedSkill = skill;
    
    if (skill.type === "temp") {
        if(confirm(`${skill.name} を実行しますか？`)) executeTempSkill();
    } else if (skill.type === "finish") {
        if(confirm(`鍛冶を終了して「しあげる」を実行しますか？`)) {
            alert("お疲れ様でした！リセットして次の練習に進んでください。");
            resetSelectionState();
        }
    } else {
        currentActionState = "skillSelected";
        document.getElementById("action-guide").textContent = `🔽 【${skill.name}】を打つマスを選んでください`;
        renderGrid(); 
    }
}

function handleCellClick(targetIndex, isAuto = false, event = null) {
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    let targets = getMultiHitTargets(selectedSkill.name, targetIndex);
    if(targets.length === 0) return;
    
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState}));
    
    multiHitQueue = [...targets];
    multiHitResults = [];
    
    showNextMiniPopup();
}

function showNextMiniPopup() {
    if (multiHitQueue.length === 0) {
        finalizeMultiHit();
        return;
    }

    const tIndex = multiHitQueue[0];
    const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    
    const floatUI = document.getElementById("float-quick-input");
    floatUI.innerHTML = "";
    
    const dist = getDamageDistribution(currentTemp, selectedSkill.mult);

    let title = document.createElement("div");
    title.className = "float-title";
    title.textContent = `▶ マス[${cellLetters[tIndex]}] の結果`;
    floatUI.appendChild(title);

    let btnGroupNorm = document.createElement("div");
    btnGroupNorm.className = "float-btn-group";
    
    let displayDist = dist;
    if(selectedSkill.type === "random") {
        displayDist = getDamageDistribution(currentTemp, selectedSkill.mult);
    }
    
    displayDist.forEach(dmg => {
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
    displayDist.forEach(dmg => {
        let critDmg = dmg * 2;
        let btn = document.createElement("button");
        btn.className = "float-btn crit-val";
        btn.textContent = critDmg;
        btn.addEventListener("click", () => recordCellResult(critDmg, true)); 
        btnGroupCrit.appendChild(btn);
    });
    floatUI.appendChild(btnGroupCrit);

    let manualBtn = document.createElement("button");
    manualBtn.className = "float-btn manual-btn";
    manualBtn.innerHTML = "手入力 (選択肢にない場合)";
    manualBtn.addEventListener("click", () => {
        floatUI.classList.add("hidden");
        openSingleInputModal(tIndex); 
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
    
    document.querySelectorAll('.forge-cell').forEach(c => c.classList.remove('targeting'));
    cell.classList.add('targeting');
}

function recordCellResult(val, isCrit) {
    const tIndex = multiHitQueue.shift(); 
    multiHitResults.push({ target: tIndex, value: val, isCrit: isCrit });
    showNextMiniPopup(); 
}

function finalizeMultiHit() {
    currentFocus -= selectedSkill.focus;
    
    multiHitResults.forEach(res => {
        const startVal = gridState[res.target].value;
        gridState[res.target].value += res.value;
        const endVal = gridState[res.target].value;
        
        if (res.isCrit && endVal >= gridState[res.target].min && endVal <= gridState[res.target].max) {
            const probText = calcTrueCritProb(startVal, res.value, gridState[res.target].min, gridState[res.target].max, currentTemp, selectedSkill.mult);
            const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
            
            const isTrueCrit = confirm(`マス[${cellLetters[res.target]}]: 会心で成功ゾーンに入りました！\n\n【AI分析: ${probText}】\n\n特殊な演出（ピタリと止まる音や光）が出ましたか？\n・はい ＝ 本会心としてロック\n・いいえ ＝ 偽会心 (後から叩けます)`);
            if (isTrueCrit) gridState[res.target].isLocked = true;
        }
    });
    
    currentTemp -= (selectedSkill.specialTempDrop || 50);
    if (currentTemp < MIN_TEMP) currentTemp = MIN_TEMP;
    
    document.getElementById("float-quick-input").classList.add("hidden");
    updateStatusUI(); 
    resetSelectionState();
    calculateAI();
}

function executeTempSkill() {
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState}));
    currentFocus -= selectedSkill.focus;
    currentTemp += selectedSkill.tempChange;
    if (currentTemp < MIN_TEMP) currentTemp = MIN_TEMP;
    if (currentTemp > MAX_TEMP) currentTemp = MAX_TEMP;
    
    updateStatusUI(); 
    resetSelectionState();
    calculateAI();
}

function calcTrueCritProb(startVal, addedVal, minZ, maxZ, temp, mult) {
    if (addedVal % 2 !== 0) return "100%確定 (奇数ダメージのため)";
    const dist = getDamageDistribution(temp, mult);
    if(dist.length === 0) return "不明";
    const minCrit = dist[0] * 2;
    if (startVal + minCrit > maxZ) return "100%確定 (最小乱数でも枠を超えるため)";
    const maxCrit = dist[dist.length - 1] * 2;
    if (startVal + addedVal === startVal + maxCrit) return "偽会心の可能性大 (最大乱数と同じ数値)";
    return "約50% (偽会心のリスクあり)";
}

function openSingleInputModal(tIndex) {
    const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    document.getElementById("modal-skill-info").textContent = `マス[${cellLetters[tIndex]}] の手入力`;
    
    let cont = document.getElementById("numpad-inputs");
    if(!cont) {
        const oldInput = document.getElementById("manual-number-input");
        cont = document.createElement("div");
        cont.id = "numpad-inputs";
        oldInput.parentNode.insertBefore(cont, oldInput);
        oldInput.style.display = "none";
    }
    cont.innerHTML = `
        <div style="margin-bottom:10px;">
            <input type="number" id="manual-val-input" style="width:100px; font-size:1.5em; text-align:center; padding:5px;">
            <label style="color:#ffeb3b; font-weight:bold; margin-left:10px;"><input type="checkbox" id="manual-crit-check"> 会心</label>
        </div>
    `;
    document.getElementById("modal-input").classList.remove("hidden");
    const inputEl = document.getElementById("manual-val-input");
    setTimeout(() => inputEl.focus(), 10);
    window.currentActiveInput = inputEl;
}

document.getElementById("btn-cancel-input").addEventListener("click", () => {
    document.getElementById("modal-input").classList.add("hidden");
    showNextMiniPopup(); 
});

document.querySelectorAll(".num-key").forEach(key => {
    key.addEventListener("click", (e) => {
        const input = window.currentActiveInput;
        if (!input) return;
        if (e.target.classList.contains("clear")) input.value = "";
        else if (e.target.classList.contains("enter")) {
            let val = parseInt(input.value);
            if (isNaN(val)) { alert("数値を入力してください"); return; }
            let isCrit = document.getElementById("manual-crit-check").checked;
            document.getElementById("modal-input").classList.add("hidden");
            recordCellResult(val, isCrit);
        }
        else input.value += e.target.textContent;
    });
});

document.getElementById("btn-undo").addEventListener("click", () => {
    if (history.length === 0) return;
    const lastState = JSON.parse(history.pop());
    currentTemp = lastState.temp; currentFocus = lastState.focus; gridState = lastState.grid;
    updateStatusUI(); 
    resetSelectionState(); 
    calculateAI();
});

// ==========================================
// 高速ハイブリッド思考AI (ロールアウト評価導入)
// ==========================================
async function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "AI思考中... (高速計算中 ⚡)";
    aiSuggestedMove = null;

    await new Promise(resolve => setTimeout(resolve, 20));

    const bestMove = searchBestMoveFast(gridState, currentTemp, currentFocus);

    if (bestMove && bestMove.skill) {
        aiSuggestedMove = bestMove;
        
        if (bestMove.skill.type === "finish") {
            aiBox.innerHTML = `
                <div style="font-size:1.1em; margin-bottom:5px; color:#4CAF50;">💡 <strong>しあげる (完成にする)</strong></div>
                <div style="font-size:0.85em; color:#ccc; line-height:1.4;">
                【AI方針】 全マスが安全なゾーンに収まっています。これ以上叩くとはみ出します。<br>
                (評価スコア: ${Math.floor(bestMove.score)})
                </div>
            `;
        } else {
            const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
            let targetText = "全体";
            if (bestMove.targets && bestMove.targets.length > 0) {
                targetText = bestMove.targets.map(t => `[${cellLetters[t]}]`).join("");
            }
            aiBox.innerHTML = `
                <div style="font-size:1.1em; margin-bottom:5px;">💡 <strong>${bestMove.skill.name}</strong> を <strong>${targetText}</strong> に使用</div>
                <div style="font-size:0.85em; color:#ccc; line-height:1.4;">
                【AI方針】 目標温度: ${bestMove.optimalTemp}℃ <br>
                (評価スコア: ${Math.floor(bestMove.score)})
                </div>
            `;
            renderGrid(); 
        }
    } else {
        aiBox.innerHTML = `おすすめの手が見つかりません。`;
    }
}

function searchBestMoveFast(state, temp, focus) {
    let bestSkill = null; 
    let bestTargets = []; 
    let bestScore = -Infinity;
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    const jigane = currentRecipe.jiganeType;
    let critRateBase = document.getElementById("has-kotsu").checked ? 0.02 : 0.01;
    critRateBase += 0.046; 

    let maxShortfall = 0;
    state.forEach(s => {
        if (!s.isLocked && s.value < s.min) {
            maxShortfall = Math.max(maxShortfall, s.min - s.value);
        }
    });
    
    // メタスラ等は1300度、高レベルは1600度などを自動割り当て
    let optimalTemp = 1000;
    if (jigane === "光") optimalTemp = 2000;
    else if (maxShortfall > 150) optimalTemp = 1600;
    else if (maxShortfall > 80) optimalTemp = 1300;
    else optimalTemp = 1000;

    let isAlreadyCoolingDown = false;
    if (history.length > 0) {
        let maxTempInHistory = Math.max(...history.map(h => JSON.parse(h).temp), currentTemp);
        if (maxTempInHistory - temp >= 80) isAlreadyCoolingDown = true;
    }

    // 「しあげる」の判定：すべての未ロックマスが成功ゾーン内なら非常に高いスコアを与える
    let allInZone = true;
    let hasUnlocked = false;
    state.forEach(s => {
        if (!s.isLocked) {
            hasUnlocked = true;
            if (s.value < s.min || s.value > s.max) allInZone = false;
        }
    });

    SKILLS.forEach(skill => {
        if (level < skill.reqLevel || focus < skill.focus) return;

        if (skill.name === "火力上げ" && (temp >= optimalTemp || isAlreadyCoolingDown)) return;
        if (skill.name === "冷やし込み" && (temp <= 1000 || maxShortfall > 50)) return;

        if (skill.type === "finish") {
            if (hasUnlocked && allInZone) {
                let finishScore = 999999;
                if (finishScore > bestScore) {
                    bestScore = finishScore;
                    bestSkill = skill;
                    bestTargets = [];
                }
            }
            return;
        }

        let startIndices = [0];
        if (skill.type !== "temp" && skill.type !== "random") {
            startIndices = [];
            state.forEach((s, i) => { if (!s.isLocked && s.value < s.max) startIndices.push(i); });
        }

        startIndices.forEach(startIndex => {
            let targets = skill.type === "temp" ? [] : getMultiHitTargets(skill.name, startIndex);
            let expectedScore = 0;
            const nextFocus = focus - skill.focus;
            
            if (skill.type === "temp") {
                let nextTemp = Math.min(MAX_TEMP, Math.max(MIN_TEMP, temp + skill.tempChange));
                // 2手先以降はざっくりとした評価関数（ロールアウト評価）で一発計算
                expectedScore = evaluateBoardStateFast(state, nextTemp, nextFocus, optimalTemp);
                expectedScore -= 500; // 無駄な温度変更への軽いペナルティ
            } else if (skill.type === "random") {
                const dist = getDamageDistribution(temp, skill.mult);
                if (dist.length > 0) {
                    let emptyCells = [];
                    state.forEach((s, i) => { if (!s.isLocked && s.value < s.max) emptyCells.push(i); });
                    if (emptyCells.length > 0) {
                        let avgDmg = ((dist[0] + dist[dist.length-1]) / 2) * (4 / emptyCells.length);
                        let nextState = JSON.parse(JSON.stringify(state));
                        emptyCells.forEach(t => nextState[t].value += avgDmg);
                        expectedScore = evaluateBoardStateFast(nextState, temp - 50, nextFocus, optimalTemp);
                    }
                }
            } else {
                const dist = getDamageDistribution(temp, skill.mult);
                if (dist.length === 0) return;

                let currentCritRate = critRateBase;
                if (skill.isCritUp) currentCritRate += (0.046 * 6); 

                // 通常時と会心時の期待値を1発で合成計算
                let avgDamage = (dist[0] + dist[dist.length - 1]) / 2;
                let tempDrop = skill.specialTempDrop || 50;

                let nextStateNorm = JSON.parse(JSON.stringify(state));
                targets.forEach(t => nextStateNorm[t].value += avgDamage);
                let scoreNorm = evaluateBoardStateFast(nextStateNorm, temp - tempDrop, nextFocus, optimalTemp);

                let nextStateCrit = JSON.parse(JSON.stringify(state));
                targets.forEach(t => {
                    let newValue = nextStateCrit[t].value + (avgDamage * 2);
                    let center = (nextStateCrit[t].min + nextStateCrit[t].max) / 2;
                    if (newValue >= center) nextStateCrit[t].isLocked = true;
                    else nextStateCrit[t].value = newValue;
                });
                let scoreCrit = evaluateBoardStateFast(nextStateCrit, temp - tempDrop, nextFocus, optimalTemp);

                expectedScore = (scoreNorm * (1 - currentCritRate)) + (scoreCrit * currentCritRate);
            }

            if (expectedScore > bestScore) {
                bestScore = expectedScore; 
                bestSkill = skill; 
                bestTargets = targets;
            }
        });
    });

    return { skill: bestSkill, targets: bestTargets, score: bestScore, optimalTemp: optimalTemp };
}

function evaluateBoardStateFast(state, currentTemp, currentFocus, optimalTemp) {
    let score = 0;
    let isAllDone = true;
    
    state.forEach(s => {
        if (s.isLocked) {
            score += 50000; 
        } else if (s.value > s.max) {
            score -= 20000; // はみ出しペナルティ
            isAllDone = false;
        } else if (s.value >= s.min && s.value <= s.max) {
            score += 20000; 
            const center = (s.min + s.max) / 2;
            score -= Math.abs(s.value - center) * 5;
        } else {
            isAllDone = false;
            let shortfall = s.min - s.value;
            score -= shortfall * 30;
        }
    });

    if (isAllDone) score += 200000; 
    score -= Math.abs(currentTemp - optimalTemp) * 10;
    score += currentFocus * 50; // 集中力も加味
    return score;
}
