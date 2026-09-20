// 難易度定義（ホーム画面のステージ選択時に選ぶ。難易度ごとに独立してステージ開放が進む）
// 自城HP・出撃コスト等プレイヤー側の数値は変えず、敵の強さと報酬だけを増減させる

export const DIFFICULTY_LEVELS = [
  { id: 'normal', label: 'ふつう' },
  { id: 'hard', label: 'むずかしい' },
  { id: 'extreme', label: 'ゲキむず' },
];

export const DIFFICULTY_SETTINGS = {
  normal: { enemyStat: 1.0, enemyCastleHp: 1.0, reward: 1.0 },
  hard: { enemyStat: 1.35, enemyCastleHp: 1.15, reward: 1.5 },
  extreme: { enemyStat: 1.8, enemyCastleHp: 1.3, reward: 2.2 },
};

export function getDifficultySettings(difficultyId) {
  return DIFFICULTY_SETTINGS[difficultyId] || DIFFICULTY_SETTINGS.normal;
}
