import { ApprovalGate } from './approval.js';
import { DeploymentManager } from './deploy.js';
import { createProposal } from './proposal.js';
import { SandboxRunner } from './sandbox.js';
import type { ApprovalDecision, ChangeProposal, SandboxRunResult } from './types.js';

export class SelfDevEngine {
  private readonly approvals = new ApprovalGate();
  private readonly deployment = new DeploymentManager(this.approvals);
  private readonly sandbox: SandboxRunner;

  constructor(sandboxRoot: string) {
    this.sandbox = new SandboxRunner(sandboxRoot);
  }

  propose(input: { title: string; rationale: string; files: ChangeProposal['files'] }): ChangeProposal {
    return createProposal(input);
  }

  testInSandbox(proposal: ChangeProposal): SandboxRunResult {
    return this.sandbox.runProposal(proposal);
  }

  recordApproval(decision: ApprovalDecision) {
    this.approvals.recordDecision(decision);
  }

  deployToSandbox(proposal: ChangeProposal) {
    return this.deployment.applyToSandboxOnly(proposal);
  }

  deployToProduction(proposal: ChangeProposal, approvalToken: string) {
    return this.deployment.applyToProduction(proposal, approvalToken);
  }
}
