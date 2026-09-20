// ステージ定義
// チュートリアル + 全10章 × 10ステージ（各章10ステージ目はボス戦）を生成する。
// さらに、章の進行順とは別枠でエクストラステージを3つ用意する。
// エクストラステージは特定のメインステージクリアで解放され、通常の章進行より大幅に強く
// 調整されており、クリア報酬として自城の新しい武器が手に入る。
//
// レイヤー解放の設計:
//   第1章-1,2   : 地面のみ
//   第1章-3〜6  : 地面 + 中空
//   第1章-7〜10 : 地面 + 中空 + 海面（10はボス戦）
//   第2章-1〜5  : 海面 + 地面 + 中空 + 上空（全開放）
//   第2章-6以降（第3〜10章含む）: 毎回ランダムに有効レイヤーを抽選（地面と、ボスステージはボスの出現層を必ず含む）
//   エクストラステージ: 常に全4レイヤー開放（固定・ランダムなし）

import { ENEMY_DEFS } from './enemies.js';
import { LAYER_IDS, LAYER_INFO } from './layers.js';

const CHAPTERS = [
  {
    chapter: 1,
    title: '第1章 ワンコ帝国後戦',
    setting: '日本山田国',
    bossId: 'ohnyan-shogun',
  },
  {
    chapter: 2,
    title: '第2章 濃霧のやまと',
    setting: '月夜の森林',
    bossId: 'tenshi-shogun',
  },
  {
    chapter: 3,
    title: '第3章 星間戦争',
    setting: '宇宙空間',
    bossId: 'alien-emperor',
  },
  {
    chapter: 4,
    title: '第4章 深海の逆襲',
    setting: '太平洋深層要塞',
    bossId: 'kraken-shogun',
  },
  {
    chapter: 5,
    title: '第5章 時空大戦',
    setting: '崩壊する時空の狭間',
    bossId: 'nyandark-emperor',
  },
  {
    chapter: 6,
    title: '第6章 亡き者たちの反逆',
    setting: '死者の谷',
    bossId: 'zombie-nyan-king',
  },
  {
    chapter: 7,
    title: '第7章 機械仕掛けの軍勢',
    setting: '機械要塞タワー',
    bossId: 'mecha-nyan-titan',
  },
  {
    chapter: 8,
    title: '第8章 極寒の凍土戦線',
    setting: '氷結大陸',
    bossId: 'frost-nyan-tyrant',
  },
  {
    chapter: 9,
    title: '第9章 灼熱の火山帝国',
    setting: '溶岩要塞',
    bossId: 'magma-nyan-overlord',
  },
  {
    chapter: 10,
    title: '第10章 全次元大戦',
    setting: '崩壊する多元宇宙',
    bossId: 'omega-nyan-god',
  },
];

// ボスは複数レイヤーにまたがって出現しうるため、常に配列で返す
function bossLayersOf(bossId) {
  const def = ENEMY_DEFS.find((e) => e.id === bossId);
  return def.layers || [def.layer];
}

// 章・ステージ番号ごとの固定レイヤー構成。null を返す場合はランダム抽選対象。
function fixedLayersFor(chapter, stageNum) {
  if (chapter === 1) {
    if (stageNum <= 2) return ['ground'];
    if (stageNum <= 6) return ['ground', 'mid'];
    return ['ground', 'mid', 'sea']; // 7〜10
  }
  if (chapter === 2 && stageNum <= 5) {
    return ['sky', 'mid', 'ground', 'sea'];
  }
  return null;
}

function randomLayers(forceLayers = []) {
  const optional = ['sky', 'mid', 'sea'].filter((l) => !forceLayers.includes(l));
  const chosen = optional.filter(() => Math.random() < 0.55);
  const set = new Set(['ground', ...chosen, ...forceLayers]);
  return LAYER_IDS.filter((l) => set.has(l));
}

function enabledLayersFor(chapter, stageNum, bossLayers, isBoss) {
  const fixed = fixedLayersFor(chapter, stageNum);
  if (fixed) return fixed;
  return randomLayers(isBoss ? bossLayers : []);
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
const CHEAPEST_COST_BY_LAYER = { ground: 75, mid: 150, sea: 300, sky: 200 };

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
    const isRandomLayer = fixedLayersFor(ch.chapter, stageNum) === null;
    const enabledLayers = enabledLayersFor(ch.chapter, stageNum, bossLayers, isBoss);
    const econ = economyFor(globalIndex, isBoss, enabledLayers);
    const waves = generateWaves(globalIndex, enabledLayers, isBoss ? ch.bossId : null);

    STAGES.push({
      id: `ch${ch.chapter}-${stageNum}`,
      order: order++,
      chapter: ch.title,
      name: `第${ch.chapter}章-${stageNum}`,
      description: isBoss
        ? `${ch.title}の最終ボス戦。総力を挙げて城を守り抜け。（戦場: ${layerLabel(enabledLayers)}）`
        : isRandomLayer
          ? `どの戦線が開くかは出撃直前まで分からない。今回の戦場は${layerLabel(enabledLayers)}。`
          : `${ch.setting}を舞台にした戦い。戦場は${layerLabel(enabledLayers)}。`,
      laneLength: 1000 + globalIndex * 15,
      enabledLayers,
      randomLayer: isRandomLayer,
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
  {
    id: 'extra-1',
    name: 'エクストラ1 亡影の迷宮',
    description: '死角から忍び寄る亡影の大軍。全レイヤー同時展開に耐えられる編成でなければ突破は困難だ。',
    effectiveIndex: 55,
    bossId: 'phantom-baron-nyan',
    requiresStageId: 'ch3-10',
    rewardWeaponId: 'castle-shadow-cannon',
  },
  {
    id: 'extra-2',
    name: 'エクストラ2 混沌の竜穴',
    description: '天地を覆う混沌の竜が支配する戦場。生半可な戦力では自城に一歩も近づけない。',
    effectiveIndex: 85,
    bossId: 'chaos-nyan-dragon',
    requiresStageId: 'ch6-10',
    rewardWeaponId: 'castle-chaos-blaster',
  },
  {
    id: 'extra-3',
    name: 'エクストラ3 永劫の終着点',
    description: '全10章を制した者だけが挑める真の裏ボス戦。わんこ王国最強の編成で挑め。',
    effectiveIndex: 130,
    bossId: 'true-nyan-god-eternal',
    requiresStageId: 'ch10-10',
    rewardWeaponId: 'castle-eternal-railgun',
  },
];

const ALL_LAYERS = ['sky', 'mid', 'ground', 'sea'];

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
    randomLayer: false,
    boss: true,
    extra: true,
    requiresStageId: ex.requiresStageId,
    rewardWeaponId: ex.rewardWeaponId,
    ...econ,
    waves,
  });
}

export function getStage(id) {
  return STAGES.find((s) => s.id === id);
}

export function getStageIndex(id) {
  return STAGES.findIndex((s) => s.id === id);
}
