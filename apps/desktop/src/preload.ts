import { contextBridge, ipcRenderer } from 'electron';

type ShellStatus = {
  appName: string;
  version: string;
  overlayReady: boolean;
  phase: string;
};

const vacApi = {
  shell: {
    getStatus: () => ipcRenderer.invoke('vac:shell-status') as Promise<ShellStatus>,
    setOverlayInteractive: (interactive: boolean) =>
      ipcRenderer.invoke('vac:set-overlay-interactive', interactive) as Promise<{ interactive: boolean }>
  }
};

contextBridge.exposeInMainWorld('vac', vacApi);

export type VacApi = typeof vacApi;
