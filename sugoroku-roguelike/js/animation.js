// ============================================================
// animation.js
// サイコロ・盤面移動・戦闘・ショップなど、既存のコールバック形式の
// 処理をPromiseでラップするための薄いヘルパー集です。
//
// combat.js / board.js / dice.js / shop.js 自体は変更せず、
// 呼び出し側（game.js）がasync/awaitで
//   await animateDice(values);
//   await movePlayerAsync(total, onStep);
// のように読みやすく書けるようにするための橋渡し役です。
// ============================================================

// 指定ミリ秒だけ待つ（アニメーションの「間」を作るための基本部品）
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// サイコロを振るアニメーションが終わるまで待つ
function animateDice(values) {
  return new Promise((resolve) => {
    DiceUI.roll(values, resolve);
  });
}

// プレイヤーコマがsteps分移動し終わるまで待つ。
// onStepは1マス進むごとに呼ばれる（GOAL通過判定などに使う）。
function movePlayerAsync(steps, onStep) {
  return new Promise((resolve) => {
    Board.movePlayer(steps, onStep, resolve);
  });
}

// 戦闘が完全に終わる（勝利 or プレイヤーのHPが0になる）まで待つ。
// callbacksはcombat.jsのrunBattleにそのまま渡す（onDoneだけ内部で補完する）。
function runBattleAsync(enemies, player, callbacks) {
  return new Promise((resolve) => {
    Combat.runBattle(enemies, player, {
      ...callbacks,
      onDone: (result) => {
        callbacks.onDone && callbacks.onDone(result);
        resolve(result);
      },
    });
  });
}

// ショップが閉じられるまで待つ
function openShopAsync() {
  return new Promise((resolve) => {
    Shop.open(resolve);
  });
}
