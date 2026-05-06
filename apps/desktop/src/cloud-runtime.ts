import type { AppProfile, StoredConversation } from './runtime.js';
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type CloudAuthStatus = {
  configured: boolean;
  signedIn: boolean;
  userId: string | null;
  email: string | null;
  detail: string;
};

export type CloudAuthResult = {
  status: CloudAuthStatus;
};

type SupabaseAuthPayload = {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
  error?: string;
  error_description?: string;
  msg?: string;
};

export type SyncSnapshot = {
  profile: AppProfile | null;
  conversations: StoredConversation[];
};

export type SyncResult = {
  synced: boolean;
  profileSynced: boolean;
  conversationCount: number;
  detail: string;
};

export type VaultKeyRef = {
  id: string;
  provider: string;
  keyAlias: string;
  createdAt: string;
};

type VaultFileData = {
  refs: VaultKeyRef[];
  secrets: Array<{ id: string; value: string }>;
};

export class CloudRuntime {
  private readonly supabaseUrl = process.env.VAC_SUPABASE_URL ?? '';
  private readonly supabaseAnonKey = process.env.VAC_SUPABASE_ANON_KEY ?? '';
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private userId: string | null = null;
  private email: string | null = null;
  private readonly vaultPath = join(app.getPath('userData'), 'vault', 'keys.json');
  private readonly refs = new Map<string, VaultKeyRef>();
  private readonly secrets = new Map<string, string>();

  constructor() {
    this.loadVault();
  }

  getStatus(): CloudAuthStatus {
    const configured = this.isConfigured();
    return {
      configured,
      signedIn: configured && Boolean(this.accessToken && this.userId),
      userId: this.userId,
      email: this.email,
      detail: configured
        ? this.accessToken
          ? 'Supabase session active'
          : 'Supabase configured, waiting for sign in'
        : 'Set VAC_SUPABASE_URL and VAC_SUPABASE_ANON_KEY to enable cloud sync'
    };
  }

  async signUp(email: string, password: string): Promise<CloudAuthResult> {
    const payload = await this.authRequest('/auth/v1/signup', { email, password });
    this.captureSession(payload, email);
    return { status: this.getStatus() };
  }

  async signIn(email: string, password: string): Promise<CloudAuthResult> {
    const payload = await this.authRequest('/auth/v1/token?grant_type=password', { email, password });
    this.captureSession(payload, email);
    return { status: this.getStatus() };
  }

  async signOut(): Promise<CloudAuthResult> {
    if (this.accessToken) {
      await fetch(`${this.supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: this.authHeaders()
      }).catch(() => undefined);
    }

    this.accessToken = null;
    this.refreshToken = null;
    this.userId = null;
    this.email = null;
    return { status: this.getStatus() };
  }

  listKeyRefs(): VaultKeyRef[] {
    return Array.from(this.refs.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  setKey(provider: string, keyAlias: string, secret: string): { ref: VaultKeyRef } {
    const normalizedProvider = provider.trim().toLowerCase();
    const normalizedAlias = keyAlias.trim();
    const normalizedSecret = secret.trim();
    if (!normalizedProvider || !normalizedAlias || !normalizedSecret) {
      throw new Error('Provider, alias, and secret are required.');
    }

    const id = `${normalizedProvider}_${normalizedAlias}`;
    const createdAt = new Date().toISOString();
    const ref: VaultKeyRef = {
      id,
      provider: normalizedProvider,
      keyAlias: normalizedAlias,
      createdAt
    };

    this.refs.set(id, ref);
    this.secrets.set(id, normalizedSecret);
    this.persistVault();
    return { ref };
  }

  removeKey(id: string): { removed: boolean } {
    const removedRef = this.refs.delete(id);
    const removedSecret = this.secrets.delete(id);
    if (removedRef || removedSecret) {
      this.persistVault();
    }
    return { removed: removedRef || removedSecret };
  }

  resolveProviderSecret(provider: string, keyAlias?: string): string | null {
    const normalizedProvider = provider.trim().toLowerCase();
    const refs = this.listKeyRefs().filter((ref) => ref.provider === normalizedProvider);
    if (refs.length === 0) {
      return null;
    }

    if (keyAlias?.trim()) {
      const target = refs.find((ref) => ref.keyAlias === keyAlias.trim());
      return target ? (this.secrets.get(target.id) ?? null) : null;
    }

    const latest = refs[refs.length - 1];
    return latest ? (this.secrets.get(latest.id) ?? null) : null;
  }

  async syncSnapshot(snapshot: SyncSnapshot): Promise<SyncResult> {
    if (!this.isConfigured()) {
      return {
        synced: false,
        profileSynced: false,
        conversationCount: 0,
        detail: 'Supabase is not configured'
      };
    }

    if (!this.accessToken || !this.userId) {
      return {
        synced: false,
        profileSynced: false,
        conversationCount: 0,
        detail: 'Sign in before syncing'
      };
    }

    let profileSynced = false;
    if (snapshot.profile) {
      await this.tableUpsert('profiles', {
        id: this.userId,
        email: this.email ?? '',
        displayName: snapshot.profile.userName,
        avatarGlbUrl: '',
        personalityId: snapshot.profile.assistantName,
        updatedAt: new Date().toISOString()
      });
      profileSynced = true;
    }

    if (snapshot.conversations.length > 0) {
      await this.tableUpsert(
        'conversation_summaries',
        snapshot.conversations.map((conversation) => ({
          id: conversation.id,
          userId: this.userId,
          summary: conversation.title,
          model: snapshot.profile?.provider ?? 'ollama',
          updatedAt: conversation.createdAt
        }))
      );
    }

    return {
      synced: true,
      profileSynced,
      conversationCount: snapshot.conversations.length,
      detail: 'Profile and conversation summaries synced'
    };
  }

  private async authRequest(path: string, body: Record<string, string>): Promise<SupabaseAuthPayload> {
    this.requireConfigured();
    const response = await fetch(`${this.supabaseUrl}${path}`, {
      method: 'POST',
      headers: {
        apikey: this.supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as SupabaseAuthPayload;
    if (!response.ok) {
      throw new Error(payload.error_description ?? payload.msg ?? payload.error ?? `Supabase auth failed (${response.status})`);
    }
    return payload;
  }

  private async tableUpsert(table: string, body: unknown) {
    this.requireConfigured();
    const response = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase sync failed for ${table}: ${detail || response.status}`);
    }
  }

  private authHeaders(): Record<string, string> {
    return {
      apikey: this.supabaseAnonKey,
      Authorization: `Bearer ${this.accessToken ?? this.supabaseAnonKey}`,
      'Content-Type': 'application/json'
    };
  }

  private captureSession(payload: SupabaseAuthPayload, fallbackEmail: string) {
    this.accessToken = payload.access_token ?? this.accessToken;
    this.refreshToken = payload.refresh_token ?? this.refreshToken;
    this.userId = payload.user?.id ?? this.userId;
    this.email = payload.user?.email ?? fallbackEmail;
  }

  private isConfigured(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey);
  }

  private requireConfigured() {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured. Set VAC_SUPABASE_URL and VAC_SUPABASE_ANON_KEY.');
    }
  }

  private loadVault() {
    if (!existsSync(this.vaultPath)) {
      return;
    }

    const raw = readFileSync(this.vaultPath, 'utf8');
    const parsed = JSON.parse(raw) as VaultFileData;
    for (const ref of parsed.refs ?? []) {
      this.refs.set(ref.id, ref);
    }
    for (const row of parsed.secrets ?? []) {
      this.secrets.set(row.id, this.decodeSecret(row.value));
    }
  }

  private persistVault() {
    mkdirSync(dirname(this.vaultPath), { recursive: true });
    const payload: VaultFileData = {
      refs: this.listKeyRefs(),
      secrets: Array.from(this.secrets.entries()).map(([id, value]) => ({
        id,
        value: this.encodeSecret(value)
      }))
    };
    writeFileSync(this.vaultPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  private encodeSecret(secret: string): string {
    if (safeStorage.isEncryptionAvailable()) {
      return `enc:${safeStorage.encryptString(secret).toString('base64')}`;
    }
    return `plain:${Buffer.from(secret, 'utf8').toString('base64')}`;
  }

  private decodeSecret(raw: string): string {
    if (raw.startsWith('enc:') && safeStorage.isEncryptionAvailable()) {
      const decoded = Buffer.from(raw.slice(4), 'base64');
      return safeStorage.decryptString(decoded);
    }
    if (raw.startsWith('plain:')) {
      return Buffer.from(raw.slice(6), 'base64').toString('utf8');
    }
    return raw;
  }
}
