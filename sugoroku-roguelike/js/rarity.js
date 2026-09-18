// ============================================================
// rarity.js
// パッシブ・カード・お守り・武器のレア度（NORMAL/RARE/EPIC/
// LEGENDARY/PREDATOR）に関する共通処理をまとめたヘルパーです。
//
// ・ゲーム数(gameIndex)に応じて、まだ解禁されていないレア度を
//   抽選対象から除外する。
// ・重み表(weights)に従って、解禁済みレア度の中から1つ抽選する。
// ・レア度の表示色・表示名を取得する。
// ============================================================

const ItemRarity = {
  // gameIndex時点で解禁済みのレア度一覧を返す
  getAvailable(gameIndex) {
    return CONFIG.ITEM_RARITIES.filter((r) => gameIndex >= r.unlockGame);
  },

  // weights: {rarityId: 重み}。growth（省略可）: {rarityId: gameIndexごとの重み増分}。
  // 解禁済みのレア度だけを対象に、重み付きで1つ抽選してrarityIdを返す。
  pick(gameIndex, weights, growth) {
    const available = this.getAvailable(gameIndex);
    if (available.length === 0) return "normal";

    let total = 0;
    const effective = {};
    available.forEach((r) => {
      let w = weights[r.id] || 0;
      if (growth && growth[r.id]) {
        w = Math.max(0, w + growth[r.id] * gameIndex);
      }
      effective[r.id] = w;
      total += w;
    });

    if (total <= 0) return available[0].id;

    let roll = Math.random() * total;
    for (const r of available) {
      roll -= effective[r.id];
      if (roll <= 0) return r.id;
    }
    return available[available.length - 1].id;
  },

  getColor(rarityId) {
    const r = CONFIG.ITEM_RARITIES.find((x) => x.id === rarityId);
    return r ? r.color : "#f5f3ff";
  },

  getName(rarityId) {
    const r = CONFIG.ITEM_RARITIES.find((x) => x.id === rarityId);
    return r ? r.name : (rarityId || "").toUpperCase();
  },
};
