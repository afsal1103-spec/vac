# VAC - Virtual Avatar Companion

VAC is a desktop AI companion with a realistic 3D avatar, streaming voice, local-first memory, offline capabilities, and a guarded self-development workflow.

## Phase Status

- [x] Phase 0: Repository and dev environment setup
- [ ] Phase 1: Electron shell
- [ ] Phase 2: React frontend
- [ ] Phase 3: 3D avatar engine
- [ ] Phase 4: Real-time voice engine
- [ ] Phase 5: AI core and personality engine
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
