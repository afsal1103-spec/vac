import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DirectoryGrant, FileSummary } from './types.js';

export class FilePermissionRegistry {
  private grants = new Map<string, DirectoryGrant>();

  grant(directoryPath: string, reason: string): DirectoryGrant {
    const normalizedPath = resolve(directoryPath);
    const id = `grant_${this.grants.size + 1}`;
    const grant: DirectoryGrant = {
      id,
      path: normalizedPath,
      reason,
      grantedAt: new Date().toISOString()
    };

    this.grants.set(id, grant);
    return grant;
  }

  upsertGrant(grant: DirectoryGrant): DirectoryGrant {
    const normalized: DirectoryGrant = {
      ...grant,
      path: resolve(grant.path)
    };
    this.grants.set(normalized.id, normalized);
    return normalized;
  }

  revoke(grantId: string): boolean {
    return this.grants.delete(grantId);
  }

  list(): DirectoryGrant[] {
    return Array.from(this.grants.values());
  }

  assertPathAllowed(targetPath: string) {
    const normalizedTarget = resolve(targetPath);
    const allowed = Array.from(this.grants.values()).some((grant) =>
      normalizedTarget.startsWith(grant.path)
    );

    if (!allowed) {
      throw new Error(`Path is not approved by user grant: ${normalizedTarget}`);
    }
  }
}

export class FileAgent {
  constructor(private readonly permissions: FilePermissionRegistry) {}

  summarizeFile(filePath: string, maxChars = 300): FileSummary {
    this.permissions.assertPathAllowed(filePath);
    const stats = statSync(filePath);
    const content = readFileSync(filePath, 'utf8');

    return {
      path: resolve(filePath),
      sizeBytes: stats.size,
      lastModifiedIso: stats.mtime.toISOString(),
      excerpt: content.slice(0, maxChars)
    };
  }

  listFiles(directoryPath: string): string[] {
    this.permissions.assertPathAllowed(directoryPath);
    return readdirSync(directoryPath).map((name) => join(resolve(directoryPath), name));
  }
}
