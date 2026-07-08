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
        product_permalink: 'tqjvzr', // Gumroad link uzantın
        license_key: license_key
      })
    });

    const data = await response.json();

    // 1. GÜVENLİK KONTROLÜ: Gumroad başarısız döndüyse veya purchase objesi yoksa direkt reddet
    if (!data || !data.success || !data.purchase) {
      return res.status(400).json({ success: false, error: 'Gecersiz veya hatali lisans kodu' });
    }

    // 2. GÜVENLİK KONTROLÜ: İade veya ters ibraz durumları
    if (data.purchase.refunded || data.purchase.chargebacked) {
      return res.status(400).json({ success: false, error: 'Bu lisans iade edilmis veya iptal edilmis' });
    }

    // Lisans tamamen geçerliyse hafızaya kaydet
    const existing = users.get(deviceId) || {};
    users.set(deviceId, {
      ...existing,
      plan: 'lifetime',
      lifetime: true,
      expiresAt: null
    });

    return res.json({ success: true, message: 'Lisans basariyla dogrulandi' });

  } catch (error) {
    console.error('License verification failed:', error);
    // Sunucu asla crash etmesin diye hatayı güvenli yakala
    return res.status(500).json({ success: false, error: 'Sunucu hatasi, dogrulama basarisiz' });
  }
});
