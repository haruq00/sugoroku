// ============================================================
// combat.js
// 敵の生成（モンスター種 × Rare × Strong）だけを担当します。
// 実際の戦闘進行（手札・ACTION・ダメージ計算）はbattleSystem.js /
// cardEffectSystem.jsに移行したため、このファイルは「どんな敵が
// 出るか」の抽選ロジックに専念します。
//
// モンスター種・Rare・Strongは別要素として扱う：
//   モンスター種 … 種族による戦い方の違い（今後拡張予定）
//   Rare         … 主に報酬増加。HP/ATKへの影響は小さく保つ
//   Strong       … 戦闘難易度上昇（HP/ATK/報酬を増加）
// ============================================================

const Combat = {
  // モンスター種類 × レア度 × 強敵度 を抽選し、敵を1体生成する。
  // gameIndex（0始まり）に応じてHP・ATK・報酬をスケーリングする。
  // playerを渡すと、すごろくカードの効果（Rare率・Strong率・報酬倍率など）を反映する。
  generateEnemy(isDangerTile, gameIndex, player) {
    const pool = this.getUnlockedMonsterPool(gameIndex);
    const monster = this.pickWeighted(pool);
    const rarity = this.pickRarity(player);
    const strongInfo = this.pickStrongLevel(isDangerTile, gameIndex, player);

    const hpScale = Math.pow(CONFIG.MONSTER_HP_SCALING_PER_GAME, gameIndex || 0);
    const atkScale = Math.pow(CONFIG.MONSTER_ATK_SCALING_PER_GAME, gameIndex || 0);
    const rewardScale = Math.pow(CONFIG.MONSTER_REWARD_SCALING_PER_GAME, gameIndex || 0);

    const hp = Math.max(1, Math.round(monster.hp * hpScale * strongInfo.hpMult));
    const atk = Math.max(1, Math.round(monster.atk * atkScale * strongInfo.atkMult));

    let reward = monster.baseReward * rewardScale * rarity.rewardMult * strongInfo.rewardMult;
    if (strongInfo.id === "strong" && player && player.boardStrongRewardMult) reward *= player.boardStrongRewardMult;
    if (strongInfo.id === "strong" && player && player.bossStrongRewardMult) reward *= player.bossStrongRewardMult;
    if (rarity.id !== "normal" && player && player.boardRareRewardMult) reward *= player.boardRareRewardMult;
    if (player && player.equipAllEnemyRewardRate) reward *= 1 + player.equipAllEnemyRewardRate;

    return {
      monsterId: monster.id,
      monsterName: monster.name,
      rarityId: rarity.id,
      rarityName: rarity.name,
      strongId: strongInfo.id,
      strongName: strongInfo.name,
      maxHp: hp,
      hp: hp,
      atk: atk,
      reward: Math.max(1, Math.round(reward)),
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

  // Boss戦用の単体強敵を1体生成する（同GAMEの通常敵の平均HP/ATK/報酬を基準に、
  // config.jsのBOSS_*_MULTIPLIERで底上げする）。カードバトルは長期化しやすい
  // ため、HP・ATKとも平方根でスケーリングを緩やかにしている
  // （通常モンスターは指数スケーリングのまま）。
  generateBoss(gameIndex, bossNumber) {
    const hpScale = Math.sqrt(Math.pow(CONFIG.MONSTER_HP_SCALING_PER_GAME, gameIndex || 0));
    const atkScale = Math.sqrt(Math.pow(CONFIG.MONSTER_ATK_SCALING_PER_GAME, gameIndex || 0));
    const rewardScale = Math.pow(CONFIG.MONSTER_REWARD_SCALING_PER_GAME, gameIndex || 0);

    const avgHp = CONFIG.MONSTERS.reduce((sum, m) => sum + m.hp * m.rate, 0);
    const avgAtk = CONFIG.MONSTERS.reduce((sum, m) => sum + m.atk * m.rate, 0);
    const avgReward = CONFIG.MONSTERS.reduce((sum, m) => sum + m.baseReward * m.rate, 0);

    const hp = Math.max(1, Math.round(avgHp * hpScale * CONFIG.BOSS_HP_MULTIPLIER));
    const atk = Math.max(1, Math.round(avgAtk * atkScale * CONFIG.BOSS_ATK_MULTIPLIER));
    const reward = Math.max(1, Math.round(avgReward * rewardScale * CONFIG.BOSS_REWARD_MULTIPLIER));

    return {
      monsterId: `boss${bossNumber}`,
      monsterName: `BOSS ${bossNumber}`,
      rarityId: "normal",
      rarityName: "NORMAL",
      strongId: "normal",
      strongName: "NORMAL",
      maxHp: hp,
      hp: hp,
      atk: atk,
      reward: reward,
      defeated: false,
      isBoss: true,
      slotIndex: 0,
    };
  },

  // gameIndex時点で解禁済み（minGameを満たす）モンスターだけの一覧
  getUnlockedMonsterPool(gameIndex) {
    const gameNumber = (gameIndex || 0) + 1; // minGameは1始まりの表記に合わせる
    const unlocked = CONFIG.MONSTERS.filter((m) => gameNumber >= (m.minGame || 1));
    return unlocked.length > 0 ? unlocked : CONFIG.MONSTERS;
  },

  // rate(出現率)に従って配列から1件を重み付き抽選する。
  // 一覧の合計が1にならない場合でも正しく動くよう、合計値に対する比率で判定する。
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

  // レア度の抽選（すごろくカード「幸運」等でRare率を底上げできる）
  pickRarity(player) {
    const rareBonus = (player && player.boardRareRateAdd) || 0;
    const list = CONFIG.RARITIES.map((r) => (r.id === "rare" ? Object.assign({}, r, { rate: r.rate + rareBonus }) : r));
    return this.pickWeighted(list);
  },

  // 強敵度の抽選。
  // DANGERマスは固定のDANGER_STRONG_RATEを基準にする（ゲーム進行による緩和はしない＝
  // 意図的にリスクが高いマス）が、すごろくカードによるstrongRateAdd/Bossパッシブは
  // プレイヤー自身のビルド選択なのでDANGER・通常マス問わず反映する。
  pickStrongLevel(isDangerTile, gameIndex, player) {
    const normalTier = CONFIG.STRONG_LEVELS.find((s) => s.id === "normal");
    const strongTier = CONFIG.STRONG_LEVELS.find((s) => s.id === "strong");
    const rateAdd = ((player && player.boardStrongRateAdd) || 0) + ((player && player.bossStrongRateAdd) || 0);

    const baseRate = isDangerTile ? CONFIG.DANGER_STRONG_RATE : CONFIG.getStrongRateForGame(gameIndex);
    const rate = Math.min(0.95, baseRate + rateAdd);
    if (Math.random() >= rate) return normalTier;

    const baseHpMult = isDangerTile ? strongTier.hpMult : CONFIG.getStrongHpMultForGame(gameIndex);
    const baseAtkMult = isDangerTile ? strongTier.atkMult : CONFIG.getStrongAtkMultForGame(gameIndex);

    return {
      id: strongTier.id,
      name: strongTier.name,
      hpMult: baseHpMult,
      atkMult: baseAtkMult,
      rewardMult: strongTier.rewardMult,
    };
  },
};
