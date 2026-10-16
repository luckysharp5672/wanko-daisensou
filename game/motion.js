// キャラごとの攻撃の動き。キャラの「役割」（units.js の role）から、戦い方に合った動きを選ぶ。
// メカ版・ハロウィン版は元のキャラと同じ役割なので、同じ動きになる。
import { getUnitDef } from './units.js';

// 役割 → 動きの種類
const ROLE_STYLE = {
  // 体当たり
  バランス: 'bash',
  // 踏みつけ・押しつぶし（重い前衛）
  壁役: 'stomp',
  盾役: 'stomp',
  鉄壁要塞: 'stomp',
  重装突撃: 'stomp',
  継ぎ接ぎ巨人: 'stomp',
  // 回転斬り（素早い遊撃）
  高速アタッカー: 'spin',
  高速遊撃: 'spin',
  高速強襲: 'spin',
  旋風連撃: 'spin',
  疾風二刀: 'spin',
  光速ステップ: 'spin',
  軽業強襲: 'spin',
  // 撃った反動でのけぞる（砲撃・狙撃）
  遠距離砲撃: 'recoil',
  重装砲撃: 'recoil',
  海底砲撃: 'recoil',
  超長距離狙撃: 'recoil',
  氷結乱射: 'recoil',
  天穹氷砲: 'recoil',
  海将: 'recoil',
  ガジェット乱射: 'recoil',
  電子化かし: 'recoil',
  // 弓を引いて放つ
  中距離攻撃: 'draw',
  月光射手: 'draw',
  // 刀の振り下ろし
  一刀両断: 'slash',
  剣聖: 'slash',
  影光剣士: 'slash',
  骸骨剣士: 'slash',
  // 槍の突き
  疾風槍舞: 'thrust',
  蝙蝠の疾風: 'thrust',
  // 魔法の詠唱（浮かび上がって放つ）
  魔法支援: 'cast',
  疾風魔導: 'cast',
  竜巻大魔導: 'cast',
  魔女の軍略: 'cast',
  星辰支配: 'cast',
  九色幻夢: 'cast',
  重力波動: 'cast',
  戦術支援: 'cast',
  魔女っ子アイドル: 'cast',
  // 爪の一閃
  雷爪一閃: 'claw',
  破滅の一撃: 'claw',
  影喰い: 'claw',
  // 飛びかかり・急襲
  低空強襲: 'dive',
  夜間急襲: 'dive',
  偵察襲撃: 'dive',
  潜航攻撃: 'dive',
  深海掃討: 'dive',
  氷翼降臨: 'dive',
  不死の氷翼: 'dive',
  // 咆哮（王・守護者）
  伝説の守護者: 'roar',
  龍神の加護: 'roar',
  五元神威: 'roar',
  重力獣王: 'roar',
  海王: 'roar',
  終焉の裁定者: 'roar',
  南瓜帝王: 'roar',
  吸血の元帥: 'roar',
  幽霊船長: 'roar',
  // 雷撃（ビリビリ震える）
  落雷化かし: 'zap',
  電炎二人衆: 'zap',
  包帯の二人衆: 'zap',
  // 号令（腕を振り上げて指示）
  撃破指揮官: 'command',
  空中司令: 'command',
  最終決戦兵器: 'command',
  // ドリルで突進
  掘削重戦車: 'drill',
};

const DEFAULT_STYLE = 'bash';

export function attackStyleOf(defId) {
  const def = getUnitDef(defId);
  return (def && ROLE_STYLE[def.role]) || DEFAULT_STYLE;
}

// 動きの種類 → 攻撃エフェクト
// melee: 相手の位置に出す／projectile: 相手まで飛ばして、着いたら impact を出す
export const STYLE_FX = {
  bash: { melee: 'fx-bash' },
  stomp: { melee: 'fx-quake' },
  spin: { melee: 'fx-claw' },
  recoil: { projectile: 'fx-bolt', impact: 'fx-burst' },
  draw: { projectile: 'fx-arrow', impact: 'fx-sparkle' },
  slash: { melee: 'fx-slash' },
  thrust: { melee: 'fx-thrust' },
  cast: { projectile: 'fx-orb', impact: 'fx-magic' },
  claw: { melee: 'fx-claw' },
  dive: { melee: 'fx-bash' },
  roar: { melee: 'fx-roar' },
  zap: { projectile: 'fx-spark-shot', impact: 'fx-zap' },
  command: { melee: 'fx-sparkle' },
  drill: { melee: 'fx-drill' },
};
