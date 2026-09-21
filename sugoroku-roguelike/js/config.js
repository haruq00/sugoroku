// ============================================================
// config.js
// ゲームバランスに関わる数値・データをまとめたファイル。
// ここを書き換えるだけで多くの調整ができるようにしています。
//
// バランス設計の方針（目安）：
//   ・GAME 1 のラウンド1で、5体の敵のうち「ぎりぎり2体倒せるかどうか」くらいを想定。
//   ・モンスターのHP・報酬はGAMEクリアごとに少しずつスケーリングして増える。
//   ・武器・お守り・カード・パッシブによる強化を積み重ねていくと、
//     だいたいGAME10前後で敵をワンパンできるくらいの火力になることを想定。
//   ・アイテムのレア度（NORMAL/RARE/EPIC/LEGENDARY/PREDATOR）は
//     ゲームを進めるほど上位のものが解禁・出やすくなる。
//   ・これらはあくまで目安であり、プレイヤーの選択（何を取るか）によって変動する。
// ============================================================

const CONFIG = {
  // 将来の大ダメージ表示に備えた短縮表記（1200→"1.2K"、25000000→"25M" など）。
  // デモ時点の桁数では通常表示とほぼ変わらないが、製品版で数百万〜数億に
  // なっても壊れないよう、ダメージ表示は最初からこの関数を通す。
  formatNumber(n) {
    const abs = Math.abs(n);
    const sign = n < 0 ? "-" : "";
    if (abs < 1000) return `${sign}${Math.round(abs)}`;
    const units = [
      { value: 1e12, suffix: "T" },
      { value: 1e9, suffix: "B" },
      { value: 1e6, suffix: "M" },
      { value: 1e3, suffix: "K" },
    ];
    for (const u of units) {
      if (abs >= u.value) {
        const v = abs / u.value;
        const str = v >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, "");
        return `${sign}${str}${u.suffix}`;
      }
    }
    return `${sign}${Math.round(abs)}`;
  },

  // ---- 画面解像度 ----
  BASE_WIDTH: 960,
  BASE_HEIGHT: 540,

  // ---- ラウンド ----
  MAX_ROUNDS: 5,

  // ---- 戦闘のテンポ関連 ----
  // 戦闘は「プレイヤー先攻の高速カードバトル」。手札からカードを選んで
  // ACTIONを消費し、ACTIONが尽きる／END TURNでENEMY TURNへ。
  // カードを押した瞬間に数字だけ処理するのではなく、選んだカードに応じて
  // 自動で攻撃アニメーション→ダメージ→Critical→撃破、を高速表示する
  // （意思決定はカードゲーム、爽快感は自動アクション）。

  // 戦闘のテンポ（自動アクション部分の演出速度。目安：攻撃0.2〜0.3秒）
  BATTLE_INITIAL_DELAY_MS: 200,   // 敵出現から手札が引かれるまでの間
  BATTLE_PER_HIT_DELAY_MS: 220,   // 1回のヒットごとの間隔（AOE等で複数ヒットする時）
  BATTLE_AOE_STAGGER_MS: 100,     // 全体攻撃で複数体に当たる時、1体ずつ表示をずらす間隔
  BATTLE_DEFEAT_PAUSE_MS: 180,    // 敵を倒した時の一瞬の間
  BATTLE_END_PAUSE_MS: 300,       // 戦闘終了後、敵表示を消すまでの間
  BATTLE_ENEMY_TURN_DELAY_MS: 250,// ENEMY TURN、1体ごとの反撃間隔

  // サイコロ・盤面移動のテンポ（目安：サイコロ0.3〜0.6秒、1マス移動0.1〜0.2秒）
  DICE_FLICKER_DURATION_MS: 420,  // サイコロが目まぐるしく切り替わる時間
  DICE_FLICKER_INTERVAL_MS: 60,   // 切り替わる間隔
  PRE_MOVE_DELAY_MS: 150,         // 出目確定から移動開始までの間
  BOARD_STEP_DELAY_MS: 160,       // すごろくを1マス進むごとの間隔
  TILE_RESOLUTION_DELAY_MS: 300,  // マス処理が終わってからラウンド終了までの間

  // ---- カードバトルの基本ルール ----
  BATTLE: {
    INITIAL_HAND_SIZE: 5,       // 戦闘開始時に引く手札の枚数
    ACTIONS_PER_TURN: 3,        // 1ターンに使えるACTION数
    HAND_SIZE_PER_TURN: 5,      // 2ターン目以降、ターン開始時に引き直す手札の枚数
    BASIC_CARD_COST: 1,         // 基本カードのACTIONコスト
    STRONG_CARD_COST: 2,        // 強力なカードのACTIONコスト
  },

  // ---- プレイヤー初期ステータス ----
  // maxHp/currentHpはGAMEをまたいで持ち越す（GAME開始時に全回復はしない）。
  // ランを最初からやり直した時（GAME OVER後のRESTART）だけ全回復した状態に戻る。
  // 物理/魔法攻撃力・防御・回避は職業ごとにclasses.jsのinitialStatsで上書きされる。
  PLAYER_INITIAL: {
    maxHp: 100,
    currentHp: 100,
    physicalAttack: 10,
    magicAttack: 10,
    defense: 0,               // 被ダメージ = max(1, 敵ATK × (1-回避率) - defense)
    evasion: 0,               // 被弾を完全に回避する確率
    criticalRate: 0.05,
    criticalDamage: 1.5,
    weapon: null,             // 装備中の武器（1つだけ。null=素手）
    armor: null,              // 装備中の防具（1つだけ）
    accessory: null,          // 装備中のアクセサリー（1つだけ）
    diceCountBonus: 0,        // カード等で増えるサイコロの追加個数

    // 職業固有スキルのパラメータ（カード・特性・Bossパッシブで拡張できるよう
    // 「基礎値＋ボーナス」の形にしている。実際の値は下のgetterで合算する）。
    momentumMaxBonus: 0,          // 剣士:闘気の最大値ボーナス（基礎5+これ）
    momentumPerKillBonus: 0,      // 闘気:敵撃破時の獲得量ボーナス（基礎1+これ）
    momentumDamagePercentBonus: 0,// 闘気1あたりの物理ダメージ上昇率ボーナス（基礎10%+これ）
    momentumCarryOver: false,     // trueなら戦闘終了時に闘気をリセットしない
    resonanceMaxBonus: 0,         // 魔法使い:魔力共鳴の上限ボーナス（基礎40%+これ）
    resonancePerEnemyBonus: 0,    // 共鳴:敵1体あたりの上昇率ボーナス（基礎8%+これ）
    resonanceRareWeight: 1,       // 共鳴計算でRare以上の敵を何体分として数えるか
  },

  // 職業固有スキルの基礎値（player.xxxBonusで上乗せする）
  SKILL_BASE: {
    momentumMax: 5,
    momentumPerKill: 1,
    momentumDamagePercent: 0.10, // 闘気1につき物理ダメージ+10%
    resonanceMax: 0.40,          // 魔力共鳴の上限+40%
    resonancePerEnemy: 0.08,     // 敵1体につき魔法ダメージ+8%
  },

  // ---- ワンパンボーナス（将来実装用。現在はOFF） ----
  ONE_SHOT_BONUS_ENABLED: false,
  ONE_SHOT_BONUS_MULTIPLIER: 1.5,

  // ---- サイコロ ----
  // 基本個数。実際に振る個数は CONFIG.DICE_COUNT + player.diceCountBonus。
  DICE_COUNT: 1,

  // ---- 盤面 ----
  BOARD_SIZE: 18,
  BOARD_GRID_COLS: 7,
  BOARD_GRID_ROWS: 4,
  BOARD_TILE_SIZE: 56,

  // マス効果の基本数値
  TILE_VALUES: {
    gold: 50,
    negative: -30,
    treasure: 100,
    heal: 20, // 回復マスでのHP回復量
  },

  TILE_ICONS: {
    start: "🚩",
    enemy: "⚔️",
    gold: "💰",
    negative: "⚠️",
    special_treasure: "💎",
    special_danger: "☠️",
    shop: "🛒",
    heal: "💚",
  },

  // ---- モンスターデータ ----
  // hp/atk/baseRewardはGame1・NORMAL/NORMAL（レア度・強敵度なし）を基準にした値。
  // レア度は原則HP/ATKを増やさず、報酬（おいしさ）だけに影響する。
  // 強敵度（Strong）はHP・ATK（危険度）を増やす。役割分担を維持している。
  // minGameは「そのモンスターが通常のENEMYマスで抽選対象になる最初のGAME番号」
  // （1始まり。例：minGame:1ならGame1から、minGame:2ならGame2から出現）。
  //
  // HPは「最初の数ゲームは、100%ダメージのカードを5枚くらい出せば倒せる」
  // （剣士の初期物理攻撃力30・魔法使いの初期魔法攻撃力32を基準に、
  // 5枚合計150〜160ダメージ前後で通常のNORMAL/STRONGでない敵を倒せる）
  // ことを目安にHPを設定している。
  MONSTERS: [
    { id: "slime", name: "スライム", hp: 100, atk: 6, baseReward: 15, rate: 0.40, minGame: 1 },
    { id: "goblin", name: "ゴブリン", hp: 140, atk: 9, baseReward: 25, rate: 0.30, minGame: 1 },
    { id: "orc", name: "オーク", hp: 190, atk: 13, baseReward: 45, rate: 0.20, minGame: 1 },
    { id: "golem", name: "ゴーレム", hp: 260, atk: 15, baseReward: 100, rate: 0.10, minGame: 2 },
  ],

  MONSTER_HP_SCALING_PER_GAME: 1.23,
  MONSTER_ATK_SCALING_PER_GAME: 1.09,
  MONSTER_REWARD_SCALING_PER_GAME: 1.22,

  // ---- 敵のレア度・強敵度（モンスター生成用。アイテムのレア度とは別物） ----
  RARITIES: [
    { id: "normal", name: "NORMAL", rate: 0.85, rewardMult: 1 },
    { id: "rare", name: "RARE", rate: 0.14, rewardMult: 2 },
    { id: "legendary", name: "LEGENDARY", rate: 0.01, rewardMult: 5 },
  ],
  // 強敵度そのものの定義（rewardMultはゲーム番号によらず共通で使う）。
  // 通常のENEMYマスでの出現率・HP/ATK倍率は、下のSTRONG_RATE_BY_GAME /
  // STRONG_HP_MULT_BY_GAME / STRONG_ATK_MULT_BY_GAMEでゲーム番号ごとに管理する
  // （序盤で急に危険になりすぎないようにするため）。DANGERマスは従来通り
  // DANGER_STRONG_RATEとこのSTRONG_LEVELS.strongの値をそのまま使う
  // （DANGERマスは意図的にリスクが高いマスとして扱うため、ゲーム進行による緩和はしない）。
  STRONG_LEVELS: [
    { id: "normal", name: "NORMAL", rate: 0.80, hpMult: 1, atkMult: 1, rewardMult: 1 },
    { id: "strong", name: "STRONG", rate: 0.20, hpMult: 2, atkMult: 1.5, rewardMult: 1.8 },
  ],
  DANGER_STRONG_RATE: 0.50,

  // 通常ENEMYマスでのSTRONG出現率（index=gameIndex、0始まり）。
  // 配列の範囲を超えたゲーム番号はSTRONG_RATE_DEFAULTを使う。
  STRONG_RATE_BY_GAME: [0, 0.10, 0.20],
  STRONG_RATE_DEFAULT: 0.25,

  // 通常ENEMYマスでSTRONGが出た場合のHP/ATK倍率（index=gameIndex、0始まり）。
  // Game1はSTRONG自体出現しないため実質未使用。
  STRONG_HP_MULT_BY_GAME: [1.0, 1.3, 1.5],
  STRONG_HP_MULT_DEFAULT: 2.0,
  STRONG_ATK_MULT_BY_GAME: [1.0, 1.15, 1.25],
  STRONG_ATK_MULT_DEFAULT: 1.25,

  getStrongRateForGame(gameIndex) {
    const table = this.STRONG_RATE_BY_GAME;
    return gameIndex < table.length ? table[gameIndex] : this.STRONG_RATE_DEFAULT;
  },
  getStrongHpMultForGame(gameIndex) {
    const table = this.STRONG_HP_MULT_BY_GAME;
    return gameIndex < table.length ? table[gameIndex] : this.STRONG_HP_MULT_DEFAULT;
  },
  getStrongAtkMultForGame(gameIndex) {
    const table = this.STRONG_ATK_MULT_BY_GAME;
    return gameIndex < table.length ? table[gameIndex] : this.STRONG_ATK_MULT_DEFAULT;
  },

  ENEMY_COUNT: 1,

  // ---- キャラクター育成システム（3種類のカード＋Boss） ----
  BATTLE_DECK_MAX: 15,         // 戦闘デッキの上限（デモ版）
  BATTLE_DECK_RECOMMENDED_MIN: 8, // 目安の最低枚数（強制はしない）
  BOARD_DECK_MAX: 8,           // すごろくカードの上限（デモ版）
  CARD_DEFAULT_MAX_COPIES: 3,  // カードごとにmaxCopiesの指定が無い場合のデフォルト所持上限
  BOSS_GAME_NUMBERS: [10, 20], // Bossが出現するGAME番号（1始まり）
  DEMO_MAX_GAME: 20,           // デモ版はここまで（Boss2撃破でDEMO CLEAR）
  // Boss戦は長期化しやすいため、平方根スケーリングで緩やかにしたHP/ATKに、
  // ここでさらに倍率をかける（仮値。Boss1 HP3000〜5000/Boss2 HP30000〜80000の
  // 目安に合わせている）。
  BOSS_HP_MULTIPLIER: 4,
  BOSS_ATK_MULTIPLIER: 1.1,
  BOSS_REWARD_MULTIPLIER: 10,

  // ---- GAME終了時のカード報酬（戦闘2枚＋すごろく2枚の4択） ----
  REWARD: {
    BATTLE_CHOICES: 2,   // GAME CLEAR報酬のアクションカード枠数
    STAT_CHOICES: 2,     // GAME CLEAR報酬のステータス強化カード枠数
    SKIP_GOLD: 100,       // 何も選ばずSKIPした時に貰えるゴールド
    MISSION_RARE_GUARANTEE_MIN_RARITY: "rare",
  },

  // ---- 装備上限（デモ版では所持上限＝装備上限） ----
  EQUIPMENT: {
    weaponMax: 1,
    armorMax: 2,
    charmMax: 3,
    giveInitialWeapon: false, // trueにすると各職業がclasses.jsのinitialWeaponIdを装備した状態で始まる
  },

  // ---- TREASURE / BONUS TARGET宝箱の抽選テーブル ----
  TREASURE: {
    CATEGORY_WEIGHTS: { board: 0.60, stat: 0.15, equipment: 0.10, gold: 0.10, special: 0.05 },
    BOARD_CHOICE_COUNT: 3, // 盤面カードが選ばれた時の候補数
    GOLD_AMOUNT_BY_QUALITY: { bronze: 80, silver: 150, gold: 300 },
    SPECIAL_GOLD_FALLBACK: 200, // 特殊報酬は今回はGoldで代替する仮実装
  },

  // ---- BONUS TARGET宝箱の品質（達成状況で変わる） ----
  BONUS_CHEST_QUALITY: "bronze", // 達成のみ: bronze / 大きく上回った場合はsilverにする、等の拡張入口

  // ---- BONUS TARGET（GAME開始時に3択、達成は任意） ----
  MISSION_CHOICE_COUNT: 3,

  // ---- 盤面構成（ステージごとの「マスの内訳」） ----
  STAGES: {
    STANDARD: {
      name: "STANDARD",
      counts: { start: 1, enemy: 6, gold: 4, negative: 3, special_treasure: 1, special_danger: 1, shop: 1, heal: 1 },
    },
    MONSTER_NEST: {
      name: "MONSTER_NEST",
      counts: { start: 1, enemy: 8, gold: 2, negative: 3, special_treasure: 1, special_danger: 1, shop: 1, heal: 1 },
    },
    GOLDEN_ROAD: {
      name: "GOLDEN_ROAD",
      counts: { start: 1, enemy: 3, gold: 7, negative: 3, special_treasure: 1, special_danger: 1, shop: 1, heal: 1 },
    },
  },

  TILE_MESSAGES: {
    start: () => "スタート地点を通過した！",
    gold: (amount) => `利益マス！ ${amount}G を獲得した！`,
    negative: (amount) => `マイナスマス… ${Math.abs(amount)}G を失った…`,
    special_treasure: (amount) => `TREASURE！ ${amount}G を獲得した！`,
    special_danger: () => "DANGERマス！強敵が現れやすい…",
    enemy: () => "敵が現れた！",
    shop: () => "ショップに立ち寄った！",
    heal: (amount) => `回復マス！ HPが${amount}回復した！`,
  },

  // ---- GAMEごとのステージ（盤面の内訳バリエーション。ローテーションで使う） ----
  GAME_STAGE_SEQUENCE: ["STANDARD", "MONSTER_NEST", "GOLDEN_ROAD"],

  // 通常のGAME終了時ゴールド報酬の基礎値（BONUS TARGET未達成でも貰える最低限の宝箱）。
  // GAMEが進むほど少しずつ増える。
  BASE_GAME_CLEAR_GOLD: 40,
  GAME_CLEAR_GOLD_SCALING_PER_GAME: 1.15,

  getBaseGameClearGold(gameIndex) {
    return Math.round(this.BASE_GAME_CLEAR_GOLD * Math.pow(this.GAME_CLEAR_GOLD_SCALING_PER_GAME, gameIndex));
  },

  // ============================================================
  // アイテムのレア度（パッシブ・カード・お守り・武器で共通）。
  // ゲームが進む（gameIndexが増える）ほど上位のレア度が解禁され、
  // 出現率も上がっていく（js/rarity.js のItemRarityが処理する）。
  // 色は名前の表示に使う（ノーマル白／レア青／エピック紫／レジェンド金／プレデター赤）。
  // ============================================================
  ITEM_RARITIES: [
    { id: "normal", name: "NORMAL", color: "#f5f3ff", unlockGame: 0 },
    { id: "rare", name: "RARE", color: "#4ec3ff", unlockGame: 0 },
    { id: "epic", name: "EPIC", color: "#b18aff", unlockGame: 3 },
    { id: "legendary", name: "LEGENDARY", color: "#ffd23f", unlockGame: 6 },
    { id: "predator", name: "PREDATOR", color: "#ff4757", unlockGame: 9 },
  ],

  // カード選択（クリア報酬）のレア度の重み。PERFECT CLEARだと上位が出やすい。
  // 通常のカード報酬レア度の重み。BONUS TARGET達成時はBOOSTEDの方を使い、
  // 上位レア度が出やすくなる（rewardSystem.js側で「1枚は保証」する処理と併用）。
  REWARD_RARITY_WEIGHTS: { normal: 0.45, rare: 0.30, epic: 0.15, legendary: 0.08, predator: 0.02 },
  REWARD_RARITY_WEIGHTS_BOOSTED: { normal: 0.20, rare: 0.25, epic: 0.25, legendary: 0.20, predator: 0.10 },

  // ショップ（武器・お守り）のレア度の重み。gameIndexが増えるほど、
  // growthの値ぶんだけ上位レア度の重みが底上げされていく。
  SHOP_RARITY_BASE_WEIGHTS: { normal: 0.50, rare: 0.30, epic: 0.13, legendary: 0.06, predator: 0.01 },
  SHOP_RARITY_GAME_GROWTH: { normal: -0.02, rare: 0.0, epic: 0.015, legendary: 0.012, predator: 0.008 },

  // ---- ショップ価格（レア度ベース。カテゴリごとに倍率をかける） ----
  SHOP_PRICE_BY_RARITY: { normal: 40, rare: 80, epic: 150, legendary: 280, predator: 450 },
  SHOP_PRICE_CATEGORY_MULT: { action: 1.0, stat: 1.2, board: 1.0, weapon: 1.3, armor: 1.1, charm: 1.0 },

  // ---- ショップ ----
  SHOP: {
    actionCardOffers: 2,
    statCardOffers: 2,
    boardCardOffers: 2,
    weaponOffers: 1,
    armorOffers: 2,
    charmOffers: 2,

    // リロールは1回目50G、2回目100G、3回目150G…と使うたびに一定額ずつ増える。
    // GAMEが変わるとリセットされる（GameState.rerollUseCountはGAMEごとに0へ戻す）。
    REROLL_BASE_COST: 50,
    REROLL_COST_STEP: 50,

    DELETE_ACTION_CARD_COST: 150, // 戦闘デッキからアクションカードを削除する価格（configで変更可能）
  },
};
