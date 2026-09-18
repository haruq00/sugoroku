// ============================================================
// sound.js
// 効果音の再生を一箇所にまとめるファイル。
// assets/sfx/ に音声ファイルを置けばそれを再生し、
// 無い場合はWeb Audio APIでその場で仮の効果音を合成して鳴らします。
//
// 後から本物の効果音に差し替えたい場合は、SOUND_PATHSに書かれた
// パスに音声ファイル(mp3等)を置くだけでOKです。
// ============================================================

const SOUND_PATHS = {
  hit: "assets/sfx/hit.mp3",       // ダメージを与えた時
  defeat: "assets/sfx/defeat.mp3", // 敵を倒した時
  gold: "assets/sfx/gold.mp3",     // ゴールドを獲得した時
};

const SoundManager = {
  status: {},   // key -> true(ファイルあり) / false(無し＝合成音を使う)
  ctx: null,    // Web Audio APIのコンテキスト（初回再生時に生成）
  muted: false,

  // 起動時に音声ファイルの存在チェックを行う（無くてもエラーにしない）
  preload(callback) {
    const keys = Object.keys(SOUND_PATHS);
    let remaining = keys.length;
    if (remaining === 0) {
      callback && callback();
      return;
    }
    keys.forEach((key) => {
      const audio = new Audio();
      const done = () => {
        remaining -= 1;
        if (remaining <= 0) callback && callback();
      };
      audio.oncanplaythrough = () => {
        this.status[key] = true;
        done();
      };
      audio.onerror = () => {
        this.status[key] = false;
        done();
      };
      audio.src = SOUND_PATHS[key];
    });
  },

  // AudioContextはユーザー操作後でないと再生できないブラウザが多いため、
  // 再生タイミングで遅延生成する
  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  },

  play(key) {
    if (this.muted) return;
    if (this.status[key]) {
      const audio = new Audio(SOUND_PATHS[key]);
      audio.play().catch(() => {
        // 再生に失敗した場合は合成音にフォールバック
        this.playSynth(key);
      });
    } else {
      this.playSynth(key);
    }
  },

  // 音声ファイルが無い場合の仮効果音（Web Audio APIでその場合成）
  playSynth(key) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    let freq = 440;
    let dur = 0.12;
    let type = "square";

    if (key === "hit") {
      // 攻撃ヒット音：短く高めのクリック音
      freq = 520;
      dur = 0.08;
      type = "square";
    } else if (key === "defeat") {
      // 撃破音：低音に落ちていく音
      freq = 300;
      dur = 0.35;
      type = "sawtooth";
    } else if (key === "gold") {
      // ゴールド獲得音：明るい2音のチャイム
      freq = 880;
      dur = 0.18;
      type = "sine";
    }

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (key === "defeat") {
      osc.frequency.exponentialRampToValueAtTime(70, now + dur);
    } else if (key === "gold") {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.08);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.start(now);
    osc.stop(now + dur + 0.02);
  },

  playHit() { this.play("hit"); },
  playDefeat() { this.play("defeat"); },
  playGold() { this.play("gold"); },
};
