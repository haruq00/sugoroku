// ============================================================
// classes.js
// プレイヤーが選べる職業のデータをまとめたファイルです。
// 新しい職業（例：ARCHER、SUMMONER）を追加したい場合は、
// CLASSESオブジェクトに1エントリ追加するだけで、
// キャラクター選択画面・専用カードプール・初期ステータス・
// 職業固有スキルのすべてに反映されます
// （game.js側で「if class === swordsman」のような分岐を
// 増やさなくて済む設計にしています）。
// ============================================================

const CLASSES = {
  SWORDSMAN: {
    id: "SWORDSMAN",
    name: "剣士",
    nameEn: "SWORDSMAN",
    description: "一撃・多段・Critical・Strong狩り・背水・闘気を得意とする近接職",
    image: "assets/characters/swordsman.png", // 画像が無ければCSS仮表示にフォールバックする
    initialStats: {
      physicalAttack: 30,
      magicAttack: 5,
      defense: 14,
      evasion: 0.05,
      maxHp: 120,
    },
    // ラン開始時に持っている戦闘デッキ（idはbattleCards.js参照）
    startingBattleDeck: ["sw_slash", "sw_slash", "sw_double_slash", "b_slash_basic", "b_guard", "b_first_aid"],
    // 職業固有スキル：闘気（敵撃破で貯まり、物理ダメージを底上げする。戦闘終了時リセット）
    skillId: "momentum",
    cardPoolClassType: "SWORDSMAN",
  },
  MAGE: {
    id: "MAGE",
    name: "魔法使い",
    nameEn: "MAGE",
    description: "AoE・多段・連鎖・敵数活用・Rare/Gold重視の遠隔職",
    image: "assets/characters/mage.png",
    initialStats: {
      physicalAttack: 8,
      magicAttack: 32,
      defense: 7,
      evasion: 0.10,
      maxHp: 85,
    },
    startingBattleDeck: ["mg_fireball", "mg_fireball", "mg_magic_barrage", "b_slash_basic", "b_guard", "b_first_aid"],
    // 職業固有スキル：魔力共鳴（戦闘中の敵数に応じて魔法ダメージを底上げする）
    skillId: "resonance",
    cardPoolClassType: "MAGE",
  },
};

const ClassSystem = {
  getAll() {
    return Object.values(CLASSES);
  },
  get(classId) {
    return CLASSES[classId] || null;
  },
};
