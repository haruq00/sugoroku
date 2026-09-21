// ============================================================
// cardEffectSystem.js
// 戦闘中のダメージ計算と、3種類のカード（戦闘/すごろく/特性）の
// effectIdハンドラをまとめたファイルです。
//
// 新しいカードを追加する時、既存コードにif文を増やす必要はありません。
// 単純な効果はbattleCards.js/boardCards.jsのeffect相当（hits配列や
// 汎用パラメータ）で表現し、特殊な効果だけeffectIdを新設して
// 対応するHANDLERSオブジェクトに1関数追加するだけで済みます。
//
// トリガー一覧（特性カードのtrigger、および各所からの呼び出しに対応）：
//   onBattleStart / onTurnStart / onCardUsed / onAttack / onCritical /
//   onDamageTaken / onEnemyKilled / onTurnEnd / onBattleEnd
// ============================================================

const CardEffectSystem = {
  // ---------------------------------------------------------
  // 戦闘状態（1戦闘だけ有効。Battleを開始するたびに作り直す）
  // ---------------------------------------------------------
  createBattleState(player, enemies) {
    return {
      turnNumber: 0,
      totalEnemyCount: enemies.length,
      momentum: 0, // 剣士：闘気（戦闘終了時リセット。momentumCarryOverならリセットしない）
      turnDamageBonus: 0,
      turnCritRateBonus: 0,
      turnCritDamageBonus: 0,
      pendingHitReduction: 0,     // 次に受けるダメージの軽減率（1回消費）
      nextTurnEvasionBonus: 0,    // 次の敵ターンだけ有効な回避率ボーナス
      nextTurnCounterPercent: 0,  // 次の敵ターン、被弾するたび反撃する割合
      nextTurnDamageReduction: 0, // 次の敵ターンの被ダメージ軽減率
      turnDefenseBonus: 0,        // 生存本能/死線/禁術などHP条件系のこのターンの防御ボーナス
      battleDamageBonus: 0,       // すごろくカード橋渡し等、戦闘開始時に一括で乗る全体ダメージ補正
      battleRareRewardBonus: 0,   // この戦闘中、Rare以上の敵からの報酬ボーナス
      lastCardTags: [],
      isFirstCardPlayed: false,
      killsThisBattle: 0,
      killDamageStack: 0,         // 連戦体質特性：撃破ごとに+10%、戦闘中累積
      resonanceExtraPercent: 0,   // 魔力共鳴付与カードでの上乗せ
      doubleNextSpell: false,
      damageLifestealThisBattle: 0,
      extraGoldThisBattle: 0,
      berserkerActive: false,
      glassBodyApplied: false,
      turnHpCostApplied: false,
    };
  },

  // ---------------------------------------------------------
  // 職業固有スキル：闘気（剣士）・魔力共鳴（魔法使い）
  // ---------------------------------------------------------
  getMomentumMax(player) {
    return CONFIG.SKILL_BASE.momentumMax + (player.momentumMaxBonus || 0);
  },
  getMomentumDamagePercent(player) {
    return CONFIG.SKILL_BASE.momentumDamagePercent + (player.momentumDamagePercentBonus || 0);
  },
  getMomentumBonus(player, battleState) {
    if (player.classType !== "SWORDSMAN") return 0;
    return Math.min(battleState.momentum, this.getMomentumMax(player)) * this.getMomentumDamagePercent(player);
  },
  gainMomentum(player, battleState, amount) {
    if (player.classType !== "SWORDSMAN") return;
    battleState.momentum = Math.min(this.getMomentumMax(player), battleState.momentum + amount);
  },
  getResonanceMax(player) {
    return CONFIG.SKILL_BASE.resonanceMax + (player.resonanceMaxBonus || 0);
  },
  getResonancePerEnemy(player) {
    return CONFIG.SKILL_BASE.resonancePerEnemy + (player.resonancePerEnemyBonus || 0);
  },
  getResonanceBonus(player, battleState, aliveEnemies) {
    if (player.classType !== "MAGE") return 0;
    let weightedCount = 0;
    (aliveEnemies || []).forEach((e) => {
      weightedCount += (e.rarityId === "rare" || e.rarityId === "legendary") ? (player.resonanceRareWeight || 1) : 1;
    });
    const raw = weightedCount * this.getResonancePerEnemy(player) + (battleState.resonanceExtraPercent || 0);
    return Math.min(this.getResonanceMax(player), raw);
  },

  // ---------------------------------------------------------
  // ダメージ計算（1ヒットぶん）。カードバトル化した戦闘の核。
  // hit: { percent, damageType }。damageType省略時は職業の主武器で決まる。
  // ---------------------------------------------------------
  // forDisplay=trueの場合、手札のダメージ表示用に「乱数要素を排除した
  // 期待値」を計算する（武器ロールは中央値、クリティカルは発生しない扱い）。
  calculateHitDamage(player, enemy, hit, battleState, aliveEnemies, forDisplay) {
    const damageType = hit.damageType || (player.classType === "MAGE" ? "magic" : "physical");
    const baseAttack = damageType === "magic" ? player.magicAttack : player.physicalAttack;

    let damage = baseAttack * hit.percent;

    // 職業固有スキル
    if (damageType === "physical") damage *= 1 + this.getMomentumBonus(player, battleState);
    if (damageType === "magic") damage *= 1 + this.getResonanceBonus(player, battleState, aliveEnemies);

    // 装備（武器/防具/お守り）のパーセント系効果
    if (damageType === "physical" && player.equipPhysicalAttackRate) damage *= 1 + player.equipPhysicalAttackRate;
    if (damageType === "magic" && player.equipMagicAttackRate) damage *= 1 + player.equipMagicAttackRate;
    if (hit.targets === "all" && player.equipAoeRate) damage *= 1 + player.equipAoeRate;
    if (player.equipPerEnemyDamageRate) damage *= 1 + player.equipPerEnemyDamageRate * battleState.totalEnemyCount;
    if (player.equipFirstAttackRate && !battleState.isFirstCardPlayed) damage *= 1 + player.equipFirstAttackRate;
    (player.equipLowHpDamageRates || []).forEach((r) => {
      if (player.currentHp / player.maxHp <= r.threshold) damage *= 1 + r.rate;
    });
    if (damageType === "physical") {
      (player.equipLowHpPhysicalRates || []).forEach((r) => {
        if (player.currentHp / player.maxHp <= r.threshold) damage *= 1 + r.rate;
      });
    }
    (player.equipSwarmRates || []).forEach((r) => {
      if (battleState.totalEnemyCount >= r.threshold) damage *= 1 + r.rate;
    });
    if (player.equipGambleDice && battleState.lastDiceValue === 6) damage *= 1 + player.equipGambleDice.six;
    if (player.equipGambleDice && battleState.lastDiceValue === 1) damage *= 1 + player.equipGambleDice.one;
    if (player.equipHighRollDamage && battleState.lastDiceValue >= player.equipHighRollDamage.threshold) {
      damage *= 1 + player.equipHighRollDamage.rate;
    }
    if (enemy.strongId === "strong" && player.equipStrongDamageRate) damage *= 1 + player.equipStrongDamageRate;

    // このターン限定バフ・戦闘全体バフ
    damage *= 1 + (battleState.turnDamageBonus || 0);
    damage *= 1 + (battleState.battleDamageBonus || 0);
    damage *= 1 + (battleState.killDamageStack || 0);

    // Bossパッシブ「群れ狩り」：敵1体につきダメージ+
    if (player.bossPerEnemyDamageAdd) damage *= 1 + player.bossPerEnemyDamageAdd * battleState.totalEnemyCount;

    // Strong特効（カード側の条件付きダメージは呼び出し元でpercent自体を変えるので、
    // ここでは汎用的な底上げのみ）
    if (enemy.strongId === "strong" && battleState.strongDamageMultExtra) {
      damage *= battleState.strongDamageMultExtra;
    }

    // クリティカル（表示用の見積もりでは、非クリティカル時の基準値を返す）
    const critRate = player.criticalRate + (battleState.turnCritRateBonus || 0) + (battleState.survivalCritRateBonus || 0);
    const isCritical = forDisplay ? false : Math.random() < critRate;
    if (isCritical) {
      damage *= player.criticalDamage + (battleState.turnCritDamageBonus || 0) + (battleState.survivalCritDamageBonus || 0);
    }

    return { damage: Math.max(1, Math.round(damage)), isCritical, damageType };
  },

  // 敵→プレイヤーのダメージ。回避判定→防御力→次ターン限定の軽減、の順。
  calculateEnemyDamage(player, enemy, battleState) {
    const evasion = player.evasion + (battleState.nextTurnEvasionBonus || 0);
    if (Math.random() < evasion) return { damage: 0, evaded: true };

    let damage = enemy.atk;
    if (enemy.strongId === "strong" && player.equipStrongDamageTakenRate) {
      damage = Math.round(damage * (1 + player.equipStrongDamageTakenRate)); // 負の値なら軽減になる
    }
    const defenseBonus = battleState.turnDefenseBonus || 0;
    const effectiveDefense = player.defense * (1 + defenseBonus);
    damage = Math.max(1, Math.round(damage - effectiveDefense));

    if (battleState.nextTurnDamageReduction) {
      damage = Math.max(1, Math.round(damage * (1 - battleState.nextTurnDamageReduction)));
    }
    if (battleState.pendingHitReduction) {
      damage = Math.max(0, Math.round(damage * (1 - battleState.pendingHitReduction)));
      battleState.pendingHitReduction = 0; // 1回だけ消費
    }
    // 不死鳥の衣：1GAMEに1回、HP0になる攻撃をHP1で耐える
    if (player.equipDeathPreventionCharges > 0 && damage >= player.currentHp) {
      damage = player.currentHp - 1;
      player.equipDeathPreventionCharges -= 1;
    }
    return { damage, evaded: false };
  },

  // ---------------------------------------------------------
  // 手札のカードに「実際に与えるダメージ」を表示するための見積もり計算。
  // クリティカルは考慮しない通常時の値（非クリ想定の基準値）を返す。
  // 対象が要る条件付きダメージ系カード（首狩り・背水など）や全体攻撃カードは、
  // 「選択中の対象（無ければ先頭の生存中の敵）に当たった場合」の値を計算する
  // （全体攻撃は対象ごとに同じ割合が入るため、代表値として分かりやすい）。
  // ダメージを与えないカード（回復・ドローなど）はnullを返す。
  // ---------------------------------------------------------
  getCardDisplayDamage(player, card, aliveEnemies, battleState, primaryTarget) {
    const bs = battleState || this.createBattleState(player, aliveEnemies || []);
    const target = primaryTarget || (aliveEnemies || [])[0];

    if (card.hits) {
      let total = 0;
      card.hits.forEach((hit) => {
        if (!target) return;
        total += this.calculateHitDamage(player, target, hit, bs, aliveEnemies, true).damage;
      });
      return total;
    }

    const condHandler = this.DAMAGE_CONDITION_HANDLERS[card.effectId];
    if (condHandler && target) {
      const cond = condHandler(player, target, card, bs);
      const hit = { percent: cond.percent, damageType: cond.damageType };
      return this.calculateHitDamage(player, target, hit, bs, aliveEnemies, true).damage;
    }

    return null;
  },

  // ---------------------------------------------------------
  // 戦闘アクションカードのeffectIdハンドラ
  // 各関数は (player, battleState, card, battleApi) => void（battleApiを通じて
  // 回復・ドロー・ACTION付与などbattleSystem.jsの機能を呼び出す）。
  // ダメージそのものを直接計算するもの（conditional damage系）はDAMAGE_HANDLERSに分離。
  // ---------------------------------------------------------
  BATTLE_CARD_HANDLERS: {
    turn_crit_rate_up(player, bs, card) { bs.turnCritRateBonus = (bs.turnCritRateBonus || 0) + card.effectValue; },
    turn_crit_damage_up(player, bs, card) { bs.turnCritDamageBonus = (bs.turnCritDamageBonus || 0) + card.effectValue; },
    next_hit_reduction(player, bs, card) {
      const boosted = card.effectValue * (1 + (player.equipDefenseCardRate || 0));
      bs.pendingHitReduction = Math.max(bs.pendingHitReduction || 0, Math.min(1, boosted));
    },
    heal_percent(player, bs, card, api) { api.heal(Math.round(player.maxHp * card.effectValue)); },
    draw_cards(player, bs, card, api) { api.draw(card.effectValue); },
    draw_and_action(player, bs, card, api) { api.draw(card.effectValue.draw); api.gainAction(card.effectValue.action); },
    gain_action(player, bs, card, api) { api.gainAction(card.effectValue); },
    battle_rare_reward_up(player, bs, card) { bs.battleRareRewardBonus = (bs.battleRareRewardBonus || 0) + card.effectValue; },
    next_turn_evasion_up(player, bs, card) { bs.nextTurnEvasionBonus = (bs.nextTurnEvasionBonus || 0) + card.effectValue; },
    gain_momentum(player, bs, card) { CardEffectSystem.gainMomentum(player, bs, card.effectValue); },
    next_turn_counter(player, bs, card) { bs.nextTurnCounterPercent = Math.max(bs.nextTurnCounterPercent || 0, card.effectValue); },
    battle_resonance_boost(player, bs, card) { bs.resonanceExtraPercent = (bs.resonanceExtraPercent || 0) + card.effectValue; },
    double_next_spell(player, bs) { bs.doubleNextSpell = true; },
    next_turn_damage_reduction(player, bs, card) { bs.nextTurnDamageReduction = Math.max(bs.nextTurnDamageReduction || 0, card.effectValue); },
    heal_and_turn_defense(player, bs, card, api) {
      api.heal(Math.round(player.maxHp * card.effectValue.healPercent));
      bs.turnDefenseBonus = (bs.turnDefenseBonus || 0) + card.effectValue.defenseReduction;
    },
    self_hp_cost_percent(player, bs, card, api) {
      const cost = Math.max(1, Math.round(player.maxHp * card.effectValue));
      api.damageSelf(cost);
    },
    // 撃破時追加ゴールド（onDefeatフックから呼ばれる）
    bonus_gold_on_kill(player, bs, card, api, ctx) { if (ctx && ctx.killed) api.addBattleGold(card.effectValue); },
    // 撃破時、残りの敵全体へ追加ダメージ
    death_explosion(player, bs, card, api, ctx) {
      if (!ctx || !ctx.killed) return;
      api.dealDamageToOthers(ctx.enemy, card.effectValue.percent, card.effectValue.damageType);
    },
    lifesteal_from_hit(player, bs, card, api, ctx) {
      if (!ctx) return;
      const heal = Math.round((ctx.totalDamage || 0) * card.effectValue);
      if (heal > 0) api.heal(heal);
    },
    // 貫通斬り：撃破した場合、余ったダメージ（オーバーキル分）の半分を別の生存中の敵へ
    pierce_excess_damage(player, bs, card, api, ctx) {
      if (!ctx || !ctx.killed || !ctx.overkill) return;
      const carryOver = Math.round(ctx.overkill * 0.5);
      if (carryOver > 0) api.dealDamageToOthers(ctx.enemy, null, "physical", carryOver);
    },
    // 血刃：このカードで撃破できた場合、その戦闘中の物理ダメージを恒久的に積み増す
    stack_damage_on_kill_battle(player, bs, card, api, ctx) {
      if (ctx && ctx.killed) bs.killDamageStack = (bs.killDamageStack || 0) + card.effectValue;
    },
    // 天地両断：このターン、他の攻撃カードを使用できなくする
    lockout_other_attacks_this_turn(player, bs) { bs.attackLockedThisTurn = true; },
  },

  // 「hitsの代わりに、カード自身がダメージ割合を条件分岐で決める」系。
  // 戻り値 { percent, damageType, extra(任意の追加処理フラグ) }。
  DAMAGE_CONDITION_HANDLERS: {
    conditional_damage_strong(player, enemy, card) {
      const v = card.effectValue;
      return { percent: enemy.strongId === "strong" ? v.strongPercent : v.normalPercent, damageType: v.damageType };
    },
    combo_tag_damage(player, enemy, card, bs) {
      const v = card.effectValue;
      const prevTags = bs.lastCardTags || [];
      const isCombo = (card.tags || []).some((t) => prevTags.includes(t));
      return { percent: isCombo ? v.comboPercent : v.normalPercent, damageType: v.damageType };
    },
    first_card_bonus_damage(player, enemy, card, bs) {
      const v = card.effectValue;
      return { percent: !bs.isFirstCardPlayed ? v.firstPercent : v.normalPercent, damageType: v.damageType };
    },
    momentum_bonus_damage(player, enemy, card, bs) {
      const v = card.effectValue;
      return { percent: v.basePercent + bs.momentum * v.perMomentum, damageType: v.damageType };
    },
    low_hp_conditional_damage(player, enemy, card) {
      const v = card.effectValue;
      const isLow = player.currentHp / player.maxHp <= v.threshold;
      return { percent: isLow ? v.lowHpPercent : v.normalPercent, damageType: v.damageType };
    },
    execute_conditional_damage(player, enemy, card) {
      const v = card.effectValue;
      const isLow = enemy.hp / enemy.maxHp <= v.threshold;
      return { percent: isLow ? v.executePercent : v.normalPercent, damageType: v.damageType };
    },
    rare_bonus_damage_and_gold(player, enemy, card) {
      const v = card.effectValue;
      const isRare = enemy.rarityId === "rare" || enemy.rarityId === "legendary";
      return { percent: isRare ? v.basePercent + v.rareBonusPercent : v.basePercent, damageType: v.damageType, bonusGoldIfRare: isRare ? v.bonusGold : 0 };
    },
  },

  // ---------------------------------------------------------
  // すごろくカードのeffectIdハンドラ
  // 多くは player 側のフラグ（永続 or そのGAME限定）として保持し、
  // board.js / game.js / combat.js の該当箇所で読み取って反映する。
  // ---------------------------------------------------------
  BOARD_CARD_HANDLERS: {
    reroll_uses_add(player, card) { player.rerollUsesBonus = (player.rerollUsesBonus || 0) + card.effectValue; },
    choose_best_of_two(player) { player.diceChooseBestOfTwo = true; },
    dice_min_value(player, card) { player.diceMinValue = Math.max(player.diceMinValue || 0, card.effectValue); },
    dice_add(player, card) { player.diceAddBonus = (player.diceAddBonus || 0) + card.effectValue; },
    reroll_on_six(player, card) { player.luckySixChance = Math.max(player.luckySixChance || 0, card.effectValue); },
    one_becomes_six(player) { player.oneBecomesSixUsesPerGame = (player.oneBecomesSixUsesPerGame || 0) + 1; },
    goal_gold_flat(player, card) { player.goalGoldFlat = (player.goalGoldFlat || 0) + card.effectValue; },
    goal_gold_per_medal(player, card) { player.goalGoldPerMedal = (player.goalGoldPerMedal || 0) + card.effectValue; },
    goal_heal_percent(player, card) { player.goalHealPercent = (player.goalHealPercent || 0) + card.effectValue; },
    goal_percent_gold(player, card) { player.goalPercentGold = (player.goalPercentGold || 0) + card.effectValue; },
    momentum_from_medals(player, card) { player.medalToBattleDamage = (player.medalToBattleDamage || 0) + card.effectValue; },
    goal_extra_roll(player) { player.goalExtraRoll = true; },
    pass_gold_on_type(player, card) {
      player.passGoldRules = player.passGoldRules || [];
      player.passGoldRules.push(card.effectValue);
    },
    pass_stack_battle_buff(player, card) {
      player.passStackBuffRules = player.passStackBuffRules || [];
      player.passStackBuffRules.push(card.effectValue);
    },
    pass_stack_enemy_and_reward(player, card) { player.passStackEnemyReward = (player.passStackEnemyReward || 0) + card.effectValue; },
    first_pass_partial(player, card) { player.firstPassPartial = Math.max(player.firstPassPartial || 0, card.effectValue); },
    enemy_count_add(player, card) { player.boardEnemyCountAdd = (player.boardEnemyCountAdd || 0) + card.effectValue; },
    strong_rate_add(player, card) { player.boardStrongRateAdd = (player.boardStrongRateAdd || 0) + card.effectValue; },
    strong_rate_and_reward(player, card) {
      player.boardStrongRateAdd = (player.boardStrongRateAdd || 0) + card.effectValue.rateAdd;
      player.boardStrongRewardMult = (player.boardStrongRewardMult || 1) * card.effectValue.rewardMult;
    },
    rare_rate_add(player, card) { player.boardRareRateAdd = (player.boardRareRateAdd || 0) + card.effectValue; },
    rare_reward_mult(player, card) { player.boardRareRewardMult = (player.boardRareRewardMult || 1) * card.effectValue; },
    gold_gain_mult(player, card) { player.boardGoldGainMult = (player.boardGoldGainMult || 1) * card.effectValue; },
    convert_tile(player, card) {
      player.pendingTileConversions = player.pendingTileConversions || [];
      player.pendingTileConversions.push(card.effectValue);
    },
    dice_value_to_first_attack(player, card) { player.diceToFirstAttackPercent = (player.diceToFirstAttackPercent || 0) + card.effectValue; },
    long_move_extra_hand(player, card) {
      player.longMoveExtraHandRules = player.longMoveExtraHandRules || [];
      player.longMoveExtraHandRules.push(card.effectValue);
    },
    earned_gold_to_battle_damage(player, card) { player.goldToBattleDamageRule = card.effectValue; },
  },

  // ---------------------------------------------------------
  // 戦闘特性カードのハンドラ（trigger別に分けている）
  // battleApiでheal/damageSelf等を呼び出す。
  // ---------------------------------------------------------
  TRAIT_HANDLERS: {
    // onTurnStart
    berserker_blood(player, bs, trait, api) {
      const cost = Math.max(1, Math.round(player.currentHp * trait.effectValue.hpCostPercent));
      api.damageSelf(cost);
      bs.turnDamageBonus = (bs.turnDamageBonus || 0) + trait.effectValue.damageBonus;
    },
    overmana(player, bs, trait, api) {
      api.damageSelf(trait.effectValue.hpCostFlat);
      bs.doubleNextSpell = true;
    },
    // onBattleStart
    // 「最大HP-30%」は装備時の恒久的なステータス交換のため、ラン中1回だけ適用する
    // （battleStateではなくplayer自身にフラグを持たせ、戦闘のたびに再適用されるのを防ぐ）。
    glass_body(player, bs, trait) {
      bs.battleDamageBonus = (bs.battleDamageBonus || 0) + trait.effectValue.damageBonus;
      if (player.glassBodyApplied) return;
      player.glassBodyApplied = true;
      player.currentHp = Math.max(1, Math.round(player.currentHp * (1 - trait.effectValue.hpPenalty)));
      player.maxHp = Math.round(player.maxHp * (1 - trait.effectValue.hpPenalty));
    },
    // 血の契約は「戦闘のたびに現在HPを対価として払い、その戦闘中だけ強化される」
    // 設計のため、maxHpそのものは変更しない（api.damageSelfはcurrentHpのみ減らす）。
    blood_pact(player, bs, trait, api) {
      const cost = Math.max(1, Math.round(player.maxHp * trait.effectValue.hpCostPercent));
      api.damageSelf(cost);
      bs.battleDamageBonus = (bs.battleDamageBonus || 0) + trait.effectValue.damageBonus; // 物理限定簡略化
    },
    // 共鳴増幅・闘争本能はいずれも「装備時の恒久強化」であり、トリガーが
    // 何度発生しても一度だけ適用する（そうしないとBattleStart/Kill毎に
    // 際限なく積み上がってしまう）。
    resonance_amplify(player, bs, trait) {
      if (player.resonanceAmplifyApplied) return;
      player.resonanceAmplifyApplied = true;
      player.resonancePerEnemyBonus = (player.resonancePerEnemyBonus || 0) + trait.effectValue;
    },
    // onDamageTaken（HP割合条件系。毎回呼ばれるたびに条件を再評価する）
    survival_instinct(player, bs, trait) {
      const active = player.currentHp / player.maxHp <= trait.effectValue.threshold;
      bs.turnDefenseBonus = active ? trait.effectValue.defenseBonus : (bs.turnDefenseBonus || 0);
      bs.survivalCritRateBonus = active ? trait.effectValue.critBonus : 0;
    },
    deaths_edge(player, bs, trait) {
      const active = player.currentHp / player.maxHp <= trait.effectValue.threshold;
      bs.survivalCritRateBonus = active ? trait.effectValue.critRateBonus : (bs.survivalCritRateBonus || 0);
      bs.survivalCritDamageBonus = active ? trait.effectValue.critDamageBonus : 0;
    },
    forbidden_art(player, bs, trait) {
      const active = player.currentHp / player.maxHp <= trait.effectValue.threshold;
      bs.battleDamageBonus = active ? (bs.battleDamageBonus || 0) + trait.effectValue.damageBonus - (bs.forbiddenArtApplied ? trait.effectValue.damageBonus : 0) : bs.battleDamageBonus;
      bs.forbiddenArtApplied = active;
      bs.healPenalty = active ? trait.effectValue.healPenalty : 0;
    },
    // onEnemyKilled
    momentum_gain_bonus(player, bs, trait) {
      if (player.momentumGainBonusApplied) return;
      player.momentumGainBonusApplied = true;
      player.momentumPerKillBonus = (player.momentumPerKillBonus || 0) + trait.effectValue;
    },
    lifesteal_on_kill_percent(player, bs, trait, api) { api.heal(Math.round(player.maxHp * trait.effectValue)); },
    stack_damage_on_kill(player, bs, trait) { bs.killDamageStack = (bs.killDamageStack || 0) + trait.effectValue; },
    // onCardUsed
    life_chant(player, bs, trait, api, ctx) {
      if (!ctx || ctx.damageType !== "magic") return;
      const cost = Math.max(1, Math.round(player.maxHp * trait.effectValue.hpCostPercent));
      api.damageSelf(cost);
      bs.turnDamageBonus = (bs.turnDamageBonus || 0) + trait.effectValue.damageBonus;
    },
    unyielding_extra_attack(player, bs, trait, api, ctx) {
      if (!ctx || !ctx.isAttackCard) return;
      if (player.currentHp / player.maxHp > trait.effectValue.threshold) return;
      if (Math.random() < trait.effectValue.chance) api.replayLastCardEffect();
    },
    // onAttack（ダメージ計算の直前に呼ばれ、battleStateへ倍率を足す）
    demon_blade(player, bs, trait) {
      const atMax = bs.momentum >= CardEffectSystem.getMomentumMax(player);
      bs.demonBladeActive = atMax;
    },
    swarm_magic(player, bs, trait) {
      bs.swarmMagicActive = bs.totalEnemyCount >= trait.effectValue.threshold;
    },
    // 千手：MULTIタグの付いたカードのダメージ+
    tag_damage_bonus(player, bs, passive, api, ctx) {
      if (ctx && ctx.card && (ctx.card.tags || []).includes(passive.effectValue.tag)) {
        bs.tagDamageBonusPercent = passive.effectValue.bonus;
      }
    },
    // 一刀両断：hitsが1つだけの単発カードのダメージを倍にする
    single_hit_card_bonus(player, bs, passive, api, ctx) {
      if (ctx && ctx.card && ctx.card.hits && ctx.card.hits.length === 1) {
        bs.singleHitCardMult = passive.effectValue.mult;
      }
    },
    // 大魔導士：2ACTION以上のカードのダメージを倍にする
    high_cost_card_bonus(player, bs, passive, api, ctx) {
      if (ctx && ctx.card && ctx.card.cost >= passive.effectValue.minCost) {
        bs.highCostCardMult = passive.effectValue.mult;
      }
    },
    // 黄金魔導：所持Goldに応じて魔法ダメージ+（game.js側でplayer.walletGoldSnapshotを更新している）
    gold_scaled_magic_damage(player, bs, passive, api, ctx) {
      if (!ctx || !ctx.hit) return;
      const damageType = ctx.hit.damageType || (player.classType === "MAGE" ? "magic" : "physical");
      if (damageType !== "magic") return;
      const gold = player.walletGoldSnapshot || 0;
      const bonus = Math.min(passive.effectValue.max, Math.floor(gold / passive.effectValue.per) * passive.effectValue.percent);
      bs.goldScaledMagicPercent = bonus;
    },
    // 大富豪：所持Goldが一定以上の間、戦闘中ずっとダメージ+（戦闘開始時に判定）
    rich_bonus_damage(player, bs, passive) {
      if ((player.walletGoldSnapshot || 0) >= passive.effectValue.threshold) {
        bs.battleDamageBonus = (bs.battleDamageBonus || 0) + passive.effectValue.damageBonus;
      }
    },
    // 血戦：被ダメージの50%を次の攻撃カードへ加算する
    damage_taken_to_next_attack(player, bs, passive, api, ctx) {
      if (!ctx) return;
      bs.pendingDamageCarryOver = (bs.pendingDamageCarryOver || 0) + Math.round((ctx.damage || 0) * passive.effectValue);
    },
    // 無双：撃破時にカード1枚ドロー＋ACTION回復（1ターン最大◯回）
    draw_and_action_on_kill(player, bs, passive, api) {
      bs.matchlessUsesThisTurn = bs.matchlessUsesThisTurn || 0;
      if (bs.matchlessUsesThisTurn >= passive.effectValue.maxPerTurn) return;
      bs.matchlessUsesThisTurn += 1;
      api.draw(passive.effectValue.draw);
      api.gainAction(passive.effectValue.action);
    },
    // 過剰魔力：ターン開始時HP%消費、最初の魔法カードを2回発動
    overmana_percent(player, bs, passive, api) {
      const cost = Math.max(1, Math.round(player.maxHp * passive.effectValue.hpCostPercent));
      api.damageSelf(cost);
      bs.doubleNextSpell = true;
    },
    // 禁術：HP50%以下で魔法ダメージ×2、回復-50%
    forbidden_art_x2(player, bs, passive) {
      const active = player.currentHp / player.maxHp <= passive.effectValue.threshold;
      bs.forbiddenArtX2Active = active;
      bs.healPenalty = active ? passive.effectValue.healPenalty : 0;
    },
    // 爆裂連鎖：撃破時、残りの敵全体に撃破ダメージの一部を追加ダメージ
    explosion_chain_on_kill(player, bs, passive, api, ctx) {
      if (!ctx || !ctx.killed) return;
      api.dealDamageToOthers(ctx.enemy, null, "magic", Math.round((ctx.totalDamage || 0) * passive.effectValue));
    },
    // 無限詠唱：魔法カードを一定枚数使うたび、ランダムな魔法カードを手札に生成する
    infinite_cast(player, bs, passive, api, ctx) {
      if (!ctx || !ctx.damageType || ctx.damageType !== "magic") return;
      bs.infiniteCastCount = (bs.infiniteCastCount || 0) + 1;
      if (bs.infiniteCastCount % passive.effectValue.every === 0) {
        const pool = MAGE_BATTLE_CARDS;
        const card = pool[Math.floor(Math.random() * pool.length)];
        api.addCardToHand(card);
      }
    },
  },

  // ---------------------------------------------------------
  // トリガーの一括発火。Bossパッシブ配列(player.bossPassives)を見て、
  // 該当triggerのものを全部呼ぶ（引数名は汎用的にitemsとしている）。
  // ---------------------------------------------------------
  triggerTraits(items, triggerName, player, battleState, api, ctx) {
    (items || []).forEach((trait) => {
      if (trait.trigger !== triggerName) return;
      const handler = this.TRAIT_HANDLERS[trait.effectId];
      if (handler) handler(player, battleState, trait, api, ctx);
    });
  },
};
