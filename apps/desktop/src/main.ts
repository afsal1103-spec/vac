import { app, BrowserWindow, ipcMain, screen, systemPreferences } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CloudRuntime } from './cloud-runtime.js';
import { VacRuntime } from './runtime.js';
import { type PipelineEvent, VoiceRuntime } from './voice-runtime.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let runtime: VacRuntime | null = null;
let cloudRuntime: CloudRuntime | null = null;
let overlayResetTimer: NodeJS.Timeout | null = null;
let voiceRuntime: VoiceRuntime | null = null;

type OverlayState = {
  assistantName: string;
  mode: 'idle' | 'thinking' | 'speaking';
  lastMessage: string;
  updatedAt: string;
};

const overlayState: OverlayState = {
  assistantName: 'VAC',
  mode: 'idle',
  lastMessage: 'Overlay ready',
  updatedAt: new Date().toISOString()
};

const rendererDevUrl = process.env.VAC_RENDERER_URL;

function preloadPath() {
  return join(__dirname, 'preload.js');
}

async function loadMainContent(window: BrowserWindow) {
  if (rendererDevUrl) {
    await window.loadURL(rendererDevUrl);
    return;
  }

  const rendererEntry = app.isPackaged
    ? join(process.resourcesPath, 'renderer', 'index.html')
    : join(__dirname, '../../renderer/dist/index.html');

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
            <div style="display:grid;gap:10px;justify-items:center;">
              <div id="avatar-orb" style="width:180px;height:180px;border-radius:50%;background:linear-gradient(145deg,#274c77,#8ecae6);box-shadow:0 24px 80px rgba(0,0,0,.35);display:grid;place-items:center;font-size:34px;font-weight:800;transition:transform 180ms ease;">
                VAC
              </div>
              <div style="padding:6px 10px;border-radius:999px;background:rgba(0,0,0,.35);font-size:12px;letter-spacing:0.03em;">
                <span id="overlay-mode">IDLE</span>
              </div>
              <div id="overlay-message" style="max-width:220px;font-size:12px;text-align:center;padding:6px 8px;border-radius:10px;background:rgba(0,0,0,.3);">
                Overlay ready
              </div>
            </div>
          </div>
          <script>
            const modeElement = document.getElementById('overlay-mode');
            const messageElement = document.getElementById('overlay-message');
            const orbElement = document.getElementById('avatar-orb');

            const modeColor = {
              idle: 'linear-gradient(145deg,#274c77,#8ecae6)',
              thinking: 'linear-gradient(145deg,#6a4c93,#f0b85b)',
              speaking: 'linear-gradient(145deg,#2a9d8f,#f0b85b)'
            };

            function applyState(state) {
              if (!state) return;
              modeElement.textContent = String(state.mode || 'idle').toUpperCase();
              messageElement.textContent = state.lastMessage || '...';
              orbElement.textContent = (state.assistantName || 'VAC').slice(0, 3).toUpperCase();
              orbElement.style.background = modeColor[state.mode] || modeColor.idle;
              orbElement.style.transform = state.mode === 'speaking' ? 'scale(1.04)' : 'scale(1)';
            }

            window.vac.overlay.getState().then(applyState);
            window.vac.overlay.onStateChange(applyState);
          </script>
        </body>
      </html>
    `)}`
  );
}

function publishOverlayState() {
  overlayWindow?.webContents.send('vac:overlay-state', overlayState);
  mainWindow?.webContents.send('vac:overlay-state', overlayState);
}

function publishVoiceEvent(sessionId: string, event: PipelineEvent) {
  mainWindow?.webContents.send('vac:voice-event', { sessionId, event });
}

function setOverlayState(update: Partial<OverlayState>) {
  Object.assign(overlayState, update, { updatedAt: new Date().toISOString() });
  publishOverlayState();
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

ipcMain.handle('vac:overlay-get-state', () => overlayState);

ipcMain.handle('vac:voice-session-start', (_event, config) => {
  if (!voiceRuntime) {
    throw new Error('Voice runtime is not ready.');
  }
  return voiceRuntime.startSession(config);
});

ipcMain.handle('vac:voice-session-stop', (_event, sessionId: string) => {
  if (!voiceRuntime) {
    throw new Error('Voice runtime is not ready.');
  }
  voiceRuntime.stopSession(sessionId);
  return { stopped: true };
});

ipcMain.handle('vac:voice-push-mic', (_event, payload: { sessionId: string; audioBase64: string }) => {
  if (!voiceRuntime) {
    throw new Error('Voice runtime is not ready.');
  }
  return voiceRuntime.pushMicAudio(payload.sessionId, payload.audioBase64);
});

ipcMain.handle(
  'vac:voice-speak-text',
  (_event, payload: { sessionId: string; text: string; isFinal: boolean }) => {
    if (!voiceRuntime) {
      throw new Error('Voice runtime is not ready.');
    }
    return voiceRuntime.synthesizeText(payload.sessionId, payload.text, payload.isFinal);
  }
);

ipcMain.handle('vac:cloud-status', () => {
  if (!cloudRuntime) {
    throw new Error('Cloud runtime is not ready.');
  }
  return cloudRuntime.getStatus();
});

ipcMain.handle('vac:cloud-sign-up', async (_event, payload: { email: string; password: string }) => {
  if (!cloudRuntime) {
    throw new Error('Cloud runtime is not ready.');
  }
  return cloudRuntime.signUp(payload.email, payload.password);
});

ipcMain.handle('vac:cloud-sign-in', async (_event, payload: { email: string; password: string }) => {
  if (!cloudRuntime) {
    throw new Error('Cloud runtime is not ready.');
  }
  return cloudRuntime.signIn(payload.email, payload.password);
});

ipcMain.handle('vac:cloud-sign-out', async () => {
  if (!cloudRuntime) {
    throw new Error('Cloud runtime is not ready.');
  }
  return cloudRuntime.signOut();
});

ipcMain.handle('vac:cloud-sync-now', async () => {
  if (!runtime || !cloudRuntime) {
    throw new Error('VAC cloud sync is not ready.');
  }
  return cloudRuntime.syncSnapshot(runtime.createSyncSnapshot());
});

ipcMain.handle('vac:vault-list', () => {
  if (!cloudRuntime) {
    throw new Error('Cloud runtime is not ready.');
  }
  return cloudRuntime.listKeyRefs();
});

ipcMain.handle('vac:vault-set', (_event, payload: { provider: string; keyAlias: string; secret: string }) => {
  if (!cloudRuntime) {
    throw new Error('Cloud runtime is not ready.');
  }
  return cloudRuntime.setKey(payload.provider, payload.keyAlias, payload.secret);
});

ipcMain.handle('vac:vault-remove', (_event, id: string) => {
  if (!cloudRuntime) {
    throw new Error('Cloud runtime is not ready.');
  }
  return cloudRuntime.removeKey(id);
});

ipcMain.handle('vac:profile-load', () => runtime?.loadProfile() ?? null);

ipcMain.handle('vac:profile-save', (_event, profile) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  const saved = runtime.saveProfile(profile);
  setOverlayState({
    assistantName: saved.assistantName,
    mode: 'idle',
    lastMessage: `${saved.assistantName} profile loaded`
  });
  return saved;
});

ipcMain.handle('vac:chat-list-conversations', () => runtime?.listConversations() ?? []);

ipcMain.handle('vac:ai-config-get', () => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.loadAiConfig();
});

ipcMain.handle('vac:ai-config-save', (_event, config) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.saveAiConfig(config);
});

ipcMain.handle('vac:ai-health', async () => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.getAiHealth();
});

ipcMain.handle('vac:chat-get-messages', (_event, conversationId: string) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.getConversationMessages(conversationId);
});

ipcMain.handle('vac:chat-send-message', async (_event, payload) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  setOverlayState({
    mode: 'thinking',
    lastMessage: payload.content.slice(0, 88) || 'Thinking...'
  });

  const result = await runtime.sendMessage(payload);

  setOverlayState({
    mode: 'speaking',
    lastMessage: result.reply.slice(0, 88) || 'Response ready'
  });

  if (overlayResetTimer) {
    clearTimeout(overlayResetTimer);
  }

  overlayResetTimer = setTimeout(() => {
    setOverlayState({ mode: 'idle' });
  }, 1400);

  return result;
});

app.whenReady().then(async () => {
  runtime = new VacRuntime();
  cloudRuntime = new CloudRuntime();
  runtime.attachCloudRuntime(cloudRuntime);
  voiceRuntime = new VoiceRuntime((sessionId, event: PipelineEvent) => {
    publishVoiceEvent(sessionId, event);

    if (event.type === 'tts_chunk') {
      setOverlayState({
        mode: 'speaking',
        lastMessage: event.chunk.text.slice(0, 88) || overlayState.lastMessage
      });
      if (overlayResetTimer) {
        clearTimeout(overlayResetTimer);
      }
      overlayResetTimer = setTimeout(() => {
        setOverlayState({ mode: 'idle' });
      }, 900);
    }
  });
  const profile = runtime.loadProfile();
  if (profile) {
    setOverlayState({
      assistantName: profile.assistantName,
      mode: 'idle',
      lastMessage: `${profile.assistantName} ready`
    });
  }
  await requestPlatformPermissions();
  await createMainWindow();
  await createOverlayWindow();
  publishOverlayState();

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
