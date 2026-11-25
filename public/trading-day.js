// Futures-session calendar helper for the demo trading terminal.
// Common US equity-index futures session roll: 6:00 PM America/New_York.
// This is NOT an exchange holiday/calendar feed, and is NOT reward-eligibility logic.
(function (root) {
  'use strict';

  const HOUR_MS = 60 * 60 * 1000;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });

  function sessionKey(instant = new Date()) {
    const date = instant instanceof Date ? instant : new Date(instant);
    if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid session date');
    const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour);
    // At 18:00 ET the next futures trading date begins.
    const effectiveDay = new Date(Date.UTC(year, month - 1, day + (hour >= 18 ? 1 : 0)));
    return effectiveDay.toISOString().slice(0, 10);
  }

  function nextOpenMs(instant = new Date()) {
    const now = instant instanceof Date ? instant : new Date(instant);
    if (!Number.isFinite(now.getTime())) throw new TypeError('Invalid session date');
    const currentKey = sessionKey(now);
    let low = now.getTime();
    let high = low + 27 * HOUR_MS; // accommodates 23h/25h DST days
    while (high - low > 1000) {
      const middle = low + Math.floor((high - low) / 2);
      if (sessionKey(new Date(middle)) === currentKey) low = middle;
      else high = middle;
    }
    return high;
  }

  root.TradephexTradingDay = Object.freeze({ sessionKey, nextOpenMs });
})(typeof window === 'undefined' ? globalThis : window);
