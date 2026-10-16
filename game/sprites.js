// バトル中のコマ送りポーズ。assets/characters/battle-anim/<id>/<pose>.png（6コマ・同じ台紙サイズ・足もとそろえ）
// ポーズ画像があるキャラだけ、ここに id を書く。ないキャラは今まで通り1枚の画像を CSS で揺らす。
// 画像ができたらここに id を足す（例: 'wankou'）。空の間は今まで通り1枚絵をCSSで動かす
const ANIMATED_IDS = [];

export const SPRITE_POSES = ['front', 'walk_1', 'walk_2', 'attack_1', 'attack_2', 'hit'];

const WALK_FRAME_MS = 180;
const ATTACK_WINDUP_MS = 110;
const ATTACK_TOTAL_MS = 380; // 戦闘ロジック上の攻撃表示(200ms)より長く見せて、2コマとも目に入るようにする
const HIT_EXTRA_MS = 60;

const disabled = new Set();

export function hasSprites(defId) {
  return ANIMATED_IDS.includes(defId) && !disabled.has(defId);
}

// コマ画像が1枚でも読めなければ、そのキャラはコマ送りをやめて元の1枚絵に戻す
export function disableSprites(defId) {
  disabled.add(defId);
}

export function getSpriteFrame(defId, pose) {
  return `assets/characters/battle-anim/${defId}/${pose}.png`;
}

export function preloadSprites(defIds) {
  for (const id of defIds) {
    if (!hasSprites(id)) continue;
    for (const pose of SPRITE_POSES) {
      const img = new Image();
      img.src = getSpriteFrame(id, pose);
    }
  }
}

function walkPhase(uid) {
  const n = parseInt(String(uid).replace(/\D/g, ''), 10) || 0;
  return (n * 97) % (WALK_FRAME_MS * 2);
}

// now は戦闘の経過時間（倍速にも追従する）
export function pickPose(unit, now) {
  if (now < unit.knockbackUntil + HIT_EXTRA_MS) return 'hit';
  const attackStart = unit.attackFlashUntil - 200;
  if (unit.attackFlashUntil > 0 && now >= attackStart && now < attackStart + ATTACK_TOTAL_MS) {
    return now - attackStart < ATTACK_WINDUP_MS ? 'attack_1' : 'attack_2';
  }
  if (!unit.engaged) {
    return Math.floor((now + walkPhase(unit.uid)) / WALK_FRAME_MS) % 2 === 0 ? 'walk_1' : 'walk_2';
  }
  return 'front';
}
