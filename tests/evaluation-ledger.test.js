import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateClosedTradeLedger, tradingSessionKey } from '../api/_evaluation-ledger.js';

const rules = Object.freeze({
  profitTargetCents: 300000, // $3,000 for a $50k account
  maxDrawdownCents: 250000, // $2,500
  dailyLossCents: 100000, // $1,000
  minTradingDays: 5,
  consistencyPct: 40,
});
const start = 5_000_000;
function trade(id, closedAt, netPnlCents) { return { id, closedAt, netPnlCents }; }
function review(trades, overrides={}) {
  return evaluateClosedTradeLedger({
    startingBalanceCents:start,
    rules:{...rules,...overrides},
    trades
  });
}

test('five independent profitable sessions can meet a configurable target', () => {
  const result=review([
    trade('1','2026-11-16T19:00:00Z',70000),
    trade('2','2026-11-17T19:00:00Z',70000),
    trade('3','2026-11-18T19:00:00Z',70000),
    trade('4','2026-11-19T19:00:00Z',70000),
    trade('5','2026-11-20T19:00:00Z',70000),
  ]);
  assert.equal(result.status,'target_met');
  assert.equal(result.balanceCents,5350000);
  assert.equal(result.tradingDays,5);
  assert.equal(result.highestProfitableDayCents,70000);
  assert.equal(result.consistencySharePct,20);
});

test('an account failing max drawdown cannot pass based on later gains', () => {
  const result=review([
    trade('1','2026-11-16T19:00:00Z',300000),
    trade('2','2026-11-17T19:00:00Z',-260000),
    trade('3','2026-11-18T19:00:00Z',500000),
  ]);
  assert.equal(result.status,'failed');
  assert.equal(result.failure,'max_drawdown');
  assert.equal(result.maxDrawdownObservedCents,260000);
});

test('intraday realized daily losses breach even if later profits recover', () => {
  const result=review([
    trade('1','2026-11-16T19:00:00Z',-110000),
    trade('2','2026-11-16T19:10:00Z',200000),
  ]);
  assert.equal(result.status,'failed');
  assert.equal(result.failure,'daily_loss');
  assert.equal(result.largestDailyLossObservedCents,110000);
});

test('Eastern session change at 6 PM separates daily loss buckets', () => {
  const result=review([
    trade('1','2026-11-16T22:59:00Z',-60000),
    trade('2','2026-11-16T23:01:00Z',-60000),
  ]);
  assert.equal(result.status,'in_progress');
  assert.equal(result.failure,null);
  assert.equal(result.largestDailyLossObservedCents,60000);
  assert.deepEqual(result.dailyPnl,[
    {date:'2026-11-16',pnlCents:-60000},
    {date:'2026-11-17',pnlCents:-60000}
  ]);
});

test('40% best-day consistency limit prevents pass despite profit target', () => {
  const result=review([
    trade('1','2026-11-16T19:00:00Z',290000),
    trade('2','2026-11-17T19:00:00Z',10000),
    trade('3','2026-11-18T19:00:00Z',10000),
    trade('4','2026-11-19T19:00:00Z',10000),
    trade('5','2026-11-20T19:00:00Z',10000),
  ],{maxDrawdownCents:500000});
  assert.equal(result.status,'in_progress');
  assert.ok(result.consistencySharePct>40);
});

test('session date follows New York daylight saving boundary', () => {
  assert.equal(tradingSessionKey('2027-03-14T21:59:59Z'),'2027-03-14');
  assert.equal(tradingSessionKey('2027-03-14T22:00:00Z'),'2027-03-15');
  assert.equal(tradingSessionKey('2027-11-07T22:59:59Z'),'2027-11-07');
  assert.equal(tradingSessionKey('2027-11-07T23:00:00Z'),'2027-11-08');
});

test('refuses duplicates, unqualified timestamps, unsorted and fractional money', () => {
  assert.throws(()=>review([trade('A','2026-11-16T19:00:00Z',100),trade('A','2026-11-17T19:00:00Z',100)]),/Duplicate/);
  assert.throws(()=>review([trade('A','2026-11-16T19:00:00',100)]),/timezone-qualified/);
  assert.throws(()=>review([trade('B','2026-11-18T19:00:00Z',100),trade('A','2026-11-17T19:00:00Z',100)]),/sorted/);
  assert.throws(()=>review([trade('A','2026-11-16T19:00:00Z',12.25)]),/safe integer/);
  assert.throws(()=>review([],{profitTargetCents:0}),/positive/);
});

test('empty ledger is in progress, not funded', () => {
  const result=review([]);
  assert.equal(result.status,'in_progress');
  assert.equal(result.netPnlCents,0);
  assert.equal(result.tradingDays,0);
  assert.equal(result.consistencySharePct,null);
});
