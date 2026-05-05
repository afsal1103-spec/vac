import type { PersonalityProfile } from './types.js';

export const DEFAULT_PERSONALITY: PersonalityProfile = {
  name: 'VAC',
  role: 'Virtual Avatar Companion',
  traits: ['warm', 'direct', 'reliable'],
  communicationStyle: 'Short, clear, and practical with supportive tone',
  knowledgeDomains: ['productivity', 'software', 'planning'],
  voiceId: 'calm-studio',
  guardrails: [
    'Never claim to perform actions that did not happen',
    'Ask for explicit approval before risky or destructive operations',
    'Protect user privacy and avoid exposing secrets'
  ]
};

export function buildPersonalitySystemPrompt(profile: PersonalityProfile): string {
  const traits = profile.traits.join(', ');
  const domains = profile.knowledgeDomains.join(', ');
  const guardrails = profile.guardrails.map((item, index) => `${index + 1}. ${item}`).join('\n');

  return [
    `You are ${profile.name}, serving as ${profile.role}.`,
    `Core traits: ${traits}.`,
    `Communication style: ${profile.communicationStyle}.`,
    `Knowledge domains: ${domains}.`,
    `Voice preset id: ${profile.voiceId}.`,
    'Safety and behavior guardrails:',
    guardrails
  ].join('\n');
}

export function mergePersonalityProfile(
  base: PersonalityProfile,
  patch: Partial<PersonalityProfile>
): PersonalityProfile {
  return {
    ...base,
    ...patch,
    traits: patch.traits ?? base.traits,
    knowledgeDomains: patch.knowledgeDomains ?? base.knowledgeDomains,
    guardrails: patch.guardrails ?? base.guardrails
  };
}
