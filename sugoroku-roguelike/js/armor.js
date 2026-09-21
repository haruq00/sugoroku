// ============================================================
// armor.js
// 防具データ。最大2個装備（同じ防具の重複装備は禁止）。
// 主に生存力（HP・防御・回避・回復）を担当する。
// ============================================================

const ARMOR_LIST = [
  { id: "ar_leather", name: "革鎧", type: "ARMOR", classType: "COMMON", rarity: "normal",
    maxHp: 15, description: "最大HP+15。", effects: [] },
  { id: "ar_iron", name: "鉄鎧", type: "ARMOR", classType: "COMMON", rarity: "normal",
    defense: 5, description: "防御+5。", effects: [] },
  { id: "ar_steel", name: "鋼鎧", type: "ARMOR", classType: "COMMON", rarity: "rare",
    defense: 8, evasion: -0.02, description: "防御+8。回避率-2%。", effects: [] },
  { id: "ar_life", name: "生命の鎧", type: "ARMOR", classType: "COMMON", rarity: "rare",
    maxHp: 30, description: "最大HP+30。", effects: [] },
  { id: "ar_guardian", name: "守護鎧", type: "ARMOR", classType: "COMMON", rarity: "rare",
    maxHp: 15, defense: 5, description: "最大HP+15。防御+5。", effects: [] },
  { id: "ar_light", name: "軽装鎧", type: "ARMOR", classType: "COMMON", rarity: "normal",
    defense: 3, evasion: 0.05, description: "防御+3。回避率+5%。", effects: [] },
  { id: "ar_regen", name: "再生衣", type: "ARMOR", classType: "COMMON", rarity: "epic",
    description: "戦闘終了時、最大HPの5%回復。", effects: [{ effectId: "BATTLE_END_HEAL_PERCENT", value: 0.05 }] },
  { id: "ar_vampiric", name: "吸血衣", type: "ARMOR", classType: "COMMON", rarity: "rare",
    description: "敵撃破時、最大HPの2%回復。", effects: [{ effectId: "LIFESTEAL_ON_KILL_PERCENT", value: 0.02 }] },
  { id: "ar_berserker", name: "狂戦士鎧", type: "ARMOR", classType: "COMMON", rarity: "epic",
    maxHp: 20, description: "最大HP+20。HP50%以下の間、全ダメージ+15%。",
    effects: [{ effectId: "LOW_HP_DAMAGE_RATE", value: { threshold: 0.5, rate: 0.15 } }] },
  { id: "ar_mage_robe", name: "魔導衣", type: "ARMOR", classType: "COMMON", rarity: "rare",
    maxHp: 15, magicAttack: 10, description: "最大HP+15。魔法攻撃+10。", effects: [] },
  { id: "ar_warrior", name: "戦士鎧", type: "ARMOR", classType: "COMMON", rarity: "rare",
    maxHp: 20, physicalAttack: 10, description: "最大HP+20。物理攻撃+10。", effects: [] },
  { id: "ar_golden", name: "黄金鎧", type: "ARMOR", classType: "COMMON", rarity: "rare",
    defense: 4, description: "防御+4。Gold獲得+15%。", effects: [{ effectId: "GOLD_GAIN_RATE", value: 0.15 }] },
  { id: "ar_strong_slayer", name: "強者の鎧", type: "ARMOR", classType: "COMMON", rarity: "epic",
    defense: 5, description: "防御+5。Strongからの被ダメージ-15%。",
    effects: [{ effectId: "STRONG_DAMAGE_TAKEN_RATE", value: -0.15 }] },
  { id: "ar_phoenix", name: "不死鳥の衣", type: "ARMOR", classType: "COMMON", rarity: "legendary",
    description: "1GAMEに1回、HP0になる攻撃をHP1で耐える。",
    effects: [{ effectId: "DEATH_PREVENTION_ONCE_PER_GAME", value: true }] },
  { id: "ar_giant", name: "巨人の鎧", type: "ARMOR", classType: "COMMON", rarity: "epic",
    maxHp: 50, evasion: -0.05, description: "最大HP+50。回避率-5%。", effects: [] },
  { id: "ar_traveler_clothes", name: "旅人の服", type: "ARMOR", classType: "COMMON", rarity: "rare",
    maxHp: 20, description: "最大HP+20。GOAL通過時、最大HPの3%回復。",
    effects: [{ effectId: "GOAL_HEAL_PERCENT", value: 0.03 }] },
];
