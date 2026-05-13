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
- [x] MVP 7: Real OpenAI/Anthropic/OpenRouter execution with vault-backed key alias routing
- [x] MVP 8: Live chat chunk streaming and incremental voice playback handoff
- [x] MVP 9: Retrieval memory context injection, summary compaction, and scored relevance visibility
- [x] MVP 10: Offline file-agent grants, local file search, and chat file-context injection
- [x] MVP 11: Self-improvement telemetry loop, adaptive personality patching, and scheduler controls
- [x] MVP 12: Self-dev task execution loop with approval gate, sandbox run, and deploy actions
- [x] MVP 13: Persistent self-dev history, secure expiring approval tokens, and reject workflow
- [x] MVP 14: Voice coordinator retries, provider fallback, and quality/noise pipeline hardening
- [x] MVP 15: Python voice sidecar process integration with health checks and runtime fallback migration
- [x] MVP 16: Real cloud sidecar STT/TTS provider calls with synthetic fallback continuity

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

MVP 7 is verified by `scripts/verify-mvp7.mjs` plus the standard build and packaging pipeline. It checks real OpenAI/Anthropic/OpenRouter endpoint adapters, credential-aware completion options, vault secret resolution for provider calls, and Settings key-alias mapping for AI routing.

MVP 8 is verified by `scripts/verify-mvp8.mjs` plus the standard build and packaging pipeline. It checks desktop chat stream chunk emission, renderer stream subscriptions, live transcript rendering in Chat, and incremental sentence-based voice handoff.

MVP 9 is verified by `scripts/verify-mvp9.mjs` plus the standard build and packaging pipeline. It checks runtime memory retrieval context assembly, summary compaction storage, memory relevance score exposure through IPC, and chat memory-hit visibility in the renderer.

MVP 10 is verified by `scripts/verify-mvp10.mjs` plus the standard build and packaging pipeline. It checks offline directory grant persistence, desktop file-agent IPC for list/search/summarize, renderer grant and file-context controls, and runtime injection of user-approved local file context into chat prompts.

MVP 11 is verified by `scripts/verify-mvp11.mjs` plus the standard build and packaging pipeline. It checks runtime telemetry capture for repeated questions/corrections/failures, self-improvement run persistence, desktop scheduler IPC controls, preload/renderer bridge APIs, and Settings controls for run-now, pause/resume, interval, and run history.

MVP 12 is verified by `scripts/verify-mvp12.mjs` plus the standard build and packaging pipeline. It checks desktop self-dev engine orchestration, IPC endpoints for propose/approve/sandbox/deploy, preload and renderer bridge coverage, Projects page workflow controls, and workspace dependency wiring for `@vac/self-dev`.

MVP 13 is verified by `scripts/verify-mvp13.mjs` plus the standard build and packaging pipeline. It checks persisted self-dev state across app restarts, expiring one-time production token handling, reject-task IPC flow, preload/renderer type coverage for new task metadata, and upgraded Projects controls for filtering and safer approval handling.

MVP 14 is verified by `scripts/verify-mvp14.mjs` plus the standard build and packaging pipeline. It checks enhanced voice pipeline config controls (quality profile, retry and fallback settings), STT/TTS preprocessing hooks, coordinator retry and provider-switch logic, desktop runtime integration with the shared voice coordinator, and desktop dependency wiring for `@vac/voice-engine`.

MVP 15 is verified by `scripts/verify-mvp15.mjs` plus the standard build and packaging pipeline. It checks Python sidecar protocol implementation, desktop sidecar supervision and health ping/pong handling, streamed STT/TTS event routing back to renderer, migration from sidecar sessions to coordinator fallback on failures, and expanded voice-session config options in preload/renderer type bridges.

MVP 16 is verified by `scripts/verify-mvp16.mjs` plus the standard build and packaging pipeline. It checks real cloud-capable sidecar STT/TTS paths (Deepgram/OpenAI and ElevenLabs/OpenAI), per-session language and voice propagation from desktop runtime, and synthetic continuity fallback messaging when cloud services are unavailable.
