// ============================================================
// rewardSystem.js
// 各種報酬経路（GAME CLEAR／TREASURE／BONUS TARGET宝箱）の
// 中身を組み立てます。経路ごとに出すものを明確に分けている点が重要です。
//
//   GAME CLEAR   … アクションカード2枚＋ステータス強化カード2枚の4択のみ。
//                  盤面強化カードはここからは絶対に出さない。
//   TREASURE     … 主に盤面強化カード（重み付き抽選。装備やGoldも一部出る）。
//   BONUS TARGET … 達成時、Bronze/Silverの宝箱を1つ獲得する（中身はTREASUREと
//                  同じ抽選テーブルを使うが、レア度の重みが上振れする）。
// ============================================================

const RewardSystem = {
  // ---------------------------------------------------------
  // GAME CLEAR：アクション2枚＋ステータス2枚の4択
  // ---------------------------------------------------------
  buildGameClearChoices(player, gameIndex) {
    const battlePool = DeckSystem.getAvailableBattleCards(player.classType);
    const statPool = STAT_CARDS;

    const choices = [];
    for (let i = 0; i < CONFIG.REWARD.BATTLE_CHOICES; i++) {
      const picked = DeckSystem.pickChoicesWeighted(battlePool, player.battleDeck, 1, gameIndex, false)[0];
      if (picked) choices.push({ slot: "battle", card: picked });
    }
    for (let i = 0; i < CONFIG.REWARD.STAT_CHOICES; i++) {
      const picked = DeckSystem.pickChoicesWeighted(statPool, player.statCardHistory, 1, gameIndex, false)[0];
      if (picked) choices.push({ slot: "stat", card: picked });
    }
    return choices;
  },

  // ---------------------------------------------------------
  // TREASURE / BONUS TARGET宝箱：共通の抽選テーブル
  // qualityが高いほど（Silver>Bronze）上位レア度が出やすくなる。
  // ---------------------------------------------------------
  rollTreasureCategory() {
    const table = CONFIG.TREASURE.CATEGORY_WEIGHTS;
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (const [category, weight] of Object.entries(table)) {
      roll -= weight;
      if (roll <= 0) return category;
    }
    return "board";
  },

  // count個の盤面カード候補を返す（3択から1つ選ばせる想定）
  buildBoardCardChoices(player, gameIndex, quality) {
    const boosted = quality === "silver" || quality === "gold";
    const picked = DeckSystem.pickChoicesWeighted(BOARD_CARDS, player.boardCards, CONFIG.TREASURE.BOARD_CHOICE_COUNT, gameIndex, boosted);
    return picked.map((card) => ({ slot: "board", card }));
  },

  // 装備の宝箱：職業に合った武器/防具/お守りから1つ
  buildEquipmentChoice(player, gameIndex, quality) {
    const boosted = quality === "silver" || quality === "gold";
    const weaponPool = player.classType === "SWORDSMAN" ? SWORDSMAN_WEAPONS : MAGE_WEAPONS;
    const ownedArmorIds = player.armor.map((a) => a.id);
    const ownedCharmIds = player.charms.map((c) => c.id);
    const pools = [
      { slot: "weapon", pool: weaponPool, owned: player.weapon ? [player.weapon] : [] },
      { slot: "armor", pool: ARMOR_LIST.filter((a) => !ownedArmorIds.includes(a.id)), owned: player.armor },
      { slot: "charm", pool: CHARM_LIST.filter((c) => !ownedCharmIds.includes(c.id)), owned: player.charms },
    ];
    const choice = pools[Math.floor(Math.random() * pools.length)];
    const picked = DeckSystem.pickChoicesWeighted(choice.pool, choice.owned, 1, gameIndex, boosted)[0];
    return picked ? { slot: choice.slot, card: picked } : null;
  },

  // ステータスカード1枚（宝箱の中身用）
  buildStatChoice(player, gameIndex, quality) {
    const boosted = quality === "silver" || quality === "gold";
    const picked = DeckSystem.pickChoicesWeighted(STAT_CARDS, player.statCardHistory, 1, gameIndex, boosted)[0];
    return picked ? { slot: "stat", card: picked } : null;
  },

  // TREASURE / BONUS TARGET宝箱を開けた時の中身を1つ決める
  // （盤面カードだけ3択、それ以外は1点もの）。
  openChest(player, gameIndex, quality) {
    const category = this.rollTreasureCategory();
    if (category === "board") return { category, choices: this.buildBoardCardChoices(player, gameIndex, quality) };
    if (category === "stat") return { category, choices: [this.buildStatChoice(player, gameIndex, quality)].filter(Boolean) };
    if (category === "equipment") return { category, choices: [this.buildEquipmentChoice(player, gameIndex, quality)].filter(Boolean) };
    if (category === "gold") return { category, gold: CONFIG.TREASURE.GOLD_AMOUNT_BY_QUALITY[quality] || CONFIG.TREASURE.GOLD_AMOUNT_BY_QUALITY.bronze };
    return { category: "special", gold: CONFIG.TREASURE.SPECIAL_GOLD_FALLBACK }; // デモ版では特殊報酬は仮にGoldで代替
  },
};
