// 戦闘レイヤー定義（上空・中空・地面・海面の4層）
// 表示順は画面の上から下（sky→mid→ground→sea）

export const LAYER_IDS = ['sky', 'mid', 'ground', 'sea'];

export const LAYER_INFO = {
  sky: { id: 'sky', label: '上空', order: 0 },
  mid: { id: 'mid', label: '中空', order: 1 },
  ground: { id: 'ground', label: '地面', order: 2 },
  sea: { id: 'sea', label: '海面', order: 3 },
};
