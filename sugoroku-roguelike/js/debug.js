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
  currentBattleTurn: 0,  // 直近の戦闘の現在ターン数（表示用）
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

    // ステータスを自由に増減できるボタン（攻撃力・クリ率・防御力・HPなど）
    document.querySelectorAll(".debug-stat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stat = btn.dataset.stat;
        const delta = parseFloat(btn.dataset.delta);
        const p = GameState.player;
        if (!p) return;

        p[stat] = (p[stat] || 0) + delta;
        if (stat === "criticalRate" || stat === "evasion") {
          p[stat] = Math.max(0, Math.min(1, p[stat])); // 0%〜100%にクランプ
        } else if (stat === "currentHp") {
          p[stat] = Math.max(0, Math.min(p.maxHp, p[stat])); // 0〜maxHpにクランプ
          UI.updateHpBar();
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
      .map((e) => {
        const strongMult = e.strongId === "strong" ? "×2/×1.3(HP/ATK目安)" : "×1";
        return `${e.monsterName}/${e.rarityName}/${e.strongName} HP:${e.hp}/${e.maxHp} ATK:${e.atk} Strong補正:${strongMult} 報酬:${e.reward}`;
      })
      .join("<br>");
    const bs = BattleSystem.current ? BattleSystem.current.battleState : GameState.lastBattleState;

    const content = document.getElementById("debug-content");
    content.innerHTML = `
      GAME: ${GameState.gameIndex + 1}<br>
      ROUND: ${GameState.round}/${CONFIG.MAX_ROUNDS}<br>
      POSITION: ${Board.currentIndex}<br>
      LAST DICE: ${GameState.lastDice}<br>
      FORCED DICE: ${this.forcedDiceValue === null ? "OFF" : this.forcedDiceValue}<br>
      walletGold: ${GameState.walletGold}<br>
      earnedGold: ${GameState.earnedGold}<br>
      medals: ${GameState.medals}<br>
      progress: ${JSON.stringify(GameState.progress)}<br>
      ---PLAYER---<br>
      classType: ${p.classType || "-"}<br>
      playerMaxHp: ${p.maxHp} / playerCurrentHp: ${p.currentHp}<br>
      physicalAttack: ${p.physicalAttack} / magicAttack: ${p.magicAttack}<br>
      defense: ${p.defense} / evasion: ${Math.round((p.evasion || 0) * 100)}%<br>
      criticalRate: ${Math.round((p.criticalRate || 0) * 100)}% / criticalDamage: ×${(p.criticalDamage || 0).toFixed(2)}<br>
      battleDeck: ${p.battleDeck ? p.battleDeck.length : 0}/${CONFIG.BATTLE_DECK_MAX} /
      boardCards: ${p.boardCards ? p.boardCards.length : 0}/${CONFIG.BOARD_DECK_MAX} /
      bossPassives: ${p ? (GameState.player.bossPassives || []).length : 0}<br>
      armor: ${(GameState.player.armor || []).length}/${CONFIG.EQUIPMENT.armorMax} / charms: ${(GameState.player.charms || []).length}/${CONFIG.EQUIPMENT.charmMax}<br>
      ---直近の戦闘---<br>
      戦闘ターン数: ${bs ? bs.turnNumber : 0}<br>
      闘気/共鳴: ${bs ? bs.momentum : 0} / ${bs ? Math.round((bs.resonanceExtraPercent || 0) * 100) : 0}%<br>
      ---ENEMIES---<br>
      ${enemyLines || "(なし)"}
    `;
  },
};
