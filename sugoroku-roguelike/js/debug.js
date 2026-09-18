// ============================================================
// debug.js
// バランス確認用のデバッグパネル。
// 現在の状態表示、直近ログ、サイコロの強制指定、
// 攻撃力・クリティカル率の自由な書き換えができます。
// ============================================================

const Debug = {
  enabled: false,
  forcedDiceValue: null, // nullなら通常のランダム、1〜6なら強制指定（全ダイスに適用）
  currentEnemies: [],    // 直近の戦闘で出現した敵の配列（表示用）
  logs: [],
  maxLogs: 20,

  init() {
    document.getElementById("debug-toggle-btn").addEventListener("click", () => this.toggle());
    document.getElementById("debug-close-btn").addEventListener("click", () => this.toggle(false));

    document.querySelectorAll(".debug-dice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.value;
        this.forcedDiceValue = v === "clear" ? null : parseInt(v, 10);
        this.refresh();
      });
    });

    // 攻撃力・クリティカル率を自由に増減できるボタン
    document.querySelectorAll(".debug-stat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stat = btn.dataset.stat;
        const delta = parseFloat(btn.dataset.delta);
        const p = GameState.player;
        if (!p) return;

        p[stat] = p[stat] + delta;
        if (stat === "criticalRate") {
          p[stat] = Math.max(0, Math.min(1, p[stat])); // 0%〜100%にクランプ
        } else {
          p[stat] = Math.max(0, p[stat]);
        }
        this.refresh();
      });
    });
  },

  toggle(force) {
    this.enabled = typeof force === "boolean" ? force : !this.enabled;
    document.getElementById("debug-panel").classList.toggle("hidden", !this.enabled);
    if (this.enabled) this.refresh();
  },

  log(message) {
    this.logs.push(message);
    if (this.logs.length > this.maxLogs) this.logs.shift();
    this.refreshLog();
  },

  refreshLog() {
    const el = document.getElementById("debug-log");
    if (!el) return;
    el.innerHTML = this.logs.map((l) => `<div>${l}</div>`).join("");
    el.scrollTop = el.scrollHeight;
  },

  refresh() {
    if (!this.enabled) return;
    const p = (GameState && GameState.player) || {};
    const enemyLines = (this.currentEnemies || [])
      .map((e) => `${e.monsterName}/${e.rarityName}/${e.strongName} HP:${e.hp}/${e.maxHp} 報酬:${e.reward}`)
      .join("<br>");

    const content = document.getElementById("debug-content");
    content.innerHTML = `
      GAME: ${GameState.gameIndex + 1}<br>
      ROUND: ${GameState.round}/${CONFIG.MAX_ROUNDS}<br>
      POSITION: ${Board.currentIndex}<br>
      LAST DICE: ${GameState.lastDice}<br>
      FORCED DICE: ${this.forcedDiceValue === null ? "OFF" : this.forcedDiceValue}<br>
      walletGold: ${GameState.walletGold}<br>
      earnedGold: ${GameState.earnedGold}<br>
      kills: ${GameState.kills}<br>
      medals: ${GameState.medals}<br>
      attack: ${p.attack}<br>
      attackCount: ${p.attackCount}<br>
      criticalRate: ${Math.round((p.criticalRate || 0) * 100)}%<br>
      criticalDamage: ×${(p.criticalDamage || 0).toFixed(2)}<br>
      aoeAttack: ${p.aoeAttack ? "ON" : "OFF"}<br>
      extraTurns: +${p.extraTurns || 0}<br>
      diceCountBonus: +${p.diceCountBonus || 0}<br>
      passives: ${GameState.passives.length} / cards: ${GameState.cards.length}<br>
      ---ENEMIES---<br>
      ${enemyLines || "(なし)"}
    `;
  },
};
