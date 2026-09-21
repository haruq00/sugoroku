// ============================================================
// main.js
// エントリーポイント。画面サイズへのフィット処理と、
// 各種ボタンのイベント登録、ゲーム開始処理を行います。
//
// 画面遷移：HOME → CHARACTER SELECT → GAME
//          （GAME OVER / DEMO CLEARのHOMEボタンでHOMEへ戻る）
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
  PlayerView.init();

  // 効果音ファイルの存在チェックは並行して行う（ゲーム開始をブロックしない）
  SoundManager.preload();

  // 画像の存在チェックが終わってからゲームを開始する
  AssetManager.preload(() => {
    document.getElementById("dice-button").addEventListener("click", () => {
      GameState.rollDice();
    });

    // カードバトル中のEND TURN / RETREATボタン
    document.getElementById("battle-end-turn-btn").addEventListener("click", () => {
      BattleSystem.endTurn();
    });
    document.getElementById("battle-retreat-btn").addEventListener("click", () => {
      if (BattleUI.onRetreatClick) BattleUI.onRetreatClick();
    });

    // GAME完了画面のNEXT GAME：カード報酬→（該当GAMEのみ）Boss戦→
    // Bossパッシブ→（GAME20のみ）DEMO CLEARの順に進む
    document.getElementById("result-next-btn").addEventListener("click", () => {
      UI.hideResult();
      GameState.proceedAfterGameSummary();
    });

    // GAME OVER画面のRETRY：同じ職業で最初からやり直す
    document.getElementById("result-retry-btn").addEventListener("click", () => {
      UI.hideResult();
      GameState.resetAll();
    });

    // GAME OVER画面のHOME：HOME画面へ戻る（次は再びキャラクター選択から）
    document.getElementById("result-home-btn").addEventListener("click", () => {
      UI.hideResult();
      GameState.fullReset();
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

    // DECKボタン：戦闘デッキ・すごろくカード・特性カードを確認するオーバーレイ
    document.getElementById("deck-toggle-btn").addEventListener("click", () => {
      UI.showDeckOverlay();
    });
    document.getElementById("deck-close-btn").addEventListener("click", () => {
      UI.hideDeckOverlay();
    });
    document.querySelectorAll(".deck-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".deck-tab-btn").forEach((b) => b.classList.toggle("active", b === btn));
        document.querySelectorAll(".deck-tab-content").forEach((c) => c.classList.add("hidden"));
        document.getElementById(`deck-${btn.dataset.tab}-list`).classList.remove("hidden");
      });
    });

    // HOME画面のPLAY：キャラクター選択画面へ
    document.getElementById("home-play-btn").addEventListener("click", () => {
      UI.renderCharacterSelect((classType) => {
        GameState.beginRun(classType);
      });
      Screens.showCharacterSelect();
    });

    // DEMO CLEAR画面のHOMEへ戻るボタン
    document.getElementById("demo-clear-home-btn").addEventListener("click", () => {
      GameState.fullReset();
    });

    // 起動直後はHOME画面を表示する（いきなりすごろく画面は出さない）
    Screens.showHome();
  });
});
