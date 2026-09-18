// ============================================================
// assets.js
// 画像読み込みを一箇所にまとめるファイル。
// 画像ファイルが assets/ 以下に存在しない場合は、自動的に
// CSSによる仮表示（色付き四角形など）にフォールバックします。
//
// ドット絵を追加したい場合は、このファイルの ASSET_PATHS に
// 書かれているパスに画像ファイルを置くだけで反映されます。
// ============================================================

const ASSET_PATHS = {
  player_idle: "assets/player/player_idle.png",

  slime: "assets/monsters/slime.png",
  goblin: "assets/monsters/goblin.png",
  orc: "assets/monsters/orc.png",
  golem: "assets/monsters/golem.png",

  tile_enemy: "assets/tiles/enemy.png",
  tile_gold: "assets/tiles/gold.png",
  tile_negative: "assets/tiles/negative.png",
  tile_treasure: "assets/tiles/treasure.png",
  tile_danger: "assets/tiles/danger.png",
  tile_goal: "assets/tiles/goal.png",
  tile_shop: "assets/tiles/shop.png",

  ui_coin: "assets/ui/coin.png",
  ui_medal: "assets/ui/medal.png",
  ui_dice: "assets/ui/dice.png",
};

// パッシブ／カード／お守り／武器の画像パスは、config.jsのidから自動的に組み立てる。
// 例：id "passive_power" → assets/passives/passive_power.png
// 画像を用意したい場合はこのパスに置くだけで、選択画面やMENU・ショップ画面に反映されます。
(CONFIG.PASSIVES || []).forEach((p) => {
  ASSET_PATHS[p.id] = `assets/passives/${p.id}.png`;
});
(CONFIG.CARDS || []).forEach((c) => {
  ASSET_PATHS[c.id] = `assets/cards/${c.id}.png`;
});
(CONFIG.OMAMORI || []).forEach((o) => {
  ASSET_PATHS[o.id] = `assets/omamori/${o.id}.png`;
});
(CONFIG.WEAPONS || []).forEach((w) => {
  ASSET_PATHS[w.id] = `assets/weapons/${w.id}.png`;
});

const AssetManager = {
  status: {}, // key -> true(読み込み成功) / false(失敗＝仮表示を使う)

  // 起動時に全画像の存在チェックを行う（無くてもエラーにしない）
  preload(callback) {
    const keys = Object.keys(ASSET_PATHS);
    let remaining = keys.length;
    if (remaining === 0) {
      callback && callback();
      return;
    }

    keys.forEach((key) => {
      const img = new Image();
      img.onload = () => {
        this.status[key] = true;
        done();
      };
      img.onerror = () => {
        this.status[key] = false;
        done();
      };
      img.src = ASSET_PATHS[key];
    });

    function done() {
      remaining -= 1;
      if (remaining <= 0) callback && callback();
    }
  },

  // 画像が使用可能ならURLを、無ければnullを返す
  getImageUrl(key) {
    if (this.status[key]) return ASSET_PATHS[key];
    return null;
  },

  // 要素に「画像 or CSSフォールバッククラス」を適用する共通処理
  applyToElement(element, key, fallbackClass) {
    if (!element) return;
    const url = this.getImageUrl(key);
    if (url) {
      element.style.backgroundImage = `url("${url}")`;
      element.classList.add("has-image");
      element.classList.remove(fallbackClass);
    } else {
      element.style.backgroundImage = "";
      element.classList.remove("has-image");
      element.classList.add(fallbackClass);
    }
  },
};
