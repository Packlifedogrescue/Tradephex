import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {runInNewContext, Script} from 'node:vm';

const code=readFileSync(new URL('../public/chart-risk.js',import.meta.url),'utf8');
const window={};runInNewContext(code,{window,Object,Number,Math,Date});
const {maxAllowedContracts,validateFill}=window.TradephexChartRisk;
const chart=readFileSync(new URL('../public/eval-chart.html',import.meta.url),'utf8');
const fill=(opts={})=>validateFill({side:'buy',qty:1,price:7000,tickSize:.25,currentQty:0,maxContracts:4,...opts});

test('all inline chart scripts parse',()=>{
 let n=0;
 for(const [,attrs,src] of chart.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(/\bsrc\s*=/.test(attrs)||!src.trim())continue;
  assert.doesNotThrow(()=>new Script(src,{filename:'chart-script-'+n}));n++;
 }
 assert.ok(n>=2);
});
test('locked/failed accounts cannot enter, but may reduce positions',()=>{
 assert.equal(fill({dailyLocked:true}).ok,false);
 assert.equal(fill({failed:true}).ok,false);
 assert.equal(fill({lockEndMs:100,nowMs:1}).ok,false);
 const reduction=fill({side:'sell',qty:1,currentQty:3,dailyLocked:true,failed:true});
 assert.equal(reduction.ok,true);
 assert.equal(reduction.nextQty,2);
 assert.equal(fill({side:'sell',qty:3,currentQty:2,dailyLocked:true}).ok,false);
});
test('direct scale-ins, reversals and oversize trades cannot bypass risk',()=>{
 assert.equal(fill({qty:2,currentQty:3,maxContracts:4}).ok,false);
 assert.equal(fill({qty:2,currentQty:1,maxContracts:4}).ok,true);
 for(const opts of [{qty:1.5},{qty:0},{price:-1},{price:7000.1},{side:'reverse'}]){
   assert.equal(fill(opts).ok,false,JSON.stringify(opts));
 }
 assert.equal(maxAllowedContracts({accountSize:5000,dailyLimitPct:.02,tickValue:50}),0);
});
test('all entry paths use the same guard',()=>{
 assert.match(chart,/function execFill\(side,price,qty,type='MKT'\)\{[\s\S]*?TradephexChartRisk\.validateFill/);
 assert.match(chart,/function placeOrder\(type,side\)[\s\S]*?limitCheck=TradephexChartRisk\.validateFill/);
 assert.match(chart,/function scaleIn\(qty\)[\s\S]*?execFill/);
 assert.match(chart,/function executeTradeIdea\([\s\S]*?execFill/);
});
test('symbol and replay switches are blocked while positions remain',()=>{
 assert.match(chart,/if\(domPos\.qty!==0\|\|limitOrders\.some/);
 assert.match(chart,/Orders disabled during replay/);
});
test('stops use current tick; risk closures use normal journaling',()=>{
 assert.match(chart,/const slHit=isLong\?last\.c<=bracket\.sl:last\.c>=bracket\.sl/);
 assert.match(chart,/const tpHit=isLong\?last\.c>=bracket\.tp:last\.c<=bracket\.tp/);
 assert.match(chart,/function closePositionForDemoRiskBreach/);
 assert.match(chart,/recordClose\(exitPrice,qty,gross/);
 assert.match(chart,/if\(liveBalance>evalStats\.peakBal\)evalStats\.peakBal=liveBalance/);
});
test('simulator cannot masquerade as official evaluation',()=>{
 assert.match(chart,/SIM · DEMO ONLY/);
 assert.match(chart,/Official evaluation status is unchanged/);
});
