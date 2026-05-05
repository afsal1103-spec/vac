import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConversationSummary, ModelConfig, UserProfile } from './types.js';

export class SyncService {
  constructor(private readonly client: SupabaseClient) {}

  async upsertUserProfile(profile: UserProfile) {
    const result = await this.client.from('profiles').upsert(profile, { onConflict: 'id' });
    if (result.error) throw result.error;
  }

  async upsertModelConfig(config: ModelConfig) {
    const result = await this.client.from('model_configs').upsert(config, { onConflict: 'userId' });
    if (result.error) throw result.error;
  }

  async upsertConversationSummaries(summaries: ConversationSummary[]) {
    if (summaries.length === 0) return;
    const result = await this.client.from('conversation_summaries').upsert(summaries, { onConflict: 'id' });
    if (result.error) throw result.error;
  }

  async listConversationSummaries(userId: string): Promise<ConversationSummary[]> {
    const result = await this.client
      .from('conversation_summaries')
      .select('*')
      .eq('userId', userId)
      .order('updatedAt', { ascending: false })
      .limit(50);

    if (result.error) throw result.error;
    return (result.data ?? []) as ConversationSummary[];
  }
}
