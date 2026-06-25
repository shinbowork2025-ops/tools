/**
 * カメラの連続フレームから、同じJANが安定して読めたかを判定する。
 * 1回だけの検出結果は採用せず、一定時間内に複数回一致した場合だけ確定する。
 */
(() => {
  'use strict';

  class ScanConsensus {
    constructor(options = {}) {
      this.requiredHits = options.requiredHits ?? 4;
      this.maxGapMs = options.maxGapMs ?? 700;
      this.minDurationMs = options.minDurationMs ?? 350;
      this.windowMs = options.windowMs ?? 1800;
      this.reset();
    }

    reset() {
      this.value = '';
      this.hits = 0;
      this.firstAt = null;
      this.lastAt = null;
    }

    /**
     * 1回分の検出値を追加する。
     * @returns {{confirmed:boolean,value:string,hits:number,requiredHits:number}}
     */
    observe(value, now = Date.now()) {
      const normalized = String(value || '');
      if (!normalized) {
        if (this.lastAt !== null && now - this.lastAt > this.maxGapMs) this.reset();
        return this.snapshot(false);
      }

      const shouldRestart = normalized !== this.value
        || this.lastAt === null
        || now - this.lastAt > this.maxGapMs
        || now - this.firstAt > this.windowMs;

      if (shouldRestart) {
        this.value = normalized;
        this.hits = 1;
        this.firstAt = now;
        this.lastAt = now;
        return this.snapshot(false);
      }

      this.hits += 1;
      this.lastAt = now;
      const confirmed = this.hits >= this.requiredHits
        && now - this.firstAt >= this.minDurationMs;
      const result = this.snapshot(confirmed);
      if (confirmed) this.reset();
      return result;
    }

    snapshot(confirmed) {
      return {
        confirmed,
        value: this.value,
        hits: this.hits,
        requiredHits: this.requiredHits
      };
    }
  }

  globalThis.JanScanConsensus = ScanConsensus;
})();
