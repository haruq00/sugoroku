// ============================================================
// shop.js
// すごろく盤の「ショップ」マスに停止した時に開く画面です。
// 今回の整理で、主要な成長要素（アクションカード・ステータス強化
// カード・盤面強化カード・武器・防具・お守り）をすべてGoldで
// 購入できるようにしました。カテゴリごとに品揃え数・価格倍率を
// config.jsのSHOP / SHOP_PRICE_BY_RARITY / SHOP_PRICE_CATEGORY_MULTで
// 管理しているので、新しい商品を増やしたい時はデータ側に追加するだけで
// このファイルの変更は不要です。
//
// お金の出入りだけを扱い、ゲーム進行の再開はonCloseコールバックで
// game.js側に委ねます（マス処理の続きに戻るため）。
// ============================================================

const Shop = {
  onCloseCallback: null,
  offers: { action: [], stat: [], board: [], weapon: [], armor: [], charm: [] },

  CATEGORY_LABELS: { action: "アクション", stat: "ステータス", board: "すごろく", weapon: "武器", armor: "防具", charm: "お守り" },

  open(onClose) {
    this.onCloseCallback = onClose;
    this.rollOffers();
    this.render();
    document.getElementById("shop-overlay").classList.remove("hidden");
  },

  close() {
    document.getElementById("shop-overlay").classList.add("hidden");
    const cb = this.onCloseCallback;
    this.onCloseCallback = null;
    cb && cb();
  },

  // カテゴリごとのプール（職業フィルタが必要なものはここで絞り込む）
  getPool(category) {
    const classType = GameState.player.classType;
    switch (category) {
      case "action": return DeckSystem.getAvailableBattleCards(classType);
      case "stat": return STAT_CARDS;
      case "board": return BOARD_CARDS;
      case "weapon": return classType === "SWORDSMAN" ? SWORDSMAN_WEAPONS : MAGE_WEAPONS;
      case "armor": return ARMOR_LIST;
      case "charm": return CHARM_LIST;
      default: return [];
    }
  },

  getOwned(category) {
    const p = GameState.player;
    switch (category) {
      case "action": return p.battleDeck;
      case "stat": return p.statCardHistory;
      case "board": return p.boardCards;
      case "weapon": return p.weapon ? [p.weapon] : [];
      case "armor": return p.armor;
      case "charm": return p.charms;
      default: return [];
    }
  },

  pickItemFromPool(pool, excludeIds) {
    const rarity = ItemRarity.pick(GameState.gameIndex, CONFIG.SHOP_RARITY_BASE_WEIGHTS, CONFIG.SHOP_RARITY_GAME_GROWTH);
    let candidates = pool.filter((item) => item.rarity === rarity && !excludeIds.includes(item.id));
    if (candidates.length === 0) candidates = pool.filter((item) => !excludeIds.includes(item.id));
    if (candidates.length === 0) candidates = pool;
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  rollOffers() {
    const counts = { action: CONFIG.SHOP.actionCardOffers, stat: CONFIG.SHOP.statCardOffers, board: CONFIG.SHOP.boardCardOffers,
      weapon: CONFIG.SHOP.weaponOffers, armor: CONFIG.SHOP.armorOffers, charm: CONFIG.SHOP.charmOffers };
    Object.keys(counts).forEach((category) => {
      // 防具・お守りは同じものを重複して持てないため、既に所持しているidは品揃えから除外する
      const excludeOwned = ["armor", "charm"].includes(category) ? this.getOwned(category).map((o) => o.id) : [];
      const pool = this.getPool(category).filter((item) => !excludeOwned.includes(item.id));
      const used = [];
      const list = [];
      for (let i = 0; i < counts[category] && pool.length > 0; i++) {
        const picked = this.pickItemFromPool(pool, used);
        if (!picked) break;
        list.push(picked);
        used.push(picked.id);
      }
      this.offers[category] = list;
    });
  },

  getPrice(category, item) {
    const base = CONFIG.SHOP_PRICE_BY_RARITY[item.rarity] || CONFIG.SHOP_PRICE_BY_RARITY.normal;
    const mult = CONFIG.SHOP_PRICE_CATEGORY_MULT[category] || 1;
    const discount = (GameState.player && GameState.player.bossShopDiscount) || 0;
    const surcharge = (GameState.player && GameState.player.equipShopPriceRate) || 0;
    return Math.max(1, Math.round(base * mult * (1 - discount) * (1 + surcharge)));
  },

  getRerollCost() {
    return CONFIG.SHOP.REROLL_BASE_COST + CONFIG.SHOP.REROLL_COST_STEP * GameState.rerollUseCount;
  },

  reroll() {
    const cost = this.getRerollCost();
    if (GameState.walletGold < cost) return;
    GameState.walletGold -= cost;
    GameState.player.walletGoldSnapshot = GameState.walletGold;
    GameState.rerollUseCount += 1;
    this.rollOffers();
    this.render();
    UI.updateStatusBar();
  },

  // 購入処理（カテゴリ共通）。action/statはデッキ/履歴上限を考慮し、
  // weapon/armor/charmは装備上限を考慮して、必要ならgame.js側の交換UIを呼ぶ。
  buy(category, item) {
    const price = this.getPrice(category, item);
    if (GameState.walletGold < price) return;
    GameState.walletGold -= price;
    GameState.player.walletGoldSnapshot = GameState.walletGold;

    // 品揃えから取り除く（在庫がちゃんと無くなるようにする）
    const idx = this.offers[category].indexOf(item);
    if (idx !== -1) this.offers[category].splice(idx, 1);

    GameState.acquireShopItem(category, item, () => {
      this.render();
      UI.updateStatusBar();
    });
    Debug.log(`Shop: bought [${category}] ${item.name}`);
  },

  deleteActionCard(index) {
    const cost = CONFIG.SHOP.DELETE_ACTION_CARD_COST;
    if (GameState.walletGold < cost) return;
    GameState.walletGold -= cost;
    GameState.player.walletGoldSnapshot = GameState.walletGold;
    GameState.removeCard(index);
    this.render();
    UI.updateStatusBar();
  },

  // ---------------------------------------------------------
  // 描画
  // ---------------------------------------------------------
  render() {
    document.getElementById("shop-gold-value").textContent = GameState.walletGold;
    document.getElementById("shop-reroll-cost").textContent = this.getRerollCost();
    document.getElementById("shop-delete-cost").textContent = CONFIG.SHOP.DELETE_ACTION_CARD_COST;

    this.renderCategoryList("action", "shop-action-list");
    this.renderCategoryList("stat", "shop-stat-list");
    this.renderCategoryList("board", "shop-board-list");
    this.renderCategoryList("weapon", "shop-weapon-list");
    this.renderCategoryList("armor", "shop-armor-list");
    this.renderCategoryList("charm", "shop-charm-list");
    this.renderOwnedList();

    document.getElementById("shop-reroll-btn").disabled = GameState.walletGold < this.getRerollCost();
  },

  renderCategoryList(category, listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.innerHTML = "";
    this.offers[category].forEach((item) => {
      list.appendChild(this.buildItemCard(category, item, this.getPrice(category, item), () => this.buy(category, item)));
    });
    if (this.offers[category].length === 0) {
      const soldOut = document.createElement("div");
      soldOut.className = "shop-sold-out";
      soldOut.textContent = "売り切れ";
      list.appendChild(soldOut);
    }
  },

  buildItemCard(category, item, price, onBuy) {
    const card = document.createElement("div");
    card.className = "shop-item-card";

    const icon = document.createElement("div");
    icon.className = "shop-item-icon icon-fallback";
    icon.textContent = "✨";
    AssetManager.applyToElement(icon, item.id, "icon-fallback");
    if (icon.classList.contains("has-image")) icon.textContent = "";

    const info = document.createElement("div");
    info.className = "shop-item-info";
    const color = ItemRarity.getColor(item.rarity);
    const rarityName = ItemRarity.getName(item.rarity);
    info.innerHTML = `
      <div class="shop-item-name" style="color:${color}">[${rarityName}] ${item.name}</div>
      <div class="shop-item-desc">${item.description}</div>
    `;

    const buyBtn = document.createElement("button");
    buyBtn.className = "shop-buy-btn";
    buyBtn.textContent = `${price}G`;
    buyBtn.disabled = GameState.walletGold < price;
    buyBtn.addEventListener("click", onBuy);

    card.appendChild(icon);
    card.appendChild(info);
    card.appendChild(buyBtn);
    return card;
  },

  // 所持中のアクションカードだけ削除できるリスト（デモ版はここに絞っている）
  renderOwnedList() {
    const list = document.getElementById("shop-owned-list");
    if (!list) return;
    list.innerHTML = "";
    const cost = CONFIG.SHOP.DELETE_ACTION_CARD_COST;

    GameState.player.battleDeck.forEach((card, index) => {
      const row = document.createElement("div");
      row.className = "shop-owned-row";
      const color = ItemRarity.getColor(card.rarity);
      const name = document.createElement("div");
      name.className = "shop-owned-name";
      name.style.color = color;
      name.textContent = card.name;
      const delBtn = document.createElement("button");
      delBtn.className = "shop-delete-btn";
      delBtn.textContent = `削除 (${cost}G)`;
      delBtn.disabled = GameState.walletGold < cost;
      delBtn.addEventListener("click", () => this.deleteActionCard(index));
      row.appendChild(name);
      row.appendChild(delBtn);
      list.appendChild(row);
    });

    if (GameState.player.battleDeck.length === 0) {
      const empty = document.createElement("div");
      empty.className = "shop-owned-empty";
      empty.textContent = "削除できるアクションカードはまだありません。";
      list.appendChild(empty);
    }
  },
};
