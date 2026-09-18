// ============================================================
// menu.js
// 画面左端の「MENU」ボタンから開く、ステータス・カード・パッシブ・
// お守りの一覧を確認するための画面を担当します。
// ゲームの進行には関与せず、あくまで「確認用の別画面」です。
// ============================================================

const Menu = {
  currentTab: "status",

  init() {
    document.getElementById("menu-toggle-btn").addEventListener("click", () => this.open());
    document.getElementById("menu-close-btn").addEventListener("click", () => this.close());

    document.querySelectorAll(".menu-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.currentTab = btn.dataset.tab;
        this.render();
      });
    });
  },

  open() {
    this.render();
    document.getElementById("menu-overlay").classList.remove("hidden");
  },

  close() {
    document.getElementById("menu-overlay").classList.add("hidden");
  },

  render() {
    document.querySelectorAll(".menu-tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === this.currentTab);
    });

    const content = document.getElementById("menu-content");
    switch (this.currentTab) {
      case "status":
        content.innerHTML = this.renderStatusTab();
        break;
      case "cards":
        content.innerHTML = this.renderListTab(GameState.cards, "まだカードを獲得していません。ゲームをクリアするとカードを選べます。");
        break;
      case "passives":
        content.innerHTML = this.renderListTab(GameState.passives, "まだパッシブを獲得していません。");
        break;
      case "omamori":
        content.innerHTML = this.renderListTab(GameState.omamori, "まだお守りを持っていません。ショップマスで購入できます。");
        break;
      default:
        content.innerHTML = "";
    }
  },

  renderStatusTab() {
    const p = GameState.player || {};
    const weaponName = p.weapon ? p.weapon.name : "素手（未装備）";
    const weaponDesc = p.weapon ? p.weapon.description : "ショップで武器を購入すると装備されます";
    return `
      <div class="menu-status-line"><span>攻撃力 (ATK)</span><span>${p.attack}</span></div>
      <div class="menu-status-line"><span>攻撃回数</span><span>${p.attackCount}</span></div>
      <div class="menu-status-line"><span>クリティカル率</span><span>${Math.round((p.criticalRate || 0) * 100)}%</span></div>
      <div class="menu-status-line"><span>クリティカルダメージ倍率</span><span>×${(p.criticalDamage || 0).toFixed(2)}</span></div>
      <div class="menu-status-line"><span>全体攻撃</span><span>${p.aoeAttack ? "有効" : "無効"}</span></div>
      <div class="menu-status-line"><span>戦闘の追加ターン数</span><span>+${p.extraTurns || 0}</span></div>
      <div class="menu-status-line"><span>サイコロの追加個数</span><span>+${p.diceCountBonus || 0}</span></div>
      <div class="menu-status-line"><span>装備武器</span><span>${weaponName}</span></div>
      <div class="menu-weapon-desc">${weaponDesc}</div>
      <hr>
      <div class="menu-status-line"><span>所持金 (walletGold)</span><span>${GameState.walletGold}G</span></div>
      <div class="menu-status-line"><span>周回メダル</span><span>${GameState.medals}</span></div>
    `;
  },

  // 同じidのものをまとめて「×N」表示にする（stackableなカード/お守り対策）
  renderListTab(list, emptyMessage) {
    if (!list || list.length === 0) {
      return `<div class="menu-empty">${emptyMessage}</div>`;
    }

    const grouped = [];
    const indexById = {};
    list.forEach((item) => {
      if (indexById[item.id] !== undefined) {
        grouped[indexById[item.id]].count += 1;
      } else {
        indexById[item.id] = grouped.length;
        grouped.push({ ...item, count: 1 });
      }
    });

    return grouped
      .map((item) => {
        const hasImage = AssetManager.getImageUrl(item.id);
        const iconHtml = hasImage
          ? `<div class="menu-list-item-icon has-image" style="background-image:url('${hasImage}')"></div>`
          : `<div class="menu-list-item-icon icon-fallback">✨</div>`;
        const color = item.rarityId ? ItemRarity.getColor(item.rarityId) : "#f5f3ff";
        const rarityTag = item.rarityId ? `[${ItemRarity.getName(item.rarityId)}] ` : "";
        const countTag = item.count > 1 ? ` ×${item.count}` : "";
        return `
      <div class="menu-list-item">
        ${iconHtml}
        <div class="menu-list-item-text">
          <div class="menu-list-item-name" style="color:${color}">${rarityTag}${item.name}${countTag}</div>
          <div class="menu-list-item-desc">${item.description}</div>
        </div>
      </div>`;
      })
      .join("");
  },
};
