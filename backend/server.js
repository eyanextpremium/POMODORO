import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('file://')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

const users = new Map();

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

app.post('/api/verify-license', async (req, res) => {
  const { license_key, deviceId } = req.body;
  if (!license_key || !deviceId) {
    return res.status(400).json({ error: 'license_key ve deviceId gerekli' });
  }

  try {
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product_permalink: 'tqjvzr',
        license_key: license_key
      })
    });

    const data = await response.json();

    if (data.success && !data.purchase.refunded && !data.purchase.chargebacked) {
      // License is valid
      const existing = users.get(deviceId) || {};
      users.set(deviceId, {
        ...existing,
        plan: 'lifetime',
        lifetime: true,
        expiresAt: null
      });
      return res.json({ success: true, message: 'Lisans basariyla dogrulandi' });
    } else {
      return res.status(400).json({ success: false, error: 'Gecersiz veya iade edilmis lisans' });
    }
  } catch (error) {
    console.error('License verification failed:', error);
    return res.status(500).json({ success: false, error: 'Sunucu hatasi, dogrulama basarisiz' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
