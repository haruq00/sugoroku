// ============================================================
// game.js
// ゲーム全体の状態管理と進行フローを担当します。
// 「サイコロを振る→移動→マス処理→(戦闘)→ラウンド終了」の
// 一連の流れをここで組み立てます。
// ============================================================

const GameState = {
  gameIndex: 0, // 0始まり (GAME 1 = index 0)
  round: 0,     // 現在のラウンド (1〜MAX_ROUNDS)

  walletGold: 0, // 所持金（ショップで使う。マイナスマスで減る）
  earnedGold: 0, // そのゲーム中の累計獲得金額（ノルマ判定に使用。ゲームごとにリセット）
  kills: 0,      // そのゲーム中の討伐数（ゲームごとにリセット）
  medals: 0,     // 周回メダル（ラン全体で維持）

  goldQuota: 0,
  killQuota: 0,
  stageKey: "STANDARD",

  player: null,       // {attack, attackCount, criticalRate, criticalDamage, aoeAttack, weapon}
  passives: [],        // ラン中に獲得したパッシブ一覧 [{id,name,description}, ...]（ラン全体で維持）
  cards: [],            // ラン中に獲得したカード一覧（ラン全体で維持。stackableは複数持てる）
  omamori: [],          // ショップで購入したお守り一覧（複数持てる）
  rerollUseCount: 0,    // ショップのリロールをラン中に使った回数（コストが上がっていく）
  deleteUseCount: 0,    // ショップの削除をラン中に使った回数（コストが上がっていく）
  diceLocked: false,   // 処理中はサイコロを振れないようにするフラグ
  clearReady: false,   // 片方のノルマを達成済みかどうか
  lastDice: null,

  // ラン全体の開始点。最初に一度だけパッシブを選んでから、GAME 1を開始する。
  beginRun() {
    // パッシブをこの時点で適用するため、playerを先に用意しておく
    // （initGame()内でも用意されるが、パッシブ選択の方が先に走るためここでも必要）
    if (!this.player) {
      this.player = Object.assign({}, CONFIG.PLAYER_INITIAL);
    }

    const passiveChoices = this.pickRandomChoices(CONFIG.PASSIVES, this.passives, CONFIG.PASSIVE_CHOICE_COUNT);
    const startFirstGame = () => {
      this.initGame(0);
      this.startRound();
    };

    if (passiveChoices.length > 0) {
      UI.showChoiceOverlay("最初にパッシブを1つ選んでください", passiveChoices, (chosen) => {
        this.acquirePassive(chosen);
        startFirstGame();
      });
    } else {
      startFirstGame();
    }
  },

  // 1ゲーム分の初期化（NEXT GAME時にも呼ばれる）
  initGame(gameIndex) {
    this.gameIndex = gameIndex;
    this.round = 0;
    this.kills = 0;
    this.earnedGold = 0; // ノルマ用累計金額はゲームごとにリセット
    this.clearReady = false;
    this.diceLocked = false;

    const gameConf = this.getGameConfig(gameIndex);
    this.stageKey = gameConf.stage;
    this.goldQuota = gameConf.goldQuota;
    this.killQuota = gameConf.killQuota;

    if (!this.player) {
      this.player = Object.assign({}, CONFIG.PLAYER_INITIAL);
    }

    Board.init(this.stageKey);
    UI.renderAll();
    EventHooks.trigger("onGameStart", { gameIndex });
    Debug.log(`GAME ${gameIndex + 1} START (stage: ${this.stageKey})`);
  },

  // CONFIG.GAMESを超えたゲーム番号は、倍率を使って自動生成する
  getGameConfig(gameIndex) {
    if (gameIndex < CONFIG.GAMES.length) {
      return CONFIG.GAMES[gameIndex];
    }
    const base = CONFIG.GAMES[CONFIG.GAMES.length - 1];
    const extra = gameIndex - (CONFIG.GAMES.length - 1);
    const goldQuota = Math.round(
      base.goldQuota * Math.pow(CONFIG.GAME_SCALING.goldQuotaMultiplier, extra)
    );
    const killQuota = base.killQuota + CONFIG.GAME_SCALING.killQuotaIncrement * extra;
    const stageKeys = Object.keys(CONFIG.STAGES);
    const stage = stageKeys[gameIndex % stageKeys.length];
    return { stage, goldQuota, killQuota };
  },

  startRound() {
    this.round += 1;
    this.diceLocked = false;
    EventHooks.trigger("onRoundStart", { round: this.round });
    UI.updateStatusBar();
    Debug.log(`--- ROUND ${this.round}/${CONFIG.MAX_ROUNDS} ---`);
  },

  // サイコロを振る（デバッグの強制出目があればそちらを優先する）
  // 実際に振る個数は CONFIG.DICE_COUNT + player.diceCountBonus（カードで増える）。
  rollDice() {
    if (this.diceLocked) return;
    this.diceLocked = true;
    UI.setDiceButtonEnabled(false);

    const forced = Debug.forcedDiceValue;
    const diceCount = CONFIG.DICE_COUNT + (this.player.diceCountBonus || 0);
    const values = [];
    for (let i = 0; i < diceCount; i++) {
      values.push(forced ? forced : Math.floor(Math.random() * 6) + 1);
    }
    const total = DiceUI.total(values);
    this.lastDice = total;

    EventHooks.trigger("onDiceRolled", { values, total });
    Debug.log(`Dice: [${values.join(",")}] = ${total}`);

    // 振るモーションが終わってから移動を開始する
    DiceUI.roll(values, () => {
      setTimeout(() => {
        Board.movePlayer(
          total,
          (index, passedGoal) => {
            if (passedGoal) {
              this.medals += 1;
              EventHooks.trigger("onGoalPassed", { medals: this.medals });
              UI.showEffect("MEDAL +1", "medal-popup");
              Debug.log("Goal passed / Medal +1");
              UI.updateStatusBar();
            }
          },
          () => {
            Debug.log(`Moved ${total} tiles`);
            this.handleTileLanded();
          }
        );
      }, CONFIG.PRE_MOVE_DELAY_MS);
    });
  },

  // 停止したマスの処理を行う
  handleTileLanded() {
    const type = Board.getCurrentTileType();
    Debug.log(`Landed: ${type.toUpperCase()}`);
    EventHooks.trigger("onTileLanded", { type });

    switch (type) {
      case "start":
        // STARTはゴール通過処理側で既に扱っているので、ここでは何もしない
        this.finishTileResolution();
        break;

      case "gold":
        this.gainGold(CONFIG.TILE_VALUES.gold, `+${CONFIG.TILE_VALUES.gold}G`);
        UI.showTileMessage(CONFIG.TILE_MESSAGES.gold(CONFIG.TILE_VALUES.gold));
        this.finishTileResolution();
        break;

      case "negative":
        this.loseGold(-CONFIG.TILE_VALUES.negative);
        UI.showTileMessage(CONFIG.TILE_MESSAGES.negative(CONFIG.TILE_VALUES.negative));
        this.finishTileResolution();
        break;

      case "special_treasure":
        this.gainGold(CONFIG.TILE_VALUES.treasure, `TREASURE +${CONFIG.TILE_VALUES.treasure}G`);
        UI.showTileMessage(CONFIG.TILE_MESSAGES.special_treasure(CONFIG.TILE_VALUES.treasure));
        this.finishTileResolution();
        break;

      case "shop":
        UI.showTileMessage(CONFIG.TILE_MESSAGES.shop());
        Shop.open(() => this.finishTileResolution());
        break;

      case "enemy":
        UI.showTileMessage(CONFIG.TILE_MESSAGES.enemy());
        this.startBattle(false);
        break;

      case "special_danger":
        UI.showTileMessage(CONFIG.TILE_MESSAGES.special_danger());
        this.startBattle(true);
        break;

      default:
        this.finishTileResolution();
    }
  },

  // walletGold / earnedGold の両方に加算する（利益マス・TREASURE・討伐報酬用）。
  // マスに紐付かない金額表示(ダメージと同じ位置に出す撃破報酬など)はcallerが個別に出すため、
  // ここでは「マス上」の演出（+50Gなど）は出さず、演出・効果音だけをまとめて処理する。
  gainGold(amount, popupText) {
    this.walletGold += amount;
    this.earnedGold += amount;
    UI.updateStatusBar();
    SoundManager.playGold();
    UI.playMoneyEffect();
    if (popupText) UI.showEffect(popupText, "gold-popup");
  },

  // walletGoldのみ減少させる（マイナスマス用）。0未満にはしない。
  loseGold(amount) {
    this.walletGold = Math.max(0, this.walletGold - amount);
    UI.updateStatusBar();
    UI.showEffect(`${-amount}G`, "negative-popup");
  },

  // プールからownedにまだ無いものをcount件、ランダムに選ぶ（パッシブ用。stackableでないもののみ除外）
  pickRandomChoices(pool, ownedList, count) {
    const ownedIds = ownedList.map((o) => o.id);
    const available = pool.filter((p) => p.stackable || !ownedIds.includes(p.id));
    const shuffled = available.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  // レア度の重み表(weights)に従って1件、レア度キーを抽選する。
  // gameIndexに応じて、まだ解禁されていないレア度は除外される（js/rarity.js参照）。
  pickCardChoices(count, perfect) {
    const weights = perfect ? CONFIG.CARD_PERFECT_RARITY_WEIGHTS : CONFIG.CARD_CLEAR_RARITY_WEIGHTS;
    const ownedIds = this.cards.map((c) => c.id);
    const basePool = CONFIG.CARDS.filter((c) => c.stackable || !ownedIds.includes(c.id));

    const chosen = [];
    const usedIds = new Set();

    for (let i = 0; i < count; i++) {
      const rarity = ItemRarity.pick(this.gameIndex, weights);
      let candidates = basePool.filter((c) => c.rarityId === rarity && !usedIds.has(c.id));
      if (candidates.length === 0) candidates = basePool.filter((c) => !usedIds.has(c.id));
      if (candidates.length === 0) break;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      chosen.push(pick);
      usedIds.add(pick.id);
    }
    return chosen;
  },

  acquirePassive(passive) {
    const ctx = {};
    passive.apply(this.player, ctx);
    this.passives.push({ id: passive.id, name: passive.name, description: passive.description, rarityId: passive.rarityId, ctx });
    Debug.log(`Passive acquired: ${passive.name}`);
  },

  acquireCard(card) {
    const ctx = {};
    card.apply(this.player, ctx);
    this.cards.push({ id: card.id, name: card.name, description: card.description, rarityId: card.rarityId, ctx });
    Debug.log(`Card acquired: ${card.name}`);
  },

  // カード／お守りを削除する（ショップから、お金を払って行う）
  removeCard(index) {
    const entry = this.cards[index];
    if (!entry) return;
    const def = CONFIG.CARDS.find((c) => c.id === entry.id);
    if (def && def.remove) def.remove(this.player, entry.ctx || {});
    this.cards.splice(index, 1);
    Debug.log(`Card removed: ${entry.name}`);
  },

  removeOmamori(index) {
    const entry = this.omamori[index];
    if (!entry) return;
    const def = CONFIG.OMAMORI.find((o) => o.id === entry.id);
    if (def && def.remove) def.remove(this.player, entry.ctx || {});
    this.omamori.splice(index, 1);
    Debug.log(`Omamori removed: ${entry.name}`);
  },

  // 武器を装備する。1つしか持てないため、古い武器は自動的に手放される
  // （プレイヤーの持つ武器の参照を単純に上書きするだけでよい）。
  equipWeapon(weapon) {
    this.player.weapon = weapon;
    Debug.log(`Weapon equipped: ${weapon.name}`);
  },

  acquireOmamori(omamori) {
    const ctx = {};
    omamori.apply(this.player, ctx);
    this.omamori.push({ id: omamori.id, name: omamori.name, description: omamori.description, rarityId: omamori.rarityId, ctx });
    Debug.log(`Omamori acquired: ${omamori.name}`);
  },

  // 敵マスに停止：そのまま戦闘を開始する（パッシブ選択はラン開始時の1回だけ）
  startBattle(isDanger) {
    this.beginBattle(isDanger);
  },

  beginBattle(isDanger) {
    const enemies = Combat.generateEnemies(CONFIG.ENEMY_COUNT, isDanger, this.gameIndex, this.player);
    enemies.forEach((e) => {
      Debug.log(
        `Spawned: ${e.rarityName} ${e.strongName} ${e.monsterName} (HP:${e.maxHp} Reward:${e.reward})`
      );
    });
    Debug.currentEnemies = enemies;

    Combat.runBattle(enemies, this.player, {
      onEnemiesAppear: (list) => UI.showEnemies(list),
      onAttack: (enemy, damage, isCritical) => {
        UI.showAttack(enemy, damage, isCritical);
        SoundManager.playHit();
        Debug.log(`Damage: ${damage}${isCritical ? " (CRITICAL)" : ""} -> ${enemy.monsterName}`);
      },
      onDefeat: (enemy, reward, oneShot) => {
        this.kills += 1;
        UI.showDefeat(enemy, reward, oneShot);
        SoundManager.playDefeat();
        this.gainGold(reward); // ここでゴールド獲得演出・効果音も鳴る（表示は敵の上に出るためpopupTextは無し）
        Debug.log(`${enemy.monsterName} defeated. +${reward}G`);
      },
      onEscape: (enemy) => {
        UI.showEscape(enemy);
        Debug.log(`${enemy.monsterName} escaped`);
      },
      onDone: () => {
        setTimeout(() => UI.hideEnemies(), CONFIG.BATTLE_END_PAUSE_MS);
        this.finishTileResolution();
      },
    });
  },

  // マス処理が終わったら、クリア判定→ラウンド終了へ進む
  finishTileResolution() {
    this.checkClearReady();
    setTimeout(() => this.endRound(), CONFIG.TILE_RESOLUTION_DELAY_MS);
  },

  // 片方のノルマを達成した時点で「CLEAR READY」を表示する
  // （即ゲーム終了にはせず、残りラウンドでPERFECTを狙えるようにする）
  checkClearReady() {
    const goldOk = this.earnedGold >= this.goldQuota;
    const killOk = this.kills >= this.killQuota;
    if ((goldOk || killOk) && !this.clearReady) {
      this.clearReady = true;
      UI.showClearReady();
      Debug.log("CLEAR READY!");
    }
  },

  endRound() {
    EventHooks.trigger("onRoundEnd", { round: this.round });
    if (this.round >= CONFIG.MAX_ROUNDS) {
      this.evaluateGameEnd();
    } else {
      UI.setDiceButtonEnabled(true);
      this.startRound();
    }
  },

  // 5ラウンド終了後の最終判定（CLEAR / PERFECT CLEAR / GAME OVER）。
  // 金額・討伐数のどちらか片方を満たせばCLEAR、両方満たせばPERFECT CLEAR。
  // PERFECT CLEARの場合、その後のカード選択でレア度の高いカードが出やすくなる。
  evaluateGameEnd() {
    const goldOk = this.earnedGold >= this.goldQuota;
    const killOk = this.kills >= this.killQuota;
    const cleared = goldOk || killOk;
    const perfect = goldOk && killOk;

    if (perfect) {
      this.grantPerfectClearReward();
      EventHooks.trigger("onPerfectClear", {});
    }
    if (cleared) {
      EventHooks.trigger("onGameClear", {});
    } else {
      EventHooks.trigger("onGameOver", {});
    }

    if (cleared) {
      // クリア時：カードを1枚選んでから結果画面を出す
      const cardChoices = this.pickCardChoices(CONFIG.CARD_CHOICE_COUNT, perfect);
      const showFinalResult = () => {
        Debug.log(perfect ? "PERFECT CLEAR" : "CLEAR");
        UI.showResult(perfect ? "PERFECT CLEAR" : "CLEAR", true, perfect);
      };

      if (cardChoices.length > 0) {
        const title = perfect
          ? "PERFECT CLEAR！レアなカードを1枚選んでください"
          : "クリア報酬！カードを1枚選んでください";
        UI.showChoiceOverlay(title, cardChoices, (chosen) => {
          this.acquireCard(chosen);
          showFinalResult();
        });
      } else {
        showFinalResult();
      }
    } else {
      Debug.log("GAME OVER");
      UI.showResult("GAME OVER", false, false);
    }
  },

  // 将来、PERFECT CLEAR専用の豪華報酬を実装するための入口
  // （現在はカード抽選のレア度優遇という形で実装済み。追加報酬が欲しい場合はここに実装する）
  grantPerfectClearReward() {
    // TODO: 将来ここに追加のPERFECT CLEAR専用ボーナス処理を実装する
  },

  // NEXT GAMEボタン押下時：所持金・メダル・パッシブ・カード・お守り・武器は維持したまま次のゲームへ
  goToNextGame() {
    this.initGame(this.gameIndex + 1);
    this.startRound();
    UI.setDiceButtonEnabled(true);
  },

  // GAME OVER時：最初のゲームからやり直す（すべてリセットし、パッシブ選択からやり直す）
  resetAll() {
    this.walletGold = 0;
    this.earnedGold = 0;
    this.kills = 0;
    this.medals = 0;
    this.passives = [];
    this.cards = [];
    this.omamori = [];
    this.rerollUseCount = 0;
    this.deleteUseCount = 0;
    this.player = Object.assign({}, CONFIG.PLAYER_INITIAL);
    this.beginRun();
    UI.setDiceButtonEnabled(true);
  },
};
