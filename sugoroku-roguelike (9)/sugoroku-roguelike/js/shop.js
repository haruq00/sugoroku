// ============================================================
// shop.js
// すごろく盤の「ショップ」マスに停止した時に開く、
// 武器・お守りの購入、品揃えのリロール、所持カード／お守りの
// 削除を行うための画面を担当します。
//
// お金の出入りだけを扱い、ゲーム進行の再開はonCloseコールバックで
// game.js側に委ねます（マス処理の続きに戻るため）。
// ============================================================

const Shop = {
  onCloseCallback: null,
  currentWeaponOffers: [],
  currentOmamoriOffers: [],

  // ショップを開く。閉じた時にonCloseが呼ばれる（マス処理を再開するため）。
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

  // ゲーム数に応じたレア度の重みで1件選ぶ（解禁されていないレア度は出ない）。
  // excludeIds に含まれるidは選ばない（品揃えの中で重複させないため）。
  pickItemFromPool(pool, excludeIds) {
    const rarity = ItemRarity.pick(GameState.gameIndex, CONFIG.SHOP_RARITY_BASE_WEIGHTS, CONFIG.SHOP_RARITY_GAME_GROWTH);
    let candidates = pool.filter((item) => item.rarityId === rarity && !excludeIds.includes(item.id));
    if (candidates.length === 0) candidates = pool.filter((item) => !excludeIds.includes(item.id));
    if (candidates.length === 0) candidates = pool; // 全て除外済みならやむを得ず重複を許容する
    return candidates[Math.floor(Math.random() * candidates.length)];
  },

  // 品揃えをランダムに決める（同じカテゴリ内で重複しないようにする）
  rollOffers() {
    const weaponCount = CONFIG.SHOP.weaponOffers;
    const omamoriCount = CONFIG.SHOP.omamoriOffers;
    this.currentWeaponOffers = [];
    this.currentOmamoriOffers = [];

    const usedWeaponIds = [];
    for (let i = 0; i < weaponCount; i++) {
      const picked = this.pickItemFromPool(CONFIG.WEAPONS, usedWeaponIds);
      this.currentWeaponOffers.push(picked);
      usedWeaponIds.push(picked.id);
    }

    const usedOmamoriIds = [];
    for (let i = 0; i < omamoriCount; i++) {
      const picked = this.pickItemFromPool(CONFIG.OMAMORI, usedOmamoriIds);
      this.currentOmamoriOffers.push(picked);
      usedOmamoriIds.push(picked.id);
    }
  },

  // リロール／削除のコストは「使うほど」「ゲームが進むほど」高くなる
  getRerollCost() {
    const s = CONFIG.SHOP;
    const base = s.REROLL_BASE_COST * Math.pow(s.REROLL_COST_GROWTH_PER_GAME, GameState.gameIndex);
    return Math.round(base * Math.pow(s.REROLL_COST_GROWTH_PER_USE, GameState.rerollUseCount));
  },

  getDeleteCost() {
    const s = CONFIG.SHOP;
    const base = s.DELETE_BASE_COST * Math.pow(s.DELETE_COST_GROWTH_PER_GAME, GameState.gameIndex);
    return Math.round(base * Math.pow(s.DELETE_COST_GROWTH_PER_USE, GameState.deleteUseCount));
  },

  reroll() {
    const cost = this.getRerollCost();
    if (GameState.walletGold < cost) return;
    GameState.walletGold -= cost;
    GameState.rerollUseCount += 1;
    this.rollOffers();
    this.render();
    UI.updateStatusBar();
  },

  buyWeapon(weapon) {
    if (GameState.walletGold < weapon.price) return;
    GameState.walletGold -= weapon.price;
    GameState.equipWeapon(weapon);
    this.render();
    UI.updateStatusBar();
    Debug.log(`Shop: bought weapon ${weapon.name}`);
  },

  buyOmamori(omamori) {
    if (GameState.walletGold < omamori.price) return;
    GameState.walletGold -= omamori.price;
    GameState.acquireOmamori(omamori);
    this.render();
    UI.updateStatusBar();
    Debug.log(`Shop: bought omamori ${omamori.name}`);
  },

  deleteCard(index) {
    const cost = this.getDeleteCost();
    if (GameState.walletGold < cost) return;
    GameState.walletGold -= cost;
    GameState.deleteUseCount += 1;
    GameState.removeCard(index);
    this.render();
    UI.updateStatusBar();
  },

  deleteOmamori(index) {
    const cost = this.getDeleteCost();
    if (GameState.walletGold < cost) return;
    GameState.walletGold -= cost;
    GameState.deleteUseCount += 1;
    GameState.removeOmamori(index);
    this.render();
    UI.updateStatusBar();
  },

  // ---------------------------------------------------------
  // 描画
  // ---------------------------------------------------------
  render() {
    document.getElementById("shop-gold-value").textContent = GameState.walletGold;

    const rerollCost = this.getRerollCost();
    const deleteCost = this.getDeleteCost();
    document.getElementById("shop-reroll-cost").textContent = rerollCost;
    document.getElementById("shop-delete-cost").textContent = deleteCost;

    this.renderWeaponList();
    this.renderOmamoriList();
    this.renderOwnedList(deleteCost);

    const rerollBtn = document.getElementById("shop-reroll-btn");
    rerollBtn.disabled = GameState.walletGold < rerollCost;
  },

  renderWeaponList() {
    const list = document.getElementById("shop-weapon-list");
    list.innerHTML = "";

    const equippedName = GameState.player.weapon ? GameState.player.weapon.name : "素手";
    const equippedLine = document.createElement("div");
    equippedLine.className = "shop-equipped-line";
    equippedLine.textContent = `現在の装備: ${equippedName}`;
    list.appendChild(equippedLine);

    this.currentWeaponOffers.forEach((weapon) => {
      const card = this.buildItemCard(weapon, weapon.price, () => this.buyWeapon(weapon));
      list.appendChild(card);
    });
  },

  renderOmamoriList() {
    const list = document.getElementById("shop-omamori-list");
    list.innerHTML = "";
    this.currentOmamoriOffers.forEach((omamori) => {
      const card = this.buildItemCard(omamori, omamori.price, () => this.buyOmamori(omamori));
      list.appendChild(card);
    });
  },

  // 商品1つぶんのカードDOMを作る（アイコン・名前(レア度色つき)・説明・価格・購入ボタン）
  buildItemCard(item, price, onBuy) {
    const card = document.createElement("div");
    card.className = "shop-item-card";

    const icon = document.createElement("div");
    icon.className = "shop-item-icon icon-fallback";
    icon.textContent = "✨";
    AssetManager.applyToElement(icon, item.id, "icon-fallback");
    if (icon.classList.contains("has-image")) icon.textContent = "";

    const info = document.createElement("div");
    info.className = "shop-item-info";
    const color = ItemRarity.getColor(item.rarityId);
    const rarityName = ItemRarity.getName(item.rarityId);
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

  // 所持中のカード／お守りを削除できるリスト
  renderOwnedList(deleteCost) {
    const list = document.getElementById("shop-owned-list");
    list.innerHTML = "";

    GameState.cards.forEach((cardItem, index) => {
      list.appendChild(this.buildDeletableRow(cardItem, deleteCost, () => this.deleteCard(index)));
    });
    GameState.omamori.forEach((omamoriItem, index) => {
      list.appendChild(this.buildDeletableRow(omamoriItem, deleteCost, () => this.deleteOmamori(index)));
    });

    if (GameState.cards.length === 0 && GameState.omamori.length === 0) {
      const empty = document.createElement("div");
      empty.className = "shop-owned-empty";
      empty.textContent = "削除できるカード・お守りはまだありません。";
      list.appendChild(empty);
    }
  },

  buildDeletableRow(item, cost, onDelete) {
    const row = document.createElement("div");
    row.className = "shop-owned-row";

    const color = ItemRarity.getColor(item.rarityId);
    const name = document.createElement("div");
    name.className = "shop-owned-name";
    name.style.color = color;
    name.textContent = item.name;

    const delBtn = document.createElement("button");
    delBtn.className = "shop-delete-btn";
    delBtn.textContent = `削除 (${cost}G)`;
    delBtn.disabled = GameState.walletGold < cost;
    delBtn.addEventListener("click", onDelete);

    row.appendChild(name);
    row.appendChild(delBtn);
    return row;
  },
};
