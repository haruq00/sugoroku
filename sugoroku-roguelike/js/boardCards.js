// ============================================================
// boardCards.js
// 「すごろくカード」のデータ。戦闘デッキとは完全に別枠で、
// 戦闘中に手札へは入らない。取得後はラン中（temporary=そのGAMEのみ／
// permanentRun=ラン終了まで）常時有効。最大所持数はCONFIG.BOARD_DECK_MAX。
//
// カテゴリ：DICE(サイコロ操作) / GOAL(周回) / PASS(通過マス) /
//          TILE(マス強化) / BOARD(盤面改造) / GOLD(経済) /
//          BRIDGE(戦闘との橋渡し)
//
// durationType: "temporary"(そのGAMEのみ) | "permanentRun"(ラン終了まで)。
// 盤面そのものを書き換える効果（開拓・商業化など）はpermanentRun。
// 数値的なバフ（Strong率+など）はtemporaryでもよい、という指針に従っている。
//
// 効果は、通常カード同様 effectId + effectValue を
// boardCardEffectSystem.js 側のハンドラで処理する（if文を増やさない）。
// ============================================================

const BOARD_CARDS = [
  // ---- DICE：サイコロ操作 ----
  { id: "bd_reroll", name: "再投", classType: "COMMON", rarity: "rare", tags: ["DICE"], durationType: "temporary", maxCopies: 2,
    description: "1GAMEに1回、サイコロを振り直せる。", effectId: "reroll_uses_add", effectValue: 1 },
  { id: "bd_choice_two", name: "二択", classType: "COMMON", rarity: "epic", tags: ["DICE"], durationType: "permanentRun", maxCopies: 1,
    description: "サイコロを2個振り、好きな方を採用できる。", effectId: "choose_best_of_two", effectValue: true },
  { id: "bd_light_step", name: "軽い足取り", classType: "COMMON", rarity: "normal", tags: ["DICE"], durationType: "permanentRun", maxCopies: 1,
    description: "サイコロの最低出目を2にする。", effectId: "dice_min_value", effectValue: 2 },
  { id: "bd_sprint", name: "快走", classType: "COMMON", rarity: "normal", tags: ["DICE"], durationType: "permanentRun", maxCopies: 3,
    description: "サイコロ出目+1（最大6）。", effectId: "dice_add", effectValue: 1 },
  { id: "bd_lucky_six", name: "ラッキー6", classType: "COMMON", rarity: "rare", tags: ["DICE"], durationType: "permanentRun", maxCopies: 2,
    description: "6が出た場合、50%の確率で追加ロール（良い方を採用）。", effectId: "reroll_on_six", effectValue: 0.5 },
  { id: "bd_reversal", name: "逆転", classType: "COMMON", rarity: "epic", tags: ["DICE"], durationType: "temporary", maxCopies: 1,
    description: "1GAMEに1回、出目「1」を「6」として扱える。", effectId: "one_becomes_six", effectValue: true },

  // ---- GOAL：周回 ----
  { id: "bd_traveler", name: "旅人", classType: "COMMON", rarity: "normal", tags: ["GOAL", "GOLD"], durationType: "permanentRun", maxCopies: 3,
    description: "GOAL通過時+30G。", effectId: "goal_gold_flat", effectValue: 30 },
  { id: "bd_lapper", name: "周回者", classType: "COMMON", rarity: "rare", tags: ["GOAL", "GOLD"], durationType: "permanentRun", maxCopies: 2,
    description: "GOAL通過時、現在のメダル数×5G獲得。", effectId: "goal_gold_per_medal", effectValue: 5 },
  { id: "bd_long_journey", name: "長旅", classType: "COMMON", rarity: "rare", tags: ["GOAL", "HP"], durationType: "permanentRun", maxCopies: 2,
    description: "GOAL通過時、最大HPの10%回復。", effectId: "goal_heal_percent", effectValue: 0.10 },
  { id: "bd_lap_power", name: "周回火力", classType: "COMMON", rarity: "epic", tags: ["GOAL", "BRIDGE"], durationType: "permanentRun", maxCopies: 2,
    description: "戦闘開始時、周回メダル1枚につき攻撃力+3%（次戦闘に反映）。", effectId: "momentum_from_medals",
    effectValue: 0.03 },
  { id: "bd_goal_dash", name: "ゴールダッシュ", classType: "COMMON", rarity: "epic", tags: ["GOAL", "DICE"], durationType: "temporary", maxCopies: 1,
    description: "GOAL通過後、追加でもう一度サイコロを振れる（同ラウンド内）。", effectId: "goal_extra_roll", effectValue: true },
  { id: "bd_investment", name: "投資", classType: "COMMON", rarity: "rare", tags: ["GOAL", "GOLD"], durationType: "permanentRun", maxCopies: 2,
    description: "GOAL通過時、現在所持金の3%を獲得。", effectId: "goal_percent_gold", effectValue: 0.03 },

  // ---- PASS：通過マス ----
  { id: "bd_pickup", name: "拾い物", classType: "COMMON", rarity: "normal", tags: ["PASS", "GOLD"], durationType: "permanentRun", maxCopies: 3,
    description: "利益マスを通過するたび、少額Gold（+10G）。", effectId: "pass_gold_on_type", effectValue: { tileType: "gold", amount: 10 } },
  { id: "bd_tsuide_gari", name: "ついで狩り", classType: "COMMON", rarity: "rare", tags: ["PASS", "BRIDGE"], durationType: "temporary", maxCopies: 2,
    description: "敵マスを通過するたび、次の戦闘の与ダメージ+5%（累積、戦闘後リセット）。",
    effectId: "pass_stack_battle_buff", effectValue: { tileType: "enemy", percent: 0.05 } },
  { id: "bd_footprint", name: "足跡", classType: "COMMON", rarity: "epic", tags: ["PASS"], durationType: "permanentRun", maxCopies: 1,
    description: "1ラウンドで最初に通過したマスの効果を25%の強さで発動する。", effectId: "first_pass_partial", effectValue: 0.25 },
  { id: "bd_conquest", name: "踏破", classType: "COMMON", rarity: "legendary", tags: ["PASS"], durationType: "permanentRun", maxCopies: 1,
    description: "1ラウンドで最初に通過したマスの効果を100%の強さで発動する。", effectId: "first_pass_partial", effectValue: 1.0 },

  // ---- TILE：マス強化 ----
  { id: "bd_monster_lure", name: "魔物寄せ", classType: "COMMON", rarity: "rare", tags: ["TILE", "BRIDGE"], durationType: "permanentRun", maxCopies: 2,
    description: "敵マスの敵数+1。", effectId: "enemy_count_add", effectValue: 1 },
  { id: "bd_danger_scent", name: "危険な香り", classType: "COMMON", rarity: "normal", tags: ["TILE", "STRONG"], durationType: "permanentRun", maxCopies: 3,
    description: "Strong出現率+10%。", effectId: "strong_rate_add", effectValue: 0.10 },
  { id: "bd_challenger", name: "挑戦者", classType: "COMMON", rarity: "epic", tags: ["TILE", "STRONG", "GOLD"], durationType: "permanentRun", maxCopies: 1,
    description: "Strong出現率+15%。Strong敵の報酬+40%。", effectId: "strong_rate_and_reward",
    effectValue: { rateAdd: 0.15, rewardMult: 1.40 } },
  { id: "bd_fortune", name: "幸運", classType: "COMMON", rarity: "rare", tags: ["TILE", "RARE"], durationType: "permanentRun", maxCopies: 3,
    description: "Rare率+5%。", effectId: "rare_rate_add", effectValue: 0.05 },
  { id: "bd_golden_eye", name: "黄金眼", classType: "COMMON", rarity: "epic", tags: ["TILE", "RARE", "GOLD"], durationType: "permanentRun", maxCopies: 2,
    description: "Rare以上の敵の報酬+30%。", effectId: "rare_reward_mult", effectValue: 1.30 },

  // ---- BOARD：盤面改造（すべてpermanentRun） ----
  { id: "bd_cultivate", name: "開拓", classType: "COMMON", rarity: "epic", tags: ["BOARD"], durationType: "permanentRun", maxCopies: 2,
    description: "盤面のマイナスマスを1つ、通常の利益マスへ変える。", effectId: "convert_tile", effectValue: { from: "negative", to: "gold" } },
  { id: "bd_commercialize", name: "商業化", classType: "COMMON", rarity: "rare", tags: ["BOARD", "GOLD"], durationType: "permanentRun", maxCopies: 2,
    description: "盤面の利益マスを1つ、TREASUREマスへ変える。", effectId: "convert_tile", effectValue: { from: "gold", to: "special_treasure" } },
  { id: "bd_corrupt_land", name: "魔境化", classType: "COMMON", rarity: "epic", tags: ["BOARD", "STRONG", "GOLD"], durationType: "permanentRun", maxCopies: 2,
    description: "盤面の敵マスを1つ、DANGERマス（Strongが出やすい）へ変える。", effectId: "convert_tile", effectValue: { from: "enemy", to: "special_danger" } },
  { id: "bd_sanctuary", name: "聖域化", classType: "COMMON", rarity: "rare", tags: ["BOARD", "HP"], durationType: "permanentRun", maxCopies: 2,
    description: "盤面のマイナスマスを1つ、回復マスへ変える。", effectId: "convert_tile", effectValue: { from: "negative", to: "heal" } },
  { id: "bd_treasure_vault", name: "宝物庫", classType: "COMMON", rarity: "legendary", tags: ["BOARD", "GOLD"], durationType: "permanentRun", maxCopies: 1,
    description: "盤面の利益マスを1つ、TREASUREマスへ変える（より豪華な宝箱）。", effectId: "convert_tile", effectValue: { from: "gold", to: "special_treasure" } },

  // ---- GOLD：経済 ----
  { id: "bd_fortune_luck", name: "金運", classType: "COMMON", rarity: "normal", tags: ["GOLD"], durationType: "permanentRun", maxCopies: 3,
    description: "すべての獲得金+15%。", effectId: "gold_gain_mult", effectValue: 1.15 },

  // ---- BRIDGE：戦闘との橋渡し ----
  { id: "bd_momentum_roll", name: "勢い任せ", classType: "COMMON", rarity: "rare", tags: ["BRIDGE", "DICE"], durationType: "temporary", maxCopies: 2,
    description: "直前のサイコロ出目×10%ぶん、次戦闘の最初の攻撃ダメージUP。", effectId: "dice_value_to_first_attack", effectValue: 0.10 },
  { id: "bd_forced_march", name: "強行軍", classType: "COMMON", rarity: "epic", tags: ["BRIDGE"], durationType: "temporary", maxCopies: 1,
    description: "5マス以上移動して敵マスに止まった場合、その戦闘の初期手札+2。", effectId: "long_move_extra_hand",
    effectValue: { threshold: 5, extraHand: 2 } },
  { id: "bd_journey_power", name: "長旅の力", classType: "COMMON", rarity: "epic", tags: ["BRIDGE", "GOAL"], durationType: "permanentRun", maxCopies: 1,
    description: "周回メダル1枚につき、戦闘開始時の攻撃力+4%。", effectId: "momentum_from_medals", effectValue: 0.04 },
  { id: "bd_monster_road", name: "魔物街道", classType: "COMMON", rarity: "epic", tags: ["BRIDGE", "PASS"], durationType: "temporary", maxCopies: 1,
    description: "敵マスを通過するたび、次の戦闘の敵数・報酬+10%（累積、戦闘後リセット）。",
    effectId: "pass_stack_enemy_and_reward", effectValue: 0.10 },
  { id: "bd_golden_power", name: "黄金の力", classType: "COMMON", rarity: "legendary", tags: ["BRIDGE", "GOLD"], durationType: "temporary", maxCopies: 1,
    description: "そのGAMEで稼いだGold100Gにつき、次戦闘の与ダメージ+1%（最大+30%）。",
    effectId: "earned_gold_to_battle_damage", effectValue: { per: 100, percent: 0.01, max: 0.30 } },
];
