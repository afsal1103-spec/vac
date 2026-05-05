export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  avatarGlbUrl: string;
  personalityId: string;
  updatedAt: string;
};

export type ConversationSummary = {
  id: string;
  userId: string;
  summary: string;
  model: string;
  updatedAt: string;
};

export type ModelConfig = {
  userId: string;
  provider: 'ollama' | 'openai' | 'anthropic' | 'openrouter';
  model: string;
  temperature: number;
  updatedAt: string;
};

export type VaultKeyRef = {
  id: string;
  provider: string;
  keyAlias: string;
  createdAt: string;
};

export type BackendConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};
