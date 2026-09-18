// ============================================================
// events.js
// 将来「カード」「装備」「お守り」「パッシブ」などから
// 効果を差し込みやすくするための、シンプルなイベントフックです。
//
// 使い方（将来カードシステムを実装するとき）：
//   EventHooks.on("onEnemyDefeated", (payload) => {
//     GameState.gainGold(payload.reward * 0.1); // 例：撃破時に追加でお金
//   });
//
// 大規模なイベントシステムではなく、必要最低限の仕組みです。
// ============================================================

const EventHooks = {
  hooks: {
    onGameStart: [],
    onRoundStart: [],
    onDiceRolled: [],
    onMoveStep: [],
    onTileLanded: [],
    onGoalPassed: [],
    onBattleStart: [],
    onAttack: [],
    onEnemyDefeated: [],
    onBattleEnd: [],
    onRoundEnd: [],
    onGameClear: [],
    onPerfectClear: [],
    onGameOver: [],
  },

  // 効果（コールバック関数）を登録する
  on(eventName, callback) {
    if (!this.hooks[eventName]) this.hooks[eventName] = [];
    this.hooks[eventName].push(callback);
  },

  // イベントを発火する（game.js / board.js / combat.js から呼ばれる）
  trigger(eventName, payload) {
    const list = this.hooks[eventName];
    if (!list) return;
    list.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`EventHook error [${eventName}]`, e);
      }
    });
  },
};
