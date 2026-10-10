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
        if(state.isLocked) cellDiv.style.borderColor = "#ffeb3b"; // 本会心ロック時の演出
        
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
// 職人AI (本会心セットアップ・期待値計算)
// ==========================================
function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "AI思考中... (本会心率・冷やし込み期待値等を計算)";

    setTimeout(() => {
        const SEARCH_DEPTH = 2; 
        const bestMove = searchBestMove(gridState, currentTemp, currentFocus, SEARCH_DEPTH);

        if (bestMove && bestMove.skill) {
            const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
            let targetText = typeof bestMove.target === 'number' ? `マス${cellLetters[bestMove.target]}` : '全体';
            
            aiBox.innerHTML = `
                <div style="font-size:1.1em; margin-bottom:5px;">💡 <strong>${bestMove.skill.name}</strong> を <strong>${targetText}</strong> に使用</div>
                <div style="font-size:0.85em; color:#ccc; line-height:1.4;">
                【AIの狙い】<br>
                ${getReasoningText(bestMove, gridState)}<br>
                (期待値スコア: ${Math.floor(bestMove.score)})
                </div>
            `;
        } else {
            aiBox.innerHTML = `おすすめの手が見つかりません。`;
        }
    }, 10);
}

function getReasoningText(move, state) {
    if (move.skill.name === "火力上げ") return "序盤の進行、または次のねらい打ちに向けた火力確保です。";
    if (move.skill.name === "冷やし込み") return "現在の温度でははみ出しリスクが高いため、温度を下げてから調整・ねらい打ちをする期待値が高いです。";
    if (move.skill.isCritUp) return "本会心（または安全な偽会心）の期待値が最も高いベストな寄せ状態です！";
    if (move.skill.name === "てかげん打ち") return "会心を狙わずとも、安全に成功ゲージの中心に寄せる確率が高いです。";
    return "ゲージを効率よく進めつつ、はみ出しリスクを抑える手です。";
}

function searchBestMove(state, temp, focus, depth) {
    let bestSkill = null;
    let bestTarget = null;
    let bestScore = -Infinity;
    
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    let critRateBase = document.getElementById("has-kotsu").checked ? 0.02 : 0.01;
    critRateBase += 0.046; // 道具会心

    SKILLS.forEach(skill => {
        if (level < skill.reqLevel || focus < skill.focus) return;

        let targets = [null];
        if (skill.type !== "temp") {
            targets = [];
            state.forEach((s, i) => { if (!s.isLocked && s.value < s.max) targets.push(i); });
        }

        targets.forEach(target => {
            let expectedScore = 0;
            const nextFocus = focus - skill.focus;
            
            if (skill.type === "temp") {
                let nextTemp = Math.min(MAX_TEMP, Math.max(MIN_TEMP, temp + skill.tempChange));
                expectedScore = evaluateBoardState(state, nextTemp, nextFocus); 
                
                // 冷やし込み・火力上げ後の次の一手を探索
                if (depth > 1) {
                    let nextBest = searchBestMove(state, nextTemp, nextFocus, depth - 1);
                    if (nextBest) expectedScore += (nextBest.score * 0.9); // 割引して加算
                }
            } else {
                const dist = getDamageDistribution(temp, skill.mult);
                if (dist.length === 0) return;

                let currentCritRate = critRateBase;
                if (skill.isCritUp) {
                    // ねらい打ち等の会心加算 (会心率UPターンならさらに倍率がかかるが今回は通常時計算)
                    currentCritRate += (0.046 * 6); 
                }

                // 全パターン計算(最小・中央・最大の代表値で軽量化)
                const samples = [
                    { val: dist[0], prob: 0.25 },
                    { val: dist[Math.floor(dist.length / 2)], prob: 0.5 },
                    { val: dist[dist.length - 1], prob: 0.25 }
                ];

                let totalScore = 0;

                samples.forEach(sample => {
                    // ① 通常ヒット (会心出ず)
                    let nextStateNorm = JSON.parse(JSON.stringify(state));
                    nextStateNorm[target].value += sample.val;
                    let scoreNorm = evaluateBoardState(nextStateNorm, temp - 50, nextFocus);
                    
                    if (depth > 1 && scoreNorm > -500) { 
                        let nb = searchBestMove(nextStateNorm, temp - 50, nextFocus, depth - 1);
                        if (nb) scoreNorm = (scoreNorm + nb.score) / 2;
                    }

                    // ② 会心ヒット
                    let nextStateCrit = JSON.parse(JSON.stringify(state));
                    let critDmg = sample.val * 2;
                    let newValue = nextStateCrit[target].value + critDmg;
                    
                    // 本会心判定: 会心ダメージで「基準値（成功ゲージの中心付近と仮定）」をぶち抜けるならピタリと止まる
                    let targetCenter = (nextStateCrit[target].min + nextStateCrit[target].max) / 2;
                    if (newValue >= targetCenter && nextStateCrit[target].value + (dist[0]*2) <= nextStateCrit[target].max) {
                        // 最小会心でもオーバーせず、最大会心で基準値に届くなら、ゲーム仕様上ロックされやすい（本会心）
                        nextStateCrit[target].value = Math.floor(targetCenter);
                        nextStateCrit[target].isLocked = true;
                    } else {
                        // 届かない、またははみ出す場合はそのまま加算（偽会心または焦げ）
                        nextStateCrit[target].value = newValue;
                    }

                    let scoreCrit = evaluateBoardState(nextStateCrit, temp - 50, nextFocus);
                    
                    if (depth > 1 && scoreCrit > -500 && !nextStateCrit[target].isLocked) {
                        let nb = searchBestMove(nextStateCrit, temp - 50, nextFocus, depth - 1);
                        if (nb) scoreCrit = (scoreCrit + nb.score) / 2;
                    }

                    totalScore += (scoreNorm * (1 - currentCritRate) + scoreCrit * currentCritRate) * sample.prob;
                });
                
                expectedScore = totalScore;
            }

            if (expectedScore > bestScore) {
                bestScore = expectedScore; bestSkill = skill; bestTarget = target;
            }
        });
    });

    return { skill: bestSkill, target: bestTarget, score: bestScore };
}

// 盤面評価 (職人の「寄せ」理論を反映)
function evaluateBoardState(state, currentTemp, currentFocus) {
    let score = 0;
    let totalShortfall = 0; 
    
    state.forEach(s => {
        if (s.isLocked) {
            score += 2000; // 本会心によるロックは最高評価
        } else if (s.value > s.max) {
            score -= 3000; // はみ出しは絶対回避
        } else if (s.value >= s.min && s.value <= s.max) {
            score += 300; // 成功ゾーン
            // 中心に近いほど誤差が少ないためプラス
            const center = (s.min + s.max) / 2;
            score -= Math.abs(s.value - center);
        } else {
            let shortfallToMin = s.min - s.value;
            totalShortfall += shortfallToMin;

            // --- 寄せ（ねらい打ちセットアップ）の評価 ---
            // 現在の温度の最大ダメージ・最小ダメージを取得
            const dist = getDamageDistribution(currentTemp, 1.0);
            if(dist.length > 0) {
                const maxNorm = dist[dist.length - 1];
                const minCrit = dist[0] * 2;
                
                // 「通常ヒットでは絶対にはみ出さない（成功ゾーンにも入らない＝安全）」
                // かつ「会心が出れば成功ゾーンに確定で入る」位置を高く評価
                if (shortfallToMin > maxNorm && (s.max - s.value) >= minCrit) {
                    score += 150; // 完璧な寄せ状態
                } else if (shortfallToMin <= maxNorm) {
                    // 通常ヒットで成功ゾーンに入ってしまう（偽会心リスク大）は少しマイナス
                    score -= 50; 
                }
            }
            score -= shortfallToMin; // 基本は遠いほどマイナス
        }
    });

    // 序盤の火力上げ促進：全体的にまだ遠い場合は高い温度を評価
    if (totalShortfall > 150) {
        score += (currentTemp / 10);
    }

    score += currentFocus * 2;
    // ねらい打ち（16）が打てないほどカツカツならペナルティ
    if (totalShortfall > 0 && currentFocus < 16) score -= 1500; 
    
    return score;
}

// ==========================================
// 小型ポップアップUI ＆ 入力処理
// ==========================================
let activeSkill = null;
let activeTarget = null;

function openInputModal(skillName, targetIndex) {
    activeSkill = SKILLS.find(s => s.name === skillName);
    activeTarget = targetIndex;
    document.getElementById("modal-skill-info").textContent = `${skillName} (対象: ${targetIndex + 1}マス目)`;
    document.getElementById("manual-number-input").value = "";
    document.getElementById("check-critical").checked = false;
    
    const quickBox = document.getElementById("quick-select-numbers");
    quickBox.innerHTML = "";
    if (activeSkill && activeSkill.type !== "temp") {
        const dist = getDamageDistribution(currentTemp, activeSkill.mult);
        dist.forEach(dmg => {
            const btn = document.createElement("button");
            btn.className = "quick-btn";
            btn.textContent = dmg;
            btn.addEventListener("click", () => document.getElementById("manual-number-input").value = dmg);
            quickBox.appendChild(btn);
        });
    }
    document.getElementById("modal-input").classList.remove("hidden");
}

document.getElementById("btn-cancel-input").addEventListener("click", () => document.getElementById("modal-input").classList.add("hidden"));
document.getElementById("btn-back").addEventListener("click", () => {
    document.getElementById("scene-smithing").classList.remove("active");
    document.getElementById("scene-select").classList.add("active");
});

document.querySelectorAll(".num-key").forEach(key => {
    key.addEventListener("click", (e) => {
        const input = document.getElementById("manual-number-input");
        if (e.target.classList.contains("clear")) input.value = "";
        else if (e.target.classList.contains("enter")) submitAction();
        else input.value += e.target.textContent;
    });
});

function submitAction() {
    const val = parseInt(document.getElementById("manual-number-input").value);
    if (isNaN(val) && activeSkill.type !== "temp") { alert("数値を入力してください"); return; }
    
    history.push(JSON.stringify({temp: currentTemp, focus: currentFocus, grid: gridState}));
    currentFocus -= activeSkill.focus;
    
    if (activeSkill.type === "temp") {
        currentTemp += activeSkill.tempChange;
    } else {
        let dmg = val;
        const isCrit = document.getElementById("check-critical").checked;
        if (isCrit) dmg = val * 2; 
        
        gridState[activeTarget].value += dmg;

        // 手動で会心をチェックし、基準値をぶち抜いていればロック扱いにする簡易判定
        if (isCrit && gridState[activeTarget].value >= gridState[activeTarget].min && gridState[activeTarget].value <= gridState[activeTarget].max) {
             gridState[activeTarget].isLocked = true;
        }

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
