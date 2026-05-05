import type { PersonalityProfile } from './types.js';

type ImprovementLog = {
  timestampIso: string;
  repeatedQuestions: string[];
  failedTasks: string[];
  userCorrections: string[];
};

export type ImprovementSummary = {
  gaps: string[];
  suggestedTraitAdjustments: string[];
  suggestedKnowledgeDomains: string[];
};

export function summarizeImprovements(log: ImprovementLog): ImprovementSummary {
  const gaps: string[] = [];

  if (log.repeatedQuestions.length > 0) gaps.push('Repeated questions indicate missing stable memory context.');
  if (log.failedTasks.length > 0) gaps.push('Failed tasks indicate tool or planning weakness.');
  if (log.userCorrections.length > 0) gaps.push('Frequent corrections indicate response quality drift.');

  return {
    gaps,
    suggestedTraitAdjustments: [
      'Increase explicit confirmation when requirement ambiguity is detected',
      'Tighten execution summaries after each implementation step'
    ],
    suggestedKnowledgeDomains: ['project context retention', 'tool error diagnosis']
  };
}

export function applyImprovementSummary(
  profile: PersonalityProfile,
  summary: ImprovementSummary
): PersonalityProfile {
  return {
    ...profile,
    traits: Array.from(new Set([...profile.traits, 'self-reflective'])),
    knowledgeDomains: Array.from(new Set([...profile.knowledgeDomains, ...summary.suggestedKnowledgeDomains]))
  };
}
