# VAC - Virtual Avatar Companion

VAC is a desktop AI companion with a realistic 3D avatar, streaming voice, local-first memory, offline capabilities, and a guarded self-development workflow.

## Phase Status

- [x] Phase 0: Repository and dev environment setup
- [x] Phase 1: Electron shell
- [x] Phase 2: React frontend
- [x] Phase 3: 3D avatar engine
- [x] Phase 4: Real-time voice engine
- [x] Phase 5: AI core and personality engine
- [x] Phase 6: Memory and learning
- [x] Phase 7: Offline capabilities
- [x] Phase 8: Self-development engine
- [x] Phase 9: Auth and backend
- [x] Phase 10: CI/CD and packaging

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

## Delivery Roadmap

- [x] MVP 1: Local onboarding, SQLite profile save, local conversation persistence, Electron IPC chat loop, Ollama-first response path
- [x] MVP 2: Live overlay avatar state connected to active conversation and profile
- [x] MVP 3: Voice capture and playback wired through the desktop runtime
- [x] MVP 4: Supabase auth UI and profile sync connected to the backend package
- [x] MVP 5: Polished settings, vault management, and desktop runtime smoke coverage
- [x] MVP 6: Provider routing runtime controls, health checks, and global themed background image

## Current Verification

Phase 0 is verified by `scripts/verify-phase0.mjs`, which checks the workspace manifest, required directories, package manifests, and CI skeleton.

Phase 1 is verified by `scripts/verify-phase1.mjs` plus the `@vac/desktop` TypeScript build. It checks the Electron main process, strict preload bridge, main window, transparent always-on-top overlay window, click-through idle behavior, and macOS microphone permission request hook.

Phase 2 is verified by `scripts/verify-phase2.mjs` plus the `@vac/renderer` TypeScript and Vite production build. It checks the React router page map, onboarding fields, Ready Player Me handoff scaffold, voice selection, provider selection, and core frontend dependencies.

Phase 3 is verified by `scripts/verify-phase3.mjs` plus the `@vac/avatar-engine` TypeScript build. It checks Three.js scene bootstrap, avatar loading API, viseme map and lip-sync track support, overlay interaction state helper, and Ready Player Me URL builder.

Phase 4 is verified by `scripts/verify-phase4.mjs` plus the `@vac/voice-engine` TypeScript build. It checks streaming voice chunk types, sidecar process bridge, local and cloud adapter contracts, mic-to-STT chunk flow, LLM-to-TTS chunk flow, and session orchestration hooks.

Phase 5 is verified by `scripts/verify-phase5.mjs` plus the `@vac/ai-core` TypeScript build. It checks multi-provider router structure, provider adapters, personality profile and system prompt injection, and self-improvement summarization hooks.

Phase 6 is verified by `scripts/verify-phase6.mjs` plus the `@vac/memory` TypeScript build. It checks SQLite schema coverage, typed store operations, vector similarity search hooks, and retrieval context assembly.

Phase 7 is verified by `scripts/verify-phase7.mjs` plus the `@vac/offline` TypeScript build. It checks map tile estimation and URL planning utilities, user-approved file permission registry, and file agent read/list behavior under grant enforcement.

Phase 8 is verified by `scripts/verify-phase8.mjs` plus the `@vac/self-dev` TypeScript build. It checks proposal creation, vm2-based sandbox execution, approval decision gating, sandbox-only apply flow, and explicit token requirement for production apply hooks.

Phase 9 is verified by `scripts/verify-phase9.mjs` plus the `@vac/backend` TypeScript build. It checks Supabase client configuration, email/password auth service, user profile and conversation summary sync APIs, and local key reference vault behavior.

Phase 10 is verified by `scripts/verify-phase10.mjs`. It checks multi-OS CI coverage, tag/manual release workflow, artifact upload, and the root desktop packaging command that builds the renderer, compiles Electron, and runs electron-builder.

MVP 1 is verified by `scripts/verify-mvp1.mjs` plus the standard build and packaging pipeline. It checks the desktop runtime bridge, profile save/load handlers, local conversation messaging path, and the renderer onboarding/chat screens that consume those APIs.

MVP 2 is verified by `scripts/verify-mvp2.mjs` plus the standard build and packaging pipeline. It checks overlay state channels, thinking/speaking transitions during chat, overlay state subscriptions in preload/renderer, and dashboard visibility of live overlay state.

MVP 3 is verified by `scripts/verify-mvp3.mjs` plus the standard build and packaging pipeline. It checks desktop voice session IPC, mic chunk relay from renderer, voice event subscription loop, and TTS chunk playback wiring in chat.

MVP 4 is verified by `scripts/verify-mvp4.mjs` plus the standard build and packaging pipeline. It checks Supabase environment detection, email/password auth IPC, cloud sync controls in Settings, and profile/conversation summary sync wiring.

MVP 5 is verified by `scripts/verify-mvp5.mjs` plus the standard build and packaging pipeline. It checks Settings runtime visibility metrics, local key vault management controls, desktop vault IPC channels, and encrypted local secret storage hooks.

MVP 6 is verified by `scripts/verify-mvp6.mjs` plus the standard build and packaging pipeline. It checks AI routing config IPC, provider health checks, fallback model configuration in Settings, and app-wide use of the shared background theme image.
