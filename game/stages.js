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
    title: '第1章 ほっかいどう',
    prefecture: 'ほっかいどう',
    bossId: 'ohnyan-shogun',
    stages: [
      { place: 'ふらの', layers: ['ground'], text: 'ラベンダー畑が広がる丘で、にゃんこ軍を迎え撃て。' },
      { place: 'あさひかわ', layers: ['ground'], text: '動物園で有名な雪の街。足元を固めて守り抜け。' },
      { place: 'ニセコ', layers: ['ground', 'sky'], text: 'パウダースノーのようていざん。空からも敵が来る。' },
      { place: 'のぼりべつ', layers: ['ground', 'sky'], text: '湯けむり立ちのぼるじごくだに。空の敵にも気をつけろ。' },
      { place: 'おたる', layers: ['ground', 'sea'], text: 'レンガ倉庫が並ぶ運河の街。水辺にも敵がひそむ。' },
      { place: 'はこだて', layers: ['ground', 'sky', 'sea'], text: 'はこだてやまと星形のごりょうかく。港・空・陸の三方から攻めてくる。' },
      { place: 'くしろ', layers: ['ground', 'sky', 'sea'], text: 'タンチョウが舞うくしろしつげんと港。' },
      { place: 'しれとこ', layers: ['ground', 'sky', 'sea'], text: '流氷が押し寄せる世界遺産の半島。' },
      { place: 'わっかない', layers: ['ground', 'sea'], text: '日本最北端・そうやみさき。冷たい海を越えて敵が来る。' },
      { place: 'さっぽろ', layers: ['ground', 'sky'], text: '雪まつりのおおどおりこうえんで、大ニャン将軍との決戦！' },
    ],
  },
  {
    chapter: 2,
    title: '第2章 にいがた',
    prefecture: 'にいがた',
    bossId: 'tenshi-shogun',
    stages: [
      { place: 'にいがたし', layers: ['ground', 'sea'], text: 'しなのがわにかかるばんだいばしを守れ。' },
      { place: 'やひこ', layers: ['ground', 'sky'], text: '大鳥居とやひこやま。神社の空から天使が来る。' },
      { place: 'つばめさんじょう', layers: ['ground'], text: '火花散る金物の町。工場を守り抜け。' },
      { place: 'ながおか', layers: ['ground', 'sky'], text: '夜空を彩るながおかまつり大花火大会。' },
      { place: 'とおかまち', layers: ['ground', 'sky'], text: '空を映す美しい棚田の里。' },
      { place: 'えちごゆざわ', layers: ['ground', 'sky'], text: '雪国のスキー場と温泉街。' },
      { place: 'じょうえつ', layers: ['ground', 'sky'], text: 'たかだじょうの三重櫓と夜桜。' },
      { place: 'いといがわ', layers: ['ground', 'sea'], text: '緑のヒスイが拾えるにほんかいの海岸。' },
      { place: 'かしわざき', layers: ['ground', 'sea'], text: '夕日がしずむにほんかいの砂浜。' },
      { place: 'さどがしま', layers: ['ground', 'sky', 'sea'], text: 'たらい舟と金山の島・さどで、大天使ニャンとの決戦！' },
    ],
  },
  {
    chapter: 3,
    title: '第3章 ぐんま',
    prefecture: 'ぐんま',
    bossId: 'alien-emperor',
    stages: [
      { place: 'まえばし', layers: ['ground'], text: 'あかぎやまを望む県都。陸の守りを固めろ。' },
      { place: 'たかさき', layers: ['ground', 'sky'], text: '白衣観音とだるまの町。' },
      { place: 'とみおか', layers: ['ground'], text: '世界遺産・とみおかせいしじょう。' },
      { place: 'きりゅう', layers: ['ground'], text: 'ノコギリ屋根が並ぶ織物の町。' },
      { place: 'たてばやし', layers: ['ground'], text: 'つつじが一面に咲く丘。' },
      { place: 'つまごい', layers: ['ground', 'sky'], text: 'キャベツ畑とあさまやま。' },
      { place: 'くさつ', layers: ['ground', 'sky'], text: '湯けむりの湯畑。' },
      { place: 'みなかみ', layers: ['ground', 'sky'], text: 'たにがわだけと渓谷のラフティング。' },
      { place: 'おぜ', layers: ['ground', 'sky'], text: '木道と水芭蕉の湿原。' },
      { place: 'しぶかわ', layers: ['ground', 'sky'], text: '日本のへそ・しぶかわ。いかほの石段街でエイリアン皇帝との決戦！' },
    ],
  },
  {
    chapter: 4,
    title: '第4章 とうきょう',
    prefecture: 'とうきょう',
    bossId: 'kraken-shogun',
    stages: [
      { place: 'あさくさ', layers: ['ground', 'sky'], text: 'かみなりもんとせんそうじ。スカイツリーを背に戦え。' },
      { place: 'うえの', layers: ['ground'], text: '桜のうえのこうえんと博物館。' },
      { place: 'あきはばら', layers: ['ground'], text: 'ネオン輝く電気街。' },
      { place: 'しぶや', layers: ['ground'], text: 'スクランブル交差点とハチ公。' },
      { place: 'しんじゅく', layers: ['ground', 'sky'], text: '高層ビルと都庁。空から敵が来る。' },
      { place: 'きちじょうじ', layers: ['ground', 'sea'], text: 'いのかしらこうえんの池とスワンボート。' },
      { place: 'たかおさん', layers: ['ground', 'sky'], text: 'ケーブルカーで登る霊山。' },
      { place: 'とよす', layers: ['ground', 'sea'], text: '市場と運河の湾岸エリア。' },
      { place: 'おだいば', layers: ['ground', 'sky', 'sea'], text: 'レインボーブリッジと観覧車。' },
      { place: 'とうきょうわん', layers: ['ground', 'sky', 'sea'], text: 'とうきょうわんに現れた深海将軍クラーケンとの決戦！' },
    ],
  },
  {
    chapter: 5,
    title: '第5章 かながわ',
    prefecture: 'かながわ',
    bossId: 'nyandark-emperor',
    stages: [
      { place: 'かわさき', layers: ['ground', 'sea'], text: '運河沿いの工場夜景。' },
      { place: 'みなとみらい', layers: ['ground', 'sky', 'sea'], text: 'ランドマークタワーと観覧車の港町。' },
      { place: 'ちゅうかがい', layers: ['ground'], text: '色とりどりの門が並ぶちゅうかがい。' },
      { place: 'かまくら', layers: ['ground', 'sky'], text: '大仏とあじさいの古都。' },
      { place: 'えのしま', layers: ['ground', 'sky', 'sea'], text: '展望灯台が立つ海に浮かぶ島。' },
      { place: 'はこね', layers: ['ground', 'sky', 'sea'], text: 'あしのこの海賊船と湖に立つ鳥居。' },
      { place: 'おだわら', layers: ['ground', 'sky'], text: '桜に囲まれたおだわらじょう。' },
      { place: 'よこすか', layers: ['ground', 'sea'], text: '軍港と記念艦の港町。' },
      { place: 'みうら', layers: ['ground', 'sea'], text: 'マグロの港とじょうがしまの夕日。' },
      { place: 'よこはま せやく', layers: ['ground', 'sky'], text: 'かいぐんどうろの桜並木と花の丘で、終焉皇帝ニャンダークとの決戦！' },
    ],
  },
  {
    chapter: 6,
    title: '第6章 あいち',
    prefecture: 'あいち',
    bossId: 'zombie-nyan-king',
    stages: [
      { place: 'なごやじょう', layers: ['ground', 'sky'], text: '金のシャチホコが輝くなごやじょう。' },
      { place: 'さかえ', layers: ['ground', 'sky'], text: 'テレビ塔と宇宙船のような屋根。' },
      { place: 'おおす', layers: ['ground'], text: 'おおすかんのんと商店街。' },
      { place: 'あつた', layers: ['ground'], text: '森に包まれたあつたじんぐう。' },
      { place: 'いぬやま', layers: ['ground', 'sky', 'sea'], text: 'きそがわを見下ろすいぬやまじょう。' },
      { place: 'とこなめ', layers: ['ground', 'sky', 'sea'], text: '空港と焼き物の散歩道。' },
      { place: 'せと', layers: ['ground'], text: 'レンガの煙突が並ぶ焼き物の町。' },
      { place: 'おかざき', layers: ['ground'], text: 'おかざきじょうとはっちょうみその蔵。' },
      { place: 'とよた', layers: ['ground', 'sky'], text: '自動車工場とスタジアム。' },
      { place: 'ながしの', layers: ['ground', 'sky'], text: 'ながしのの古戦場に、亡者の王ゾンビニャンがよみがえる！' },
    ],
  },
  {
    chapter: 7,
    title: '第7章 おおさか',
    prefecture: 'おおさか',
    bossId: 'mecha-nyan-titan',
    stages: [
      { place: 'うめだ', layers: ['ground', 'sky'], text: '空中庭園と赤い観覧車。' },
      { place: 'どうとんぼり', layers: ['ground', 'sea'], text: 'ネオン看板と運河の食い倒れの町。' },
      { place: 'しんせかい', layers: ['ground', 'sky'], text: 'つうてんかくと串カツの町。' },
      { place: 'てんのうじ', layers: ['ground', 'sky'], text: 'あべのハルカスとしてんのうじ。' },
      { place: 'おおさかじょう', layers: ['ground', 'sky'], text: '堀に囲まれたおおさかじょう。' },
      { place: 'USJ', layers: ['ground', 'sky', 'sea'], text: 'ベイエリアのテーマパーク。' },
      { place: 'さかい', layers: ['ground'], text: '巨大な前方後円墳と刃物の町。' },
      { place: 'きしわだ', layers: ['ground', 'sky'], text: 'だんじり祭りときしわだじょう。' },
      { place: 'いずみふちゅう', layers: ['ground'], text: 'いずみのくにの国府があった町。泉の湧く古い神社を守れ。' },
      { place: 'ばんぱくきねんこうえん', layers: ['ground', 'sky'], text: 'ばんぱくきねんこうえんで、機械神ティターンニャンとの決戦！' },
    ],
  },
  {
    chapter: 8,
    title: '第8章 ふくおか',
    prefecture: 'ふくおか',
    bossId: 'frost-nyan-tyrant',
    stages: [
      { place: 'はかた', layers: ['ground'], text: 'くしだじんじゃと山笠の町。' },
      { place: 'てんじん', layers: ['ground'], text: 'ビルが並ぶきゅうしゅう一の繁華街。' },
      { place: 'なかす', layers: ['ground', 'sea'], text: '川沿いに屋台が並ぶ夜のなかす。' },
      { place: 'だざいふ', layers: ['ground', 'sky'], text: '梅の花が咲くだざいふてんまんぐう。' },
      { place: 'いとしま', layers: ['ground', 'sea'], text: '海に立つ白い鳥居と夫婦岩。' },
      { place: 'もじこう', layers: ['ground', 'sea'], text: 'レトロな港町とかんもんきょう。' },
      { place: 'こくら', layers: ['ground', 'sky'], text: 'こくらじょうとむらさきがわ。' },
      { place: 'やながわ', layers: ['ground', 'sea'], text: '柳の下を進む川下りの町。' },
      { place: 'くるめ', layers: ['ground'], text: 'ラーメンとつつじの町。' },
      { place: 'ふくおかタワー', layers: ['ground', 'sky', 'sea'], text: '凍りつくはかたわんで、氷結皇ニャンフロストとの決戦！' },
    ],
  },
  {
    chapter: 9,
    title: '第9章 こうち',
    prefecture: 'こうち',
    bossId: 'magma-nyan-overlord',
    stages: [
      { place: 'こうちじょう', layers: ['ground', 'sky'], text: '天守が残るこうちじょう。' },
      { place: 'はりまやばし', layers: ['ground'], text: '赤い欄干の小さな橋。' },
      { place: 'かつらはま', layers: ['ground', 'sea'], text: 'たいへいようを望むかつらはま。' },
      { place: 'あき', layers: ['ground'], text: '武家屋敷と野良時計の田園。' },
      { place: 'なんこく', layers: ['ground', 'sky'], text: '空港と田園が広がる町。' },
      { place: 'によどがわ', layers: ['ground', 'sea'], text: '青く透き通るによどブルー。' },
      { place: 'しまんと', layers: ['ground', 'sea'], text: '日本最後の清流と沈下橋。' },
      { place: 'あしずりみさき', layers: ['ground', 'sky', 'sea'], text: '灯台と椿のトンネル。' },
      { place: 'むろとみさき', layers: ['ground', 'sky', 'sea'], text: '荒波と岩がそびえる岬。' },
      { place: 'かみし', layers: ['ground', 'sky'], text: 'かみしのりゅうがどうで、溶岩魔王マグマニャンとの決戦！' },
    ],
  },
  {
    chapter: 10,
    title: '第10章 おきなわ',
    prefecture: 'おきなわ',
    bossId: 'omega-nyan-god',
    stages: [
      { place: 'なは こくさいどおり', layers: ['ground'], text: 'シーサーが見守るこくさいどおり。' },
      { place: 'しゅりじょう', layers: ['ground', 'sky'], text: '赤い正殿が輝くしゅりじょう。' },
      { place: 'ちゅらうみ', layers: ['ground', 'sea'], text: 'ジンベエザメの水族館とエメラルドの海。' },
      { place: 'おんなそん', layers: ['ground', 'sky', 'sea'], text: '象の鼻のようなまんざもうの断崖。' },
      { place: 'なご', layers: ['ground', 'sky'], text: 'パイナップル畑とガジュマル。' },
      { place: 'よみたん', layers: ['ground', 'sky', 'sea'], text: 'ざんぱみさきの灯台と焼き物の里。' },
      { place: 'いしがきじま', layers: ['ground', 'sky', 'sea'], text: 'エメラルドのかびらわん。' },
      { place: 'みやこじま', layers: ['ground', 'sky', 'sea'], text: '海をわたる長い橋。' },
      { place: 'いりおもてじま', layers: ['ground', 'sea'], text: 'マングローブのジャングル。' },
      { place: 'くだかじま', layers: ['ground', 'sky', 'sea'], text: '神の島・くだかじまで、全能神オメガニャンとの最終決戦！' },
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
    (e) => !e.boss && !e.eventOnly && enabledLayers.includes(e.layer) && globalIndex >= e.minIndex
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

// ---------- ハロウィンイベント（期間限定の5ステージ） ----------
// ハロウィン仮装キャラ12体が敵として次々に出てきて、最後に伝説レアのキャラがボスとして現れる。
// 訓練所をクリアすると1つ目が解放され、あとは順番に解放。どの難易度でも遊べる（難易度の倍率もかかる）。
// ボスを倒すまで敵城は落ちない（bossGuard）。
const HALLOWEEN_STAGE_DEFS = [
  { place: 'かぼちゃばたけ', text: '満月の下、かぼちゃ畑に仮装わんこたちが現れた！最後にケルベロスが立ちはだかる。', boss: 'cerberus', statMult: 0.2, rounds: 1, effectiveIndex: 15 },
  { place: 'おばけやしきのもり', text: 'おばけ屋敷の森で、仮装わんこたちが行く手をふさぐ。森の空からセイリュウが舞い降りる。', boss: 'seiryu-inu', statMult: 0.3, rounds: 1, effectiveIndex: 30 },
  { place: 'まじょのみずうみ', text: '魔女のろうそくが浮かぶ湖。水面からゴッドが姿を現す。', boss: 'elemental-husky-god', statMult: 0.4, rounds: 2, effectiveIndex: 50 },
  { place: 'ハロウィンじょうかまち', text: 'ちょうちんが揺れるハロウィンの城下町。パレードの最後にフェンリルがやってくる。', boss: 'fenrir', statMult: 0.5, rounds: 2, effectiveIndex: 70 },
  { place: 'つきよのおばけじょう', text: '月夜のおばけ城で最終決戦！宇宙の女神ギンガが待ち受ける。', boss: 'cosmos-goddess', statMult: 0.65, rounds: 3, effectiveIndex: 90 },
];

function halloweenWaves(def) {
  const mobs = ENEMY_DEFS.filter((e) => e.eventOnly && !e.boss);
  const waves = [];
  let t = 1500;
  for (let r = 0; r < def.rounds; r++) {
    const order = [...mobs].sort(() => Math.random() - 0.5);
    for (const m of order) {
      waves.push({ time: t, enemyId: m.id, count: 1, statMult: def.statMult });
      t += 3200;
    }
    t += 3000;
  }
  waves.push({ time: t + 2000, enemyId: `hw-boss-${def.boss}`, count: 1, statMult: def.statMult });
  return waves;
}

HALLOWEEN_STAGE_DEFS.forEach((def, i) => {
  const n = i + 1;
  STAGES.push({
    id: `halloween-${n}`,
    order: order++,
    chapter: '🎃 ハロウィンイベント',
    name: `ハロウィン${n} ${def.place}`,
    place: def.place,
    description: `${def.text}（戦場: そら・じめん・うみ）`,
    laneLength: 1000 + def.effectiveIndex * 15,
    enabledLayers: ALL_LAYERS,
    boss: true,
    event: true,
    bossGuard: true,
    requiresStageId: n === 1 ? 'tutorial' : `halloween-${n - 1}`,
    rewardTickets: 2,
    bgImage: `assets/backgrounds/halloween-${n}.jpg`,
    ...economyFor(def.effectiveIndex, true, ALL_LAYERS),
    waves: halloweenWaves(def),
  });
});

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
