// ==========================================
// app.js - 完全一本化・即座起動バージョン
// ==========================================
const UPDATE_VERSION = "Ver 12.2 (完全一本化版)";

// スタイル適用
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

#smithing-grid { display: grid; gap: 4px; justify-content: center; margin: 20px auto; padding: 10px; background: #222; border-radius: 8px; width: fit-content; }
.forge-cell-container { width: 60px; height: 180px; position: relative; }
.forge-cell-container.blank { background: rgba(255,255,255,0.05); border: 1px dashed #444; cursor: pointer; }
.forge-cell { width: 100%; height: 100%; position: absolute; top:0; left:0; background: #333; border: 2px solid #555; border-radius: 4px; overflow: hidden; display: flex; flex-direction: column; justify-content: flex-end; }
.forge-cell-container.targeting { border-color: #00bcd4; box-shadow: 0 0 12px #00bcd4 inset; }
.forge-cell-container.targeting:hover { background: rgba(0, 188, 212, 0.2); }
.gauge-target-zone { position: absolute; width: 100%; background: rgba(76, 175, 80, 0.4); border-top: 2px solid #4CAF50; border-bottom: 2px solid #4CAF50; z-index: 1; }
.gauge-fill { width: 100%; background: #e09f3e; transition: height 0.3s ease-out; z-index: 2; position: absolute; bottom: 0; }
.gauge-text { position: absolute; width: 100%; text-align: center; top: 5px; color: white; font-weight: bold; text-shadow: 1px 1px 2px black; z-index: 3; }
.cell-lock-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 24px; z-index: 10; }
#jigane-buff-display { text-align: center; font-weight: bold; color: #ffeb3b; margin: 10px; font-size: 1.1em; }
.skill-btn.finish-btn { background: #4CAF50; border-color: #388E3C; font-weight: bold; width: 100%; margin-top: 10px; }
`;
document.head.appendChild(style);

// マスタデータ
const FOCUS_BY_LEVEL = { 75: 197, 76: 199, 77: 201, 78: 203, 79: 205, 80: 207 };

const EQUIP_LAYOUTS = {
    "アタマ":   { w: 2, h: 2, map: [1,1, 1,1] },
    "小盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "大盾":     { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ上": { w: 2, h: 2, map: [1,1, 1,1] },
    "からだ下": { w: 2, h: 4, map: [1,1, 1,1, 1,1, 1,1] },
    "ウデ":     { w: 1, h: 3, map: [1, 1, 1] },
    "足":       { w: 2, h: 3, map: [0,1, 0,1, 1,1] }
};

const SKILLS = [
    { name: "たたく", req_lv: 1, cost: 5, mult: 1.0, type: "single" },
    { name: "2倍打ち", req_lv: 5, cost: 8, mult: 2.0, type: "single" },
    { name: "3倍打ち", req_lv: 16, cost: 11, mult: 3.0, type: "single" },
    { name: "てかげん打ち", req_lv: 3, cost: 10, mult: 0.5, type: "single" },
    { name: "ねらい打ち", req_lv: 23, cost: 16, mult: 1.0, type: "single", crit_up: "nerai" },
    { name: "上下打ち", req_lv: 2, cost: 8, mult: 1.2, type: "multi" },
    { name: "左右打ち", req_lv: 80, cost: 8, mult: 1.2, type: "multi" },
    { name: "火力上げ", req_lv: 7, cost: 10, mult: 0.0, type: "temp", temp_change: 300 },
    { name: "冷やし込み", req_lv: 33, cost: 12, mult: 0.0, type: "temp", temp_change: -300 },
    { name: "しあげる", req_lv: 1, cost: 0, mult: 0.0, type: "finish" }
];

const RECIPES = [
  {
    "name": "メタスラの盾",
    "category": "小盾",
    "jigane": "集中変化",
    "targets": [
      { "min": 200, "max": 214 },
      { "min": 160, "max": 166 },
      { "min": 120, "max": 128 },
      { "min": 150, "max": 158 }
    ]
  },
  {
    "name": "ブルームシールド",
    "category": "小盾",
    "jigane": "集中変化",
    "targets": [
      { "min": 207, "max": 213 },
      { "min": 255, "max": 267 },
      { "min": 255, "max": 267 },
      { "min": 207, "max": 213 }
    ]
  },
  {
    "name": "鷲王の盾",
    "category": "小盾",
    "jigane": "光",
    "targets": [
      { "min": 240, "max": 250 },
      { "min": 240, "max": 250 },
      { "min": 274, "max": 282 },
      { "min": 280, "max": 290 }
    ]
  },
  {
    "name": "ブルバックラー",
    "category": "小盾",
    "jigane": "光",
    "targets": [
      { "min": 280, "max": 290 },
      { "min": 280, "max": 290 },
      { "min": 252, "max": 260 },
      { "min": 252, "max": 260 }
    ]
  },
  {
    "name": "ブレスガーダー",
    "category": "小盾",
    "jigane": "戻り",
    "targets": [
      { "min": 260, "max": 270 },
      { "min": 260, "max": 270 },
      { "min": 200, "max": 208 },
      { "min": 200, "max": 208 }
    ]
  },
  {
    "name": "ミニュアデスの盾",
    "category": "小盾",
    "jigane": "倍半",
    "targets": [
      { "min": 200, "max": 208 },
      { "min": 200, "max": 208 },
      { "min": 285, "max": 294 },
      { "min": 285, "max": 294 }
    ]
  },
  {
    "name": "メテオシールド",
    "category": "小盾",
    "jigane": "光",
    "targets": [
      { "min": 302, "max": 310 },
      { "min": 302, "max": 310 },
      { "min": 278, "max": 286 },
      { "min": 278, "max": 286 }
    ]
  },
  {
    "name": "アクエリアスガード",
    "category": "小盾",
    "jigane": "倍半",
    "targets": [
      { "min": 345, "max": 353 },
      { "min": 240, "max": 247 },
      { "min": 275, "max": 283 },
      { "min": 375, "max": 383 }
    ]
  },
  {
    "name": "プロミネンスの盾",
    "category": "小盾",
    "jigane": "戻り",
    "targets": [
      { "min": 170, "max": 177 },
      { "min": 340, "max": 348 },
      { "min": 300, "max": 308 },
      { "min": 190, "max": 198 }
    ]
  },
  {
    "name": "輝紋章の盾",
    "category": "小盾",
    "jigane": "光",
    "targets": [
      { "min": 260, "max": 268 },
      { "min": 400, "max": 408 },
      { "min": 380, "max": 388 },
      { "min": 190, "max": 197 }
    ]
  },
  {
    "name": "メタリオンガード",
    "category": "小盾",
    "jigane": "集中変化",
    "targets": [
      { "min": 330, "max": 338 },
      { "min": 280, "max": 288 },
      { "min": 170, "max": 177 },
      { "min": 390, "max": 398 }
    ]
  },
  {
    "name": "天球の大盾",
    "category": "大盾",
    "jigane": "集中変化",
    "targets": [
      { "min": 302, "max": 310 },
      { "min": 302, "max": 310 },
      { "min": 278, "max": 286 },
      { "min": 278, "max": 286 }
    ]
  },
 {
    "name": "みずがめの大盾",
    "category": "大盾",
    "jigane": "光",
    "targets": [
      { "min": 468, "max": 476 },
      { "min": 282, "max": 290 },
      { "min": 502, "max": 510 },
      { "min": 232, "max": 240 }
    ]
  },
 {
    "name": "古代鏡の大盾",
    "category": "大盾",
    "jigane": "倍半",
    "targets": [
      { "min": 295, "max": 303 },
      { "min": 240, "max": 248 },
      { "min": 200, "max": 208 },
      { "min": 315, "max": 323 }
    ]
  },
 {
    "name": "神樹の大盾",
    "category": "大盾",
    "jigane": "集中変化",
    "targets": [
      { "min": 250, "max": 258 },
      { "min": 230, "max": 238 },
      { "min": 310, "max": 318 },
      { "min": 350, "max": 358 }
    ]
  },
 {
    "name": "メタリオンシールド",
    "category": "大盾",
    "jigane": "光",
    "targets": [
      { "min": 282, "max": 290 },
      { "min": 512, "max": 520 },
      { "min": 432, "max": 440 },
      { "min": 230, "max": 238 }
    ]
  },
 {
    "name": "ゴシックハット",
    "category": "アタマ",
    "jigane": "集中変化",
    "targets": [
      { "min": 120, "max": 128 },
      { "min": 120, "max": 128 },
      { "min": 195, "max": 205 },
      { "min": 195, "max": 205 }
    ]
  },
 {
    "name": "ゴシックミトラ",
    "category": "アタマ",
    "jigane": "集中変化",
    "targets": [
      { "min": 148, "max": 154 },
      { "min": 116, "max": 124 },
      { "min": 190, "max": 202 },
      { "min": 176, "max": 186 }
    ]
  },
 {
    "name": "ガナドールバンド",
    "category": "アタマ",
    "jigane": "光",
    "targets": [
      { "min": 190, "max": 200 },
      { "min": 280, "max": 288 },
      { "min": 190, "max": 200 },
      { "min": 340, "max": 346 }
    ]
  },
 {
    "name": "聖域の額当て",
    "category": "アタマ",
    "jigane": "光",
    "targets": [
      { "min": 300, "max": 308 },
      { "min": 300, "max": 308 },
      { "min": 240, "max": 249 },
      { "min": 240, "max": 249 }
    ]
  },
 {
    "name": "魔衛隊士のかぶと",
    "category": "アタマ",
    "jigane": "集中変化",
    "targets": [
      { "min": 235, "max": 243 },
      { "min": 235, "max": 243 },
      { "min": 300, "max": 309 },
      { "min": 300, "max": 309 }
    ]
  },
 {
    "name": "黒夜叉のかぶと",
    "category": "アタマ",
    "jigane": "倍半",
    "targets": [
      { "min": 290, "max": 298 },
      { "min": 265, "max": 273 },
      { "min": 300, "max": 309 },
      { "min": 335, "max": 345 }
    ]
  },
 {
    "name": "一角鬼の額当て",
    "category": "アタマ",
    "jigane": "戻り",
    "targets": [
      { "min": 225, "max": 233 },
      { "min": 245, "max": 253 },
      { "min": 290, "max": 299 },
      { "min": 325, "max": 334 }
    ]
  },
 {
    "name": "トライドニット",
    "category": "アタマ",
    "jigane": "光",
    "targets": [
      { "min": 345, "max": 354 },
      { "min": 210, "max": 218 },
      { "min": 260, "max": 268 },
      { "min": 440, "max": 449 }
    ]
  },
 {
    "name": "コスモスヘルム",
    "category": "アタマ",
    "jigane": "集中変化",
    "targets": [
      { "min": 240, "max": 248 },
      { "min": 360, "max": 369 },
      { "min": 320, "max": 329 },
      { "min": 270, "max": 278 }
    ]
  },
 {
    "name": "ラッシュバンド",
    "category": "アタマ",
    "jigane": "集中変化",
    "targets": [
      { "min": 320, "max": 329 },
      { "min": 370, "max": 379 },
      { "min": 230, "max": 238 },
      { "min": 250, "max": 258 }
    ]
  },
 {
    "name": "機甲兵のレシーバー",
    "category": "アタマ",
    "jigane": "倍半",
    "targets": [
      { "min": 345, "max": 354 },
      { "min": 210, "max": 218 },
      { "min": 260, "max": 268 },
      { "min": 440, "max": 449 }
    ]
  },
 {
    "name": "ゴシックビスチェ",
    "category": "からだ上",
    "jigane": "集中変化",
    "targets": [
      { "min": 129, "max": 137 },
      { "min": 129, "max": 137 },
      { "min": 106, "max": 112 },
      { "min": 106, "max": 112 },
      { "min": 80, "max": 91 },
      { "min": 80, "max": 91 }
    ]
  },
 {
    "name": "ゴシックコート上",
    "category": "からだ上",
    "jigane": "集中変化",
    "targets": [
      { "min": 145, "max": 151 },
      { "min": 145, "max": 151 },
      { "min": 100, "max": 111 },
      { "min": 100, "max": 111 },
      { "min": 70, "max": 78 },
      { "min": 70, "max": 78 }
    ]
  },
 {
    "name": "ガナドールスーツ上",
    "category": "からだ上",
    "jigane": "光",
    "targets": [
      { "min": 150, "max": 160 },
      { "min": 230, "max": 240 },
      { "min": 150, "max": 160 },
      { "min": 230, "max": 240 },
      { "min": 125, "max": 133 },
      { "min": 125, "max": 133 }
    ]
  },
 {
    "name": "聖域の闘衣上",
    "category": "からだ上",
    "jigane": "光",
    "targets": [
      { "min": 140, "max": 148 },
      { "min": 300, "max": 310 },
      { "min": 200, "max": 209 },
      { "min": 140, "max": 148 },
      { "min": 140, "max": 148 },
      { "min": 200, "max": 209 }
    ]
  },
 {
    "name": "魔衛隊士のよろい上",
    "category": "からだ上",
    "jigane": "倍半",
    "targets": [
      { "min": 250, "max": 260 },
      { "min": 250, "max": 260 },
      { "min": 185, "max": 193 },
      { "min": 185, "max": 193 },
      { "min": 140, "max": 148 },
      { "min": 140, "max": 148 }
    ]
  },
 {
    "name": "黒夜叉のよろい上",
    "category": "からだ上",
    "jigane": "光",
    "targets": [
      { "min": 160, "max": 168 },
      { "min": 190, "max": 198 },
      { "min": 190, "max": 198 },
      { "min": 200, "max": 208 },
      { "min": 270, "max": 280 },
      { "min": 250, "max": 260 }
    ]
  },
 {
    "name": "一角鬼の闘着上",
    "category": "からだ上",
    "jigane": "戻り",
    "targets": [
      { "min": 130, "max": 138 },
      { "min": 160, "max": 168 },
      { "min": 185, "max": 194 },
      { "min": 170, "max": 179 },
      { "min": 220, "max": 229 },
      { "min": 190, "max": 199 }
    ]
  },
 {
    "name": "トライドアーマー",
    "category": "からだ上",
    "jigane": "戻り",
    "targets": [
      { "min": 140, "max": 149 },
      { "min": 225, "max": 234 },
      { "min": 115, "max": 123 },
      { "min": 140, "max": 148 },
      { "min": 210, "max": 219 },
      { "min": 175, "max": 184 }
    ]
  },
 {
    "name": "コスモスアーマー上",
    "category": "からだ上",
    "jigane": "倍半",
    "targets": [
      { "min": 140, "max": 149 },
      { "min": 150, "max": 158 },
      { "min": 110, "max": 118 },
      { "min": 290, "max": 299 },
      { "min": 180, "max": 188 },
      { "min": 250, "max": 259 }
    ]
  },
 {
    "name": "ラッシュジャケット",
    "category": "からだ上",
    "jigane": "光",
    "targets": [
      { "min": 150, "max": 158 },
      { "min": 260, "max": 269 },
      { "min": 300, "max": 309 },
      { "min": 140, "max": 148 },
      { "min": 250, "max": 259 },
      { "min": 195, "max": 204 }
    ]
  },
 {
    "name": "機甲兵のよろい上",
    "category": "からだ上",
    "jigane": "戻り",
    "targets": [
      { "min": 235, "max": 244 },
      { "min": 105, "max": 113 },
      { "min": 125, "max": 133 },
      { "min": 150, "max": 159 },
      { "min": 170, "max": 179 },
      { "min": 220, "max": 229 }
    ]
  },
 {
    "name": "ゴシックフリル",
    "category": "からだ下",
    "jigane": "集中変化",
    "targets": [
      { "min": 56, "max": 62 },
      { "min": 56, "max": 62 },
      { "min": 72, "max": 80 },
      { "min": 72, "max": 80 },
      { "min": 80, "max": 92 },
      { "min": 80, "max": 92 },
      { "min": 107, "max": 115 },
      { "min": 107, "max": 115 }
    ]
  },
 {
    "name": "ゴシックコート下",
    "category": "からだ下",
    "jigane": "集中変化",
    "targets": [
      { "min": 74, "max": 82 },
      { "min": 74, "max": 82 },
      { "min": 87, "max": 94 },
      { "min": 87, "max": 94 },
      { "min": 80, "max": 93 },
      { "min": 80, "max": 93 },
      { "min": 74, "max": 80 },
      { "min": 74, "max": 80 }
    ]
  },
 {
    "name": "ガナドールスーツ下",
    "category": "からだ下",
    "jigane": "光",
    "targets": [
      { "min": 150, "max": 160 },
      { "min": 150, "max": 160 },
      { "min": 120, "max": 128 },
      { "min": 160, "max": 170 },
      { "min": 105, "max": 115 },
      { "min": 105, "max": 115 },
      { "min": 90, "max": 100 },
      { "min": 90, "max": 100 }
    ]
  },
 {
    "name": "聖域の闘衣下",
    "category": "からだ下",
    "jigane": "光",
    "targets": [
      { "min": 200, "max": 208 },
      { "min": 120, "max": 128 },
      { "min": 170, "max": 179 },
      { "min": 120, "max": 128 },
      { "min": 170, "max": 179 },
      { "min": 120, "max": 128 },
      { "min": 100, "max": 110 },
      { "min": 100, "max": 110 }
    ]
  },
 {
    "name": "魔衛隊士のよろい下",
    "category": "からだ下",
    "jigane": "戻り",
    "targets": [
      { "min": 180, "max": 188 },
      { "min": 140, "max": 148 },
      { "min": 140, "max": 148 },
      { "min": 180, "max": 188 },
      { "min": 90, "max": 100 },
      { "min": 90, "max": 100 },
      { "min": 120, "max": 128 },
      { "min": 120, "max": 128 }
    ]
  },
 {
    "name": "黒夜叉のよろい下",
    "category": "からだ下",
    "jigane": "倍半",
    "targets": [
      { "min": 130, "max": 138 },
      { "min": 135, "max": 144 },
      { "min": 100, "max": 108 },
      { "min": 95, "max": 103 },
      { "min": 210, "max": 219 },
      { "min": 150, "max": 159 },
      { "min": 140, "max": 148 },
      { "min": 115, "max": 124 }
    ]
  },
 {
    "name": "一角鬼の闘着下",
    "category": "からだ下",
    "jigane": "集中変化",
    "targets": [
      { "min": 110, "max": 118 },
      { "min": 120, "max": 128 },
      { "min": 200, "max": 210 },
      { "min": 220, "max": 230 },
      { "min": 170, "max": 178 },
      { "min": 140, "max": 148 },
      { "min": 120, "max": 128 },
      { "min": 100, "max": 108 }
    ]
  },
 {
    "name": "トライドズボン",
    "category": "からだ下",
    "jigane": "集中変化",
    "targets": [
      { "min": 170, "max": 179 },
      { "min": 95, "max": 103 },
      { "min": 200, "max": 209 },
      { "min": 130, "max": 138 },
      { "min": 100, "max": 108 },
      { "min": 230, "max": 239 },
      { "min": 120, "max": 128 },
      { "min": 140, "max": 148 }
    ]
  },
 {
    "name": "コスモスアーマー下",
    "category": "からだ下",
    "jigane": "倍半",
    "targets": [
      { "min": 110, "max": 118 },
      { "min": 170, "max": 179 },
      { "min": 220, "max": 229 },
      { "min": 110, "max": 118 },
      { "min": 120, "max": 128 },
      { "min": 140, "max": 149 },
      { "min": 140, "max": 149 },
      { "min": 105, "max": 113 }
    ]
  },
 {
    "name": "ラッシュボトム",
    "category": "からだ下",
    "jigane": "集中変化",
    "targets": [
      { "min": 160, "max": 169 },
      { "min": 110, "max": 118 },
      { "min": 120, "max": 128 },
      { "min": 180, "max": 189 },
      { "min": 225, "max": 234 },
      { "min": 90, "max": 98 },
      { "min": 100, "max": 108 },
      { "min": 140, "max": 149 }
    ]
  },
 {
    "name": "機甲兵のよろい下",
    "category": "からだ下",
    "jigane": "集中変化",
    "targets": [
      { "min": 90, "max": 98 },
      { "min": 150, "max": 159 },
      { "min": 210, "max": 219 },
      { "min": 95, "max": 103 },
      { "min": 130, "max": 139 },
      { "min": 105, "max": 113 },
      { "min": 85, "max": 93 },
      { "min": 125, "max": 134 }
    ]
  },

 {
    "name": "ラッシュボトム",
    "category": "からだ下",
    "jigane": "集中変化",
    "targets": [
      { "min": 160, "max": 169 },
      { "min": 110, "max": 118 },
      { "min": 120, "max": 128 },
      { "min": 180, "max": 189 },
      { "min": 225, "max": 234 },
      { "min": 90, "max": 98 },
      { "min": 100, "max": 108 },
      { "min": 140, "max": 149 }
    ]
  },
 {
    "name": "ゴシックアーム",
    "category": "ウデ",
    "jigane": "集中変化",
    "targets": [
      { "min": 180, "max": 191 },
      { "min": 225, "max": 231 },
      { "min": 225, "max": 235 }
    ]
  },
 {
    "name": "ゴシックグローブ",
    "category": "ウデ",
    "jigane": "集中変化",
    "targets": [
      { "min": 210, "max": 216 },
      { "min": 210, "max": 219 },
      { "min": 210, "max": 222 }
    ]
  },
 {
    "name": "ガナドールグローブ",
    "category": "ウデ",
    "jigane": "光",
    "targets": [
      { "min": 338, "max": 345 },
      { "min": 280, "max": 288 },
      { "min": 360, "max": 370 }
    ]
  },
 {
    "name": "聖域のこて",
    "category": "ウデ",
    "jigane": "光",
    "targets": [
      { "min": 350, "max": 359 },
      { "min": 350, "max": 359 },
      { "min": 400, "max": 410 }
    ]
  },
 {
    "name": "魔衛隊士のこて",
    "category": "ウデ",
    "jigane": "光",
    "targets": [
      { "min": 460, "max": 470 },
      { "min": 370, "max": 378 },
      { "min": 320, "max": 328 }
    ]
  },
 {
    "name": "黒夜叉のこて",
    "category": "ウデ",
    "jigane": "倍半",
    "targets": [
      { "min": 360, "max": 369 },
      { "min": 415, "max": 425 },
      { "min": 310, "max": 318 }
    ]
  },
 {
    "name": "一角鬼の手甲",
    "category": "ウデ",
    "jigane": "集中変化",
    "targets": [
      { "min": 340, "max": 349 },
      { "min": 290, "max": 299 },
      { "min": 410, "max": 419 }
    ]
  },
 {
    "name": "トライドグローブ",
    "category": "ウデ",
    "jigane": "光",
    "targets": [
      { "min": 470, "max": 479 },
      { "min": 260, "max": 269 },
      { "min": 495, "max": 504 }
    ]
  },
 {
    "name": "コスモスのこて",
    "category": "ウデ",
    "jigane": "集中変化",
    "targets": [
      { "min": 405, "max": 414 },
      { "min": 270, "max": 279 },
      { "min": 360, "max": 369 }
    ]
  },
 {
    "name": "ラッシュグローブ",
    "category": "ウデ",
    "jigane": "倍半",
    "targets": [
      { "min": 360, "max": 369 },
      { "min": 255, "max": 264 },
      { "min": 460, "max": 469 }
    ]
  },
 {
    "name": "機甲兵のこて",
    "category": "ウデ",
    "jigane": "集中変化",
    "targets": [
      { "min": 350, "max": 359 },
      { "min": 290, "max": 299 },
      { "min": 430, "max": 439 }
    ]
  },
 {
    "name": "ゴシックニーソ",
    "category": "足",
    "jigane": "集中変化",
    "targets": [
      { "min": 190, "max": 204 },
      { "min": 170, "max": 174 },
      { "min": 160, "max": 176 },
      { "min": 110, "max": 120 }
    ]
  },
 {
    "name": "ゴシックブーツ",
    "category": "足",
    "jigane": "集中変化",
    "targets": [
      { "min": 180, "max": 192 },
      { "min": 170, "max": 178 },
      { "min": 155, "max": 163 },
      { "min": 125, "max": 131 }
    ]
  },
 {
    "name": "ガナドールブーツ",
    "category": "足",
    "jigane": "光",
    "targets": [
      { "min": 310, "max": 318 },
      { "min": 240, "max": 250 },
      { "min": 190, "max": 200 },
      { "min": 240, "max": 250 }
    ]
  },
 {
    "name": "聖域のブーツ",
    "category": "足",
    "jigane": "光",
    "targets": [
      { "min": 350, "max": 360 },
      { "min": 230, "max": 238 },
      { "min": 300, "max": 310 },
      { "min": 230, "max": 238 }
    ]
  },
 {
    "name": "魔衛隊士のグリーブ",
    "category": "足",
    "jigane": "倍半",
    "targets": [
      { "min": 340, "max": 350 },
      { "min": 190, "max": 198 },
      { "min": 300, "max": 310 },
      { "min": 190, "max": 198 }
    ]
  },
 {
    "name": "黒夜叉の脚甲",
    "category": "足",
    "jigane": "光",
    "targets": [
      { "min": 320, "max": 330 },
      { "min": 200, "max": 208 },
      { "min": 270, "max": 278 },
      { "min": 430, "max": 440 }
    ]
  },
 {
    "name": "一角鬼の脚半",
    "category": "足",
    "jigane": "戻り",
    "targets": [
      { "min": 190, "max": 198 },
      { "min": 300, "max": 310 },
      { "min": 230, "max": 238 },
      { "min": 260, "max": 270 }
    ]
  },
 {
    "name": "トライドブーツ",
    "category": "足",
    "jigane": "光",
    "targets": [
      { "min": 230, "max": 239 },
      { "min": 495, "max": 504 },
      { "min": 385, "max": 394 },
      { "min": 190, "max": 199 }
    ]
  },
 {
    "name": "コスモスグリーブ",
    "category": "足",
    "jigane": "集中変化",
    "targets": [
      { "min": 320, "max": 329 },
      { "min": 180, "max": 189 },
      { "min": 340, "max": 350 },
      { "min": 245, "max": 254 }
    ]
  },
 {
    "name": "ラッシュシューズ",
    "category": "足",
    "jigane": "光",
    "targets": [
      { "min": 380, "max": 389 },
      { "min": 200, "max": 209 },
      { "min": 260, "max": 269 },
      { "min": 500, "max": 509 }
    ]
  },
 {
    "name": "機甲兵のグリーブ",
    "category": "足",
    "jigane": "戻り",
    "targets": [
      { "min": 290, "max": 300 },
      { "min": 170, "max": 178 },
      { "min": 290, "max": 300 },
      { "min": 205, "max": 213 }
    ]
  }
];

let currentRecipe = null;
let currentTemp = 1000;
let currentFocus = 207 + 45;
let gridState = [];
let playerLevel = 80;

document.addEventListener("DOMContentLoaded", () => {
    // 「レシピデータ読み込み中...」のテキストを消してリストを描画する
    renderRecipeList();
});

function renderRecipeList() {
    const listElement = document.getElementById("recipe-list");
    if (!listElement) return;
    listElement.innerHTML = ""; 
    RECIPES.forEach(recipe => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${recipe.name}</strong> (${recipe.category} / 地金: ${recipe.jiganeType})`;
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
    document.getElementById("display-jigane").textContent = `地金: ${recipe.jiganeType}`;
    
    gridState = recipe.targets.map(t => ({ value: 0, min: t.min, max: t.max, isLocked: false }));
    currentTemp = 1000;
    
    renderGrid();
    setupSkills();
    
    document.getElementById("scene-select").classList.remove("active");
    document.getElementById("scene-smithing").classList.add("active");
}

function renderGrid() {
    const gridContainer = document.getElementById("smithing-grid");
    if (!gridContainer) return;
    gridContainer.innerHTML = "";
    const layout = EQUIP_LAYOUTS[currentRecipe.category];
    
    gridContainer.style.gridTemplateColumns = `repeat(${layout.w}, 60px)`;
    gridContainer.style.gridTemplateRows = `repeat(${layout.h}, 180px)`;
    
    let cellIndex = 0;
    for (let y = 0; y < layout.h; y++) {
        for (let x = 0; x < layout.w; x++) {
            const isReal = layout.map[y * layout.w + x] === 1;
            const wrapper = document.createElement("div");
            wrapper.className = "forge-cell-container";
            
            if (isReal) {
                const state = gridState[cellIndex];
                const cellDiv = document.createElement("div");
                cellDiv.className = "forge-cell";
                cellDiv.innerHTML = `<div class="gauge-text">${state.value}</div>`;
                wrapper.appendChild(cellDiv);
                cellIndex++;
            } else {
                wrapper.classList.add("blank");
            }
            gridContainer.appendChild(wrapper);
        }
    }
}

function setupSkills() {
    const skillList = document.getElementById("skill-list");
    if (!skillList) return;
    skillList.innerHTML = "";
    SKILLS.forEach(skill => {
        const btn = document.createElement("button");
        btn.className = "skill-btn";
        btn.textContent = `${skill.name} (${skill.cost})`;
        skillList.appendChild(btn);
    });
}
