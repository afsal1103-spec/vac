export {};

declare global {
  interface Window {
    vac: {
      shell: {
        getStatus(): Promise<{
          appName: string;
          version: string;
          overlayReady: boolean;
          phase: string;
        }>;
        setOverlayInteractive(interactive: boolean): Promise<{ interactive: boolean }>;
      };
      profile: {
        load(): Promise<{
          userId: string;
          userName: string;
          assistantName: string;
          personality: string;
          voice: string;
          provider: 'ollama' | 'openrouter' | 'openai' | 'anthropic';
          createdAt: string;
        } | null>;
        save(profile: {
          userName: string;
          assistantName: string;
          personality: string;
          voice: string;
          provider: 'ollama' | 'openrouter' | 'openai' | 'anthropic';
        }): Promise<{
          userId: string;
          userName: string;
          assistantName: string;
          personality: string;
          voice: string;
          provider: 'ollama' | 'openrouter' | 'openai' | 'anthropic';
          createdAt: string;
        }>;
      };
      chat: {
        listConversations(): Promise<Array<{ id: string; title: string; createdAt: string }>>;
        getMessages(conversationId: string): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>>;
        sendMessage(payload: {
          conversationId?: string;
          content: string;
        }): Promise<{
          conversationId: string;
          reply: string;
          messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
        }>;
      };
    };
  }
}
