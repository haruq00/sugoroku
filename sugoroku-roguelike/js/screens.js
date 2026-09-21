// ============================================================
// screens.js
// 画面全体の状態（HOME / CHARACTER_SELECT / GAME / DEMO_CLEAR）を
// 一元管理します。表示のON/OFFを場当たり的にあちこちに書くのではなく、
// Screens.show(state) を呼ぶだけで対応する画面だけが表示されるように
// しています。
//
// GAME中に開くDECK画面やカード報酬・Bossパッシブ選択は「オーバーレイ」
// （既存の choice-overlay 等と同じ扱い）なので、ここでのScreens管理
// 対象には含めていません（ゲーム画面の上に重ねて出すだけのため）。
// ============================================================

const Screens = {
  STATE: {
    HOME: "HOME",
    CHARACTER_SELECT: "CHARACTER_SELECT",
    GAME: "GAME",
    DEMO_CLEAR: "DEMO_CLEAR",
  },

  current: null,

  // 画面ごとのルート要素id
  screenIds: {
    HOME: "home-screen",
    CHARACTER_SELECT: "character-select-screen",
    GAME: "game-container",
    DEMO_CLEAR: "demo-clear-screen",
  },

  show(state) {
    this.current = state;
    Object.keys(this.screenIds).forEach((key) => {
      const el = document.getElementById(this.screenIds[key]);
      if (!el) return;
      el.classList.toggle("hidden", key !== state);
    });
  },

  showHome() {
    this.show(this.STATE.HOME);
  },
  showCharacterSelect() {
    this.show(this.STATE.CHARACTER_SELECT);
  },
  showGame() {
    this.show(this.STATE.GAME);
  },
  showDemoClear() {
    this.show(this.STATE.DEMO_CLEAR);
  },
};
