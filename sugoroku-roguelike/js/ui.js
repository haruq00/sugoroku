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
    this.hideResult();
  },

  updateStatusBar() {
    document.getElementById("status-game").textContent = `GAME ${GameState.gameIndex + 1}`;
    document.getElementById("status-round").textContent = `ROUND ${GameState.round}/${CONFIG.MAX_ROUNDS}`;
    document.getElementById("status-gold").textContent = `GOLD ${CONFIG.formatNumber(GameState.walletGold)}`;
    document.getElementById("status-medal").textContent = `MEDAL ${GameState.medals}`;
    this.updateHpBar();
    Debug.refresh();
  },

  // プレイヤーのHP表示（数値＋ゲージ）を更新する。ゲージはCSSのtransitionで
  // なめらかに減る／増えるようにしている。
  updateHpBar() {
    const p = GameState.player;
    if (!p) return;
    const pct = Math.max(0, Math.min(100, (p.currentHp / p.maxHp) * 100));
    document.getElementById("status-hp").textContent = `HP ${Math.max(0, p.currentHp)}/${p.maxHp}`;
    document.getElementById("player-hp-bar-inner").style.width = `${pct}%`;
  },

  setDiceButtonEnabled(enabled) {
    document.getElementById("dice-button").disabled = !enabled;
  },

  showDiceTotal(total) {
    document.getElementById("dice-total-value").textContent = total;
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

  // マスイベントの大きなアイコンを一瞬だけ表示する（💰💎⚠️など）
  showTileEventIcon(icon) {
    const el = document.getElementById("tile-event-icon");
    el.textContent = icon;
    this.retriggerAnimation(el, "show", 700);
  },

  // GOAL/START通過演出：「LAP! / MEDAL +1」を上画面に表示する
  showGoalPassedEffect() {
    this.showEffect("LAP!", "lap-text");
    this.showEffect("MEDAL +1", "medal-popup");
  },

  // ---------------------------------------------------------
  // 未来位置表示：サイコロを振る前に、1〜6マス先の停止マスを
  // 盤面上に小さく表示する（仕様6）。
  // ---------------------------------------------------------
  // BONUS TARGET（達成は任意）を下右パネルに表示する
  showMission(mission) {
    document.getElementById("status-mission").textContent = `TARGET: ${mission.label}`;
  },

  showLookahead(futurePositions) {
    this.hideLookahead();
    const track = document.getElementById("board-track");
    futurePositions.forEach(({ steps, index }) => {
      const pos = Board.tilePositions[index];
      if (!pos) return;
      const marker = document.createElement("div");
      marker.className = "lookahead-marker";
      marker.textContent = steps;
      marker.style.left = `${pos.x + Board.tileSize / 2}px`;
      marker.style.top = `${pos.y}px`;
      track.appendChild(marker);
    });
  },
  hideLookahead() {
    document.querySelectorAll(".lookahead-marker").forEach((el) => el.remove());
  },

  // ENEMY TURN：プレイヤーが受けたダメージの数字を表示する
  // （被弾モーション自体はPlayerView.playHurtPulse()が担当する）
  showPlayerDamaged(damage) {
    const el = document.createElement("div");
    el.className = "floating-effect player-damage-text";
    el.textContent = `-${damage}`;
    document.getElementById("player-zone").appendChild(el);
    setTimeout(() => el.remove(), 900);
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

  // 戦闘開始：enemies配列ぶんのスロットを敵表示エリアに作る。
  // 敵が複数いる場合、クリックで攻撃対象を選択できるようにする
  // （onSelectTargetにslotIndexを渡す。1体だけの時もクリック自体は有効）。
  showEnemies(enemies, onSelectTarget) {
    const row = document.getElementById("enemy-row");
    row.innerHTML = "";
    this.enemySlotEls = {};

    const size = this.calcEnemySpriteSize(enemies.length);
    const multiTarget = enemies.length > 1;

    enemies.forEach((enemy) => {
      const slot = document.createElement("div");
      slot.className = `enemy-slot${multiTarget ? " selectable" : ""}`;
      slot.id = `enemy-slot-${enemy.slotIndex}`;
      if (multiTarget && onSelectTarget) {
        slot.addEventListener("click", () => onSelectTarget(enemy.slotIndex));
      }

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

      const targetMark = document.createElement("div");
      targetMark.className = "enemy-target-mark";
      targetMark.textContent = "▼";

      spriteWrap.appendChild(sprite);
      spriteWrap.appendChild(damageOverlay);
      spriteWrap.appendChild(slash);
      spriteWrap.appendChild(effectLayer);
      spriteWrap.appendChild(targetMark);

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
    if (enemies.length > 0) this.highlightTarget(enemies[0].slotIndex);
  },

  // 選択中の攻撃対象を視覚的に示す（他の敵の強調は解除する）
  highlightTarget(slotIndex) {
    Object.keys(this.enemySlotEls).forEach((key) => {
      this.enemySlotEls[key].slot.classList.toggle("targeted", Number(key) === slotIndex);
    });
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
  // GAME完了画面（5ラウンド終了時。ミッション結果と報酬を表示する。
  // プレイヤーが生きている限り必ずNEXT GAMEへ進める＝クリア条件ではない）
  // ---------------------------------------------------------
  showGameSummary(stats) {
    const overlay = document.getElementById("result-overlay");
    const titleEl = document.getElementById("result-title");
    const detailEl = document.getElementById("result-detail");
    const nextBtn = document.getElementById("result-next-btn");
    const retryBtn = document.getElementById("result-retry-btn");
    const homeBtn = document.getElementById("result-home-btn");

    titleEl.textContent = `GAME ${stats.gameNumber} COMPLETE`;
    titleEl.className = stats.missionAchieved ? "perfect" : "clear";

    const missionLine = stats.missionLabel && stats.missionLabel !== "-"
      ? `BONUS TARGET: ${stats.missionLabel}<br>結果: ${stats.missionAchieved ? "CLEAR！宝箱を獲得" : "MISS（進行には影響なし）"}<br>`
      : "";

    detailEl.innerHTML = `
      ${missionLine}
      🎁 +${stats.reward}G
    `;

    nextBtn.classList.remove("hidden");
    retryBtn.classList.add("hidden");
    homeBtn.classList.add("hidden");
    overlay.classList.remove("hidden");
  },

  // ---------------------------------------------------------
  // GAME OVER画面（プレイヤーHPが0以下になった時だけ表示する）
  // ---------------------------------------------------------
  showGameOverScreen(stats) {
    const overlay = document.getElementById("result-overlay");
    const titleEl = document.getElementById("result-title");
    const detailEl = document.getElementById("result-detail");
    const nextBtn = document.getElementById("result-next-btn");
    const retryBtn = document.getElementById("result-retry-btn");
    const homeBtn = document.getElementById("result-home-btn");

    titleEl.textContent = "GAME OVER";
    titleEl.className = "gameover";
    detailEl.innerHTML = `
      到達GAME: ${stats.reachedGame}<br>
      討伐数: ${stats.kills}<br>
      獲得金額: ${stats.gold}G<br>
      周回数: ${stats.laps}<br>
      ボス撃破数: ${stats.bossKills}
    `;

    nextBtn.classList.add("hidden");
    retryBtn.classList.remove("hidden");
    homeBtn.classList.remove("hidden");
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

  // ---------------------------------------------------------
  // キャラクター選択画面：ClassSystem.getAll()から動的に描画する
  // （職業を増やす時、ここのコードは変更不要）
  // ---------------------------------------------------------
  renderCharacterSelect(onSelect) {
    const list = document.getElementById("character-select-list");
    list.innerHTML = "";
    ClassSystem.getAll().forEach((cls) => {
      const card = document.createElement("button");
      card.className = "character-card pixel-frame";

      const icon = document.createElement("div");
      icon.className = "character-card-icon icon-fallback";
      icon.textContent = cls.id === "MAGE" ? "🧙" : "⚔️";
      AssetManager.applyToElement(icon, `character_${cls.id.toLowerCase()}`, "icon-fallback");
      if (icon.classList.contains("has-image")) icon.textContent = "";

      const name = document.createElement("div");
      name.className = "character-card-name";
      name.textContent = `${cls.name} (${cls.nameEn})`;

      const desc = document.createElement("div");
      desc.className = "character-card-desc";
      desc.textContent = cls.description;

      const selectBtn = document.createElement("div");
      selectBtn.className = "character-card-select-label";
      selectBtn.textContent = "[ SELECT ]";

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(selectBtn);
      card.addEventListener("click", () => onSelect(cls.id));
      list.appendChild(card);
    });
  },

  // ---------------------------------------------------------
  // DECK確認画面：戦闘デッキ・すごろくカード・ステータスカード履歴を一覧表示する
  // （仕様63：タグ集計でビルド方向を確認できるようにする）
  // ---------------------------------------------------------
  renderDeckOverlay() {
    const player = GameState.player;
    this.renderCardSection("deck-battle-list", "deck-battle-count", player.battleDeck, CONFIG.BATTLE_DECK_MAX);
    this.renderCardSection("deck-board-list", "deck-board-count", player.boardCards, CONFIG.BOARD_DECK_MAX);
    this.renderCardSection("deck-trait-list", "deck-trait-count", player.statCardHistory, player.statCardHistory.length);

    const tagCounts = DeckSystem.summarizeTags(player.battleDeck.concat(player.boardCards));
    const tagEl = document.getElementById("deck-tag-summary");
    const sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    tagEl.textContent = sorted.length > 0 ? sorted.map(([tag, count]) => `${tag} ×${count}`).join("　") : "（まだ傾向なし）";
  },

  renderCardSection(listId, countId, deck, maxSize) {
    document.getElementById(countId).textContent = `${deck.length} / ${maxSize}`;
    const listEl = document.getElementById(listId);
    listEl.innerHTML = "";
    if (deck.length === 0) {
      listEl.innerHTML = `<div class="deck-empty">まだありません</div>`;
      return;
    }
    deck.forEach((card) => {
      const row = document.createElement("div");
      row.className = "deck-card-row";
      const rarityColor = ItemRarity.getColor((card.rarity || "normal").toLowerCase());
      row.innerHTML = `
        <div class="deck-card-name" style="color:${rarityColor}">${card.name}${card.cost != null ? ` (${card.cost}ACT)` : ""}</div>
        <div class="deck-card-meta">${card.classType || ""} / ${(card.tags || []).join(", ")}</div>
        <div class="deck-card-desc">${card.description}</div>
      `;
      listEl.appendChild(row);
    });
  },

  showDeckOverlay() {
    this.renderDeckOverlay();
    document.getElementById("deck-overlay").classList.remove("hidden");
  },
  hideDeckOverlay() {
    document.getElementById("deck-overlay").classList.add("hidden");
  },

  // ---------------------------------------------------------
  // DEMO CLEAR画面（Boss2撃破後）
  // ---------------------------------------------------------
  showDemoClearScreen(stats) {
    const el = document.getElementById("demo-clear-stats");
    el.innerHTML = `
      職業: ${stats.className}<br>
      最終物理攻撃力: ${stats.physicalAttack} / 最終魔法攻撃力: ${stats.magicAttack}<br>
      最大ダメージ: ${CONFIG.formatNumber(stats.maxDamage)}<br>
      最終HP: ${stats.currentHp}/${stats.maxHp}<br>
      所持Gold: ${CONFIG.formatNumber(stats.gold)}G<br>
      戦闘デッキ: ${stats.battleDeckCount}枚 / すごろくカード: ${stats.boardDeckCount}枚 / 特性: ${stats.traitCount}枚<br>
      Strong撃破数: ${stats.strongKills}<br>
      Rare撃破数: ${stats.rareKills}<br>
      周回数: ${stats.laps}
    `;
    Screens.showDemoClear();
  },
};
