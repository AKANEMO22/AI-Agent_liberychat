const { app, BrowserWindow, shell, webUtils } = require('electron');
const path = require('path');

const BACKEND_URL = 'http://127.0.0.1:3080';
const ALLOWED_ORIGINS = ['http://127.0.0.1:3080', 'http://localhost:3080'];
let mainWindow = null;

// Enforce single instance behavior
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 800,
    minHeight: 600,
    title: 'Local Qwen',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Navigation Lockdown: Prevent navigation to remote, file://, data:, javascript: origins
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const isAllowed = ALLOWED_ORIGINS.some((allowed) => navigationUrl.startsWith(allowed));
    if (!isAllowed) {
      event.preventDefault();
      try {
        const parsed = new URL(navigationUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(navigationUrl);
        }
      } catch (err) {
        console.error('[will-navigate] Blocked invalid URL:', navigationUrl);
      }
    }
  });

  // window.open Lockdown: Deny creation of new Electron windows and delegate external links to default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch (err) {
      console.error('[setWindowOpenHandler] Blocked invalid URL:', url);
    }
    return { action: 'deny' };
  });

  // Load production LibreChat backend
  mainWindow.loadURL(BACKEND_URL);

  // Controlled retry if backend is still booting
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    // Only retry for trusted local origin
    const isAllowed = ALLOWED_ORIGINS.some((allowed) => validatedURL.startsWith(allowed));
    if (isAllowed) {
      console.log('[Local Qwen Desktop] Local backend not ready yet, retrying in 1.5s...');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL(BACKEND_URL);
        }
      }, 1500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('window-all-closed', () => {
  app.quit();
});
