const fs = require('fs');
const path = require('path');

function splitKeyTokens(raw) {
  if (!raw || !String(raw).trim()) return [];
  return String(raw)
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function parseGeminiKeysFromEnv() {
  const keys = [];
  const bulk = process.env.GEMINI_API_KEYS;
  if (bulk) splitKeyTokens(bulk).forEach((k) => keys.push(k));
  const single = process.env.GEMINI_API_KEY;
  if (single) splitKeyTokens(single).forEach((k) => keys.push(k));
  for (let i = 1; i <= 20; i++) {
    const v = process.env[`GEMINI_API_KEY_${i}`];
    if (v) splitKeyTokens(v).forEach((k) => keys.push(k));
  }
  return [...new Set(keys)];
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

class GeminiKeyPool {
  constructor(options = {}) {
    this.keys = parseGeminiKeysFromEnv();
    this.statePath =
      options.statePath ||
      process.env.GEMINI_KEY_STATE_FILE ||
      path.join(process.cwd(), 'logs', 'gemini-key-pool.json');
    this.state = { resetDate: todayKey(), failed: {} };
    this.loadState();
    this.maybeDailyReset();
  }

  loadState() {
    try {
      if (!fs.existsSync(this.statePath)) return;
      const raw = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
      if (raw && typeof raw === 'object') {
        this.state = {
          resetDate: raw.resetDate || todayKey(),
          failed: raw.failed && typeof raw.failed === 'object' ? raw.failed : {},
        };
      }
    } catch {
      /* ignore */
    }
  }

  saveState() {
    try {
      fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    } catch {
      /* ignore on Vercel read-only fs */
    }
  }

  maybeDailyReset() {
    const today = todayKey();
    if (this.state.resetDate === today) return;
    this.state = { resetDate: today, failed: {} };
    this.saveState();
  }

  hasKeys() {
    return this.keys.length > 0;
  }

  getAvailableIndices() {
    this.maybeDailyReset();
    return this.keys.map((_, i) => i).filter((i) => !this.state.failed[String(i)]);
  }

  markFailed(index, reason) {
    this.state.failed[String(index)] = {
      failedAt: new Date().toISOString(),
      reason: String(reason || 'unknown').slice(0, 240),
    };
    this.saveState();
  }

  isTransientError(error) {
    const msg = (error?.message || String(error)).toLowerCase();
    return (
      msg.includes('error fetching') ||
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('enotfound') ||
      msg.includes('503') ||
      msg.includes('500')
    );
  }

  isKeyLevelError(error) {
    if (this.isTransientError(error)) return false;
    const msg = (error?.message || String(error)).toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('resource_exhausted') ||
      msg.includes('403') ||
      msg.includes('401') ||
      msg.includes('api key not valid') ||
      msg.includes('api_key_invalid') ||
      msg.includes('unauthorized') ||
      (msg.includes('exceeded') && msg.includes('quota'))
    );
  }

  async executeWithFallback(fn) {
    this.maybeDailyReset();
    const indices = this.getAvailableIndices();
    if (!indices.length) throw new Error('All Gemini keys exhausted for today');

    for (const index of indices) {
      try {
        return await fn(this.keys[index], index);
      } catch (error) {
        if (this.isKeyLevelError(error)) this.markFailed(index, error.message);
      }
    }
    throw new Error('All Gemini keys failed');
  }
}

let sharedPool = null;

function getGeminiKeyPool() {
  if (!sharedPool) sharedPool = new GeminiKeyPool();
  return sharedPool;
}

module.exports = { GeminiKeyPool, getGeminiKeyPool, parseGeminiKeysFromEnv };
