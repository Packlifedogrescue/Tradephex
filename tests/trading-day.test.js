import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Load the same classic browser script the terminal loads.
const source = readFileSync(new URL('../public/trading-day.js', import.meta.url), 'utf8');
const window = {};
runInNewContext(source, { window, Intl, Date, Object, TypeError });
const { sessionKey, nextOpenMs } = window.TradephexTradingDay;

test('trading day rolls at 18:00 Eastern regardless of the viewer time zone', () => {
  assert.equal(sessionKey('2026-11-25T22:59:59.000Z'), '2026-11-25');
  assert.equal(sessionKey('2026-11-25T23:00:00.000Z'), '2026-11-26');
});

test('spring daylight-saving change does not shift the 6 PM boundary', () => {
  assert.equal(sessionKey('2027-03-14T21:59:59.000Z'), '2027-03-14');
  assert.equal(sessionKey('2027-03-14T22:00:00.000Z'), '2027-03-15');
  assert.ok(Math.abs(nextOpenMs('2027-03-13T23:05:00.000Z') -
    Date.parse('2027-03-14T22:00:00.000Z')) < 1000);
});

test('fall daylight-saving change does not shift the 6 PM boundary', () => {
  assert.equal(sessionKey('2027-11-07T22:59:59.000Z'), '2027-11-07');
  assert.equal(sessionKey('2027-11-07T23:00:00.000Z'), '2027-11-08');
  assert.ok(Math.abs(nextOpenMs('2027-11-06T22:55:00.000Z') -
    Date.parse('2027-11-07T23:00:00.000Z')) < 1000);
});

test('next session starts at the next 6 PM Eastern boundary', () => {
  assert.ok(Math.abs(nextOpenMs('2026-11-24T22:45:00.000Z') -
    Date.parse('2026-11-24T23:00:00.000Z')) < 1000);
  assert.ok(Math.abs(nextOpenMs('2026-11-24T23:01:00.000Z') -
    Date.parse('2026-11-25T23:00:00.000Z')) < 1000);
});

test('invalid dates are rejected', () => {
  assert.throws(() => sessionKey('invalid-date'), TypeError);
  assert.throws(() => nextOpenMs('invalid-date'), TypeError);
});

// These checks are safety guardrails, not a substitute for database RLS tests.
test('browser evaluation journal cannot write pass/fail or create entitlements', () => {
  const journal = readFileSync(new URL('../public/journal.html', import.meta.url), 'utf8');
  assert.doesNotMatch(journal, /\.from\(['"]evaluations['"]\)\.(insert|update|delete)\s*\(/);
  assert.doesNotMatch(journal, /handleEvalPurchaseSuccess\s*\(/);
});

test('trading terminal uses the session helper rather than browser local date', () => {
  const chart = readFileSync(new URL('../public/eval-chart.html', import.meta.url), 'utf8');
  assert.match(chart, /<script src="\/trading-day\.js"><\/script>/);
  assert.match(chart, /TradephexTradingDay\.sessionKey\(/);
  assert.match(chart, /TradephexTradingDay\.nextOpenMs\(/);
  assert.doesNotMatch(chart, /new Date\(\)\.toDateString\(\)/);
});
