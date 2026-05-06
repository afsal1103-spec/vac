import { contextBridge, ipcRenderer } from 'electron';

type ShellStatus = {
  appName: string;
  version: string;
  overlayReady: boolean;
  phase: string;
};

type Provider = 'ollama' | 'openrouter' | 'openai' | 'anthropic';

type AppProfile = {
  userId: string;
  userName: string;
  assistantName: string;
  personality: string;
  voice: string;
  provider: Provider;
  createdAt: string;
};

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type OverlayState = {
  assistantName: string;
  mode: 'idle' | 'thinking' | 'speaking';
  lastMessage: string;
  updatedAt: string;
};

type VoiceProvider = 'local' | 'deepgram-elevenlabs';

type VoiceSession = {
  id: string;
  config: {
    provider: VoiceProvider;
    language: string;
    voiceId: string;
    enableWordTimestamps: boolean;
  };
  createdAt: string;
};

type VoiceEventPayload = {
  sessionId: string;
  event:
    | { type: 'stt_chunk'; chunk: { text: string; startMs: number; endMs: number; confidence?: number; isFinal: boolean } }
    | { type: 'llm_chunk'; chunk: { text: string; isFinal: boolean } }
    | { type: 'tts_chunk'; chunk: { audioBase64: string; sampleRate: number; format: 'wav' | 'pcm_s16le'; text: string; isFinal: boolean } }
    | { type: 'status'; message: string }
    | { type: 'error'; message: string };
};

type CloudAuthStatus = {
  configured: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  detail: string;
};

type SyncResult = {
  synced: boolean;
  profileSynced: boolean;
  conversationCount: number;
  detail: string;
};

type AiRuntimeConfig = {
  models: Record<Provider, string>;
  keyAliases: Record<Provider, string>;
  temperature: number;
  maxTokens: number;
  fallbackOrder: Provider[];
};

type RouterHealth = {
  provider: Provider;
  model: string;
  online: boolean;
  detail: string;
};

type VaultKeyRef = {
  id: string;
  provider: string;
  keyAlias: string;
  createdAt: string;
};

const vacApi = {
  shell: {
    getStatus: () => ipcRenderer.invoke('vac:shell-status') as Promise<ShellStatus>,
    setOverlayInteractive: (interactive: boolean) =>
      ipcRenderer.invoke('vac:set-overlay-interactive', interactive) as Promise<{ interactive: boolean }>
  },
  profile: {
    load: () => ipcRenderer.invoke('vac:profile-load') as Promise<AppProfile | null>,
    save: (profile: Omit<AppProfile, 'userId' | 'createdAt'>) =>
      ipcRenderer.invoke('vac:profile-save', profile) as Promise<AppProfile>
  },
  chat: {
    listConversations: () =>
      ipcRenderer.invoke('vac:chat-list-conversations') as Promise<Array<{ id: string; title: string; createdAt: string }>>,
    getMessages: (conversationId: string) =>
      ipcRenderer.invoke('vac:chat-get-messages', conversationId) as Promise<ChatMessage[]>,
    sendMessage: (payload: { conversationId?: string; content: string }) =>
      ipcRenderer.invoke('vac:chat-send-message', payload) as Promise<{
        conversationId: string;
        reply: string;
        messages: ChatMessage[];
      }>,
    onStream: (handler: (payload: { conversationId: string; text: string; done: boolean; provider: Provider }) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { conversationId: string; text: string; done: boolean; provider: Provider }
      ) => handler(payload);
      ipcRenderer.on('vac:chat-stream', listener);
      return () => {
        ipcRenderer.removeListener('vac:chat-stream', listener);
      };
    }
  },
  ai: {
    getConfig: () => ipcRenderer.invoke('vac:ai-config-get') as Promise<AiRuntimeConfig>,
    saveConfig: (config: Partial<AiRuntimeConfig>) => ipcRenderer.invoke('vac:ai-config-save', config) as Promise<AiRuntimeConfig>,
    health: () => ipcRenderer.invoke('vac:ai-health') as Promise<RouterHealth[]>
  },
  overlay: {
    getState: () => ipcRenderer.invoke('vac:overlay-get-state') as Promise<OverlayState>,
    onStateChange: (handler: (state: OverlayState) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, state: OverlayState) => handler(state);
      ipcRenderer.on('vac:overlay-state', listener);
      return () => {
        ipcRenderer.removeListener('vac:overlay-state', listener);
      };
    }
  },
  voice: {
    startSession: (config: { provider: VoiceProvider; language: string; voiceId: string; enableWordTimestamps: boolean }) =>
      ipcRenderer.invoke('vac:voice-session-start', config) as Promise<VoiceSession>,
    stopSession: (sessionId: string) =>
      ipcRenderer.invoke('vac:voice-session-stop', sessionId) as Promise<{ stopped: boolean }>,
    pushMicChunk: (payload: { sessionId: string; audioBase64: string }) =>
      ipcRenderer.invoke('vac:voice-push-mic', payload) as Promise<
        Array<{ text: string; startMs: number; endMs: number; confidence?: number; isFinal: boolean }>
      >,
    speakText: (payload: { sessionId: string; text: string; isFinal: boolean }) =>
      ipcRenderer.invoke('vac:voice-speak-text', payload) as Promise<
        Array<{ audioBase64: string; sampleRate: number; format: 'wav' | 'pcm_s16le'; text: string; isFinal: boolean }>
      >,
    onEvent: (handler: (payload: VoiceEventPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: VoiceEventPayload) => handler(payload);
      ipcRenderer.on('vac:voice-event', listener);
      return () => {
        ipcRenderer.removeListener('vac:voice-event', listener);
      };
    }
  },
  cloud: {
    getStatus: () => ipcRenderer.invoke('vac:cloud-status') as Promise<CloudAuthStatus>,
    signUp: (payload: { email: string; password: string }) =>
      ipcRenderer.invoke('vac:cloud-sign-up', payload) as Promise<{ status: CloudAuthStatus }>,
    signIn: (payload: { email: string; password: string }) =>
      ipcRenderer.invoke('vac:cloud-sign-in', payload) as Promise<{ status: CloudAuthStatus }>,
    signOut: () => ipcRenderer.invoke('vac:cloud-sign-out') as Promise<{ status: CloudAuthStatus }>,
    syncNow: () => ipcRenderer.invoke('vac:cloud-sync-now') as Promise<SyncResult>
  },
  vault: {
    list: () => ipcRenderer.invoke('vac:vault-list') as Promise<VaultKeyRef[]>,
    set: (payload: { provider: string; keyAlias: string; secret: string }) =>
      ipcRenderer.invoke('vac:vault-set', payload) as Promise<{ ref: VaultKeyRef }>,
    remove: (id: string) => ipcRenderer.invoke('vac:vault-remove', id) as Promise<{ removed: boolean }>
  }
};

contextBridge.exposeInMainWorld('vac', vacApi);

export type VacApi = typeof vacApi;
