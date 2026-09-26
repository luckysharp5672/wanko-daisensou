import { createLoop } from './game/engine.js';
import { STAGES, getStage } from './game/stages.js';
import {
  UNIT_DEFS,
  GACHA_POOL,
  HALLOWEEN_GACHA_POOL,
  CASTLE_WEAPONS,
  MAX_LEVEL,
  LIMIT_BREAK_STEP,
  getUnitDef,
  getUpgradeCost,
  getEffectiveMaxLevel,
  getFormSuffix,
  getFormBadge,
  getFormIndex,
  FORM_SUFFIX,
  FORM_BONUS,
  FORM_LEVEL_SPAN,
  LEVEL_PER_STEP,
  getStatusImage,
  getBattleImage,
  getKirakiraImageForDef,
  getRadarStats,
} from './game/units.js';
import { createBattle, createPvpBattle } from './game/battle.js';
import { LAYER_IDS, LAYER_INFO } from './game/layers.js';
import { DIFFICULTY_LEVELS, getDifficultySettings } from './game/difficulty.js';
import {
  playTitleMusic,
  playPrepMusic,
  playBattleMusic,
  stopMusic,
  toggleMuted,
  isMuted,
  playHitSfx,
  playBoomSfx,
  playResultSfx,
} from './game/audio.js';

const app = document.getElementById('app');
const MAX_SLOTS = 10;
const MAX_SELECTED_WEAPONS = 2;
const SPEED_STEPS = [1, 2, 5];
const RARITY_LABELS = { basic: '基本', EX: 'EX', rare: 'レア', superrare: '超激レア', legend: '伝説レア' };

// 編成パターンの初期値（パターン1は最初から仲間の基本キャラ、パターン2・3は空で始まる）
const DEFAULT_FORMATION = UNIT_DEFS.filter((u) => u.startUnlocked).map((u) => u.id);

const appState = {
  // 現在ロード中のセーブデータのプロフィールID（未選択の間はnull）
  profileId: null,
  // 難易度ごとに独立してクリア進捗を記録する（ふつう/むずかしい/ゲキむずでそれぞれ別のステージ開放状況になる）
  clearedStagesByDifficulty: Object.fromEntries(DIFFICULTY_LEVELS.map((d) => [d.id, new Set()])),
  currentStageId: null,
  unlockedUnits: new Set(UNIT_DEFS.filter((u) => u.startUnlocked).map((u) => u.id)),
  unlockedWeapons: new Set(CASTLE_WEAPONS.filter((w) => w.startUnlocked).map((w) => w.id)),
  // 出撃時に持ち込む自城の武器（最大2つ）。編成画面で選択する
  selectedWeapons: CASTLE_WEAPONS.filter((w) => w.startUnlocked)
    .slice(0, MAX_SELECTED_WEAPONS)
    .map((w) => w.id),
  unitLevels: {},
  limitBreaks: {},
  dupeStock: {},
  walletCoin: 0,
  // 初回プレイ時のみ、わんこチケットを3枚だけ進呈する（以降はボス撃破で入手）
  gacha: { tickets: 3 },
  lastGachaResult: null,
  // 'normal' または 'halloween'。ガチャ画面の表示切り替え用（セーブデータには保存しない一時状態）
  gachaMode: 'normal',
  // キャラ詳細画面を閉じたときに戻る画面（'formation' または 'roster-status'）。一時状態
  detailReturnScreen: 'formation',
  // ステータス管理画面のフィルター・並び替え状態（セーブデータには保存しない一時状態）
  rosterStatusFilter: { layer: 'all', rarity: 'all', sort: 'default' },
  // 編成パターン（最大3つ）。appState.formationは常にこのうち選択中の1つと同じ配列を指す
  formationPatterns: [DEFAULT_FORMATION, [], []],
  activePatternIndex: 0,
  formation: DEFAULT_FORMATION,
  // 編成画面上部に大きく表示する「お気に入りキャラ」。最大3体、defIdまたはnull
  favoriteUnits: [null, null, null],
  selectedDifficulty: 'normal',
  // ステージ選択画面の章トグル開閉状態。null の間は renderHome() が現在攻略中の章だけを開いた状態で初期化する
  expandedChapters: null,
  battle: null,
  loop: null,
  lastResult: null,
  speed: 1,
  // 対戦モード（同一端末でのプレイヤーvsプレイヤー）用の状態。進行度・セーブデータには影響しない
  pvpBattle: null,
  pvpLoop: null,
  pvpSpeed: 1,
  // 対戦相手選択画面で編集する出撃スロット（プロフィールの編成とは独立、一時状態）
  vsFormation: { p1: [], p2: [] },
};

const laneUnitNodes = new Map();
const lastAttackFlash = new Map();
const lastCastleFlash = new Map();
const pvpLaneUnitNodes = new Map();
const pvpLastAttackFlash = new Map();

// ---------- セーブデータ（複数プロフィール対応・localStorage永続化） ----------
// 1台の端末を複数人で共有する想定のため、プロフィール（なまえ）ごとに進捗を分けて保存し、
// 過去に作られたセーブデータは削除しない限り蓄積されていく。

const SAVE_NS = 'wanko-bigwar';
const PROFILES_KEY = `${SAVE_NS}:profiles`;
const TOTAL_STAGE_COUNT = STAGES.length;

function saveDataKey(profileId) {
  return `${SAVE_NS}:save:${profileId}`;
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ストレージが使えない環境では何もしない */
  }
}

function listProfiles() {
  try {
    const raw = safeGetItem(PROFILES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProfilesIndex(profiles) {
  safeSetItem(PROFILES_KEY, JSON.stringify(profiles));
}

function makeProfileId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `p${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultSaveData() {
  return {
    version: 1,
    walletCoin: 0,
    gachaTickets: 3,
    unitLevels: {},
    limitBreaks: {},
    dupeStock: {},
    unlockedUnits: UNIT_DEFS.filter((u) => u.startUnlocked).map((u) => u.id),
    unlockedWeapons: CASTLE_WEAPONS.filter((w) => w.startUnlocked).map((w) => w.id),
    selectedWeapons: CASTLE_WEAPONS.filter((w) => w.startUnlocked)
      .slice(0, MAX_SELECTED_WEAPONS)
      .map((w) => w.id),
    formationPatterns: [[...DEFAULT_FORMATION], [], []],
    activePatternIndex: 0,
    formation: [...DEFAULT_FORMATION],
    favoriteUnits: [null, null, null],
    selectedDifficulty: 'normal',
    clearedStagesByDifficulty: Object.fromEntries(DIFFICULTY_LEVELS.map((d) => [d.id, []])),
  };
}

function serializeSaveData() {
  return {
    version: 1,
    walletCoin: appState.walletCoin,
    gachaTickets: appState.gacha.tickets,
    unitLevels: appState.unitLevels,
    limitBreaks: appState.limitBreaks,
    dupeStock: appState.dupeStock,
    unlockedUnits: [...appState.unlockedUnits],
    unlockedWeapons: [...appState.unlockedWeapons],
    selectedWeapons: appState.selectedWeapons,
    formationPatterns: appState.formationPatterns,
    activePatternIndex: appState.activePatternIndex,
    formation: appState.formation,
    favoriteUnits: appState.favoriteUnits,
    selectedDifficulty: appState.selectedDifficulty,
    clearedStagesByDifficulty: Object.fromEntries(
      DIFFICULTY_LEVELS.map((d) => [d.id, [...appState.clearedStagesByDifficulty[d.id]]])
    ),
  };
}

function applySaveData(data) {
  const fallback = createDefaultSaveData();
  appState.walletCoin = data.walletCoin ?? fallback.walletCoin;
  appState.gacha = { tickets: data.gachaTickets ?? fallback.gachaTickets };
  appState.unitLevels = data.unitLevels ?? {};
  appState.limitBreaks = data.limitBreaks ?? {};
  appState.dupeStock = data.dupeStock ?? {};
  appState.unlockedUnits = new Set(data.unlockedUnits ?? fallback.unlockedUnits);
  appState.unlockedWeapons = new Set(data.unlockedWeapons ?? fallback.unlockedWeapons);
  // 旧セーブデータ（selectedWeapons未保存）は解放済み武器の先頭2つを初期選択とする。
  // 解放が取り消されることはないが、上限2つは常に厳守する
  const requestedWeapons = data.selectedWeapons ?? [...appState.unlockedWeapons];
  appState.selectedWeapons = requestedWeapons
    .filter((id) => appState.unlockedWeapons.has(id))
    .slice(0, MAX_SELECTED_WEAPONS);
  if (Array.isArray(data.formationPatterns) && data.formationPatterns.length === 3) {
    appState.formationPatterns = data.formationPatterns.map((p) => (Array.isArray(p) ? [...p] : []));
  } else {
    // 旧セーブデータ（formationPatterns未保存）は既存の編成をパターン1として引き継ぐ
    appState.formationPatterns = [data.formation ?? fallback.formation, [], []];
  }
  appState.activePatternIndex =
    Number.isInteger(data.activePatternIndex) && data.activePatternIndex >= 0 && data.activePatternIndex < 3
      ? data.activePatternIndex
      : 0;
  appState.formation = appState.formationPatterns[appState.activePatternIndex];
  appState.favoriteUnits = data.favoriteUnits ?? fallback.favoriteUnits;
  appState.selectedDifficulty = data.selectedDifficulty ?? fallback.selectedDifficulty;
  appState.clearedStagesByDifficulty = Object.fromEntries(
    DIFFICULTY_LEVELS.map((d) => [
      d.id,
      new Set((data.clearedStagesByDifficulty && data.clearedStagesByDifficulty[d.id]) || []),
    ])
  );
  appState.expandedChapters = null;
  appState.currentStageId = null;
  appState.lastResult = null;
  appState.lastGachaResult = null;
}

function buildSaveSummary(data) {
  const clearedOf = (id) => (data.clearedStagesByDifficulty && data.clearedStagesByDifficulty[id]) || [];
  return {
    walletCoin: data.walletCoin,
    clearedNormal: clearedOf('normal').length,
    clearedHard: clearedOf('hard').length,
    clearedExtreme: clearedOf('extreme').length,
  };
}

function createProfile(name) {
  const id = makeProfileId();
  const now = Date.now();
  const profiles = listProfiles();
  const data = createDefaultSaveData();
  profiles.push({ id, name, createdAt: now, updatedAt: now, summary: buildSaveSummary(data) });
  saveProfilesIndex(profiles);
  safeSetItem(saveDataKey(id), JSON.stringify(data));
  return id;
}

function deleteProfile(id) {
  const profiles = listProfiles().filter((p) => p.id !== id);
  saveProfilesIndex(profiles);
  safeRemoveItem(saveDataKey(id));
  if (appState.profileId === id) {
    appState.profileId = null;
  }
}

function renameProfile(id, name) {
  const profiles = listProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx < 0) return;
  profiles[idx].name = name;
  saveProfilesIndex(profiles);
}

function loadProfile(id) {
  const raw = safeGetItem(saveDataKey(id));
  let data;
  try {
    data = raw ? JSON.parse(raw) : createDefaultSaveData();
  } catch {
    data = createDefaultSaveData();
  }
  applySaveData(data);
  appState.profileId = id;

  const profiles = listProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx >= 0) {
    profiles[idx].updatedAt = Date.now();
    saveProfilesIndex(profiles);
  }
}

function persistCurrentProfile() {
  if (!appState.profileId) return;
  const data = serializeSaveData();
  safeSetItem(saveDataKey(appState.profileId), JSON.stringify(data));
  const profiles = listProfiles();
  const idx = profiles.findIndex((p) => p.id === appState.profileId);
  if (idx >= 0) {
    profiles[idx].updatedAt = Date.now();
    profiles[idx].summary = buildSaveSummary(data);
    saveProfilesIndex(profiles);
  }
}

function formatSaveDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------- セーブデータのエクスポート/インポート（他端末への引き継ぎ用） ----------
// サーバーを使わず、セーブデータ一式をコード化したテキストを別端末にコピー&ペーストする方式。

const SAVE_CODE_PREFIX = 'WANKO1:';

function encodeSaveCode(profileName, data) {
  const json = JSON.stringify({ v: 1, name: profileName, data });
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `${SAVE_CODE_PREFIX}${b64}`;
}

function decodeSaveCode(code) {
  const trimmed = code.trim();
  if (!trimmed.startsWith(SAVE_CODE_PREFIX)) {
    throw new Error('invalid save code format');
  }
  const b64 = trimmed.slice(SAVE_CODE_PREFIX.length);
  const json = decodeURIComponent(escape(atob(b64)));
  const payload = JSON.parse(json);
  if (!payload || typeof payload !== 'object' || !payload.data) {
    throw new Error('invalid save code payload');
  }
  return payload;
}

function exportProfile(id) {
  const profile = listProfiles().find((p) => p.id === id);
  const raw = safeGetItem(saveDataKey(id));
  if (!profile || !raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return encodeSaveCode(profile.name, data);
}

function showExportResult(code) {
  const panel = document.getElementById('export-result-panel');
  const textEl = document.getElementById('export-result-text');
  if (!panel || !textEl) return;
  textEl.value = code;
  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function importSaveCode(code) {
  let payload;
  try {
    payload = decodeSaveCode(code);
  } catch {
    alert('コードの形式が正しくありません。コピーし直すか、ファイルを選び直してもう一度お試しください。');
    return;
  }
  const name = `${payload.name || 'ひきつぎ'}(引き継ぎ)`;
  const id = makeProfileId();
  const now = Date.now();
  const profiles = listProfiles();
  profiles.push({ id, name, createdAt: now, updatedAt: now, summary: buildSaveSummary(payload.data) });
  saveProfilesIndex(profiles);
  safeSetItem(saveDataKey(id), JSON.stringify(payload.data));
  loadProfile(id);
  renderHome();
  showScreen('home');
  playPrepMusic();
}

function renderProfileList() {
  const list = document.getElementById('profile-list');
  const profiles = listProfiles().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (profiles.length === 0) {
    list.innerHTML = '<p class="profile-empty">まだセーブデータがありません。下のフォームから最初のセーブデータを作ろう。</p>';
    return;
  }
  list.innerHTML = profiles
    .map((p) => {
      const s = p.summary || { walletCoin: 0, clearedNormal: 0, clearedHard: 0, clearedExtreme: 0 };
      return `<div class="profile-card">
        <div class="profile-card-name">${p.name}</div>
        <div class="profile-card-meta">最終プレイ：${formatSaveDate(p.updatedAt || p.createdAt)}</div>
        <div class="profile-card-stats">
          <span>🪙 ${s.walletCoin}</span>
          <span>ふつう ${s.clearedNormal}/${TOTAL_STAGE_COUNT}</span>
          <span>むずかしい ${s.clearedHard}/${TOTAL_STAGE_COUNT}</span>
          <span>ゲキむず ${s.clearedExtreme}/${TOTAL_STAGE_COUNT}</span>
        </div>
        <div class="profile-card-actions">
          <button class="btn btn--primary" type="button" data-action="continue-profile" data-profile-id="${p.id}">つづきから</button>
          <button class="btn btn--ghost" type="button" data-action="rename-profile" data-profile-id="${p.id}">名前を変更</button>
          <button class="btn btn--ghost" type="button" data-action="export-profile" data-profile-id="${p.id}">他の端末に引き継ぐ</button>
          <button class="btn btn--ghost btn--danger" type="button" data-action="delete-profile" data-profile-id="${p.id}">削除</button>
        </div>
      </div>`;
    })
    .join('');
}

function getLevel(defId) {
  return appState.unitLevels[defId] || 1;
}

function getLimitBreaks(defId) {
  return appState.limitBreaks[defId] || 0;
}

function getDupeStock(defId) {
  return appState.dupeStock[defId] || 0;
}

function getClearedSet(difficulty = appState.selectedDifficulty) {
  return appState.clearedStagesByDifficulty[difficulty];
}

function displayName(def, level) {
  return `${def.name}${getFormSuffix(level)}`;
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.screen === name);
  });
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function renderWallet() {
  document.querySelectorAll('.wallet-amount').forEach((el) => {
    el.textContent = appState.walletCoin;
  });
  document.querySelectorAll('.ticket-amount').forEach((el) => {
    el.textContent = appState.gacha.tickets;
  });
}

// ---------- 戦闘レイヤーの背景帯 ----------

function buildLaneRows(enabledLayers) {
  const container = document.getElementById('lane-rows');
  if (!container) return;
  container.innerHTML = '';
  for (const layerId of LAYER_IDS) {
    const info = LAYER_INFO[layerId];
    const active = enabledLayers.includes(layerId);
    const row = document.createElement('div');
    row.className = `lane-row lane-row--${layerId}` + (active ? '' : ' is-disabled');
    row.style.top = `${info.order * LAYER_BAND}%`;
    row.innerHTML = `<span class="lane-row-label">${info.label}${active ? '' : '（封鎖）'}</span>`;
    container.appendChild(row);
  }
}

// ---------- ホーム（ステージ選択） ----------

function isStageUnlocked(stage) {
  if (stage.requiresStageId) return getClearedSet().has(stage.requiresStageId);
  if (stage.order === 0) return true;
  const prev = STAGES.find((s) => s.order === stage.order - 1);
  return prev ? getClearedSet().has(prev.id) : true;
}

// 現在攻略中の章＝「解放済みだが未クリア」な最初のステージが属する章。
// 全ステージクリア済みなら最後の章を返す。
function getCurrentChapterTitle() {
  for (const stage of STAGES) {
    if (isStageUnlocked(stage) && !getClearedSet().has(stage.id)) {
      return stage.chapter;
    }
  }
  return STAGES[STAGES.length - 1].chapter;
}

function toggleChapter(chapter) {
  if (appState.expandedChapters.has(chapter)) {
    appState.expandedChapters.delete(chapter);
  } else {
    appState.expandedChapters.add(chapter);
  }
  renderHome();
}

function renderHome() {
  renderWallet();
  renderDifficultySelector();
  if (!appState.expandedChapters) {
    appState.expandedChapters = new Set([getCurrentChapterTitle()]);
  }
  const list = document.getElementById('stage-list');
  list.innerHTML = '';
  let lastChapter = null;
  let stageGroup = null;
  for (const stage of STAGES) {
    if (stage.chapter !== lastChapter) {
      lastChapter = stage.chapter;
      const expanded = appState.expandedChapters.has(stage.chapter);

      const heading = document.createElement('button');
      heading.type = 'button';
      heading.className = 'chapter-heading' + (expanded ? ' is-expanded' : '');
      heading.innerHTML = `
        <span class="chapter-heading-text">${stage.chapter}</span>
        <span class="chapter-heading-arrow" aria-hidden="true">▾</span>
      `;
      heading.addEventListener('click', () => toggleChapter(stage.chapter));
      list.appendChild(heading);

      stageGroup = document.createElement('div');
      stageGroup.className = 'chapter-stage-group' + (expanded ? '' : ' is-collapsed');
      list.appendChild(stageGroup);
    }

    const unlocked = isStageUnlocked(stage);
    const cleared = getClearedSet().has(stage.id);
    const layerBadges = stage.enabledLayers
      .map((l) => `<span class="mini-badge">${LAYER_INFO[l].label}</span>`)
      .join('');

    const card = document.createElement('button');
    card.className = 'stage-card' + (unlocked ? '' : ' is-locked') + (cleared ? ' is-cleared' : '');
    card.type = 'button';
    card.disabled = !unlocked;
    card.innerHTML = `
      <div class="stage-card-name">${stage.name}
        ${stage.extra ? '<span class="badge badge--extra">EXTRA</span>' : stage.boss ? '<span class="badge badge--boss">BOSS</span>' : ''}
        ${stage.randomLayer ? '<span class="badge badge--random">ランダム</span>' : ''}
      </div>
      <div class="stage-card-desc">${stage.description}</div>
      <div class="stage-card-layers">${layerBadges}</div>
      <div class="stage-card-foot">
        ${cleared ? '<span class="badge badge--cleared">クリア済み</span>' : ''}
        ${unlocked ? '' : '<span class="badge badge--locked">未解放</span>'}
      </div>
    `;
    if (unlocked) {
      card.addEventListener('click', () => {
        appState.currentStageId = stage.id;
        renderFormation();
        showScreen('formation');
        playPrepMusic();
      });
    }
    stageGroup.appendChild(card);
  }
}

// ---------- ガチャ ----------

function activeGachaPool() {
  return appState.gachaMode === 'halloween' ? HALLOWEEN_GACHA_POOL : GACHA_POOL;
}

function pullGacha() {
  if (appState.gacha.tickets <= 0) return null;
  appState.gacha.tickets -= 1;

  const pool = activeGachaPool();
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let pickedId = pool[pool.length - 1].defId;
  for (const entry of pool) {
    if (roll < entry.weight) {
      pickedId = entry.defId;
      break;
    }
    roll -= entry.weight;
  }

  const def = getUnitDef(pickedId);
  const isNew = !appState.unlockedUnits.has(pickedId);
  if (isNew) {
    appState.unlockedUnits.add(pickedId);
  } else {
    appState.dupeStock[pickedId] = getDupeStock(pickedId) + 1;
  }
  renderWallet();
  persistCurrentProfile();
  return { def, isNew };
}

const GACHA_SPIN_DURATION = { rare: 900, EX: 1100, superrare: 1500, legend: 2000 };

function flashScreen(rarity) {
  const flashEl = document.getElementById('gacha-flash');
  flashEl.classList.remove('is-flashing', 'is-legend');
  // 強制リフローでアニメーションを再トリガー
  void flashEl.offsetWidth;
  flashEl.classList.toggle('is-legend', rarity === 'legend');
  flashEl.classList.add('is-flashing');
}

function startGachaPull() {
  if (appState.gacha.tickets <= 0) return;
  const pullBtn = document.getElementById('btn-gacha-pull');
  const spinEl = document.getElementById('gacha-spin');
  const resultEl = document.getElementById('gacha-result');

  pullBtn.disabled = true;
  resultEl.hidden = true;
  spinEl.hidden = false;
  spinEl.className = 'gacha-spin';

  const result = pullGacha();
  if (!result) {
    spinEl.hidden = true;
    pullBtn.disabled = appState.gacha.tickets <= 0;
    return;
  }
  appState.lastGachaResult = result;
  spinEl.classList.add(`rarity-${result.def.rarity}`);

  const duration = GACHA_SPIN_DURATION[result.def.rarity] || 900;
  setTimeout(() => {
    spinEl.hidden = true;
    if (result.def.rarity === 'superrare' || result.def.rarity === 'legend') {
      flashScreen(result.def.rarity);
    }
    showGachaResult(result);
  }, duration);
}

function renderGacha() {
  renderWallet();
  const pullBtn = document.getElementById('btn-gacha-pull');
  pullBtn.disabled = appState.gacha.tickets <= 0;
  const resultEl = document.getElementById('gacha-result');
  resultEl.hidden = true;
  resultEl.className = 'gacha-result';
  const spinEl = document.getElementById('gacha-spin');
  spinEl.hidden = true;
  spinEl.className = 'gacha-spin';

  document.getElementById('gacha-screen-title').textContent =
    appState.gachaMode === 'halloween' ? '🎃 ハロウィンガチャ' : 'わんこガチャ';
  document.getElementById('gacha-screen-sub').textContent =
    appState.gachaMode === 'halloween'
      ? 'わんこチケットを1枚消費して、ハロウィン限定キャラの出現率アップ！'
      : 'わんこチケットを1枚消費して、新しい仲間を迎え入れよう';
  document.querySelector('[data-screen="gacha"]').classList.toggle('is-halloween-mode', appState.gachaMode === 'halloween');
  document.querySelectorAll('.gacha-mode-tab').forEach((tab) => {
    tab.classList.toggle('is-selected', tab.dataset.gachaMode === appState.gachaMode);
  });
}

function showGachaResult(result) {
  const resultEl = document.getElementById('gacha-result');
  resultEl.hidden = false;
  resultEl.className = `gacha-result rarity-${result.def.rarity} layer-${result.def.layer}`;
  resultEl.innerHTML = `
    <div class="gacha-result-portrait" style="background-image:url('${getKirakiraImageForDef(result.def)}')">
      <img src="${getStatusImage(result.def.id)}" alt="">
    </div>
    <div class="gacha-result-name">${result.def.name}</div>
    <div class="badge badge--rarity">${RARITY_LABELS[result.def.rarity]}</div>
    <div class="gacha-result-note">${
      result.isNew
        ? '新しい仲間が加わった！'
        : `所持済み！限界突破素材として編成画面から使える（重複 ${getDupeStock(result.def.id)}個）`
    }</div>
  `;
  document.getElementById('btn-gacha-pull').disabled = appState.gacha.tickets <= 0;
}

// ---------- 編成 ----------

function toggleFormation(defId) {
  const idx = appState.formation.indexOf(defId);
  if (idx >= 0) {
    appState.formation.splice(idx, 1);
  } else if (appState.formation.length < MAX_SLOTS) {
    appState.formation.push(defId);
  }
  renderFormation();
  persistCurrentProfile();
}

function reorderFormation(fromIndex, toIndex) {
  const arr = appState.formation;
  if (fromIndex < 0 || fromIndex >= arr.length) return;
  const [item] = arr.splice(fromIndex, 1);
  arr.splice(Math.min(toIndex, arr.length), 0, item);
  renderFormation();
  persistCurrentProfile();
}

function switchFormationPattern(index) {
  if (index === appState.activePatternIndex || !appState.formationPatterns[index]) return;
  appState.activePatternIndex = index;
  appState.formation = appState.formationPatterns[index];
  renderFormation();
  persistCurrentProfile();
}

function renderFormationPatternTabs() {
  document.querySelectorAll('.formation-pattern-tab').forEach((tab) => {
    const idx = Number(tab.dataset.patternIndex);
    const count = appState.formationPatterns[idx].length;
    tab.textContent = `パターン${idx + 1}（${count}/${MAX_SLOTS}）`;
    tab.classList.toggle('is-selected', idx === appState.activePatternIndex);
  });
}

function upgradeUnit(defId) {
  const def = getUnitDef(defId);
  const level = getLevel(defId);
  const cost = getUpgradeCost(def, level, getLimitBreaks(defId));
  if (cost === null || appState.walletCoin < cost) return;
  appState.walletCoin -= cost;
  appState.unitLevels[defId] = level + 1;
  renderWallet();
  renderFormation();
  renderRosterStatus();
  persistCurrentProfile();
}

function limitBreakUnit(defId) {
  const def = getUnitDef(defId);
  if (def.rarity === 'basic') return;
  const lb = getLimitBreaks(defId);
  if (getEffectiveMaxLevel(def, lb) >= MAX_LEVEL) return;
  if (getDupeStock(defId) <= 0) return;
  appState.dupeStock[defId] -= 1;
  appState.limitBreaks[defId] = lb + 1;
  renderFormation();
  renderRosterStatus();
  persistCurrentProfile();
}

function renderDifficultySelector() {
  const container = document.getElementById('home-difficulty-selector');
  if (!container) return;
  container.innerHTML = DIFFICULTY_LEVELS.map((d) => {
    const settings = getDifficultySettings(d.id);
    const selected = appState.selectedDifficulty === d.id;
    const clearedCount = appState.clearedStagesByDifficulty[d.id].size;
    return `<button type="button" class="difficulty-btn difficulty-btn--${d.id}${selected ? ' is-selected' : ''}" data-action="select-difficulty" data-difficulty="${d.id}">
      <span class="difficulty-label">${d.label}</span>
      <span class="difficulty-hint">報酬 x${settings.reward}</span>
      <span class="difficulty-hint">${clearedCount}/${STAGES.length} クリア</span>
    </button>`;
  }).join('');
}

function renderFormationDifficultyBadge() {
  const el = document.getElementById('formation-difficulty-badge');
  if (!el) return;
  const info = DIFFICULTY_LEVELS.find((d) => d.id === appState.selectedDifficulty);
  el.textContent = info ? `難易度：${info.label}` : '';
  el.className = `formation-difficulty-badge difficulty-tag--${appState.selectedDifficulty}`;
}

// ---------- ステータスのレーダーチャート ----------

function radarPoint(angleDeg, radius, cx, cy) {
  const rad = (angleDeg * Math.PI) / 180;
  return [cx + radius * Math.sin(rad), cy - radius * Math.cos(rad)];
}

function buildRadarChartSvg(stats) {
  const cx = 60;
  const cy = 56;
  const maxR = 38;
  const angleStep = 360 / stats.length;
  const angles = stats.map((_, i) => i * angleStep);

  const gridRings = [0.33, 0.66, 1]
    .map((ratio) => {
      const pts = angles.map((a) => radarPoint(a, maxR * ratio, cx, cy).join(',')).join(' ');
      return `<polygon points="${pts}" class="radar-grid" />`;
    })
    .join('');

  const axisLines = angles
    .map((a) => {
      const [x, y] = radarPoint(a, maxR, cx, cy);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar-axis" />`;
    })
    .join('');

  const dataPts = stats.map((s, i) => radarPoint(angles[i], maxR * s.ratio, cx, cy).map((n) => n.toFixed(1)).join(',')).join(' ');

  const labels = stats
    .map((s, i) => {
      const [lx, ly] = radarPoint(angles[i], maxR + 15, cx, cy);
      return `
        <text x="${lx.toFixed(1)}" y="${(ly - 4).toFixed(1)}" class="radar-label">${s.label}</text>
        <text x="${lx.toFixed(1)}" y="${(ly + 7).toFixed(1)}" class="radar-value">${s.value}</text>
      `;
    })
    .join('');

  return `
    <svg class="roster-radar" viewBox="0 0 120 112" width="120" height="112" aria-hidden="true">
      ${gridRings}
      ${axisLines}
      <polygon points="${dataPts}" class="radar-shape" />
      ${labels}
    </svg>
  `;
}

function toggleSelectedWeapon(weaponId) {
  if (!appState.unlockedWeapons.has(weaponId)) return;
  const idx = appState.selectedWeapons.indexOf(weaponId);
  if (idx >= 0) {
    appState.selectedWeapons.splice(idx, 1);
  } else if (appState.selectedWeapons.length < MAX_SELECTED_WEAPONS) {
    appState.selectedWeapons.push(weaponId);
  } else {
    return;
  }
  renderCastleWeapons();
  persistCurrentProfile();
}

function renderCastleWeapons() {
  const container = document.getElementById('castle-weapon-list');
  if (!container) return;
  const countEl = document.getElementById('castle-weapon-count');
  if (countEl) countEl.textContent = `${appState.selectedWeapons.length}/${MAX_SELECTED_WEAPONS} 選択中`;

  const unlocked = CASTLE_WEAPONS.filter((w) => appState.unlockedWeapons.has(w.id));
  const lockedCount = CASTLE_WEAPONS.length - unlocked.length;
  const capReached = appState.selectedWeapons.length >= MAX_SELECTED_WEAPONS;
  container.innerHTML =
    unlocked
      .map((w) => {
        const selected = appState.selectedWeapons.includes(w.id);
        const disabled = !selected && capReached;
        return `<button type="button" class="castle-weapon-card${selected ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}" data-weapon-id="${w.id}">
      <span class="castle-weapon-check" aria-hidden="true">${selected ? '✓' : ''}</span>
      <span class="castle-weapon-icon">${w.icon}</span>
      <div>
        <div class="castle-weapon-name">${w.name}</div>
        <div class="castle-weapon-stats">
          <span>コスト ${w.cost}</span>
          <span>攻撃 ${w.atk}</span>
          <span>射程 ${w.range}</span>
          <span>間隔 ${(w.atkInterval / 1000).toFixed(1)}秒</span>
        </div>
        <p class="castle-weapon-flavor">${w.flavor}</p>
      </div>
    </button>`;
      })
      .join('') +
    (lockedCount > 0
      ? `<p class="castle-weapon-hint">★ エクストラステージをクリアすると、新しい自城の武器が手に入ります（残り${lockedCount}種）</p>`
      : '');

  container.querySelectorAll('.castle-weapon-card').forEach((card) => {
    card.addEventListener('click', () => toggleSelectedWeapon(card.dataset.weaponId));
  });
}

// お気に入りキャラ選択セレクトの選択肢（解放済みキャラのみ）を作る
function favoriteOptionsHtml(selectedId) {
  const options = UNIT_DEFS.filter((u) => appState.unlockedUnits.has(u.id)).map(
    (u) => `<option value="${u.id}" ${u.id === selectedId ? 'selected' : ''}>${u.name}</option>`
  );
  return `<option value="">未選択</option>${options.join('')}`;
}

function renderFavorites() {
  const row = document.getElementById('favorites-row');
  if (!row) return;
  row.innerHTML = appState.favoriteUnits
    .map((defId, i) => {
      const def = defId ? getUnitDef(defId) : null;
      return `
        <div class="favorite-slot">
          <select class="favorite-select" data-slot-index="${i}">
            ${favoriteOptionsHtml(defId)}
          </select>
          <div class="favorite-portrait${def ? '' : ' is-empty'}" data-slot-index="${i}" style="${def ? `background-image:url('${getKirakiraImageForDef(def)}')` : ''}">
            ${def ? `<img class="favorite-portrait-img" src="${getStatusImage(def.id)}" alt="${def.name}">` : '<span class="favorite-portrait-placeholder">未選択</span>'}
          </div>
        </div>
      `;
    })
    .join('');

  row.querySelectorAll('.favorite-select').forEach((select) => {
    select.addEventListener('change', (e) => {
      const idx = Number(e.target.dataset.slotIndex);
      appState.favoriteUnits[idx] = e.target.value || null;
      renderFavorites();
      persistCurrentProfile();
    });
  });

  row.querySelectorAll('.favorite-portrait:not(.is-empty)').forEach((el) => {
    el.addEventListener('click', () => {
      const defId = appState.favoriteUnits[Number(el.dataset.slotIndex)];
      if (defId) openCharacterDetail(defId);
    });
  });
}

function renderFormation() {
  renderWallet();
  const stage = getStage(appState.currentStageId);
  document.getElementById('formation-stage-name').textContent = stage
    ? `${stage.chapter} ／ ${stage.name}`
    : '';
  renderFormationDifficultyBadge();
  renderFormationPatternTabs();
  renderFavorites();
  renderCastleWeapons();

  document.getElementById('slot-count').textContent = `${appState.formation.length}/${MAX_SLOTS}`;

  const slotList = document.getElementById('slot-list');
  slotList.innerHTML = '';
  for (let i = 0; i < MAX_SLOTS; i++) {
    const defId = appState.formation[i];
    const slot = document.createElement('div');
    slot.className = 'slot-item' + (defId ? '' : ' is-empty');
    slot.dataset.slotIndex = String(i);

    if (defId) {
      const def = getUnitDef(defId);
      slot.classList.add(`layer-${def.layer}`);
      slot.draggable = true;
      slot.innerHTML = `
        <img class="slot-icon" src="${getBattleImage(def.id)}" alt="">
        <span class="slot-name">${def.name}</span>
        <button class="slot-remove" type="button" aria-label="編成から外す">×</button>
      `;
      slot.querySelector('.slot-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFormation(defId);
      });
      slot.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'slot', index: i }));
      });
    } else {
      slot.textContent = '－';
    }

    slot.addEventListener('dragover', (e) => e.preventDefault());
    slot.addEventListener('drop', (e) => {
      e.preventDefault();
      let payload;
      try {
        payload = JSON.parse(e.dataTransfer.getData('text/plain'));
      } catch {
        return;
      }
      if (payload.type === 'roster') {
        if (!appState.formation.includes(payload.defId) && appState.formation.length < MAX_SLOTS) {
          appState.formation.splice(i, 0, payload.defId);
          renderFormation();
        }
      } else if (payload.type === 'slot') {
        reorderFormation(payload.index, i);
      }
    });

    slotList.appendChild(slot);
  }

  const rosterList = document.getElementById('roster-list');
  rosterList.innerHTML = '';
  for (const def of UNIT_DEFS) {
    if (!appState.unlockedUnits.has(def.id)) continue;
    const selected = appState.formation.includes(def.id);
    const level = getLevel(def.id);
    const lb = getLimitBreaks(def.id);
    const cap = getEffectiveMaxLevel(def, lb);
    const dupeStock = getDupeStock(def.id);
    const upgradeCost = getUpgradeCost(def, level, lb);
    const layerLabel = LAYER_INFO[def.layer].label;
    const isGachaUnit = def.rarity !== 'basic';
    const radarStats = getRadarStats(def, level);

    const card = document.createElement('div');
    card.className = `roster-card layer-${def.layer}` + (selected ? ' is-selected' : '');
    card.draggable = true;
    card.innerHTML = `
      <div class="roster-card-head">
        <div class="roster-portrait" style="background-image:url('${getKirakiraImageForDef(def)}')">
          <img class="roster-portrait-img" src="${getStatusImage(def.id)}" alt="${def.name}">
          ${getFormBadge(level) ? `<span class="roster-form-badge">${getFormBadge(level)}</span>` : ''}
          ${selected ? '<span class="roster-deployed-badge">✓ 出撃中</span>' : ''}
        </div>
        <div class="roster-info">
          <div class="roster-name-row">
            <span class="roster-name">${displayName(def, level)} <span class="roster-level">Lv.${level}/${cap}</span></span>
            <span class="badge badge--layer">${layerLabel}</span>
            ${selected ? '<span class="badge badge--deployed">出撃スロット中</span>' : ''}
          </div>
          <div class="roster-role">${def.breed}・${def.role}</div>
          <div class="roster-badges">
            <span class="badge badge--rarity rarity-${def.rarity}">${RARITY_LABELS[def.rarity]}</span>
            <span class="badge badge--cost">コスト ${def.cost}</span>
            ${isGachaUnit ? `<span class="badge badge--limitbreak">限界突破 ${lb}/5</span>` : ''}
          </div>
          <button class="btn btn--detail" type="button">🔍 くわしく見る</button>
        </div>
      </div>
      <div class="roster-stats">
        ${buildRadarChartSvg(radarStats)}
      </div>
      <p class="roster-flavor">${def.flavor}</p>
      <div class="roster-upgrade">
        <button class="btn btn--upgrade" type="button" ${upgradeCost === null ? 'disabled' : ''}>
          ${upgradeCost === null ? (cap >= MAX_LEVEL ? 'MAX' : '上限突破が必要') : `🪙 パワーアップ (${upgradeCost})`}
        </button>
      </div>
      ${
        isGachaUnit && cap < MAX_LEVEL
          ? `<div class="roster-limitbreak">
               <span>重複キャラ ${dupeStock}個所持</span>
               <button class="btn btn--limitbreak" type="button" ${dupeStock <= 0 ? 'disabled' : ''}>
                 🧬 限界突破（Lv上限+${LIMIT_BREAK_STEP}）
               </button>
             </div>`
          : ''
      }
    `;
    card.addEventListener('click', () => toggleFormation(def.id));
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'roster', defId: def.id }));
    });
    const upgradeBtn = card.querySelector('.btn--upgrade');
    if (upgradeCost !== null) {
      upgradeBtn.disabled = appState.walletCoin < upgradeCost;
      upgradeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        upgradeUnit(def.id);
      });
    }
    const limitBreakBtn = card.querySelector('.btn--limitbreak');
    if (limitBreakBtn) {
      limitBreakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        limitBreakUnit(def.id);
      });
    }
    card.querySelector('.btn--detail').addEventListener('click', (e) => {
      e.stopPropagation();
      openCharacterDetail(def.id);
    });
    rosterList.appendChild(card);
  }

  const sortieBtn = document.getElementById('btn-sortie');
  sortieBtn.disabled = appState.formation.length === 0;
}

// ---------- キャラクター詳細画面 ----------

// レベルアップによる成長・進化・限界突破の仕組みを、そのキャラの現在値に沿って説明する
function buildGrowthInfoHtml(def, level, lb) {
  const cap = getEffectiveMaxLevel(def, lb);
  const formIdx = getFormIndex(level);
  const lines = [];

  lines.push(`レベルが1上がるごとに、HP・攻撃力がそれぞれ基礎値の+${Math.round(LEVEL_PER_STEP * 100)}%ずつ上昇します。`);

  if (formIdx < FORM_BONUS.length - 1) {
    const nextLevel = (formIdx + 1) * FORM_LEVEL_SPAN;
    const nextBonusPct = Math.round((FORM_BONUS[formIdx + 1] - 1) * 100);
    lines.push(
      `Lv${nextLevel}に到達すると「${FORM_SUFFIX[formIdx + 1]}」に進化し、能力が基礎値の+${nextBonusPct}%相当まで大幅強化されます。`
    );
  } else {
    lines.push(`すでに最終形態「${FORM_SUFFIX[formIdx] || '第一形態'}」まで進化済みです。`);
  }

  if (def.rarity === 'basic') {
    lines.push(`基本キャラのため、最初からレベル上限${MAX_LEVEL}まで育成できます。`);
  } else if (cap < MAX_LEVEL) {
    const dupeStock = getDupeStock(def.id);
    const remainingBreaks = Math.ceil((MAX_LEVEL - cap) / LIMIT_BREAK_STEP);
    lines.push(
      `現在のレベル上限は${cap}（限界突破 ${lb}/5）。ガチャで同じキャラが重複した時に1体消費すると上限が+${LIMIT_BREAK_STEP}されます。最大レベル${MAX_LEVEL}まであと${remainingBreaks}回の限界突破が必要です（現在の重複ストック：${dupeStock}個）。`
    );
  } else {
    lines.push(`限界突破が完了し、レベル上限${MAX_LEVEL}まで育成可能です。`);
  }

  return lines.map((line) => `<p>${line}</p>`).join('');
}

function renderCharacterDetail(defId) {
  const def = getUnitDef(defId);
  if (!def) return;
  const level = getLevel(defId);
  const lb = getLimitBreaks(defId);
  const cap = getEffectiveMaxLevel(def, lb);
  const radarStats = getRadarStats(def, level);
  const isGachaUnit = def.rarity !== 'basic';

  document.getElementById('detail-char-name').textContent = displayName(def, level);
  document.getElementById('detail-char-subtitle').textContent = `${def.breed}・${def.role}`;

  document.getElementById('detail-portrait').style.backgroundImage = `url('${getKirakiraImageForDef(def)}')`;
  const portraitImg = document.getElementById('detail-portrait-img');
  portraitImg.src = getStatusImage(def.id);
  portraitImg.alt = def.name;

  document.getElementById('detail-badges').innerHTML = `
    <span class="badge badge--rarity rarity-${def.rarity}">${RARITY_LABELS[def.rarity]}</span>
    <span class="badge badge--layer">${LAYER_INFO[def.layer].label}</span>
    <span class="roster-level">Lv.${level}/${cap}</span>
    ${getFormBadge(level) ? `<span class="detail-form-badge">${getFormBadge(level)}</span>` : ''}
    ${isGachaUnit ? `<span class="badge badge--limitbreak">限界突破 ${lb}/5</span>` : ''}
  `;

  document.getElementById('detail-stats-row').innerHTML = `
    <span>コスト ${def.cost}</span>
    <span>HP ${radarStats[0].value}</span>
    <span>攻撃 ${radarStats[1].value}</span>
    <span>射程 ${def.range}</span>
    <span>速度 ${def.speed}</span>
  `;

  document.getElementById('detail-radar').innerHTML = buildRadarChartSvg(radarStats);
  document.getElementById('detail-flavor').textContent = def.flavor;
  document.getElementById('detail-growth').innerHTML = buildGrowthInfoHtml(def, level, lb);
}

function openCharacterDetail(defId, returnScreen = 'formation') {
  renderCharacterDetail(defId);
  appState.detailReturnScreen = returnScreen;
  showScreen('character-detail');
}

// ---------- ステータス管理画面（所持キャラ一覧・閲覧専用） ----------

const ROSTER_RARITY_ORDER = ['basic', 'EX', 'rare', 'superrare', 'legend'];

const ROSTER_SORTERS = {
  default: null,
  'level-desc': (a, b) => getLevel(b.id) - getLevel(a.id),
  'level-asc': (a, b) => getLevel(a.id) - getLevel(b.id),
  'rarity-desc': (a, b) => ROSTER_RARITY_ORDER.indexOf(b.rarity) - ROSTER_RARITY_ORDER.indexOf(a.rarity),
  'rarity-asc': (a, b) => ROSTER_RARITY_ORDER.indexOf(a.rarity) - ROSTER_RARITY_ORDER.indexOf(b.rarity),
  'cost-desc': (a, b) => b.cost - a.cost,
  'cost-asc': (a, b) => a.cost - b.cost,
  name: (a, b) => a.name.localeCompare(b.name, 'ja'),
};

function renderRosterStatus() {
  const container = document.getElementById('roster-status-list');
  if (!container) return;
  const { layer, rarity, sort } = appState.rosterStatusFilter;

  let list = UNIT_DEFS.filter((def) => appState.unlockedUnits.has(def.id));
  if (layer !== 'all') list = list.filter((def) => def.layer === layer);
  if (rarity !== 'all') list = list.filter((def) => def.rarity === rarity);
  const sorter = ROSTER_SORTERS[sort];
  if (sorter) list = [...list].sort(sorter);

  container.innerHTML = '';
  if (list.length === 0) {
    container.innerHTML = '<p class="roster-status-empty">条件に一致するキャラがいません。</p>';
    return;
  }
  for (const def of list) {
    const selected = appState.formation.includes(def.id);
    const level = getLevel(def.id);
    const lb = getLimitBreaks(def.id);
    const cap = getEffectiveMaxLevel(def, lb);
    const dupeStock = getDupeStock(def.id);
    const upgradeCost = getUpgradeCost(def, level, lb);
    const layerLabel = LAYER_INFO[def.layer].label;
    const isGachaUnit = def.rarity !== 'basic';
    const radarStats = getRadarStats(def, level);

    const card = document.createElement('div');
    card.className = `roster-card layer-${def.layer}` + (selected ? ' is-selected' : '');
    card.innerHTML = `
      <div class="roster-card-head">
        <div class="roster-portrait" style="background-image:url('${getKirakiraImageForDef(def)}')">
          <img class="roster-portrait-img" src="${getStatusImage(def.id)}" alt="${def.name}">
          ${getFormBadge(level) ? `<span class="roster-form-badge">${getFormBadge(level)}</span>` : ''}
          ${selected ? '<span class="roster-deployed-badge">✓ 出撃中</span>' : ''}
        </div>
        <div class="roster-info">
          <div class="roster-name-row">
            <span class="roster-name">${displayName(def, level)} <span class="roster-level">Lv.${level}/${cap}</span></span>
            <span class="badge badge--layer">${layerLabel}</span>
          </div>
          <div class="roster-role">${def.breed}・${def.role}</div>
          <div class="roster-badges">
            <span class="badge badge--rarity rarity-${def.rarity}">${RARITY_LABELS[def.rarity]}</span>
            <span class="badge badge--cost">コスト ${def.cost}</span>
            ${isGachaUnit ? `<span class="badge badge--limitbreak">限界突破 ${lb}/5</span>` : ''}
          </div>
          <button class="btn btn--detail" type="button">🔍 くわしく見る</button>
        </div>
      </div>
      <div class="roster-stats">
        ${buildRadarChartSvg(radarStats)}
      </div>
      <p class="roster-flavor">${def.flavor}</p>
      <div class="roster-upgrade">
        <button class="btn btn--upgrade" type="button" ${upgradeCost === null ? 'disabled' : ''}>
          ${upgradeCost === null ? (cap >= MAX_LEVEL ? 'MAX' : '上限突破が必要') : `🪙 パワーアップ (${upgradeCost})`}
        </button>
      </div>
      ${
        isGachaUnit && cap < MAX_LEVEL
          ? `<div class="roster-limitbreak">
               <span>重複キャラ ${dupeStock}個所持</span>
               <button class="btn btn--limitbreak" type="button" ${dupeStock <= 0 ? 'disabled' : ''}>
                 🧬 限界突破（Lv上限+${LIMIT_BREAK_STEP}）
               </button>
             </div>`
          : ''
      }
    `;
    card.addEventListener('click', () => openCharacterDetail(def.id, 'roster-status'));
    const upgradeBtn = card.querySelector('.btn--upgrade');
    if (upgradeCost !== null) {
      upgradeBtn.disabled = appState.walletCoin < upgradeCost;
      upgradeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        upgradeUnit(def.id);
      });
    }
    const limitBreakBtn = card.querySelector('.btn--limitbreak');
    if (limitBreakBtn) {
      limitBreakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        limitBreakUnit(def.id);
      });
    }
    container.appendChild(card);
  }
}

// ---------- バトル ----------

function buildDeployRow(stage) {
  const row = document.getElementById('deploy-row');
  row.innerHTML = '';
  for (const defId of appState.formation) {
    const def = getUnitDef(defId);
    const level = getLevel(defId);
    const locked = !stage.enabledLayers.includes(def.layer);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `deploy-btn layer-${def.layer}` + (locked ? ' is-locked' : '');
    btn.dataset.defId = defId;
    btn.disabled = locked;
    btn.title = locked ? `${LAYER_INFO[def.layer].label}は今回封鎖されています` : '';
    btn.innerHTML = `
      <span class="deploy-cd" data-role="cd"></span>
      <span class="deploy-layer">${LAYER_INFO[def.layer].label}</span>
      <span class="deploy-icon">
        <img src="${getBattleImage(defId)}" alt="">
        ${getFormBadge(level) ? `<span class="deploy-form-badge">${getFormBadge(level)}</span>` : ''}
      </span>
      <span class="deploy-cost">${def.cost}</span>
      ${locked ? '<span class="deploy-lock">🔒</span>' : ''}
    `;
    if (!locked) {
      btn.addEventListener('click', () => {
        appState.battle.deploy(defId);
      });
    }
    row.appendChild(btn);
  }

  for (const weapon of CASTLE_WEAPONS.filter((w) => appState.selectedWeapons.includes(w.id))) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'deploy-btn deploy-btn--castle';
    btn.dataset.weaponId = weapon.id;
    btn.title = weapon.flavor;
    btn.innerHTML = `
      <span class="deploy-layer">自城</span>
      <span class="deploy-icon">${weapon.icon}</span>
      <span class="deploy-cost">${weapon.cost}</span>
    `;
    btn.addEventListener('click', () => {
      appState.battle.deployCastleWeapon(weapon.id);
    });
    row.appendChild(btn);
  }
}

function startBattle(stageId, difficulty = appState.selectedDifficulty) {
  appState.currentStageId = stageId;
  const stage = getStage(stageId);
  appState.battle = createBattle(stageId, appState.formation, appState.unitLevels, difficulty, appState.selectedWeapons);
  appState.speed = 1;
  document.getElementById('btn-speed').textContent = 'x1';

  document.getElementById('lane-units').innerHTML = '';
  laneUnitNodes.clear();
  lastAttackFlash.clear();
  lastCastleFlash.clear();
  document.getElementById('result-overlay').hidden = true;
  document.getElementById('result-overlay').className = 'battle-result-overlay';

  buildLaneRows(stage.enabledLayers);
  buildDeployRow(stage);
  playBattleMusic(stage.boss);
  updateMuteButton();

  const diffInfo = DIFFICULTY_LEVELS.find((d) => d.id === difficulty);
  const diffBadge = document.getElementById('battle-difficulty');
  diffBadge.textContent = diffInfo ? diffInfo.label : '';
  diffBadge.className = `battle-difficulty difficulty-tag--${difficulty}`;

  if (appState.loop) appState.loop.stop();
  appState.loop = createLoop({
    update: (dt) => appState.battle.update(dt),
    render: renderBattleFrame,
  });
  appState.loop.start();

  showScreen('battle');
}

const LAYER_BAND = 100 / LAYER_IDS.length;

function layerTopPercent(unit) {
  const layers = unit.layers || [unit.layer];
  if (layers.length === 1) {
    const band = LAYER_INFO[layers[0]].order * LAYER_BAND;
    return band + (unit.side === 'ally' ? LAYER_BAND * 0.68 : LAYER_BAND * 0.3);
  }
  // 複数レイヤーにまたがる大型ボスは、またがる帯の中央に大きく表示する
  const orders = layers.map((l) => LAYER_INFO[l].order);
  const top = Math.min(...orders) * LAYER_BAND;
  const bottom = (Math.max(...orders) + 1) * LAYER_BAND;
  return (top + bottom) / 2;
}

function syncUnitNode(unit) {
  let node = laneUnitNodes.get(unit.uid);
  if (!node) {
    node = document.createElement('div');
    node.className = `lane-unit lane-unit--${unit.side}`;
    const glyph =
      unit.side === 'ally'
        ? `<img class="icon-glyph" src="${getBattleImage(unit.defId)}" alt="">`
        : `<span class="icon-glyph">${unit.icon}</span>`;
    node.innerHTML = `
      <div class="lane-unit-hp"><div class="lane-unit-hp-fill"></div></div>
      <div class="lane-unit-icon">${glyph}</div>
    `;
    document.getElementById('lane-units').appendChild(node);
    laneUnitNodes.set(unit.uid, node);
  }
  const laneLength = appState.battle ? getStage(appState.currentStageId).laneLength : 1;
  // 自城を画面右・敵城を画面左に表示するため、内部座標(x=0が自城)を左右反転して描画する
  const pct = 100 - (unit.x / laneLength) * 100;
  node.style.left = `${pct}%`;
  node.style.top = `${layerTopPercent(unit)}%`;
  node.classList.toggle('is-boss', !!unit.boss);
  node.classList.toggle('is-multilayer', !!(unit.layers && unit.layers.length > 1));
  if (unit.side === 'ally') {
    node.classList.toggle('is-form1', unit.form === 1);
    node.classList.toggle('is-form2', unit.form === 2);
  }
  const now = appState.battle ? appState.battle.getRenderState().time : 0;
  node.classList.toggle('is-attacking', now < unit.attackFlashUntil);
  node.classList.toggle('is-knockback', now < unit.knockbackUntil);
  node.classList.toggle('is-moving', !unit.engaged && now >= unit.attackFlashUntil);
  const fill = node.querySelector('.lane-unit-hp-fill');
  fill.style.width = `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%`;

  if (unit.attackFlashUntil > 0 && lastAttackFlash.get(unit.uid) !== unit.attackFlashUntil) {
    lastAttackFlash.set(unit.uid, unit.attackFlashUntil);
    if (unit.boss) {
      playBoomSfx();
    } else {
      playHitSfx();
    }
  }
}

function syncCastleWeapons(rs) {
  const castleEl = document.querySelector('.lane-castle--player');
  if (!castleEl) return;
  const now = rs.time;
  let firingNow = false;
  for (const weapon of rs.castleWeapons) {
    if (now < weapon.attackFlashUntil) firingNow = true;
    if (weapon.attackFlashUntil > 0 && lastCastleFlash.get(weapon.id) !== weapon.attackFlashUntil) {
      lastCastleFlash.set(weapon.id, weapon.attackFlashUntil);
      if (weapon.id === 'castle-longgun') {
        playBoomSfx();
      } else {
        playHitSfx();
      }
    }
  }
  castleEl.classList.toggle('is-firing', firingNow);
}

function renderBattleFrame() {
  const rs = appState.battle.getRenderState();

  document.getElementById('player-hp-fill').style.width = `${Math.max(0, (rs.playerHp / rs.playerMaxHp) * 100)}%`;
  document.getElementById('enemy-hp-fill').style.width = `${Math.max(0, (rs.enemyHp / rs.enemyMaxHp) * 100)}%`;
  document.getElementById('battle-timer').textContent = formatTime(rs.time);
  document.getElementById('coin-amount').textContent = rs.coin;

  const activeUids = new Set();
  for (const unit of [...rs.allies, ...rs.enemies]) {
    activeUids.add(unit.uid);
    syncUnitNode(unit);
  }
  for (const [uid, node] of laneUnitNodes) {
    if (!activeUids.has(uid)) {
      node.remove();
      laneUnitNodes.delete(uid);
      lastAttackFlash.delete(uid);
    }
  }

  syncCastleWeapons(rs);

  for (const info of rs.deployButtons) {
    if (info.layerLocked) continue;
    const btn = document.querySelector(`.deploy-btn[data-def-id="${info.defId}"]`);
    if (!btn) continue;
    const onCooldown = info.cooldownRemaining > 0;
    btn.disabled = onCooldown || !info.affordable;
    btn.classList.toggle('is-cooldown', onCooldown);
    const cdEl = btn.querySelector('[data-role="cd"]');
    cdEl.style.height = onCooldown ? `${info.cooldownRatio * 100}%` : '0%';
  }

  for (const weapon of rs.castleWeapons) {
    const btn = document.querySelector(`.deploy-btn--castle[data-weapon-id="${weapon.id}"]`);
    if (!btn) continue;
    btn.disabled = weapon.deployed || !weapon.affordable;
    btn.classList.toggle('is-deployed', weapon.deployed);
    const costEl = btn.querySelector('.deploy-cost');
    costEl.textContent = weapon.deployed ? '配備済' : weapon.cost;
  }

  if (rs.result && !appState._resultHandled) {
    appState._resultHandled = true;
    appState.loop.stop();
    stopMusic();
    handleBattleResult(rs.result, rs.stage, rs.difficulty);
  }
}

function handleBattleResult(result, stage, difficulty) {
  const overlay = document.getElementById('result-overlay');
  overlay.hidden = false;
  overlay.className = `battle-result-overlay is-${result}`;
  overlay.textContent = result === 'win' ? '勝利！' : '敗北…';
  playResultSfx(result === 'win');

  const diffSettings = getDifficultySettings(difficulty);
  const reward = Math.round(stage.clearReward * diffSettings.reward);

  let ticketGained = false;
  let weaponGained = null;
  if (result === 'win') {
    getClearedSet(difficulty).add(stage.id);
    appState.walletCoin += reward;
    if (stage.boss) {
      appState.gacha.tickets += 1;
      ticketGained = true;
    }
    if (stage.rewardWeaponId && !appState.unlockedWeapons.has(stage.rewardWeaponId)) {
      appState.unlockedWeapons.add(stage.rewardWeaponId);
      weaponGained = stage.rewardWeaponId;
    }
    renderWallet();
    persistCurrentProfile();
  }
  appState.lastResult = { stageId: stage.id, result, reward, ticketGained, weaponGained, difficulty };

  setTimeout(() => {
    appState._resultHandled = false;
    renderResult();
    showScreen('result');
  }, 1400);
}

// ---------- 対戦モード（同一端末でのプレイヤーvsプレイヤー） ----------

function loadRawProfileData(id) {
  const raw = safeGetItem(saveDataKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function updateVsSelectValidity() {
  const p1Select = document.getElementById('vs-select-p1');
  const p2Select = document.getElementById('vs-select-p2');
  const hint = document.getElementById('vs-select-hint');
  const startBtn = document.getElementById('btn-vs-start');
  const profiles = listProfiles();
  const sameSelection = p1Select.value && p1Select.value === p2Select.value;

  if (profiles.length < 2) {
    hint.hidden = false;
    hint.textContent = '対戦するには、セーブデータが2つ以上必要です。「セーブデータ選択」画面で新規作成するか、他端末から引き継いでください。';
    startBtn.disabled = true;
  } else if (sameSelection) {
    hint.hidden = false;
    hint.textContent = '同じセーブデータ同士では対戦できません。プレイヤー1とプレイヤー2で別のセーブデータを選んでください。';
    startBtn.disabled = true;
  } else if (appState.vsFormation.p1.length === 0 || appState.vsFormation.p2.length === 0) {
    hint.hidden = false;
    hint.textContent = '両プレイヤーとも、出撃スロットに1体以上キャラを選んでください。';
    startBtn.disabled = true;
  } else {
    hint.hidden = true;
    startBtn.disabled = false;
  }
}

// 対戦相手選択画面の出撃スロット編集（プロフィールの保存済み編成とは独立の一時的な選択）
function renderVsFormationSide(side) {
  const profileId = document.getElementById(side === 'p1' ? 'vs-select-p1' : 'vs-select-p2').value;
  const data = profileId ? loadRawProfileData(profileId) : null;
  const unlockedIds = data ? data.unlockedUnits || [] : [];
  const formation = appState.vsFormation[side];

  const slotCountEl = document.getElementById(side === 'p1' ? 'vs-p1-slot-count' : 'vs-p2-slot-count');
  if (slotCountEl) slotCountEl.textContent = `${formation.length}/${MAX_SLOTS}`;

  const slotsEl = document.getElementById(side === 'p1' ? 'vs-p1-slots' : 'vs-p2-slots');
  if (slotsEl) {
    if (formation.length === 0) {
      slotsEl.innerHTML = '<p class="vs-formation-empty">下の一覧からキャラを選んでください</p>';
    } else {
      slotsEl.innerHTML = formation
        .map((defId, i) => {
          const def = getUnitDef(defId);
          if (!def) return '';
          return `<button type="button" class="deploy-btn layer-${def.layer}" data-slot-index="${i}" title="${def.name}（タップで外す）">
            <span class="deploy-layer">${LAYER_INFO[def.layer].label}</span>
            <span class="deploy-icon"><img src="${getBattleImage(def.id)}" alt=""></span>
            <span class="deploy-cost">${def.cost}</span>
          </button>`;
        })
        .join('');
      slotsEl.querySelectorAll('[data-slot-index]').forEach((btn) => {
        btn.addEventListener('click', () => removeVsFormationSlot(side, Number(btn.dataset.slotIndex)));
      });
    }
  }

  const rosterEl = document.getElementById(side === 'p1' ? 'vs-p1-roster' : 'vs-p2-roster');
  if (rosterEl) {
    const units = UNIT_DEFS.filter((d) => unlockedIds.includes(d.id));
    rosterEl.innerHTML = units
      .map((def) => {
        const selected = formation.includes(def.id);
        return `<button type="button" class="deploy-btn layer-${def.layer}${selected ? ' is-selected' : ''}" data-def-id="${def.id}" title="${def.name}">
          <span class="deploy-layer">${LAYER_INFO[def.layer].label}</span>
          <span class="deploy-icon"><img src="${getBattleImage(def.id)}" alt=""></span>
          <span class="deploy-cost">${def.cost}</span>
        </button>`;
      })
      .join('');
    rosterEl.querySelectorAll('[data-def-id]').forEach((btn) => {
      btn.addEventListener('click', () => toggleVsFormationUnit(side, btn.dataset.defId));
    });
  }
}

function toggleVsFormationUnit(side, defId) {
  const list = appState.vsFormation[side];
  const idx = list.indexOf(defId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else if (list.length < MAX_SLOTS) {
    list.push(defId);
  } else {
    return;
  }
  renderVsFormationSide(side);
  updateVsSelectValidity();
}

function removeVsFormationSlot(side, index) {
  appState.vsFormation[side].splice(index, 1);
  renderVsFormationSide(side);
  updateVsSelectValidity();
}

function initVsFormationFromProfile(side) {
  const profileId = document.getElementById(side === 'p1' ? 'vs-select-p1' : 'vs-select-p2').value;
  const data = profileId ? loadRawProfileData(profileId) : null;
  appState.vsFormation[side] = data && Array.isArray(data.formation) ? [...data.formation] : [];
  renderVsFormationSide(side);
  updateVsSelectValidity();
}

function renderVsSelect() {
  const profiles = listProfiles().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const p1Select = document.getElementById('vs-select-p1');
  const p2Select = document.getElementById('vs-select-p2');

  const optionsHtml = profiles.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  const prevP1 = p1Select.value;
  const prevP2 = p2Select.value;
  p1Select.innerHTML = optionsHtml;
  p2Select.innerHTML = optionsHtml;
  if (profiles.some((p) => p.id === prevP1)) p1Select.value = prevP1;
  if (profiles.some((p) => p.id === prevP2)) p2Select.value = prevP2;
  if (!p1Select.value && profiles[0]) p1Select.value = profiles[0].id;
  if (!p2Select.value && profiles[1]) p2Select.value = profiles[1].id;

  p1Select.onchange = () => initVsFormationFromProfile('p1');
  p2Select.onchange = () => initVsFormationFromProfile('p2');

  initVsFormationFromProfile('p1');
  initVsFormationFromProfile('p2');
}

function buildPvpLaneRows() {
  const container = document.getElementById('vs-lane-rows');
  if (!container) return;
  container.innerHTML = '';
  for (const layerId of LAYER_IDS) {
    const info = LAYER_INFO[layerId];
    const row = document.createElement('div');
    row.className = `lane-row lane-row--${layerId}`;
    row.style.top = `${info.order * LAYER_BAND}%`;
    row.innerHTML = `<span class="lane-row-label">${info.label}</span>`;
    container.appendChild(row);
  }
}

function buildPvpDeployRow(side, formation, levels) {
  const row = document.getElementById(side === 'p1' ? 'vs-p1-deploy-row' : 'vs-p2-deploy-row');
  row.innerHTML = '';
  for (const defId of formation) {
    const def = getUnitDef(defId);
    if (!def) continue;
    const level = levels[defId] || 1;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `deploy-btn layer-${def.layer}`;
    btn.dataset.defId = defId;
    btn.dataset.pvpSide = side;
    btn.innerHTML = `
      <span class="deploy-cd" data-role="cd"></span>
      <span class="deploy-layer">${LAYER_INFO[def.layer].label}</span>
      <span class="deploy-icon">
        <img src="${getBattleImage(defId)}" alt="">
        ${getFormBadge(level) ? `<span class="deploy-form-badge">${getFormBadge(level)}</span>` : ''}
      </span>
      <span class="deploy-cost">${def.cost}</span>
    `;
    btn.addEventListener('click', () => {
      appState.pvpBattle.deploy(side, defId);
    });
    row.appendChild(btn);
  }
}

function startPvpBattle() {
  const p1Id = document.getElementById('vs-select-p1').value;
  const p2Id = document.getElementById('vs-select-p2').value;
  if (!p1Id || !p2Id || p1Id === p2Id) return;

  const profiles = listProfiles();
  const p1Profile = profiles.find((p) => p.id === p1Id);
  const p2Profile = profiles.find((p) => p.id === p2Id);
  const p1Data = loadRawProfileData(p1Id);
  const p2Data = loadRawProfileData(p2Id);
  if (!p1Profile || !p2Profile || !p1Data || !p2Data) return;

  // 出撃スロットは対戦相手選択画面で編集した内容（プロフィールの保存済み編成とは独立）を使う
  if (appState.vsFormation.p1.length === 0 || appState.vsFormation.p2.length === 0) return;
  const p1 = { name: p1Profile.name, formation: appState.vsFormation.p1, levels: p1Data.unitLevels || {} };
  const p2 = { name: p2Profile.name, formation: appState.vsFormation.p2, levels: p2Data.unitLevels || {} };

  appState.pvpBattle = createPvpBattle(p1, p2);
  appState.pvpSpeed = 1;
  document.getElementById('vs-btn-speed').textContent = 'x1';
  appState._pvpResultHandled = false;

  document.getElementById('vs-lane-units').innerHTML = '';
  pvpLaneUnitNodes.clear();
  pvpLastAttackFlash.clear();
  const overlay = document.getElementById('vs-result-overlay');
  overlay.hidden = true;

  document.getElementById('vs-p1-name').textContent = p1.name;
  document.getElementById('vs-p2-name').textContent = p2.name;

  buildPvpLaneRows();
  buildPvpDeployRow('p1', p1.formation, p1.levels);
  buildPvpDeployRow('p2', p2.formation, p2.levels);
  playBattleMusic(false);
  updateMuteButton();

  if (appState.pvpLoop) appState.pvpLoop.stop();
  appState.pvpLoop = createLoop({
    update: (dt) => appState.pvpBattle.update(dt),
    render: renderPvpBattleFrame,
  });
  appState.pvpLoop.start();

  showScreen('battle-vs');
}

function pvpLayerTopPercent(unit) {
  const band = LAYER_INFO[unit.layer].order * LAYER_BAND;
  return band + (unit.owner === 'p1' ? LAYER_BAND * 0.68 : LAYER_BAND * 0.3);
}

function syncPvpUnitNode(unit, laneLength) {
  let node = pvpLaneUnitNodes.get(unit.uid);
  if (!node) {
    node = document.createElement('div');
    node.className = `lane-unit lane-unit--${unit.owner === 'p1' ? 'ally' : 'enemy'}`;
    node.innerHTML = `
      <div class="lane-unit-hp"><div class="lane-unit-hp-fill"></div></div>
      <div class="lane-unit-icon"><img class="icon-glyph" src="${getBattleImage(unit.defId)}" alt=""></div>
    `;
    document.getElementById('vs-lane-units').appendChild(node);
    pvpLaneUnitNodes.set(unit.uid, node);
  }
  // プレイヤー1が画面左・プレイヤー2が画面右になるよう、反転せずそのままの座標で描画する
  const pct = (unit.x / laneLength) * 100;
  node.style.left = `${pct}%`;
  node.style.top = `${pvpLayerTopPercent(unit)}%`;
  node.classList.toggle('is-form1', unit.form === 1);
  node.classList.toggle('is-form2', unit.form === 2);
  const now = appState.pvpBattle ? appState.pvpBattle.getRenderState().time : 0;
  node.classList.toggle('is-attacking', now < unit.attackFlashUntil);
  node.classList.toggle('is-knockback', now < unit.knockbackUntil);
  node.classList.toggle('is-moving', !unit.engaged && now >= unit.attackFlashUntil);
  const fill = node.querySelector('.lane-unit-hp-fill');
  fill.style.width = `${Math.max(0, (unit.hp / unit.maxHp) * 100)}%`;

  if (unit.attackFlashUntil > 0 && pvpLastAttackFlash.get(unit.uid) !== unit.attackFlashUntil) {
    pvpLastAttackFlash.set(unit.uid, unit.attackFlashUntil);
    playHitSfx();
  }
}

function updatePvpDeployButtons(side, deployButtons) {
  for (const info of deployButtons) {
    const btn = document.querySelector(`.deploy-btn[data-pvp-side="${side}"][data-def-id="${info.defId}"]`);
    if (!btn) continue;
    const onCooldown = info.cooldownRemaining > 0;
    btn.disabled = onCooldown || !info.affordable;
    btn.classList.toggle('is-cooldown', onCooldown);
    const cdEl = btn.querySelector('[data-role="cd"]');
    cdEl.style.height = onCooldown ? `${info.cooldownRatio * 100}%` : '0%';
  }
}

function renderPvpBattleFrame() {
  const rs = appState.pvpBattle.getRenderState();

  document.getElementById('vs-p1-hp-fill').style.width = `${Math.max(0, (rs.p1.hp / rs.p1.maxHp) * 100)}%`;
  document.getElementById('vs-p2-hp-fill').style.width = `${Math.max(0, (rs.p2.hp / rs.p2.maxHp) * 100)}%`;
  document.getElementById('vs-battle-timer').textContent = formatTime(rs.time);
  document.getElementById('vs-p1-coin').textContent = rs.p1.coin;
  document.getElementById('vs-p2-coin').textContent = rs.p2.coin;

  const activeUids = new Set();
  for (const unit of [...rs.p1.units, ...rs.p2.units]) {
    activeUids.add(unit.uid);
    syncPvpUnitNode(unit, rs.laneLength);
  }
  for (const [uid, node] of pvpLaneUnitNodes) {
    if (!activeUids.has(uid)) {
      node.remove();
      pvpLaneUnitNodes.delete(uid);
      pvpLastAttackFlash.delete(uid);
    }
  }

  updatePvpDeployButtons('p1', rs.p1.deployButtons);
  updatePvpDeployButtons('p2', rs.p2.deployButtons);

  if (rs.result && !appState._pvpResultHandled) {
    appState._pvpResultHandled = true;
    appState.pvpLoop.stop();
    stopMusic();
    handlePvpBattleResult(rs.result, rs.p1.name, rs.p2.name);
  }
}

function handlePvpBattleResult(result, p1Name, p2Name) {
  const overlay = document.getElementById('vs-result-overlay');
  const title = document.getElementById('vs-result-title');
  const winnerName = result === 'p1' ? p1Name : p2Name;
  title.textContent = `${winnerName} の勝利！`;
  overlay.hidden = false;
  playResultSfx(true);
}

// ---------- リザルト ----------

// エクストラステージは章の連番とは別枠の解放条件を持つため「次のステージ」を持たない
function getNextMainStage(stage) {
  if (stage.extra) return null;
  return STAGES.find((s) => s.order === stage.order + 1 && !s.extra) || null;
}

function renderResult() {
  const { result, stageId, reward, ticketGained, weaponGained, difficulty } = appState.lastResult;
  const stage = getStage(stageId);
  const diffInfo = DIFFICULTY_LEVELS.find((d) => d.id === difficulty);
  const title = document.getElementById('result-title');
  const message = document.getElementById('result-message');
  const rewardEl = document.getElementById('result-reward');
  const unlockEl = document.getElementById('result-unlock');

  title.textContent = result === 'win' ? '勝利！' : '敗北…';
  title.className = result === 'win' ? 'is-win' : 'is-lose';
  message.textContent =
    result === 'win'
      ? `「${stage.name}」（${diffInfo ? diffInfo.label : ''}）を突破した！`
      : `「${stage.name}」（${diffInfo ? diffInfo.label : ''}）で自城が陥落した。編成を見直して再挑戦しよう。`;
  rewardEl.textContent = result === 'win' ? `獲得わんコイン +${reward}` : '';

  const unlockMessages = [];
  if (ticketGained) {
    unlockMessages.push('ボス撃破報酬：わんこチケット +1（ホーム画面からガチャを引こう）');
  }
  if (weaponGained) {
    const w = CASTLE_WEAPONS.find((c) => c.id === weaponGained);
    unlockMessages.push(`エクストラステージ制覇！自城の新装備「${w.icon} ${w.name}」を獲得（編成画面の自城の装備欄で確認）`);
  }
  if (unlockMessages.length > 0) {
    unlockEl.hidden = false;
    unlockEl.innerHTML = unlockMessages.join('<br>');
  } else {
    unlockEl.hidden = true;
  }

  const nextBtn = document.getElementById('btn-next-stage');
  const nextStage = result === 'win' ? getNextMainStage(stage) : null;
  if (nextStage) {
    nextBtn.hidden = false;
    nextBtn.dataset.stageId = nextStage.id;
  } else {
    nextBtn.hidden = true;
    delete nextBtn.dataset.stageId;
  }
}

// ---------- ミュート ----------

function updateMuteButton() {
  const btn = document.getElementById('btn-mute');
  if (!btn) return;
  btn.textContent = isMuted() ? '🔇' : '🔊';
}

// ---------- イベント委譲 ----------

app.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'go-title') {
    if (appState.loop) appState.loop.stop();
    stopMusic();
    showScreen('title');
    playTitleMusic();
  } else if (action === 'go-profile') {
    if (appState.loop) appState.loop.stop();
    renderProfileList();
    showScreen('profile');
    playTitleMusic();
  } else if (action === 'continue-profile') {
    const id = target.dataset.profileId;
    if (!id) return;
    loadProfile(id);
    renderHome();
    showScreen('home');
    playPrepMusic();
  } else if (action === 'rename-profile') {
    const id = target.dataset.profileId;
    if (!id) return;
    const profile = listProfiles().find((p) => p.id === id);
    if (!profile) return;
    const nextName = prompt('あたらしい名前を入力してください', profile.name);
    if (nextName === null) return;
    const trimmed = nextName.trim().slice(0, 12);
    if (!trimmed) return;
    renameProfile(id, trimmed);
    renderProfileList();
  } else if (action === 'delete-profile') {
    const id = target.dataset.profileId;
    if (!id) return;
    const profile = listProfiles().find((p) => p.id === id);
    const label = profile ? profile.name : 'このセーブデータ';
    if (!confirm(`「${label}」のセーブデータを削除します。この操作は取り消せません。よろしいですか？`)) return;
    deleteProfile(id);
    renderProfileList();
  } else if (action === 'export-profile') {
    const id = target.dataset.profileId;
    if (!id) return;
    const code = exportProfile(id);
    if (!code) {
      alert('エクスポートに失敗しました。');
      return;
    }
    showExportResult(code);
  } else if (action === 'copy-export-code') {
    const textEl = document.getElementById('export-result-text');
    textEl.select();
    navigator.clipboard?.writeText(textEl.value).catch(() => {
      document.execCommand('copy');
    });
  } else if (action === 'download-export-code') {
    const textEl = document.getElementById('export-result-text');
    const blob = new Blob([textEl.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wanko-daisensou-save.txt';
    a.click();
    URL.revokeObjectURL(url);
  } else if (action === 'close-export-result') {
    document.getElementById('export-result-panel').hidden = true;
  } else if (action === 'close-character-detail') {
    showScreen(appState.detailReturnScreen);
  } else if (action === 'go-roster-status') {
    renderRosterStatus();
    showScreen('roster-status');
  } else if (action === 'go-home') {
    if (appState.loop) appState.loop.stop();
    if (appState.pvpLoop) appState.pvpLoop.stop();
    renderHome();
    showScreen('home');
    playPrepMusic();
  } else if (action === 'go-vs-select') {
    if (appState.loop) appState.loop.stop();
    if (appState.pvpLoop) appState.pvpLoop.stop();
    renderVsSelect();
    showScreen('vs-select');
    playPrepMusic();
  } else if (action === 'start-pvp-battle') {
    if (target.disabled) return;
    startPvpBattle();
  } else if (action === 'retry-pvp-battle') {
    startPvpBattle();
  } else if (action === 'toggle-vs-speed') {
    const idx = SPEED_STEPS.indexOf(appState.pvpSpeed);
    appState.pvpSpeed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    appState.pvpLoop.setSpeed(appState.pvpSpeed);
    target.textContent = `x${appState.pvpSpeed}`;
  } else if (action === 'go-gacha') {
    appState.gachaMode = 'normal';
    renderGacha();
    showScreen('gacha');
  } else if (action === 'go-halloween-gacha') {
    appState.gachaMode = 'halloween';
    renderGacha();
    showScreen('gacha');
  } else if (action === 'switch-formation-pattern') {
    switchFormationPattern(Number(target.dataset.patternIndex));
  } else if (action === 'set-gacha-mode') {
    appState.gachaMode = target.dataset.gachaMode;
    renderGacha();
  } else if (action === 'gacha-pull') {
    startGachaPull();
  } else if (action === 'select-difficulty') {
    appState.selectedDifficulty = target.dataset.difficulty;
    appState.expandedChapters = null;
    renderHome();
    persistCurrentProfile();
  } else if (action === 'go-battle') {
    if (appState.formation.length === 0) return;
    startBattle(appState.currentStageId);
  } else if (action === 'retry-battle') {
    startBattle(appState.lastResult.stageId, appState.lastResult.difficulty);
  } else if (action === 'next-stage') {
    const nextStageId = target.dataset.stageId;
    if (!nextStageId) return;
    appState.currentStageId = nextStageId;
    renderFormation();
    showScreen('formation');
    playPrepMusic();
  } else if (action === 'toggle-speed') {
    const idx = SPEED_STEPS.indexOf(appState.speed);
    appState.speed = SPEED_STEPS[(idx + 1) % SPEED_STEPS.length];
    appState.loop.setSpeed(appState.speed);
    target.textContent = `x${appState.speed}`;
  } else if (action === 'toggle-mute') {
    toggleMuted();
    updateMuteButton();
  } else if (action === 'give-up-battle') {
    if (!confirm('この戦闘をあきらめて編成画面に戻ります。よろしいですか？')) return;
    if (appState.loop) appState.loop.stop();
    stopMusic();
    appState.battle = null;
    renderFormation();
    showScreen('formation');
    playPrepMusic();
  } else if (action === 'give-up-pvp-battle') {
    if (!confirm('この対戦をあきらめて対戦相手選択に戻ります。よろしいですか？')) return;
    if (appState.pvpLoop) appState.pvpLoop.stop();
    stopMusic();
    appState.pvpBattle = null;
    renderVsSelect();
    showScreen('vs-select');
    playPrepMusic();
  }
});

document.getElementById('profile-new-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('profile-new-name');
  const name = input.value.trim();
  if (!name) return;
  const id = createProfile(name);
  input.value = '';
  loadProfile(id);
  renderHome();
  showScreen('home');
  playPrepMusic();
});

document.getElementById('import-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('import-code-input').value = String(reader.result || '').trim();
  };
  reader.readAsText(file);
});

document.getElementById('import-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('import-code-input');
  const code = input.value.trim();
  if (!code) return;
  importSaveCode(code);
  input.value = '';
  document.getElementById('import-file-input').value = '';
});

document.getElementById('roster-filter-layer').addEventListener('change', (e) => {
  appState.rosterStatusFilter.layer = e.target.value;
  renderRosterStatus();
});
document.getElementById('roster-filter-rarity').addEventListener('change', (e) => {
  appState.rosterStatusFilter.rarity = e.target.value;
  renderRosterStatus();
});
document.getElementById('roster-sort').addEventListener('change', (e) => {
  appState.rosterStatusFilter.sort = e.target.value;
  renderRosterStatus();
});

// タブを閉じる・リロードする・裏に回すタイミングでも取りこぼしなく保存する
window.addEventListener('beforeunload', persistCurrentProfile);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistCurrentProfile();
});

updateMuteButton();
showScreen('title');
