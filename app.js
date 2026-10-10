// ==========================================
// app.js - 職人AI ＆ メイン処理 (完全版)
// ==========================================

// --- 動的CSSの注入 (ポップアップやハイライト用) ---
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

// UIステート管理
let currentActionState = "idle"; // idle, skillSelected
let selectedSkill = null;
let activeTargets = [];
let aiSuggestedMove = null;

// ==========================================
// 初期化・レシピ読み込み
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    // フロートUIの生成
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
        
        // 「おすすめを実行」ボタンの実装
        document.getElementById("btn-auto-execute").addEventListener("click", () => {
            if (!aiSuggestedMove || !aiSuggestedMove.skill) return;
            selectedSkill = aiSuggestedMove.skill;
            if (selectedSkill.type === "temp") {
                executeTempSkill();
            } else {
                let target = Array.isArray(aiSuggestedMove.targets) ? aiSuggestedMove.targets[0] : aiSuggestedMove.targets;
                if (target !== undefined) {
                    currentActionState = "skillSelected";
                    handleCellClick(target, true); // AIの指定マスを自動でクリックした状態にする
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

// ==========================================
// 鍛冶画面の制御
// ==========================================
function startSmithing(recipe) {
    currentRecipe = recipe;
    document.getElementById("current-recipe-name").textContent = recipe.name;
    document.getElementById("display-jigane").textContent = `地金: ${recipe.jiganeType}`;
    currentTemp = 1000;
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    maxFocus = (FOCUS_BY_LEVEL[level] || 207) + 45; // 光ハンマー固定
    currentFocus = maxFocus;
    
    gridState = [];
    recipe.targets.forEach(target => gridState.push({ value: 0, min: target.min, max: target.max, isLocked: false }));
    history = [];
    
    // ガイド用テキストエリアの追加
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
        cellDiv.addEventListener("click", (e) => handleCellClick(currentIndex, false, e));
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

// ==========================================
// スキル選択 ＆ フロートUI表示
// ==========================================
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
        // 温度技は即実行
        if(confirm(`${skill.name} を実行しますか？`)) executeTempSkill();
    } else {
        // 叩く技はマス選択モードへ
        currentActionState = "skillSelected";
        document.getElementById("action-guide").textContent = `🔽 【${skill.name}】を打つマスを選んでください`;
        renderGrid(); // マスを光らせるため再描画
    }
}

function handleCellClick(targetIndex, isAuto = false, event = null) {
    if (currentActionState !== "skillSelected" || !selectedSkill) return;
    activeTargets = getMultiHitTargets(selectedSkill.name, targetIndex);
    
    // UIガイドの更新
    const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const targetText = activeTargets.map(t => cellLetters[t]).join("・");
    document.getElementById("action-guide").textContent = `【${selectedSkill.name}】 対象: [${targetText}]`;

    // フロートUIの表示設定
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
        btn.addEventListener("click", () => executeHitSkill(dmg, false)); // 通常ヒット実行
        btnGroup.appendChild(btn);
    });
    floatUI.appendChild(btnGroup);

    let critBtn = document.createElement("button");
    critBtn.className = "float-btn crit-btn";
    critBtn.innerHTML = "⚡ 会心・手入力（詳細設定）";
    critBtn.addEventListener("click", () => {
        floatUI.classList.add("hidden");
        openFullInputModal(); // フルモーダルへ移行
    });
    floatUI.appendChild(critBtn);

    // 位置の計算 (クリック位置、または自動の場合は対象マスの付近)
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
    document.getElementById("check-critical").checked = true; // 会心ボタン経由なのでチェックをONに
    
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
// 熟練職人AI (フェーズ別評価ロジック)
// ==========================================
function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "AI思考中... (フェーズと期待値を計算)";
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
                【AIの狙い】<br>${bestMove.reasoning}<br>(期待値スコア: ${Math.floor(bestMove.score)})
                </div>
            `;
            renderGrid(); // AI推奨マスを光らせるため再描画
        } else {
            aiBox.innerHTML = `おすすめの手が見つかりません。`;
        }
    }, 10);
}

function searchBestMove(state, temp, focus, depth) {
    let bestSkill = null; let bestTargets = []; let bestScore = -Infinity; let bestReason = "";
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    const jigane = currentRecipe.jiganeType;
    let critRateBase = document.getElementById("has-kotsu").checked ? 0.02 : 0.01;
    critRateBase += 0.046; 

    // --- フェーズ（序盤・終盤）の判定と目標温度の算出 ---
    let maxShortfall = 0; let totalMax = 0;
    state.forEach(s => {
        totalMax += s.max;
        if (!s.isLocked && s.value < s.min) maxShortfall = Math.max(maxShortfall, s.min - s.value);
    });
    
    let targetTemp = 1000;
    let avgMax = totalMax / state.length;
    if (jigane === "光") {
        targetTemp = 2000; // 光地金は光マス抽選のためにカンストまで上げる
    } else {
        if (avgMax > 200) targetTemp = 1600; // ブルーム等
        else if (avgMax > 130) targetTemp = 1300; // メタスラ等
        else targetTemp = 1000;
    }
    
    let isEarlyPhase = (maxShortfall > 60); // まだたくさん叩く必要があるフェーズ

    SKILLS.forEach(skill => {
        if (level < skill.reqLevel || focus < skill.focus) return;

        let startIndices = [0];
        if (skill.type !== "temp" && skill.type !== "random") {
            startIndices = [];
            state.forEach((s, i) => { if (!s.isLocked && s.value < s.max) startIndices.push(i); });
        }

        startIndices.forEach(startIndex => {
            let targets = skill.type === "temp" ? [] : getMultiHitTargets(skill.name, startIndex);
            let expectedScore = 0; let reasoning = "";
            const nextFocus = focus - skill.focus;
            
            // --- 1. 温度操作技（フェーズ依存評価） ---
            if (skill.type === "temp") {
                let nextTemp = Math.min(MAX_TEMP, Math.max(MIN_TEMP, temp + skill.tempChange));
                expectedScore = evaluateBoardState(state, nextTemp, nextFocus, isEarlyPhase); 

                if (skill.name === "火力上げ") {
                    if (isEarlyPhase && temp < targetTemp) {
                        expectedScore += 1500; // 序盤で温度不足なら強く推奨
                        reasoning = `序盤の効率アップ！目標温度(${targetTemp}度)に向けて火力を上げます。`;
                    } else {
                        expectedScore -= 3000; // 序盤でも温度十分、または終盤なら絶対やらない
                        reasoning = "現在火力上げをする必要はありません。";
                    }
                } else if (skill.name === "冷やし込み") {
                    if (!isEarlyPhase && temp > 1200) {
                        expectedScore += 1000; // 終盤の調整用
                        reasoning = "終盤の調整やねらい打ちに向けて、安全な温度に下げます。";
                    }
                }
                
                if (depth > 1) {
                    let nextBest = searchBestMove(state, nextTemp, nextFocus, depth - 1);
                    if (nextBest) expectedScore += (nextBest.score * 0.9);
                }
            } 
            // --- 2. 叩く技（後半は期待値シミュレーション重視） ---
            else {
                const dist = getDamageDistribution(temp, skill.mult);
                if (dist.length === 0) return;

                let currentCritRate = critRateBase;
                let isJiganeCritTurn = (jigane === "集中変化" && temp % 400 === 0);
                if (skill.isCritUp) currentCritRate += (0.046 * 6);
                if (isJiganeCritTurn) currentCritRate += 0.3; 

                // シミュレーション（簡易）
                const samples = [{ val: dist[0], prob: 0.25 }, { val: dist[Math.floor(dist.length / 2)], prob: 0.5 }, { val: dist[dist.length - 1], prob: 0.25 }];
                let totalScore = 0;
                let tempDrop = skill.specialTempDrop || 50;

                samples.forEach(sample => {
                    let nextStateNorm = JSON.parse(JSON.stringify(state));
                    targets.forEach(t => nextStateNorm[t].value += sample.val);
                    let scoreNorm = evaluateBoardState(nextStateNorm, temp - tempDrop, nextFocus, isEarlyPhase);

                    let nextStateCrit = JSON.parse(JSON.stringify(state));
                    targets.forEach(t => {
                        let newValue = nextStateCrit[t].value + (sample.val * 2);
                        let center = (nextStateCrit[t].min + nextStateCrit[t].max) / 2;
                        if (newValue >= center && nextStateCrit[t].value + (dist[0]*2) <= nextStateCrit[t].max) {
                            nextStateCrit[t].value = Math.floor(center); nextStateCrit[t].isLocked = true;
                        } else { nextStateCrit[t].value = newValue; }
                    });
                    let scoreCrit = evaluateBoardState(nextStateCrit, temp - tempDrop, nextFocus, isEarlyPhase);

                    totalScore += (scoreNorm * (1 - currentCritRate) + scoreCrit * currentCritRate) * sample.prob;
                });
                expectedScore = totalScore;

                let nextTempAfterHit = temp - tempDrop;
                if (jigane === "集中変化" && nextTempAfterHit % 400 === 0 && !isEarlyPhase) {
                    expectedScore += 1500;
                    reasoning = `次のターンの【会心率UP】に合わせるための完璧な温度調整です。`;
                }

                if (!reasoning) {
                    if (skill.isCritUp && isJiganeCritTurn) reasoning = "会心UPターンでの本会心狙いです！";
                    else if (skill.isCritUp) reasoning = "本会心による確定ロックを狙える絶好の位置です。";
                    else if (skill.name === "超4連打ち" || skill.name === "4連打ち") reasoning = "複数マスを一気に進める最高効率の手です。";
                    else reasoning = isEarlyPhase ? "ゲージを効率よく進めるための手です。" : "はみ出しを防ぎつつ、成功ゾーンに寄せる手です。";
                }
            }

            if (expectedScore > bestScore) {
                bestScore = expectedScore; bestSkill = skill; bestTargets = targets; bestReason = reasoning;
            }
        });
    });

    return { skill: bestSkill, targets: bestTargets, score: bestScore, reasoning: bestReason };
}

function evaluateBoardState(state, currentTemp, currentFocus, isEarlyPhase) {
    let score = 0;
    
    state.forEach(s => {
        if (s.isLocked) {
            score += 3000; 
        } else if (s.value > s.max) {
            score -= 5000; // はみ出し絶対回避
        } else if (s.value >= s.min && s.value <= s.max) {
            score += 500; 
            const center = (s.min + s.max) / 2;
            score -= Math.abs(s.value - center);
        } else {
            let shortfall = s.min - s.value;
            const dist = getDamageDistribution(currentTemp, 1.0);
            
            if(!isEarlyPhase && dist.length > 0) {
                // 後半は「寄せ」の厳密な評価
                const maxNorm = dist[dist.length - 1];
                const minCrit = dist[0] * 2;
                if (shortfall > maxNorm && (s.max - s.value) >= minCrit) {
                    score += 300; // 本会心セットアップ
                } else if (shortfall <= maxNorm) {
                    score -= 150; // 偽会心・焦げリスク
                }
            }
            score -= shortfall; // 基本は遠いほどマイナス
        }
    });

    score += currentFocus * 2;
    return score;
}
