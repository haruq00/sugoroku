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
      case "equipment":
        content.innerHTML = this.renderEquipmentTab();
        break;
      case "passives":
        content.innerHTML = this.renderListTab(GameState.player ? GameState.player.bossPassives : [], "まだBossパッシブを獲得していません。");
        break;
      case "statcards":
        content.innerHTML = this.renderListTab(
          (GameState.player ? GameState.player.statCardHistory : []).map((c) => Object.assign({}, c, { rarityId: c.rarity })),
          "まだステータス強化カードを取得していません。"
        );
        break;
      default:
        content.innerHTML = "";
    }
  },

  // 装備タブ：武器1・防具最大2・お守り最大3をまとめて表示する
  renderEquipmentTab() {
    const p = GameState.player || {};
    const weaponLine = p.weapon
      ? `<div class="menu-status-line"><span>武器</span><span>${p.weapon.name}</span></div><div class="menu-weapon-desc">${p.weapon.description}</div>`
      : `<div class="menu-status-line"><span>武器</span><span>素手（未装備）</span></div>`;

    const armorLines = (p.armor || []).map((a) => `<div class="menu-status-line"><span>防具</span><span>${a.name}</span></div><div class="menu-weapon-desc">${a.description}</div>`).join("")
      || `<div class="menu-status-line"><span>防具</span><span>（${CONFIG.EQUIPMENT.armorMax}枠中0）</span></div>`;

    const charmLines = (p.charms || []).map((c) => `<div class="menu-status-line"><span>お守り</span><span>${c.name}</span></div><div class="menu-weapon-desc">${c.description}</div>`).join("")
      || `<div class="menu-status-line"><span>お守り</span><span>（${CONFIG.EQUIPMENT.charmMax}枠中0）</span></div>`;

    return `${weaponLine}<hr>${armorLines}<hr>${charmLines}`;
  },

  renderStatusTab() {
    const p = GameState.player || {};
    const weaponName = p.weapon ? p.weapon.name : "素手（未装備）";
    const weaponDesc = p.weapon ? p.weapon.description : "ショップで武器を購入すると装備されます";
    const cls = p.classType ? ClassSystem.get(p.classType) : null;
    return `
      <div class="menu-status-line"><span>職業</span><span>${cls ? cls.name : "-"}</span></div>
      <div class="menu-status-line"><span>HP</span><span>${p.currentHp}/${p.maxHp}</span></div>
      <div class="menu-status-line"><span>物理攻撃力</span><span>${p.physicalAttack}</span></div>
      <div class="menu-status-line"><span>魔法攻撃力</span><span>${p.magicAttack}</span></div>
      <div class="menu-status-line"><span>防御力</span><span>${p.defense}</span></div>
      <div class="menu-status-line"><span>回避率</span><span>${Math.round((p.evasion || 0) * 100)}%</span></div>
      <div class="menu-status-line"><span>クリティカル率</span><span>${Math.round((p.criticalRate || 0) * 100)}%</span></div>
      <div class="menu-status-line"><span>クリティカルダメージ倍率</span><span>×${(p.criticalDamage || 0).toFixed(2)}</span></div>
      <div class="menu-status-line"><span>装備武器</span><span>${weaponName}</span></div>
      <div class="menu-weapon-desc">${weaponDesc}</div>
      <hr>
      <div class="menu-status-line"><span>戦闘デッキ</span><span>${p.battleDeck ? p.battleDeck.length : 0}/${CONFIG.BATTLE_DECK_MAX}枚</span></div>
      <div class="menu-status-line"><span>すごろくカード</span><span>${p.boardCards ? p.boardCards.length : 0}/${CONFIG.BOARD_DECK_MAX}枚</span></div>
      <div class="menu-status-line"><span>Bossパッシブ</span><span>${(GameState.player.bossPassives || []).length}枚</span></div>
      <div class="menu-status-line" style="font-size:11px;color:var(--color-text-dim)">（各カードの中身は左のDECKボタンで確認できます）</div>
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
