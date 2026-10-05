// نسخه ویندوز (Electron) — همان برنامه وب، به‌صورت برنامه دسکتاپ
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: 'انباریار — سامانه انبارداری',
    icon: path.join(__dirname, 'web', 'icons', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, plugins: true, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  // پیوندهای خارجی (دانلود/پیش‌نمایش فایل) در مرورگر پیش‌فرض باز شوند
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^blob:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });
}

Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'برنامه', submenu: [{ role: 'reload', label: 'بارگذاری مجدد' }, { role: 'toggleDevTools', label: 'ابزار توسعه' }, { type: 'separator' }, { role: 'quit', label: 'خروج' }] },
  { label: 'نمایش', submenu: [{ role: 'zoomIn', label: 'بزرگ‌نمایی' }, { role: 'zoomOut', label: 'کوچک‌نمایی' }, { role: 'resetZoom', label: 'اندازه عادی' }, { role: 'togglefullscreen', label: 'تمام‌صفحه' }] },
]));

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
