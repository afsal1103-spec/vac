import { useEffect, useRef, useState, useTransition } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { create } from 'zustand';

type Provider = 'ollama' | 'openrouter' | 'openai' | 'anthropic';

type ShellStatus = {
  appName: string;
  version: string;
  overlayReady: boolean;
  phase: string;
};

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

type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
};

type OverlayState = {
  assistantName: string;
  mode: 'idle' | 'thinking' | 'speaking';
  lastMessage: string;
  updatedAt: string;
};

type VoiceSession = {
  id: string;
  config: {
    provider: 'local' | 'deepgram-elevenlabs';
    language: string;
    voiceId: string;
    enableWordTimestamps: boolean;
  };
  createdAt: string;
};

type CloudAuthStatus = {
  configured: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  detail: string;
};

type VaultKeyRef = {
  id: string;
  provider: string;
  keyAlias: string;
  createdAt: string;
};

type AiRuntimeConfig = {
  models: Record<Provider, string>;
  keyAliases: Record<Provider, string>;
  temperature: number;
  maxTokens: number;
  fallbackOrder: Provider[];
};

type AiHealth = {
  provider: Provider;
  model: string;
  online: boolean;
  detail: string;
};

type OnboardingDraft = {
  userName: string;
  assistantName: string;
  personality: string;
  voice: string;
  provider: Provider;
  setField: <Key extends keyof Omit<OnboardingDraft, 'setField'>>(key: Key, value: OnboardingDraft[Key]) => void;
  hydrate: (profile: AppProfile) => void;
};

const useOnboardingStore = create<OnboardingDraft>((set) => ({
  userName: '',
  assistantName: 'VAC',
  personality: 'Warm strategist',
  voice: 'Calm studio voice',
  provider: 'ollama',
  setField: (key, value) => set({ [key]: value } as Partial<OnboardingDraft>),
  hydrate: (profile) =>
    set({
      userName: profile.userName,
      assistantName: profile.assistantName,
      personality: profile.personality,
      voice: profile.voice,
      provider: profile.provider
    })
}));

const navItems = [
  ['/onboarding', 'Onboarding'],
  ['/dashboard', 'Dashboard'],
  ['/chat', 'Chat'],
  ['/projects', 'Projects'],
  ['/customize', 'Customize'],
  ['/settings', 'Settings']
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const [shellStatus, setShellStatus] = useState<ShellStatus | null>(null);
  const [overlayState, setOverlayState] = useState<OverlayState | null>(null);

  useEffect(() => {
    window.vac.shell.getStatus().then(setShellStatus).catch(() => {
      setShellStatus(null);
    });

    window.vac.overlay.getState().then(setOverlayState).catch(() => {
      setOverlayState(null);
    });

    const unsubscribe = window.vac.overlay.onStateChange((state) => {
      setOverlayState(state);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Virtual Avatar Companion</p>
          <h1>VAC</h1>
        </div>
        <nav aria-label="Primary navigation">
          {navItems.map(([to, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="status-stack">
          <div className="system-card">
            <span className="status-dot" />
            {shellStatus?.overlayReady ? `Overlay ${overlayState?.mode ?? 'idle'}` : 'Overlay booting'}
          </div>
          <div className="system-card muted">
            {shellStatus ? `${shellStatus.appName} ${shellStatus.version}` : 'Desktop bridge offline'}
          </div>
          {overlayState ? <div className="system-card muted">{overlayState.lastMessage}</div> : null}
        </div>
      </aside>
      <main className="page-frame">{children}</main>
    </div>
  );
}

function OnboardingPage() {
  const draft = useOnboardingStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [saveError, setSaveError] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    window.vac.profile.load().then((loaded) => {
      if (loaded) {
        setProfile(loaded);
        draft.hydrate(loaded);
      }
    });
  }, [draft]);

  const progressSteps = ['Profile', 'Assistant', 'Voice', 'Provider', 'Avatar build'];

  function saveProfile() {
    setSaveError('');
    startTransition(() => {
      window.vac.profile
        .save({
          userName: draft.userName.trim() || 'User',
          assistantName: draft.assistantName.trim() || 'VAC',
          personality: draft.personality,
          voice: draft.voice,
          provider: draft.provider
        })
        .then((saved) => {
          setProfile(saved);
          navigate('/chat');
        })
        .catch((error) => {
          setSaveError(error instanceof Error ? error.message : 'Unable to save profile');
        });
    });
  }

  return (
    <Page title="Onboarding" kicker="Create the first real local companion profile">
      <section className="split-grid">
        <form className="panel form-stack" onSubmit={(event) => event.preventDefault()}>
          <label>
            User name
            <input value={draft.userName} onChange={(event) => draft.setField('userName', event.target.value)} placeholder="Afsal" />
          </label>
          <label>
            Assistant name
            <input value={draft.assistantName} onChange={(event) => draft.setField('assistantName', event.target.value)} />
          </label>
          <label>
            Personality preset
            <select value={draft.personality} onChange={(event) => draft.setField('personality', event.target.value)}>
              <option>Warm strategist</option>
              <option>Playful engineer</option>
              <option>Focused operator</option>
              <option>Calm operator</option>
            </select>
          </label>
          <label>
            Voice selection
            <select value={draft.voice} onChange={(event) => draft.setField('voice', event.target.value)}>
              <option>Calm studio voice</option>
              <option>Bright companion voice</option>
              <option>Deep narrator voice</option>
            </select>
          </label>
          <label>
            Preferred AI provider
            <select value={draft.provider} onChange={(event) => draft.setField('provider', event.target.value as Provider)}>
              <option value="ollama">Ollama</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <div className="form-actions">
            <button className="primary-button" type="button" onClick={saveProfile} disabled={isPending}>
              {isPending ? 'Saving...' : 'Save and continue'}
            </button>
            {saveError ? <p className="inline-note danger">{saveError}</p> : null}
          </div>
        </form>
        <div className="panel avatar-preview">
          <div className="avatar-orb">{draft.assistantName.slice(0, 3).toUpperCase()}</div>
          <h3>Local profile state</h3>
          <div className="steps">
            {progressSteps.map((step, index) => (
              <span key={step} className={profile && index < 4 ? 'complete' : undefined}>{step}</span>
            ))}
          </div>
          <p className="supporting-copy">
            This milestone saves your companion profile into the local desktop runtime, keeps the Ready Player Me handoff visible, and uses the saved persona to drive the chat system prompt.
          </p>
        </div>
      </section>
    </Page>
  );
}

function DashboardPage() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [overlayState, setOverlayState] = useState<OverlayState | null>(null);

  useEffect(() => {
    window.vac.profile.load().then(setProfile);
    window.vac.chat.listConversations().then(setConversations);
    window.vac.overlay.getState().then(setOverlayState);
    const unsubscribe = window.vac.overlay.onStateChange((state) => setOverlayState(state));
    return () => unsubscribe();
  }, []);

  return (
    <Page title="Dashboard" kicker="The first real runtime pulse">
      <MetricGrid
        metrics={[
          ['Provider', profile?.provider ?? 'Not configured'],
          ['Assistant', overlayState?.assistantName ?? profile?.assistantName ?? 'Waiting'],
          ['Conversations', String(conversations.length)],
          ['Overlay mode', overlayState?.mode ?? 'idle'],
          ['Persistence', profile ? 'SQLite live' : 'Pending'],
          ['Overlay message', overlayState?.lastMessage ?? 'No activity yet']
        ]}
      />
    </Page>
  );
}

function ChatPage() {
  const [profile, setProfile] = useState<AppProfile | null>(null);
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [chatError, setChatError] = useState('');
  const [voiceSession, setVoiceSession] = useState<VoiceSession | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Voice session offline');
  const [streamingConversationId, setStreamingConversationId] = useState<string | null>(null);
  const [streamingReply, setStreamingReply] = useState('');
  const [streamProvider, setStreamProvider] = useState<Provider | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isVoicePending, startVoiceTransition] = useTransition();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const voiceSessionIdRef = useRef<string | null>(null);
  const spokenCharCountRef = useRef(0);
  const sentenceRemainderRef = useRef('');

  useEffect(() => {
    window.vac.profile.load().then(setProfile);
    window.vac.chat.listConversations().then((loaded) => {
      setConversations(loaded);
      if (loaded[0]) {
        setActiveConversationId(loaded[0].id);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = window.vac.chat.onStream((payload) => {
      setStreamingConversationId(payload.conversationId);
      setStreamProvider(payload.provider);
      if (payload.done) {
        sentenceRemainderRef.current = '';
        spokenCharCountRef.current = 0;
        return;
      }

      setStreamingReply((current) => {
        const next = `${current}${payload.text}`;
        if (voiceSession && next.length > spokenCharCountRef.current) {
          const delta = next.slice(spokenCharCountRef.current);
          sentenceRemainderRef.current += delta;
          const sentenceMatch = sentenceRemainderRef.current.match(/^(.*?[.!?])(\s|$)/);
          if (sentenceMatch?.[1]) {
            const sentence = sentenceMatch[1].trim();
            if (sentence.length > 0) {
              void window.vac.voice.speakText({
                sessionId: voiceSession.id,
                text: sentence,
                isFinal: false
              });
            }
            sentenceRemainderRef.current = sentenceRemainderRef.current.slice(sentenceMatch[0].length);
          }
          spokenCharCountRef.current = next.length;
        }
        return next;
      });
    });

    return () => unsubscribe();
  }, [voiceSession]);

  useEffect(() => {
    let mounted = true;
    window.vac.voice
      .startSession({
        provider: 'local',
        language: 'en',
        voiceId: 'calm-studio',
        enableWordTimestamps: true
      })
      .then((session) => {
        if (!mounted) return;
        voiceSessionIdRef.current = session.id;
        setVoiceSession(session);
        setVoiceStatus('Voice session live');
      })
      .catch((error) => {
        if (!mounted) return;
        setVoiceStatus(error instanceof Error ? error.message : 'Unable to start voice session');
      });

    const unsubscribe = window.vac.voice.onEvent((payload) => {
      if (voiceSessionIdRef.current && payload.sessionId !== voiceSessionIdRef.current) return;

      if (payload.event.type === 'status') {
        setVoiceStatus(payload.event.message);
      } else if (payload.event.type === 'stt_chunk') {
        setVoiceTranscript(payload.event.chunk.text);
      } else if (payload.event.type === 'tts_chunk') {
        const source = `data:audio/wav;base64,${payload.event.chunk.audioBase64}`;
        const audio = new Audio(source);
        void audio.play().catch(() => {
          setVoiceStatus('Audio playback blocked by browser policy');
        });
      } else if (payload.event.type === 'error') {
        setVoiceStatus(payload.event.message);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (voiceSessionIdRef.current) {
        void window.vac.voice.stopSession(voiceSessionIdRef.current).catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    window.vac.chat.getMessages(activeConversationId).then(setMessages);
  }, [activeConversationId]);

  function sendMessage() {
    if (!draft.trim()) return;
    setChatError('');
    const content = draft;
    setDraft('');
    setStreamingReply('');
    setStreamingConversationId(activeConversationId);
    setStreamProvider(profile?.provider ?? null);
    spokenCharCountRef.current = 0;
    sentenceRemainderRef.current = '';

    startTransition(() => {
      window.vac.chat
        .sendMessage({ conversationId: activeConversationId ?? undefined, content })
        .then((result) => {
          if (voiceSession && sentenceRemainderRef.current.trim()) {
            void window.vac.voice.speakText({
              sessionId: voiceSession.id,
              text: sentenceRemainderRef.current.trim(),
              isFinal: true
            });
            sentenceRemainderRef.current = '';
          }
          setActiveConversationId(result.conversationId);
          setStreamingConversationId(null);
          setStreamingReply('');
          setStreamProvider(null);
          setMessages(result.messages);
          return window.vac.chat.listConversations();
        })
        .then(setConversations)
        .catch((error) => {
          setChatError(error instanceof Error ? error.message : 'Unable to send message');
          setDraft(content);
        });
    });
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return dataUrl.split(',')[1] ?? '';
  }

  function toggleRecording() {
    if (!voiceSession) {
      setVoiceStatus('Voice session is not ready yet.');
      return;
    }

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    startVoiceTransition(() => {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => {
          mediaStreamRef.current = stream;
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (event) => {
            if (!event.data || event.data.size === 0) return;
            void blobToBase64(event.data).then((base64) => {
              if (!voiceSession || !base64) return;
              void window.vac.voice.pushMicChunk({ sessionId: voiceSession.id, audioBase64: base64 });
            });
          };

          recorder.start(350);
          setIsRecording(true);
          setVoiceStatus('Recording microphone');
        })
        .catch((error) => {
          setVoiceStatus(error instanceof Error ? error.message : 'Microphone access denied');
        });
    });
  }

  return (
    <Page title="Chat" kicker="Local-first conversation loop">
      <section className="chat-layout">
        <aside className="panel conversation-list">
          <div className="conversation-list-header">
            <h3>Saved threads</h3>
            <span>{conversations.length}</span>
          </div>
          <div className="conversation-items">
            {conversations.length === 0 ? (
              <p className="inline-note">Your first message will create the first conversation.</p>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  className={conversation.id === activeConversationId ? 'conversation-item active' : 'conversation-item'}
                  type="button"
                  onClick={() => setActiveConversationId(conversation.id)}
                >
                  <strong>{conversation.title}</strong>
                  <span>{new Date(conversation.createdAt).toLocaleString()}</span>
                </button>
              ))
            )}
          </div>
        </aside>
        <section className="panel chat-panel">
          <div className="chat-header">
            <div>
              <h3>{profile?.assistantName ?? 'VAC'}</h3>
              <p className="inline-note">
                {profile ? `${profile.provider} profile active` : 'Set up onboarding to unlock chat'}
              </p>
              {streamingReply ? <p className="inline-note">Streaming via {streamProvider ?? profile?.provider ?? 'provider'}</p> : null}
              <p className="inline-note">{voiceStatus}</p>
              {voiceTranscript ? <p className="inline-note">Mic text: {voiceTranscript}</p> : null}
            </div>
            <button className="primary-button" type="button" onClick={toggleRecording} disabled={isVoicePending || !voiceSession}>
              {isRecording ? 'Stop mic' : 'Start mic'}
            </button>
          </div>
          <div className="chat-transcript">
            {messages.length === 0 ? (
              <p className="inline-note">Start a conversation. If Ollama is not running, the app will tell you plainly.</p>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                    {message.content}
                  </div>
                ))}
                {streamingReply && streamingConversationId === (activeConversationId ?? streamingConversationId) ? (
                  <div className="message assistant">{streamingReply}</div>
                ) : null}
              </>
            )}
          </div>
          <div className="chat-composer">
            <textarea
              aria-label="Chat draft"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask VAC anything..."
              rows={4}
            />
            <div className="composer-actions">
              {chatError ? <p className="inline-note danger">{chatError}</p> : null}
              <button className="primary-button" type="button" onClick={sendMessage} disabled={isPending || !profile}>
                {isPending ? 'Thinking...' : 'Send'}
              </button>
            </div>
          </div>
        </section>
      </section>
    </Page>
  );
}

function ProjectsPage() {
  return (
    <Page title="Projects" kicker="Reserved for the next delivery slice">
      <CardList items={['Runtime integrations', 'Voice sidecar work', 'Avatar sync work']} />
    </Page>
  );
}

function CustomizePage() {
  const [profile, setProfile] = useState<AppProfile | null>(null);

  useEffect(() => {
    window.vac.profile.load().then(setProfile);
  }, []);

  return (
    <Page title="Customize" kicker="Current companion profile">
      <MetricGrid
        metrics={[
          ['Assistant', profile?.assistantName ?? 'Not saved'],
          ['Personality', profile?.personality ?? 'Not saved'],
          ['Voice', profile?.voice ?? 'Not saved'],
          ['Provider', profile?.provider ?? 'Not saved']
        ]}
      />
    </Page>
  );
}

function SettingsPage() {
  const [shellStatus, setShellStatus] = useState<ShellStatus | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudAuthStatus | null>(null);
  const [aiConfig, setAiConfig] = useState<AiRuntimeConfig | null>(null);
  const [aiHealth, setAiHealth] = useState<AiHealth[]>([]);
  const [fallbackDraft, setFallbackDraft] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vaultProvider, setVaultProvider] = useState<Provider>('openai');
  const [vaultAlias, setVaultAlias] = useState('');
  const [vaultSecret, setVaultSecret] = useState('');
  const [vaultRefs, setVaultRefs] = useState<VaultKeyRef[]>([]);
  const [syncMessage, setSyncMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    window.vac.shell.getStatus().then(setShellStatus).catch(() => setShellStatus(null));
    window.vac.ai
      .getConfig()
      .then((config) => {
        setAiConfig(config);
        setFallbackDraft(config.fallbackOrder.join(','));
      })
      .catch(() => setAiConfig(null));
    window.vac.cloud.getStatus().then(setCloudStatus).catch((error) => {
      setCloudStatus({
        configured: false,
        signedIn: false,
        userId: null,
        email: null,
        detail: error instanceof Error ? error.message : 'Cloud status unavailable'
      });
    });
    window.vac.vault.list().then(setVaultRefs).catch(() => setVaultRefs([]));
  }, []);

  function updateAiModel(provider: Provider, value: string) {
    setAiConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        models: {
          ...current.models,
          [provider]: value
        }
      };
    });
  }

  function updateAiAlias(provider: Provider, value: string) {
    setAiConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        keyAliases: {
          ...current.keyAliases,
          [provider]: value
        }
      };
    });
  }

  function runAuth(mode: 'sign-up' | 'sign-in') {
    setSyncMessage('');
    startTransition(() => {
      const request = mode === 'sign-up' ? window.vac.cloud.signUp({ email, password }) : window.vac.cloud.signIn({ email, password });
      request
        .then((result) => {
          setCloudStatus(result.status);
          setSyncMessage(result.status.detail);
        })
        .catch((error) => {
          setSyncMessage(error instanceof Error ? error.message : 'Cloud auth failed');
        });
    });
  }

  function signOut() {
    startTransition(() => {
      window.vac.cloud
        .signOut()
        .then((result) => {
          setCloudStatus(result.status);
          setSyncMessage(result.status.detail);
        })
        .catch((error) => {
          setSyncMessage(error instanceof Error ? error.message : 'Sign out failed');
        });
    });
  }

  function syncNow() {
    startTransition(() => {
      window.vac.cloud
        .syncNow()
        .then((result) => {
          setSyncMessage(`${result.detail}: ${result.conversationCount} conversations`);
        })
        .catch((error) => {
          setSyncMessage(error instanceof Error ? error.message : 'Cloud sync failed');
        });
    });
  }

  function saveVaultKey() {
    setSyncMessage('');
    startTransition(() => {
      window.vac.vault
        .set({ provider: vaultProvider, keyAlias: vaultAlias, secret: vaultSecret })
        .then(() => window.vac.vault.list())
        .then((refs) => {
          setVaultRefs(refs);
          setVaultAlias('');
          setVaultSecret('');
          setSyncMessage('API key reference saved to local vault');
        })
        .catch((error) => {
          setSyncMessage(error instanceof Error ? error.message : 'Unable to save vault key');
        });
    });
  }

  function removeVaultKey(id: string) {
    setSyncMessage('');
    startTransition(() => {
      window.vac.vault
        .remove(id)
        .then(() => window.vac.vault.list())
        .then((refs) => {
          setVaultRefs(refs);
          setSyncMessage('API key reference removed');
        })
        .catch((error) => {
          setSyncMessage(error instanceof Error ? error.message : 'Unable to remove vault key');
        });
    });
  }

  function saveAiConfig() {
    if (!aiConfig) return;
    setSyncMessage('');
    const fallbackOrder = fallbackDraft
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter((item): item is Provider => item === 'ollama' || item === 'openrouter' || item === 'openai' || item === 'anthropic');

    startTransition(() => {
      window.vac.ai
        .saveConfig({
          ...aiConfig,
          fallbackOrder
        })
        .then((saved) => {
          setAiConfig(saved);
          setFallbackDraft(saved.fallbackOrder.join(','));
          setSyncMessage('AI routing config saved');
        })
        .catch((error) => {
          setSyncMessage(error instanceof Error ? error.message : 'Unable to save AI config');
        });
    });
  }

  function refreshAiHealth() {
    setSyncMessage('');
    startTransition(() => {
      window.vac.ai
        .health()
        .then((health) => {
          setAiHealth(health);
          setSyncMessage('Provider health refreshed');
        })
        .catch((error) => {
          setSyncMessage(error instanceof Error ? error.message : 'Unable to load AI health');
        });
    });
  }

  return (
    <Page title="Settings" kicker="Provider and runtime visibility">
      <section className="settings-grid">
        <div className="panel form-stack">
          <div>
            <h3>AI router (MVP 6)</h3>
            <p className="inline-note">Configure model routing, fallback order, and provider health checks.</p>
          </div>
          <label>
            Ollama model
            <input
              value={aiConfig?.models.ollama ?? ''}
              onChange={(event) => updateAiModel('ollama', event.target.value)}
              placeholder="llama3.2"
            />
          </label>
          <label>
            OpenRouter model
            <input
              value={aiConfig?.models.openrouter ?? ''}
              onChange={(event) => updateAiModel('openrouter', event.target.value)}
              placeholder="openai/gpt-4o-mini"
            />
          </label>
          <label>
            OpenRouter key alias
            <input
              value={aiConfig?.keyAliases.openrouter ?? ''}
              onChange={(event) => updateAiAlias('openrouter', event.target.value)}
              placeholder="work-openrouter"
            />
          </label>
          <label>
            OpenAI model
            <input
              value={aiConfig?.models.openai ?? ''}
              onChange={(event) => updateAiModel('openai', event.target.value)}
              placeholder="gpt-4o-mini"
            />
          </label>
          <label>
            OpenAI key alias
            <input
              value={aiConfig?.keyAliases.openai ?? ''}
              onChange={(event) => updateAiAlias('openai', event.target.value)}
              placeholder="work-openai"
            />
          </label>
          <label>
            Anthropic model
            <input
              value={aiConfig?.models.anthropic ?? ''}
              onChange={(event) => updateAiModel('anthropic', event.target.value)}
              placeholder="claude-3-5-haiku-latest"
            />
          </label>
          <label>
            Anthropic key alias
            <input
              value={aiConfig?.keyAliases.anthropic ?? ''}
              onChange={(event) => updateAiAlias('anthropic', event.target.value)}
              placeholder="work-anthropic"
            />
          </label>
          <label>
            Temperature
            <input
              type="number"
              min={0}
              max={1.5}
              step={0.1}
              value={aiConfig?.temperature ?? 0.7}
              onChange={(event) =>
                setAiConfig((current) =>
                  current
                    ? {
                        ...current,
                        temperature: Number(event.target.value)
                      }
                    : current
                )
              }
            />
          </label>
          <label>
            Max tokens
            <input
              type="number"
              min={64}
              max={2048}
              step={64}
              value={aiConfig?.maxTokens ?? 512}
              onChange={(event) =>
                setAiConfig((current) =>
                  current
                    ? {
                        ...current,
                        maxTokens: Number(event.target.value)
                      }
                    : current
                )
              }
            />
          </label>
          <label>
            Fallback order
            <input
              value={fallbackDraft}
              onChange={(event) => setFallbackDraft(event.target.value)}
              placeholder="ollama,openrouter,openai,anthropic"
            />
          </label>
          <div className="form-actions wrap">
            <button className="primary-button" type="button" onClick={saveAiConfig} disabled={isPending || !aiConfig}>
              Save AI config
            </button>
            <button className="primary-button secondary" type="button" onClick={refreshAiHealth} disabled={isPending}>
              Check provider health
            </button>
          </div>
          <div className="vault-list">
            {aiHealth.length === 0 ? (
              <p className="inline-note">Run health check to view provider status.</p>
            ) : (
              aiHealth.map((entry) => (
                <div key={entry.provider} className="vault-row">
                  <div>
                    <strong>
                      {entry.provider} - {entry.online ? 'online' : 'offline'}
                    </strong>
                    <p className="inline-note">{entry.detail}</p>
                  </div>
                  <span className="inline-note">{entry.model}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="panel form-stack">
          <div>
            <h3>Cloud sync</h3>
            <p className="inline-note">{cloudStatus?.detail ?? 'Checking Supabase configuration...'}</p>
          </div>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" />
          </label>
          <div className="form-actions wrap">
            <button className="primary-button" type="button" onClick={() => runAuth('sign-up')} disabled={isPending}>
              Sign up
            </button>
            <button className="primary-button secondary" type="button" onClick={() => runAuth('sign-in')} disabled={isPending}>
              Sign in
            </button>
            <button className="primary-button secondary" type="button" onClick={signOut} disabled={isPending || !cloudStatus?.signedIn}>
              Sign out
            </button>
          </div>
          <button className="primary-button" type="button" onClick={syncNow} disabled={isPending || !cloudStatus?.signedIn}>
            Sync profile now
          </button>
          {syncMessage ? <p className="inline-note">{syncMessage}</p> : null}
        </div>
        <div className="panel form-stack">
          <div>
            <h3>Key vault</h3>
            <p className="inline-note">Store provider key references locally. Secrets stay on this device.</p>
          </div>
          <label>
            Provider
            <select value={vaultProvider} onChange={(event) => setVaultProvider(event.target.value as Provider)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="openrouter">OpenRouter</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          <label>
            Key alias
            <input value={vaultAlias} onChange={(event) => setVaultAlias(event.target.value)} placeholder="work-account" />
          </label>
          <label>
            Secret
            <input value={vaultSecret} onChange={(event) => setVaultSecret(event.target.value)} placeholder="sk-..." type="password" />
          </label>
          <button className="primary-button" type="button" onClick={saveVaultKey} disabled={isPending}>
            Save key reference
          </button>
          <div className="vault-list">
            {vaultRefs.length === 0 ? (
              <p className="inline-note">No key references saved yet.</p>
            ) : (
              vaultRefs.map((ref) => (
                <div key={ref.id} className="vault-row">
                  <div>
                    <strong>{ref.keyAlias}</strong>
                    <p className="inline-note">
                      {ref.provider} - {new Date(ref.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <button className="primary-button secondary" type="button" onClick={() => removeVaultKey(ref.id)} disabled={isPending}>
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <MetricGrid
          metrics={[
            ['Desktop', shellStatus ? `${shellStatus.appName} ${shellStatus.version}` : 'Desktop bridge offline'],
            ['Runtime phase', shellStatus?.phase ?? 'Unknown'],
            ['Overlay ready', shellStatus?.overlayReady ? 'Yes' : 'No'],
            ['Supabase', cloudStatus?.configured ? 'Configured' : 'Missing env'],
            ['Session', cloudStatus?.signedIn ? 'Signed in' : 'Signed out'],
            ['Email', cloudStatus?.email ?? 'None'],
            ['User ID', cloudStatus?.userId ?? 'None'],
            ['Vault refs', String(vaultRefs.length)]
          ]}
        />
      </section>
    </Page>
  );
}

function Page({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="page">
      <p className="eyebrow">{kicker}</p>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string]> }) {
  return (
    <div className="metric-grid">
      {metrics.map(([label, value]) => (
        <article key={label} className="panel metric-card">
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </div>
  );
}

function CardList({ items }: { items: string[] }) {
  return (
    <div className="metric-grid">
      {items.map((item) => (
        <article key={item} className="panel metric-card">
          <strong>{item}</strong>
          <span>Next active work band</span>
        </article>
      ))}
    </div>
  );
}

export function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/customize" element={<CustomizePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Shell>
  );
}
