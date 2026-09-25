// 戦闘レイヤー定義（そら・じめん・うみの3層）
// 表示順は画面の上から下（sky→ground→sea）

export const LAYER_IDS = ['sky', 'ground', 'sea'];

export const LAYER_INFO = {
  sky: { id: 'sky', label: 'そら', order: 0 },
  ground: { id: 'ground', label: 'じめん', order: 1 },
  sea: { id: 'sea', label: 'うみ', order: 2 },
};
