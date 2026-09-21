// ============================================================
// battleSystem.js
// 「高速カードバトル」の中核エンジンです。
//
// 従来の完全オート戦闘と違い、プレイヤーがカードを選ぶまで
// 次に進みません。UI（battleUI.js）が BattleSystem.playCard(index) /
// BattleSystem.endTurn() を呼び出し、その結果をcallbacks経由で
// 受け取って画面に反映します。
//
// 流れ：
//   startBattle() … 手札を引きPLAYER TURN開始。Promiseを返し、
//                    戦闘が完全に終わった時にresolveする。
//   playCard(i)   … 手札iを使用。ACTION消費→自動でダメージ計算・
//                    演出→勝敗判定。
//   endTurn()     … 残りACTIONを破棄しENEMY TURNへ。反撃後、
//                    次のPLAYER TURNを自動開始。
//
// ダメージ計算そのものはcardEffectSystem.jsに集約しているため、
// このファイルは「進行」だけに専念する。
// ============================================================

const BattleSystem = {
  current: null, // 進行中の戦闘インスタンス（1つだけ）

  isLocked() {
    return !this.current || this.current.locked || this.current.ended;
  },

  // 汎用シャッフル
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  // player: GameState.player, enemies: Combat.generateEnemies()の結果
  // deck: player.battleDeck, bossPassives: player.bossPassives（トリガー付きで戦闘に反応する）
  // callbacks: 画面演出用（onEnemiesAppear, onTurnStart, onHandUpdated,
  //            onCardPlayed, onAttackHit, onEnemyDefeated, onEnemyAttack,
  //            onPlayerDamaged, onPlayerDown, onBattleEnd）
  startBattle(player, enemies, deck, bossPassives, callbacks) {
    return new Promise((resolve) => {
      const battleState = CardEffectSystem.createBattleState(player, enemies);
      const bonusActions = player.bossBonusActions || 0;

      this.current = {
        player, enemies, bossPassives: bossPassives || [], callbacks: callbacks || {},
        battleState,
        drawPile: this.shuffle(deck),
        hand: [],
        discardPile: [],
        actionPoints: 0,
        maxActionPoints: CONFIG.BATTLE.ACTIONS_PER_TURN + bonusActions,
        locked: false,
        ended: false,
        resolve,
        selectedTargetSlot: enemies.length > 0 ? enemies[0].slotIndex : null,
      };

      const api = this.buildApi();
      CardEffectSystem.triggerTraits(this.current.bossPassives, "onBattleStart", player, battleState, api);
      if (player.equipBattleStartDraw) this.drawHand(player.equipBattleStartDraw);

      callbacks.onEnemiesAppear && callbacks.onEnemiesAppear(enemies);

      setTimeout(() => this.startPlayerTurn(), CONFIG.BATTLE_INITIAL_DELAY_MS);
    });
  },

  // ---------------------------------------------------------
  // 手札
  // ---------------------------------------------------------
  drawOne() {
    const b = this.current;
    if (!b) return null;
    if (b.drawPile.length === 0) {
      if (b.discardPile.length === 0) return null;
      b.drawPile = this.shuffle(b.discardPile);
      b.discardPile = [];
    }
    return b.drawPile.pop();
  },

  drawHand(count) {
    const b = this.current;
    if (!b) return;
    for (let i = 0; i < count; i++) {
      const card = this.drawOne();
      if (card) b.hand.push(card);
    }
  },

  discardHand() {
    const b = this.current;
    if (!b) return;
    b.discardPile.push(...b.hand);
    b.hand = [];
  },

  // ---------------------------------------------------------
  // ターン進行
  // ---------------------------------------------------------
  startPlayerTurn() {
    const b = this.current;
    if (!b || b.ended) return;
    b.battleState.turnNumber += 1;

    // ターン限定バフはここでリセット（戦闘全体・次ターン限定のものは残す）
    b.battleState.turnDamageBonus = 0;
    b.battleState.turnCritRateBonus = 0;
    b.battleState.attackLockedThisTurn = false;
    b.battleState.turnCritDamageBonus = 0;
    b.battleState.survivalCritRateBonus = 0;
    b.battleState.survivalCritDamageBonus = 0;

    b.actionPoints = b.maxActionPoints;
    if (b.battleState.turnNumber === 1 && b.player.equipFirstTurnActionAdd) {
      b.actionPoints += b.player.equipFirstTurnActionAdd;
    }
    this.discardHand();
    this.drawHand(CONFIG.BATTLE.HAND_SIZE_PER_TURN);

    const api = this.buildApi();
    CardEffectSystem.triggerTraits(b.bossPassives, "onTurnStart", b.player, b.battleState, api);

    if (b.player.currentHp <= 0) { this.finish("dead"); return; }

    b.locked = false; // 新しい手札の準備が整うまでは操作を受け付けない（enemyTurn→ここまでロックし続ける）
    b.callbacks.onTurnStart && b.callbacks.onTurnStart(b.battleState.turnNumber, b.actionPoints, b.maxActionPoints, b.hand);
  },

  // handIndexのカードを使用する。falseを返した場合は使用できなかった（ACTION不足等）。
  playCard(handIndex) {
    const b = this.current;
    if (!b || b.ended || b.locked) return false;
    const card = b.hand[handIndex];
    if (!card) return false;
    if (b.actionPoints < card.cost) return false;
    // 天地両断などの効果でこのターン中は攻撃カードが封じられている場合、DAMAGE系カードは使えない
    const isDamageCard = !!(card.hits || CardEffectSystem.DAMAGE_CONDITION_HANDLERS[card.effectId]);
    if (b.battleState.attackLockedThisTurn && isDamageCard) return false;

    b.locked = true;
    b.actionPoints -= card.cost;
    b.hand.splice(handIndex, 1);
    b.discardPile.push(card);

    this.resolveCard(card, () => {
      b.locked = false;
      b.callbacks.onHandUpdated && b.callbacks.onHandUpdated(b.hand, b.actionPoints, b.maxActionPoints);

      if (this.checkAllEnemiesDead()) { this.finish("win"); return; }
      if (b.player.currentHp <= 0) { this.finish("dead"); return; }
    });

    return true;
  },

  // カード1枚ぶんの効果を解決する（ダメージ・回復・ドロー等）。doneはアニメーション完了後に呼ぶ。
  resolveCard(card, done) {
    const b = this.current;
    if (!b) return;
    const api = this.buildApi();
    const isAttackCard = !!(card.hits || CardEffectSystem.DAMAGE_CONDITION_HANDLERS[card.effectId]);

    // COMBOタグ判定用に「直前のカードのタグ」を先に確定し、あとで更新する
    const prevTags = b.battleState.lastCardTags || [];

    const applyPost = (ctx) => {
      const handler = CardEffectSystem.BATTLE_CARD_HANDLERS[card.effectId];
      if (handler && this.isPostEffect(card.effectId)) handler(b.player, b.battleState, card, api, ctx);
    };
    const applyPre = () => {
      const handler = CardEffectSystem.BATTLE_CARD_HANDLERS[card.effectId];
      if (handler && !this.isPostEffect(card.effectId)) handler(b.player, b.battleState, card, api);
    };

    applyPre();

    const finalizeTags = () => {
      b.battleState.lastCardTags = card.tags || [];
      b.battleState.isFirstCardPlayed = true;
    };

    if (card.hits) {
      this.resolveHits(card, card.hits, () => { finalizeTags(); this.afterCardResolved(card, isAttackCard, done); });
    } else if (CardEffectSystem.DAMAGE_CONDITION_HANDLERS[card.effectId]) {
      const target = this.getPrimaryTarget();
      if (!target) { finalizeTags(); this.afterCardResolved(card, isAttackCard, done); return; }
      const condResult = CardEffectSystem.DAMAGE_CONDITION_HANDLERS[card.effectId](b.player, target, card, b.battleState);
      const hit = { percent: condResult.percent, damageType: condResult.damageType };
      this.resolveHits(card, [hit], () => {
        if (condResult.bonusGoldIfRare) api.addBattleGold(condResult.bonusGoldIfRare);
        finalizeTags();
        this.afterCardResolved(card, isAttackCard, done);
      });
    } else {
      // ダメージを伴わないカード（回復・ドロー・バフ等）
      finalizeTags();
      this.afterCardResolved(card, isAttackCard, done);
    }

    // ダメージ確定後に呼ぶpost処理はresolveHits内のonHitDoneから呼ばれるctxで処理する
    this._pendingPostApply = applyPost;
  },

  afterCardResolved(card, isAttackCard, done) {
    const b = this.current;
    if (!b) return;
    const api = this.buildApi();
    const damageType = (card.hits && card.hits[0] && card.hits[0].damageType) || null;
    // 血晶の杖等：魔法カード使用時にHPを消費する装備効果
    if (damageType === "magic" && b.player.equipMagicCardHpCost) {
      const cost = Math.max(1, Math.round(b.player.maxHp * b.player.equipMagicCardHpCost));
      api.damageSelf(cost);
    }
    CardEffectSystem.triggerTraits(b.bossPassives, "onCardUsed", b.player, b.battleState, api, {
      card, isAttackCard, damageType,
    });
    setTimeout(done, CONFIG.BATTLE_PER_HIT_DELAY_MS);
  },

  // 特性のonCardUsedで「もう一度発動」が来た時に、直前のカード効果を再現する（不退転用の簡易実装）
  replayLastCardEffect() {
    // 簡易実装：直前に使ったカードをdiscardPileの末尾から参照して再解決する
    const b = this.current;
    if (!b) return;
    const card = b.discardPile[b.discardPile.length - 1];
    if (!card) return;
    this.resolveCard(card, () => {});
  },

  isPostEffect(effectId) {
    return ["bonus_gold_on_kill", "death_explosion", "lifesteal_from_hit", "pierce_excess_damage", "stack_damage_on_kill_battle"].includes(effectId);
  },

  // hits配列を順番に解決する（AOE/連鎖/多段ヒットに対応）
  resolveHits(card, hits, done) {
    const b = this.current;
    if (!b) return;
    const api = this.buildApi();
    let totalDamage = 0;
    let anyKilled = false;
    let lastKilledEnemy = null;
    let lastOverkill = 0;

    const playHitList = (hitList, onAllDone) => {
      let i = 0;
      const next = () => {
        if (i >= hitList.length) { onAllDone(); return; }
        const { hit, target } = hitList[i];
        i += 1;
        this.applyOneHit(card, hit, (ctx) => {
          totalDamage += ctx.totalDamage || 0;
          if (ctx.killed) { anyKilled = true; lastKilledEnemy = ctx.enemy; lastOverkill = ctx.overkill || 0; }
          setTimeout(next, CONFIG.BATTLE_PER_HIT_DELAY_MS);
        }, target);
      };
      next();
    };

    // hitsをtargetsに応じて実際の(hit,対象)組に展開する。
    // AOEは「今アクティブな生存中の敵それぞれ」を展開時点で確定させることで、
    // 同じ相手を倒すまで連続で殴り続けてしまう不具合を防ぐ（1体ずつ確実に1回当たる）。
    const expanded = [];
    hits.forEach((hit) => {
      if (hit.targets === "all") {
        this.getAliveEnemies().forEach((enemy) => expanded.push({ hit, target: enemy }));
      } else {
        expanded.push({ hit }); // single/chainは1体ずつapplyOneHit内で解決
      }
    });

    // 多重詠唱：次の魔法カードの効果を2回発動
    let finalHits = expanded;
    if (b.battleState.doubleNextSpell && card.tags && !card.tags.includes("MULTI")) {
      finalHits = expanded.concat(expanded);
      b.battleState.doubleNextSpell = false;
    }

    playHitList(finalHits, () => {
      if (this._pendingPostApply) {
        this._pendingPostApply({ totalDamage, killed: anyKilled, enemy: lastKilledEnemy, overkill: lastOverkill });
        this._pendingPostApply = null;
      }
      done();
    });
  },

  // 1ヒットぶんを実際の対象に適用する。
  // explicitTargetが指定されていればそれを使う（AOE展開済み分）。
  // 指定が無ければ、chain=連鎖の次の生存敵、それ以外=選択中の対象（getPrimaryTarget）。
  applyOneHit(card, hit, done, explicitTarget) {
    const b = this.current;
    if (!b) { done({ totalDamage: 0, killed: false }); return; }
    const api = this.buildApi();
    const alive = this.getAliveEnemies();
    if (alive.length === 0) { done({ totalDamage: 0, killed: false }); return; }

    let target;
    if (explicitTarget && explicitTarget.hp > 0) {
      target = explicitTarget;
    } else if (hit.targets === "chain") {
      target = alive[Math.min(this._chainIndex || 0, alive.length - 1)];
      this._chainIndex = (this._chainIndex || 0) + 1;
      if (target === undefined) { done({ totalDamage: 0, killed: false }); return; }
    } else {
      target = this.getPrimaryTarget();
    }

    CardEffectSystem.triggerTraits(b.bossPassives, "onAttack", b.player, b.battleState, api, { card, hit, aliveCount: alive.length, target });

    const result = CardEffectSystem.calculateHitDamage(b.player, target, hit, b.battleState, alive);
    let damage = result.damage;
    if (target.strongId === "strong" && b.player.bossStrongDamageMult) damage = Math.round(damage * b.player.bossStrongDamageMult);
    if (b.battleState.demonBladeActive) damage = Math.round(damage * 2);
    if (b.battleState.swarmMagicActive && hit.targets === "all") damage = Math.round(damage * 1.75);
    if (b.battleState.tagDamageBonusPercent) { damage = Math.round(damage * (1 + b.battleState.tagDamageBonusPercent)); b.battleState.tagDamageBonusPercent = 0; }
    if (b.battleState.singleHitCardMult) { damage = Math.round(damage * b.battleState.singleHitCardMult); b.battleState.singleHitCardMult = 0; }
    if (b.battleState.highCostCardMult) { damage = Math.round(damage * b.battleState.highCostCardMult); b.battleState.highCostCardMult = 0; }
    if (b.battleState.goldScaledMagicPercent) damage = Math.round(damage * (1 + b.battleState.goldScaledMagicPercent));
    if (b.battleState.forbiddenArtX2Active && (hit.damageType || (b.player.classType === "MAGE" ? "magic" : "physical")) === "magic") {
      damage = Math.round(damage * 2);
    }
    if (b.battleState.pendingDamageCarryOver) { damage += b.battleState.pendingDamageCarryOver; b.battleState.pendingDamageCarryOver = 0; }
    // 装備：多段カード/単発カードへのダメージ補正（カードのhits数で判定する）
    if (card.hits && card.hits.length > 1 && b.player.equipMultiHitRate) damage = Math.round(damage * (1 + b.player.equipMultiHitRate));
    if (card.hits && card.hits.length === 1 && b.player.equipSingleHitCardRate) damage = Math.round(damage * (1 + b.player.equipSingleHitCardRate));

    const wasFullHp = target.hp === target.maxHp;
    const overkill = Math.max(0, damage - target.hp);
    target.hp = Math.max(0, target.hp - damage);

    b.callbacks.onAttackHit && b.callbacks.onAttackHit(target, damage, result.isCritical);

    let killed = false;
    if (target.hp <= 0 && !target.defeated) {
      target.defeated = true;
      killed = true;
      const oneShot = wasFullHp;
      let reward = target.reward;
      if (target.rarityId === "rare" || target.rarityId === "legendary") reward = Math.round(reward * (1 + (b.battleState.battleRareRewardBonus || 0)));
      CardEffectSystem.triggerTraits(b.bossPassives, "onEnemyKilled", b.player, b.battleState, api);
      if (b.player.equipLifestealOnKillPercent) api.heal(Math.round(b.player.maxHp * b.player.equipLifestealOnKillPercent));
      b.battleState.killsThisBattle += 1;
      setTimeout(() => {
        b.callbacks.onEnemyDefeated && b.callbacks.onEnemyDefeated(target, reward, oneShot);
      }, CONFIG.BATTLE_DEFEAT_PAUSE_MS);
    }

    done({ totalDamage: damage, killed, enemy: target, overkill: killed ? overkill : 0 });
  },

  getAliveEnemies() {
    // 戦闘が終わった直後に遅延コールバックから呼ばれることがあるため、
    // currentがnullの場合は空配列を返す（クラッシュさせない）。
    if (!this.current) return [];
    return (this.current.enemies || []).filter((e) => e.hp > 0);
  },
  checkAllEnemiesDead() {
    return this.getAliveEnemies().length === 0;
  },

  // 敵が複数いる場合の対象選択。プレイヤーが明示的に選んだ敵を優先し、
  // それが既に倒れていれば先頭の生存中の敵にフォールバックする。
  selectTarget(slotIndex) {
    const b = this.current;
    if (!b || b.locked || b.ended) return;
    const target = b.enemies.find((e) => e.slotIndex === slotIndex);
    if (target && target.hp > 0) {
      b.selectedTargetSlot = slotIndex;
      b.callbacks.onTargetSelected && b.callbacks.onTargetSelected(slotIndex);
    }
  },

  // 単体対象カードが実際に狙う敵を1体返す（選択中の対象が生存していればそれ、
  // でなければ先頭の生存中の敵）。
  getPrimaryTarget() {
    const b = this.current;
    const alive = this.getAliveEnemies();
    if (alive.length === 0) return null;
    const selected = alive.find((e) => e.slotIndex === b.selectedTargetSlot);
    return selected || alive[0];
  },

  // 残りACTIONを破棄してENEMY TURNへ
  endTurn() {
    const b = this.current;
    if (!b || b.ended || b.locked) return;
    b.locked = true;
    b.actionPoints = 0;
    this._chainIndex = 0;
    setTimeout(() => this.enemyTurn(), CONFIG.BATTLE_PER_HIT_DELAY_MS);
  },

  enemyTurn() {
    const b = this.current;
    if (!b) return;
    const alive = this.getAliveEnemies();
    if (alive.length === 0) { this.finish("win"); return; }

    let i = 0;
    const api = this.buildApi();
    const next = () => {
      if (i >= alive.length) {
        // 次ターン限定バフはここでクリア
        b.battleState.nextTurnEvasionBonus = 0;
        b.battleState.nextTurnDamageReduction = 0;
        b.battleState.nextTurnCounterPercent = 0;
        // ロックはここでは解除しない。startPlayerTurn()が新しい手札を
        // 準備し終えるまでは、endTurn/playCardを受け付けないようにする
        // （このタイミングで解除すると、間隙を突いてendTurn()が二重に
        // 呼ばれ、戦闘状態が壊れる不具合があったため）。
        setTimeout(() => this.startPlayerTurn(), CONFIG.BATTLE_PER_HIT_DELAY_MS);
        return;
      }
      const enemy = alive[i];
      i += 1;

      const result = CardEffectSystem.calculateEnemyDamage(b.player, enemy, b.battleState);
      if (!result.evaded) {
        b.player.currentHp = Math.max(0, b.player.currentHp - result.damage);
      }
      b.callbacks.onEnemyAttack && b.callbacks.onEnemyAttack(enemy, result.damage, b.player.currentHp, result.evaded);
      CardEffectSystem.triggerTraits(b.bossPassives, "onDamageTaken", b.player, b.battleState, api);

      // 反撃の構え
      if (!result.evaded && b.battleState.nextTurnCounterPercent) {
        const counterHit = { percent: b.battleState.nextTurnCounterPercent, damageType: "physical" };
        this.applyOneHit({ tags: [] }, counterHit, () => {});
      }

      if (b.player.currentHp <= 0) {
        b.callbacks.onPlayerDown && b.callbacks.onPlayerDown();
        setTimeout(() => this.finish("dead"), CONFIG.BATTLE_DEFEAT_PAUSE_MS);
        return;
      }

      setTimeout(next, CONFIG.BATTLE_ENEMY_TURN_DELAY_MS);
    };
    next();
  },

  finish(result) {
    const b = this.current;
    if (!b || b.ended) return;
    b.ended = true;

    const api = this.buildApi();
    CardEffectSystem.triggerTraits(b.bossPassives, "onBattleEnd", b.player, b.battleState, api);

    // 再生衣：戦闘終了時（勝敗問わず）HP回復
    if (b.player.equipBattleEndHealPercent && b.player.currentHp > 0) {
      api.heal(Math.round(b.player.maxHp * b.player.equipBattleEndHealPercent));
    }
    // 生還のお守り：HPが一定以下で戦闘を終えた場合に追加回復
    if (b.player.equipLowHpBattleEndHeal && b.player.currentHp > 0 && b.player.currentHp / b.player.maxHp <= b.player.equipLowHpBattleEndHeal.threshold) {
      api.heal(Math.round(b.player.maxHp * b.player.equipLowHpBattleEndHeal.percent));
    }

    if (!b.player.momentumCarryOver) b.battleState.momentum = 0;

    b.callbacks.onBattleEnd && b.callbacks.onBattleEnd(result, b.battleState);
    const resolve = b.resolve;
    this.current = null;
    resolve({ result, battleState: b.battleState });
  },

  // ---------------------------------------------------------
  // カード効果ハンドラから呼び出す共通API
  // ---------------------------------------------------------
  buildApi() {
    const b = this.current;
    if (!b) {
      // 戦闘終了後に遅延実行された効果が呼んだ場合は、何もしないダミーAPIを返す
      const noop = () => {};
      return { heal: noop, damageSelf: noop, draw: noop, addCardToHand: noop, gainAction: noop, addBattleGold: noop, dealDamageToOthers: noop, replayLastCardEffect: noop };
    }
    return {
      heal: (amount) => {
        const penalty = b.battleState.healPenalty || 0;
        const finalAmount = Math.max(0, Math.round(amount * (1 - penalty)));
        b.player.currentHp = Math.min(b.player.maxHp, b.player.currentHp + finalAmount);
        b.callbacks.onPlayerHealed && b.callbacks.onPlayerHealed(finalAmount);
      },
      damageSelf: (amount) => {
        b.player.currentHp = Math.max(1, b.player.currentHp - amount);
        b.callbacks.onPlayerDamaged && b.callbacks.onPlayerDamaged(amount);
      },
      draw: (count) => { this.drawHand(count); b.callbacks.onHandUpdated && b.callbacks.onHandUpdated(b.hand, b.actionPoints, b.maxActionPoints); },
      // 無限詠唱など、指定したカードそのものを直接手札へ加える（山札を消費しない）
      addCardToHand: (card) => {
        b.hand.push(Object.assign({}, card));
        b.callbacks.onHandUpdated && b.callbacks.onHandUpdated(b.hand, b.actionPoints, b.maxActionPoints);
      },
      gainAction: (amount) => { b.actionPoints += amount; },
      addBattleGold: (amount) => { b.battleState.extraGoldThisBattle = (b.battleState.extraGoldThisBattle || 0) + amount; },
      // percentが指定されていれば「対象の攻撃力に対する割合ダメージ」、
      // flatAmountが指定されていれば「そのままの数値のダメージ」を、
      // excludeEnemy以外の生存中の敵全員に与える（爆裂魔法・貫通斬りで使用）。
      dealDamageToOthers: (excludeEnemy, percent, damageType, flatAmount) => {
        const alive = this.getAliveEnemies().filter((e) => e !== excludeEnemy);
        if (alive.length === 0) return;
        if (flatAmount != null) {
          const target = alive[0];
          target.hp = Math.max(0, target.hp - flatAmount);
          b.callbacks.onAttackHit && b.callbacks.onAttackHit(target, flatAmount, false);
          if (target.hp <= 0 && !target.defeated) {
            target.defeated = true;
            b.callbacks.onEnemyDefeated && b.callbacks.onEnemyDefeated(target, target.reward, false);
          }
          return;
        }
        alive.forEach((enemy) => {
          const hit = { percent, damageType: damageType || "magic" };
          this.applyOneHit({ tags: [] }, hit, () => {});
        });
      },
      replayLastCardEffect: () => this.replayLastCardEffect(),
    };
  },
};
