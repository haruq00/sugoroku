// ============================================================
// deckSystem.js
// 「戦闘デッキ」「すごろくカード」「装備（武器/防具/お守り）」
// 「ステータス強化カード」に共通するデッキ管理（プール取得・上限判定・
// 追加・交換・削除）を1箇所にまとめたファイルです。同じ形のAPIで
// 扱えるので、UI側（shop.js/game.js）もこのファイルだけを見れば済みます。
// ============================================================

const DeckSystem = {
  // ---------------------------------------------------------
  // プール取得（職業フィルタ）
  // ---------------------------------------------------------
  getAvailableBattleCards(classType) {
    return ALL_BATTLE_CARDS.filter((c) => c.classType === "COMMON" || c.classType === classType);
  },
  getAvailableBoardCards() {
    // すごろくカードは基本汎用（すべてclassType:"COMMON"）
    return BOARD_CARDS.filter((c) => c.classType === "COMMON");
  },

  // ---------------------------------------------------------
  // 上限判定・追加・交換・削除（3種類共通）
  // deck: 対象の配列（player.battleDeck / player.boardCards / player.armor / player.charms）
  // maxSize: その配列の上限
  // ---------------------------------------------------------
  isFull(deck, maxSize) {
    return deck.length >= maxSize;
  },
  canAdd(deck, maxSize) {
    return !this.isFull(deck, maxSize);
  },
  add(deck, card) {
    deck.push(Object.assign({}, card));
  },
  replaceAt(deck, index, newCard) {
    deck.splice(index, 1, Object.assign({}, newCard));
  },
  removeAt(deck, index) {
    deck.splice(index, 1);
  },

  // count枚の抽選候補を選ぶ（同じidの所持数がmaxCopiesに達しているものは除外）
  pickChoices(pool, deck, count) {
    const countInDeck = (id) => deck.filter((c) => c.id === id).length;
    const eligible = pool.filter((c) => countInDeck(c.id) < (c.maxCopies || CONFIG.CARD_DEFAULT_MAX_COPIES));
    const shuffled = eligible.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  // レア度の重み付き抽選込みでcount枚選ぶ（boostedならREWARD_RARITY_WEIGHTS_BOOSTEDを使う）
  pickChoicesWeighted(pool, deck, count, gameIndex, boosted) {
    const weights = boosted ? CONFIG.REWARD_RARITY_WEIGHTS_BOOSTED : CONFIG.REWARD_RARITY_WEIGHTS;
    const countInDeck = (id) => deck.filter((c) => c.id === id).length;
    const eligible = pool.filter((c) => countInDeck(c.id) < (c.maxCopies || CONFIG.CARD_DEFAULT_MAX_COPIES));

    const chosen = [];
    const usedIds = new Set();
    for (let i = 0; i < count; i++) {
      const rarity = ItemRarity.pick(gameIndex, weights);
      let candidates = eligible.filter((c) => c.rarity === rarity && !usedIds.has(c.id));
      if (candidates.length === 0) candidates = eligible.filter((c) => !usedIds.has(c.id));
      if (candidates.length === 0) break;
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      chosen.push(pick);
      usedIds.add(pick.id);
    }
    return chosen;
  },

  // 集計：デッキ内のタグ出現数を数える（デッキ画面のビルド表示用）
  summarizeTags(deck) {
    const counts = {};
    deck.forEach((card) => {
      (card.tags || []).forEach((tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  },
};
