// Shared browser-demo order checks. This is NOT a trusted evaluation engine.
(function (root) {
  'use strict';
  function wholePositive(n) { return Number.isSafeInteger(n) && n > 0; }
  function maxAllowedContracts({accountSize, dailyLimitPct, tickValue, assumedStopTicks = 20}) {
    if (![accountSize,dailyLimitPct,tickValue,assumedStopTicks].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) return 0;
    return Math.max(0, Math.floor((accountSize * dailyLimitPct) / (tickValue * assumedStopTicks)));
  }
  function validateFill({ side, qty, price, tickSize, currentQty, maxContracts, failed = false, dailyLocked = false, lockEndMs = null, nowMs = Date.now() }) {
    if (side !== 'buy' && side !== 'sell') return {ok:false, reason:'Invalid order side'};
    if (!wholePositive(qty) || qty > 10000) return {ok:false, reason:'Contract quantity must be a whole number from 1 to 10000'};
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(tickSize) || tickSize <= 0) return {ok:false, reason:'Price must be positive and valid'};
    if (!Number.isSafeInteger(currentQty)) return {ok:false, reason:'Position state is invalid'};
    const ticks = price / tickSize;
    if (Math.abs(ticks - Math.round(ticks)) > 1e-6) return {ok:false, reason:'Order price must match the instrument tick size'};
    const nextQty = currentQty + (side === 'buy' ? qty : -qty);
    if (!Number.isSafeInteger(nextQty)) return {ok:false, reason:'Position size overflow'};
    const reversing = currentQty !== 0 && nextQty !== 0 && Math.sign(nextQty) !== Math.sign(currentQty);
    const increasing = reversing || Math.abs(nextQty) > Math.abs(currentQty);
    if (increasing && failed) return {ok:false, reason:'This demo evaluation has failed. New positions are blocked'};
    if (increasing && (dailyLocked || (lockEndMs != null && lockEndMs > nowMs))) return {ok:false, reason:'Trading is locked. You may only reduce or close an open position'};
    if (increasing && (!Number.isSafeInteger(maxContracts) || maxContracts < 1 || Math.abs(nextQty) > maxContracts)) {
      return {ok:false, reason:'Order exceeds the demo account position limit'};
    }
    return {ok:true, nextQty, increasing, reducing:Math.abs(nextQty) < Math.abs(currentQty) && !reversing};
  }
  root.TradephexChartRisk = Object.freeze({maxAllowedContracts, validateFill});
})(typeof window === 'undefined' ? globalThis : window);
