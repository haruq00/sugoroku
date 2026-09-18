// ============================================================
// ui.js
// 画面表示・演出（DOM操作）を担当します。
// ゲームのルール判定などのロジックはgame.js / combat.jsに任せ、
// このファイルは「表示すること」だけに専念します。
//
// 戦闘画面にはプレイヤーキャラは表示せず、敵（最大5体）を
// 中央揃えで並べて表示します。各敵は自分専用のダメージ／
// 撃破／獲得金額の表示エリアを持ちます（敵の位置そのものに表示）。
// ============================================================

const UI = {
  enemySlotEls: {}, // slotIndex -> {slot, sprite, damageOverlay, slash, effectLayer, hpInner, hpText}
  driftToggle: false, // 敵の上に浮かぶテキストを左右交互にずらすためのフラグ

  renderAll() {
    this.updateStatusBar();
    this.hideEnemies();
    this.hideClearReady();
    this.hideResult();
  },

  updateStatusBar() {
    document.getElementById("status-game").textContent = `GAME ${GameState.gameIndex + 1}`;
    document.getElementById("status-round").textContent = `ROUND ${GameState.round}/${CONFIG.MAX_ROUNDS}`;
    document.getElementById("status-gold").textContent = `GOLD ${GameState.earnedGold}/${GameState.goldQuota}`;
    document.getElementById("status-kill").textContent = `KILL ${GameState.kills}/${GameState.killQuota}`;
    document.getElementById("status-medal").textContent = `MEDAL ${GameState.medals}`;
    Debug.refresh();
  },

  setDiceButtonEnabled(enabled) {
    document.getElementById("dice-button").disabled = !enabled;
  },

  showDiceTotal(total) {
    document.getElementById("dice-total-value").textContent = total;
  },

  showClearReady() {
    document.getElementById("status-clearready").classList.remove("hidden");
  },
  hideClearReady() {
    document.getElementById("status-clearready").classList.add("hidden");
  },

  // 上部の戦闘演出エリア「全体」に浮かび上がるテキスト（MEDAL +1など、敵に紐付かないもの）
  showEffect(text, className) {
    const layer = document.getElementById("effect-layer");
    const el = document.createElement("div");
    el.className = `floating-effect ${className}`;
    el.textContent = text;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  },

  // マスに停止した時の説明文を、盤面エリア付近のバナーに表示する
  showTileMessage(text) {
    const banner = document.getElementById("tile-message-banner");
    banner.textContent = text;
    this.retriggerAnimation(banner, "show", 1400);
  },

  // class を一瞬だけ再付与してCSSアニメーションを再生させる共通処理
  // （同じ演出を連続で発生させても毎回頭からアニメーションし直すため）
  retriggerAnimation(element, className, duration) {
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth; // 強制リフローでアニメーションをリセットする
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), duration);
  },

  // ---------------------------------------------------------
  // 敵表示（複数体対応）
  // ---------------------------------------------------------

  // 戦闘開始：enemies配列ぶんのスロットを敵表示エリアに作る
  showEnemies(enemies) {
    const row = document.getElementById("enemy-row");
    row.innerHTML = "";
    this.enemySlotEls = {};

    const size = this.calcEnemySpriteSize(enemies.length);

    enemies.forEach((enemy) => {
      const slot = document.createElement("div");
      slot.className = "enemy-slot";
      slot.id = `enemy-slot-${enemy.slotIndex}`;

      const spriteWrap = document.createElement("div");
      spriteWrap.className = "enemy-sprite-wrap spawn-in";
      spriteWrap.style.width = `${size}px`;
      spriteWrap.style.height = `${size}px`;

      const sprite = document.createElement("div");
      sprite.className = "enemy-sprite enemy-fallback";
      sprite.dataset.rarity = enemy.rarityId;
      sprite.dataset.strong = enemy.strongId;
      AssetManager.applyToElement(sprite, enemy.monsterId, "enemy-fallback");

      const damageOverlay = document.createElement("div");
      damageOverlay.className = "enemy-damage-overlay";

      const slash = document.createElement("div");
      slash.className = "enemy-slash";

      const effectLayer = document.createElement("div");
      effectLayer.className = "enemy-effect-layer";

      spriteWrap.appendChild(sprite);
      spriteWrap.appendChild(damageOverlay);
      spriteWrap.appendChild(slash);
      spriteWrap.appendChild(effectLayer);

      const nameEl = document.createElement("div");
      nameEl.className = "enemy-name";
      const nameParts = [];
      if (enemy.strongId === "strong") nameParts.push("強敵");
      if (enemy.rarityId !== "normal") nameParts.push(`[${enemy.rarityName}]`);
      nameParts.push(enemy.monsterName);
      nameEl.textContent = nameParts.join(" ");

      const hpOuter = document.createElement("div");
      hpOuter.className = "enemy-hp-bar-outer";
      const hpInner = document.createElement("div");
      hpInner.className = "enemy-hp-bar-inner";
      hpOuter.appendChild(hpInner);

      const hpText = document.createElement("div");
      hpText.className = "enemy-hp-text";
      hpText.textContent = `HP ${enemy.hp}/${enemy.maxHp}`;

      slot.appendChild(spriteWrap);
      slot.appendChild(nameEl);
      slot.appendChild(hpOuter);
      slot.appendChild(hpText);
      row.appendChild(slot);

      this.enemySlotEls[enemy.slotIndex] = { slot, sprite, damageOverlay, slash, effectLayer, hpInner, hpText };
    });

    row.classList.remove("hidden");
  },

  // 敵の人数に応じてスプライトサイズを自動調整する（多いほど小さく）
  calcEnemySpriteSize(count) {
    const sizes = { 1: 132, 2: 118, 3: 104, 4: 92, 5: 84 };
    return sizes[count] || 76;
  },

  updateEnemyHp(enemy) {
    const els = this.enemySlotEls[enemy.slotIndex];
    if (!els) return;
    const pct = Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100));
    els.hpInner.style.width = `${pct}%`;
    els.hpText.textContent = `HP ${Math.max(0, enemy.hp)}/${enemy.maxHp}`;
  },

  // 敵1体ぶんの、専用エリアに浮かぶダメージ／撃破／獲得金額テキスト。
  // 敵と「同じ場所」を起点にしつつ、連続で出ても重ならないように
  // 少しずつ上へ、かつ左右に交互（斜め）にずれながら表示する。
  showEnemyEffect(enemy, text, className) {
    const els = this.enemySlotEls[enemy.slotIndex];
    if (!els) return;

    this.driftToggle = !this.driftToggle;
    const driftClass = this.driftToggle ? "drift-right" : "drift-left";

    const el = document.createElement("div");
    el.className = `floating-effect enemy-floating-effect ${className} ${driftClass}`;
    el.textContent = text;
    els.effectLayer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  },

  showAttack(enemy, damage, isCritical) {
    this.updateEnemyHp(enemy);
    const els = this.enemySlotEls[enemy.slotIndex];

    // ダメージ数字は大きく、モンスターと同じ位置を起点に表示する
    this.showEnemyEffect(enemy, `-${damage}`, isCritical ? "damage-critical" : "damage-normal");
    if (isCritical) this.showEnemyEffect(enemy, "CRITICAL!", "critical-text");

    if (els) {
      // 斬撃エフェクト
      this.retriggerAnimation(els.slash, "slash-active", 250);
      // 被弾時、モンスター全体を赤く点滅させる
      this.retriggerAnimation(els.damageOverlay, "active", 250);
    }
  },

  showDefeat(enemy, reward, oneShot) {
    this.showEnemyEffect(enemy, "撃破!", "defeat-text");
    // 獲得金額もダメージ数字と同じ位置・同じくらいの大きさで表示する
    this.showEnemyEffect(enemy, `+${reward}G`, "gold-popup-big");
    if (oneShot) this.showEnemyEffect(enemy, "ONE SHOT", "oneshot-text");

    const els = this.enemySlotEls[enemy.slotIndex];
    if (els) els.slot.classList.add("enemy-defeated");
  },

  showEscape(enemy) {
    this.showEnemyEffect(enemy, "ESCAPED", "escape-text");
    const els = this.enemySlotEls[enemy.slotIndex];
    if (els) els.slot.classList.add("enemy-defeated");
  },

  hideEnemies() {
    document.getElementById("enemy-row").innerHTML = "";
    document.getElementById("enemy-row").classList.add("hidden");
    this.enemySlotEls = {};
  },

  // ---------------------------------------------------------
  // ゴールド獲得演出（画面フラッシュ＋コインが降ってくる）
  // ---------------------------------------------------------
  playMoneyEffect() {
    this.retriggerAnimation(document.getElementById("screen-flash"), "flash-active", 350);

    const layer = document.getElementById("money-effect-layer");
    const coinCount = 26; // たくさん降らせて派手にする
    for (let i = 0; i < coinCount; i++) {
      const coin = document.createElement("div");
      coin.className = "falling-coin";
      const fromLeft = i % 2 === 0;
      const xBase = fromLeft ? Math.random() * 14 : 86 + Math.random() * 14;
      coin.style.left = `${xBase}%`;
      coin.style.fontSize = `${16 + Math.random() * 14}px`;
      coin.style.animationDelay = `${Math.random() * 350}ms`;
      coin.style.animationDuration = `${0.8 + Math.random() * 0.5}s`;
      coin.textContent = "🪙";
      layer.appendChild(coin);
      setTimeout(() => coin.remove(), 1500);
    }
  },

  // ---------------------------------------------------------
  // 結果オーバーレイ（CLEAR / PERFECT CLEAR / GAME OVER）
  // ---------------------------------------------------------
  showResult(title, cleared, perfect) {
    const overlay = document.getElementById("result-overlay");
    const titleEl = document.getElementById("result-title");
    const detailEl = document.getElementById("result-detail");
    const nextBtn = document.getElementById("result-next-btn");
    const retryBtn = document.getElementById("result-retry-btn");

    titleEl.textContent = title;
    titleEl.className = perfect ? "perfect" : cleared ? "clear" : "gameover";
    detailEl.textContent =
      `獲得金額: ${GameState.earnedGold}/${GameState.goldQuota}　討伐数: ${GameState.kills}/${GameState.killQuota}`;

    if (cleared) {
      nextBtn.classList.remove("hidden");
      retryBtn.classList.add("hidden");
    } else {
      nextBtn.classList.add("hidden");
      retryBtn.classList.remove("hidden");
    }
    overlay.classList.remove("hidden");
  },

  hideResult() {
    document.getElementById("result-overlay").classList.add("hidden");
  },

  // ---------------------------------------------------------
  // 選択オーバーレイ（パッシブ選択／カード選択で共用の汎用UI）
  // options の各要素は {id, name, description} を想定。
  // 画像は AssetManager 経由で id をキーに探し、無ければ絵文字で仮表示する。
  // ---------------------------------------------------------
  showChoiceOverlay(title, options, onChoose) {
    document.getElementById("choice-title").textContent = title;
    const optionsEl = document.getElementById("choice-options");
    optionsEl.innerHTML = "";

    options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "choice-option";

      const icon = document.createElement("div");
      icon.className = "choice-option-icon icon-fallback";
      icon.textContent = "✨";
      AssetManager.applyToElement(icon, opt.id, "icon-fallback");
      if (icon.classList.contains("has-image")) icon.textContent = "";

      const name = document.createElement("div");
      name.className = "choice-option-name";
      if (opt.rarityId) {
        name.style.color = ItemRarity.getColor(opt.rarityId);
        name.textContent = `[${ItemRarity.getName(opt.rarityId)}] ${opt.name}`;
      } else {
        name.textContent = opt.name;
      }

      const desc = document.createElement("div");
      desc.className = "choice-option-desc";
      desc.textContent = opt.description;

      btn.appendChild(icon);
      btn.appendChild(name);
      btn.appendChild(desc);

      btn.addEventListener("click", () => {
        this.hideChoiceOverlay();
        onChoose(opt);
      });
      optionsEl.appendChild(btn);
    });

    document.getElementById("choice-overlay").classList.remove("hidden");
  },

  hideChoiceOverlay() {
    document.getElementById("choice-overlay").classList.add("hidden");
  },
};
