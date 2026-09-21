// ============================================================
// weapons.js
// 武器データ。剣士用と魔法使い用でプールを分けている（別枠）。
// 装備は「基礎ステータスを作る」役割なので、カードほど複雑な
// ルール変更はさせない方針だが、戦闘スタイルを少し補助する効果は持たせる。
//
// フィールド：
//   id, name, type:"WEAPON", classType, rarity,
//   physicalAttack / magicAttack（装備時に加算される基礎値）,
//   effects: [{ effectId, value }]（任意の追加効果。cardEffectSystemの
//   EQUIPMENT_HANDLERSで処理する。無ければ効果なしの純粋なステータス武器）
// ============================================================

const SWORDSMAN_WEAPONS = [
  { id: "wp_iron_sword", name: "鉄の剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "normal",
    physicalAttack: 10, description: "物理攻撃+10。", effects: [] },
  { id: "wp_steel_sword", name: "鋼の剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "rare",
    physicalAttack: 20, description: "物理攻撃+20。", effects: [] },
  { id: "wp_greatsword", name: "大剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "epic",
    physicalAttack: 35, description: "物理攻撃+35。多段カードダメージ-10%。",
    effects: [{ effectId: "MULTI_HIT_DAMAGE_RATE", value: -0.10 }] },
  { id: "wp_dual_blades", name: "双剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "epic",
    physicalAttack: 10, description: "物理攻撃+10。多段攻撃の各ヒット+15%。",
    effects: [{ effectId: "MULTI_HIT_DAMAGE_RATE", value: 0.15 }] },
  { id: "wp_crit_sword", name: "会心剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "rare",
    physicalAttack: 15, description: "物理攻撃+15。Critical率+10%。",
    effects: [{ effectId: "CRIT_RATE_ADD", value: 0.10 }] },
  { id: "wp_giant_slayer_sword", name: "巨人殺しの剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "epic",
    physicalAttack: 20, description: "物理攻撃+20。Strongダメージ+30%。",
    effects: [{ effectId: "STRONG_DAMAGE_RATE", value: 0.30 }] },
  { id: "wp_blood_sword", name: "血塗れの剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "epic",
    physicalAttack: 25, description: "物理攻撃+25。HP50%以下の間、さらに物理攻撃+30%。",
    effects: [{ effectId: "LOW_HP_PHYSICAL_RATE", value: { threshold: 0.5, rate: 0.30 } }] },
  { id: "wp_ki_blade", name: "闘気刀", type: "WEAPON", classType: "SWORDSMAN", rarity: "rare",
    physicalAttack: 15, description: "物理攻撃+15。闘気1につき物理攻撃+5%。",
    effects: [{ effectId: "MOMENTUM_DAMAGE_RATE", value: 0.05 }] },
  { id: "wp_iai_blade", name: "居合刀", type: "WEAPON", classType: "SWORDSMAN", rarity: "epic",
    physicalAttack: 20, description: "物理攻撃+20。戦闘最初の攻撃+60%。",
    effects: [{ effectId: "FIRST_ATTACK_RATE", value: 0.60 }] },
  { id: "wp_kings_greatsword", name: "王者の大剣", type: "WEAPON", classType: "SWORDSMAN", rarity: "legendary",
    physicalAttack: 40, description: "物理攻撃+40。1ヒット攻撃カードのダメージ+30%。",
    effects: [{ effectId: "SINGLE_HIT_CARD_RATE", value: 0.30 }] },
];

const MAGE_WEAPONS = [
  { id: "wp_wood_staff", name: "木の杖", type: "WEAPON", classType: "MAGE", rarity: "normal",
    magicAttack: 10, description: "魔法攻撃+10。", effects: [] },
  { id: "wp_mage_staff", name: "魔術師の杖", type: "WEAPON", classType: "MAGE", rarity: "rare",
    magicAttack: 20, description: "魔法攻撃+20。", effects: [] },
  { id: "wp_flame_staff", name: "火炎杖", type: "WEAPON", classType: "MAGE", rarity: "epic",
    magicAttack: 15, description: "魔法攻撃+15。全体攻撃+20%。",
    effects: [{ effectId: "AOE_DAMAGE_RATE", value: 0.20 }] },
  { id: "wp_thunder_staff", name: "雷杖", type: "WEAPON", classType: "MAGE", rarity: "epic",
    magicAttack: 15, description: "魔法攻撃+15。多段・連鎖魔法+20%。",
    effects: [{ effectId: "MULTI_HIT_DAMAGE_RATE", value: 0.20 }] },
  { id: "wp_resonance_staff", name: "共鳴杖", type: "WEAPON", classType: "MAGE", rarity: "epic",
    magicAttack: 15, description: "魔法攻撃+15。魔力共鳴効果+20%。",
    effects: [{ effectId: "RESONANCE_RATE", value: 0.20 }] },
  { id: "wp_golden_staff", name: "黄金杖", type: "WEAPON", classType: "MAGE", rarity: "rare",
    magicAttack: 10, description: "魔法攻撃+10。Gold獲得+15%。",
    effects: [{ effectId: "GOLD_GAIN_RATE", value: 0.15 }] },
  { id: "wp_blood_crystal_staff", name: "血晶の杖", type: "WEAPON", classType: "MAGE", rarity: "epic",
    magicAttack: 30, description: "魔法攻撃+30。魔法カード使用時、最大HPの2%を消費。",
    effects: [{ effectId: "MAGIC_CARD_HP_COST", value: 0.02 }] },
  { id: "wp_swarm_staff", name: "群体の杖", type: "WEAPON", classType: "MAGE", rarity: "epic",
    magicAttack: 15, description: "魔法攻撃+15。敵3体以上の間、魔法ダメージ+25%。",
    effects: [{ effectId: "SWARM_DAMAGE_RATE", value: { threshold: 3, rate: 0.25 } }] },
  { id: "wp_sage_staff", name: "賢者の杖", type: "WEAPON", classType: "MAGE", rarity: "epic",
    magicAttack: 25, description: "魔法攻撃+25。戦闘開始時、カードを1枚追加で引く。",
    effects: [{ effectId: "BATTLE_START_DRAW", value: 1 }] },
  { id: "wp_forbidden_staff", name: "禁忌の杖", type: "WEAPON", classType: "MAGE", rarity: "legendary",
    magicAttack: 45, description: "魔法攻撃+45。最大HP-20%。",
    effects: [{ effectId: "MAX_HP_RATE", value: -0.20 }] },
];

const ALL_WEAPONS = [...SWORDSMAN_WEAPONS, ...MAGE_WEAPONS];
