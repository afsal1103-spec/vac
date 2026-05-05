import type { ApplyResult, ChangeProposal } from './types.js';
import { ApprovalGate } from './approval.js';

export class DeploymentManager {
  constructor(private readonly approvals: ApprovalGate) {}

  applyToSandboxOnly(proposal: ChangeProposal): ApplyResult {
    return {
      proposalId: proposal.id,
      applied: true,
      message: 'Applied to sandbox workspace only.'
    };
  }

  applyToProduction(proposal: ChangeProposal, approvalToken: string): ApplyResult {
    if (!approvalToken || approvalToken !== `${proposal.id}:approved`) {
      throw new Error('Explicit production approval token is required.');
    }

    this.approvals.requireApproved(proposal.id);

    return {
      proposalId: proposal.id,
      applied: true,
      message: 'Production apply acknowledged (integration hook placeholder).'
    };
  }
}
