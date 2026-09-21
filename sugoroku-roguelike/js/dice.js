// ============================================================
// dice.js
// サイコロの見た目（本物のサイコロのような目のドット表現）と、
// 「振るモーション」演出を担当します。
//
// 将来ダイスの個数(CONFIG.DICE_COUNT)が増えても対応できるように、
// 常に「値の配列」を受け取る設計にしています。
// 個数が増えるほど1個あたりのサイズを自動的に小さくしますが、
// 1個の場合は大きく・情報量が減りすぎないように表示します。
// ============================================================

const DiceUI = {
  faceElements: [],

  // 起動時にCONFIG.DICE_COUNT個ぶんのサイコロを生成する
  init() {
    this.render(CONFIG.DICE_COUNT);
  },

  render(count) {
    const container = document.getElementById("dice-faces");
    container.innerHTML = "";
    this.faceElements = [];

    const size = this.calcSize(count);
    for (let i = 0; i < count; i++) {
      const die = document.createElement("div");
      die.className = "die";
      die.style.width = `${size}px`;
      die.style.height = `${size}px`;
      die.innerHTML = this.pipsHTML(1);
      container.appendChild(die);
      this.faceElements.push(die);
    }
  },

  // ダイスの個数に応じてサイズを自動調整する。
  // 1個なら大きめ(74px)、増えるほど小さくなるが、最小34pxは下回らない。
  calcSize(count) {
    const base = 60; // 下右パネルの高さに収まるよう、1個の時の基準サイズを少し抑えている
    const size = Math.floor(base / Math.sqrt(count));
    return Math.max(30, Math.min(base, size));
  },

  // 1〜6の目を3×3グリッドのドットで表現する（本物のサイコロの目のパターン）
  pipsHTML(value) {
    const patterns = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };
    const active = patterns[value] || patterns[1];
    let html = "";
    for (let i = 0; i < 9; i++) {
      html += `<span class="pip ${active.includes(i) ? "on" : ""}"></span>`;
    }
    return html;
  },

  // finalValues（各ダイスの最終的な出目の配列）を受け取り、
  // ランダムに目が切り替わるモーションのあと、最終的な出目で止める。
  roll(finalValues, onDone) {
    // ダイスの個数が変わっていたら作り直す
    if (this.faceElements.length !== finalValues.length) {
      this.render(finalValues.length);
    }

    this.faceElements.forEach((die) => die.classList.add("rolling"));

    const flickerDuration = CONFIG.DICE_FLICKER_DURATION_MS; // 振るモーションの合計時間(ms)
    const flickerInterval = CONFIG.DICE_FLICKER_INTERVAL_MS; // 目が切り替わる間隔(ms)
    let elapsed = 0;

    const flicker = setInterval(() => {
      elapsed += flickerInterval;
      this.faceElements.forEach((die) => {
        const randomValue = Math.floor(Math.random() * 6) + 1;
        die.innerHTML = this.pipsHTML(randomValue);
      });

      if (elapsed >= flickerDuration) {
        clearInterval(flicker);
        this.faceElements.forEach((die, i) => {
          die.innerHTML = this.pipsHTML(finalValues[i]);
          die.classList.remove("rolling");
          die.classList.add("settled");
          setTimeout(() => die.classList.remove("settled"), 200);
        });
        onDone && onDone();
      }
    }, flickerInterval);
  },

  total(values) {
    return values.reduce((a, b) => a + b, 0);
  },
};
