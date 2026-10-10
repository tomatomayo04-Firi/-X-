// ==========================================
// app.js - 職人AI ＆ メイン処理
// ==========================================

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 0;
let maxFocus = 0;
let gridState = []; 
let history = []; 

document.addEventListener("DOMContentLoaded", async () => {
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
    } catch (e) {
        document.getElementById("recipe-list").innerHTML = `<li style="color:red">エラー: ${e.message}</li>`;
    }
});

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    listElement.innerHTML = window.recipeLoadWarning || ""; 
    
    const fileInput = document.getElementById("local-file-input");
    if (fileInput) {
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(evt) {
                parseRecipeText(evt.target.result);
                window.recipeLoadWarning = ""; 
                renderRecipeList(); 
                alert("読み込み成功");
            };
            reader.readAsText(file);
        });
    }

    const filterType = document.getElementById("filter-type").value;
    const filterJigane = document.getElementById("filter-jigane").value;
    const filterCrystal = document.getElementById("filter-crystal").checked;

    const filteredRecipes = RECIPES.filter(recipe => {
        if (filterType !== "all" && recipe.category !== filterType) return false;
        if (filterJigane !== "all" && recipe.jiganeType !== filterJigane) return false;
        if (filterCrystal && !recipe.isCrystal) return false;
        return true;
    });

    if (filteredRecipes.length === 0 && !window.recipeLoadWarning) {
        listElement.innerHTML += "<li>レシピが見つかりません。</li>";
        return;
    }

    filteredRecipes.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> <span class="recipe-meta">( ${recipe.category} / 装備Lv${recipe.equipLv} / 地金: ${recipe.jiganeType} ${recipe.isCrystal ? ' / 💎' : ''} )</span>`;
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
    const hammerBonus = 45; 
    maxFocus = (FOCUS_BY_LEVEL[level] || 207) + hammerBonus;
    currentFocus = maxFocus;
    
    gridState = [];
    recipe.targets.forEach(target => {
        gridState.push({ value: 0, min: target.min, max: target.max, isLocked: false });
    });
    
    history = [];
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
        if(state.isLocked) cellDiv.style.borderColor = "#ffeb3b"; 
        
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
        cellDiv.addEventListener("click", () => openInputModal("たたく", currentIndex));
        
        gridContainer.appendChild(cellDiv);
        targetIndex++;
    });
}

// 複数マス技の対象インデックスを計算する関数
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
        if (skillName === "ななめ打ち") {
            // 左上と右下の2マスのみ抽出
            targets = [targets[0], targets[targets.length - 1]];
        }
    }
    return [...new Set(targets)]; // 重複排除
}

function setupSkills(level) {
    const skillList = document.getElementById("skill-list");
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        if (level >= skill.reqLevel) {
            const btn = document.createElement("button");
            btn.className = "skill-btn";
            btn.textContent = `${skill.name} (${skill.focus})`;
            btn.addEventListener("click", () => openInputModal(skill.name, 0));
            skillList.appendChild(btn);
        }
    });
}

// ==========================================
// 熟練職人AI (フェーズ管理・地金ターン合わせ)
// ==========================================
function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "AI思考中... (ターン調整と最適温度を計算)";

    setTimeout(() => {
        const SEARCH_DEPTH = 2; 
        const bestMove = searchBestMove(gridState, currentTemp, currentFocus, SEARCH_DEPTH);

        if (bestMove && bestMove.skill) {
            const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
            let targetText = "全体";
            if (bestMove.targets && bestMove.targets.length > 0) {
                targetText = bestMove.targets.map(t => `[${cellLetters[t]}]`).join("");
            }
            
            aiBox.innerHTML = `
                <div style="font-size:1.1em; margin-bottom:5px;">💡 <strong>${bestMove.skill.name}</strong> を <strong>${targetText}</strong> に使用</div>
                <div style="font-size:0.85em; color:#ccc; line-height:1.4;">
                【AIの狙い】<br>
                ${bestMove.reasoning || "ゲージ進行とリスク管理の最適手です。"}<br>
                (期待値スコア: ${Math.floor(bestMove.score)})
                </div>
            `;
        } else {
            aiBox.innerHTML = `おすすめの手が見つかりません。`;
        }
    }, 10);
}

function searchBestMove(state, temp, focus, depth) {
    let bestSkill = null;
    let bestTargets = [];
    let bestScore = -Infinity;
    let bestReason = "";
    
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    const jigane = currentRecipe.jiganeType;
    let critRateBase = document.getElementById("has-kotsu").checked ? 0.02 : 0.01;
    critRateBase += 0.046; 

    // 現在の盤面の「残り数値の最大値」を計算してフェーズを判断
    let maxShortfall = 0;
    state.forEach(s => {
        if (!s.isLocked && s.value < s.min) {
            maxShortfall = Math.max(maxShortfall, s.min - s.value);
        }
    });
    // 職人の大局観：最大残りが400なら2000度、100なら1000度が理想
    const targetOptimalTemp = Math.min(2000, Math.max(1000, 1000 + (maxShortfall - 100) * 3));

    SKILLS.forEach(skill => {
        if (level < skill.reqLevel || focus < skill.focus) return;

        // 対象の列挙（温度技なら[0]のみ、打つ技なら各マスを起点とする）
        let startIndices = [0];
        if (skill.type !== "temp" && skill.type !== "random") {
            startIndices = [];
            state.forEach((s, i) => { if (!s.isLocked && s.value < s.max) startIndices.push(i); });
        }

        startIndices.forEach(startIndex => {
            let targets = skill.type === "temp" ? [] : getMultiHitTargets(skill.name, startIndex);
            let expectedScore = 0;
            let reasoning = "";
            const nextFocus = focus - skill.focus;
            
            // --- 1. 温度操作技（火力上げ・冷やし込み）の評価 ---
            if (skill.type === "temp") {
                let nextTemp = Math.min(MAX_TEMP, Math.max(MIN_TEMP, temp + skill.tempChange));
                expectedScore = evaluateBoardState(state, nextTemp, nextFocus); 

                if (skill.name === "火力上げ") {
                    if (temp >= targetOptimalTemp) {
                        expectedScore -= 2000; // 今十分熱いので絶対にやめる
                        reasoning = "過剰な火力上げを防止";
                    } else {
                        expectedScore += 800; // 序盤の火力上げを強く推奨
                        reasoning = `目標温度(${Math.floor(targetOptimalTemp)}度付近)に向けて火力を上げます。`;
                    }
                } else if (skill.name === "冷やし込み") {
                    if (maxShortfall < 50 && temp > 1200) {
                        expectedScore += 1000; // 終盤の冷やし込み推奨
                        reasoning = "はみ出しを防ぐため、安全な温度まで一気に下げます。";
                    }
                }
                
                if (depth > 1) {
                    let nextBest = searchBestMove(state, nextTemp, nextFocus, depth - 1);
                    if (nextBest) expectedScore += (nextBest.score * 0.9);
                }
            } 
            // --- 2. 叩く技の評価 ---
            else {
                const dist = getDamageDistribution(temp, skill.mult);
                if (dist.length === 0) return;

                let currentCritRate = critRateBase;
                
                // 地金ごとの会心UPターン判定 (集中変化地金の400倍数など)
                let isJiganeCritTurn = (jigane === "集中変化" && temp % 400 === 0);
                if (skill.isCritUp) currentCritRate += (0.046 * 6);
                if (isJiganeCritTurn) currentCritRate += 0.3; // 仮の加算

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
                    let scoreNorm = evaluateBoardState(nextStateNorm, temp - tempDrop, nextFocus);

                    let nextStateCrit = JSON.parse(JSON.stringify(state));
                    targets.forEach(t => {
                        let newValue = nextStateCrit[t].value + (sample.val * 2);
                        let center = (nextStateCrit[t].min + nextStateCrit[t].max) / 2;
                        if (newValue >= center && nextStateCrit[t].value + (dist[0]*2) <= nextStateCrit[t].max) {
                            nextStateCrit[t].value = Math.floor(center);
                            nextStateCrit[t].isLocked = true;
                        } else {
                            nextStateCrit[t].value = newValue;
                        }
                    });
                    let scoreCrit = evaluateBoardState(nextStateCrit, temp - tempDrop, nextFocus);

                    totalScore += (scoreNorm * (1 - currentCritRate) + scoreCrit * currentCritRate) * sample.prob;
                });
                
                expectedScore = totalScore;

                // --- ターン調整の高度な評価 (熱風おろしの活用等) ---
                let nextTempAfterHit = temp - tempDrop;
                if (jigane === "集中変化") {
                    // 次のターンが400の倍数(会心UP)になるなら特大ボーナス
                    if (nextTempAfterHit % 400 === 0) {
                        expectedScore += 1500;
                        reasoning = `次のターンの【会心率UP】に合わせるための完璧な温度調整です。`;
                        if (skill.name === "熱風おろし") reasoning += "(熱風おろしの-150度を活用)";
                    }
                }

                if (!reasoning) {
                    if (skill.isCritUp && isJiganeCritTurn) reasoning = "会心UPターンでの本会心狙いです！";
                    else if (skill.isCritUp) reasoning = "本会心による確定ロックを狙える絶好の位置です。";
                    else if (skill.name === "超4連打ち") reasoning = "複数マスを一気に進める最高効率の手です。";
                    else reasoning = "ゲージを効率よく寄せるための手です。";
                }
            }

            if (expectedScore > bestScore) {
                bestScore = expectedScore; bestSkill = skill; bestTargets = targets; bestReason = reasoning;
            }
        });
    });

    return { skill: bestSkill, targets: bestTargets, score: bestScore, reasoning: bestReason };
}

// 盤面評価
function evaluateBoardState(state, currentTemp, currentFocus) {
    let score = 0;
    let totalShortfall = 0; 
    
    state.forEach(s => {
        if (s.isLocked) {
            score += 2500; 
        } else if (s.value > s.max) {
            score -= 4000; 
        } else if (s.value >= s.min && s.value <= s.max) {
            score += 400; 
            const center = (s.min + s.max) / 2;
            score -= Math.abs(s.value - center);
        } else {
            let shortfallToMin = s.min - s.value;
            totalShortfall += shortfallToMin;

            const dist = getDamageDistribution(currentTemp, 1.0);
            if(dist.length > 0) {
                const maxNorm = dist[dist.length - 1];
                const minCrit = dist[0] * 2;
                
                if (shortfallToMin > maxNorm && (s.max - s.value) >= minCrit) {
                    score += 200; // 本会心セットアップ
                } else if (shortfallToMin <= maxNorm) {
                    score -= 100; // 偽会心・焦げリスク
                }
            }
            score -= (shortfallToMin * 0.8); 
        }
    });

    score += currentFocus * 3;
    if (totalShortfall > 0 && currentFocus < 16) score -= 2000; 
    
    return score;
}

// ==========================================
// 複数マス対応ポップアップUI ＆ 入力処理
// ==========================================
let activeSkill = null;
let activeTargets = [];

function openInputModal(skillName, startIndex) {
    activeSkill = SKILLS.find(s => s.name === skillName);
    activeTargets = getMultiHitTargets(skillName, startIndex);
    
    const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const targetText = activeTargets.map(t => cellLetters[t]).join("・");
    
    document.getElementById("modal-skill-info").textContent = `${skillName} (対象: [${targetText}])`;
    
    // 入力欄を対象マスの数だけ生成
    const numpadBox = document.getElementById("numpad-inputs");
    if (!numpadBox) {
        // HTML側に入力コンテナを作るためのハック
        const oldInput = document.getElementById("manual-number-input");
        const container = document.createElement("div");
        container.id = "numpad-inputs";
        container.style.display = "flex"; container.style.gap = "5px"; container.style.marginBottom = "10px";
        oldInput.parentNode.insertBefore(container, oldInput);
        oldInput.remove();
    }
    
    const container = document.getElementById("numpad-inputs");
    container.innerHTML = "";
    
    activeTargets.forEach((tIndex, i) => {
        const wrap = document.createElement("div");
        wrap.style.flex = "1";
        
        const label = document.createElement("div");
        label.textContent = cellLetters[tIndex];
        label.style.fontSize = "0.8em"; label.style.color = "#ccc";
        
        const input = document.createElement("input");
        input.type = "number"; input.className = "multi-number-input";
        input.id = `input-val-${i}`;
        
        // フォーカスされた入力を記録（テンキー入力用）
        input.addEventListener("focus", () => window.currentActiveInput = input);
        
        wrap.appendChild(label); wrap.appendChild(input);
        container.appendChild(wrap);
        
        // 初期フォーカスを最初のインプットに
        if (i === 0) {
            setTimeout(() => input.focus(), 10);
            window.currentActiveInput = input;
        }
    });

    document.getElementById("check-critical").checked = false;
    document.getElementById("modal-input").classList.remove("hidden");
}

document.getElementById("btn-cancel-input").addEventListener("click", () => document.getElementById("modal-input").classList.add("hidden"));
document.getElementById("btn-back").addEventListener("click", () => {
    document.getElementById("scene-smithing").classList.remove("active");
    document.getElementById("scene-select").classList.add("active");
});

document.querySelectorAll(".num-key").forEach(key => {
    key.addEventListener("click", (e) => {
        const input = window.currentActiveInput;
        if (!input) return;
        
        if (e.target.classList.contains("clear")) input.value = "";
        else if (e.target.classList.contains("enter")) submitAction();
        else input.value += e.target.textContent;
    });
});

function submitAction() {
    if (activeSkill.type !== "temp") {
        for (let i = 0; i < activeTargets.length; i++) {
            if (isNaN(parseInt(document.getElementById(`input-val-${i}`).value))) {
                alert("すべての対象マスの数値を入力してください"); return;
            }
        }
    }
    
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState}));
    currentFocus -= activeSkill.focus;
    
    if (activeSkill.type === "temp") {
        currentTemp += activeSkill.tempChange;
    } else {
        const isCrit = document.getElementById("check-critical").checked; // 今回は一括会心判定
        
        activeTargets.forEach((tIndex, i) => {
            let val = parseInt(document.getElementById(`input-val-${i}`).value);
            if (isCrit) val = val * 2; 
            
            gridState[tIndex].value += val;

            if (isCrit && gridState[tIndex].value >= gridState[tIndex].min && gridState[tIndex].value <= gridState[tIndex].max) {
                 gridState[tIndex].isLocked = true;
            }
        });
        currentTemp -= (activeSkill.specialTempDrop || 50);
    }
    
    if (currentTemp < MIN_TEMP) currentTemp = MIN_TEMP;
    if (currentTemp > MAX_TEMP) currentTemp = MAX_TEMP;
    
    document.getElementById("modal-input").classList.add("hidden");
    updateStatusUI();
    renderGrid();
    calculateAI();
}

document.getElementById("btn-undo").addEventListener("click", () => {
    if (history.length === 0) return;
    const lastState = JSON.parse(history.pop());
    currentTemp = lastState.temp; currentFocus = lastState.focus; gridState = lastState.grid;
    updateStatusUI(); renderGrid(); calculateAI();
});
