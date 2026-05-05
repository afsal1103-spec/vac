import type { ChangeProposal } from './types.js';

export function createProposal(input: {
  title: string;
  rationale: string;
  files: ChangeProposal['files'];
}): ChangeProposal {
  if (input.files.length === 0) {
    throw new Error('Proposal must include at least one file change.');
  }

  return {
    id: `proposal_${Date.now()}`,
    title: input.title,
    rationale: input.rationale,
    createdAt: new Date().toISOString(),
    files: input.files
  };
}

export function summarizeProposal(proposal: ChangeProposal): string {
  const header = `${proposal.title} (${proposal.files.length} files)`;
  const files = proposal.files.map((file) => `- ${file.path}`).join('\n');
  return `${header}\n${proposal.rationale}\n${files}`;
}
