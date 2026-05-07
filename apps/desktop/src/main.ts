import { app, BrowserWindow, dialog, ipcMain, screen, systemPreferences } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CloudRuntime } from './cloud-runtime.js';
import { VacRuntime } from './runtime.js';
import { type PipelineEvent, VoiceRuntime } from './voice-runtime.js';
import { SelfDevEngine, summarizeProposal, type ChangeProposal } from '@vac/self-dev';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let runtime: VacRuntime | null = null;
let cloudRuntime: CloudRuntime | null = null;
let overlayResetTimer: NodeJS.Timeout | null = null;
let voiceRuntime: VoiceRuntime | null = null;
let selfImprovementTimer: NodeJS.Timeout | null = null;
let selfImprovementNextRunAt: string | null = null;
let selfDevEngine: SelfDevEngine | null = null;

type SelfDevTaskStatus =
  | 'proposed'
  | 'approved'
  | 'sandbox_passed'
  | 'sandbox_failed'
  | 'deployed_sandbox'
  | 'deployed_production';

type SelfDevTask = {
  id: string;
  title: string;
  rationale: string;
  status: SelfDevTaskStatus;
  proposal: ChangeProposal;
  summary: string;
  createdAt: string;
  updatedAt: string;
  approver: string | null;
  approvalNote: string;
  approvalTokenHint: string | null;
  lastResult: string;
};

type SelfDevRun = {
  id: string;
  taskId: string;
  kind: 'sandbox' | 'deploy_sandbox' | 'deploy_production';
  status: 'passed' | 'failed';
  message: string;
  createdAt: string;
};

const selfDevTasks = new Map<string, SelfDevTask>();
const selfDevRuns: SelfDevRun[] = [];

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

function publishChatStream(payload: { conversationId: string; text: string; done: boolean; provider: string }) {
  mainWindow?.webContents.send('vac:chat-stream', payload);
}

function publishSelfImprovementStatus() {
  if (!runtime) return;
  const status = {
    ...runtime.getSelfImprovementStatus(),
    nextRunAt: selfImprovementNextRunAt
  };
  mainWindow?.webContents.send('vac:self-improvement-status-update', status);
}

function publishSelfDevUpdate() {
  mainWindow?.webContents.send('vac:self-dev-update', {
    tasks: listSelfDevTasks(),
    runs: listSelfDevRuns()
  });
}

function setOverlayState(update: Partial<OverlayState>) {
  Object.assign(overlayState, update, { updatedAt: new Date().toISOString() });
  publishOverlayState();
}

function requireSelfDevEngine(): SelfDevEngine {
  if (!selfDevEngine) {
    throw new Error('Self-dev engine is not ready.');
  }
  return selfDevEngine;
}

function listSelfDevTasks(): SelfDevTask[] {
  return Array.from(selfDevTasks.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function listSelfDevRuns(taskId?: string): SelfDevRun[] {
  const filtered = taskId ? selfDevRuns.filter((run) => run.taskId === taskId) : selfDevRuns;
  return [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 40);
}

function getSelfDevTask(taskId: string): SelfDevTask {
  const task = selfDevTasks.get(taskId);
  if (!task) {
    throw new Error(`Self-dev task ${taskId} was not found.`);
  }
  return task;
}

function clearSelfImprovementSchedule() {
  if (selfImprovementTimer) {
    clearTimeout(selfImprovementTimer);
    selfImprovementTimer = null;
  }
  selfImprovementNextRunAt = null;
}

function scheduleSelfImprovement(configOverride?: { enabled: boolean; intervalMinutes: number }) {
  if (!runtime) return;
  const config = configOverride ?? runtime.loadSelfImprovementConfig();
  clearSelfImprovementSchedule();
  if (!config.enabled) {
    publishSelfImprovementStatus();
    return;
  }

  const intervalMs = config.intervalMinutes * 60 * 1000;
  selfImprovementNextRunAt = new Date(Date.now() + intervalMs).toISOString();
  selfImprovementTimer = setTimeout(() => {
    void runSelfImprovementCycle('scheduled');
  }, intervalMs);
  publishSelfImprovementStatus();
}

async function runSelfImprovementCycle(trigger: 'manual' | 'scheduled') {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }

  const run = runtime.runSelfImprovementNow(trigger);
  scheduleSelfImprovement(runtime.loadSelfImprovementConfig());
  publishSelfImprovementStatus();
  return run;
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

ipcMain.handle('vac:memory-last-context', () => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.getLastMemoryContext();
});

ipcMain.handle('vac:self-improvement-status', () => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return {
    ...runtime.getSelfImprovementStatus(),
    nextRunAt: selfImprovementNextRunAt
  };
});

ipcMain.handle('vac:self-improvement-config-save', (_event, payload: { enabled?: boolean; intervalMinutes?: number }) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  const config = runtime.saveSelfImprovementConfig(payload);
  scheduleSelfImprovement(config);
  return {
    ...runtime.getSelfImprovementStatus(),
    nextRunAt: selfImprovementNextRunAt
  };
});

ipcMain.handle('vac:self-improvement-run-now', async () => {
  const run = await runSelfImprovementCycle('manual');
  return {
    run,
    status: runtime
      ? {
          ...runtime.getSelfImprovementStatus(),
          nextRunAt: selfImprovementNextRunAt
        }
      : null
  };
});

ipcMain.handle('vac:self-improvement-list-runs', (_event, limit?: number) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.listSelfImprovementRuns(limit);
});

ipcMain.handle('vac:self-dev-list-tasks', () => listSelfDevTasks());

ipcMain.handle('vac:self-dev-list-runs', (_event, taskId?: string) => listSelfDevRuns(taskId));

ipcMain.handle(
  'vac:self-dev-create-task',
  (
    _event,
    payload: {
      title: string;
      rationale: string;
      files: Array<{ path: string; before?: string; after: string }>;
    }
  ) => {
    const engine = requireSelfDevEngine();
    const normalizedFiles = payload.files
      .map((file) => ({
        path: file.path.trim(),
        before: file.before ?? '',
        after: file.after
      }))
      .filter((file) => file.path.length > 0 && file.after.trim().length > 0);

    const proposal = engine.propose({
      title: payload.title.trim() || 'Untitled self-dev task',
      rationale: payload.rationale.trim() || 'No rationale provided.',
      files: normalizedFiles
    });

    const now = new Date().toISOString();
    const task: SelfDevTask = {
      id: proposal.id,
      title: proposal.title,
      rationale: proposal.rationale,
      status: 'proposed',
      proposal,
      summary: summarizeProposal(proposal),
      createdAt: now,
      updatedAt: now,
      approver: null,
      approvalNote: '',
      approvalTokenHint: null,
      lastResult: 'Proposal created. Awaiting approval.'
    };

    selfDevTasks.set(task.id, task);
    publishSelfDevUpdate();
    return task;
  }
);

ipcMain.handle('vac:self-dev-approve-task', (_event, payload: { taskId: string; approver: string; note?: string }) => {
  const engine = requireSelfDevEngine();
  const task = getSelfDevTask(payload.taskId);

  const decision = {
    proposalId: task.proposal.id,
    approved: true,
    approver: payload.approver.trim() || 'Local user',
    decidedAt: new Date().toISOString(),
    note: payload.note?.trim() || undefined
  };
  engine.recordApproval(decision);

  const approvalTokenHint = `${task.proposal.id}:approved`;
  const updated: SelfDevTask = {
    ...task,
    status: 'approved',
    approver: decision.approver,
    approvalNote: decision.note ?? '',
    approvalTokenHint,
    updatedAt: new Date().toISOString(),
    lastResult: `Approved by ${decision.approver}.`
  };
  selfDevTasks.set(task.id, updated);
  publishSelfDevUpdate();
  return updated;
});

ipcMain.handle('vac:self-dev-run-sandbox', (_event, taskId: string) => {
  const engine = requireSelfDevEngine();
  const task = getSelfDevTask(taskId);

  if (task.status !== 'approved' && task.status !== 'sandbox_failed') {
    throw new Error('Task must be approved before sandbox execution.');
  }

  const result = engine.testInSandbox(task.proposal);
  const nextStatus: SelfDevTaskStatus = result.passed ? 'sandbox_passed' : 'sandbox_failed';
  const updated: SelfDevTask = {
    ...task,
    status: nextStatus,
    updatedAt: new Date().toISOString(),
    lastResult: result.output
  };
  selfDevTasks.set(task.id, updated);
  selfDevRuns.push({
    id: randomUUID(),
    taskId: task.id,
    kind: 'sandbox',
    status: result.passed ? 'passed' : 'failed',
    message: result.output,
    createdAt: new Date().toISOString()
  });
  publishSelfDevUpdate();
  return { task: updated, sandbox: result };
});

ipcMain.handle(
  'vac:self-dev-deploy',
  (_event, payload: { taskId: string; target: 'sandbox' | 'production'; approvalToken?: string }) => {
    const engine = requireSelfDevEngine();
    const task = getSelfDevTask(payload.taskId);

    if (payload.target === 'sandbox') {
      const applied = engine.deployToSandbox(task.proposal);
      const updated: SelfDevTask = {
        ...task,
        status: 'deployed_sandbox',
        updatedAt: new Date().toISOString(),
        lastResult: applied.message
      };
      selfDevTasks.set(task.id, updated);
      selfDevRuns.push({
        id: randomUUID(),
        taskId: task.id,
        kind: 'deploy_sandbox',
        status: 'passed',
        message: applied.message,
        createdAt: new Date().toISOString()
      });
      publishSelfDevUpdate();
      return { task: updated, result: applied };
    }

    if (!task.approver) {
      throw new Error('Task must be approved before production deploy.');
    }

    engine.recordApproval({
      proposalId: task.proposal.id,
      approved: true,
      approver: task.approver,
      decidedAt: task.updatedAt,
      note: task.approvalNote || undefined
    });

    const applied = engine.deployToProduction(task.proposal, payload.approvalToken ?? '');
    const updated: SelfDevTask = {
      ...task,
      status: 'deployed_production',
      updatedAt: new Date().toISOString(),
      lastResult: applied.message
    };
    selfDevTasks.set(task.id, updated);
    selfDevRuns.push({
      id: randomUUID(),
      taskId: task.id,
      kind: 'deploy_production',
      status: 'passed',
      message: applied.message,
      createdAt: new Date().toISOString()
    });
    publishSelfDevUpdate();
    return { task: updated, result: applied };
  }
);

ipcMain.handle('vac:offline-list-grants', () => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.listOfflineGrants();
});

ipcMain.handle('vac:offline-pick-and-grant', async (_event, payload: { reason: string }) => {
  if (!runtime || !mainWindow) {
    throw new Error('VAC runtime is not ready.');
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select directory for offline file access',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { granted: null };
  }
  const granted = runtime.grantOfflineDirectory(result.filePaths[0], payload.reason || 'User approved');
  return { granted };
});

ipcMain.handle('vac:offline-revoke-grant', (_event, grantId: string) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.revokeOfflineGrant(grantId);
});

ipcMain.handle('vac:offline-list-files', (_event, directoryPath: string) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.listOfflineFiles(directoryPath);
});

ipcMain.handle('vac:offline-search-files', (_event, payload: { directoryPath: string; query: string; maxResults?: number }) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.searchOfflineFiles(payload.directoryPath, payload.query, payload.maxResults);
});

ipcMain.handle('vac:offline-summarize-file', (_event, payload: { filePath: string; maxChars?: number }) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.summarizeOfflineFile(payload.filePath, payload.maxChars);
});

ipcMain.handle('vac:offline-get-chat-context', () => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.getChatFileContextPaths();
});

ipcMain.handle('vac:offline-set-chat-context', (_event, paths: string[]) => {
  if (!runtime) {
    throw new Error('VAC runtime is not ready.');
  }
  return runtime.setChatFileContextPaths(paths);
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

  const result = await runtime.sendMessage(payload, (chunk) => {
    publishChatStream(chunk);
  });

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
  selfDevEngine = new SelfDevEngine(join(app.getPath('userData'), 'self-dev-sandbox'));
  runtime.attachCloudRuntime(cloudRuntime);
  scheduleSelfImprovement(runtime.loadSelfImprovementConfig());
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
  publishSelfImprovementStatus();
  publishSelfDevUpdate();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
      await createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    clearSelfImprovementSchedule();
    app.quit();
  }
});
