// Per-user persistence for the browser-only trading simulator.
// Never accept this storage for official evaluation, billing or payout decisions.
(function(root){
  'use strict';
  const VERSION=1, MAX_AGE_MS=36*60*60*1000;
  const sizes=new Set([25000,50000,100000,150000]);
  const key=(userId,accountSize)=>'tx_demo_v1_'+userId+'_'+accountSize;
  const validNum=n=>typeof n==='number'&&Number.isFinite(n);
  function validBar(b){
    return b&&validNum(b.o)&&validNum(b.h)&&validNum(b.l)&&validNum(b.c)&&
      validNum(b.ts)&&validNum(b.v)&&b.o>0&&b.c>0&&b.h>=Math.max(b.o,b.c)&&
      b.l<=Math.min(b.o,b.c)&&b.v>=0;
  }
  function validate(state,accountSize){
    if(!state||typeof state!=='object'||state.accountSize!==accountSize)return false;
    if(typeof state.symbol!=='string'||!/^[A-Z]{1,4}$/.test(state.symbol))return false;
    if(!Array.isArray(state.bars)||state.bars.length<20||state.bars.length>2000||
       !state.bars.every(validBar))return false;
    if(!state.position||!Number.isSafeInteger(state.position.qty)||
       Math.abs(state.position.qty)>200||
       !validNum(state.position.avg)||state.position.avg<0)return false;
    if(state.position.qty!==0&&(state.position.avg<=0||state.position.symbol!==state.symbol))return false;
    if(!state.stats||!validNum(state.stats.netPnl)||!validNum(state.stats.bal)||
       !validNum(state.stats.peakBal)||!validNum(state.stats.dailyPnl))return false;
    if(!Array.isArray(state.stats.days)||state.stats.days.length>1000)return false;
    if(!Array.isArray(state.orders)||state.orders.length>200)return false;
    if(!Array.isArray(state.tradeHistory)||state.tradeHistory.length>300)return false;
    return true;
  }
  function save(userId,accountSize,state,storage){
    if(!userId||!sizes.has(accountSize)||!validate(state,accountSize))return false;
    const store=storage||(typeof localStorage!=='undefined'?localStorage:null);
    if(!store)return false;
    try{
      store.setItem(key(userId,accountSize),JSON.stringify({version:VERSION,savedAt:Date.now(),state}));
      return true;
    }catch(e){return false;}
  }
  function load(userId,accountSize,storage,now=Date.now()){
    if(!userId||!sizes.has(accountSize))return null;
    const store=storage||(typeof localStorage!=='undefined'?localStorage:null);
    if(!store)return null;
    try{
      const raw=store.getItem(key(userId,accountSize));
      if(!raw)return null;
      const snapshot=JSON.parse(raw);
      if(snapshot.version!==VERSION||!validNum(snapshot.savedAt)||
         snapshot.savedAt>now+300000||now-snapshot.savedAt>MAX_AGE_MS||
         !validate(snapshot.state,accountSize))return null;
      return snapshot.state;
    }catch(e){return null;}
  }
  root.TradephexChartState=Object.freeze({save,load,validate});
})(typeof window==='undefined'?globalThis:window);
