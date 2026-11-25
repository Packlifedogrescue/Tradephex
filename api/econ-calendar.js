// Authenticated, server-side economic calendar. No synthetic events or forecasts.
// ShowMyTrades permits commercial app use with private caching (not API resale).
import { getAuthenticatedUser } from './_auth.js';

const PROVIDER = 'https://showmytrades.com/api/public/calendar/v1';
const SOURCE = 'https://showmytrades.com/tools/economic-calendar';
const CACHE_MS = 5 * 60 * 1000;
const ALLOWED_DAYS = new Set([7, 14, 30]);
const ALLOWED_CURRENCIES = new Set(['USD', 'ALL']);
const cache = new Map();
const pending = new Map();

function option(value, allowed, fallback) {
  const v = Array.isArray(value) ? '' : String(value ?? fallback).trim().toUpperCase();
  return allowed.has(v) ? v : null;
}
function normalizeCalendar(payload, currency, now) {
  if (!payload || !Array.isArray(payload.events)) throw new Error('Provider returned an invalid event list');
  if (payload.events.length > 4000) throw new Error('Provider returned too many events');
  const seen = new Set(), events = [];
  for (const row of payload.events) {
    if (!row || typeof row !== 'object') continue;
    const ts = typeof row.ts === 'number' ? row.ts * 1000 : Date.parse(row.time || '');
    if (!Number.isFinite(ts) || ts < now - 8 * 3600000 || ts > now + 31 * 86400000) continue;
    const eventCurrency = String(row.currency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(eventCurrency) || (currency !== 'ALL' && eventCurrency !== currency)) continue;
    const title = String(row.title || '').trim().slice(0, 180);
    if (!title) continue;
    const impact = String(row.impact || '').toLowerCase();
    if (!['high','medium','low','holiday'].includes(impact)) continue;
    const status = ['scheduled','moved','tentative'].includes(row.status) ? row.status : 'scheduled';
    const time = new Date(ts).toISOString();
    const id = String(row.id || eventCurrency + '-' + title + '-' + ts).slice(0, 240);
    if (seen.has(id)) continue;
    seen.add(id);
    const value = x => x == null || x === '' ? null : String(x).slice(0, 90);
    events.push({
      id, time, currency:eventCurrency, title, impact, status,
      previous:value(row.previous), forecast:value(row.forecast), actual:value(row.actual),
      period:value(row.period), confidence:value(row.confidence)
    });
  }
  events.sort((a,b)=>Date.parse(a.time)-Date.parse(b.time) || a.id.localeCompare(b.id));
  return {
    events, updatedAt:typeof payload.generated_at === 'string' && Number.isFinite(Date.parse(payload.generated_at)) ?
      new Date(payload.generated_at).toISOString() : new Date(now).toISOString(),
    source:'ShowMyTrades', sourceUrl:SOURCE, timezone:'America/New_York',
    notice:'Times are shown in Eastern Time. Tentative release times may change. Forecasts and actuals appear only when supplied by the provider.'
  };
}
async function fromProvider(days, currency) {
  const now = Date.now(), cacheKey = currency + ':' + days;
  const saved = cache.get(cacheKey);
  if (saved && now - saved.cachedAt < CACHE_MS) return saved.value;
  if (pending.has(cacheKey)) return pending.get(cacheKey);
  const work = (async () => {
    const url = new URL(PROVIDER);
    if (currency !== 'ALL') url.searchParams.set('currency', currency);
    url.searchParams.set('impact', 'all');
    url.searchParams.set('days', String(days));
    const response = await fetch(url.toString(), {
      headers:{Accept:'application/json'}, signal:AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error('Provider HTTP ' + response.status);
    const payload = await response.json();
    const value = normalizeCalendar(payload, currency, Date.now());
    cache.set(cacheKey, {cachedAt:Date.now(),value});
    return value;
  })();
  pending.set(cacheKey, work);
  try { return await work; } finally { pending.delete(cacheKey); }
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET') return res.status(405).json({error:'Method not allowed'});
  try {
    const user = await getAuthenticatedUser(req);
    if(!user) return res.status(401).json({error:'Sign in to view the economic calendar'});
    const days = Number(Array.isArray(req.query?.days) ? NaN : (req.query?.days ?? '7'));
    const currency = option(req.query?.currency, ALLOWED_CURRENCIES, 'USD');
    if(!ALLOWED_DAYS.has(days) || !currency) return res.status(400).json({error:'Unsupported calendar filter'});
    const result = await fromProvider(days,currency);
    return res.status(200).json({...result, days, requestedCurrency:currency});
  } catch (err) {
    console.error('Economic calendar provider unavailable:', err.message);
    return res.status(502).json({error:'Economic calendar source unavailable. Please try again shortly.'});
  }
}
