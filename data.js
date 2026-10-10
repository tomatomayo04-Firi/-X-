// ==========================================
// data.js - 各種データ定義と外部データ取得
// ==========================================

const MAX_TEMP = 2000;
const MIN_TEMP = 0;
const TEMP_STEP = 50;

// レベルごとの集中力初期値 (1〜80レベル)
const FOCUS_BY_LEVEL = {
    1: 50, 2: 52, 3: 53, 4: 56, 5: 57, 6: 60, 7: 61, 8: 64, 9: 67, 10: 67,
    11: 70, 12: 73, 13: 73, 14: 76, 15: 79, 16: 79, 17: 82, 18: 84, 19: 87, 20: 87,
    21: 90, 22: 93, 23: 93, 24: 96, 25: 98, 26: 101, 27: 101, 28: 104, 29: 109, 30: 109,
    31: 112, 32: 113, 33: 113, 34: 115, 35: 119, 36: 122, 37: 123, 38: 123, 39: 125, 40: 129,
    41: 132, 42: 134, 43: 137, 44: 139, 45: 142, 46: 142, 47: 144, 48: 147, 49: 149, 50: 152,
    51: 152, 52: 154, 53: 157, 54: 159, 55: 162, 56: 162, 57: 164, 58: 167, 59: 169, 60: 169,
    61: 171, 62: 171, 63: 173, 64: 175, 65: 177, 66: 180, 67: 182, 68: 184, 69: 186, 70: 188,
    71: 189, 72: 191, 73: 193, 74: 195, 75: 197, 76: 199, 77: 201, 78: 203, 79: 205, 80: 207
};

// スキル一覧
const SKILLS = [
    { id: "たたく", name: "たたく", type: "normal", mult: 1.0, focus: 5, reqLevel: 1 },
    { id: "上下打ち", name: "上下打ち", type: "multi", mult: 1.2, focus: 8, reqLevel: 2 },
    { id: "てかげん打ち", name: "てかげん打ち", type: "normal", mult: 0.5, focus: 10, reqLevel: 3 },
    { id: "2倍打ち", name: "2倍打ち", type: "normal", mult: 2.0, focus: 8, reqLevel: 5 },
    { id: "火力上げ", name: "火力上げ", type: "temp", tempChange: 300, focus: 10, reqLevel: 7 },
    { id: "4連打ち", name: "4連打ち", type: "multi", mult: 1.2, focus: 12, reqLevel: 11 },
    { id: "みだれ打ち", name: "みだれ打ち", type: "random", mult: 0.8, focus: 7, reqLevel: 13 },
    { id: "3倍打ち", name: "3倍打ち", type: "normal", mult: 3.0, focus: 11, reqLevel: 16 },
    { id: "ねらい打ち", name: "ねらい打ち", type: "normal", mult: 1.0, focus: 16, reqLevel: 23, isCritUp: true },
    { id: "超4連打ち", name: "超4連打ち", type: "multi", mult: 2.0, focus: 18, reqLevel: 27 },
    { id: "冷やし込み", name: "冷やし込み", type: "temp", tempChange: -300, focus: 12, reqLevel: 33 },
    { id: "ななめ打ち", name: "ななめ打ち", type: "multi", mult: 1.2, focus: 7, reqLevel: 38 },
    { id: "熱風おろし", name: "熱風おろし", type: "normal", mult: 2.5, focus: 6, reqLevel: 47, specialTempDrop: 150 },
    { id: "弱ねらい打ち", name: "弱ねらい打ち", type: "normal", mult: 0.5, focus: 20, reqLevel: 75, isCritUp: true },
    { id: "左右打ち", name: "左右打ち", type: "multi", mult: 1.2, focus: 8, reqLevel: 80 }
];

// 装備部位ごとのマス配置 (空白は null で管理)
const EQUIP_LAYOUTS = {
    "小盾": { rows: 2, cols: 2, cells: ["A", "B", "C", "D"] },
    "大盾": { rows: 2, cols: 2, cells: ["A", "B", "C", "D"] },
    "アタマ": { rows: 2, cols: 2, cells: ["A", "B", "C", "D"] },
    "からだ上": { rows: 3, cols: 2, cells: ["A", "B", "C", "D", "E", "F"] },
    "からだ下": { rows: 4, cols: 2, cells: ["A", "B", "C", "D", "E", "F", "G", "H"] },
    "ウデ": { rows: 3, cols: 1, cells: ["A", "B", "C"] },
    "足": { rows: 3, cols: 2, cells: [null, "A", null, "B", "C", "D"] }
};

// --- 温度ごとの威力データ ---
const BASE_DAMAGE_RANGES = {
    2000: {min: 18, max: 27}, 1950: {min: 18, max: 27}, 1900: {min: 18, max: 27},
    1850: {min: 18, max: 26}, 1800: {min: 17, max: 26}, 1750: {min: 17, max: 25},
    1700: {min: 17, max: 25}, 1650: {min: 16, max: 24}, 1600: {min: 16, max: 24},
    1550: {min: 16, max: 23}, 1500: {min: 15, max: 23}, 1450: {min: 15, max: 23},
    1400: {min: 15, max: 22}, 1350: {min: 15, max: 22}, 1300: {min: 14, max: 21},
    1250: {min: 14, max: 21}, 1200: {min: 14, max: 20}, 1150: {min: 13, max: 20},
    1100: {min: 13, max: 19}, 1050: {min: 13, max: 19}, 1000: {min: 12, max: 18},
    950:  {min: 12, max: 18}, 900:  {min: 12, max: 18}, 850:  {min: 12, max: 17},
    800:  {min: 11, max: 17}, 750:  {min: 11, max: 16}, 700:  {min: 11, max: 16},
    650:  {min: 10, max: 15}, 600:  {min: 10, max: 15}, 550:  {min: 10, max: 14},
    500:  {min: 9,  max: 14}, 450:  {min: 9,  max: 14}, 400:  {min: 9,  max: 13},
    350:  {min: 9,  max: 13}, 300:  {min: 8,  max: 12}, 250:  {min: 8,  max: 12},
    200:  {min: 8,  max: 11}, 150:  {min: 7,  max: 11}, 100:  {min: 7,  max: 10},
    50:   {min: 7,  max: 10}
};

function getDamageDistribution(temp, mult) {
    let base = BASE_DAMAGE_RANGES[temp];
    if (!base) return [];
    let dist = [];
    for (let i = base.min; i <= base.max; i++) {
        let val = Math.floor(i * mult);
        if (!dist.includes(val)) dist.push(val);
    }
    return dist.sort((a,b) => a - b);
}

// --- レシピ読み込み処理（エラー制御・タイムアウト付き） ---
const DRIVE_FILE_ID = "1R-Y0zsQq2LMHP3lfq8IdHy9WvZMZee9A";
let RECIPES = []; 
window.recipeLoadWarning = ""; // エラーメッセージ用変数

// タイムアウト付きフェッチ
async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
}

async function loadRecipeData() {
    window.recipeLoadWarning = ""; // 初期化
    const directUrl = encodeURIComponent(`https://drive.google.com/uc?export=download&id=${DRIVE_FILE_ID}`);
    // プロキシを2種類用意（どちらか成功すればOK）
    const proxies = [
        `https://api.allorigins.win/raw?url=${directUrl}`,
        `https://corsproxy.io/?${directUrl}`
    ];

    let textData = null;

    // 通信フリーズを防ぐため、各プロキシ最大4秒で諦める
    for (let url of proxies) {
        try {
            const res = await fetchWithTimeout(url, 4000);
            if (res.ok) {
                const text = await res.text();
                // 取得データがHTMLエラーページでないかを判定
                if (text && (text.includes("小盾") || text.includes("大盾"))) {
                    textData = text;
                    break;
                }
            }
        } catch (e) {
            console.warn("プロキシ接続失敗:", e);
        }
    }

    if (textData) {
        parseRecipeText(textData);
        return true;
    } else {
        // 取得失敗時にエラーメッセージとファイルアップロードUIを生成
        window.recipeLoadWarning = `
            <li style="background:#552222; padding:15px; margin-bottom:10px; border-radius:5px;">
                ⚠️ 外部データの自動読み込みがブロックされました。<br>
                <span style="font-size:0.8em; color:#ddd;">(ブラウザのセキュリティ設定等が原因です)</span><br><br>
                以下のボタンから、お手元の <b>「防具鍛治レシピ.txt」</b> を直接選択してください。<br>
                <label style="display:inline-block; margin-top:10px; padding:10px 20px; background:#e09f3e; color:#000; font-weight:bold; cursor:pointer; border-radius:5px;">
                    ▶ ローカルのレシピデータ(.txt)を読み込む
                    <input type="file" id="local-file-input" accept=".txt" style="display:none;">
                </label>
            </li>
        `;
        // 何も表示されないのを防ぐため、最低限の予備データを追加
        fallbackRecipes();
        return false;
    }
}

function parseRecipeText(text) {
    RECIPES = [];
    const lines = text.split('\n');
    
    lines.forEach(line => {
        line = line.replace(/ /g, ' ').trim();
        if (line === "" || line.startsWith('ー')) return; 

        let parts = line.split(/\s+/);
        if (parts.length >= 6) {
            let targets = [];
            let isCrystal = false;
            
            for (let i = 5; i < parts.length; i++) {
                if (parts[i].includes('-')) {
                    let vals = parts[i].split('-');
                    targets.push({ min: parseInt(vals[0]), max: parseInt(vals[1]) });
                } else if (parts[i] === '結晶') {
                    isCrystal = true;
                }
            }

            RECIPES.push({
                name: parts[0], category: parts[1], 
                createLv: parseInt(parts[2]) || 1, equipLv: parseInt(parts[3]) || 1, 
                jiganeType: parts[4], targets: targets, isCrystal: isCrystal
            });
        }
    });
}

function fallbackRecipes() {
    RECIPES = [
        { name: "【予備】メタスラの盾", category: "小盾", createLv: 33, equipLv: 60, jiganeType: "集中変化", targets: [{min:200,max:214},{min:160,max:166},{min:120,max:128},{min:150,max:158}], isCrystal: true },
        { name: "【予備】みずがめの大盾", category: "大盾", createLv: 75, equipLv: 128, jiganeType: "光", targets: [{min:468,max:476},{min:282,max:290},{min:502,max:510},{min:232,max:240}], isCrystal: false }
    ];
}
