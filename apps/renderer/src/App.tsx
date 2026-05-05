import { useEffect, useState, useTransition } from 'react';
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

  useEffect(() => {
    window.vac.shell.getStatus().then(setShellStatus).catch(() => {
      setShellStatus(null);
    });
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
            {shellStatus?.overlayReady ? 'Overlay online' : 'Overlay booting'}
          </div>
          <div className="system-card muted">
            {shellStatus ? `${shellStatus.appName} ${shellStatus.version}` : 'Desktop bridge offline'}
          </div>
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

  useEffect(() => {
    window.vac.profile.load().then(setProfile);
    window.vac.chat.listConversations().then(setConversations);
  }, []);

  return (
    <Page title="Dashboard" kicker="The first real runtime pulse">
      <MetricGrid
        metrics={[
          ['Provider', profile?.provider ?? 'Not configured'],
          ['Assistant', profile?.assistantName ?? 'Waiting'],
          ['Conversations', String(conversations.length)],
          ['Persistence', profile ? 'SQLite live' : 'Pending']
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
  const [isPending, startTransition] = useTransition();

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

    startTransition(() => {
      window.vac.chat
        .sendMessage({ conversationId: activeConversationId ?? undefined, content })
        .then((result) => {
          setActiveConversationId(result.conversationId);
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
            </div>
          </div>
          <div className="chat-transcript">
            {messages.length === 0 ? (
              <p className="inline-note">Start a conversation. If Ollama is not running, the app will tell you plainly.</p>
            ) : (
              messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}>
                  {message.content}
                </div>
              ))
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
  return (
    <Page title="Settings" kicker="Provider and runtime visibility">
      <CardList items={['Ollama connectivity is checked at send time', 'Supabase sync remains available for a later slice', 'Packaging is already verified']} />
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
