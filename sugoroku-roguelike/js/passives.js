// ============================================================
// passives.js
// 「Bossパッシブ」のデータをまとめたファイルです。
//
// 旧「戦闘特性カード」は廃止し、そこにあった強力な効果
// （狂戦士の血・死線・過剰魔力・禁術・吸血体質など）はすべて
// こちらのBossパッシブへ統合しました。
//
// 役割分担（重要・混同しないこと）：
//   アクションカード     … 「戦闘中に何をするか」
//   ステータス強化カード … 「基礎ステータスをどれだけ伸ばすか」
//   盤面強化カード       … 「どんな戦闘や報酬を作るか」
//   Bossパッシブ         … 「戦い方・ルールそのものを変える」少数精鋭の強化
//
// apply(player) は取得した瞬間に1回だけ呼ばれ、ステータスを直接書き換える
// （恒久的な数値強化はここで完結させる）。
// trigger + effectId を持たせると、cardEffectSystem.jsのTRAIT_HANDLERS
// （旧・特性カード用に作った仕組みをそのまま再利用）経由で、戦闘中の
// 特定タイミング（onTurnStart/onDamageTaken/onEnemyKilled/onCardUsed/
// onAttack/onBattleEnd等）に反応する動的な効果を実装できる。
// ============================================================

const BOSS_GENERIC_PASSIVES = [
  {
    id: "bp_berserker_blood", name: "狂戦士の血",
    description: "ターン開始時、現在HPの25%を消費する（HP0にはならない）。そのターン全ダメージ+75%。",
    trigger: "onTurnStart", effectId: "berserker_blood", effectValue: { hpCostPercent: 0.25, damageBonus: 0.75 },
  },
  {
    id: "bp_glass_hero", name: "ガラスの英雄",
    description: "最大HP-40%。全ダメージ+100%。",
    trigger: "onBattleStart", effectId: "glass_body", effectValue: { hpPenalty: 0.40, damageBonus: 1.0 },
  },
  {
    id: "bp_vampire", name: "吸血鬼",
    description: "敵撃破時、最大HPの8%回復。",
    trigger: "onEnemyKilled", effectId: "lifesteal_on_kill_percent", effectValue: 0.08,
  },
  {
    id: "bp_deaths_edge", name: "死線",
    description: "HPが30%以下の間、クリティカル率+40%・クリティカルダメージ+100%。",
    trigger: "onDamageTaken", effectId: "deaths_edge", effectValue: { threshold: 0.30, critRateBonus: 0.40, critDamageBonus: 1.0 },
  },
  {
    id: "bp_bounty_hunter", name: "賞金稼ぎ",
    description: "Strong率+20%、Strong報酬×2",
    apply: (p) => { p.bossStrongRateAdd = (p.bossStrongRateAdd || 0) + 0.20; p.bossStrongRewardMult = (p.bossStrongRewardMult || 1) * 2; },
  },
  {
    id: "bp_traveler", name: "旅人",
    description: "GOAL報酬×2、サイコロ最低出目+1",
    apply: (p) => { p.bossGoalRewardMult = (p.bossGoalRewardMult || 1) * 2; p.bossDiceMinAdd = (p.bossDiceMinAdd || 0) + 1; },
  },
  {
    id: "bp_tycoon", name: "大富豪",
    description: "Gold獲得+50%。所持Goldが5000以上の間、全ダメージ+50%。",
    apply: (p) => { p.bossGoldMult = (p.bossGoldMult || 1) * 1.5; },
    trigger: "onBattleStart", effectId: "rich_bonus_damage", effectValue: { threshold: 5000, damageBonus: 0.50 },
  },
  {
    id: "bp_destiny", name: "運命操作",
    description: "各GAMEにつき1回、サイコロの出目を強制的に6にできる（自動発動）。",
    apply: (p) => { p.destinyControlUsesPerGame = (p.destinyControlUsesPerGame || 0) + 1; },
  },
];

const BOSS_SWORDSMAN_PASSIVES = [
  {
    id: "bp_demon_blade", name: "剣鬼",
    description: "闘気が最大の間、物理ダメージ×2。ただし防御力-50%。",
    trigger: "onAttack", effectId: "demon_blade", effectValue: { damageMult: 2.0, defensePenalty: 0.50 },
  },
  {
    id: "bp_unyielding", name: "不退転",
    description: "HPが50%以下の間、攻撃カード使用時20%の確率で再発動する。",
    trigger: "onCardUsed", effectId: "unyielding_extra_attack", effectValue: { threshold: 0.50, chance: 0.20 },
  },
  {
    id: "bp_shura", name: "修羅",
    description: "敵撃破時の闘気獲得量+2。",
    trigger: "onEnemyKilled", effectId: "momentum_gain_bonus", effectValue: 2,
  },
  {
    id: "bp_thousand_hands", name: "千手",
    description: "多段カード（MULTIタグ）のダメージ+20%。",
    trigger: "onAttack", effectId: "tag_damage_bonus", effectValue: { tag: "MULTI", bonus: 0.20 },
  },
  {
    id: "bp_one_strike", name: "一刀両断",
    description: "1ヒットのみの攻撃カードのダメージ×2。",
    trigger: "onAttack", effectId: "single_hit_card_bonus", effectValue: { mult: 2.0 },
  },
  {
    id: "bp_giant_slayer", name: "巨人殺し",
    description: "Strongへのダメージ×3",
    apply: (p) => { p.bossStrongDamageMult = (p.bossStrongDamageMult || 1) * 3; },
  },
  {
    id: "bp_blood_battle", name: "血戦",
    description: "被ダメージ量の50%を、次に使う攻撃カードのダメージへ加算する。",
    trigger: "onDamageTaken", effectId: "damage_taken_to_next_attack", effectValue: 0.50,
  },
  {
    id: "bp_matchless", name: "無双",
    description: "敵撃破時、カード1枚ドロー＋ACTION1回復（1ターン最大2回）。",
    trigger: "onEnemyKilled", effectId: "draw_and_action_on_kill", effectValue: { draw: 1, action: 1, maxPerTurn: 2 },
  },
];

const BOSS_MAGE_PASSIVES = [
  {
    id: "bp_overmana", name: "過剰魔力",
    description: "ターン開始時、最大HPの10%を消費する。そのターン最初に使う魔法カードが2回発動する。",
    trigger: "onTurnStart", effectId: "overmana_percent", effectValue: { hpCostPercent: 0.10 },
  },
  {
    id: "bp_forbidden_art", name: "禁術",
    description: "HPが50%以下の間、魔法ダメージ×2。ただし受ける回復量-50%。",
    trigger: "onDamageTaken", effectId: "forbidden_art_x2", effectValue: { threshold: 0.50, healPenalty: 0.50 },
  },
  {
    id: "bp_resonance_amp", name: "共鳴増幅",
    description: "魔力共鳴の効果量×1.5",
    apply: (p) => { p.resonancePerEnemyBonus = (p.resonancePerEnemyBonus || 0) + CONFIG.SKILL_BASE.resonancePerEnemy * 0.5; },
  },
  {
    id: "bp_swarm_magic", name: "群体魔導",
    description: "敵が4体以上いる場合、全体魔法ダメージ+100%。",
    trigger: "onAttack", effectId: "swarm_magic_bonus", effectValue: { threshold: 4, damageBonus: 1.0 },
  },
  {
    id: "bp_archmage", name: "大魔導士",
    description: "2ACTION以上を消費する魔法カードのダメージ×2。",
    trigger: "onAttack", effectId: "high_cost_card_bonus", effectValue: { minCost: 2, mult: 2.0 },
  },
  {
    id: "bp_golden_wizard", name: "黄金魔導",
    description: "所持Gold1000Gごとに魔法ダメージ+10%（最大+100%）。",
    trigger: "onAttack", effectId: "gold_scaled_magic_damage", effectValue: { per: 1000, percent: 0.10, max: 1.0 },
  },
  {
    id: "bp_explosion_chain", name: "爆裂連鎖",
    description: "敵撃破時、残りの敵全体に撃破ダメージの30%の追加ダメージ。",
    trigger: "onEnemyKilled", effectId: "explosion_chain_on_kill", effectValue: 0.30,
  },
  {
    id: "bp_infinite_cast", name: "無限詠唱",
    description: "魔法カードを3枚使用するたび、ランダムな魔法カードを1枚手札に生成する。",
    trigger: "onCardUsed", effectId: "infinite_cast", effectValue: { every: 3 },
  },
];

const BOSS1_PASSIVES = [...BOSS_GENERIC_PASSIVES, ...BOSS_SWORDSMAN_PASSIVES, ...BOSS_MAGE_PASSIVES];
// デモ版ではBoss1・Boss2で同じ24種類のプールから選ぶ（重複取得は候補から除外される）
const BOSS2_PASSIVES = BOSS1_PASSIVES;

const BossPassiveSystem = {
  // classTypeを指定すると、汎用＋その職業専用だけに絞り込む（アクション/盤面カードと同じルール）
  getAvailablePassives(classType, owned) {
    const ownedIds = (owned || []).map((o) => o.id);
    return BOSS1_PASSIVES.filter((p) => {
      if (ownedIds.includes(p.id)) return false;
      const isGeneric = BOSS_GENERIC_PASSIVES.includes(p);
      const isMine = classType === "SWORDSMAN" ? BOSS_SWORDSMAN_PASSIVES.includes(p) : BOSS_MAGE_PASSIVES.includes(p);
      return isGeneric || isMine;
    });
  },
  pickChoices(pool, count) {
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },
};
