// Eğer bu kod tarayıcıda (Go Live) çalıştırılıyorsa, Electron kodlarını çalıştırma ve çökme!
if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
  const { app, BrowserWindow } = require('electron');

  function createWindow() {
    const win = new BrowserWindow({
      width: 1000,
      height: 750,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    win.loadFile('index.html'); 

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://eyyupavci.gumroad.com')) {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
} else {
  console.log("Tarayıcı ortamı algılandı, Electron modülleri yüklenmedi.");
}

// =================================================================
// E, ARTIK HER YERDE (TARAYICI/TABLET) SORUNSUZ ÇALIŞACAK YENİ KOD:
// =================================================================

// Cihaz için benzersiz kimlik oluşturucu
function getOrCreateDeviceId() {
  let id = localStorage.getItem('pomodoro_device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('pomodoro_device_id', id);
  }
  return id;
}

// LİSANS AKTİFLEŞTİRME BUTONUNUN ÇALIŞTIRACAĞI ANA FONKSİYON
async function handleLicenseActivation() {
  // Arayüzdeki input alanını bul (Input'unun ID'si neyse ona göre yakalar)
  const licenseInput = document.querySelector('input[type="text"]') || document.getElementById('license-input-field');
  const licenseKey = licenseInput ? licenseInput.value.trim() : '';
  const deviceId = getOrCreateDeviceId();

  if (!licenseKey) {
    alert('Lütfen bir lisans anahtarı giriniz!');
    return;
  }

  // Aktifleştir butonunu bul ve geçici olarak kilitle (Çift tıklamayı önlemek için)
  const activateButton = document.querySelector('button') || document.querySelector('.aktiflestir-buton-class');
  if (activateButton) {
    var originalText = activateButton.innerText;
    activateButton.innerText = 'Doğrulanıyor...';
    activateButton.disabled = true;
  }

  try {
    // DOĞRUDAN GUMROAD API'SİNE İSTEK ATIYORUZ, ARADA SUNUCU YOK!
    const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        product_permalink: 'tqjvzr', // Senin Gumroad ürün kodun
        license_key: licenseKey
      })
    });

    const data = await response.json();

    // 1. KONTROL: Gumroad lisansı onaylamadıysa
    if (!data || !data.success || !data.purchase) {
      alert('Geçersiz veya hatalı lisans kodu!');
      if (activateButton) {
        activateButton.disabled = false;
        activateButton.innerText = originalText;
      }
      return;
    }

    // 2. KONTROL: Kullanıcı uyanıklık yapıp parayı geri çektiyse (İade/İptal)
    if (data.purchase.refunded || data.purchase.chargebacked) {
      alert('Bu lisans iade edilmiş veya iptal edilmiş!');
      if (activateButton) {
        activateButton.disabled = false;
        activateButton.innerText = originalText;
      }
      return;
    }

    // HER ŞEY DOĞRUYSA: Cihaz hafızasına mühürle
    const premiumData = {
      plan: 'lifetime',
      lifetime: true,
      deviceId: deviceId,
      activatedAt: new Date().toISOString(),
      key: licenseKey
    };
    
    localStorage.setItem('premium_status', JSON.stringify(premiumData));
    
    alert('Lisans başarıyla doğrulandı! Premium özellikler ömür boyu açıldı.');
    window.location.reload();

  } catch (error) {
    console.error('Doğrulama hatası:', error);
    alert('Bağlantı hatası! İnternetinizi kontrol edin veya Gumroad servislerini bekleyin.');
    if (activateButton) {
      activateButton.disabled = false;
      activateButton.innerText = originalText;
    }
  }
}

// UYGULAMA HER AÇILDIĞINDA PREMİUM DURUMUNU KONTROL EDEN KOD
function checkPremiumStatusOnLoad() {
  const status = localStorage.getItem('premium_status');
  if (status) {
    const premiumData = JSON.parse(status);
    if (premiumData.lifetime === true) {
      console.log("Cihaz Onaylı: Premium Aktif!");
      
      // Ekranda "Lisans Anahtarınız Var Mı?" kutusunu otomatik gizlemek için:
      // Eğer o kutunun (div) class veya ID'si varsa buraya ekleyebilirsin.
      // Örnek: document.querySelector('.lisans-kutusu-class').style.display = 'none';
      
      return true;
    }
  }
  return false;
}

// Sayfa yüklenir yüklenmez butona fonksiyonu bağla ve premium kontrolü yap
document.addEventListener('DOMContentLoaded', () => {
  checkPremiumStatusOnLoad();
  
  // Ekrandaki "Aktifleştir" butonunu bul ve tıklama olayına bağla
  const activeBtn = document.querySelector('button') || document.querySelector('.aktiflestir-buton-class');
  if (activeBtn) {
    activeBtn.addEventListener('click', handleLicenseActivation);
  }
});
