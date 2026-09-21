# すごろく×ローグライク プロトタイプ（カードバトル版）

**ジャンル：すごろく × デッキ構築 × 高速カードバトル × ローグライク**

すごろく側で「どんな戦闘を発生させるか」を作り、戦闘側で「作った状況をどう爆発させるか」を考えるゲームです。すごろくカード・戦闘デッキ・戦闘特性・Bossパッシブを組み合わせて、強い盤面と強い戦闘デッキを同時に作っていきます。

## 1. 今回の最大の変更：完全オート戦闘 → 高速カードバトル

- 戦闘開始時に手札5枚を引き、1ターン3ACTIONの範囲でカードを選んで使用（基本カード1ACTION、強力なカード2ACTION）。
- ACTIONが尽きる、またはEND TURNを押すと自動でENEMY TURNへ。プレイヤーは必ず先攻。
- カードを選ぶと、上画面でキャラクターが自動で攻撃アニメーション→ダメージ→Critical→撃破、を高速表示（意思決定はカードゲーム、爽快感は自動アクション）。
- 手札は上画面下部（`#battle-hand-area`）に表示。ACTION残数・職業固有スキルゲージ（闘気/魔力共鳴）もここに表示。

## 2. カードシステムの整理

| 種類 | 入る場所 | 上限 | 役割 |
|---|---|---|---|
| 戦闘アクションカード | 戦闘デッキ→手札 | 15枚 | 「戦闘中に何をするか」 |
| すごろくカード | 常時有効（手札には入らない） | 8枚 | 「どんな戦闘や報酬を作るか」 |
| 戦闘特性カード | 装備するだけ（デッキにも手札にも入らない） | 3枚 | 「戦闘ルール・戦い方を変える」 |
| Bossパッシブ | Boss撃破で1つ | 制限なし | 「ラン全体のルールを壊す」 |
| 装備（武器/お守り） | 既存のショップシステムを維持 | 各1つ/複数 | 「基礎ステータスを作る」 |

役割を混同しないことを徹底しています（詳細は`js/game.js`冒頭コメント、および`js/cardEffectSystem.js`冒頭コメント参照）。

## 3. ファイル構成（新規追加・全面刷新分）

| ファイル | 役割 |
|---|---|
| `js/battleCards.js` | 戦闘アクションカード50枚（汎用20＋剣士15＋魔法使い15）のデータ |
| `js/boardCards.js` | すごろくカード33枚（DICE/GOAL/PASS/TILE/BOARD/GOLD/BRIDGE）のデータ |
| `js/traitCards.js` | 戦闘特性カード15枚（汎用5＋剣士5＋魔法使い5）のデータ |
| `js/passives.js` | Boss1/Boss2パッシブのデータ（既存を新ステータス名に合わせて更新） |
| `js/deckSystem.js` | 3種類のカード共通のデッキ管理（プール取得・上限判定・追加・交換・削除） |
| `js/cardEffectSystem.js` | ダメージ計算パイプライン、3種類のカードのeffectId/triggerハンドラ |
| `js/battleSystem.js` | 高速カードバトルの中核エンジン（手札・ACTION・ターン進行・勝敗判定） |
| `js/battleUI.js` | 手札・ACTION表示・END TURN/RETREATボタンの画面表示 |
| `js/missionSystem.js` | BONUS TARGET（GAME開始時3択、達成は任意） |
| `js/rewardSystem.js` | GAME終了時4択（戦闘2＋すごろく2、特性混入、SKIP）の組み立て |
| `js/classes.js` | 職業データ（新ステータス：物理/魔法攻撃・防御・回避・初期戦闘デッキ） |
| `js/combat.js` | 敵生成専用に整理（戦闘進行はbattleSystem.jsへ移行） |
| `js/board.js` | 未来位置表示・通過マス判定・盤面改造(convertRandomTile)を追加 |
| `js/game.js` | 全体進行のオーケストレーション（全面書き換え） |

**削除したファイル**：`js/cardsData.js` / `js/cardSystem.js` / `js/mainAttack.js`（旧オート戦闘用のデッキ・メイン攻撃システム。今回のカードバトル化で完全に置き換えられたため削除しました）。

## 4. 職業初期ステータス（新規）

| | 物理攻撃 | 魔法攻撃 | 防御 | 回避 | HP |
|---|---|---|---|---|---|
| 剣士 | 30 | 5 | 8 | 5% | 120 |
| 魔法使い | 8 | 32 | 3 | 10% | 85 |

職業固有スキル：剣士は「闘気」（敵撃破+1、最大5、1につき物理+10%、戦闘終了時リセット）、魔法使いは「魔力共鳴」（敵1体につき魔法+8%、最大+40%、Rare以上は`resonanceRareWeight`倍で計算）。`CONFIG.SKILL_BASE`で基礎値を、各種カード/特性で上乗せ値を調整できます。

## 5. サイコロ「運命の微調整」（新規）

1GAMEに`CONFIG.DICE_ADJUST_USES_PER_GAME`回（初期1回）、出目を±1にできます。サイコロを振ると出目確定後に選択オーバーレイが出ます。すごろくカード「微調整」で回数を増やせます。

## 6. 未来位置表示（新規）

サイコロを振る前、現在位置から1〜6マス進んだ場合の停止マスを盤面上に小さいマーカーで常時表示します（`Board.getFuturePositions()` / `UI.showLookahead()`）。

## 7. BONUS TARGET（新規。旧「金額/討伐ノルマ」を置き換え）

GAME開始時に3択（カテゴリが被らないように選出）。達成は任意で、GAME進行には影響しません。達成した場合のみGAME終了時のGold報酬が2倍になります。カテゴリ：BATTLE/STRONG/RARE/GOAL/DICE/GOLD/SURVIVAL/DAMAGE（`js/missionSystem.js`の`MISSION_TEMPLATES`）。

## 8. GAME終了時のカード報酬（新規）

戦闘系2枚＋すごろく系2枚の4択（`js/rewardSystem.js`）。戦闘枠は15%の確率で戦闘特性カードに化け、Game5・15では戦闘枠のうち1枚が必ず特性カード候補になります。SKIPすると+100G。BONUS TARGET達成時はレア度の重みが上がり、rare以上を1枚保証します。

## 9. RETREAT（新規）

最低1ラウンドプレイ後、`#battle-retreat-btn`で残りラウンドを放棄しGAME終了できます（Boss戦では非表示）。

## 10. どこを変更すれば良いか

| やりたいこと | 変更箇所 |
|---|---|
| 戦闘カードを追加 | `js/battleCards.js`に1エントリ追加。単純な倍率ダメージなら`hits:[{percent, targets}]`だけで完結。特殊効果は`effectId`を付け、`js/cardEffectSystem.js`の`BATTLE_CARD_HANDLERS`または`DAMAGE_CONDITION_HANDLERS`に処理を1つ追加 |
| すごろくカードを追加 | `js/boardCards.js`に1エントリ追加。`effectId`のハンドラは`CardEffectSystem.BOARD_CARD_HANDLERS` |
| 戦闘特性カードを追加 | `js/traitCards.js`に1エントリ追加（`trigger`と`effectId`を指定）。処理は`CardEffectSystem.TRAIT_HANDLERS`に1関数追加 |
| 新職業を追加 | `js/classes.js`の`CLASSES`に1エントリ（`initialStats`/`startingBattleDeck`/`cardPoolClassType`）。各カード配列に`classType`が一致するカードを追加するだけで、既存コードのif分岐は一切増やす必要なし |
| カード効果を追加 | 上記の該当ハンドラオブジェクトに1関数追加（idと同名） |
| トリガーを追加 | `js/battleSystem.js`/`js/game.js`内の該当箇所で`CardEffectSystem.triggerTraits(traits, "新トリガー名", ...)`を呼ぶ1行を追加するだけ |
| 戦闘デッキ上限を変更 | `CONFIG.BATTLE_DECK_MAX`（現在15） |
| 特性カード上限を変更 | `CONFIG.TRAIT_MAX`（現在3） |
| すごろくカード上限を変更 | `CONFIG.BOARD_DECK_MAX`（現在8） |
| BONUS TARGETを追加 | `js/missionSystem.js`の`MISSION_TEMPLATES`に1エントリ（`category`/`label`/`target`/`track`）。`track`はGameStateの`progress`オブジェクトのキーと一致させる |
| 敵スケーリングを変更 | `CONFIG.MONSTER_HP_SCALING_PER_GAME` / `MONSTER_ATK_SCALING_PER_GAME` / `MONSTER_REWARD_SCALING_PER_GAME`、Strong補正は`STRONG_ATK_MULT_BY_GAME`等 |
| Bossパッシブを追加 | `js/passives.js`の`BOSS1_PASSIVES`または`BOSS2_PASSIVES`に`{id,name,description,apply(p){...}}`を追加 |
| サイコロ基本能力(±1)を変更 | `CONFIG.DICE_ADJUST_USES_PER_GAME` / `DICE_ADJUST_RANGE` |

## 11. ダメージ計算パイプライン

`CardEffectSystem.calculateHitDamage()`に一本化しています。

```
基礎Attack(物理 or 魔法、カード指定 or 職業の主武器)
→ 武器の追加ダメージ(物理のみ)
→ 職業固有スキル(闘気/魔力共鳴)
→ ターン限定バフ・戦闘全体バフ(すごろくカード橋渡し等)
→ Strong特効・Bossパッシブ補正
→ Critical
```

条件付きダメージ（首狩り系・背水系・居合系など）は`DAMAGE_CONDITION_HANDLERS`で「どの倍率を使うか」だけを決め、実際の計算は必ず`calculateHitDamage()`を通します。

## 12. 重要な修正（今回のシミュレーションで発見・修正したバグ）

戦闘特性のうち「ガラスの身体」「共鳴増幅」「闘争本能」は、本来「装備した時に1回だけ」永続ステータスを変更する設計ですが、実装当初はトリガー（onBattleStart / onEnemyKilled）が発火するたびに**毎回**効果を重ねがけしてしまい、最大HPが戦闘のたびに際限なく縮小する／スキル上昇量が際限なく積み上がる、という重大なバグがありました。`player`オブジェクトに「適用済みフラグ」を持たせることで、ラン中1回だけ適用されるように修正済みです（`js/cardEffectSystem.js`）。

## 13. 既知の課題（バランス調整。優先度10番目のため今回は深追いしていません）

Node上のシミュレーション（下記参照）で、GAME6〜9あたりで急にHPが0近くまで落ち込むケースが複数回観測されました。上記の重複バグ修正後も傾向は残っており、Strong敵のATK補正や敵ATKスケーリングをやや弱める調整は行いましたが、根本的な原因（特定のSTRONG/DANGER遭遇が重なった時の火力が高すぎる可能性、テスト用の単純なAIが防御カードを積極的に使わない影響など）の切り分けは完了していません。実際にプレイしながら`CONFIG.MONSTER_ATK_SCALING_PER_GAME` / `STRONG_ATK_MULT_BY_GAME` / `STRONG_RATE_BY_GAME`を調整することを推奨します。

## 14. 検証方法

Node.jsの`vm`モジュールで簡易DOMを用意し、`GameState.beginRun()`から実際に戦闘・ラウンド進行・カード報酬・GAME進行を自動プレイさせるシミュレーションで動作確認しています。確認できた項目：

- HOME → キャラクター選択 → ラン開始の画面遷移
- 職業別カードプールの完全な分離（剣士/魔法使いとも COMMON30+専用15=45枚、相互混入なし）
- 実際のカードバトル（手札・ACTION・ダメージ計算・AOE・撃破・勝敗判定）
- デッキが実際にGAMEを重ねるごとに成長すること
- GAME終了→カード報酬→次GAMEの一連の流れ

## 15. 今回実装していないもの（将来拡張）

- 分岐ルート（`Board.branches`にデータ構造だけ用意済み）
- 完全な3部位装備（武器/防具/アクセサリー個別スロット）。現状は既存の「武器1つ＋お守り複数」を流用
- 大ダメージの短縮表記は`CONFIG.formatNumber()`として実装済みだが、戦闘中のダメージ数字表示への適用は未反映（DEMO CLEAR画面などでは使用済み）

## 16. 今回の追加修正（5点）

1. **サイコロ±1機能を削除**：`CONFIG.DICE_ADJUST_USES_PER_GAME`等の設定・`GameState.offerDiceAdjust()`・`DiceUI.getAdjustChoices()`・専用のすごろくカード「微調整」を削除しました。サイコロは出目そのまま（各種カードによる出目操作は従来通り有効）。
2. **早期GAMEのダメージバランス調整**：`CONFIG.MONSTERS`のHPを引き上げ（例：スライム22→100）、代わりに`MONSTER_HP_SCALING_PER_GAME`を1.31→1.23に緩めることで、終盤の目標値（Game20で数千〜1万程度）はおおむね維持しつつ、序盤は「100%ダメージのカードを5枚前後出せば倒せる」水準に調整しました。あわせて、フルカードバトル化で戦闘が長引きやすくなった影響を相殺するため、初期防御力（剣士8→14、魔法使い3→7）とStrong敵のHP倍率（`STRONG_HP_MULT_BY_GAME`）も少し抑えています。
3. **ダメージカードに実際の数値を表示**：`CardEffectSystem.getCardDisplayDamage()`を追加し、手札の各カードに「◯◯ダメージ」という実数値を表示するようにしました（`calculateHitDamage()`に`forDisplay`フラグを追加し、表示用はクリティカル抽選・武器ロールの乱数を使わず安定した数値になるようにしています）。条件付きダメージ系カード（首狩り等）は、現在の攻撃対象に当てた場合の実際の値を計算します。
4. **手札を下半分に上から表示**：`#battle-hand-area`を画面下半分（`#bottom-row`の上）に重ねて表示するオーバーレイに変更し、カードは横スクロールの箱ではなく、1枚1行の横長カードとして上から下へリスト表示するようにしました。
5. **複数の敵がいる場合の対象選択**：敵が2体以上いる時、敵をクリックすると単体対象カードの攻撃先を選べるようにしました（`BattleSystem.selectTarget()` / `getPrimaryTarget()`、選択中の敵には▼マークと枠線を表示）。この対応の過程で、**全体攻撃（AOE）カードが実際には「同じ相手を倒すまで殴り続け、それから次の相手に移る」という不具合**（本来は敵全員に1回ずつ同時に当たるべき）を発見し、命中対象を展開時点で確定させる方式に修正しました。

## 17. 既知の課題（追加）

HPを引き上げた分、1回の戦闘が長引きやすくなり（＝敵の反撃を受ける回数が増え）、特にランダムに単純なカードだけを使うプレイでは、GAME2〜3あたりでHPがかなり減るケースが依然あります。防御力とStrong補正を調整して致命傷になりにくくしましたが、根本的には「戦闘の長さ」と「必要ダメージ量」のトレードオフのため、実際にプレイしながら`js/classes.js`の`defense`や`CONFIG.STRONG_HP_MULT_BY_GAME`等で追加調整することを推奨します。

## 18. 今回の追加修正（5点）

1. **戦闘中もHP等が見える位置に手札を配置**：`#battle-hand-area`を画面下半分の左70%（すごろく盤面側）だけに重ねる形にし、右30%の下右パネル（HP・Gold・サイコロ等）は戦闘中も常に見えるようにしました。
2. **BONUS TARGETを一旦削除**：`GameState.initGame()`からの呼び出しを削除し、GAME終了時の報酬もミッション達成判定なしの固定額に戻しました。`js/missionSystem.js`自体は削除せず残してあるので、必要になれば`initGame()`に呼び出しを1行足すだけで復活できます。
3. **ショップの在庫がちゃんと減るように修正**：武器・お守りを購入すると、その場でその商品が品揃え(`currentWeaponOffers`/`currentOmamoriOffers`)から取り除かれ、再度同じ在庫を買うことはできなくなりました。品切れ時は「売り切れ（リロールで品揃えを更新できます）」と表示します。
4. **手札を横並びのカード見た目に戻す**：縦積みの横長リストから、トレーディングカードのような縦長カードの横並び（横スクロール）表示に戻しました。
5. **カードに画像を後から入れられるように**：各カードの上部に画像/アイコン専用エリア（`.battle-card-icon`）を追加しました。画像が無い間はタグに応じた絵文字（HEALなら💚、AOEなら💥など）で仮表示され、`assets/battlecards/<カードid>.png`を置くだけで自動的に画像へ切り替わります（既存の`AssetManager`の仕組みをそのまま利用）。

## 18. 今回の追加修正（5点）

1. **戦闘中もHPが隠れないように**：`#battle-hand-area`（手札エリア）が下右パネル（HP・Gold等）の幅を侵食しないよう`right: 30%`で明示的に除外し、高さも`top: 50%`で下半分ぴったりに固定しました（内容が増えても上や横にはみ出さない）。
2. **BONUS TARGETをいったん廃止**：GAME終了時は`CONFIG.getBaseGameClearGold()`による固定額の報酬のみとし、GAME開始時のミッション選択は行わないようにしました。`js/missionSystem.js`自体は将来の再導入に備えて残していますが、現在は`game.js`から呼び出していません。
3. **ショップの在庫消費を確認・維持**：購入した武器・お守りはその場の品揃えから取り除かれ、売り切れると「売り切れ（リロールで品揃えを更新できます）」と表示されることを確認しています。
4. **手札を横並びのカード型表示に**：`#battle-hand`は横スクロールの1列、`.battle-card`はコスト表示・画像エリア・名前・ダメージ数値・説明・タグを縦に積んだ縦長カード（トレーディングカード然としたレイアウト）です。
5. **カード画像は後から追加可能**：`assets/battlecards/<id>.png` / `assets/boardcards/<id>.png` / `assets/traitcards/<id>.png`を置くだけで、`AssetManager`が自動的に画像に差し替えます（無ければタグに応じた絵文字で仮表示）。

## 19. 今回の大改修：成長要素4種類への整理

戦闘特性カードを廃止し、成長要素を「アクションカード／ステータス強化カード／盤面強化カード／Bossパッシブ」の4種類＋装備（武器/防具/お守り）に整理しました。

### 19-1. 新規ファイル
| ファイル | 内容 |
|---|---|
| `js/statCards.js` | ステータス強化カード20枚。取得時に`apply(player)`が即実行され、`player.statCardHistory`に履歴が積まれる（デッキには入らない） |
| `js/weapons.js` | 武器20種（`SWORDSMAN_WEAPONS`10種＋`MAGE_WEAPONS`10種、別プール） |
| `js/armor.js` | 防具16種（`ARMOR_LIST`、最大2個・重複不可） |
| `js/charms.js` | お守り24種（`CHARM_LIST`、最大3個） |

### 19-2. 変更ファイル（主なもの）
- `js/battleCards.js`：汎用/剣士/魔法使いを各20枚（合計60枚）に拡張
- `js/passives.js`：**旧・戦闘特性カード（狂戦士の血/死線/過剰魔力/禁術/吸血体質等）をすべてBossパッシブへ統合**し、24種（汎用8＋剣士8＋魔法使い8）に全面書き換え
- `js/cardEffectSystem.js`：Bossパッシブ用の新規ハンドラを追加（千手/一刀両断/大魔導士/黄金魔導/大富豪/血戦/無双/爆裂連鎖/無限詠唱 等）。`onAttack`トリガーにカード情報を渡せるよう拡張
- `js/battleSystem.js`：`traits`を`bossPassives`に全面置換。戦闘終了後に遅延実行される効果がnullを参照してクラッシュしないよう、主要関数に安全ガードを追加（テストで実際に発見・修正）
- `js/rewardSystem.js`：GAME CLEAR報酬をアクション2＋ステータス2に変更。TREASURE/BONUS TARGET宝箱の抽選ロジックを追加
- `js/shop.js`：6カテゴリ（アクション/ステータス/盤面/武器/防具/お守り）すべてを購入可能に全面書き換え
- `js/game.js`：装備の付け外し（`applyEquipmentStats`/`removeEquipmentStats`）、`acquireShopItem`（SHOP・GAME CLEAR共通の入手処理）を追加
- `js/config.js`：`OMAMORI`/`WEAPONS`の旧配列を削除し、`EQUIPMENT`（上限）/`TREASURE`（抽選テーブル）/`SHOP_PRICE_BY_RARITY`を追加

### 19-3. 削除したもの
- `js/traitCards.js`（戦闘特性カードのデータファイル自体を削除。中身はBossパッシブへ移植済み）
- `config.js`内の旧`OMAMORI`/`WEAPONS`配列（新しい`weapons.js`/`charms.js`に置き換え）

## 20. GAME CLEAR報酬処理

`GameState.offerCardReward()`が`RewardSystem.buildGameClearChoices()`を呼び、アクションカード2枚＋ステータス強化カード2枚の4択を表示します（盤面強化カードは出ません）。選択は`GameState.acquireShopItem()`に委譲され、アクションカードはデッキ上限（15枚）に応じて交換UIが出ます。ステータスカードは即時反映されるだけなので交換UIは出ません。

## 21. 追加方法まとめ

| やりたいこと | 変更箇所 |
|---|---|
| ステータス強化カードを追加 | `js/statCards.js`に`{id,name,rarity,tags,description,apply(p){...}}`を1エントリ追加 |
| アクションカードを追加 | `js/battleCards.js`の該当配列に追加（既存の戦闘カードルールと同じ） |
| 盤面強化カードを追加 | `js/boardCards.js`に追加（入手経路はGAME CLEAR以外＝TREASURE/BONUS/SHOP） |
| Bossパッシブを追加 | `js/passives.js`の`BOSS_GENERIC_PASSIVES`/`BOSS_SWORDSMAN_PASSIVES`/`BOSS_MAGE_PASSIVES`に追加。単純な永続強化は`apply(p)`、戦闘中の動的効果は`trigger`+`effectId`を指定し`cardEffectSystem.js`の`TRAIT_HANDLERS`に処理を1つ追加 |
| 武器を追加 | `js/weapons.js`の`SWORDSMAN_WEAPONS`または`MAGE_WEAPONS`に追加 |
| 防具を追加 | `js/armor.js`の`ARMOR_LIST`に追加 |
| お守りを追加 | `js/charms.js`の`CHARM_LIST`に追加 |
| SHOPの商品を追加 | 上記の各データファイルに追加するだけで、SHOPは自動的にそのプールから抽選するようになる（`shop.js`の変更不要） |
| TREASURE抽選確率を変更 | `CONFIG.TREASURE.CATEGORY_WEIGHTS`（board/stat/equipment/gold/special） |
| BONUS TARGET宝箱の設定 | `CONFIG.TREASURE.GOLD_AMOUNT_BY_QUALITY`、`CONFIG.BONUS_CHEST_QUALITY`、抽選自体は`RewardSystem.openChest()` |
| 装備上限を変更 | `CONFIG.EQUIPMENT.weaponMax` / `armorMax` / `charmMax`（現在1/2/3） |
| 戦闘デッキ上限を変更 | `CONFIG.BATTLE_DECK_MAX`（現在15） |
| 盤面カード上限を変更 | `CONFIG.BOARD_DECK_MAX`（現在8） |
| 各種倍率を変更 | `CONFIG.MONSTER_*_SCALING_PER_GAME`、`CONFIG.BOSS_*_MULTIPLIER`、`CONFIG.SHOP_PRICE_BY_RARITY`など、すべてconfig.js内 |

## 22. 既知の制約（今回のスコープで完了しなかったもの）

正直にお伝えします。今回の作業量が非常に大きかったため、以下は**未実装または簡略化**しています：

1. **装備の`effects`配列（多段ダメージ+15%等の特殊効果）は未接続**です。武器・防具・お守りの`physicalAttack`/`magicAttack`/`maxHp`/`defense`/`evasion`という基礎ステータス部分は装備・交換時に正しく加算/減算されることをテストで確認済みですが、各アイテムの`effects`配列に定義した特殊効果（例：双剣の「多段攻撃+15%」、賭博のお守りの「出目に応じた変動」等）はデータとして存在するだけで、まだダメージ計算に組み込まれていません。
2. **BONUS TARGETは現在GAME進行から切り離されたまま**です（前回のご要望で一時的に無効化した状態を維持しています）。宝箱を開く処理自体（`RewardSystem.openChest()`）は実装済みなので、`GameState.initGame()`でミッション選択を復活させ、達成時に`openChest()`を呼ぶ形に繋ぎ直すだけで再接続できます。
3. **TREASUREマスは今のところ従来通りの固定Gold報酬**のままです。`RewardSystem.openChest()`という宝箱抽選ロジックは実装済みなので、`GameState.playTreasureEvent()`から呼び出すよう差し替える作業が残っています。
4. **装備の比較UI（交換前後の数値を並べて+/-表示）は未実装**です。現在は既存の選択オーバーレイ（名前と説明文の一覧）を流用しています。
5. Boss1のHP/ATK倍率は、アクションカード60枚化・敵HP引き上げに合わせて再調整しました（HP倍率8.5→4）が、シミュレーションでは依然GAME7〜9あたりで急にHPが0近くまで落ち込むケースが見られます。単純に最初のカードを使い続けるだけのテストAIでの結果のため、実際のプレイでは緩和されると見込んでいますが、`CONFIG.MONSTER_ATK_SCALING_PER_GAME`や`STRONG_RATE_BY_GAME`のさらなる調整が必要になる可能性があります。

優先順位1〜8（旧特性削除・Bossパッシブ統合・GAME CLEAR変更・ステータスカード・盤面カード経路変更・装備システム整理・装備上限・SHOP全購入対応）は実装・動作確認済みです。9番目（TREASURE/BONUS TARGET宝箱）と10番目（データ駆動の仕上げ）が持ち越しになっています。

## 23. 前回未完了だった4項目の実装

### 23-1. 重大バグ修正：装備時のNaNダメージ
武器データを新しい固定値方式（`physicalAttack`加算）に変更した際、`cardEffectSystem.js`の`calculateHitDamage()`に旧・ランダムロール方式のコード（`player.weapon.minRoll`等、もう存在しないフィールドを参照）が残っており、**武器を装備すると物理ダメージが全てNaNになる**という重大なバグがありました。該当コードを削除し、実際に戦闘させてダメージが正常な数値になることを確認済みです。

### 23-2. BONUS TARGETの再接続
`GameState.initGame()`から`offerBonusTarget()`を呼ぶよう復帰させました。達成判定は`evaluateGameSummary()`で行い、達成時は`GameState.presentChest(CONFIG.BONUS_CHEST_QUALITY, "BONUS TARGET達成")`で宝箱を獲得します（未達成でも進行に影響しない点は維持）。

### 23-3. TREASURE宝箱の接続
`GameState.playTreasureEvent()`が固定Gold付与から`presentChest("bronze", "TREASURE")`呼び出しに変わりました。`RewardSystem.openChest()`が`CONFIG.TREASURE.CATEGORY_WEIGHTS`に従ってboard/stat/equipment/gold/specialを抽選し、盤面カードなら3択、ステータス/装備なら1点ものを自動取得、Gold/特殊報酬ならそのままGold付与、という流れをゲーム内で実際に動作確認済みです。

### 23-4. 装備`effects`配列の接続（34種類の効果IDすべてに処理を実装）
`js/game.js`に`applyEquipmentEffect(player, effect, sign)`を追加し、装備の着脱時（`applyEquipmentStats`/`removeEquipmentStats`）に`effects`配列を処理するようにしました。効果は大きく3パターンに分類しています。

| パターン | 例 | 実装場所 |
|---|---|---|
| 装備時に即座にplayerへ加算/減算される単純な数値強化 | `CRIT_RATE_ADD`（会心のお守り）、`CRIT_DAMAGE_ADD`（致命のお守り） | `applyEquipmentEffect()`内で直接`player.criticalRate`等を増減 |
| `player.equipXxx`という専用フィールドに蓄積し、該当システム側で消費 | `PHYSICAL_ATTACK_RATE`→`calculateHitDamage()`、`GOLD_GAIN_RATE`→`gainGold()`、`GOAL_REWARD_RATE`→`onGoalPassed()`、`SHOP_PRICE_RATE`→`shop.js#getPrice()`、`ALL_ENEMY_REWARD_RATE`→`combat.js`の報酬計算 | 各システムの該当箇所に条件分岐を追加 |
| 戦闘の特定タイミングでのみ発動する効果 | `BATTLE_START_DRAW`/`FIRST_TURN_ACTION_ADD`（戦闘開始/初手ターン）、`MAGIC_CARD_HP_COST`（魔法カード使用時）、`LIFESTEAL_ON_KILL_PERCENT`（撃破時）、`BATTLE_END_HEAL_PERCENT`/`LOW_HP_BATTLE_END_HEAL`（戦闘終了時）、`DEATH_PREVENTION_ONCE_PER_GAME`（致死ダメージ時、1GAMEに1回リセット） | `battleSystem.js`の該当フック（`startBattle`/`startPlayerTurn`/`afterCardResolved`/敵撃破処理/`finish`）、`cardEffectSystem.js`の`calculateEnemyDamage` |

`TREASURE_QUALITY_UP`（宝探し/強欲のお守り）は`GameState.presentChest()`内で宝箱の品質を1段階（bronze→silver→gold）引き上げる形で接続しています。

装備の交換・解除時は必ず`removeEquipmentStats`が対になって呼ばれ、加算した分を正確に差し引くため、防具やお守りを何度入れ替えても数値がずれない設計です（`MAX_HP_RATE`のような割合効果は、適用時の実際の増減量をitem側に記録して解除時に同じ量を戻す方式にしています）。

## 24. 依然として未実装のもの

- 装備の比較UI（交換前後の数値を+/-で並べて表示するもの）は今回も未実装です。現在は既存の選択オーバーレイ（名前と説明文の一覧）で交換先を選ぶ形のままです。
- Boss1/Boss2のバランスは、装備効果が実際に火力へ乗るようになったことで数値感がさらに変わっている可能性があります。実際にプレイしながらの追加調整を推奨します。
