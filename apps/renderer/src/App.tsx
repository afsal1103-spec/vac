import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { create } from 'zustand';

type Provider = 'ollama' | 'openrouter' | 'openai' | 'anthropic';

type OnboardingState = {
  userName: string;
  assistantName: string;
  personality: string;
  voice: string;
  provider: Provider;
  setField: <Key extends keyof Omit<OnboardingState, 'setField'>>(key: Key, value: OnboardingState[Key]) => void;
};

const useOnboardingStore = create<OnboardingState>((set) => ({
  userName: '',
  assistantName: 'VAC',
  personality: 'Warm strategist',
  voice: 'Calm studio voice',
  provider: 'ollama',
  setField: (key, value) => set({ [key]: value } as Partial<OnboardingState>)
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
        <div className="system-card">
          <span className="status-dot" />
          Overlay shell ready
        </div>
      </aside>
      <main className="page-frame">{children}</main>
    </div>
  );
}

function OnboardingPage() {
  const profile = useOnboardingStore();
  const progressSteps = ['Profile', 'Assistant', 'Voice', 'Provider', 'Avatar build'];

  return (
    <Page title="Onboarding" kicker="Create the companion before the companion creates magic">
      <section className="split-grid">
        <form className="panel form-stack">
          <label>
            User name
            <input value={profile.userName} onChange={(event) => profile.setField('userName', event.target.value)} placeholder="Afsal" />
          </label>
          <label>
            Assistant name
            <input value={profile.assistantName} onChange={(event) => profile.setField('assistantName', event.target.value)} />
          </label>
          <label>
            Personality preset
            <select value={profile.personality} onChange={(event) => profile.setField('personality', event.target.value)}>
              <option>Warm strategist</option>
              <option>Playful engineer</option>
              <option>Focused operator</option>
              <option>Custom</option>
            </select>
          </label>
          <label>
            Voice selection
            <select value={profile.voice} onChange={(event) => profile.setField('voice', event.target.value)}>
              <option>Calm studio voice</option>
              <option>Bright companion voice</option>
              <option>Deep narrator voice</option>
            </select>
          </label>
          <label>
            Preferred AI provider
            <select value={profile.provider} onChange={(event) => profile.setField('provider', event.target.value as Provider)}>
              <option value="ollama">Ollama</option>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
        </form>
        <div className="panel avatar-preview">
          <div className="avatar-orb">{profile.assistantName.slice(0, 3).toUpperCase()}</div>
          <h2>Ready Player Me build queue</h2>
          <div className="steps">
            {progressSteps.map((step, index) => (
              <span key={step} className={index < 2 ? 'complete' : undefined}>{step}</span>
            ))}
          </div>
          <p>Photo upload, webcam capture, and RPM API handoff land here in the next avatar phase.</p>
        </div>
      </section>
    </Page>
  );
}

function DashboardPage() {
  return (
    <Page title="Dashboard" kicker="Vitals for the whole companion stack">
      <MetricGrid metrics={[['Model', 'Ollama local'], ['Overlay', 'Ready'], ['Latency target', '< 700ms'], ['Memory', 'SQLite pending']]} />
    </Page>
  );
}

function ChatPage() {
  return (
    <Page title="Chat" kicker="Streaming conversation workspace">
      <section className="panel chat-panel">
        <div className="message assistant">I am wired for streaming LLM chunks once Phase 5 lands.</div>
        <div className="message user">Voice and avatar sync will plug into this surface.</div>
        <input aria-label="Chat draft" placeholder="Ask VAC anything..." />
      </section>
    </Page>
  );
}

function ProjectsPage() {
  return (
    <Page title="Projects" kicker="Where VAC tracks work, tools, and artifacts">
      <CardList items={['Desktop app workspace', 'Avatar customization pipeline', 'Voice streaming lab']} />
    </Page>
  );
}

function CustomizePage() {
  return (
    <Page title="Customize" kicker="Personality, roles, and skills editor">
      <CardList items={['Traits and communication style', 'Knowledge domains', 'Role presets', 'Skill permissions']} />
    </Page>
  );
}

function SettingsPage() {
  return (
    <Page title="Settings" kicker="Models, API keys, privacy, and virtual mode">
      <CardList items={['Provider routing', 'Encrypted local API key vault', 'Overlay toggle', 'Offline mode']} />
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
          <span>Phase-ready scaffold</span>
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
