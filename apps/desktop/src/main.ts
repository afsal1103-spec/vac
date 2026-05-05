import { app, BrowserWindow, ipcMain, screen, systemPreferences } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;

const rendererDevUrl = process.env.VAC_RENDERER_URL;

function preloadPath() {
  return join(__dirname, 'preload.js');
}

async function loadMainContent(window: BrowserWindow) {
  if (rendererDevUrl) {
    await window.loadURL(rendererDevUrl);
    return;
  }

  const rendererEntry = join(__dirname, '../../renderer/dist/index.html');
  await window.loadFile(rendererEntry).catch(async () => {
    await window.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
        <html>
          <body style="font-family: sans-serif; padding: 32px; background: #101820; color: #f7f2e8;">
            <h1>VAC Desktop Shell</h1>
            <p>Renderer app is not built yet. Phase 1 shell is running.</p>
          </body>
        </html>
      `)}`
    );
  });
}

async function loadOverlayContent(window: BrowserWindow) {
  await window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <html>
        <body style="margin:0; overflow:hidden; background: transparent;">
          <div id="avatar-root" style="width:100vw;height:100vh;display:grid;place-items:center;color:#f7f2e8;font-family:sans-serif;">
            <div style="width:180px;height:180px;border-radius:50%;background:linear-gradient(145deg,#274c77,#8ecae6);box-shadow:0 24px 80px rgba(0,0,0,.35);display:grid;place-items:center;">
              VAC
            </div>
          </div>
        </body>
      </html>
    `)}`
  );
}

async function requestPlatformPermissions() {
  if (process.platform === 'darwin') {
    await systemPreferences.askForMediaAccess('microphone');
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'VAC',
    backgroundColor: '#101820',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return loadMainContent(mainWindow);
}

function createOverlayWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const overlaySize = 280;

  overlayWindow = new BrowserWindow({
    width: overlaySize,
    height: overlaySize,
    x: width - overlaySize - 24,
    y: height - overlaySize - 24,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  return loadOverlayContent(overlayWindow);
}

ipcMain.handle('vac:shell-status', () => ({
  appName: app.getName(),
  version: app.getVersion(),
  overlayReady: overlayWindow !== null,
  phase: 'phase-1-electron-shell'
}));

ipcMain.handle('vac:set-overlay-interactive', (_event, interactive: boolean) => {
  overlayWindow?.setIgnoreMouseEvents(!interactive, { forward: !interactive });
  return { interactive };
});

app.whenReady().then(async () => {
  await requestPlatformPermissions();
  await createMainWindow();
  await createOverlayWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
      await createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
