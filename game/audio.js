// Web Audio API による簡易チップチューン風BGM（外部音源ファイル不使用）
// シーンごとに別テーマを鳴らす：
//   title = わんこ王国讃歌（のどかで壮大なマーチ調）
//   prep  = 訓練所のリズム（出撃準備画面。軽快なマーチ＋打楽器）
//   normal= 陽気な戦線（通常戦闘。シンコペーションの効いた明るくコミカルな戦闘曲）
//   boss  = 英雄の咆哮（ボス戦。金管楽器風の力強い旋律で盛り上がるクライマックス感重視）

const THEMES = {
  title: {
    stepMs: 330, // ♩=90前後を想定した、のどかなテンポ
    melody: { wave: 'triangle', notes: [392.0, 493.88, 587.33, 493.88, 440.0, 523.25, 659.25, 523.25], gain: 0.055 },
    bass: { wave: 'sine', notes: [196.0, 196.0, 246.94, 246.94, 220.0, 220.0, 164.81, 164.81], gain: 0.05 },
  },
  prep: {
    stepMs: 230, // 軽快なマーチ（テンポ130前後）
    perc: true,
    melody: { wave: 'square', notes: [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 392.0], gain: 0.048 },
    bass: { wave: 'triangle', notes: [130.81, 130.81, 164.81, 164.81, 146.83, 146.83, 196.0, 196.0], gain: 0.045 },
  },
  normal: {
    // 陽気な戦線：スウィング（長・短）のシンコペーションで弾むコミカルな戦闘曲
    melody: { wave: 'square', gain: 0.048 },
    bass: { wave: 'triangle', gain: 0.045 },
    steps: [
      { ms: 300, melodyFreq: 523.25, bassFreq: 130.81 }, // C5 / C3
      { ms: 150, melodyFreq: 659.25, bassFreq: 196.0 }, // E5 / G3
      { ms: 300, melodyFreq: 783.99, bassFreq: 130.81 }, // G5 / C3
      { ms: 150, melodyFreq: 659.25, bassFreq: 196.0 }, // E5 / G3
      { ms: 300, melodyFreq: 587.33, bassFreq: 146.83 }, // D5 / D3
      { ms: 150, melodyFreq: 698.46, bassFreq: 220.0 }, // F5 / A3
      { ms: 300, melodyFreq: 880.0, bassFreq: 146.83 }, // A5 / D3
      { ms: 150, melodyFreq: 698.46, bassFreq: 220.0 }, // F5 / A3
    ],
  },
  boss: {
    stepMs: 210, // 英雄の咆哮：金管風の力強いファンファーレ、駆け上がって盛り上がる
    melody: {
      wave: 'sawtooth',
      notes: [392.0, 523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25],
      gain: 0.05,
    },
    bass: { wave: 'square', notes: [130.81, 130.81, 164.81, 164.81, 196.0, 196.0, 130.81, 130.81], gain: 0.055 },
  },
};

// シーンBGMの本番音源（mp3）。用意されていればこちらをループ再生し、
// 読み込みに失敗した場合のみ内蔵のチップチューン版（THEMES）にフォールバックする
const THEME_FILES = {
  title: 'assets/audio/title.mp3',
  prep: 'assets/audio/prep.mp3',
  normal: 'assets/audio/battle.mp3',
  boss: 'assets/audio/boss.mp3',
};

let audioCtx = null;
let masterGain = null;
let loopTimer = null;
let activeThemeName = null;
let muted = false;
let currentFileSource = null;
const audioBufferCache = new Map(); // url -> Promise<AudioBuffer>

function ensureContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function scheduleNote(track, freq, startTime, stepSec) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = track.wave;
  osc.frequency.value = freq;
  const attack = 0.01;
  const release = stepSec * 0.3;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(track.gain, startTime + attack);
  gain.gain.setValueAtTime(track.gain, startTime + stepSec - release);
  gain.gain.linearRampToValueAtTime(0, startTime + stepSec);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + stepSec);
}

// 「タッ」: 出撃準備テーマ用の軽い打楽器音（accented=trueで強拍のアクセントをつける）
function schedulePercTick(startTime, accented) {
  const noise = audioCtx.createBufferSource();
  noise.buffer = createNoiseBuffer(0.045);
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = accented ? 3200 : 5200;
  const gain = audioCtx.createGain();
  const peak = accented ? 0.07 : 0.035;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0008, startTime + 0.05);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  noise.start(startTime);
}

// テーマは「全ステップ同じ長さ」の簡易形式（stepMs + melody/bass.notes[]）か、
// ステップごとにms・音程を個別指定できる詳細形式（steps[]、ボス戦のテンポ変化用）のどちらかを取る
function resolveSteps(theme) {
  if (theme.steps) return theme.steps;
  return theme.melody.notes.map((freq, i) => ({
    ms: theme.stepMs,
    melodyFreq: freq,
    bassFreq: theme.bass.notes[i],
  }));
}

function scheduleLoop(themeName) {
  const theme = THEMES[themeName];
  const steps = resolveSteps(theme);
  let t = audioCtx.currentTime + 0.05;
  let totalMs = 0;
  steps.forEach((step, i) => {
    const stepSec = step.ms / 1000;
    scheduleNote(theme.melody, step.melodyFreq, t, stepSec);
    scheduleNote(theme.bass, step.bassFreq, t, stepSec);
    if (theme.perc) schedulePercTick(t, i % 2 === 0);
    t += stepSec;
    totalMs += step.ms;
  });
  loopTimer = setTimeout(() => {
    if (activeThemeName === themeName) scheduleLoop(themeName);
  }, totalMs);
}

function loadAudioBuffer(url) {
  if (!audioBufferCache.has(url)) {
    audioBufferCache.set(
      url,
      fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error(`音源ファイルの取得に失敗: ${url}`);
          return res.arrayBuffer();
        })
        .then((buf) => audioCtx.decodeAudioData(buf))
    );
  }
  return audioBufferCache.get(url);
}

function stopFileSource() {
  if (currentFileSource) {
    try {
      currentFileSource.stop();
    } catch {
      /* すでに停止済みなら何もしない */
    }
    currentFileSource = null;
  }
}

function playThemeFromFile(themeName, url) {
  loadAudioBuffer(url)
    .then((buffer) => {
      if (activeThemeName !== themeName) return; // 読み込み中に別テーマへ切り替わっていたら破棄
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(masterGain);
      source.start();
      currentFileSource = source;
    })
    .catch(() => {
      // mp3が未配置/破損の場合は、内蔵のチップチューン版で代用する
      if (activeThemeName === themeName) scheduleLoop(themeName);
    });
}

function playTheme(themeName) {
  ensureContext();
  if (activeThemeName === themeName) return;
  stopMusic();
  activeThemeName = themeName;
  const fileUrl = THEME_FILES[themeName];
  if (fileUrl) {
    playThemeFromFile(themeName, fileUrl);
  } else {
    scheduleLoop(themeName);
  }
}

export function playTitleMusic() {
  playTheme('title');
}

export function playPrepMusic() {
  playTheme('prep');
}

export function playBattleMusic(isBoss) {
  playTheme(isBoss ? 'boss' : 'normal');
}

export function stopMusic() {
  activeThemeName = null;
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
  stopFileSource();
}

// ---------- 効果音 ----------

function createNoiseBuffer(durationSec) {
  const length = Math.max(1, Math.round(audioCtx.sampleRate * durationSec));
  const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function scheduleTone(freq, startTime, duration, wave, peakGain) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

let lastHitSfxTime = -1;
const HIT_SFX_MIN_GAP = 0.05; // 短時間の連打で音が重なりすぎないよう間引く

// 「ビシッ、バシッ」: 通常攻撃の軽快なヒット音
export function playHitSfx() {
  ensureContext();
  const t = audioCtx.currentTime;
  if (t - lastHitSfxTime < HIT_SFX_MIN_GAP) return;
  lastHitSfxTime = t;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  const startFreq = 850 + Math.random() * 300;
  osc.frequency.setValueAtTime(startFreq, t);
  osc.frequency.exponentialRampToValueAtTime(160, t + 0.07);
  gain.gain.setValueAtTime(0.09, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + 0.09);
}

// 「ドカーン」: ボス級の重い一撃音
export function playBoomSfx() {
  ensureContext();
  const t = audioCtx.currentTime;

  const thump = audioCtx.createOscillator();
  const thumpGain = audioCtx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(160, t);
  thump.frequency.exponentialRampToValueAtTime(35, t + 0.35);
  thumpGain.gain.setValueAtTime(0.3, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  thump.connect(thumpGain);
  thumpGain.connect(masterGain);
  thump.start(t);
  thump.stop(t + 0.42);

  const noise = audioCtx.createBufferSource();
  noise.buffer = createNoiseBuffer(0.25);
  const noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.setValueAtTime(900, t);
  const noiseGain = audioCtx.createGain();
  noiseGain.gain.setValueAtTime(0.22, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);
  noise.start(t);
}

// 勝利/敗北ジングル
// 勝利＝「凱旋ファンファーレ」：主旋律に下支えのハーモニーを重ね、最後を伸ばして達成感を出す
// 敗北＝「再挑戦の予感」：暗くなりすぎない短調フレーズ。最後だけ音を上げて前向きな余韻を残す
export function playResultSfx(win) {
  ensureContext();
  const t = audioCtx.currentTime;
  if (win) {
    const melody = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const timing = [0, 0.1, 0.2, 0.32, 0.46, 0.56];
    const durations = [0.16, 0.16, 0.16, 0.22, 0.16, 0.55];
    melody.forEach((freq, i) => scheduleTone(freq, t + timing[i], durations[i], 'triangle', 0.13));
    const harmony = [261.63, 329.63, 392.0, 523.25];
    const hTiming = [0, 0.1, 0.2, 0.32];
    harmony.forEach((freq, i) => scheduleTone(freq, t + hTiming[i], 0.75 - hTiming[i], 'square', 0.05));
  } else {
    const melody = [392.0, 349.23, 293.66, 246.94, 293.66];
    const timing = [0, 0.16, 0.32, 0.48, 0.66];
    const durations = [0.18, 0.18, 0.18, 0.2, 0.4];
    melody.forEach((freq, i) => scheduleTone(freq, t + timing[i], durations[i], 'triangle', 0.1));
    scheduleTone(196.0, t, 0.85, 'sine', 0.05);
  }
}

export function setMuted(value) {
  muted = value;
  if (masterGain) masterGain.gain.value = muted ? 0 : 1;
}

export function isMuted() {
  return muted;
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}
