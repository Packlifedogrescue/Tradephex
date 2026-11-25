import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/journal.html', import.meta.url),'utf8');

test('every static showTab target has a corresponding view',()=>{
 const targets=new Set([...html.matchAll(/showTab\('([\w-]+)'\)/g)].map(m=>m[1]));
 const views=new Set([...html.matchAll(/id="view-([\w-]+)"/g)].map(m=>m[1]));
 for(const target of targets) assert.ok(views.has(target),'Missing view: '+target);
});

test('membership pricing lives inside its own tab view',()=>{
 const open=html.indexOf('id="view-upgrade"');
 const plans=html.indexOf('Platform Membership');
 const following=html.indexOf('id="view-community"');
 assert.ok(open>0&&plans>open&&following>plans);
 const section=html.slice(open,following);
 assert.match(section,/Evaluation Challenges/);
 assert.match(section,/\$49/);
});

test('empty P&L chart never divides by zero',()=>{
 assert.match(html,/i \/ Math\.max\(1, points\.length-1\)/);
});

test('trade Detail and Replay actions support Supabase UUIDs',()=>{
 assert.doesNotMatch(html,/showTradeDetail\(\$\{(?:t|best|worst)\.id\}\)/);
 assert.doesNotMatch(html,/openReplay\(\$\{t\.id\}\)/);
 assert.match(html,/String\(x\.id\) === decodeURIComponent\(String\(tradeId\)\)/);
 assert.match(html,/String\(t\.id\) === decodeURIComponent\(String\(tradeId\)\)/);
});

test('leaderboard reports request errors instead of hiding them as no data',()=>{
 assert.match(html,/const \{ data, error \} = await db\.from\('leaderboard'\)/);
 assert.match(html,/Leaderboard temporarily unavailable/);
});

test('manual trade does not report success without a confirmed database save',()=>{
  assert.match(html,/async function saveTrade\(\)/);
  assert.match(html,/newTrade\.id = await saveTradeToDb\(newTrade\)/);
  assert.match(html,/\.select\('id'\)\.single\(\)/);
  assert.match(html,/if \(error\) throw new Error\('Database save failed:/);
  assert.match(html,/Trade was NOT saved/);
  assert.doesNotMatch(html,/Math\.max\(0, \.\.\.TRADES\.map\(t => t\.id\)\)/);
});

test('manual trades validate positive prices, quantity and timestamp',()=>{
  assert.match(html,/entry <= 0/);
  assert.match(html,/exit <= 0/);
  assert.match(html,/contracts < 1/);
  assert.match(html,/Number\.isFinite\(entryTime\.getTime\(\)\)/);
});
