// ============================================================
// playerView.js
// 上画面（アクション演出エリア）に表示するプレイヤーキャラクターの
// 状態管理だけを担当します。実際の見た目（CSSアニメーション or
// 差し替え画像）は state（idle/running/attacking）に応じて
// CSS側 [data-state="..."] セレクタが決めます。
//
// 状態は最低限のもの（IDLE / RUNNING / ATTACKING）だけを持たせ、
// 過剰なステートマシンにはしていません。
//
// 画像を用意したい場合は assets/player/ 以下に
//   player_idle.png / player_run_1.png / player_run_2.png / player_attack.png
// を置くだけで、状態が切り替わるたびに自動的にその画像が使われます
// （js/assets.js の ASSET_PATHS を参照）。
// ============================================================

const PlayerView = {
  STATE: {
    IDLE: "idle",
    RUNNING: "running",
    ATTACKING: "attacking",
  },

  state: "idle",
  stageEl: null,
  characterEl: null,
  spriteEl: null,

  init() {
    this.stageEl = document.getElementById("action-stage");
    this.characterEl = document.getElementById("player-character");
    this.spriteEl = document.getElementById("player-sprite");
    this.setState(this.STATE.IDLE);
  },

  // 例: PlayerView.setState(PlayerView.STATE.RUNNING)
  setState(state) {
    this.state = state;
    if (this.characterEl) this.characterEl.dataset.state = state;
    // 地面のスクロール演出はaction-stage側のdata属性で制御する
    if (this.stageEl) this.stageEl.dataset.playerState = state;

    const assetKey =
      state === this.STATE.RUNNING ? "player_run_1" :
      state === this.STATE.ATTACKING ? "player_attack" :
      "player_idle";
    if (this.spriteEl) {
      AssetManager.applyToElement(this.spriteEl, assetKey, "player-fallback");
    }
  },

  // 短い攻撃モーションを1回再生して、終わったらidleに戻す（戦闘中の単発演出用）
  playAttackPulse() {
    if (!this.characterEl) return;
    this.characterEl.classList.remove("attack-pulse");
    void this.characterEl.offsetWidth;
    this.characterEl.classList.add("attack-pulse");
    setTimeout(() => this.characterEl.classList.remove("attack-pulse"), 300);
  },

  // ENEMY TURNで反撃を受けた時の短い被弾モーション（今どちらが攻撃しているか
  // 視覚的に分かるように、攻撃側とは逆の「怯む」動きにしている）
  playHurtPulse() {
    if (!this.characterEl) return;
    this.characterEl.classList.remove("hurt-pulse");
    void this.characterEl.offsetWidth;
    this.characterEl.classList.add("hurt-pulse");
    setTimeout(() => this.characterEl.classList.remove("hurt-pulse"), 250);
  },
};
