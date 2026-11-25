import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/econ-calendar.js';

const sample = {
  generated_at:'2026-11-25T15:30:00Z',
  events:[
    {id:'new',ts:1795708800,time:'2026-11-26T16:00:00Z',currency:'USD',
      title:'Test jobs release',impact:'high',previous:'155K',forecast:'170K',actual:'',status:'scheduled'},
    {id:'old',ts:1795622400,time:'2026-11-25T16:00:00Z',currency:'USD',
      title:'Test inflation release',impact:'medium',previous:'2.1%',forecast:'2.0%',actual:'2.0%',status:'tentative'},
    {id:'other',ts:1795708800,time:'2026-11-26T16:00:00Z',currency:'EUR',
      title:'ECB decision',impact:'high',status:'scheduled'}
  ]
};
const originalFetch=globalThis.fetch;
const originalUrl=process.env.SUPABASE_URL, originalKey=process.env.SUPABASE_ANON_KEY;
const makeReq=(query={days:'7',currency:'USD'},method='GET',headers={authorization:'Bearer sample-token'})=>({query,method,headers});
function makeRes(){
 return {
  statusCode:200, headers:{}, body:undefined,
  setHeader(name,value){this.headers[name]=value;},
  status(code){this.statusCode=code;return this;},
  json(body){this.body=body;return this;},
  end(){return this;}
 };
}
async function withMocks(fn,providerResponse=sample){
 process.env.SUPABASE_URL='https://unit-test.supabase.co';
 process.env.SUPABASE_ANON_KEY='public-test-only';
 const calls=[];
 globalThis.fetch=async (url,opts)=>{
  calls.push(String(url));
  if(String(url).includes('/auth/v1/user'))return {ok:true,json:async()=>({id:'99999999-9999-4999-8999-999999999999'})};
  if(String(url).includes('showmytrades.com')) {
    if(providerResponse===null)return {ok:false,status:503};
    return {ok:true,json:async()=>providerResponse};
  }
  throw Error('Unexpected network call '+url);
 };
 try {await fn(calls);}finally{
  globalThis.fetch=originalFetch;
  if(originalUrl===undefined)delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL=originalUrl;
  if(originalKey===undefined)delete process.env.SUPABASE_ANON_KEY;
  else process.env.SUPABASE_ANON_KEY=originalKey;
 }
}
test('calendar blocks anonymous clients and invalid methods',async()=>{
 await withMocks(async calls=>{
  const unauthorized=makeRes();
  await handler(makeReq({},'GET',{}),unauthorized);
  assert.equal(unauthorized.statusCode,401);
  assert.equal(calls.filter(x=>x.includes('showmytrades.com')).length,0);
  const wrongMethod=makeRes();
  await handler(makeReq({},'POST'),wrongMethod);
  assert.equal(wrongMethod.statusCode,405);
 });
});
test('only allowed day range and currency filters can reach provider',async()=>{
 await withMocks(async calls=>{
  const bad=makeRes();
  await handler(makeReq({days:'365',currency:'USD'}),bad);
  assert.equal(bad.statusCode,400);
  const badCurrency=makeRes();
  await handler(makeReq({days:'7',currency:'javascript:'}),badCurrency);
  assert.equal(badCurrency.statusCode,400);
  assert.equal(calls.filter(x=>x.includes('showmytrades.com')).length,0);
 });
});
test('authenticated provider events are normalized, sorted and never invented',async()=>{
 await withMocks(async calls=>{
  const res=makeRes();
  await handler(makeReq({days:'14',currency:'USD'}),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.source,'ShowMyTrades');
  assert.equal(res.body.timezone,'America/New_York');
  assert.equal(res.body.days,14);
  assert.equal(res.headers['Cache-Control'],'private, no-store');
  assert.equal(res.body.events.every(x=>x.currency==='USD'),true);
  assert.equal(res.body.events.length,2);
  assert.equal(res.body.events[0].title,'Test inflation release');
  assert.equal(res.body.events[0].status,'tentative');
  assert.equal(res.body.events[0].actual,'2.0%');
  assert.equal(res.body.events[1].forecast,'170K');
  assert.equal(res.body.events[1].actual,null);
  assert.equal(calls.filter(x=>x.includes('showmytrades.com')).length,1);
 });
});
test('unsupported provider payload returns a visible error instead of fake events',async()=>{
 await withMocks(async ()=>{
  const res=makeRes();
  await handler(makeReq({days:'30',currency:'ALL'}),res);
  assert.equal(res.statusCode,502);
  assert.match(res.body.error,/unavailable/i);
 },{status:'error',message:'unsupported'});
});
test('provider outage returns a non-success response',async()=>{
 await withMocks(async ()=>{
  const res=makeRes();
  await handler(makeReq({days:'30',currency:'USD'}),res);
  assert.equal(res.statusCode,502);
  assert.match(res.body.error,/unavailable/i);
 },null);
});
