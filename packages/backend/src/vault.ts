import type { VaultKeyRef } from './types.js';

export class LocalKeyVault {
  private refs = new Map<string, VaultKeyRef>();
  private secrets = new Map<string, string>();

  setKey(provider: string, keyAlias: string, secret: string): VaultKeyRef {
    const id = `${provider}_${keyAlias}`;
    const ref: VaultKeyRef = {
      id,
      provider,
      keyAlias,
      createdAt: new Date().toISOString()
    };

    this.refs.set(id, ref);
    this.secrets.set(id, secret);
    return ref;
  }

  getReference(id: string): VaultKeyRef | undefined {
    return this.refs.get(id);
  }

  getSecret(id: string): string | undefined {
    return this.secrets.get(id);
  }

  remove(id: string) {
    this.refs.delete(id);
    this.secrets.delete(id);
  }
}
