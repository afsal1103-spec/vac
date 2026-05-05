# VAC - Virtual Avatar Companion

VAC is a desktop AI companion with a realistic 3D avatar, streaming voice, local-first memory, offline capabilities, and a guarded self-development workflow.

## Phase Status

- [x] Phase 0: Repository and dev environment setup
- [x] Phase 1: Electron shell
- [x] Phase 2: React frontend
- [x] Phase 3: 3D avatar engine
- [x] Phase 4: Real-time voice engine
- [x] Phase 5: AI core and personality engine
- [ ] Phase 6: Memory and learning
- [ ] Phase 7: Offline capabilities
- [ ] Phase 8: Self-development engine
- [ ] Phase 9: Auth and backend
- [ ] Phase 10: CI/CD and packaging

## Workspace Layout

```text
apps/
  desktop/          Electron shell
  renderer/         React frontend
packages/
  ai-core/          Provider router and personality engine
  avatar-engine/    Three.js and Ready Player Me integration
  voice-engine/     STT and TTS pipeline
  memory/           SQLite and vector memory
  offline/          Maps and file access
  self-dev/         Code generation and sandbox workflow
scripts/            Dev tooling and verification
.github/workflows/  CI
```

## Getting Started

```bash
pnpm install
pnpm test
```

## Current Verification

Phase 0 is verified by `scripts/verify-phase0.mjs`, which checks the workspace manifest, required directories, package manifests, and CI skeleton.

Phase 1 is verified by `scripts/verify-phase1.mjs` plus the `@vac/desktop` TypeScript build. It checks the Electron main process, strict preload bridge, main window, transparent always-on-top overlay window, click-through idle behavior, and macOS microphone permission request hook.

Phase 2 is verified by `scripts/verify-phase2.mjs` plus the `@vac/renderer` TypeScript and Vite production build. It checks the React router page map, onboarding fields, Ready Player Me handoff scaffold, voice selection, provider selection, and core frontend dependencies.

Phase 3 is verified by `scripts/verify-phase3.mjs` plus the `@vac/avatar-engine` TypeScript build. It checks Three.js scene bootstrap, avatar loading API, viseme map and lip-sync track support, overlay interaction state helper, and Ready Player Me URL builder.

Phase 4 is verified by `scripts/verify-phase4.mjs` plus the `@vac/voice-engine` TypeScript build. It checks streaming voice chunk types, sidecar process bridge, local and cloud adapter contracts, mic-to-STT chunk flow, LLM-to-TTS chunk flow, and session orchestration hooks.

Phase 5 is verified by `scripts/verify-phase5.mjs` plus the `@vac/ai-core` TypeScript build. It checks multi-provider router structure, provider adapters, personality profile and system prompt injection, and self-improvement summarization hooks.
