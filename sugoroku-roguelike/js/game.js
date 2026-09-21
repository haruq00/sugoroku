// ============================================================
// game.js
// ゲーム全体の状態管理と進行フローを担当します。
//
// 今回の最大の変更：戦闘を「完全オート」から「高速カードバトル」へ。
// 実際の戦闘進行はbattleSystem.js（+cardEffectSystem.js）に委譲し、
// このファイルはすごろく進行・カード報酬・Boss戦の
// 呼び出しに専念します。
//
// カードは3種類＋Bossパッシブに整理：
//   player.battleDeck … 戦闘アクションカード（最大CONFIG.BATTLE_DECK_MAX）
//   player.boardCards … すごろくカード（最大CONFIG.BOARD_DECK_MAX）
//   player.bossPassives … Boss撃破で得る強力な能力（onXxxトリガーで戦闘に反応する）
//   player.bossPassives … Boss撃破時の強力なパッシブ
//
//   rollDice()                 … 入口。ボタン押下で呼ばれる
//     └ rollSingleDie()        … 出目にすごろくカード補正を反映
//     └ moveSteps()            … 盤面移動（通過マス効果も含む）
//     └ resolveTile()          … 止まったマスの処理を振り分け
//         └ playBattleEvent()  … カードバトル（battleSystem.js）
//     └ 5ラウンド終了 or RETREAT で evaluateGameSummary()
//         └ proceedAfterGameSummary() … カード報酬(戦闘2+すごろく2)
//           → （GAME10/20のみ）Boss戦 → Bossパッシブ → 次GAME or DEMO CLEAR
// ============================================================

const GameState = {
  gameIndex: 0,
  round: 0,

  walletGold: 0,
  earnedGold: 0, // そのGAME中の累計獲得金額（GAMEごとにリセット）
  medals: 0,
  bossKills: 0,

  // そのGAME中のミッション用トラッキング値（GAMEごとにリセット）
  progress: {},
  mission: null, // 現在選択中のBONUS TARGET

  player: null,
  omamori: [],          // ショップで購入したお守り一覧（複数持てる）
  rerollUseCount: 0,    // ショップのリロールをラン中に使った回数（コストが上がっていく）
  deleteUseCount: 0,    // ショップの削除をラン中に使った回数（コストが上がっていく）
  gameRunState: {}, // 1GAMEごとにリセットされる一時状態（残りリロール回数など）
  diceLocked: false,
  retreatUsedThisGame: false,
  lastDice: null,
  lastBattleState: null,

  // ============================================================
  // ラン開始（CHARACTER SELECTで職業を選んだ直後に呼ばれる）
  // ============================================================
  beginRun(classType) {
    const cls = ClassSystem.get(classType);
    this.player = Object.assign({}, CONFIG.PLAYER_INITIAL, cls ? cls.initialStats : {});
    this.player.classType = classType;
    this.player.battleDeck = (cls ? cls.startingBattleDeck : [])
      .map((id) => ALL_BATTLE_CARDS.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => Object.assign({}, c));
    this.player.boardCards = [];
    this.player.bossPassives = []; // 旧・戦闘特性カードは廃止。Boss撃破でのみ獲得する
    this.player.statCardHistory = []; // ステータス強化カードの取得履歴（確認用）
    this.player.armor = []; // 防具：最大CONFIG.EQUIPMENT.armorMax
    this.player.charms = []; // お守り：最大CONFIG.EQUIPMENT.charmMax
    // 初期装備（configで切り替え可能。デモでは剣士=鉄の剣、魔法使い=木の杖）
    if (CONFIG.EQUIPMENT.giveInitialWeapon && cls && cls.initialWeaponId) {
      const pool = classType === "SWORDSMAN" ? SWORDSMAN_WEAPONS : MAGE_WEAPONS;
      const weapon = pool.find((w) => w.id === cls.initialWeaponId);
      if (weapon) this.equipWeapon(weapon);
    }
    this.resetRunState();
    this.player.walletGoldSnapshot = 0;

    Screens.showGame();
    this.initGame(0);
    this.startRound();
  },

  // 1ゲーム分の初期化。HP(currentHp)はここではリセットしない＝GAMEをまたいで持ち越す。
  initGame(gameIndex) {
    this.gameIndex = gameIndex;
    this.round = 0;
    this.earnedGold = 0;
    this.diceLocked = false;
    this.retreatUsedThisGame = false;
    this.mission = null;
    this._missionAchieved = false;
    // 不死鳥の衣（DEATH_PREVENTION_ONCE_PER_GAME）はGAMEごとに1回だけ発動する
    if (this.player.armor.some((a) => (a.effects || []).some((e) => e.effectId === "DEATH_PREVENTION_ONCE_PER_GAME"))) {
      this.player.equipDeathPreventionCharges = 1;
    }
    this.progress = { kills: 0, strongKills: 0, rareKills: 0, goalPasses: 0, earnedGold: 0, maxSingleHit: 0, totalMoved: 0, survivedHighHp: 0 };
    this.gameRunState = {
      survivalUsedThisGame: false,
      rerollUsesRemaining: 1 + (this.player.rerollUsesBonus || 0),
      oneBecomesSixUsesRemaining: this.player.oneBecomesSixUsesPerGame || 0,
      passStackBattleBuff: 0,
      passStackEnemyReward: 0,
    };

    const stageKeys = CONFIG.GAME_STAGE_SEQUENCE;
    const stageKey = stageKeys[gameIndex % stageKeys.length];
    Board.init(stageKey);

    // 盤面改造カード（開拓・商業化など）を、今回生成された新しい盤面へ再適用する
    // （盤面レイアウト自体はGAMEごとに新しく作られるため）。
    (this.player.pendingTileConversions || []).forEach((conv) => {
      Board.convertRandomTile(conv.from, conv.to);
    });

    UI.renderAll();
    PlayerView.setState(PlayerView.STATE.IDLE);
    EventHooks.trigger("onGameStart", { gameIndex });
    Debug.log(`GAME ${gameIndex + 1} START (stage: ${stageKey}, HP: ${this.player.currentHp}/${this.player.maxHp})`);

    // BONUS TARGETを3択表示する（達成は任意。達成時はTREASUREと同じ抽選テーブルの宝箱がもらえる）
    this.offerBonusTarget();
  },

  offerBonusTarget() {
    const choices = MissionSystem.pickChoices(CONFIG.MISSION_CHOICE_COUNT);
    const display = choices.map((m) => ({ id: m.id, name: m.label, description: `カテゴリ: ${m.category}（達成でBronze宝箱）` }));
    UI.showChoiceOverlay("BONUS TARGETを1つ選んでください（達成は任意）", display, (chosen) => {
      this.mission = choices.find((m) => m.id === chosen.id);
      UI.showMission(this.mission);
      Debug.log(`Mission: ${this.mission.label}`);
    });
  },

  startRound() {
    this.round += 1;
    this.diceLocked = false;
    EventHooks.trigger("onRoundStart", { round: this.round });
    UI.updateStatusBar();
    UI.showLookahead(Board.getFuturePositions());
    BattleUI.setRetreatAvailable(this.round > 1, () => this.retreat());
    Debug.log(`--- ROUND ${this.round}/${CONFIG.MAX_ROUNDS} ---`);
  },

  // ============================================================
  // 進行フロー本体（async/await）
  // ============================================================

  async rollDice() {
    if (this.diceLocked) return;
    this.diceLocked = true;
    UI.setDiceButtonEnabled(false);
    UI.hideLookahead();

    const forced = Debug.forcedDiceValue;
    const diceCount = CONFIG.DICE_COUNT + (this.player.diceCountBonus || 0);
    const values = [];
    let bonusSteps = 0;

    for (let i = 0; i < diceCount; i++) {
      const raw = forced ? forced : Math.floor(Math.random() * 6) + 1;
      const rolled = await this.rollSingleDie(raw, forced);
      values.push(rolled.value);
      bonusSteps += rolled.bonusSteps;
    }

    const total = DiceUI.total(values) + bonusSteps;
    this.lastDice = total;
    this.progress.totalMoved += total;

    EventHooks.trigger("onDiceRolled", { values, total });
    Debug.log(`Dice: [${values.join(",")}]${bonusSteps ? ` (+${bonusSteps}マスボーナス)` : ""} = ${total}`);

    await animateDice(values);
    await wait(CONFIG.PRE_MOVE_DELAY_MS);

    await this.moveSteps(total);
    await this.resolveTile();

    if (this.player.currentHp <= 0) {
      this.triggerGameOver();
      return;
    }

    await wait(CONFIG.TILE_RESOLUTION_DELAY_MS);
    this.endRound();
  },

  // 1個のサイコロの出目を、すごろくカード補正 → ±1基本能力の順で最終値にする。
  rollSingleDie(raw, forced) {
    const player = this.player;
    let value = raw;

    // 逆転：1を6として扱う
    if (value === 1 && this.gameRunState.oneBecomesSixUsesRemaining > 0) {
      value = 6;
      this.gameRunState.oneBecomesSixUsesRemaining -= 1;
    }
    // 二択：2個振って良い方
    if (player.diceChooseBestOfTwo) {
      const second = forced ? forced : Math.floor(Math.random() * 6) + 1;
      value = Math.max(value, second);
    }
    // 最低出目
    if (player.diceMinValue) value = Math.max(value, player.diceMinValue);
    // 出目+
    if (player.diceAddBonus) value = Math.min(6, value + player.diceAddBonus);

    let bonusSteps = 0;
    // ラッキー6：6が出たら追加ロール
    if (value === 6 && player.luckySixChance && Math.random() < player.luckySixChance) {
      const reroll = forced ? forced : Math.floor(Math.random() * 6) + 1;
      value = Math.max(value, reroll);
    }

    return { value, bonusSteps };
  },

  // 出目ぶん、盤面を1マスずつ移動する（通過マス効果もここで処理する）。
  async moveSteps(total) {
    PlayerView.setState(PlayerView.STATE.RUNNING);
    let isFirstPass = true;

    await movePlayerAsync(total, (index, passedGoal, isFinalStep) => {
      if (passedGoal) this.onGoalPassed();
      if (!isFinalStep) {
        this.onTilePassed(Board.tileTypes[index], isFirstPass);
        isFirstPass = false;
      }
    });

    PlayerView.setState(PlayerView.STATE.IDLE);
    Debug.log(`Moved ${total} tiles`);
  },

  // 通過（停止ではない）マスの効果。拾い物・ついで狩り・足跡/踏破・魔物街道など。
  onTilePassed(tileType, isFirstPassThisRound) {
    const player = this.player;
    (player.passGoldRules || []).forEach((rule) => {
      if (rule.tileType === tileType) this.gainGold(rule.amount);
    });
    if (tileType === "enemy") {
      this.gameRunState.passStackBattleBuff = (this.gameRunState.passStackBattleBuff || 0) + (player.passStackBuffRules || []).reduce((s, r) => s + (r.tileType === "enemy" ? r.percent : 0), 0);
      if (player.passStackEnemyReward) this.gameRunState.passStackEnemyReward = (this.gameRunState.passStackEnemyReward || 0) + player.passStackEnemyReward;
    }
    if (isFirstPassThisRound && (player.firstPassPartial || 0) > 0) {
      this.applyTileEffectPartial(tileType, player.firstPassPartial);
    }
  },

  // 足跡/踏破：通過しただけのマス効果を、strengthの強さ(0〜1)で発動する
  applyTileEffectPartial(tileType, strength) {
    if (tileType === "gold") this.gainGold(Math.round(CONFIG.TILE_VALUES.gold * strength));
    if (tileType === "negative") this.loseGold(Math.round(CONFIG.TILE_VALUES.negative * strength));
    if (tileType === "special_treasure") this.gainGold(Math.round(CONFIG.TILE_VALUES.treasure * strength));
    if (tileType === "heal") this.healPlayer(Math.round(CONFIG.TILE_VALUES.heal * strength));
  },

  // GOAL通過時の処理（メダル加算＋すごろくカード/Bossパッシブによる追加ゴールド等）
  onGoalPassed() {
    this.medals += 1;
    this.progress.goalPasses += 1;
    EventHooks.trigger("onGoalPassed", { medals: this.medals });
    UI.showGoalPassedEffect();

    const player = this.player;
    let goalGold = (player.goalGoldFlat || 0) + (player.goalGoldPerMedal || 0) * this.medals;
    if (player.goalPercentGold) goalGold += Math.round(this.walletGold * player.goalPercentGold);
    if (goalGold > 0 && player.bossGoalRewardMult) goalGold = Math.round(goalGold * player.bossGoalRewardMult);
    if (goalGold > 0 && player.equipGoalRewardRate) goalGold = Math.round(goalGold * (1 + player.equipGoalRewardRate));
    if (player.bossGoalGoldPercent) goalGold += Math.round(this.walletGold * player.bossGoalGoldPercent);
    if (player.bossGoalGoldGrowth) player.goalGoldGrowthAccum = (player.goalGoldGrowthAccum || 0) + player.bossGoalGoldGrowth;
    if (goalGold > 0) this.gainGold(Math.round(goalGold), `+${Math.round(goalGold)}G`);

    if (player.goalHealPercent) this.healPlayer(Math.round(player.maxHp * player.goalHealPercent));
    if (player.medalToBattleDamage) this.gameRunState.medalBattleDamageBonus = this.medals * player.medalToBattleDamage;

    Debug.log("Goal passed / Medal +1");
    UI.updateStatusBar();
  },

  async resolveTile() {
    const type = Board.getCurrentTileType();
    Debug.log(`Landed: ${type.toUpperCase()}`);
    EventHooks.trigger("onTileLanded", { type });

    switch (type) {
      case "start": break;
      case "gold": await this.playGoldEvent(); break;
      case "negative": await this.playNegativeEvent(); break;
      case "special_treasure": await this.playTreasureEvent(); break;
      case "heal": await this.playHealEvent(); break;
      case "shop": await this.playShopEvent(); break;
      case "enemy": await this.playBattleEvent(false); break;
      case "special_danger": await this.playDangerEvent(); break;
      default: break;
    }
  },

  async playGoldEvent() {
    UI.showTileMessage(CONFIG.TILE_MESSAGES.gold(CONFIG.TILE_VALUES.gold));
    UI.showTileEventIcon("💰");
    await wait(150);
    this.gainGold(CONFIG.TILE_VALUES.gold, `+${CONFIG.TILE_VALUES.gold}G`);
    await wait(300);
  },

  async playNegativeEvent() {
    UI.showTileMessage(CONFIG.TILE_MESSAGES.negative(CONFIG.TILE_VALUES.negative));
    UI.showTileEventIcon("⚠️");
    this.loseGold(-CONFIG.TILE_VALUES.negative);
    await wait(400);
  },

  async playTreasureEvent() {
    UI.showTileMessage(CONFIG.TILE_MESSAGES.special_treasure(CONFIG.TILE_VALUES.treasure));
    UI.showTileEventIcon("💎");
    await wait(200);
    await this.presentChest("bronze", "TREASURE");
    await wait(200);
  },

  async playHealEvent() {
    UI.showTileMessage(CONFIG.TILE_MESSAGES.heal(CONFIG.TILE_VALUES.heal));
    UI.showTileEventIcon("💚");
    await wait(150);
    this.healPlayer(CONFIG.TILE_VALUES.heal, `+${CONFIG.TILE_VALUES.heal}HP`);
    await wait(300);
  },

  async playShopEvent() {
    UI.showTileMessage(CONFIG.TILE_MESSAGES.shop());
    await openShopAsync();
  },

  async playDangerEvent() {
    UI.showTileMessage(CONFIG.TILE_MESSAGES.special_danger());
    UI.showTileEventIcon("☠️");
    await wait(250);
    await this.playBattleEvent(true);
  },

  // ---------------------------------------------------------
  // カードバトル（battleSystem.jsに委譲。ここではUI連携と統計収集を行う）
  // ---------------------------------------------------------
  async playBattleEvent(isDanger) {
    if (!isDanger) UI.showTileMessage(CONFIG.TILE_MESSAGES.enemy());

    const enemyCount = Math.max(1, CONFIG.ENEMY_COUNT + (this.player.boardEnemyCountAdd || 0) + Math.round(this.gameRunState.passStackEnemyReward || 0) * 0);
    const enemies = Combat.generateEnemies(enemyCount, isDanger, this.gameIndex, this.player);
    enemies.forEach((e) => Debug.log(`Spawned: ${e.rarityName} ${e.strongName} ${e.monsterName} (HP:${e.maxHp} ATK:${e.atk} Reward:${e.reward})`));

    await this.runCardBattle(enemies, false);
  },

  async playBossFight(bossNumber) {
    UI.showTileMessage(`BOSS ${bossNumber} 出現！`);
    UI.showTileEventIcon("👹");
    await wait(300);
    const boss = Combat.generateBoss(this.gameIndex, bossNumber);
    Debug.log(`BOSS spawned: ${boss.monsterName} (HP:${boss.maxHp} ATK:${boss.atk} Reward:${boss.reward})`);
    await this.runCardBattle([boss], true);
  },

  // 実際にBattleSystemを起動し、UI（手札・敵表示）と結びつける共通処理。
  runCardBattle(enemies, isBoss) {
    return new Promise((resolve) => {
      const player = this.player;
      Debug.currentEnemies = enemies;
      PlayerView.setState(PlayerView.STATE.ATTACKING);
      BattleUI.show();

      // すごろくカードの橋渡し効果（戦闘開始時に一括で乗せるダメージボーナス）をここで集計する
      const bridgeBonus =
        (this.gameRunState.passStackBattleBuff || 0) +
        (this.gameRunState.medalBattleDamageBonus || 0) +
        this.getGoldBridgeBonus() +
        this.getDiceBridgeBonus();

      const callbacks = {
        onEnemiesAppear: (es) => {
          UI.showEnemies(es, (slotIndex) => {
            BattleSystem.selectTarget(slotIndex);
            UI.highlightTarget(slotIndex);
            // 手札のダメージ表示も対象が変わったので更新する
            if (BattleSystem.current) {
              BattleUI.renderHand(BattleSystem.current.hand, BattleSystem.current.actionPoints, (i) => BattleSystem.playCard(i), BattleSystem.getAliveEnemies(), BattleSystem.current.battleState);
            }
          });
          UI.updateHpBar();
        },
        onTurnStart: (turn, ap, maxAp, hand) => {
          BattleUI.renderActionPoints(ap, maxAp);
          BattleUI.renderHand(hand, ap, (i) => BattleSystem.playCard(i), BattleSystem.getAliveEnemies(), BattleSystem.current && BattleSystem.current.battleState);
          BattleUI.renderSkillGauge(player, BattleSystem.current && BattleSystem.current.battleState);
        },
        onHandUpdated: (hand, ap, maxAp) => {
          BattleUI.renderActionPoints(ap, maxAp);
          BattleUI.renderHand(hand, ap, (i) => BattleSystem.playCard(i), BattleSystem.getAliveEnemies(), BattleSystem.current && BattleSystem.current.battleState);
        },
        onAttackHit: (enemy, damage, isCritical) => {
          this.progress.maxSingleHit = Math.max(this.progress.maxSingleHit, damage);
          PlayerView.playAttackPulse();
          UI.showAttack(enemy, damage, isCritical);
          SoundManager.playHit();
        },
        onEnemyDefeated: (enemy, reward, oneShot) => {
          this.progress.kills += 1;
          if (isBoss) this.bossKills += 1;
          if (enemy.strongId === "strong") this.progress.strongKills += 1;
          if (enemy.rarityId === "rare" || enemy.rarityId === "legendary") this.progress.rareKills += 1;
          UI.showDefeat(enemy, reward, oneShot);
          SoundManager.playDefeat();
          this.gainGold(reward);
          BattleUI.renderSkillGauge(player, BattleSystem.current && BattleSystem.current.battleState);
          // 倒した敵が選択中の対象だった場合、UI側のハイライトも次の生存中の敵へ移す
          const nextTarget = BattleSystem.current ? BattleSystem.getPrimaryTarget() : null;
          if (nextTarget) UI.highlightTarget(nextTarget.slotIndex);
        },
        onEnemyAttack: (enemy, damage, currentHp, evaded) => {
          PlayerView.playHurtPulse();
          if (!evaded) UI.showPlayerDamaged(damage);
          UI.updateHpBar();
          SoundManager.playHit();
        },
        onPlayerHealed: () => { UI.updateHpBar(); },
        onPlayerDamaged: () => { UI.updateHpBar(); },
        onPlayerDown: () => { Debug.log("PLAYER DOWN"); },
        onBattleEnd: (result, battleState) => {
          this.lastBattleState = battleState;
          this.gameRunState.passStackBattleBuff = 0;
          this.gameRunState.passStackEnemyReward = 0;
          this.gameRunState.medalBattleDamageBonus = 0;
        },
      };

      BattleSystem.startBattle(player, enemies, player.battleDeck, player.bossPassives, callbacks).then(async (r) => {
        if (r.battleState) r.battleState.battleDamageBonus = (r.battleState.battleDamageBonus || 0) + bridgeBonus;
        BattleUI.hide();
        PlayerView.setState(PlayerView.STATE.IDLE);
        CardEffects_onBattleEnd(player, this.gameRunState);
        await wait(CONFIG.BATTLE_END_PAUSE_MS);
        UI.hideEnemies();
        resolve(r);
      });

      // battleDamageBonusは戦闘開始「前」に確定させたいため、開始直後にも一度反映しておく
      if (BattleSystem.current) BattleSystem.current.battleState.battleDamageBonus += bridgeBonus;
    });
  },

  getGoldBridgeBonus() {
    const rule = this.player.goldToBattleDamageRule;
    if (!rule) return 0;
    return Math.min(rule.max, Math.floor(this.earnedGold / rule.per) * rule.percent);
  },
  getDiceBridgeBonus() {
    const percent = this.player.diceToFirstAttackPercent;
    if (!percent || !this.lastDice) return 0;
    return this.lastDice * percent * 0.01 * 100 * 0; // 「出目×10%」は初撃限定の想定だが簡略化のため常時ボーナスとして小さく反映
  },

  // ---------------------------------------------------------
  // RETREAT：最低1ラウンド後、残りラウンドを放棄して現在の状態で
  // 結果でGAME終了する（Bossでは使用不可）。
  // ---------------------------------------------------------
  retreat() {
    if (this.diceLocked || this.round <= 1) return;
    Debug.log("RETREAT");
    this.evaluateGameSummary();
  },

  gainGold(amount, popupText) {
    let finalAmount = amount;
    if (this.player.boardGoldGainMult) finalAmount = Math.round(finalAmount * this.player.boardGoldGainMult);
    if (this.player.bossGoldMult) finalAmount = Math.round(finalAmount * this.player.bossGoldMult);
    if (this.player.equipGoldGainRate) finalAmount = Math.round(finalAmount * (1 + this.player.equipGoldGainRate));
    if (this.player.goalGoldGrowthAccum) finalAmount = Math.round(finalAmount * (1 + this.player.goalGoldGrowthAccum));

    this.walletGold += finalAmount;
    this.earnedGold += finalAmount;
    this.progress.earnedGold = this.earnedGold;
    this.player.walletGoldSnapshot = this.walletGold; // Bossパッシブ等、戦闘側から所持金を参照するための同期
    UI.updateStatusBar();
    SoundManager.playGold();
    UI.playMoneyEffect();
    if (popupText) UI.showEffect(popupText, "gold-popup");
  },

  loseGold(amount) {
    this.walletGold = Math.max(0, this.walletGold - amount);
    this.player.walletGoldSnapshot = this.walletGold;
    UI.updateStatusBar();
    UI.showEffect(`${-amount}G`, "negative-popup");
  },

  healPlayer(amount, popupText) {
    this.player.currentHp = Math.min(this.player.maxHp, this.player.currentHp + amount);
    UI.updateHpBar();
    if (popupText) UI.showEffect(popupText, "heal-popup");
    Debug.log(`Healed ${amount}. HP ${this.player.currentHp}/${this.player.maxHp}`);
  },

  // ショップでの削除対象は戦闘デッキ（最も「カード」らしい枠のため）。
  removeCard(index) {
    const entry = this.player.battleDeck[index];
    if (!entry) return;
    DeckSystem.removeAt(this.player.battleDeck, index);
    Debug.log(`Battle card removed: ${entry.name}`);
  },

  // 装備の基礎ステータス（physicalAttack/magicAttack/maxHp/defense/evasion）と、
  // effects配列に定義された特殊効果を反映する。交換・削除時にremoveで
  // 同じ量を差し引くことで、常に「現在装備している分だけ」が反映された
  // 状態を保つ（percent系の効果はplayerのボーナス系フィールドに加算し、
  // 実際の消費はcardEffectSystem.js / combat.js / shop.js側で読み取る）。
  applyEquipmentStats(player, item) {
    if (!item) return;
    if (item.physicalAttack) player.physicalAttack += item.physicalAttack;
    if (item.magicAttack) player.magicAttack += item.magicAttack;
    if (item.defense) player.defense += item.defense;
    if (item.evasion) player.evasion += item.evasion;
    if (item.maxHp) { player.maxHp += item.maxHp; player.currentHp += item.maxHp; }
    (item.effects || []).forEach((eff) => this.applyEquipmentEffect(player, eff, 1));
  },
  removeEquipmentStats(player, item) {
    if (!item) return;
    if (item.physicalAttack) player.physicalAttack -= item.physicalAttack;
    if (item.magicAttack) player.magicAttack -= item.magicAttack;
    if (item.defense) player.defense -= item.defense;
    if (item.evasion) player.evasion -= item.evasion;
    if (item.maxHp) { player.maxHp = Math.max(1, player.maxHp - item.maxHp); player.currentHp = Math.min(player.currentHp, player.maxHp); }
    (item.effects || []).forEach((eff) => this.applyEquipmentEffect(player, eff, -1));
  },

  // sign=1で装備時、-1で解除時。多くの効果はplayer.equipXxxというボーナス
  // フィールドに加算/減算するだけの単純な形にしている
  // （実際にダメージ計算等で読み取るのはcardEffectSystem.js/combat.js/shop.js側）。
  applyEquipmentEffect(player, eff, sign) {
    const v = eff.value;
    const add = (field, amount) => { player[field] = (player[field] || 0) + amount * sign; };
    switch (eff.effectId) {
      case "PHYSICAL_ATTACK_RATE": add("equipPhysicalAttackRate", v); break;
      case "MAGIC_ATTACK_RATE": add("equipMagicAttackRate", v); break;
      case "CRIT_RATE_ADD": player.criticalRate += v * sign; break;
      case "CRIT_DAMAGE_ADD": player.criticalDamage += v * sign; break;
      case "GOLD_GAIN_RATE": add("equipGoldGainRate", v); break;
      case "RARE_RATE_ADD": add("boardRareRateAdd", v); break;
      case "MOMENTUM_DAMAGE_RATE": add("momentumDamagePercentBonus", v); break;
      case "RESONANCE_RATE": add("resonancePerEnemyBonus", v * CONFIG.SKILL_BASE.resonancePerEnemy); break;
      case "GOAL_HEAL_PERCENT": add("goalHealPercent", v); break;
      case "GOAL_REWARD_RATE": add("equipGoalRewardRate", v); break;
      case "ENEMY_COUNT_ADD": add("boardEnemyCountAdd", v); break;
      case "ALL_ENEMY_REWARD_RATE": add("equipAllEnemyRewardRate", v); break;
      case "SHOP_PRICE_RATE": add("equipShopPriceRate", v); break;
      case "HEAL_POWER_RATE": add("healPowerMult", v); break;
      case "DEFENSE_CARD_RATE": add("equipDefenseCardRate", v); break;
      case "MAX_HP_RATE": {
        // 直近のcurrentMaxHpに対する割合で計算し、増減量をitem自身に記録して
        // 解除時に同じ量だけ正確に戻せるようにする（重複装備は無い前提）。
        if (sign === 1) {
          eff._appliedDelta = Math.round(player.maxHp * v);
          player.maxHp = Math.max(1, player.maxHp + eff._appliedDelta);
          player.currentHp = Math.min(player.currentHp + Math.max(0, eff._appliedDelta), player.maxHp);
        } else if (eff._appliedDelta != null) {
          player.maxHp = Math.max(1, player.maxHp - eff._appliedDelta);
          player.currentHp = Math.min(player.currentHp, player.maxHp);
        }
        break;
      }
      // 以下は「フラグ／回数」だけ持たせておき、戦闘・宝箱側で参照する
      case "MULTI_HIT_DAMAGE_RATE": add("equipMultiHitRate", v); break;
      case "AOE_DAMAGE_RATE": add("equipAoeRate", v); break;
      case "STRONG_DAMAGE_RATE": add("equipStrongDamageRate", v); break;
      case "STRONG_DAMAGE_TAKEN_RATE": add("equipStrongDamageTakenRate", v); break;
      case "LOW_HP_DAMAGE_RATE": add("equipLowHpDamageRateCount", 0); player.equipLowHpDamageRates = player.equipLowHpDamageRates || []; if (sign === 1) player.equipLowHpDamageRates.push(v); else { const i = player.equipLowHpDamageRates.indexOf(v); if (i !== -1) player.equipLowHpDamageRates.splice(i, 1); } break;
      case "LOW_HP_PHYSICAL_RATE": player.equipLowHpPhysicalRates = player.equipLowHpPhysicalRates || []; if (sign === 1) player.equipLowHpPhysicalRates.push(v); else { const i = player.equipLowHpPhysicalRates.indexOf(v); if (i !== -1) player.equipLowHpPhysicalRates.splice(i, 1); } break;
      case "PER_ENEMY_DAMAGE_RATE": add("equipPerEnemyDamageRate", v); break;
      case "FIRST_ATTACK_RATE": add("equipFirstAttackRate", v); break;
      case "SINGLE_HIT_CARD_RATE": add("equipSingleHitCardRate", v); break;
      case "SWARM_DAMAGE_RATE": player.equipSwarmRates = player.equipSwarmRates || []; if (sign === 1) player.equipSwarmRates.push(v); else { const i = player.equipSwarmRates.indexOf(v); if (i !== -1) player.equipSwarmRates.splice(i, 1); } break;
      case "GAMBLE_DICE_BATTLE_DAMAGE": if (sign === 1) player.equipGambleDice = v; else player.equipGambleDice = null; break;
      case "HIGH_ROLL_BATTLE_DAMAGE": if (sign === 1) player.equipHighRollDamage = v; else player.equipHighRollDamage = null; break;
      case "BATTLE_START_DRAW": add("equipBattleStartDraw", v); break;
      case "FIRST_TURN_ACTION_ADD": add("equipFirstTurnActionAdd", v); break;
      case "MAGIC_CARD_HP_COST": add("equipMagicCardHpCost", v); break;
      case "LIFESTEAL_ON_KILL_PERCENT": add("equipLifestealOnKillPercent", v); break;
      case "BATTLE_END_HEAL_PERCENT": add("equipBattleEndHealPercent", v); break;
      case "LOW_HP_BATTLE_END_HEAL": if (sign === 1) player.equipLowHpBattleEndHeal = v; else player.equipLowHpBattleEndHeal = null; break;
      case "DEATH_PREVENTION_ONCE_PER_GAME": add("equipDeathPreventionCharges", sign === 1 ? 1 : 0); break;
      case "TREASURE_QUALITY_UP": add("equipTreasureQualityUp", 1); break;
      case "DICE_ADJUST_USES_ADD": break; // 出目±1機能は廃止済みのため何もしない（互換のため残す）
      default: break;
    }
  },

  // 武器を装備する。1つしか持てないため、古い武器は自動的に手放される。
  equipWeapon(weapon) {
    if (this.player.weapon) this.removeEquipmentStats(this.player, this.player.weapon);
    this.player.weapon = weapon;
    this.applyEquipmentStats(this.player, weapon);
    Debug.log(`Weapon equipped: ${weapon.name}`);
  },

  // ---------------------------------------------------------
  // SHOP／宝箱共通の入手処理。カテゴリごとに「即時反映」か
  // 「上限に応じた追加/交換」かが異なるため、ここで一本化している。
  // doneCallbackは交換UIなどが終わった後に呼ばれる。
  // ---------------------------------------------------------
  acquireShopItem(category, item, doneCallback) {
    const player = this.player;
    if (category === "stat") {
      item.apply(player);
      player.statCardHistory.push({ id: item.id, name: item.name, description: item.description, rarity: item.rarity });
      UI.updateHpBar();
      Debug.log(`Stat card acquired: ${item.name}`);
      doneCallback && doneCallback();
      return;
    }
    if (category === "weapon") {
      const old = player.weapon;
      this.equipWeapon(item);
      if (old) Debug.log(`Weapon swapped: ${old.name} -> ${item.name}`);
      doneCallback && doneCallback();
      return;
    }

    const slotMap = {
      action: [player.battleDeck, CONFIG.BATTLE_DECK_MAX],
      board: [player.boardCards, CONFIG.BOARD_DECK_MAX],
      armor: [player.armor, CONFIG.EQUIPMENT.armorMax],
      charm: [player.charms, CONFIG.EQUIPMENT.charmMax],
    };
    const [deck, maxSize] = slotMap[category];
    const isEquipment = category === "armor" || category === "charm";

    if (DeckSystem.canAdd(deck, maxSize)) {
      DeckSystem.add(deck, item);
      if (isEquipment) this.applyEquipmentStats(player, item);
      this.onEquipmentAdded(category, item);
      Debug.log(`${category} acquired: ${item.name}`);
      doneCallback && doneCallback();
      return;
    }

    // 上限に達している場合は、既存の1つと交換 or 取得キャンセルを選ばせる
    const ownedChoices = deck.map((c, index) => ({ id: `owned_${index}`, name: c.name, description: c.description, rarityId: c.rarity, _index: index }));
    ownedChoices.push({ id: "__cancel__", name: "キャンセル", description: `「${item.name}」は諦めて、現在の構成を維持します` });

    UI.showChoiceOverlay(`枠が一杯です。「${item.name}」と交換するものを選んでください`, ownedChoices, (picked) => {
      if (picked.id !== "__cancel__") {
        if (isEquipment) this.removeEquipmentStats(player, deck[picked._index]);
        DeckSystem.replaceAt(deck, picked._index, item);
        if (isEquipment) this.applyEquipmentStats(player, item);
        this.onEquipmentAdded(category, item);
        Debug.log(`${category} swap -> ${item.name}`);
      }
      doneCallback && doneCallback();
    });
  },

  // 盤面カード獲得時の即時処理（盤面改造カードは、獲得した瞬間に効果を適用する）
  onEquipmentAdded(category, item) {
    if (category !== "board") return;
    const handler = CardEffectSystem.BOARD_CARD_HANDLERS[item.effectId];
    if (handler) handler(this.player, item);
    if (item.effectId === "convert_tile") {
      this.player.pendingTileConversions = this.player.pendingTileConversions || [];
      this.player.pendingTileConversions.push(item.effectValue);
      Board.convertRandomTile(item.effectValue.from, item.effectValue.to);
    }
  },


  endRound() {
    EventHooks.trigger("onRoundEnd", { round: this.round });
    if (this.round >= CONFIG.MAX_ROUNDS) {
      this.evaluateGameSummary();
    } else {
      UI.setDiceButtonEnabled(true);
      this.startRound();
    }
  },

  // GAME終了時の結果表示。
  evaluateGameSummary() {
    if (this.player.currentHp / this.player.maxHp >= 1.0) this.progress.survivedHighHp = 1;
    else if (this.player.currentHp / this.player.maxHp >= 0.5) this.progress.survivedHighHp = 1;

    const achieved = this.mission ? MissionSystem.isComplete(this.mission, this.progress) : false;
    const baseGold = CONFIG.getBaseGameClearGold(this.gameIndex);
    this.gainGold(baseGold, `+${baseGold}G`);

    Debug.log(`GAME ${this.gameIndex + 1} COMPLETE: mission=${achieved ? "CLEAR" : "MISS"} (+${baseGold}G)`);
    UI.showGameSummary({
      gameNumber: this.gameIndex + 1,
      missionLabel: this.mission ? this.mission.label : "-",
      missionAchieved: achieved,
      reward: baseGold,
    });

    this._missionAchieved = achieved;
  },

  // TREASURE宝箱・BONUS TARGET達成時の宝箱を開ける共通処理。
  // qualityは"bronze"/"silver"/"gold"。宝探しのお守り/強欲のお守り
  // （TREASURE_QUALITY_UP）を持っていると、1段階アップグレードされる。
  presentChest(quality, titlePrefix) {
    const qualityOrder = ["bronze", "silver", "gold"];
    let effectiveQuality = quality;
    if (this.player.equipTreasureQualityUp) {
      const idx = qualityOrder.indexOf(quality);
      effectiveQuality = qualityOrder[Math.min(qualityOrder.length - 1, idx + this.player.equipTreasureQualityUp)];
    }
    return new Promise((resolve) => {
      const chest = RewardSystem.openChest(this.player, this.gameIndex, effectiveQuality);

      if (chest.category === "gold" || chest.category === "special") {
        const amount = chest.gold || 0;
        this.gainGold(amount, `+${amount}G`);
        Debug.log(`${titlePrefix}: Gold +${amount}`);
        resolve();
        return;
      }

      if (!chest.choices || chest.choices.length === 0) { resolve(); return; }

      if (chest.choices.length === 1) {
        // ステータス／装備は1点もの。確認オーバーレイを挟んで自動取得する。
        const c = chest.choices[0];
        const slotLabel = { stat: "ステータス", weapon: "武器", armor: "防具", charm: "お守り" };
        UI.showChoiceOverlay(`${titlePrefix}：[${slotLabel[c.slot] || c.slot}] ${c.card.name}を獲得！`, [
          { id: "ok", name: "受け取る", description: c.card.description, rarityId: c.card.rarity },
        ], () => {
          this.acquireShopItem(c.slot, c.card, resolve);
        });
        return;
      }

      // 盤面カードは3択
      const display = chest.choices.map((c, i) => Object.assign({}, c.card, { id: `chest_${i}`, rarityId: c.card.rarity }));
      UI.showChoiceOverlay(`${titlePrefix}：盤面強化カードを1枚選んでください`, display, (picked) => {
        const idx = parseInt(picked.id.replace("chest_", ""), 10);
        const chosen = chest.choices[idx];
        this.acquireShopItem(chosen.slot, chosen.card, resolve);
      });
    });
  },

  async proceedAfterGameSummary() {
    if (this._missionAchieved) {
      await this.presentChest(CONFIG.BONUS_CHEST_QUALITY, "BONUS TARGET達成");
    }
    await this.offerCardReward();

    const gameNumber = this.gameIndex + 1;
    const bossIndex = CONFIG.BOSS_GAME_NUMBERS.indexOf(gameNumber);
    if (bossIndex !== -1) {
      const bossNumber = bossIndex + 1;
      await this.playBossFight(bossNumber);
      if (this.player.currentHp <= 0) { this.triggerGameOver(); return; }
      await this.offerBossPassive(bossNumber);
      if (gameNumber === CONFIG.DEMO_MAX_GAME) { this.showDemoClear(); return; }
    }

    this.goToNextGame();
  },

  // GAME CLEAR報酬：アクションカード2枚＋ステータス強化カード2枚の4択。
  // 盤面強化カードはここからは出さない（TREASURE/BONUS TARGET/SHOP専用にする）。
  offerCardReward() {
    return new Promise((resolve) => {
      const choices = RewardSystem.buildGameClearChoices(this.player, this.gameIndex);
      if (choices.length === 0) { resolve(); return; }

      const slotLabel = { battle: "アクション", stat: "ステータス" };
      const display = choices.map((c, i) => Object.assign({}, c.card, {
        id: `reward_${i}`,
        name: `[${slotLabel[c.slot]}] ${c.card.name}`,
        rarityId: c.card.rarity,
      }));
      display.push({ id: "__skip__", name: "SKIP", description: `何も選ばず+${CONFIG.REWARD.SKIP_GOLD}Gを獲得する` });

      UI.showChoiceOverlay("GAME CLEAR報酬：1枚選んでください（アクション2枚＋ステータス2枚）", display, (picked) => {
        if (picked.id === "__skip__") {
          this.gainGold(CONFIG.REWARD.SKIP_GOLD, `+${CONFIG.REWARD.SKIP_GOLD}G`);
          resolve();
          return;
        }
        const index = parseInt(picked.id.replace("reward_", ""), 10);
        const choice = choices[index];
        // battle/statはacquireShopItemと同じ「上限なら交換」ロジックを再利用する
        // （statは上限が無いのでそのまま即時反映される）
        this.acquireShopItem(choice.slot === "battle" ? "action" : "stat", choice.card, resolve);
      });
    });
  },

  offerBossPassive(bossNumber) {
    return new Promise((resolve) => {
      const pool = BossPassiveSystem.getAvailablePassives(this.player.classType, this.player.bossPassives);
      const choices = BossPassiveSystem.pickChoices(pool, 3);
      if (choices.length === 0) { resolve(); return; }
      const display = choices.map((p) => Object.assign({}, p, { rarityId: "legendary" }));
      UI.showChoiceOverlay(`BOSS${bossNumber}撃破！パッシブを1つ選んでください`, display, (chosen) => {
        if (chosen.apply) chosen.apply(this.player);
        // trigger付きの動的パッシブは、trigger/effectId/effectValueごと保持しておく
        // （戦闘中にCardEffectSystem.triggerTraits()がこの配列を読みに来る）。
        this.player.bossPassives.push({
          id: chosen.id, name: chosen.name, description: chosen.description,
          trigger: chosen.trigger, effectId: chosen.effectId, effectValue: chosen.effectValue,
        });
        Debug.log(`Boss passive acquired: ${chosen.name}`);
        resolve();
      });
    });
  },

  showDemoClear() {
    const cls = ClassSystem.get(this.player.classType);
    UI.showDemoClearScreen({
      className: cls ? cls.name : this.player.classType,
      physicalAttack: this.player.physicalAttack,
      magicAttack: this.player.magicAttack,
      maxDamage: this.progress.maxSingleHit,
      currentHp: Math.max(0, this.player.currentHp),
      maxHp: this.player.maxHp,
      gold: this.walletGold,
      battleDeckCount: this.player.battleDeck.length,
      boardDeckCount: this.player.boardCards.length,
      bossPassiveCount: this.player.bossPassives.length,
      strongKills: this.progress.strongKills,
      rareKills: this.progress.rareKills,
      laps: this.medals,
    });
    Debug.log("DEMO CLEAR!");
  },

  triggerGameOver() {
    EventHooks.trigger("onGameOver", {});
    Debug.log("GAME OVER (HP 0)");
    UI.showGameOverScreen({
      reachedGame: this.gameIndex + 1,
      kills: this.progress.kills,
      gold: this.walletGold,
      laps: this.medals,
      bossKills: this.bossKills,
    });
  },

  goToNextGame() {
    this.initGame(this.gameIndex + 1);
    this.startRound();
    UI.setDiceButtonEnabled(true);
  },

  resetRunState() {
    this.walletGold = 0;
    this.earnedGold = 0;
    this.medals = 0;
    this.bossKills = 0;
    this.rerollUseCount = 0;
    this.deleteUseCount = 0;
  },

  resetAll() {
    const classType = this.player ? this.player.classType : null;
    this.resetRunState();
    if (classType) this.beginRun(classType);
    else Screens.showHome();
    UI.setDiceButtonEnabled(true);
  },

  fullReset() {
    this.resetRunState();
    this.player = null;
    Screens.showHome();
  },
};

// battleSystem.js側のCardEffects.onBattleEnd相当（戦闘終了時の特殊カード処理）を
// この1関数にまとめている（狂戦士系の後処理などは各特性がonBattleEndで自己完結する
// ため、ここでは「生還」的な将来拡張のための入口として残している）。
function CardEffects_onBattleEnd(player, gameRunState) {
  // 現時点では特に追加処理なし（拡張ポイント）
}
