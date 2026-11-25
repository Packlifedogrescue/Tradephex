// Stripe webhook: the ONLY path authorized to grant paid evaluation entitlements.
// Install a UNIQUE index on evaluations(stripe_session_id) before production launch.
// Verify your live Supabase schema and event retry behavior in Stripe test mode.
export const config = { api:{ bodyParser:false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
function sbHeaders() {
  const key=process.env.SUPABASE_SERVICE_KEY;
  return { 'apikey':key, 'Authorization':'Bearer '+key, 'Content-Type':'application/json' };
}
export default async function handler(req,res) {
  if(req.method!=='POST') return res.status(405).end();
  if(!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET ||
     !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    return res.status(503).json({error:'Webhook unavailable'});
  }

  let event;
  try {
    const {default:Stripe}=await import('stripe');
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    event=stripe.webhooks.constructEvent(await rawBody(req),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
  } catch(err) {
    console.error('Stripe webhook signature error:',err.message);
    return res.status(400).json({error:'Invalid webhook'});
  }

  if(event.type!=='checkout.session.completed') return res.status(200).json({received:true});
  const session=event.data.object;
  if(session.mode!=='payment' || session.payment_status!=='paid' || session.metadata?.type!=='evaluation') {
    return res.status(200).json({received:true,ignored:true});
  }
  const {user_id,plan,account_size,profit_target,max_dd,daily_limit}=session.metadata || {};
  const plans = {
    '25k':{account:25000,profit:.10,dd:.05,daily:.02},
    '50k':{account:50000,profit:.10,dd:.05,daily:.02},
    '100k':{account:100000,profit:.08,dd:.05,daily:.02},
    '150k':{account:150000,profit:.08,dd:.05,daily:.02},
  };
  const p=Object.prototype.hasOwnProperty.call(plans,plan) ? plans[plan] : null;
  const validUser=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user_id||'');
  if(!p || !validUser || session.client_reference_id!==user_id ||
     Number(account_size)!==p.account || Number(profit_target)!==p.profit ||
     Number(max_dd)!==p.dd || Number(daily_limit)!==p.daily) {
    console.error('Invalid evaluation checkout metadata',session.id);
    return res.status(400).json({error:'Invalid checkout metadata'});
  }

  try {
    const base=process.env.SUPABASE_URL.replace(/\/$/,'');
    const existing=await fetch(base+'/rest/v1/evaluations?stripe_session_id=eq.'+encodeURIComponent(session.id)+'&select=id', {
      headers:sbHeaders(),
    });
    if(!existing.ok) throw new Error('Cannot check existing checkout: '+existing.status);
    const rows=await existing.json();
    if(rows.length) return res.status(200).json({received:true,duplicate:true});

    // The live DB must enforce uniqueness of stripe_session_id: read-before-write alone
    // does not protect against concurrent Stripe retries.
    const created=await fetch(base+'/rest/v1/evaluations',{
      method:'POST',
      headers:{...sbHeaders(),'Prefer':'return=minimal'},
      body:JSON.stringify({
        user_id, account_size:p.account, phase:1, status:'active',
        net_pnl:0,max_drawdown:p.dd,drawdown_observed:0,trading_days:0,
        profit_target:p.profit,max_dd_limit:p.dd,daily_loss_limit:p.daily,
        stripe_session_id:session.id,started_at:new Date().toISOString(),
      }),
    });
    if(!created.ok) {
      const details=await created.text();
      // A unique conflict during concurrent retry means the first insert succeeded.
      if(created.status===409 && details.includes('23505')) return res.status(200).json({received:true,duplicate:true});
      throw new Error('Evaluation insert failed: '+created.status+' '+details.slice(0,350));
    }
    return res.status(200).json({received:true});
  } catch(err) {
    console.error('Checkout fulfillment failed:',err);
    // 500 tells Stripe to retry this signed event.
    return res.status(500).json({error:'Fulfillment pending retry'});
  }
}
