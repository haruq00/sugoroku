// ============================================================
// statCards.js
// 「ステータス強化カード」のデータ。取得した瞬間にキャラクターの
// 基礎ステータスを永久強化する（戦闘デッキには入らない）。
// GameState.statCardHistory に取得履歴として積まれるだけで、
// 効果はapply()でその場でplayerへ反映して終わり（他のカード種と違い
// 「持っている」状態を管理する必要がない）。
// ============================================================

const STAT_CARDS = [
  { id: "st_str1", name: "筋力Ⅰ", rarity: "normal", tags: ["PHYSICAL"], description: "物理攻撃+5", apply: (p) => { p.physicalAttack += 5; } },
  { id: "st_str2", name: "筋力Ⅱ", rarity: "rare", tags: ["PHYSICAL"], description: "物理攻撃+10", apply: (p) => { p.physicalAttack += 10; } },
  { id: "st_str3", name: "筋力Ⅲ", rarity: "epic", tags: ["PHYSICAL"], description: "物理攻撃+20", apply: (p) => { p.physicalAttack += 20; } },
  { id: "st_mag1", name: "魔力Ⅰ", rarity: "normal", tags: ["MAGIC"], description: "魔法攻撃+5", apply: (p) => { p.magicAttack += 5; } },
  { id: "st_mag2", name: "魔力Ⅱ", rarity: "rare", tags: ["MAGIC"], description: "魔法攻撃+10", apply: (p) => { p.magicAttack += 10; } },
  { id: "st_mag3", name: "魔力Ⅲ", rarity: "epic", tags: ["MAGIC"], description: "魔法攻撃+20", apply: (p) => { p.magicAttack += 20; } },
  { id: "st_hp1", name: "生命Ⅰ", rarity: "normal", tags: ["HEAL"], description: "最大HP+10", apply: (p) => { p.maxHp += 10; p.currentHp += 10; } },
  { id: "st_hp2", name: "生命Ⅱ", rarity: "rare", tags: ["HEAL"], description: "最大HP+20", apply: (p) => { p.maxHp += 20; p.currentHp += 20; } },
  { id: "st_hp3", name: "生命Ⅲ", rarity: "epic", tags: ["HEAL"], description: "最大HP+40", apply: (p) => { p.maxHp += 40; p.currentHp += 40; } },
  { id: "st_def1", name: "守備Ⅰ", rarity: "normal", tags: ["DEFENSE"], description: "防御+2", apply: (p) => { p.defense += 2; } },
  { id: "st_def2", name: "守備Ⅱ", rarity: "rare", tags: ["DEFENSE"], description: "防御+5", apply: (p) => { p.defense += 5; } },
  { id: "st_def3", name: "守備Ⅲ", rarity: "epic", tags: ["DEFENSE"], description: "防御+10", apply: (p) => { p.defense += 10; } },
  { id: "st_crit1", name: "会心Ⅰ", rarity: "normal", tags: ["CRITICAL"], description: "Critical率+3%", apply: (p) => { p.criticalRate += 0.03; } },
  { id: "st_crit2", name: "会心Ⅱ", rarity: "rare", tags: ["CRITICAL"], description: "Critical率+6%", apply: (p) => { p.criticalRate += 0.06; } },
  { id: "st_critdmg1", name: "致命Ⅰ", rarity: "normal", tags: ["CRITICAL"], description: "Criticalダメージ+20%", apply: (p) => { p.criticalDamage += 0.20; } },
  { id: "st_critdmg2", name: "致命Ⅱ", rarity: "rare", tags: ["CRITICAL"], description: "Criticalダメージ+40%", apply: (p) => { p.criticalDamage += 0.40; } },
  { id: "st_evasion", name: "回避訓練", rarity: "rare", tags: [], description: "回避率+3%", apply: (p) => { p.evasion += 0.03; } },
  { id: "st_heal_power", name: "治癒力", rarity: "rare", tags: ["HEAL"], description: "回復量+15%", apply: (p) => { p.healPowerMult = (p.healPowerMult || 1) + 0.15; } },
  { id: "st_tough", name: "強靭", rarity: "epic", tags: ["HEAL", "DEFENSE"], description: "最大HP+15、防御+2", apply: (p) => { p.maxHp += 15; p.currentHp += 15; p.defense += 2; } },
  { id: "st_shura", name: "修羅", rarity: "legendary", tags: ["PHYSICAL", "MAGIC", "LOW_HP"], description: "最大HP-10%、物理・魔法攻撃+10%",
    apply: (p) => {
      const cut = Math.round(p.maxHp * 0.10);
      p.maxHp = Math.max(1, p.maxHp - cut);
      p.currentHp = Math.min(p.currentHp, p.maxHp);
      p.physicalAttack = Math.round(p.physicalAttack * 1.10);
      p.magicAttack = Math.round(p.magicAttack * 1.10);
    } },
];
