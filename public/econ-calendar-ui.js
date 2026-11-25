// Real economic calendar UI. Never synthesize market releases or forecasts.
(function (root) {
  'use strict';
  const TZ = 'America/New_York';
  const dateFormat = new Intl.DateTimeFormat('en-US', {timeZone:TZ,weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const timeFormat = new Intl.DateTimeFormat('en-US', {timeZone:TZ,hour:'numeric',minute:'2-digit',hour12:true,timeZoneName:'short'});
  const shortFormat = new Intl.DateTimeFormat('en-US', {timeZone:TZ,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const state = {currency:'USD',days:7,impact:'all',events:[],loadedAt:0,paramsKey:'',loading:false,seq:0,
    options:null,updatedAt:null,notice:null};
  const alertIds = new Set();
  const allowedImpact = new Set(['high','medium','low','holiday']);
  let pollingStarted = false;
  function formatET(value, kind='time') {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return 'Time unavailable';
    return (kind==='date'?dateFormat:kind==='short'?shortFormat:timeFormat).format(d);
  }
  function normalizeEvents(input) {
    if (!Array.isArray(input)) return [];
    const seen = new Set();
    return input.filter(e => {
      if (!e || typeof e !== 'object' || typeof e.title !== 'string' ||
          !e.title.trim() || !allowedImpact.has(e.impact) ||
          !Number.isFinite(Date.parse(e.time))) return false;
      const id=String(e.id||e.title+e.time);
      if(seen.has(id)) return false;
      seen.add(id);
      return true;
    }).sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  }
  function elt(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className=className;
    if (content !== undefined) element.textContent=String(content);
    return element;
  }
  function field(value) { return value==null || value==='' ? '—' : String(value); }
  function status(rootElement, message, error=false) {
    const block=elt('div','',message);
    block.style.cssText='padding:24px;border:1px solid var(--border);background:var(--surface);font-size:13px;color:'+
      (error?'var(--red)':'var(--gray)')+';';
    rootElement.appendChild(block);
  }
  function selector(label, values, current, callback) {
    const wrapper=elt('label');
    wrapper.style.cssText='display:flex;align-items:center;gap:6px;color:var(--gray);font-size:11px;';
    wrapper.appendChild(elt('span','',label));
    const select=elt('select');
    select.setAttribute('aria-label',label);
    select.style.cssText='background:var(--surface);color:var(--white);border:1px solid var(--border2);padding:8px;';
    for(const [value,text] of values){
      const opt=elt('option','',text);opt.value=value;select.appendChild(opt);
    }
    select.value=String(current);
    select.addEventListener('change',()=>callback(select.value));
    wrapper.appendChild(select);
    return wrapper;
  }
  function render(rootElement, issue='') {
    if(!rootElement)return;
    rootElement.textContent='';
    const top=elt('div');
    top.style.cssText='display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:18px;';
    const title=elt('div');
    const heading=elt('div','', 'ECONOMIC CALENDAR');
    heading.style.cssText='color:var(--gold);letter-spacing:.18em;font-size:13px;margin-bottom:8px;';
    title.appendChild(heading);
    title.appendChild(elt('div','', 'Upcoming economic releases. Times: New York (EST/EDT).'));
    top.appendChild(title);
    const refresh=elt('button','',state.loading?'UPDATING…':'↻ REFRESH EVENTS');
    refresh.disabled=state.loading;
    refresh.style.cssText='padding:10px 14px;border:1px solid var(--border2);color:var(--gold);background:var(--surface);cursor:pointer;';
    refresh.addEventListener('click',()=>load({...state.options,force:true}));
    top.appendChild(refresh);
    rootElement.appendChild(top);

    const filters=elt('div');
    filters.style.cssText='display:flex;flex-wrap:wrap;gap:18px;align-items:center;margin-bottom:18px;';
    filters.appendChild(selector('Currency',[['USD','USD releases'],['ALL','All major currencies']],state.currency, v=>{
      state.currency=v;state.loadedAt=0;load({...state.options,force:true});
    }));
    filters.appendChild(selector('Window',[['7','Next 7 days'],['14','Next 14 days'],['30','Next 30 days']],state.days,v=>{
      state.days=Number(v);state.loadedAt=0;load({...state.options,force:true});
    }));
    filters.appendChild(selector('Importance',[['all','All levels'],['high','High impact'],['medium','Medium impact'],['low','Low impact'],['holiday','Holidays']],state.impact,v=>{
      state.impact=v;render(rootElement,issue);
    }));
    rootElement.appendChild(filters);
    const meta=elt('p','',state.updatedAt?
      'Source updated '+formatET(state.updatedAt,'short')+' ET. Data: ShowMyTrades.':'Data: ShowMyTrades.');
    meta.style.cssText='color:var(--gray2);font-size:11px;margin-bottom:12px;';
    rootElement.appendChild(meta);
    if(issue)status(rootElement,issue,true);
    if(state.loading && !state.events.length){status(rootElement,'Loading verified economic releases…');return;}
    const filtered=state.impact==='all'?state.events:state.events.filter(e=>e.impact===state.impact);
    if(!filtered.length){
      status(rootElement,state.loading?'Checking for releases…':'No releases were returned for these filters. Try a longer range or another currency.');
    }else{
      const grouped=new Map();
      for(const event of filtered) {
        const day=formatET(event.time,'date');
        if(!grouped.has(day))grouped.set(day,[]);
        grouped.get(day).push(event);
      }
      for(const [day,rows] of grouped){
        const section=elt('section','econ-day');
        section.appendChild(elt('div','econ-date',day));
        const scroll=elt('div');
        scroll.style.cssText='overflow-x:auto;max-width:100%;';
        const contents=elt('div');
        contents.style.cssText='min-width:790px;';
        const header=elt('div','econ-event');
        for(const text of ['Time (ET)','Release / currency','Impact','Previous','Forecast','Actual'])
          header.appendChild(elt('span','econ-time',text));
        contents.appendChild(header);
        for(const e of rows){
          const row=elt('div','econ-event');
          row.appendChild(elt('span','econ-time',formatET(e.time,'time')));
          const name=elt('span','econ-name',e.title+' · '+e.currency);
          if(e.status==='tentative')name.appendChild(elt('span','', ' (time tentative)'));
          else if(e.status==='moved')name.appendChild(elt('span','', ' (rescheduled)'));
          row.appendChild(name);
          const impact=elt('span','econ-impact impact-'+(e.impact==='medium'?'med':e.impact==='high'?'high':'low'),e.impact.toUpperCase());
          row.appendChild(impact);
          for(const val of [e.previous,e.forecast,e.actual])row.appendChild(elt('span','econ-val',field(val)));
          contents.appendChild(row);
        }
        scroll.appendChild(contents);section.appendChild(scroll);rootElement.appendChild(section);
      }
    }
    const bottom=elt('p','', 'Events and estimates may change; tentative release times are not confirmed. Missing values are shown as —.');
    bottom.style.cssText='color:var(--gray2);font-size:11px;margin-top:12px;';
    rootElement.appendChild(bottom);
    const link=elt('a','','Economic calendar by ShowMyTrades');
    link.href='https://showmytrades.com/tools/economic-calendar';
    link.target='_blank';link.rel='noopener noreferrer';
    link.style.cssText='font-size:11px;color:var(--gold);text-decoration:underline;';
    rootElement.appendChild(link);
  }
  async function load(options={}) {
    state.options={...state.options,...options};
    const mount=state.options.mount||document.getElementById('econCalendar');
    if(!mount)return;
    const key=state.currency+':'+state.days;
    if(!options.force && state.loadedAt && state.paramsKey===key && Date.now()-state.loadedAt<5*60*1000) {
      render(mount);return;
    }
    const requestId=++state.seq;
    state.loading=true;
    render(mount);
    try {
      if(typeof state.options.getToken!=='function')throw new Error('Login is required');
      const token=await state.options.getToken();
      if(!token)throw new Error('Sign in to view the calendar');
      const url='/api/econ-calendar?days='+state.days+'&currency='+encodeURIComponent(state.currency);
      const response=await fetch(url,{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||'Economic calendar could not be loaded');
      if(!Array.isArray(payload.events))throw new Error('Calendar provider sent an invalid response');
      if(requestId!==state.seq)return;
      state.events=normalizeEvents(payload.events);
      state.updatedAt=payload.updatedAt;
      state.loadedAt=Date.now();
      state.paramsKey=key;
      state.notice=payload.notice;
      state.loading=false;
      render(mount);
      checkAlerts();
      if(!pollingStarted && typeof setInterval==='function'){
        pollingStarted=true;
        setInterval(()=>{
          checkAlerts();
          if(state.options && state.loadedAt && Date.now()-state.loadedAt>15*60*1000)
            load({...state.options,force:true});
        },60000);
      }
    } catch(e){
      if(requestId!==state.seq)return;
      state.loading=false;
      state.events=[];state.loadedAt=0;
      render(mount, e.message||'Economic calendar unavailable. Please try again.');
    }
  }
  function checkAlerts(notify) {
    if(!state.events.length)return;
    const callback=notify||state.options?.notify;
    if(typeof callback!=='function')return;
    const now=Date.now();
    for(const e of state.events){
      if(e.impact!=='high' || e.status==='tentative')continue;
      const remain=(Date.parse(e.time)-now)/60000;
      if(remain<=0||remain>30||alertIds.has(e.id))continue;
      const key='tradephex-econ-notified-'+e.id;
      try{if(sessionStorage.getItem(key))continue;sessionStorage.setItem(key,'1');}catch(_) {}
      alertIds.add(e.id);
      callback('HIGH IMPACT: '+e.title+' ('+e.currency+') in '+Math.ceil(remain)+' minutes · Eastern Time');
    }
  }
  root.TradephexEconCalendar=Object.freeze({load,checkAlerts,normalizeEvents,formatET});
})(typeof window==='undefined'?globalThis:window);
