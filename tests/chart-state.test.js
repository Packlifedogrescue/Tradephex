import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../public/chart-state.js',import.meta.url),'utf8');
const window={};runInNewContext(code,{window,Date,JSON,Math,Number,Set,String,Object});
const {save,load}=window.TradephexChartState;
const saved=new Map(),store={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
const user='test-user',acct=50000;
const state=()=>({
  accountSize:acct,symbol:'ES',
  bars:Array.from({length:30},(_,i)=>({o:7000,h:7000.25,l:6999.75,c:7000,v:100,ts:Date.now()-(29-i)*60000})),
  position:{qty:1,avg:7000,symbol:'ES'},
  orders:[],tradeHistory:[],stats:{netPnl:0,bal:acct,peakBal:acct,dailyPnl:0,days:[]}
});
test('demo state restored for same user/account, not others',()=>{
 assert.equal(save(user,acct,state(),store),true);
 assert.equal(load(user,acct,store).position.qty,1);
 assert.equal(load('different',acct,store),null);
 assert.equal(load(user,25000,store),null);
});
test('old and invalid state are ignored',()=>{
 assert.equal(load(user,acct,store,Date.now()+37*3600000),null);
 const bad=state();bad.position.qty=9999;
 assert.equal(save(user,acct,bad,store),false);
});
test('chart uses restored synthetic bars and real one-minute Eastern clock',()=>{
 const html=readFileSync(new URL('../public/eval-chart.html',import.meta.url),'utf8');
 assert.match(html,/const restored=restoreDemoTradingState\(\)/);
 assert.match(html,/if\(nowMinute>prevMinute\)/);
 assert.doesNotMatch(html,/if\(simTick>=75\)/);
 assert.match(html,/timeZone:'America\/New_York'/);
});
