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
        onStream(
          handler: (payload: {
            conversationId: string;
            text: string;
            done: boolean;
            provider: 'ollama' | 'openrouter' | 'openai' | 'anthropic';
          }) => void
        ): () => void;
      };
      ai: {
        getConfig(): Promise<{
          models: {
            ollama: string;
            openrouter: string;
            openai: string;
            anthropic: string;
          };
          keyAliases: {
            ollama: string;
            openrouter: string;
            openai: string;
            anthropic: string;
          };
          temperature: number;
          maxTokens: number;
          fallbackOrder: Array<'ollama' | 'openrouter' | 'openai' | 'anthropic'>;
        }>;
        saveConfig(config: Partial<{
          models: {
            ollama: string;
            openrouter: string;
            openai: string;
            anthropic: string;
          };
          keyAliases: {
            ollama: string;
            openrouter: string;
            openai: string;
            anthropic: string;
          };
          temperature: number;
          maxTokens: number;
          fallbackOrder: Array<'ollama' | 'openrouter' | 'openai' | 'anthropic'>;
        }>): Promise<{
          models: {
            ollama: string;
            openrouter: string;
            openai: string;
            anthropic: string;
          };
          keyAliases: {
            ollama: string;
            openrouter: string;
            openai: string;
            anthropic: string;
          };
          temperature: number;
          maxTokens: number;
          fallbackOrder: Array<'ollama' | 'openrouter' | 'openai' | 'anthropic'>;
        }>;
        health(): Promise<Array<{
          provider: 'ollama' | 'openrouter' | 'openai' | 'anthropic';
          model: string;
          online: boolean;
          detail: string;
        }>>;
      };
      memory: {
        getLastContext(): Promise<{
          query: string;
          context: string;
          hits: Array<{ id: string; score: number; text: string; source: string }>;
          generatedAt: string;
        } | null>;
      };
      overlay: {
        getState(): Promise<{
          assistantName: string;
          mode: 'idle' | 'thinking' | 'speaking';
          lastMessage: string;
          updatedAt: string;
        }>;
        onStateChange(
          handler: (state: {
            assistantName: string;
            mode: 'idle' | 'thinking' | 'speaking';
            lastMessage: string;
            updatedAt: string;
          }) => void
        ): () => void;
      };
      voice: {
        startSession(config: {
          provider: 'local' | 'deepgram-elevenlabs';
          language: string;
          voiceId: string;
          enableWordTimestamps: boolean;
        }): Promise<{
          id: string;
          config: {
            provider: 'local' | 'deepgram-elevenlabs';
            language: string;
            voiceId: string;
            enableWordTimestamps: boolean;
          };
          createdAt: string;
        }>;
        stopSession(sessionId: string): Promise<{ stopped: boolean }>;
        pushMicChunk(payload: {
          sessionId: string;
          audioBase64: string;
        }): Promise<Array<{ text: string; startMs: number; endMs: number; confidence?: number; isFinal: boolean }>>;
        speakText(payload: {
          sessionId: string;
          text: string;
          isFinal: boolean;
        }): Promise<Array<{ audioBase64: string; sampleRate: number; format: 'wav' | 'pcm_s16le'; text: string; isFinal: boolean }>>;
        onEvent(
          handler: (payload: {
            sessionId: string;
            event:
              | {
                  type: 'stt_chunk';
                  chunk: { text: string; startMs: number; endMs: number; confidence?: number; isFinal: boolean };
                }
              | { type: 'llm_chunk'; chunk: { text: string; isFinal: boolean } }
              | {
                  type: 'tts_chunk';
                  chunk: { audioBase64: string; sampleRate: number; format: 'wav' | 'pcm_s16le'; text: string; isFinal: boolean };
                }
              | { type: 'status'; message: string }
              | { type: 'error'; message: string };
          }) => void
        ): () => void;
      };
      cloud: {
        getStatus(): Promise<{
          configured: boolean;
          signedIn: boolean;
          userId: string | null;
          email: string | null;
          detail: string;
        }>;
        signUp(payload: {
          email: string;
          password: string;
        }): Promise<{
          status: {
            configured: boolean;
            signedIn: boolean;
            userId: string | null;
            email: string | null;
            detail: string;
          };
        }>;
        signIn(payload: {
          email: string;
          password: string;
        }): Promise<{
          status: {
            configured: boolean;
            signedIn: boolean;
            userId: string | null;
            email: string | null;
            detail: string;
          };
        }>;
        signOut(): Promise<{
          status: {
            configured: boolean;
            signedIn: boolean;
            userId: string | null;
            email: string | null;
            detail: string;
          };
        }>;
        syncNow(): Promise<{
          synced: boolean;
          profileSynced: boolean;
          conversationCount: number;
          detail: string;
        }>;
      };
      vault: {
        list(): Promise<
          Array<{
            id: string;
            provider: string;
            keyAlias: string;
            createdAt: string;
          }>
        >;
        set(payload: { provider: string; keyAlias: string; secret: string }): Promise<{
          ref: {
            id: string;
            provider: string;
            keyAlias: string;
            createdAt: string;
          };
        }>;
        remove(id: string): Promise<{ removed: boolean }>;
      };
      offline: {
        listGrants(): Promise<Array<{
          id: string;
          path: string;
          grantedAt: string;
          reason: string;
        }>>;
        pickAndGrant(reason: string): Promise<{
          granted: {
            id: string;
            path: string;
            grantedAt: string;
            reason: string;
          } | null;
        }>;
        revokeGrant(grantId: string): Promise<{ removed: boolean }>;
        listFiles(directoryPath: string): Promise<string[]>;
        searchFiles(payload: { directoryPath: string; query: string; maxResults?: number }): Promise<Array<{
          path: string;
          sizeBytes: number;
          lastModifiedIso: string;
          excerpt: string;
        }>>;
        summarizeFile(payload: { filePath: string; maxChars?: number }): Promise<{
          path: string;
          sizeBytes: number;
          lastModifiedIso: string;
          excerpt: string;
        }>;
        getChatContext(): Promise<string[]>;
        setChatContext(paths: string[]): Promise<string[]>;
      };
    };
  }
}
