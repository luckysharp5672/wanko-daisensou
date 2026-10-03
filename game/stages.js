// ステージ定義
// チュートリアル + 全10章 × 10ステージ（各章10ステージ目はボス戦）を生成する。
// さらに、章の進行順とは別枠でエクストラステージを難易度ごとに3つずつ用意する。
// エクストラステージは同じ難易度で特定の章のボスを倒すと解放され、通常の章進行より大幅に強く
// 調整されている。ふつうは自城の新しい武器、むずかしい・ゲキむずはわんこチケット（初回クリアのみ）が報酬。
//
// 難易度ごとの章の解放（main.js の isStageUnlocked）:
//   ふつう      : チュートリアル → 第1章 → 第2章 … と順番に進む
//   むずかしい  : ふつうで第N章のボス（第N章-10）を倒すと、むずかしいの第N章が解放される
//   ゲキむず    : むずかしいで第N章のボスを倒すと、ゲキむずの第N章が解放される
//   章の中では、どの難易度でも1つ前のステージをクリアすると次が解放される
//
// 章とステージ: 第1章〜第10章を北から順に10都道府県（北海道・新潟・群馬・東京・神奈川・愛知・大阪・
//   福岡・高知・沖縄）に当てはめ、各ステージはその都道府県の有名な地域にしている（ステージ10はボス戦）。
// レイヤー: 各ステージの地形に合わせて固定（海沿い・川・湖はうみ、山・塔・空の名所はそら）。
//   第1章-1,2 はチュートリアル直後なので、じめんのみ。ボス戦はボスの出現層を必ず含む。
//   エクストラステージ: 常に全3レイヤー開放（固定・ランダムなし）

import { ENEMY_DEFS } from './enemies.js';
import { LAYER_IDS, LAYER_INFO } from './layers.js';

const CHAPTERS = [
  {
    chapter: 1,
    title: '第1章 北海道',
    prefecture: '北海道',
    bossId: 'ohnyan-shogun',
    stages: [
      { place: '富良野', layers: ['ground'], text: 'ラベンダー畑が広がる丘で、にゃんこ軍を迎え撃て。' },
      { place: '旭川', layers: ['ground'], text: '動物園で有名な雪の街。足元を固めて守り抜け。' },
      { place: 'ニセコ', layers: ['ground', 'sky'], text: 'パウダースノーの羊蹄山。空からも敵が来る。' },
      { place: '登別', layers: ['ground', 'sky'], text: '湯けむり立ちのぼる地獄谷。空の敵にも気をつけろ。' },
      { place: '小樽', layers: ['ground', 'sea'], text: 'レンガ倉庫が並ぶ運河の街。水辺にも敵がひそむ。' },
      { place: '函館', layers: ['ground', 'sky', 'sea'], text: '函館山と星形の五稜郭。港・空・陸の三方から攻めてくる。' },
      { place: '釧路', layers: ['ground', 'sky', 'sea'], text: 'タンチョウが舞う釧路湿原と港。' },
      { place: '知床', layers: ['ground', 'sky', 'sea'], text: '流氷が押し寄せる世界遺産の半島。' },
      { place: '稚内', layers: ['ground', 'sea'], text: '日本最北端・宗谷岬。冷たい海を越えて敵が来る。' },
      { place: '札幌', layers: ['ground', 'sky'], text: '雪まつりの大通公園で、大ニャン将軍との決戦！' },
    ],
  },
  {
    chapter: 2,
    title: '第2章 新潟',
    prefecture: '新潟',
    bossId: 'tenshi-shogun',
    stages: [
      { place: '新潟市', layers: ['ground', 'sea'], text: '信濃川にかかる萬代橋を守れ。' },
      { place: '弥彦', layers: ['ground', 'sky'], text: '大鳥居と弥彦山。神社の空から天使が来る。' },
      { place: '燕三条', layers: ['ground'], text: '火花散る金物の町。工場を守り抜け。' },
      { place: '長岡', layers: ['ground', 'sky'], text: '夜空を彩る長岡まつり大花火大会。' },
      { place: '十日町', layers: ['ground', 'sky'], text: '空を映す美しい棚田の里。' },
      { place: '越後湯沢', layers: ['ground', 'sky'], text: '雪国のスキー場と温泉街。' },
      { place: '上越', layers: ['ground', 'sky'], text: '高田城の三重櫓と夜桜。' },
      { place: '糸魚川', layers: ['ground', 'sea'], text: '緑のヒスイが拾える日本海の海岸。' },
      { place: '柏崎', layers: ['ground', 'sea'], text: '夕日がしずむ日本海の砂浜。' },
      { place: '佐渡島', layers: ['ground', 'sky', 'sea'], text: 'たらい舟と金山の島・佐渡で、大天使ニャンとの決戦！' },
    ],
  },
  {
    chapter: 3,
    title: '第3章 群馬',
    prefecture: '群馬',
    bossId: 'alien-emperor',
    stages: [
      { place: '前橋', layers: ['ground'], text: '赤城山を望む県都。陸の守りを固めろ。' },
      { place: '高崎', layers: ['ground', 'sky'], text: '白衣観音とだるまの町。' },
      { place: '富岡', layers: ['ground'], text: '世界遺産・富岡製糸場。' },
      { place: '桐生', layers: ['ground'], text: 'ノコギリ屋根が並ぶ織物の町。' },
      { place: '館林', layers: ['ground'], text: 'つつじが一面に咲く丘。' },
      { place: '嬬恋', layers: ['ground', 'sky'], text: 'キャベツ畑と浅間山。' },
      { place: '草津', layers: ['ground', 'sky'], text: '湯けむりの湯畑。' },
      { place: 'みなかみ', layers: ['ground', 'sky'], text: '谷川岳と渓谷のラフティング。' },
      { place: '尾瀬', layers: ['ground', 'sky'], text: '木道と水芭蕉の湿原。' },
      { place: '渋川', layers: ['ground', 'sky'], text: '日本のへそ・渋川。伊香保の石段街でエイリアン皇帝との決戦！' },
    ],
  },
  {
    chapter: 4,
    title: '第4章 東京',
    prefecture: '東京',
    bossId: 'kraken-shogun',
    stages: [
      { place: '浅草', layers: ['ground', 'sky'], text: '雷門と浅草寺。スカイツリーを背に戦え。' },
      { place: '上野', layers: ['ground'], text: '桜の上野公園と博物館。' },
      { place: '秋葉原', layers: ['ground'], text: 'ネオン輝く電気街。' },
      { place: '渋谷', layers: ['ground'], text: 'スクランブル交差点とハチ公。' },
      { place: '新宿', layers: ['ground', 'sky'], text: '高層ビルと都庁。空から敵が来る。' },
      { place: '吉祥寺', layers: ['ground', 'sea'], text: '井の頭公園の池とスワンボート。' },
      { place: '高尾山', layers: ['ground', 'sky'], text: 'ケーブルカーで登る霊山。' },
      { place: '豊洲', layers: ['ground', 'sea'], text: '市場と運河の湾岸エリア。' },
      { place: 'お台場', layers: ['ground', 'sky', 'sea'], text: 'レインボーブリッジと観覧車。' },
      { place: '東京湾', layers: ['ground', 'sky', 'sea'], text: '東京湾に現れた深海将軍クラーケンとの決戦！' },
    ],
  },
  {
    chapter: 5,
    title: '第5章 神奈川',
    prefecture: '神奈川',
    bossId: 'nyandark-emperor',
    stages: [
      { place: '川崎', layers: ['ground', 'sea'], text: '運河沿いの工場夜景。' },
      { place: 'みなとみらい', layers: ['ground', 'sky', 'sea'], text: 'ランドマークタワーと観覧車の港町。' },
      { place: '中華街', layers: ['ground'], text: '色とりどりの門が並ぶ中華街。' },
      { place: '鎌倉', layers: ['ground', 'sky'], text: '大仏とあじさいの古都。' },
      { place: '江の島', layers: ['ground', 'sky', 'sea'], text: '展望灯台が立つ海に浮かぶ島。' },
      { place: '箱根', layers: ['ground', 'sky', 'sea'], text: '芦ノ湖の海賊船と湖に立つ鳥居。' },
      { place: '小田原', layers: ['ground', 'sky'], text: '桜に囲まれた小田原城。' },
      { place: '横須賀', layers: ['ground', 'sea'], text: '軍港と記念艦の港町。' },
      { place: '三浦', layers: ['ground', 'sea'], text: 'マグロの港と城ヶ島の夕日。' },
      { place: '横浜 瀬谷区', layers: ['ground', 'sky'], text: '海軍道路の桜並木と花の丘で、終焉皇帝ニャンダークとの決戦！' },
    ],
  },
  {
    chapter: 6,
    title: '第6章 愛知',
    prefecture: '愛知',
    bossId: 'zombie-nyan-king',
    stages: [
      { place: '名古屋城', layers: ['ground', 'sky'], text: '金のシャチホコが輝く名古屋城。' },
      { place: '栄', layers: ['ground', 'sky'], text: 'テレビ塔と宇宙船のような屋根。' },
      { place: '大須', layers: ['ground'], text: '大須観音と商店街。' },
      { place: '熱田', layers: ['ground'], text: '森に包まれた熱田神宮。' },
      { place: '犬山', layers: ['ground', 'sky', 'sea'], text: '木曽川を見下ろす犬山城。' },
      { place: '常滑', layers: ['ground', 'sky', 'sea'], text: '空港と焼き物の散歩道。' },
      { place: '瀬戸', layers: ['ground'], text: 'レンガの煙突が並ぶ焼き物の町。' },
      { place: '岡崎', layers: ['ground'], text: '岡崎城と八丁味噌の蔵。' },
      { place: '豊田', layers: ['ground', 'sky'], text: '自動車工場とスタジアム。' },
      { place: '長篠', layers: ['ground', 'sky'], text: '長篠の古戦場に、亡者の王ゾンビニャンがよみがえる！' },
    ],
  },
  {
    chapter: 7,
    title: '第7章 大阪',
    prefecture: '大阪',
    bossId: 'mecha-nyan-titan',
    stages: [
      { place: '梅田', layers: ['ground', 'sky'], text: '空中庭園と赤い観覧車。' },
      { place: '道頓堀', layers: ['ground', 'sea'], text: 'ネオン看板と運河の食い倒れの町。' },
      { place: '新世界', layers: ['ground', 'sky'], text: '通天閣と串カツの町。' },
      { place: '天王寺', layers: ['ground', 'sky'], text: 'あべのハルカスと四天王寺。' },
      { place: '大阪城', layers: ['ground', 'sky'], text: '堀に囲まれた大阪城。' },
      { place: 'USJ', layers: ['ground', 'sky', 'sea'], text: 'ベイエリアのテーマパーク。' },
      { place: '堺', layers: ['ground'], text: '巨大な前方後円墳と刃物の町。' },
      { place: '岸和田', layers: ['ground', 'sky'], text: 'だんじり祭りと岸和田城。' },
      { place: '和泉府中', layers: ['ground'], text: '和泉国の国府があった町。泉の湧く古い神社を守れ。' },
      { place: '万博記念公園', layers: ['ground', 'sky'], text: '万博記念公園で、機械神ティターンニャンとの決戦！' },
    ],
  },
  {
    chapter: 8,
    title: '第8章 福岡',
    prefecture: '福岡',
    bossId: 'frost-nyan-tyrant',
    stages: [
      { place: '博多', layers: ['ground'], text: '櫛田神社と山笠の町。' },
      { place: '天神', layers: ['ground'], text: 'ビルが並ぶ九州一の繁華街。' },
      { place: '中洲', layers: ['ground', 'sea'], text: '川沿いに屋台が並ぶ夜の中洲。' },
      { place: '太宰府', layers: ['ground', 'sky'], text: '梅の花が咲く太宰府天満宮。' },
      { place: '糸島', layers: ['ground', 'sea'], text: '海に立つ白い鳥居と夫婦岩。' },
      { place: '門司港', layers: ['ground', 'sea'], text: 'レトロな港町と関門橋。' },
      { place: '小倉', layers: ['ground', 'sky'], text: '小倉城と紫川。' },
      { place: '柳川', layers: ['ground', 'sea'], text: '柳の下を進む川下りの町。' },
      { place: '久留米', layers: ['ground'], text: 'ラーメンとつつじの町。' },
      { place: '福岡タワー', layers: ['ground', 'sky', 'sea'], text: '凍りつく博多湾で、氷結皇ニャンフロストとの決戦！' },
    ],
  },
  {
    chapter: 9,
    title: '第9章 高知',
    prefecture: '高知',
    bossId: 'magma-nyan-overlord',
    stages: [
      { place: '高知城', layers: ['ground', 'sky'], text: '天守が残る高知城。' },
      { place: 'はりまや橋', layers: ['ground'], text: '赤い欄干の小さな橋。' },
      { place: '桂浜', layers: ['ground', 'sea'], text: '太平洋を望む桂浜。' },
      { place: '安芸', layers: ['ground'], text: '武家屋敷と野良時計の田園。' },
      { place: '南国', layers: ['ground', 'sky'], text: '空港と田園が広がる町。' },
      { place: '仁淀川', layers: ['ground', 'sea'], text: '青く透き通る仁淀ブルー。' },
      { place: '四万十', layers: ['ground', 'sea'], text: '日本最後の清流と沈下橋。' },
      { place: '足摺岬', layers: ['ground', 'sky', 'sea'], text: '灯台と椿のトンネル。' },
      { place: '室戸岬', layers: ['ground', 'sky', 'sea'], text: '荒波と岩がそびえる岬。' },
      { place: '香美市', layers: ['ground', 'sky'], text: '香美市の龍河洞で、溶岩魔王マグマニャンとの決戦！' },
    ],
  },
  {
    chapter: 10,
    title: '第10章 沖縄',
    prefecture: '沖縄',
    bossId: 'omega-nyan-god',
    stages: [
      { place: '那覇国際通り', layers: ['ground'], text: 'シーサーが見守る国際通り。' },
      { place: '首里城', layers: ['ground', 'sky'], text: '赤い正殿が輝く首里城。' },
      { place: '美ら海', layers: ['ground', 'sea'], text: 'ジンベエザメの水族館とエメラルドの海。' },
      { place: '恩納村', layers: ['ground', 'sky', 'sea'], text: '象の鼻のような万座毛の断崖。' },
      { place: '名護', layers: ['ground', 'sky'], text: 'パイナップル畑とガジュマル。' },
      { place: '読谷', layers: ['ground', 'sky', 'sea'], text: '残波岬の灯台と焼き物の里。' },
      { place: '石垣島', layers: ['ground', 'sky', 'sea'], text: 'エメラルドの川平湾。' },
      { place: '宮古島', layers: ['ground', 'sky', 'sea'], text: '海をわたる長い橋。' },
      { place: '西表島', layers: ['ground', 'sea'], text: 'マングローブのジャングル。' },
      { place: '久高島', layers: ['ground', 'sky', 'sea'], text: '神の島・久高島で、全能神オメガニャンとの最終決戦！' },
    ],
  },
];

// ボスは複数レイヤーにまたがって出現しうるため、常に配列で返す
function bossLayersOf(bossId) {
  const def = ENEMY_DEFS.find((e) => e.id === bossId);
  return def.layers || [def.layer];
}

// ご当地の地形に合わせたレイヤー構成（海沿い・川・湖はうみ、山・塔・空の名所はそらを含む）。
// ボス戦は、ボスの出現層を必ず含める。
function enabledLayersFor(ch, stageNum, bossLayers, isBoss) {
  const set = new Set(ch.stages[stageNum - 1].layers);
  if (isBoss) bossLayers.forEach((l) => set.add(l));
  return LAYER_IDS.filter((l) => set.has(l));
}

function layerLabel(layers) {
  return LAYER_IDS.filter((l) => layers.includes(l))
    .map((l) => LAYER_INFO[l].label)
    .join('・');
}

function enemyPool(enabledLayers, globalIndex) {
  return ENEMY_DEFS.filter(
    (e) => !e.boss && enabledLayers.includes(e.layer) && globalIndex >= e.minIndex
  );
}

// レイヤーごとの敵プールをラウンドロビンで割り当て、特定の層だけに
// 敵が偏って無防備な層が生まれるのを防ぐ
function generateWaves(globalIndex, enabledLayers, bossId) {
  const layerPools = {};
  for (const layer of enabledLayers) {
    layerPools[layer] = enemyPool([layer], globalIndex);
  }
  const usableLayers = enabledLayers.filter((l) => layerPools[l].length > 0);
  if (usableLayers.length === 0) return bossId ? [{ time: 2000, enemyId: bossId, count: 1 }] : [];

  const waveCount = Math.max(usableLayers.length * 2, 3 + Math.floor(globalIndex / 5));
  const waves = [];
  let t = 1200;
  for (let w = 0; w < waveCount; w++) {
    const layer = usableLayers[w % usableLayers.length];
    const pool = layerPools[layer];
    const def = pool[Math.floor(Math.random() * pool.length)];
    const count = 1 + Math.floor(Math.random() * (1 + Math.floor(globalIndex / 8)));
    const interval = 900 + Math.floor(Math.random() * 500);
    waves.push({ time: t, enemyId: def.id, count, interval });
    t += 4800 + Math.floor(Math.random() * 1800) + globalIndex * 70;
  }
  if (bossId) {
    waves.push({ time: t + 3000, enemyId: bossId, count: 1 });
  }
  return waves;
}

// 各層で最も安価な基本キャラのコスト（常に入手済みの5キャラ基準）。
// 複数層が同時に開いても「全層に1体ずつ出す」だけの初期コインを必ず持てるようにする。
const CHEAPEST_COST_BY_LAYER = { ground: 75, sea: 300, sky: 200 };

function economyFor(globalIndex, isBoss, enabledLayers) {
  const layerCoverageCost = enabledLayers.reduce((sum, l) => sum + (CHEAPEST_COST_BY_LAYER[l] || 0), 0);
  const playerCastleHp = Math.round(1200 + globalIndex * 90);
  let enemyCastleHp = Math.round(1400 + globalIndex * 220);
  if (isBoss) enemyCastleHp = Math.round(enemyCastleHp * 1.6);
  const baseInitialCoin = Math.round(140 + globalIndex * 6);
  const initialCoin = Math.max(baseInitialCoin, Math.round(layerCoverageCost * 1.15));
  const maxCoin = Math.min(999, Math.max(Math.round(500 + globalIndex * 18), initialCoin + 200));
  const coinRegen = Math.round((7 + globalIndex * 0.3) * 10) / 10;
  let clearReward = Math.round(100 + globalIndex * 20);
  if (isBoss) clearReward = Math.round(clearReward * 1.8);
  return { playerCastleHp, enemyCastleHp, initialCoin, maxCoin, coinRegen, clearReward };
}

export const STAGES = [
  {
    id: 'tutorial',
    order: 0,
    difficulty: 'normal',
    chapter: '訓練所',
    name: 'はじめての出撃',
    description: '出撃の基本を学ぶ訓練ステージ。まずはワンコウを出してみよう。',
    laneLength: 1000,
    enabledLayers: ['ground'],
    playerCastleHp: 1000,
    enemyCastleHp: 500,
    initialCoin: 150,
    maxCoin: 500,
    coinRegen: 6,
    clearReward: 100,
    waves: [
      { time: 1000, enemyId: 'noranyan', count: 1 },
      { time: 9000, enemyId: 'noranyan', count: 1 },
      { time: 16000, enemyId: 'noranyan', count: 2, interval: 2000 },
    ],
  },
];

let order = 1;
for (const ch of CHAPTERS) {
  const bossLayers = bossLayersOf(ch.bossId);
  for (let stageNum = 1; stageNum <= 10; stageNum++) {
    const globalIndex = (ch.chapter - 1) * 10 + stageNum;
    const isBoss = stageNum === 10;
    const local = ch.stages[stageNum - 1];
    const enabledLayers = enabledLayersFor(ch, stageNum, bossLayers, isBoss);
    const econ = economyFor(globalIndex, isBoss, enabledLayers);
    const waves = generateWaves(globalIndex, enabledLayers, isBoss ? ch.bossId : null);

    STAGES.push({
      id: `ch${ch.chapter}-${stageNum}`,
      order: order++,
      chapterNum: ch.chapter,
      stageNum,
      chapter: ch.title,
      name: `第${ch.chapter}章-${stageNum} ${local.place}`,
      place: local.place,
      description: `${local.text}（戦場: ${layerLabel(enabledLayers)}）`,
      // 戦闘画面の背景（ご当地イラスト）。画像が無いときは従来の色分けの帯だけで表示する
      bgImage: `assets/backgrounds/ch${ch.chapter}-${stageNum}.jpg`,
      laneLength: 1000 + globalIndex * 15,
      enabledLayers,
      boss: isBoss,
      ...econ,
      waves,
    });
  }
}

// ---------- エクストラステージ（章進行とは別枠の高難易度チャレンジ） ----------
// effectiveIndex には、そのステージが解放される時点より大幅に先のグローバル進行度を
// 指定することで、経済・敵編成の既存フォーミュラをそのまま流用しつつ
// 「解放時点では歯が立たないレベルの強さ」を作り出す。
const EXTRA_STAGE_DEFS = [
  // ---- ふつう ----
  {
    id: 'extra-1',
    difficulty: 'normal',
    name: 'エクストラ1 亡影の迷宮',
    description: '死角から忍び寄る亡影の大軍。全レイヤー同時展開に耐えられる編成でなければ突破は困難だ。',
    effectiveIndex: 55,
    bossId: 'phantom-baron-nyan',
    requiresStageId: 'ch3-10',
    rewardWeaponId: 'castle-shadow-cannon',
  },
  {
    id: 'extra-2',
    difficulty: 'normal',
    name: 'エクストラ2 混沌の竜穴',
    description: '天地を覆う混沌の竜が支配する戦場。生半可な戦力では自城に一歩も近づけない。',
    effectiveIndex: 85,
    bossId: 'chaos-nyan-dragon',
    requiresStageId: 'ch6-10',
    rewardWeaponId: 'castle-chaos-blaster',
  },
  {
    id: 'extra-3',
    difficulty: 'normal',
    name: 'エクストラ3 永劫の終着点',
    description: '全10章を制した者だけが挑める真の裏ボス戦。わんこ王国最強の編成で挑め。',
    effectiveIndex: 130,
    bossId: 'true-nyan-god-eternal',
    requiresStageId: 'ch10-10',
    rewardWeaponId: 'castle-eternal-railgun',
  },
  // ---- むずかしい（むずかしいで第3・6・10章のボスを倒すと解放） ----
  {
    id: 'hard-extra-1',
    difficulty: 'hard',
    name: 'むずかしいEX1 嵐の古戦場',
    description: '空と大地を同時に切り裂く嵐の騎士が待つ古戦場。そらとじめんの両方を守り切れる編成で挑め。',
    effectiveIndex: 65,
    bossId: 'tempest-nyan-knight',
    requiresStageId: 'ch3-10',
    rewardTickets: 3,
  },
  {
    id: 'hard-extra-2',
    difficulty: 'hard',
    name: 'むずかしいEX2 深淵の海溝',
    description: '海の底から巨大な影が浮かび上がる。じめんとうみに押し寄せる大軍を食い止めろ。',
    effectiveIndex: 95,
    bossId: 'abyss-nyan-leviathan',
    requiresStageId: 'ch6-10',
    rewardTickets: 3,
  },
  {
    id: 'hard-extra-3',
    difficulty: 'hard',
    name: 'むずかしいEX3 創世の機神殿',
    description: '世界を作り直そうとする機械の神が目覚めた。全レイヤーを覆い尽くす創世の砲撃に耐えよ。',
    effectiveIndex: 135,
    bossId: 'genesis-nyan-machine',
    requiresStageId: 'ch10-10',
    rewardTickets: 5,
  },
  // ---- ゲキむず（ゲキむずで第3・6・10章のボスを倒すと解放） ----
  {
    id: 'extreme-extra-1',
    difficulty: 'extreme',
    name: 'ゲキむずEX1 獄炎の鬼ヶ城',
    description: '燃えさかる鬼ヶ城の主が、空からも地上からも炎を浴びせてくる。並の編成では一瞬で焼き尽くされる。',
    effectiveIndex: 75,
    bossId: 'inferno-nyan-oni',
    requiresStageId: 'ch3-10',
    rewardTickets: 5,
  },
  {
    id: 'extreme-extra-2',
    difficulty: 'extreme',
    name: 'ゲキむずEX2 日蝕の玉座',
    description: '太陽を喰らった女王が空と海を支配する。光の届かない戦場で最後まで立っていられるか。',
    effectiveIndex: 105,
    bossId: 'eclipse-nyan-queen',
    requiresStageId: 'ch6-10',
    rewardTickets: 5,
  },
  {
    id: 'extreme-extra-3',
    difficulty: 'extreme',
    name: 'ゲキむずEX3 零の果て',
    description: 'すべてが始まる前の「零」から来た神。わんこ大戦争で最も過酷な、最後の戦い。',
    effectiveIndex: 140,
    bossId: 'zero-nyan-origin',
    requiresStageId: 'ch10-10',
    rewardTickets: 10,
  },
];

const ALL_LAYERS = ['sky', 'ground', 'sea'];

for (const ex of EXTRA_STAGE_DEFS) {
  const econ = economyFor(ex.effectiveIndex, true, ALL_LAYERS);
  const waves = generateWaves(ex.effectiveIndex, ALL_LAYERS, ex.bossId);

  STAGES.push({
    id: ex.id,
    order: order++,
    chapter: 'エクストラステージ',
    name: ex.name,
    description: ex.description,
    laneLength: 1000 + ex.effectiveIndex * 15,
    enabledLayers: ALL_LAYERS,
    boss: true,
    extra: true,
    difficulty: ex.difficulty,
    requiresStageId: ex.requiresStageId,
    rewardWeaponId: ex.rewardWeaponId,
    rewardTickets: ex.rewardTickets,
    ...econ,
    waves,
  });
}

// その難易度のステージ選択画面に並べるステージか（difficulty 指定のないステージは全難易度に出る）
export function isStageInDifficulty(stage, difficulty) {
  return !stage.difficulty || stage.difficulty === difficulty;
}

export function getStagesForDifficulty(difficulty) {
  return STAGES.filter((s) => isStageInDifficulty(s, difficulty));
}

export function getStage(id) {
  return STAGES.find((s) => s.id === id);
}

export function getStageIndex(id) {
  return STAGES.findIndex((s) => s.id === id);
}
