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
      }>
  }
};

contextBridge.exposeInMainWorld('vac', vacApi);

export type VacApi = typeof vacApi;
