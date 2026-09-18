// ============================================================
// board.js
// すごろく盤（長方形の外周・中央は空白のリング状コース）の
// 生成・描画・移動アニメーションを担当します。
// ゲームの勝敗ロジックは持たず、「盤の見た目と移動」だけに専念します。
//
// レイアウトの考え方：
//   BOARD_GRID_COLS × BOARD_GRID_ROWS の長方形の「外周マスだけ」を使う。
//   例：7×4なら 上段7 + 右側2 + 下段7 + 左側2 = 18マスの周回コース。
//   中央のマス（5×2ぶん）は使用せず空白のままになる。
// ============================================================

const Board = {
  tileTypes: [],     // 各マスの種別 ("start","enemy","gold",...)
  tileElements: [],  // 各マスのDOM要素
  tilePositions: [], // 各マスの左上座標 {x, y}（board-track内の相対座標）
  tileSize: 0,       // 1マスの一辺のピクセルサイズ
  currentIndex: 0,   // プレイヤーの現在マスindex（ラウンドをまたいで保持される）

  // stageKeyに応じた盤面構成を読み込んで描画する（ゲーム開始時にのみ呼ばれる）。
  // マスの内訳(counts)は固定だが、並び順はゲームごとにランダムにシャッフルする。
  init(stageKey) {
    const stage = CONFIG.STAGES[stageKey] || CONFIG.STAGES.STANDARD;
    this.tileTypes = this.generateLayoutFromCounts(stage.counts);
    this.currentIndex = 0; // 新しいゲームの最初だけ位置をリセットする
    this.render();
  },

  // マスの内訳(counts)から、start以外をシャッフルした盤面配列を作る。
  // start は必ず先頭（index 0）に固定する。
  generateLayoutFromCounts(counts) {
    const pool = [];
    Object.keys(counts).forEach((type) => {
      if (type === "start") return; // startは別途先頭に固定する
      for (let i = 0; i < counts[type]; i++) pool.push(type);
    });

    // Fisher-Yatesシャッフル
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    return ["start", ...pool];
  },

  // インデックス i を「長方形の外周」上の (col,row) に変換する。
  // 時計回りに、左上(0,0)から右方向へスタートする。
  indexToGridPos(i, cols, rows) {
    const topCount = cols;               // 上段：左→右
    const rightCount = rows - 2;         // 右側：上から下（角は除く）
    const bottomCount = cols;            // 下段：右→左
    // 左側の残り: rows - 2（角は除く）

    if (i < topCount) {
      return { col: i, row: 0 };
    }
    i -= topCount;
    if (i < rightCount) {
      return { col: cols - 1, row: 1 + i };
    }
    i -= rightCount;
    if (i < bottomCount) {
      return { col: cols - 1 - i, row: rows - 1 };
    }
    i -= bottomCount;
    // 左側：下から上へ（角は除く）
    return { col: 0, row: rows - 2 - i };
  },

  // 盤面をDOMに描画する（長方形の外周リング状コース）
  // 注意：ラウンドが変わっても呼び直さないので、プレイヤーの位置は保持される。
  render() {
    const track = document.getElementById("board-track");
    track.innerHTML = "";
    this.tileElements = [];
    this.tilePositions = [];

    const tileSize = CONFIG.BOARD_TILE_SIZE;
    this.tileSize = tileSize;
    const cols = CONFIG.BOARD_GRID_COLS;
    const rows = CONFIG.BOARD_GRID_ROWS;
    const count = this.tileTypes.length;

    track.style.width = `${cols * tileSize}px`;
    track.style.height = `${rows * tileSize}px`;

    for (let i = 0; i < count; i++) {
      const { col, row } = this.indexToGridPos(i, cols, rows);
      const x = col * tileSize;
      const y = row * tileSize;
      this.tilePositions.push({ x, y });

      const type = this.tileTypes[i];
      const visualClass = this.getTileVisualClass(type);

      const el = document.createElement("div");
      el.className = `tile tile-${visualClass}`;
      el.style.width = `${tileSize}px`;
      el.style.height = `${tileSize}px`;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.dataset.index = i;
      el.textContent = this.getTileLabel(type);

      const assetKey = this.getTileAssetKey(type);
      if (assetKey) {
        AssetManager.applyToElement(el, assetKey, `tile-fallback-${visualClass}`);
      }

      track.appendChild(el);
      this.tileElements.push(el);
    }

    // プレイヤートークンを配置（毎回作り直すが、位置(currentIndex)自体は保持される）
    const oldToken = document.getElementById("board-player-token");
    if (oldToken) oldToken.remove();
    const token = document.createElement("div");
    token.id = "board-player-token";
    const tokenSize = Math.round(tileSize * 0.5); // マスの半分くらいの大きさ
    token.style.width = `${tokenSize}px`;
    token.style.height = `${tokenSize}px`;
    track.appendChild(token);
    this.updatePlayerTokenPosition();
  },

  // マス種別から見た目上のクラス名を決める
  getTileVisualClass(type) {
    if (type === "start") return "start";
    if (type === "special_treasure") return "treasure";
    if (type === "special_danger") return "danger";
    return type; // enemy, gold, negative, shop
  },

  // マス上に表示するアイコン（絵文字）。一目でマスの効果がわかるようにするための表示。
  getTileLabel(type) {
    return CONFIG.TILE_ICONS[type] || "";
  },

  getTileAssetKey(type) {
    switch (type) {
      case "start": return "tile_goal";
      case "enemy": return "tile_enemy";
      case "gold": return "tile_gold";
      case "negative": return "tile_negative";
      case "special_treasure": return "tile_treasure";
      case "special_danger": return "tile_danger";
      case "shop": return "tile_shop";
      default: return null;
    }
  },

  // プレイヤートークンを現在マスの中央に配置する（マスの半分サイズ）
  updatePlayerTokenPosition() {
    const token = document.getElementById("board-player-token");
    if (!token) return;
    const pos = this.tilePositions[this.currentIndex];
    if (!pos) return;
    const tokenSize = Math.round(this.tileSize * 0.5);
    const centerX = pos.x + this.tileSize / 2 - tokenSize / 2;
    const centerY = pos.y + this.tileSize / 2 - tokenSize / 2;
    token.style.left = `${centerX}px`;
    token.style.top = `${centerY}px`;
  },

  // steps分だけ1マスずつアニメーションしながら移動する。
  // onStep(newIndex, passedGoal) が1マス進むごとに呼ばれる。
  // onComplete() が全ての移動が終わった後に呼ばれる。
  movePlayer(steps, onStep, onComplete) {
    if (!this.tileTypes || this.tileTypes.length === 0) {
      // 盤面が未初期化のまま呼ばれた場合は、ここで気づけるようにする
      console.error("Board.movePlayer: 盤面が初期化されていません（tileTypesが空）");
      onComplete && onComplete();
      return;
    }

    let remaining = steps;
    const stepDelay = CONFIG.BOARD_STEP_DELAY_MS; // 1マスあたりの移動間隔(ms)

    const stepOnce = () => {
      if (remaining <= 0) {
        onComplete && onComplete();
        return;
      }
      const prevIndex = this.currentIndex;
      this.currentIndex = (this.currentIndex + 1) % this.tileTypes.length;
      const passedGoal = this.currentIndex === 0 && prevIndex !== 0;

      this.updatePlayerTokenPosition();
      EventHooks.trigger("onMoveStep", { index: this.currentIndex, passedGoal });

      remaining -= 1;
      onStep && onStep(this.currentIndex, passedGoal);
      setTimeout(stepOnce, stepDelay);
    };

    stepOnce();
  },

  getCurrentTileType() {
    return this.tileTypes[this.currentIndex];
  },
};
