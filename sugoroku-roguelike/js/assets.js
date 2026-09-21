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
  player_run_1: "assets/player/player_run_1.png",
  player_run_2: "assets/player/player_run_2.png",
  player_attack: "assets/player/player_attack.png",

  slime: "assets/monsters/slime.png",
  goblin: "assets/monsters/goblin.png",
  orc: "assets/monsters/orc.png",
  golem: "assets/monsters/golem.png",

  tile_start: "assets/tiles/start.png",
  tile_enemy: "assets/tiles/enemy.png",
  tile_gold: "assets/tiles/gold.png",
  tile_negative: "assets/tiles/negative.png",
  tile_treasure: "assets/tiles/treasure.png",
  tile_danger: "assets/tiles/danger.png",
  tile_goal: "assets/tiles/goal.png",
  tile_shop: "assets/tiles/shop.png",
  tile_heal: "assets/tiles/heal.png",

  ui_coin: "assets/ui/coin.png",
  ui_medal: "assets/ui/medal.png",
  ui_dice: "assets/ui/dice.png",

  character_swordsman: "assets/characters/swordsman.png",
  character_mage: "assets/characters/mage.png",
  boss1: "assets/monsters/boss1.png",
  boss2: "assets/monsters/boss2.png",
};

// お守り／武器／防具／ステータスカード／盤面カード／戦闘カード／Bossパッシブの
// 画像パスは、各データのidから自動的に組み立てる（id → assets/<種類>/<id>.png）。
// 画像を用意したい場合はこのパスに置くだけで反映される。新しいカード/装備を
// 追加してもここは変更不要（データ配列にidを足すだけで自動登録される）。
(typeof ALL_WEAPONS !== "undefined" ? ALL_WEAPONS : []).forEach((w) => {
  ASSET_PATHS[w.id] = `assets/weapons/${w.id}.png`;
});
(typeof ARMOR_LIST !== "undefined" ? ARMOR_LIST : []).forEach((a) => {
  ASSET_PATHS[a.id] = `assets/armor/${a.id}.png`;
});
(typeof CHARM_LIST !== "undefined" ? CHARM_LIST : []).forEach((c) => {
  ASSET_PATHS[c.id] = `assets/charms/${c.id}.png`;
});
(typeof STAT_CARDS !== "undefined" ? STAT_CARDS : []).forEach((c) => {
  ASSET_PATHS[c.id] = `assets/statcards/${c.id}.png`;
});
(typeof ALL_BATTLE_CARDS !== "undefined" ? ALL_BATTLE_CARDS : []).forEach((c) => {
  ASSET_PATHS[c.id] = `assets/battlecards/${c.id}.png`;
});
(typeof BOARD_CARDS !== "undefined" ? BOARD_CARDS : []).forEach((c) => {
  ASSET_PATHS[c.id] = `assets/boardcards/${c.id}.png`;
});
(typeof BOSS1_PASSIVES !== "undefined" ? BOSS1_PASSIVES : []).forEach((p) => {
  ASSET_PATHS[p.id] = `assets/passives/${p.id}.png`;
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
