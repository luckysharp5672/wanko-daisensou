// 対戦モード（プレイヤーvsプレイヤー、同一デバイスでのローカル対戦）の固定バランス値。
// ステージに依存しないため、difficulty.jsのような固定値をここに切り出す。

export const PVP_SETTINGS = {
  laneLength: 1400,
  castleHp: 3000,
  initialCoin: 300,
  maxCoin: 999,
  coinRegen: 14,
};
