import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext, Script} from 'node:vm';

const code=readFileSync(new URL('../public/econ-calendar-ui.js',import.meta.url),'utf8');
assert.doesNotThrow(()=>new Script(code,{filename:'public/econ-calendar-ui.js'}));
const window={};
runInNewContext(code,{window,Date,Intl,Set,Map,String,Object,Array,Number});
const {normalizeEvents,formatET}=window.TradephexEconCalendar;
test('Eastern Time formatting adjusts for daylight saving',()=>{
 assert.match(formatET('2026-01-10T13:30:00Z'),/8:30.*EST/);
 assert.match(formatET('2026-07-10T13:30:00Z'),/9:30.*EDT/);
});
test('calendar rejects duplicates and invalid release timestamps',()=>{
 const events=normalizeEvents([
   {id:'b',time:'2026-11-30T13:30:00Z',title:'B',impact:'high'},
   {id:'a',time:'2026-11-29T14:30:00Z',title:'A',impact:'medium'},
   {id:'a',time:'2026-11-29T14:30:00Z',title:'Duplicate A',impact:'high'},
   {id:'c',time:'not-a-date',title:'Invalid',impact:'high'},
   {id:'d',time:'2026-11-29T14:30:00Z',title:'Invalid impact',impact:'urgent'}
 ]);
 assert.equal(events.length,2);
 assert.equal(events[0].title,'A');
 assert.equal(events[1].title,'B');
});
test('live events display provider attribution and authenticated fetch',()=>{
 assert.match(code,/Economic calendar by ShowMyTrades/);
 assert.match(code,/Authorization:'Bearer '\+token/);
 assert.match(code,/setInterval\(\(\)=>\{/);
 assert.match(code,/remain<=0\|\|remain>30/);
 assert.match(code,/impact!=='high'/);
 assert.doesNotMatch(code,/Math\.random/);
});
