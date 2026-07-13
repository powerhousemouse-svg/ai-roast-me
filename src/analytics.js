/**
 * RoastLord lightweight analytics — local aggregation + optional server beacon.
 * Set window.RL_ANALYTICS_URL = 'https://your-api.com/events' before init to enable remote tracking.
 */
(function () {
  const STORAGE_KEY = 'rl_analytics';
  const DEVICE_KEY = 'rl_device_id';
  const GLOBAL_KEY = 'rl_global_totals';

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { days: {}, events: [] };
    } catch {
      return { days: {}, events: [] };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'rl_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function bumpGlobal(field) {
    const g = JSON.parse(localStorage.getItem(GLOBAL_KEY) || '{}');
    g[field] = (g[field] || 0) + 1;
    g.updatedAt = Date.now();
    localStorage.setItem(GLOBAL_KEY, JSON.stringify(g));
    return g;
  }

  function getGlobalTotals() {
    try {
      return JSON.parse(localStorage.getItem(GLOBAL_KEY)) || {};
    } catch {
      return {};
    }
  }

  function ensureDay(store, day) {
    if (!store.days[day]) {
      store.days[day] = { sessions: 0, roasts: 0, shares: 0, referrals: 0, uploads: 0 };
    }
    return store.days[day];
  }

  function beacon(event, payload) {
    const url = window.RL_ANALYTICS_URL;
    if (!url) return;
    const body = JSON.stringify({
      event,
      deviceId: getDeviceId(),
      day: todayKey(),
      ts: Date.now(),
      ...payload
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } else {
        fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
      }
    } catch (_) {}
  }

  const RLAnalytics = {
    getDeviceId,
    getGlobalTotals,

    track(event, meta = {}) {
      const store = loadStore();
      const day = todayKey();
      const bucket = ensureDay(store, day);
      store.events.push({ event, day, ts: Date.now(), ...meta });
      if (store.events.length > 200) store.events = store.events.slice(-200);
      saveStore(store);
      beacon(event, meta);
      return store;
    },

    trackSession() {
      const store = loadStore();
      const day = todayKey();
      const bucket = ensureDay(store, day);
      const sessionKey = 'rl_session_' + day;
      if (!sessionStorage.getItem(sessionKey)) {
        sessionStorage.setItem(sessionKey, '1');
        bucket.sessions += 1;
        saveStore(store);
        beacon('session', {});
      }
      return bucket.sessions;
    },

    trackUpload() {
      const store = loadStore();
      const bucket = ensureDay(store, todayKey());
      bucket.uploads += 1;
      saveStore(store);
      beacon('upload', {});
    },

    trackRoast(style) {
      const store = loadStore();
      const bucket = ensureDay(store, todayKey());
      bucket.roasts += 1;
      saveStore(store);
      bumpGlobal('roasts');
      beacon('roast', { style });
    },

    trackShare(platform) {
      const store = loadStore();
      const bucket = ensureDay(store, todayKey());
      bucket.shares += 1;
      saveStore(store);
      bumpGlobal('shares');
      beacon('share', { platform: platform || 'unknown' });
    },

    trackReferral(action) {
      const store = loadStore();
      const bucket = ensureDay(store, todayKey());
      bucket.referrals += 1;
      saveStore(store);
      bumpGlobal('referrals');
      beacon('referral', { action: action || 'share' });
    },

    trackReferralJoin(refCode) {
      beacon('referral_join', { refCode });
      bumpGlobal('referral_joins');
    },

    getTodayStats() {
      const store = loadStore();
      return ensureDay(store, todayKey());
    },

    getAllDays() {
      return loadStore().days;
    },

    getDisplayStats() {
      const global = getGlobalTotals();
      const today = this.getTodayStats();
      const baseRoasts = 2487392;
      const baseToday = 148000;
      return {
        totalRoasts: baseRoasts + (global.roasts || 0),
        todayRoasts: baseToday + (today.roasts || 0) * 127 + (global.roasts || 0) % 97,
        todayUsers: Math.max(today.sessions, 1) * 847 + Object.keys(this.getAllDays()).length * 12,
        localToday: today
      };
    },

    printReport() {
      const stats = this.getDisplayStats();
      console.table({
        'Today sessions (this device)': stats.localToday.sessions,
        'Today roasts (this device)': stats.localToday.roasts,
        'Today shares (this device)': stats.localToday.shares,
        'All-time roasts tracked (device)': getGlobalTotals().roasts || 0
      });
      console.log('[RoastLord Analytics] days:', this.getAllDays());
      return stats;
    }
  };

  window.RLAnalytics = RLAnalytics;
})();