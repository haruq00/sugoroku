// ============================================================
// battleUI.js
// カードバトル中の手札・ACTION表示・END TURN/RETREATボタンなど、
// 「戦闘の意思決定部分」の画面表示を専門に担当します。
// 敵の表示（HPバー・ダメージ数字等）は既存のui.jsが引き続き担当します。
// ============================================================

const BattleUI = {
  retreatAllowed: false,
  onRetreatClick: null,

  show() {
    document.getElementById("battle-hand-area").classList.remove("hidden");
  },
  hide() {
    document.getElementById("battle-hand-area").classList.add("hidden");
  },

  // RETREATボタンの表示可否を切り替える（Bossでは使用不可、通常GAMEは1ラウンド後から）
  setRetreatAvailable(available, onClick) {
    this.retreatAllowed = available;
    this.onRetreatClick = onClick;
    const btn = document.getElementById("battle-retreat-btn");
    btn.classList.toggle("hidden", !available);
  },

  renderActionPoints(current, max) {
    const el = document.getElementById("battle-action-points");
    let dots = "";
    for (let i = 0; i < max; i++) dots += i < current ? "●" : "○";
    el.textContent = `ACTION ${dots}`;
  },

  // 手札を描画する。カードクリックでonPlayCard(index)を呼ぶ。
  // aliveEnemies/battleStateを渡すと、ダメージカードに実際のダメージ数値を表示する。
  renderHand(hand, actionPoints, onPlayCard, aliveEnemies, battleState) {
    const container = document.getElementById("battle-hand");
    container.innerHTML = "";

    hand.forEach((card, index) => {
      const el = document.createElement("button");
      const isDamageCard = !!(card.hits || CardEffectSystem.DAMAGE_CONDITION_HANDLERS[card.effectId]);
      const locked = battleState && battleState.attackLockedThisTurn && isDamageCard;
      const affordable = card.cost <= actionPoints && !locked;
      el.className = `battle-card rarity-${card.rarity || "normal"}${affordable ? "" : " unaffordable"}`;
      el.disabled = !affordable;

      const costEl = document.createElement("div");
      costEl.className = "battle-card-cost";
      costEl.textContent = card.cost;

      // カード画像エリア（assets/battlecards/<id>.png を置くと自動的に反映される。
      // 画像が無い間はタグに応じた絵文字で仮表示する）。
      const iconEl = document.createElement("div");
      iconEl.className = "battle-card-icon icon-fallback";
      iconEl.textContent = this.fallbackIcon(card);
      AssetManager.applyToElement(iconEl, card.id, "icon-fallback");
      if (iconEl.classList.contains("has-image")) iconEl.textContent = "";

      const nameEl = document.createElement("div");
      nameEl.className = "battle-card-name";
      nameEl.textContent = card.name;

      const primaryTarget = BattleSystem.current ? BattleSystem.getPrimaryTarget() : null;
      const damage = aliveEnemies ? CardEffectSystem.getCardDisplayDamage(GameState.player, card, aliveEnemies, battleState, primaryTarget) : null;

      el.appendChild(costEl);
      el.appendChild(iconEl);
      el.appendChild(nameEl);
      if (damage != null) {
        const dmgEl = document.createElement("div");
        dmgEl.className = "battle-card-damage";
        dmgEl.textContent = `${CONFIG.formatNumber(damage)} ダメージ`;
        el.appendChild(dmgEl);
      }

      const descEl = document.createElement("div");
      descEl.className = "battle-card-desc";
      descEl.textContent = card.description;
      el.appendChild(descEl);

      const tagsEl = document.createElement("div");
      tagsEl.className = "battle-card-tags";
      tagsEl.textContent = (card.tags || []).join(" / ");
      el.appendChild(tagsEl);

      el.addEventListener("click", () => onPlayCard(index));
      container.appendChild(el);
    });
  },

  // 画像が無い間の仮アイコン（カードのタグから雰囲気だけ推測する簡易表示）
  fallbackIcon(card) {
    const tags = card.tags || [];
    if (tags.includes("HEAL")) return "💚";
    if (tags.includes("DEFENSE")) return "🛡️";
    if (tags.includes("DRAW")) return "🎴";
    if (tags.includes("AOE")) return "💥";
    if (tags.includes("CRITICAL")) return "✨";
    if (tags.includes("MULTI")) return "⚔️";
    return "🗡️";
  },

  // 職業固有スキルゲージ（闘気/魔力共鳴）を表示する
  renderSkillGauge(player, battleState) {
    const el = document.getElementById("battle-skill-gauge");
    if (!battleState) { el.innerHTML = ""; return; }
    if (player.classType === "SWORDSMAN") {
      const max = CardEffectSystem.getMomentumMax(player);
      el.innerHTML = `闘気 ${battleState.momentum}/${max}`;
    } else if (player.classType === "MAGE") {
      const bonus = Math.round(CardEffectSystem.getResonanceBonus(player, battleState, BattleSystem.current ? BattleSystem.getAliveEnemies() : []) * 100);
      el.innerHTML = `魔力共鳴 +${bonus}%`;
    } else {
      el.innerHTML = "";
    }
  },
};
