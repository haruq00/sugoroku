// ============================================================
// charms.js
// お守りデータ。最大3個装備。ビルド補助の自由枠で、戦闘だけでなく
// すごろくとの橋渡し効果も持たせている（旅人のお守り・疾走のお守り等）。
// ============================================================

const CHARM_LIST = [
  // ---- 戦闘系 ----
  { id: "ch_power", name: "力のお守り", type: "CHARM", classType: "COMMON", rarity: "normal",
    description: "物理攻撃+10%。", effects: [{ effectId: "PHYSICAL_ATTACK_RATE", value: 0.10 }] },
  { id: "ch_magic", name: "魔力のお守り", type: "CHARM", classType: "COMMON", rarity: "normal",
    description: "魔法攻撃+10%。", effects: [{ effectId: "MAGIC_ATTACK_RATE", value: 0.10 }] },
  { id: "ch_crit", name: "会心のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "Critical率+8%。", effects: [{ effectId: "CRIT_RATE_ADD", value: 0.08 }] },
  { id: "ch_crit_dmg", name: "致命のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "Criticalダメージ+30%。", effects: [{ effectId: "CRIT_DAMAGE_ADD", value: 0.30 }] },
  { id: "ch_strong", name: "強者のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "Strongへのダメージ+25%。", effects: [{ effectId: "STRONG_DAMAGE_RATE", value: 0.25 }] },
  { id: "ch_swarm", name: "群れのお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "敵1体につき全ダメージ+5%。", effects: [{ effectId: "PER_ENEMY_DAMAGE_RATE", value: 0.05 }] },
  { id: "ch_desperate", name: "背水のお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "HP50%以下の間、全ダメージ+20%。", effects: [{ effectId: "LOW_HP_DAMAGE_RATE", value: { threshold: 0.5, rate: 0.20 } }] },
  { id: "ch_vampiric", name: "吸血のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "敵撃破時、HPの3%回復。", effects: [{ effectId: "LIFESTEAL_ON_KILL_PERCENT", value: 0.03 }] },

  // ---- カード系 ----
  { id: "ch_wisdom", name: "知恵のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "戦闘開始時、手札+1。", effects: [{ effectId: "BATTLE_START_DRAW", value: 1 }] },
  { id: "ch_haste", name: "速攻のお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "1ターン目のACTION+1。", effects: [{ effectId: "FIRST_TURN_ACTION_ADD", value: 1 }] },
  { id: "ch_combo", name: "連撃のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "多段カードダメージ+15%。", effects: [{ effectId: "MULTI_HIT_DAMAGE_RATE", value: 0.15 }] },
  { id: "ch_heavy", name: "重撃のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "1ヒットカードダメージ+20%。", effects: [{ effectId: "SINGLE_HIT_CARD_RATE", value: 0.20 }] },
  { id: "ch_guard", name: "防御のお守り", type: "CHARM", classType: "COMMON", rarity: "normal",
    description: "防御カード効果+25%。", effects: [{ effectId: "DEFENSE_CARD_RATE", value: 0.25 }] },
  { id: "ch_healing", name: "治癒のお守り", type: "CHARM", classType: "COMMON", rarity: "normal",
    description: "回復効果+25%。", effects: [{ effectId: "HEAL_POWER_RATE", value: 0.25 }] },

  // ---- すごろく系 ----
  { id: "ch_traveler", name: "旅人のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "GOAL報酬+25%。", effects: [{ effectId: "GOAL_REWARD_RATE", value: 0.25 }] },
  { id: "ch_lucky", name: "幸運のお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "Rare率+5%。", effects: [{ effectId: "RARE_RATE_ADD", value: 0.05 }] },
  { id: "ch_treasure_hunter", name: "宝探しのお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "TREASURE関連の宝箱品質が上がりやすくなる。", effects: [{ effectId: "TREASURE_QUALITY_UP", value: true }] },
  { id: "ch_sprint", name: "疾走のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "出目5以上でGAMEを進めた場合、次の戦闘のダメージ+15%。", effects: [{ effectId: "HIGH_ROLL_BATTLE_DAMAGE", value: { threshold: 5, rate: 0.15 } }] },
  { id: "ch_precision", name: "精密のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "±1基本能力の使用回数+1。", effects: [{ effectId: "DICE_ADJUST_USES_ADD", value: 1 }] },
  { id: "ch_golden", name: "黄金のお守り", type: "CHARM", classType: "COMMON", rarity: "normal",
    description: "Gold獲得+15%。", effects: [{ effectId: "GOLD_GAIN_RATE", value: 0.15 }] },

  // ---- 特殊系 ----
  { id: "ch_gambler", name: "賭博のお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "出目6なら次戦闘全ダメージ+50%。出目1なら次戦闘全ダメージ-20%。",
    effects: [{ effectId: "GAMBLE_DICE_BATTLE_DAMAGE", value: { six: 0.50, one: -0.20 } }] },
  { id: "ch_greed", name: "強欲のお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "宝箱品質+1段階。SHOP価格+10%。",
    effects: [{ effectId: "TREASURE_QUALITY_UP", value: true }, { effectId: "SHOP_PRICE_RATE", value: 0.10 }] },
  { id: "ch_monster_lure", name: "魔物寄せのお守り", type: "CHARM", classType: "COMMON", rarity: "epic",
    description: "敵数+1。戦闘報酬+20%。",
    effects: [{ effectId: "ENEMY_COUNT_ADD", value: 1 }, { effectId: "ALL_ENEMY_REWARD_RATE", value: 0.20 }] },
  { id: "ch_survival", name: "生還のお守り", type: "CHARM", classType: "COMMON", rarity: "rare",
    description: "HP25%以下で戦闘を終えた場合、最大HPの10%回復。",
    effects: [{ effectId: "LOW_HP_BATTLE_END_HEAL", value: { threshold: 0.25, percent: 0.10 } }] },
];
