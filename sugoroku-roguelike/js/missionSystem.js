// ============================================================
// missionSystem.js
// BONUS TARGET（GAME開始時に3択、達成しなくてもGAME進行に影響しない。
// 達成した場合のみ報酬が強化される）を管理します。
//
// カテゴリを分散させ、特定のビルドだけが不利にならないようにする
// （BATTLE/STRONG/RARE/GOAL/DICE/GOLD/SURVIVAL/DAMAGEなど）。
// ============================================================

const MISSION_TEMPLATES = [
  { id: "kill_4", category: "BATTLE", label: () => "敵を4体倒す", target: 4, track: "kills" },
  { id: "kill_strong_2", category: "STRONG", label: () => "Strongを2体倒す", target: 2, track: "strongKills" },
  { id: "goal_2", category: "GOAL", label: () => "GOALを2回通過する", target: 2, track: "goalPasses" },
  { id: "gold_500", category: "GOLD", label: () => "累計500G獲得する", target: 500, track: "earnedGold" },
  { id: "kill_rare_2", category: "RARE", label: () => "Rare以上を2体倒す", target: 2, track: "rareKills" },
  { id: "big_hit_1", category: "DAMAGE", label: (v) => `一撃で${v}以上のダメージを与える`, target: 400, track: "maxSingleHit" },
  { id: "move_20", category: "DICE", label: (v) => `合計${v}マス移動する`, target: 20, track: "totalMoved" },
  { id: "survive_hp50", category: "SURVIVAL", label: () => "HP50%以上でGAMEを終える", target: 1, track: "survivedHighHp" },
];

const MissionSystem = {
  // count個の候補を、カテゴリが被らないように選ぶ
  pickChoices(count) {
    const shuffled = MISSION_TEMPLATES.slice().sort(() => Math.random() - 0.5);
    const chosen = [];
    const usedCategories = new Set();
    for (const m of shuffled) {
      if (usedCategories.has(m.category)) continue;
      chosen.push(m);
      usedCategories.add(m.category);
      if (chosen.length >= count) break;
    }
    // カテゴリの種類が足りない場合は重複を許して埋める
    if (chosen.length < count) {
      shuffled.forEach((m) => { if (chosen.length < count && !chosen.includes(m)) chosen.push(m); });
    }
    return chosen.map((m) => ({ id: m.id, category: m.category, label: m.label(m.target), target: m.target, track: m.track }));
  },

  // GameStateのトラッキング値からミッション達成を判定する
  isComplete(mission, trackedValues) {
    const value = trackedValues[mission.track] || 0;
    if (mission.track === "survivedHighHp") return value >= 1;
    return value >= mission.target;
  },
};
