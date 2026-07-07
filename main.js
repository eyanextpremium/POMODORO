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