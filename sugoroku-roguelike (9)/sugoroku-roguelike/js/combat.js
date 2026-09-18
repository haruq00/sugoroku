// ============================================================
// combat.js
// 敵生成と自動戦闘の「ロジック」を担当します。
// 実際の画面演出(DOM操作)はcallbacks経由でui.js側に任せ、
// このファイルはゲームルールの計算だけに専念します。
//
// 戦闘は「スイング（1回の攻撃アクション）」単位で1つずつ順番に処理し、
// スイングごとに一定間隔を空けることで、何が起きているか
// きちんと目で追えるようにしています（全体攻撃時も、命中の瞬間を
// 少しずつずらして表示する）。
//
// ダメージ計算：
//   基本ダメージ = player.attack + 武器の追加ダメージ(ランダム, minRoll〜maxRoll)
//   クリティカル時は上記に player.criticalDamage を掛ける。
// ============================================================

const Combat = {
  // モンスター種類 × レア度 × 強敵度 を抽選し、敵を1体生成する。
  // gameIndex（0始まり）に応じてHP・報酬をスケーリングする。
  // player を渡すことで、通常のENEMYマスでは「理論上絶対に倒せない敵」が
  // 抽選対象に入らないようにする（DANGERマスにはこの安全策は適用しない）。
  generateEnemy(isDangerTile, gameIndex, player) {
    const pool = isDangerTile
      ? this.getUnlockedMonsterPool(gameIndex)
      : this.getSafeMonsterPool(gameIndex, player);

    const monster = this.pickWeighted(pool);
    const rarity = this.pickWeighted(CONFIG.RARITIES);
    const strongInfo = this.pickStrongLevel(isDangerTile, gameIndex);

    const hpScale = Math.pow(CONFIG.MONSTER_HP_SCALING_PER_GAME, gameIndex || 0);
    const rewardScale = Math.pow(CONFIG.MONSTER_REWARD_SCALING_PER_GAME, gameIndex || 0);

    const hp = Math.max(1, Math.round(monster.hp * hpScale * strongInfo.hpMult));
    const reward = Math.max(1, Math.round(monster.baseReward * rewardScale * rarity.rewardMult * strongInfo.rewardMult));

    return {
      monsterId: monster.id,
      monsterName: monster.name,
      rarityId: rarity.id,
      rarityName: rarity.name,
      strongId: strongInfo.id,
      strongName: strongInfo.name,
      maxHp: hp,
      hp: hp,
      reward: reward,
      defeated: false, // 撃破済みフラグ（同じ敵を二重に処理しないため）
    };
  },

  // count体ぶんの敵をまとめて生成する（1マスで複数体出現する仕様）
  generateEnemies(count, isDangerTile, gameIndex, player) {
    const enemies = [];
    for (let i = 0; i < count; i++) {
      const enemy = this.generateEnemy(isDangerTile, gameIndex, player);
      enemy.slotIndex = i; // UI側がどのスロットに表示するか判別するための番号
      enemies.push(enemy);
    }
    return enemies;
  },

  // gameIndex時点で解禁済み（minGameを満たす）モンスターだけの一覧
  getUnlockedMonsterPool(gameIndex) {
    const gameNumber = (gameIndex || 0) + 1; // minGameは1始まりの表記に合わせる
    const unlocked = CONFIG.MONSTERS.filter((m) => gameNumber >= (m.minGame || 1));
    return unlocked.length > 0 ? unlocked : CONFIG.MONSTERS;
  },

  // プレイヤーが1回の戦闘で理論上出せる最大ダメージ（クリティカル抜き・武器抜き）。
  // 敵を安全に抽選するための基準値として使う。
  getMaxTheoreticalDamage(player) {
    const turns = CONFIG.MAX_BATTLE_TURNS_PER_ENEMY + (player.extraTurns || 0);
    return player.attack * turns * Math.max(1, player.attackCount);
  },

  // 通常のENEMYマスで使う、「絶対に倒せない敵」を除いたモンスターの一覧。
  // STRONGが出る可能性がある場合は、そのワーストケースのHPで判定する
  // （STRONG出現率が0%のGAMEでは、STRONGは考慮しなくてよい）。
  getSafeMonsterPool(gameIndex, player) {
    const unlocked = this.getUnlockedMonsterPool(gameIndex);
    if (!player) return unlocked; // 念のためのフォールバック

    const maxDamage = this.getMaxTheoreticalDamage(player);
    const hpScale = Math.pow(CONFIG.MONSTER_HP_SCALING_PER_GAME, gameIndex || 0);
    const strongRate = CONFIG.getStrongRateForGame(gameIndex);
    const worstMult = strongRate > 0 ? CONFIG.getStrongHpMultForGame(gameIndex) : 1;

    const safe = unlocked.filter((m) => {
      const worstHp = m.hp * hpScale * worstMult;
      return worstHp <= maxDamage * CONFIG.ENEMY_SAFETY_MARGIN;
    });

    // 安全マージン内に1体も残らない場合は、解禁済みの中からやむを得ず選ぶ
    // （ここに来る状況自体が本来まれ。設定値の見直しシグナルでもある）。
    return safe.length > 0 ? safe : unlocked;
  },

  // rate(出現率)に従って配列から1件を重み付き抽選する。
  // 一覧の合計が1にならない（一部を除外した後など）場合でも正しく動くよう、
  // 合計値に対する比率で判定する。
  pickWeighted(list) {
    const total = list.reduce((sum, item) => sum + item.rate, 0);
    if (total <= 0) return list[list.length - 1];
    let roll = Math.random() * total;
    for (const item of list) {
      roll -= item.rate;
      if (roll <= 0) return item;
    }
    return list[list.length - 1];
  },

  // 強敵度の抽選。
  // DANGERマスは従来通り固定のDANGER_STRONG_RATEとSTRONG_LEVELSの値を使う。
  // 通常のENEMYマスは、ゲーム番号ごとのSTRONG出現率・HP倍率を使う
  // （序盤で急激に倒せなくなる敵が出ないようにするため）。
  pickStrongLevel(isDangerTile, gameIndex) {
    const normalTier = CONFIG.STRONG_LEVELS.find((s) => s.id === "normal");
    const strongTier = CONFIG.STRONG_LEVELS.find((s) => s.id === "strong");

    if (isDangerTile) {
      return Math.random() < CONFIG.DANGER_STRONG_RATE ? strongTier : normalTier;
    }

    const rate = CONFIG.getStrongRateForGame(gameIndex);
    if (Math.random() >= rate) return normalTier;

    return {
      id: strongTier.id,
      name: strongTier.name,
      hpMult: CONFIG.getStrongHpMultForGame(gameIndex),
      rewardMult: strongTier.rewardMult,
    };
  },

  getAliveEnemies(enemies) {
    return enemies.filter((e) => e.hp > 0);
  },

  // 1回ぶんのダメージを計算する（武器のランダム加算込み）
  rollDamage(player, isCritical) {
    const weapon = player.weapon;
    const weaponRoll = weapon
      ? weapon.minRoll + Math.floor(Math.random() * (weapon.maxRoll - weapon.minRoll + 1))
      : 0;
    const base = player.attack + weaponRoll;
    return Math.round(base * (isCritical ? player.criticalDamage : 1));
  },

  // 戦闘を実行する。プレイヤーの操作は無く、完全自動。
  // 1回の攻撃(スイング)ごとに間隔を空けて順番に処理する。
  // player.aoeAttack が true の場合、1スイングで生存中の敵「全員」に
  // 命中する（表示は少しずつずらす）。false なら先頭の1体だけを狙う。
  //
  // callbacks: { onEnemiesAppear, onAttack, onDefeat, onEscape, onDone }
  //   onAttack(enemy, damage, isCritical)
  //   onDefeat(enemy, reward, oneShot)
  //   onEscape(enemy)
  runBattle(enemies, player, callbacks) {
    callbacks.onEnemiesAppear && callbacks.onEnemiesAppear(enemies);
    EventHooks.trigger("onBattleStart", { enemies });

    // 攻撃チャンス(ターン)数は、基本値にプレイヤーの追加ターン(カード等)を加えたもの
    const turnsPerEnemy = CONFIG.MAX_BATTLE_TURNS_PER_ENEMY + (player.extraTurns || 0);
    const maxSwings = turnsPerEnemy * enemies.length * Math.max(1, player.attackCount);
    let swingsUsed = 0;

    const finishBattle = () => {
      callbacks.onDone && callbacks.onDone({ enemies });
    };

    // 1体に対して1回攻撃を当てる（ダメージ計算・撃破判定・コールバック呼び出し）
    const hitEnemy = (enemy, swingNumber) => {
      const isCritical = Math.random() < player.criticalRate;
      const damage = this.rollDamage(player, isCritical);
      enemy.hp = Math.max(0, enemy.hp - damage);

      EventHooks.trigger("onAttack", { enemy, damage, isCritical });
      callbacks.onAttack && callbacks.onAttack(enemy, damage, isCritical);

      if (enemy.hp <= 0 && !enemy.defeated) {
        enemy.defeated = true;
        const oneShot = swingNumber === 1;
        let finalReward = enemy.reward;
        if (oneShot && CONFIG.ONE_SHOT_BONUS_ENABLED) {
          finalReward = Math.round(finalReward * CONFIG.ONE_SHOT_BONUS_MULTIPLIER);
        }
        setTimeout(() => {
          EventHooks.trigger("onEnemyDefeated", { enemy, reward: finalReward, oneShot });
          callbacks.onDefeat && callbacks.onDefeat(enemy, finalReward, oneShot);
        }, CONFIG.BATTLE_DEFEAT_PAUSE_MS);
      }
    };

    // 1回のスイングを処理する（全体攻撃なら生存者全員、通常は先頭の1体）
    const doSwing = () => {
      const alive = this.getAliveEnemies(enemies);

      if (alive.length === 0) {
        setTimeout(() => {
          EventHooks.trigger("onBattleEnd", { result: "defeat", enemies });
          finishBattle();
        }, CONFIG.BATTLE_DEFEAT_PAUSE_MS);
        return;
      }

      if (swingsUsed >= maxSwings) {
        alive.forEach((enemy) => callbacks.onEscape && callbacks.onEscape(enemy));
        setTimeout(() => {
          EventHooks.trigger("onBattleEnd", { result: "escape", enemies });
          finishBattle();
        }, CONFIG.BATTLE_DEFEAT_PAUSE_MS);
        return;
      }

      swingsUsed += 1;
      const targets = player.aoeAttack ? alive : [alive[0]];

      // 全体攻撃で複数体に当たる場合、命中の瞬間を少しずつずらして表示する
      targets.forEach((enemy, i) => {
        setTimeout(() => hitEnemy(enemy, swingsUsed), i * CONFIG.BATTLE_AOE_STAGGER_MS);
      });

      const staggerTail = (targets.length - 1) * CONFIG.BATTLE_AOE_STAGGER_MS;
      setTimeout(doSwing, CONFIG.BATTLE_PER_HIT_DELAY_MS + staggerTail);
    };

    setTimeout(doSwing, CONFIG.BATTLE_INITIAL_DELAY_MS); // 敵出現後、最初の攻撃までの間
  },
};
