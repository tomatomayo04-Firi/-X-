// ==========================================
// app.js - 本格AI ＆ メイン処理
// ==========================================

const style = document.createElement("style");
style.innerHTML = `
#float-quick-input { position: absolute; background: rgba(30,30,30,0.95); border: 2px solid #e09f3e; border-radius: 8px; padding: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.7); z-index: 1000; display: flex; flex-direction: column; gap: 8px; transform: translate(-50%, -100%); margin-top: -20px; transition: opacity 0.2s; pointer-events: auto; }
#float-quick-input.hidden { display: none; opacity: 0; pointer-events: none; }
.float-title { font-size: 0.8em; color: #ccc; text-align: center; margin-bottom: 5px; }
.float-btn-group { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; }
.float-btn { background: #444; color: white; border: 1px solid #666; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 1.1em; }
.float-btn:hover { background: #e09f3e; color: black; }
.float-btn.crit-btn { background: #ffeb3b; color: black; font-weight: bold; width: 100%; margin-top: 5px; text-align: center; }
.forge-cell.targeting { border-color: #00bcd4; box-shadow: 0 0 12px #00bcd4; cursor: pointer; }
.forge-cell.targeting:hover { background: rgba(0, 188, 212, 0.2); }
.forge-cell.ai-suggested { border-color: #ff4081; animation: pulse 1.5s infinite; }
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
        
        // おすすめ実行ボタンの完全連動
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
        
        if (state.isLocked) cellDiv.style.borderColor = "#ffeb3b"; 
        if (currentActionState === "skillSelected") cellDiv.classList.add("targeting");
        if (aiSuggestedMove && aiSuggestedMove.targets && aiSuggestedMove.targets.includes(targetIndex)) cellDiv.classList.add("ai-suggested");
        
        const absoluteMax = state.max * 1.2;
        const fillHeight = Math.min(100, (state.value / absoluteMax) * 100);
        const targetBottom = (state.min / absoluteMax) * 100;
        const targetHeight = ((state.max - state.min) / absoluteMax) * 100;
        
        cellDiv.innerHTML = `
            <div class="gauge-target-zone" style="bottom: ${targetBottom}%; height: ${targetHeight}%;"></div>
            <div class="gauge-fill" style="height: ${fillHeight}%; ${state.isLocked ? 'background: #ffeb3b;' : ''}"></div>
            <div class="gauge-text">${state.value}</div>
        `;
        
        let currentIndex = targetIndex;
        // 不具合修正: スキルを選んでいない時の挙動を整理
        cellDiv.addEventListener("click", (e) => {
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
        if (down < gridState.length && layout.cells[down] !== null) targets.push(down);
    } else if (skillName === "左右打ち") {
        if ((startIndex % cols) !== (cols - 1)) {
            let right = startIndex + 1;
            if (right < gridState.length && layout.cells[right] !== null) targets.push(right);
        }
    } else if (skillName === "4連打ち" || skillName === "超4連打ち" || skillName === "ななめ打ち") {
        let right = startIndex + 1;
        let down = startIndex + cols;
        let downright = startIndex + cols + 1;
        if ((startIndex % cols) !== (cols - 1)) {
            if (right < gridState.length && layout.cells[right] !== null) targets.push(right);
            if (down < gridState.length && layout.cells[down] !== null) targets.push(down);
            if (downright < gridState.length && layout.cells[downright] !== null) targets.push(downright);
        }
        if (skillName === "ななめ打ち") targets = [targets[0], targets[targets.length - 1]];
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

function handleCellClick(targetIndex, isAuto = false, event = null) {
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    activeTargets = getMultiHitTargets(selectedSkill.name, targetIndex);
    
    const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const targetText = activeTargets.map(t => cellLetters[t]).join("・");
    document.getElementById("action-guide").textContent = `【${selectedSkill.name}】 対象: [${targetText}]`;

    const floatUI = document.getElementById("float-quick-input");
    floatUI.innerHTML = "";
    
    let title = document.createElement("div");
    title.className = "float-title";
    title.textContent = "出た数値を選ぶ";
    floatUI.appendChild(title);

    let btnGroup = document.createElement("div");
    btnGroup.className = "float-btn-group";
    
    const dist = getDamageDistribution(currentTemp, selectedSkill.mult);
    dist.forEach(dmg => {
        let btn = document.createElement("button");
        btn.className = "float-btn";
        btn.textContent = dmg;
        btn.addEventListener("click", () => executeHitSkill(dmg, false)); 
        btnGroup.appendChild(btn);
    });
    floatUI.appendChild(btnGroup);

    let critBtn = document.createElement("button");
    critBtn.className = "float-btn crit-btn";
    critBtn.innerHTML = "⚡ 会心・手入力（詳細設定）";
    critBtn.addEventListener("click", () => {
        floatUI.classList.add("hidden");
        openFullInputModal(); 
    });
    floatUI.appendChild(critBtn);

    floatUI.classList.remove("hidden");
    let x, y;
    if (event && event.pageX) {
        x = event.pageX; y = event.pageY - 20;
    } else {
        const cell = document.getElementById(`forge-cell-${targetIndex}`);
        const rect = cell.getBoundingClientRect();
        x = rect.left + window.scrollX + rect.width / 2;
        y = rect.top + window.scrollY;
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
    resetSelectionState();
    calculateAI();
}

function executeHitSkill(value, isCrit) {
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState}));
    currentFocus -= selectedSkill.focus;
    
    activeTargets.forEach(t => {
        let finalVal = isCrit ? value * 2 : value;
        gridState[t].value += finalVal;
        if (isCrit && gridState[t].value >= gridState[t].min && gridState[t].value <= gridState[t].max) {
             gridState[t].isLocked = true;
        }
    });
    
    currentTemp -= (selectedSkill.specialTempDrop || 50);
    if (currentTemp < MIN_TEMP) currentTemp = MIN_TEMP;
    
    resetSelectionState();
    calculateAI();
}

// --- 手入力用フルモーダル ---
function openFullInputModal() {
    document.getElementById("modal-skill-info").textContent = `${selectedSkill.name} (詳細入力)`;
    document.getElementById("manual-number-input").value = "";
    document.getElementById("check-critical").checked = true; 
    
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
                let val = parseInt(document.getElementById(`input-val-${i}`).value);
                if (isCrit) val = val * 2; 
                gridState[tIndex].value += val;
                if (isCrit && gridState[tIndex].value >= gridState[tIndex].min && gridState[tIndex].value <= gridState[tIndex].max) {
                     gridState[tIndex].isLocked = true;
                }
            });
            currentTemp -= (selectedSkill.specialTempDrop || 50);
            if (currentTemp < MIN_TEMP) currentTemp = MIN_TEMP;
            
            document.getElementById("modal-input").classList.add("hidden");
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
    resetSelectionState(); calculateAI();
});

// ==========================================
// 完全数式ベースの「将棋型AI」
// ==========================================
function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "AI思考中... (数手先の盤面期待値を数式で演算中)";
    aiSuggestedMove = null;

    setTimeout(() => {
        const SEARCH_DEPTH = 2; // 2手先まで完全探索
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
    
    // 会心率の計算
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
                
                if (depth > 1) {
                    let nextBest = searchBestMove(state, nextTemp, nextFocus, depth - 1);
                    if (nextBest) expectedScore += (nextBest.score * 0.9);
                }
            } else {
                const dist = getDamageDistribution(temp, skill.mult);
                if (dist.length === 0) return;

                let currentCritRate = critRateBase;
                if (skill.isCritUp) currentCritRate += (0.046 * 6); // ねらい打ち補正

                // 計算軽量化のため、最小・中央・最大の3点で確率分布を代表させる
                const samples = [
                    { val: dist[0], prob: 0.25 },
                    { val: dist[Math.floor(dist.length / 2)], prob: 0.5 },
                    { val: dist[dist.length - 1], prob: 0.25 }
                ];

                let totalScore = 0;
                let tempDrop = skill.specialTempDrop || 50;

                samples.forEach(sample => {
                    // 通常ヒット分岐
                    let nextStateNorm = JSON.parse(JSON.stringify(state));
                    targets.forEach(t => nextStateNorm[t].value += sample.val);
                    let scoreNorm = evaluateBoardStateMath(nextStateNorm, temp - tempDrop, nextFocus);

                    // 会心ヒット分岐
                    let nextStateCrit = JSON.parse(JSON.stringify(state));
                    targets.forEach(t => {
                        let newValue = nextStateCrit[t].value + (sample.val * 2);
                        let center = (nextStateCrit[t].min + nextStateCrit[t].max) / 2;
                        // 本会心判定（最小会心で届き、最大でもオーバーしないならロック）
                        if (newValue >= center && nextStateCrit[t].value + (dist[0]*2) <= nextStateCrit[t].max) {
                            nextStateCrit[t].value = Math.floor(center); nextStateCrit[t].isLocked = true;
                        } else {
                            nextStateCrit[t].value = newValue;
                        }
                    });
                    let scoreCrit = evaluateBoardStateMath(nextStateCrit, temp - tempDrop, nextFocus);

                    // 未来の探索 (深さが残っていれば)
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
// 【AIの心臓部】 数学的評価関数 (ルールベース廃止)
// ----------------------------------------------------
function evaluateBoardStateMath(state, currentTemp, currentFocus) {
    let score = 0;
    let totalShortfall = 0;
    let isAllDone = true;
    
    state.forEach(s => {
        if (s.isLocked) {
            score += 100000; // 確定大成功マス
        } else if (s.value > s.max) {
            score -= 200000; // はみ出しは致命傷
            isAllDone = false;
        } else if (s.value >= s.min && s.value <= s.max) {
            score += 20000; // 成功ゾーン
            // センターに近いほど加点
            const center = (s.min + s.max) / 2;
            score -= Math.abs(s.value - center) * 10;
        } else {
            isAllDone = false;
            let shortfall = s.min - s.value;
            totalShortfall += shortfall;

            // ① 基本の距離ペナルティ
            score -= shortfall * 50;

            // ② 「寄せ」の価値（ねらい打ちのセットアップ）
            const dist = getDamageDistribution(currentTemp, 1.0);
            if(dist.length > 0) {
                const maxNorm = dist[dist.length - 1];
                const minCrit = dist[0] * 2;
                // 「通常なら絶対にはみ出さない」かつ「会心なら確実に成功ゾーンに入る」
                if (shortfall > maxNorm && (s.max - s.value) >= minCrit) {
                    score += 5000; // 完璧な寄せ
                }
            }
        }
    });

    if (isAllDone) score += 500000; // 完全クリアボーナス

    // ③ 温度と距離の相関評価（この数式が「序盤の火力上げ」を自発的に選ばせる）
    // 残りHPが多いときは、温度が高いとスコアが爆増する (火力上げの集中力10をペイできる)
    score += totalShortfall * (currentTemp / 20);

    // ④ はみ出しリスクによる逆転（残りHPが少ない時は、高温が大きなマイナスになる）
    if (totalShortfall > 0 && totalShortfall < 60) {
        score -= (currentTemp * 5); // ここでAIは自発的に冷やし込みを始める
    }

    // ⑤ 集中力の価値
    score += currentFocus * 150;

    return score;
}
