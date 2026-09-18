// ============================================================
// main.js
// エントリーポイント。画面サイズへのフィット処理と、
// 各種ボタンのイベント登録、ゲーム開始処理を行います。
// ============================================================

// 960x540基準のゲーム画面を、ウィンドウサイズに合わせて
// アスペクト比を保ったまま拡大縮小する（1920x1080でちょうど2倍）
function fitGameContainer() {
  const container = document.getElementById("game-container");
  const scaleX = window.innerWidth / CONFIG.BASE_WIDTH;
  const scaleY = window.innerHeight / CONFIG.BASE_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  container.style.transform = `translate(-50%, -50%) scale(${scale})`;
}

window.addEventListener("resize", fitGameContainer);

window.addEventListener("DOMContentLoaded", () => {
  fitGameContainer();
  Debug.init();
  Menu.init();
  DiceUI.init();

  // 効果音ファイルの存在チェックは並行して行う（ゲーム開始をブロックしない）
  SoundManager.preload();

  // 画像の存在チェックが終わってからゲームを開始する
  AssetManager.preload(() => {
    document.getElementById("dice-button").addEventListener("click", () => {
      GameState.rollDice();
    });

    document.getElementById("result-next-btn").addEventListener("click", () => {
      UI.hideResult();
      UI.hideClearReady();
      GameState.goToNextGame();
    });

    document.getElementById("result-retry-btn").addEventListener("click", () => {
      UI.hideResult();
      UI.hideClearReady();
      GameState.resetAll();
    });

    document.getElementById("shop-close-btn").addEventListener("click", () => {
      Shop.close();
    });
    // 背景（パネルの外側）をクリックしても閉じられるようにする（退出手段の保険）
    document.getElementById("shop-overlay").addEventListener("click", (e) => {
      if (e.target.id === "shop-overlay") Shop.close();
    });
    document.getElementById("shop-reroll-btn").addEventListener("click", () => {
      Shop.reroll();
    });

    GameState.beginRun();
  });
});
