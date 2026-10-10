// ==========================================
// app.js - 本格AI ＆ メイン処理 (ループ撲滅・本会心判定版)
// ==========================================

const style = document.createElement("style");
style.innerHTML = `
#float-quick-input { position: absolute; background: rgba(30,30,30,0.98); border: 2px solid #e09f3e; border-radius: 8px; padding: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; gap: 5px; width: 220px; transition: opacity 0.2s; pointer-events: auto; }
#float-quick-input.hidden { display: none; opacity: 0; pointer-events: none; }
.float-title { font-size: 0.85em; color: #ddd; text-align: center; margin-bottom: 2px; border-bottom: 1px solid #555; padding-bottom: 3px; }
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
`;
document.head.appendChild(style);

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 0;
let maxFocus = 0;
let gridState = []; 
let history = []; 

let currentActionState = "idle";
let selectedSkill = null;
let activeTargets = [];
let aiSuggestedMove = null;

// ==========================================
// 初期化・イベント
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
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
            
            if (aiSuggestedMove.skill.type !== "temp") {
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
            // ロック表示アイコン
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
            if (state.isLocked) {
                alert("このマスは本会心でロックされているため叩けません！");
                return;
            }
            if (currentActionState === "skillSelected") {
                handleCellClick(currentIndex, false, e);
            } else {
                alert("先に下のリストからスキルを選んでください。");
            }
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
            btn.textContent = `${skill.name} (${skill.focus})`;
            btn.addEventListener("click", () => handleSkillSelect(skill));
            skillList.appendChild(btn);
        }
    });
}

function resetSelectionState() {
    currentActionState = "idle";
    selectedSkill = null;
    activeTargets = [];
    document.getElementById("action-guide").textContent = "";
    document.getElementById("float-quick-input").classList.add("hidden");
    renderGrid();
}

function handleSkillSelect(skill) {
    if (currentFocus < skill.focus) { alert("集中力が足りません"); return; }
    selectedSkill = skill;
    
    if (skill.type === "temp") {
        if(confirm(`${skill.name} を実行しますか？`)) executeTempSkill();
    } else {
        currentActionState = "skillSelected";
        document.getElementById("action-guide").textContent = `🔽 【${skill.name}】を打つマスを選んでください`;
        renderGrid(); 
    }
}

// --- 🎯 マスタップ時のUI (はみ出し対応版) ---
function handleCellClick(targetIndex, isAuto = false, event = null) {
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    activeTargets = getMultiHitTargets(selectedSkill.name, targetIndex);
    if(activeTargets.length === 0) return;
    
    const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const targetText = activeTargets.map(t => cellLetters[t]).join("・");
    document.getElementById("action-guide").textContent = `【${selectedSkill.name}】 対象: [${targetText}]`;

    const floatUI = document.getElementById("float-quick-input");
    floatUI.innerHTML = "";
    
    const dist = getDamageDistribution(currentTemp, selectedSkill.mult);

    // ① 通常ヒット枠
    let titleNorm = document.createElement("div");
    titleNorm.className = "float-title";
    titleNorm.textContent = "通常ヒット";
    floatUI.appendChild(titleNorm);

    let btnGroupNorm = document.createElement("div");
    btnGroupNorm.className = "float-btn-group";
    dist.forEach(dmg => {
        let btn = document.createElement("button");
        btn.className = "float-btn";
        btn.textContent = dmg;
        btn.addEventListener("click", () => executeHitSkill(dmg, false)); 
        btnGroupNorm.appendChild(btn);
    });
    floatUI.appendChild(btnGroupNorm);

    // ② 会心ヒット枠
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
        btn.addEventListener("click", () => executeHitSkill(critDmg, true)); 
        btnGroupCrit.appendChild(btn);
    });
    floatUI.appendChild(btnGroupCrit);

    // ③ 手入力ボタン
    let manualBtn = document.createElement("button");
    manualBtn.className = "float-btn manual-btn";
    manualBtn.innerHTML = "手入力 (選択肢にない場合)";
    manualBtn.addEventListener("click", () => {
        floatUI.classList.add("hidden");
        openFullInputModal(); 
    });
    floatUI.appendChild(manualBtn);

    floatUI.classList.remove("hidden");

    // ★ ポップアップの表示位置自動調整 ★
    const cell = document.getElementById(`forge-cell-${targetIndex}`);
    const rect = cell.getBoundingClientRect();
    
    let x = rect.left + window.scrollX + (rect.width / 2);
    let y = 0;

    // マスが画面上部に近すぎる場合は「下」に出す
    if (rect.top < 250) {
        y = rect.bottom + window.scrollY + 10;
        floatUI.style.transform = "translate(-50%, 0)"; 
    } else {
        // 通常は「上」に出す
        y = rect.top + window.scrollY - 10;
        floatUI.style.transform = "translate(-50%, -100%)";
    }
    
    floatUI.style.left = `${x}px`;
    floatUI.style.top = `${y}px`;
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

// ★ 本会心・偽会心を見極める処理 ★
function executeHitSkill(actualDamage, isCrit) {
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState}));
    currentFocus -= selectedSkill.focus;
    
    activeTargets.forEach(t => {
        gridState[t].value += actualDamage; 
        
        // 会心でかつ成功ゾーンに収まった場合
        if (isCrit && gridState[t].value >= gridState[t].min && gridState[t].value <= gridState[t].max) {
            // 本会心のピタリ演出が出たかユーザーに確認する
            const isTrueCrit = confirm(`【本会心確認】\n特殊な演出（ピタリと止まる音や光）が出ましたか？\n\n・はい ＝ 本会心 (マスをロックします)\n・いいえ ＝ 偽会心 (後から叩けます)`);
            
            if (isTrueCrit) {
                gridState[t].isLocked = true;
            }
        }
    });
    
    currentTemp -= (selectedSkill.specialTempDrop || 50);
    if (currentTemp < MIN_TEMP) currentTemp = MIN_TEMP;
    
    updateStatusUI(); 
    resetSelectionState();
    calculateAI();
}

// --- 手入力用フルモーダル ---
function openFullInputModal() {
    document.getElementById("modal-skill-info").textContent = `${selectedSkill.name} (詳細入力)`;
    document.getElementById("manual-number-input").value = "";
    document.getElementById("check-critical").checked = false;
    
    const container = document.getElementById("numpad-inputs");
    if(!container) {
        const oldInput = document.getElementById("manual-number-input");
        const cont = document.createElement("div");
        cont.id = "numpad-inputs";
        cont.style.display = "flex"; cont.style.gap = "5px"; cont.style.marginBottom = "10px";
        oldInput.parentNode.insertBefore(cont, oldInput);
        oldInput.remove();
    }
    const cont = document.getElementById("numpad-inputs");
    cont.innerHTML = "";
    
    const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    activeTargets.forEach((tIndex, i) => {
        const wrap = document.createElement("div"); wrap.style.flex = "1";
        const label = document.createElement("div"); label.textContent = cellLetters[tIndex]; label.style.fontSize = "0.8em";
        const input = document.createElement("input");
        input.type = "number"; input.className = "multi-number-input"; input.id = `input-val-${i}`;
        input.addEventListener("focus", () => window.currentActiveInput = input);
        wrap.appendChild(label); wrap.appendChild(input);
        cont.appendChild(wrap);
        if (i === 0) { setTimeout(() => input.focus(), 10); window.currentActiveInput = input; }
    });
    document.getElementById("modal-input").classList.remove("hidden");
}

document.getElementById("btn-cancel-input").addEventListener("click", () => document.getElementById("modal-input").classList.add("hidden"));
document.querySelectorAll(".num-key").forEach(key => {
    key.addEventListener("click", (e) => {
        const input = window.currentActiveInput;
        if (!input) return;
        if (e.target.classList.contains("clear")) input.value = "";
        else if (e.target.classList.contains("enter")) {
            for (let i = 0; i < activeTargets.length; i++) {
                if (isNaN(parseInt(document.getElementById(`input-val-${i}`).value))) { alert("全て入力してください"); return; }
            }
            const isCrit = document.getElementById("check-critical").checked;
            
            history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState}));
            currentFocus -= selectedSkill.focus;
            
            activeTargets.forEach((tIndex, i) => {
                let typedVal = parseInt(document.getElementById(`input-val-${i}`).value);
                gridState[tIndex].value += typedVal;
                
                if (isCrit && gridState[tIndex].value >= gridState[tIndex].min && gridState[tIndex].value <= gridState[tIndex].max) {
                     const isTrueCrit = confirm(`【本会心確認】\n特殊な演出（ピタリと止まる音や光）が出ましたか？\n\n・はい ＝ 本会心 (マスをロックします)\n・いいえ ＝ 偽会心 (後から叩けます)`);
                     if(isTrueCrit) gridState[tIndex].isLocked = true;
                }
            });
            currentTemp -= (selectedSkill.specialTempDrop || 50);
            if (currentTemp < MIN_TEMP) currentTemp = MIN_TEMP;
            
            document.getElementById("modal-input").classList.add("hidden");
            
            updateStatusUI(); 
            resetSelectionState();
            calculateAI();
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
// 完全数式ベースの「将棋型AI」 (ループ撲滅・博打対応版)
// ==========================================
function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "AI思考中... (盤面期待値を数式で演算中)";
    aiSuggestedMove = null;

    setTimeout(() => {
        const SEARCH_DEPTH = 2; 
        const bestMove = searchBestMove(gridState, currentTemp, currentFocus, SEARCH_DEPTH);

        if (bestMove && bestMove.skill) {
            aiSuggestedMove = bestMove;
            const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
            let targetText = "全体";
            if (bestMove.targets && bestMove.targets.length > 0) {
                targetText = bestMove.targets.map(t => `[${cellLetters[t]}]`).join("");
            }
            
            aiBox.innerHTML = `
                <div style="font-size:1.1em; margin-bottom:5px;">💡 <strong>${bestMove.skill.name}</strong> を <strong>${targetText}</strong> に使用</div>
                <div style="font-size:0.85em; color:#ccc; line-height:1.4;">
                (盤面期待値: ${Math.floor(bestMove.score)} point)
                </div>
            `;
            renderGrid(); 
        } else {
            aiBox.innerHTML = `おすすめの手が見つかりません。`;
        }
    }, 10);
}

function searchBestMove(state, temp, focus, depth) {
    let bestSkill = null; let bestTargets = []; let bestScore = -Infinity;
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    
    let critRateBase = document.getElementById("has-kotsu").checked ? 0.02 : 0.01;
    critRateBase += 0.046; 

    SKILLS.forEach(skill => {
        if (level < skill.reqLevel || focus < skill.focus) return;

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
                expectedScore = evaluateBoardStateMath(state, nextTemp, nextFocus); 
                
                // 消費集中力ペナルティ (-1500) は evaluateBoardStateMath の中で相殺されるか判定される
                
                if (depth > 1) {
                    let nextBest = searchBestMove(state, nextTemp, nextFocus, depth - 1);
                    if (nextBest) expectedScore += (nextBest.score * 0.9);
                }
            } else {
                const dist = getDamageDistribution(temp, skill.mult);
                if (dist.length === 0) return;

                let currentCritRate = critRateBase;
                if (skill.isCritUp) currentCritRate += (0.046 * 6); 

                const samples = [
                    { val: dist[0], prob: 0.25 },
                    { val: dist[Math.floor(dist.length / 2)], prob: 0.5 },
                    { val: dist[dist.length - 1], prob: 0.25 }
                ];

                let totalScore = 0;
                let tempDrop = skill.specialTempDrop || 50;

                samples.forEach(sample => {
                    let nextStateNorm = JSON.parse(JSON.stringify(state));
                    targets.forEach(t => nextStateNorm[t].value += sample.val);
                    let scoreNorm = evaluateBoardStateMath(nextStateNorm, temp - tempDrop, nextFocus);

                    let nextStateCrit = JSON.parse(JSON.stringify(state));
                    targets.forEach(t => {
                        let newValue = nextStateCrit[t].value + (sample.val * 2);
                        let center = (nextStateCrit[t].min + nextStateCrit[t].max) / 2;
                        if (newValue >= center && nextStateCrit[t].value + (dist[0]*2) <= nextStateCrit[t].max) {
                            nextStateCrit[t].value = Math.floor(center); nextStateCrit[t].isLocked = true;
                        } else {
                            nextStateCrit[t].value = newValue;
                        }
                    });
                    let scoreCrit = evaluateBoardStateMath(nextStateCrit, temp - tempDrop, nextFocus);

                    if (depth > 1) {
                        if (scoreNorm > -50000) {
                            let nbNorm = searchBestMove(nextStateNorm, temp - tempDrop, nextFocus, depth - 1);
                            if (nbNorm) scoreNorm = (scoreNorm + nbNorm.score) / 2;
                        }
                        if (scoreCrit > -50000) {
                            let nbCrit = searchBestMove(nextStateCrit, temp - tempDrop, nextFocus, depth - 1);
                            if (nbCrit) scoreCrit = (scoreCrit + nbCrit.score) / 2;
                        }
                    }

                    // 期待値合成：会心率が高ければ「はみ出し」のマイナス(scoreNorm)を、会心の特大プラス(scoreCrit)で覆せる
                    totalScore += (scoreNorm * (1 - currentCritRate) + scoreCrit * currentCritRate) * sample.prob;
                });
                expectedScore = totalScore;
            }

            if (expectedScore > bestScore) {
                bestScore = expectedScore; bestSkill = skill; bestTargets = targets;
            }
        });
    });

    return { skill: bestSkill, targets: bestTargets, score: bestScore };
}

// ----------------------------------------------------
// 【AIの心臓部】 放物線グラフ計算 ＆ リスク管理
// ----------------------------------------------------
function evaluateBoardStateMath(state, currentTemp, currentFocus) {
    let score = 0;
    let maxShortfall = 0;
    let isAllDone = true;
    
    state.forEach(s => {
        if (!s.isLocked && s.value < s.min) maxShortfall = Math.max(maxShortfall, s.min - s.value);
        
        if (s.isLocked) {
            score += 100000; 
        } else if (s.value > s.max) {
            // ★博打打ち対応★ 
            // はみ出しのペナルティを -30000 に緩和。
            // これにより「会心が出れば +50000、通常ではみ出しても -30000」となり、会心率が高ければ博打を打ちます。
            score -= 30000; 
            isAllDone = false;
        } else if (s.value >= s.min && s.value <= s.max) {
            score += 50000; 
            const center = (s.min + s.max) / 2;
            score -= Math.abs(s.value - center) * 10;
        } else {
            isAllDone = false;
            let shortfall = s.min - s.value;
            score -= shortfall * 100;

            const dist = getDamageDistribution(currentTemp, 1.0);
            if(dist.length > 0) {
                const maxNorm = dist[dist.length - 1];
                const minCrit = dist[0] * 2;
                if (shortfall > maxNorm && (s.max - s.value) >= minCrit) {
                    score += 8000; // 完璧な寄せ（特大ボーナス）
                }
            }
        }
    });

    if (isAllDone) score += 500000; 

    // ★ループ撲滅★ 「最適な目標温度」をパラボラ状に設定
    let optimalTemp = 1000;
    if (maxShortfall > 150) optimalTemp = 2000;
    else if (maxShortfall > 100) optimalTemp = 1600;
    else if (maxShortfall > 60) optimalTemp = 1300;
    else optimalTemp = 1000;
    
    // 現在の温度が目標から離れているほどマイナス（火力上げをすると近づくのでスコアがプラスに転じる）
    score -= Math.abs(currentTemp - optimalTemp) * 10;

    score += currentFocus * 150;
    return score;
}
