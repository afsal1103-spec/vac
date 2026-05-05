import type { SupabaseClient } from '@supabase/supabase-js';

export class AuthService {
  constructor(private readonly client: SupabaseClient) {}

  async signUp(email: string, password: string) {
    const result = await this.client.auth.signUp({ email, password });
    if (result.error) throw result.error;
    return result.data;
  }

  async signIn(email: string, password: string) {
    const result = await this.client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    return result.data;
  }

  async signOut() {
    const result = await this.client.auth.signOut();
    if (result.error) throw result.error;
  }

  async currentUserId(): Promise<string | null> {
    const result = await this.client.auth.getUser();
    if (result.error) throw result.error;
    return result.data.user?.id ?? null;
  }
}
