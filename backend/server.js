import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use('/api/webhook', bodyParser.raw({ type: 'application/json' }));
app.use(express.json());

const users = new Map();

const PRICES = {
  monthly: { amount: 200, currency: 'usd', label: 'Odak Premium Monthly', durationDays: 30, lifetime: false },
  quarterly: { amount: 400, currency: 'usd', label: 'Odak Premium 3 Months', durationDays: 90, lifetime: false },
  yearly: { amount: 1000, currency: 'usd', label: 'Odak Premium Yearly', durationDays: 365, lifetime: false },
  lifetime: { amount: 1500, currency: 'usd', label: 'Odak Premium Lifetime', durationDays: null, lifetime: true }
};

function getPremiumStatus(deviceId){
  const user = users.get(deviceId);
  if(!user) return { active:false, plan:null, expiresAt:null, lifetime:false };

  if(user.lifetime) {
    return { active:true, plan:user.plan, expiresAt:null, lifetime:true };
  }

  const active = !!user.expiresAt && new Date(user.expiresAt).getTime() > Date.now();
  return {
    active,
    plan: user.plan || null,
    expiresAt: user.expiresAt || null,
    lifetime: false
  };
}

app.get('/api/premium-status', (req, res) => {
  const { deviceId } = req.query;
  if(!deviceId) return res.status(400).json({ error: 'deviceId gerekli' });
  return res.json(getPremiumStatus(deviceId));
});

app.get('/api/weather', async (req, res) => {
  try{
    const city = req.query.city || 'Istanbul';
    const url = `[api.openweathermap.org](https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&lang=tr)`;
    const response = await fetch(url);
    const data = await response.json();

    if(!response.ok){
      return res.status(400).json({ ok:false, error:'weather_failed', details:data });
    }

    res.json({
      ok:true,
      city:data.name,
      temp:data.main.temp,
      description:data.weather?.[0]?.description || ''
    });
  }catch(e){
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

app.post('/api/create-checkout-session', async (req, res) => {
  try{
    const { plan, deviceId } = req.body;
    if(!plan || !deviceId || !PRICES[plan]){
      return res.status(400).json({ error:'Gecersiz plan veya deviceId' });
    }

    const price = PRICES[plan];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: price.currency,
            product_data: {
              name: price.label
            },
            unit_amount: price.amount
          },
          quantity: 1
        }
      ],
      metadata: {
        deviceId,
        plan
      },
      success_url: `${process.env.FRONTEND_URL}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}?payment=cancel`
    });

    res.json({ url: session.url });
  }catch(e){
    console.error(e);
    res.status(500).json({ error:'checkout_failed' });
  }
});

app.post('/api/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try{
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  }catch(err){
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if(event.type === 'checkout.session.completed'){
    const session = event.data.object;
    const deviceId = session.metadata?.deviceId;
    const plan = session.metadata?.plan;

    if(deviceId && plan && PRICES[plan]){
      const cfg = PRICES[plan];
      const existing = users.get(deviceId) || {};

      if(cfg.lifetime){
        users.set(deviceId, {
          ...existing,
          plan,
          lifetime:true,
          expiresAt:null
        });
      } else {
        const baseTime = existing.expiresAt && new Date(existing.expiresAt).getTime() > Date.now()
          ? new Date(existing.expiresAt).getTime()
          : Date.now();

        const expiresAt = new Date(baseTime + cfg.durationDays * 24 * 60 * 60 * 1000).toISOString();

        users.set(deviceId, {
          ...existing,
          plan,
          lifetime:false,
          expiresAt
        });
      }
    }
  }

  res.json({ received:true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
