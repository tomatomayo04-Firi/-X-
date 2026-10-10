// ==========================================
// app.js - アプリケーションのメイン処理
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
        document.getElementById("recipe-list").innerHTML = `<li style="color:red">スクリプト実行エラー: ${e.message}</li>`;
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
                alert("ファイルの読み込みに成功しました！");
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
        listElement.innerHTML += "<li>条件に一致するレシピがありません。</li>";
        return;
    }

    filteredRecipes.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `
            <strong>${recipe.name}</strong> 
            <span class="recipe-meta">
                ( ${recipe.category} / 装備Lv${recipe.equipLv} / 地金: ${recipe.jiganeType} ${recipe.isCrystal ? ' / 💎結晶' : ''} )
            </span>
        `;
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
        
        const absoluteMax = state.max * 1.2;
        const fillHeight = Math.min(100, (state.value / absoluteMax) * 100);
        const targetBottom = (state.min / absoluteMax) * 100;
        const targetHeight = ((state.max - state.min) / absoluteMax) * 100;
        
        cellDiv.innerHTML = `
            <div class="gauge-target-zone" style="bottom: ${targetBottom}%; height: ${targetHeight}%;"></div>
            <div class="gauge-fill" style="height: ${fillHeight}%;"></div>
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
// AI（最適手）計算 (先読み ＆ 残り集中力評価)
// ==========================================
function calculateAI() {
    const aiBox = document.getElementById("ai-suggestion");
    aiBox.textContent = "計算中... (数手先と集中力を予測しています)";

    // UIのフリーズを防ぐため非同期で処理
    setTimeout(() => {
        const SEARCH_DEPTH = 2; // 2手先まで読む
        const bestMove = searchBestMove(gridState, currentTemp, currentFocus, SEARCH_DEPTH);

        if (bestMove && bestMove.skill) {
            const cellLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
            let targetText = typeof bestMove.target === 'number' ? `マス${cellLetters[bestMove.target]}` : '全体';
            
            aiBox.innerHTML = `おすすめ: <strong>${bestMove.skill.name}</strong> を <strong>${targetText}</strong> に打つ<br>
            <span style="font-size:0.8em; color:#ccc;">(先読み評価スコア: ${bestMove.score.toFixed(1)})</span>`;
        } else {
            aiBox.innerHTML = `おすすめ: <strong>火力上げ</strong> または <strong>冷やし込み</strong> で温度を調整してください`;
        }
    }, 10);
}

function searchBestMove(state, temp, focus, depth) {
    let bestSkill = null;
    let bestTarget = null;
    let bestScore = -Infinity;
    
    const level = parseInt(document.getElementById("artisan-level").value) || 80;
    let critRateBase = document.getElementById("has-kotsu").checked ? 0.02 : 0.01;
    critRateBase += 0.046; 

    SKILLS.forEach(skill => {
        if (level < skill.reqLevel || focus < skill.focus) return;

        let targets = [];
        if (skill.type === "temp") {
            targets = [null]; 
        } else {
            state.forEach((s, i) => { 
                if (!s.isLocked && s.value < s.max) targets.push(i); 
            });
        }

        targets.forEach(target => {
            let expectedScore = 0;
            const nextFocus = focus - skill.focus;
            
            if (skill.type === "temp") {
                let nextTemp = Math.min(MAX_TEMP, Math.max(MIN_TEMP, temp + skill.tempChange));
                expectedScore = evaluateBoardState(state, nextFocus); 
                
                if (depth > 1) {
                    let nextBest = searchBestMove(state, nextTemp, nextFocus, depth - 1);
                    if (nextBest) expectedScore += nextBest.score * 0.8; 
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

                samples.forEach(sample => {
                    let nextStateNorm = JSON.parse(JSON.stringify(state));
                    nextStateNorm[target].value += sample.val;
                    let scoreNorm = evaluateBoardState(nextStateNorm, nextFocus);
                    
                    if (depth > 1 && scoreNorm > -500) { 
                        let nb = searchBestMove(nextStateNorm, temp - 50, nextFocus, depth - 1);
                        if (nb) scoreNorm = (scoreNorm + nb.score) / 2;
                    }

                    let nextStateCrit = JSON.parse(JSON.stringify(state));
                    nextStateCrit[target].value += (sample.val * 2);
                    let scoreCrit = evaluateBoardState(nextStateCrit, nextFocus);
                    
                    if (depth > 1 && scoreCrit > -500) {
                        let nb = searchBestMove(nextStateCrit, temp - 50, nextFocus, depth - 1);
                        if (nb) scoreCrit = (scoreCrit + nb.score) / 2;
                    }

                    totalScore += (scoreNorm * (1 - currentCritRate) + scoreCrit * currentCritRate) * sample.prob;
                });
                
                expectedScore = totalScore;
            }

            if (expectedScore > bestScore) {
                bestScore = expectedScore;
                bestSkill = skill;
                bestTarget = target;
            }
        });
    });

    return { skill: bestSkill, target: bestTarget, score: bestScore };
}

// 盤面と残り集中力の評価
function evaluateBoardState(state, currentFocus) {
    let score = 0;
    let totalShortfall = 0; // 目標に足りていない合計値
    
    state.forEach(s => {
        if (s.value > s.max) {
            score -= 1000; // はみ出しは特大ペナルティ
        } else if (s.value >= s.min && s.value <= s.max) {
            score += 150; // 成功ゾーン
        } else {
            let shortfall = s.min - s.value;
            score -= shortfall; // 足りない距離だけマイナス
            totalShortfall += shortfall;
        }
    });

    // 集中力が残っているほどプラス評価（無駄なスキルを避ける）
    score += currentFocus * 1.5;

    // もし届いていないマスがあるのに集中力が枯渇しそうなら重いペナルティ
    if (totalShortfall > 0 && currentFocus < 10) {
        score -= 500;
    }
    
    return score;
}

// ==========================================
// 入力モーダル関連
// ==========================================
let activeSkill = null;
let activeTarget = null;

function openInputModal(skillName, targetIndex) {
    activeSkill = SKILLS.find(s => s.name === skillName);
    activeTarget = targetIndex;
    document.getElementById("modal-skill-info").textContent = `使用スキル: ${skillName} (対象: ${targetIndex + 1}マス目)`;
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
        if (document.getElementById("check-critical").checked) dmg = val * 2; 
        gridState[activeTarget].value += dmg;
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
