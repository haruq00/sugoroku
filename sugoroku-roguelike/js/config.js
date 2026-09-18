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
  // ---- 画面解像度 ----
  BASE_WIDTH: 960,
  BASE_HEIGHT: 540,

  // ---- ラウンド ----
  MAX_ROUNDS: 5,

  // ---- 戦闘のテンポ関連 ----
  // 1体あたりの「攻撃チャンス」の目安。実際に使われる値は
  // (MAX_BATTLE_TURNS_PER_ENEMY + player.extraTurns) で、
  // これに 敵の数 × attackCount を掛けて戦闘全体の最大攻撃回数（スイング数）を決める。
  MAX_BATTLE_TURNS_PER_ENEMY: 3,

  // 戦闘のテンポ（表示のわかりやすさを優先し、やや遅め＝攻撃speedを半分程度に調整）
  BATTLE_INITIAL_DELAY_MS: 800,   // 敵出現から最初の攻撃までの間
  BATTLE_PER_HIT_DELAY_MS: 750,   // 1回の攻撃(スイング)ごとの間隔
  BATTLE_AOE_STAGGER_MS: 220,     // 全体攻撃で複数体に当たる時、1体ずつ表示をずらす間隔
  BATTLE_DEFEAT_PAUSE_MS: 260,    // 敵を倒した時の一瞬の間
  BATTLE_END_PAUSE_MS: 800,       // 戦闘終了後、敵表示を消すまでの間

  // サイコロ・盤面移動のテンポ（1ゲーム＝5ラウンドで、合計だいたい2分くらいを目安に調整）
  DICE_FLICKER_DURATION_MS: 900,  // サイコロが目まぐるしく切り替わる時間
  DICE_FLICKER_INTERVAL_MS: 90,   // 切り替わる間隔
  PRE_MOVE_DELAY_MS: 500,         // 出目確定から移動開始までの間
  BOARD_STEP_DELAY_MS: 260,       // すごろくを1マス進むごとの間隔
  TILE_RESOLUTION_DELAY_MS: 550,  // マス処理が終わってからラウンド終了までの間

  // ---- プレイヤー初期ステータス ----
  PLAYER_INITIAL: {
    attack: 10,
    attackCount: 1,
    criticalRate: 0.02,       // 初期クリティカル率 2%
    criticalDamage: 2.0,
    aoeAttack: false,         // trueになると1回の攻撃が生存中の敵全員に命中する
    weapon: null,             // 装備中の武器（1つだけ。null=素手）
    diceCountBonus: 0,        // カード等で増えるサイコロの追加個数
    extraTurns: 0,            // カード等で増える、戦闘の攻撃チャンス(ターン)の追加数
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
  BOARD_TILE_SIZE: 46,

  // マス効果の基本数値
  TILE_VALUES: {
    gold: 50,
    negative: -30,
    treasure: 100,
  },

  TILE_ICONS: {
    start: "🚩",
    enemy: "⚔️",
    gold: "💰",
    negative: "⚠️",
    special_treasure: "💎",
    special_danger: "☠️",
    shop: "🛒",
  },

  // ---- モンスターデータ ----
  // hp/baseRewardはGame1・NORMAL/NORMAL（レア度・強敵度なし）を基準にした値。
  // minGameは「そのモンスターが通常のENEMYマスで抽選対象になる最初のGAME番号」
  // （1始まり。例：minGame:1ならGame1から、minGame:2ならGame2から出現）。
  // 新しいモンスターを追加する時も、minGameを設定するだけで解禁時期を管理できる。
  MONSTERS: [
    { id: "slime", name: "スライム", hp: 8, baseReward: 15, rate: 0.40, minGame: 1 },
    { id: "goblin", name: "ゴブリン", hp: 14, baseReward: 25, rate: 0.30, minGame: 1 },
    { id: "orc", name: "オーク", hp: 24, baseReward: 45, rate: 0.20, minGame: 1 },
    { id: "golem", name: "ゴーレム", hp: 40, baseReward: 100, rate: 0.10, minGame: 2 },
  ],

  MONSTER_HP_SCALING_PER_GAME: 1.15,
  MONSTER_REWARD_SCALING_PER_GAME: 1.12,

  // ---- 敵のレア度・強敵度（モンスター生成用。アイテムのレア度とは別物） ----
  RARITIES: [
    { id: "normal", name: "NORMAL", rate: 0.85, rewardMult: 1 },
    { id: "rare", name: "RARE", rate: 0.14, rewardMult: 2 },
    { id: "legendary", name: "LEGENDARY", rate: 0.01, rewardMult: 5 },
  ],
  // 強敵度そのものの定義（rewardMultはゲーム番号によらず共通で使う）。
  // 通常のENEMYマスでの出現率・HP倍率は、下のSTRONG_RATE_BY_GAME /
  // STRONG_HP_MULT_BY_GAMEでゲーム番号ごとに管理する（序盤で急に
  // 倒せなくなる敵が出ないようにするため）。DANGERマスは従来通り
  // DANGER_STRONG_RATEとこのSTRONG_LEVELS.strong.hpMultを直接使う。
  STRONG_LEVELS: [
    { id: "normal", name: "NORMAL", rate: 0.80, hpMult: 1, rewardMult: 1 },
    { id: "strong", name: "STRONG", rate: 0.20, hpMult: 2, rewardMult: 1.8 },
  ],
  DANGER_STRONG_RATE: 0.50,

  // 通常ENEMYマスでのSTRONG出現率（index=gameIndex、0始まり）。
  // 配列の範囲を超えたゲーム番号はSTRONG_RATE_DEFAULTを使う。
  STRONG_RATE_BY_GAME: [0, 0.10, 0.20],
  STRONG_RATE_DEFAULT: 0.25,

  // 通常ENEMYマスでSTRONGが出た場合のHP倍率（index=gameIndex、0始まり）。
  // Game1はSTRONG自体出現しないため実質未使用。
  STRONG_HP_MULT_BY_GAME: [1.0, 1.5, 2.0],
  STRONG_HP_MULT_DEFAULT: 2.0,

  getStrongRateForGame(gameIndex) {
    const table = this.STRONG_RATE_BY_GAME;
    return gameIndex < table.length ? table[gameIndex] : this.STRONG_RATE_DEFAULT;
  },
  getStrongHpMultForGame(gameIndex) {
    const table = this.STRONG_HP_MULT_BY_GAME;
    return gameIndex < table.length ? table[gameIndex] : this.STRONG_HP_MULT_DEFAULT;
  },

  // 通常ENEMYマスで敵を抽選する時、「プレイヤーの理論最大ダメージ×このマージン」を
  // 超えるモンスターは抽選対象から除外する（絶対に倒せない敵が出ないようにする安全策）。
  // 1.0なら「ちょうど倒しきれる」までを許容。DANGERマスにはこの安全策は適用しない
  // （DANGERマスは元から「強敵が出やすい」リスクのあるマスとして扱う）。
  ENEMY_SAFETY_MARGIN: 1.0,

  ENEMY_COUNT: 1,

  // ---- 盤面構成（ステージごとの「マスの内訳」） ----
  STAGES: {
    STANDARD: {
      name: "STANDARD",
      counts: { start: 1, enemy: 6, gold: 5, negative: 3, special_treasure: 1, special_danger: 1, shop: 1 },
    },
    MONSTER_NEST: {
      name: "MONSTER_NEST",
      counts: { start: 1, enemy: 8, gold: 3, negative: 3, special_treasure: 1, special_danger: 1, shop: 1 },
    },
    GOLDEN_ROAD: {
      name: "GOLDEN_ROAD",
      counts: { start: 1, enemy: 3, gold: 8, negative: 3, special_treasure: 1, special_danger: 1, shop: 1 },
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
  },

  GAMES: [
    { stage: "STANDARD", goldQuota: 120, killQuota: 2 },
    { stage: "MONSTER_NEST", goldQuota: 180, killQuota: 3 },
    { stage: "GOLDEN_ROAD", goldQuota: 260, killQuota: 4 },
  ],
  GAME_SCALING: {
    goldQuotaMultiplier: 1.3,
    killQuotaIncrement: 1,
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
  CARD_CLEAR_RARITY_WEIGHTS: { normal: 0.45, rare: 0.30, epic: 0.15, legendary: 0.08, predator: 0.02 },
  CARD_PERFECT_RARITY_WEIGHTS: { normal: 0.20, rare: 0.25, epic: 0.25, legendary: 0.20, predator: 0.10 },
  CARD_CHOICE_COUNT: 3,
  PASSIVE_CHOICE_COUNT: 3,

  // ショップ（武器・お守り）のレア度の重み。gameIndexが増えるほど、
  // growthの値ぶんだけ上位レア度の重みが底上げされていく。
  SHOP_RARITY_BASE_WEIGHTS: { normal: 0.50, rare: 0.30, epic: 0.13, legendary: 0.06, predator: 0.01 },
  SHOP_RARITY_GAME_GROWTH: { normal: -0.02, rare: 0.0, epic: 0.015, legendary: 0.012, predator: 0.008 },

  // ============================================================
  // パッシブ（ラン開始時に1つだけ選んで「永続的に」獲得する効果）。
  // 常に選択肢に出せるよう、レア度による解禁制限はかけていない
  // （rarityIdは名前の色分け表示のためだけに使う）。
  // apply(player, ctx) / remove(player, ctx) でステータスを直接書き換える。
  // ctxはこのアイテム1個ぶんの獲得記録（ランダム抽選値などを覚えておく場所）。
  // クリティカル率は「現在値に対して何%上昇させるか」の倍率で扱う
  // （例：2%の状態で+6%なら 0.02×1.06 になる）。
  // 画像を用意したい場合は assets/passives/<id>.png に置くと自動で使われる。
  // ============================================================
  PASSIVES: [
    {
      id: "passive_power",
      name: "力の心得",
      description: "攻撃力 +3（永続）",
      rarityId: "normal",
      apply: (p) => { p.attack += 3; },
    },
    {
      id: "passive_toughness",
      name: "剛力の心得",
      description: "攻撃力 +6（永続）",
      rarityId: "normal",
      apply: (p) => { p.attack += 6; },
    },
    {
      id: "passive_focus",
      name: "集中の心得",
      description: "クリティカル率を6%上昇（現在値×1.06）",
      rarityId: "rare",
      apply: (p) => { p.criticalRate *= 1.06; },
    },
    {
      id: "passive_ferocity",
      name: "会心の心得",
      description: "クリティカルダメージ倍率 +0.3（永続）",
      rarityId: "rare",
      apply: (p) => { p.criticalDamage += 0.3; },
    },
    {
      id: "passive_multistrike",
      name: "連撃の心得",
      description: "攻撃回数 +1（永続）",
      rarityId: "rare",
      apply: (p) => { p.attackCount += 1; },
    },
    {
      id: "passive_cleave",
      name: "薙ぎ払いの心得",
      description: "攻撃が生存中の敵全員に命中するようになる（永続・全体攻撃）",
      rarityId: "epic",
      apply: (p) => { p.aoeAttack = true; },
    },
  ],

  // ============================================================
  // カード（ゲームクリア時に選んで「永続的に」獲得する効果）。
  // stackable: true のカードは何度でも選択肢に出てくる（重ねがけ可能）。
  // rarityId は解禁ゲーム数・抽選の重みに使う（js/rarity.js）。
  // 画像を用意したい場合は assets/cards/<id>.png に置くと自動で使われる。
  // ============================================================
  CARDS: [
    {
      id: "card_attack_up",
      name: "鍛錬の証",
      description: "攻撃力 +8（永続）",
      rarityId: "normal",
      stackable: true,
      apply: (p) => { p.attack += 8; },
      remove: (p) => { p.attack -= 8; },
    },
    {
      id: "card_attack_count_up",
      name: "二刀の極意",
      description: "攻撃回数 +1（永続）",
      rarityId: "rare",
      stackable: true,
      apply: (p) => { p.attackCount += 1; },
      remove: (p) => { p.attackCount -= 1; },
    },
    {
      id: "card_extra_turn",
      name: "不屈の闘志",
      description: "戦闘の攻撃チャンス(ターン数) +1（永続）",
      rarityId: "rare",
      stackable: true,
      apply: (p) => { p.extraTurns += 1; },
      remove: (p) => { p.extraTurns -= 1; },
    },
    {
      id: "card_crit_rate_mult",
      name: "百発百中の証",
      description: "クリティカル率を10%上昇（現在値×1.10）",
      rarityId: "rare",
      stackable: true,
      apply: (p, ctx) => { ctx.mult = 1.10; p.criticalRate *= ctx.mult; },
      remove: (p, ctx) => { p.criticalRate /= ctx.mult; },
    },
    {
      id: "card_crit_damage_up",
      name: "会心の極意",
      description: "クリティカルダメージ倍率 +0.4（永続）",
      rarityId: "epic",
      stackable: true,
      apply: (p) => { p.criticalDamage += 0.4; },
      remove: (p) => { p.criticalDamage -= 0.4; },
    },
    {
      id: "card_power_surge",
      name: "覇力の奔流",
      description: "攻撃力 +20（永続）",
      rarityId: "epic",
      stackable: true,
      apply: (p) => { p.attack += 20; },
      remove: (p) => { p.attack -= 20; },
    },
    {
      id: "card_cleave",
      name: "豪傑の証",
      description: "攻撃が生存中の敵全員に命中するようになる（永続・全体攻撃）",
      rarityId: "legendary",
      stackable: false,
      apply: (p) => { p.aoeAttack = true; },
      remove: (p) => { p.aoeAttack = false; },
    },
    {
      id: "card_extra_die",
      name: "二つ目の運命",
      description: "サイコロの数 +1（永続）",
      rarityId: "legendary",
      stackable: true,
      apply: (p) => { p.diceCountBonus += 1; },
      remove: (p) => { p.diceCountBonus -= 1; },
    },
    {
      id: "card_ultimate_power",
      name: "極限の力",
      description: "攻撃力 +45（永続）",
      rarityId: "predator",
      stackable: true,
      apply: (p) => { p.attack += 45; },
      remove: (p) => { p.attack -= 45; },
    },
    {
      id: "card_crit_rate_mult_big",
      name: "必滅の一撃",
      description: "クリティカル率を50%上昇（現在値×1.50）",
      rarityId: "predator",
      stackable: true,
      apply: (p, ctx) => { ctx.mult = 1.50; p.criticalRate *= ctx.mult; },
      remove: (p, ctx) => { p.criticalRate /= ctx.mult; },
    },
  ],

  // ============================================================
  // お守り（ショップで購入して「永続的に」獲得する効果。複数持てる）。
  // クリティカル率を実数（％ポイント）でそのまま上げるのはLEGENDARY限定。
  // それ以外のクリティカル率強化は、カード/パッシブと同様「現在値への倍率」。
  // apply(player, ctx) / remove(player, ctx) でステータスを直接書き換える。
  // 画像を用意したい場合は assets/omamori/<id>.png に置くと自動で使われる。
  // ============================================================
  OMAMORI: [
    {
      id: "omamori_power",
      name: "力のお守り",
      description: "攻撃力 +4（永続）",
      rarityId: "normal",
      price: 50,
      stackable: true,
      apply: (p) => { p.attack += 4; },
      remove: (p) => { p.attack -= 4; },
    },
    {
      id: "omamori_focus",
      name: "集中のお守り",
      description: "クリティカル率を6%上昇（現在値×1.06）",
      rarityId: "rare",
      price: 90,
      stackable: true,
      apply: (p, ctx) => { ctx.mult = 1.06; p.criticalRate *= ctx.mult; },
      remove: (p, ctx) => { p.criticalRate /= ctx.mult; },
    },
    {
      id: "omamori_fury",
      name: "憤怒のお守り",
      description: "クリティカルダメージ倍率 +0.4（永続）",
      rarityId: "epic",
      price: 160,
      stackable: true,
      apply: (p) => { p.criticalDamage += 0.4; },
      remove: (p) => { p.criticalDamage -= 0.4; },
    },
    {
      id: "omamori_luck",
      name: "幸運のお守り",
      description: "クリティカル率 +1〜5%（ランダム・実数値・永続。実数値で増えるのはこのお守りだけの特別効果）",
      rarityId: "legendary",
      price: 320,
      stackable: true,
      // 実数値で加算する唯一の効果。上限5%の範囲でランダムに決まり、
      // 削除する時のためにctxに実際の値を覚えておく。
      apply: (p, ctx) => {
        const amount = 0.01 + Math.random() * 0.04; // 1%〜5%
        ctx.amount = amount;
        p.criticalRate += amount;
      },
      remove: (p, ctx) => { p.criticalRate -= ctx.amount; },
    },
    {
      id: "omamori_titan",
      name: "巨人のお守り",
      description: "攻撃力 +25（永続）",
      rarityId: "predator",
      price: 450,
      stackable: true,
      apply: (p) => { p.attack += 25; },
      remove: (p) => { p.attack -= 25; },
    },
  ],

  // ============================================================
  // 武器（ショップで購入して装備する。1つしか持てず、新しく装備すると
  // 古い武器は自動的に手放される）。ダメージは攻撃力に加えて
  // minRoll〜maxRollの範囲でランダムに上乗せされ、ダメージにばらつきが出る。
  // 画像を用意したい場合は assets/weapons/<id>.png に置くと自動で使われる。
  // ============================================================
  WEAPONS: [
    {
      id: "rusty_dagger",
      name: "錆びたダガー",
      description: "追加ダメージ 2〜6",
      rarityId: "normal",
      price: 40,
      minRoll: 2,
      maxRoll: 6,
    },
    {
      id: "iron_sword",
      name: "鉄の剣",
      description: "追加ダメージ 5〜12",
      rarityId: "normal",
      price: 80,
      minRoll: 5,
      maxRoll: 12,
    },
    {
      id: "battle_axe",
      name: "バトルアックス",
      description: "追加ダメージ 12〜26",
      rarityId: "rare",
      price: 180,
      minRoll: 12,
      maxRoll: 26,
    },
    {
      id: "flame_blade",
      name: "フレイムブレード",
      description: "追加ダメージ 18〜34",
      rarityId: "epic",
      price: 240,
      minRoll: 18,
      maxRoll: 34,
    },
    {
      id: "storm_lance",
      name: "ストームランス",
      description: "追加ダメージ 22〜40",
      rarityId: "epic",
      price: 270,
      minRoll: 22,
      maxRoll: 40,
    },
    {
      id: "dragon_fang",
      name: "ドラゴンファング",
      description: "追加ダメージ 30〜60",
      rarityId: "legendary",
      price: 420,
      minRoll: 30,
      maxRoll: 60,
    },
    {
      id: "apocalypse_edge",
      name: "アポカリプス・エッジ",
      description: "追加ダメージ 50〜100",
      rarityId: "predator",
      price: 650,
      minRoll: 50,
      maxRoll: 100,
    },
  ],

  // ---- ショップ ----
  SHOP: {
    weaponOffers: 2,   // 一度に並ぶ武器の数（重複なし）
    omamoriOffers: 2,  // 一度に並ぶお守りの数（重複なし）

    // リロール・削除のコストは「使うたびに」「ゲームが進むたびに」上がっていく。
    // 実際のコスト = 基本値 × (GAME成長率^gameIndex) × (使用成長率^これまでの使用回数)
    REROLL_BASE_COST: 30,
    REROLL_COST_GROWTH_PER_USE: 1.25,
    REROLL_COST_GROWTH_PER_GAME: 1.08,

    DELETE_BASE_COST: 40,
    DELETE_COST_GROWTH_PER_USE: 1.30,
    DELETE_COST_GROWTH_PER_GAME: 1.08,
  },
};
