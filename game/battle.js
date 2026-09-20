// バトルフェーズのコアロジック（出撃・移動・当たり判定・勝敗判定）
// 上空/中空/地面/海面の4層はそれぞれ独立したレーンとして解決する。
// ボスなど一部の敵は複数レイヤーにまたがって出現できる（unit.layers配列）。

import { getStage } from './stages.js';
import { getUnitDef, spawnAlly, CASTLE_WEAPONS } from './units.js';
import { getEnemyDef, spawnEnemy } from './enemies.js';
import { getDifficultySettings } from './difficulty.js';

const KNOCKBACK_PX = 24;
const ALLY_SPAWN_X = 24;

function flattenWaves(waves) {
  const events = [];
  for (const wave of waves) {
    const count = wave.count || 1;
    const interval = wave.interval || 0;
    for (let i = 0; i < count; i++) {
      events.push({ time: wave.time + i * interval, enemyId: wave.enemyId });
    }
  }
  events.sort((a, b) => a.time - b.time);
  return events;
}

// 単一レイヤーのunit（.layer）にも複数レイヤーのunit（.layers）にも対応
function getLayers(entity) {
  return entity.layers || [entity.layer];
}

function layersOverlap(a, b) {
  const la = getLayers(a);
  const lb = getLayers(b);
  return la.some((l) => lb.includes(l));
}

// 陣営同士の移動・戦闘解決。opponentsはレイヤーの合致判定(layersOverlap)で自動的に絞り込まれる
// sign: +1 = 右へ進む（味方）, -1 = 左へ進む（敵）
function stepUnits(state, units, opponents, dt, sign, hpKey, onOpponentKilled) {
  const laneLength = state.laneLength;
  const sorted = [...units].sort((a, b) => (sign > 0 ? b.x - a.x : a.x - b.x));

  for (let i = 0; i < sorted.length; i++) {
    const u = sorted[i];
    if (u.dead) continue;

    let target = null;
    let bestDist = Infinity;
    for (const o of opponents) {
      if (o.dead || !layersOverlap(u, o)) continue;
      const dist = Math.abs(o.x - u.x);
      if (dist <= u.range && dist < bestDist) {
        bestDist = dist;
        target = o;
      }
    }

    if (target) {
      u.engaged = true;
      if (state.time >= u.nextAttackAt) {
        const mult = u.strongAgainst && u.strongAgainst.includes(target.attribute) ? 1.5 : 1;
        const dmg = Math.max(1, Math.round(u.atk * mult));
        target.hp -= dmg;
        u.nextAttackAt = state.time + u.atkInterval;
        u.attackFlashUntil = state.time + 200;

        if (target.hp <= 0) {
          target.hp = 0;
          target.dead = true;
          if (onOpponentKilled) onOpponentKilled(target);
        } else if (target.kbRemaining > 0) {
          target.kbRemaining -= 1;
          target.x = Math.min(laneLength, Math.max(0, target.x + sign * KNOCKBACK_PX));
          target.knockbackUntil = state.time + 150;
        }
      }
      continue;
    }

    const distToCastle = sign > 0 ? laneLength - u.x : u.x;
    if (distToCastle <= u.range) {
      u.engaged = true;
      if (state.time >= u.nextAttackAt) {
        state[hpKey] = Math.max(0, state[hpKey] - u.atk);
        u.nextAttackAt = state.time + u.atkInterval;
        u.attackFlashUntil = state.time + 200;
      }
      continue;
    }

    u.engaged = false;
    let maxX = sign > 0 ? laneLength : 0;
    if (i > 0) {
      const ahead = sorted[i - 1];
      maxX = sign > 0 ? ahead.x - ahead.width : ahead.x + ahead.width;
    }
    let newX = u.x + sign * u.speed * (dt / 1000);
    newX = sign > 0 ? Math.min(newX, maxX) : Math.max(newX, maxX);
    u.x = newX;
  }
}

export function createBattle(stageId, formation, levels = {}, difficulty = 'normal') {
  const stage = getStage(stageId);
  if (!stage) throw new Error(`unknown stage: ${stageId}`);
  const diff = getDifficultySettings(difficulty);
  const enemyCastleHp = Math.round(stage.enemyCastleHp * diff.enemyCastleHp);

  const state = {
    stage,
    difficulty,
    formation: formation.filter((id) => getUnitDef(id)),
    levels,
    enabledLayers: stage.enabledLayers,
    laneLength: stage.laneLength,
    time: 0,
    coin: stage.initialCoin,
    maxCoin: stage.maxCoin,
    coinRegen: stage.coinRegen,
    playerHp: stage.playerCastleHp,
    playerMaxHp: stage.playerCastleHp,
    enemyHp: enemyCastleHp,
    enemyMaxHp: enemyCastleHp,
    allies: [],
    enemies: [],
    spawnQueue: flattenWaves(stage.waves),
    cooldowns: {},
    // 自城の武器はキャラと同様に出撃（コイン消費）が必要。HPは持たず撃破されない
    castleWeapons: CASTLE_WEAPONS.map((w) => ({ ...w, deployed: false, nextAttackAt: 0, attackFlashUntil: 0 })),
    result: null,
  };

  const onEnemyKilled = (killed) => {
    state.coin = Math.min(state.maxCoin, state.coin + killed.reward);
  };

  function update(dt) {
    if (state.result) return;
    state.time += dt;

    while (state.spawnQueue.length && state.spawnQueue[0].time <= state.time) {
      const ev = state.spawnQueue.shift();
      const def = getEnemyDef(ev.enemyId);
      if (!getLayers(def).some((l) => state.enabledLayers.includes(l))) continue;
      state.enemies.push(spawnEnemy(ev.enemyId, state.laneLength - 20, diff.enemyStat));
    }

    state.coin = Math.min(state.maxCoin, state.coin + (state.coinRegen * dt) / 1000);

    // 単一レイヤーの味方・敵はレイヤーごとに解決（opponentsは全件渡し、layersOverlapで自動的に絞られる）
    for (const layer of state.enabledLayers) {
      const allyLayer = state.allies.filter((u) => u.layer === layer);
      const enemyLayer = state.enemies.filter((u) => u.layer === layer);
      stepUnits(state, allyLayer, state.enemies, dt, 1, 'enemyHp', onEnemyKilled);
      stepUnits(state, enemyLayer, state.allies, dt, -1, 'playerHp', null);
    }

    // 複数レイヤーにまたがるボスは二重処理を避けるため全体で1回だけ解決
    const multiLayerBosses = state.enemies.filter((u) => u.layers && !u.dead);
    for (const boss of multiLayerBosses) {
      stepUnits(state, [boss], state.allies, dt, -1, 'playerHp', null);
    }

    // 自城の武器（中距離砲・遠距離砲）は出撃済みのものだけ、レイヤーを問わず射程内の最も近い敵を自動迎撃する
    for (const weapon of state.castleWeapons) {
      if (!weapon.deployed) continue;
      if (state.time < weapon.nextAttackAt) continue;
      let target = null;
      let bestDist = Infinity;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (e.x <= weapon.range && e.x < bestDist) {
          bestDist = e.x;
          target = e;
        }
      }
      if (target) {
        target.hp -= weapon.atk;
        weapon.nextAttackAt = state.time + weapon.atkInterval;
        weapon.attackFlashUntil = state.time + 250;
        if (target.hp <= 0) {
          target.hp = 0;
          target.dead = true;
          onEnemyKilled(target);
        }
      }
    }

    state.allies = state.allies.filter((u) => !u.dead);
    state.enemies = state.enemies.filter((u) => !u.dead);

    if (state.enemyHp <= 0) {
      state.enemyHp = 0;
      state.result = 'win';
    } else if (state.playerHp <= 0) {
      state.playerHp = 0;
      state.result = 'lose';
    }
  }

  function deploy(defId) {
    if (state.result) return false;
    const def = getUnitDef(defId);
    if (!def) return false;
    if (!state.formation.includes(defId)) return false;
    if (!state.enabledLayers.includes(def.layer)) return false;
    const availableAt = state.cooldowns[defId] || 0;
    if (state.time < availableAt) return false;
    if (state.coin < def.cost) return false;

    state.coin -= def.cost;
    state.cooldowns[defId] = state.time + def.recast;
    state.allies.push(spawnAlly(defId, ALLY_SPAWN_X, state.levels[defId] || 1));
    return true;
  }

  function deployCastleWeapon(weaponId) {
    if (state.result) return false;
    const weapon = state.castleWeapons.find((w) => w.id === weaponId);
    if (!weapon || weapon.deployed) return false;
    if (state.coin < weapon.cost) return false;

    state.coin -= weapon.cost;
    weapon.deployed = true;
    return true;
  }

  function getRenderState() {
    return {
      time: state.time,
      coin: Math.floor(state.coin),
      maxCoin: state.maxCoin,
      playerHp: state.playerHp,
      playerMaxHp: state.playerMaxHp,
      enemyHp: state.enemyHp,
      enemyMaxHp: state.enemyMaxHp,
      laneLength: state.laneLength,
      enabledLayers: state.enabledLayers,
      difficulty: state.difficulty,
      result: state.result,
      stage,
      allies: state.allies.map((u) => ({ ...u })),
      enemies: state.enemies.map((u) => ({ ...u })),
      castleWeapons: state.castleWeapons.map((w) => ({ ...w, affordable: state.coin >= w.cost })),
      deployButtons: state.formation.map((defId) => {
        const def = getUnitDef(defId);
        const availableAt = state.cooldowns[defId] || 0;
        const cooldownRemaining = Math.max(0, availableAt - state.time);
        return {
          defId,
          def,
          cooldownRemaining,
          cooldownRatio: cooldownRemaining > 0 ? cooldownRemaining / def.recast : 0,
          affordable: state.coin >= def.cost,
          layerLocked: !state.enabledLayers.includes(def.layer),
        };
      }),
    };
  }

  return { update, deploy, deployCastleWeapon, getRenderState };
}
