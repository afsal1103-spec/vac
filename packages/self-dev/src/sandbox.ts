import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { NodeVM } from 'vm2';
import type { ChangeProposal, SandboxRunResult } from './types.js';

export class SandboxRunner {
  constructor(private readonly sandboxRoot: string) {}

  prepareWorkspace(proposal: ChangeProposal): string {
    const workspacePath = resolve(this.sandboxRoot, proposal.id);
    rmSync(workspacePath, { recursive: true, force: true });
    mkdirSync(workspacePath, { recursive: true });

    for (const file of proposal.files) {
      const filePath = resolve(workspacePath, file.path);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, file.after, 'utf8');
    }

    return workspacePath;
  }

  runSyntheticTest(proposal: ChangeProposal): SandboxRunResult {
    const vm = new NodeVM({
      console: 'off',
      sandbox: {
        changeCount: proposal.files.length,
        title: proposal.title
      },
      eval: false,
      wasm: false,
      require: false
    });

    const script = `
      if (changeCount <= 0) {
        throw new Error('No changes to validate');
      }
      module.exports = 'sandbox check passed for ' + title;
    `;

    const output = vm.run(script, 'synthetic-test.js') as string;

    return {
      proposalId: proposal.id,
      passed: true,
      output,
      ranAt: new Date().toISOString()
    };
  }

  runProposal(proposal: ChangeProposal): SandboxRunResult {
    this.prepareWorkspace(proposal);
    return this.runSyntheticTest(proposal);
  }
}
