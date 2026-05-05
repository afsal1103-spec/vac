export type ChangeFile = {
  path: string;
  before: string;
  after: string;
};

export type ChangeProposal = {
  id: string;
  title: string;
  rationale: string;
  createdAt: string;
  files: ChangeFile[];
};

export type SandboxRunResult = {
  proposalId: string;
  passed: boolean;
  output: string;
  ranAt: string;
};

export type ApprovalDecision = {
  proposalId: string;
  approved: boolean;
  approver: string;
  decidedAt: string;
  note?: string;
};

export type ApplyResult = {
  proposalId: string;
  applied: boolean;
  message: string;
};
