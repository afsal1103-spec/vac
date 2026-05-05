import type { ApprovalDecision } from './types.js';

export class ApprovalGate {
  private decisions = new Map<string, ApprovalDecision>();

  recordDecision(decision: ApprovalDecision) {
    this.decisions.set(decision.proposalId, decision);
  }

  requireApproved(proposalId: string) {
    const decision = this.decisions.get(proposalId);
    if (!decision || !decision.approved) {
      throw new Error(`Proposal ${proposalId} is not approved for deployment.`);
    }
  }

  getDecision(proposalId: string): ApprovalDecision | undefined {
    return this.decisions.get(proposalId);
  }
}
