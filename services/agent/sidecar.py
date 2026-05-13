import base64
import io
import json
import math
import struct
import sys
import threading
import time
import wave
from typing import Any, Dict


def emit(message: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def build_sine_wav_base64(duration_sec: float, sample_rate: int = 22050, freq_hz: float = 220.0) -> str:
    frames = max(1, int(duration_sec * sample_rate))
    pcm = bytearray()
    for i in range(frames):
        sample = int(math.sin(2.0 * math.pi * freq_hz * i / sample_rate) * 32767 * 0.18)
        pcm += struct.pack("<h", sample)

    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(bytes(pcm))
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


class SessionStore:
    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def start(self, session_id: str, config: Dict[str, Any]) -> None:
        with self._lock:
            self._sessions[session_id] = {"config": config, "created_at": time.time()}

    def stop(self, session_id: str) -> None:
        with self._lock:
            self._sessions.pop(session_id, None)

    def has(self, session_id: str) -> bool:
        with self._lock:
            return session_id in self._sessions


def handle_message(store: SessionStore, payload: Dict[str, Any]) -> None:
    msg_type = str(payload.get("type", "")).strip()
    session_id = str(payload.get("sessionId", "")).strip()

    if msg_type == "health_ping":
        emit({"type": "health_pong", "ok": True, "ts": time.time()})
        return

    if msg_type == "session_start":
        config = payload.get("config", {})
        if not session_id:
            emit({"type": "error", "message": "session_start missing sessionId"})
            return
        store.start(session_id, config if isinstance(config, dict) else {})
        emit({"type": "status", "sessionId": session_id, "message": "Python sidecar session started"})
        return

    if msg_type == "session_stop":
        if session_id:
            store.stop(session_id)
            emit({"type": "status", "sessionId": session_id, "message": "Python sidecar session stopped"})
        return

    if msg_type == "push_mic":
        if not store.has(session_id):
            emit({"type": "error", "sessionId": session_id, "message": "Unknown session for push_mic"})
            return
        audio_b64 = str(payload.get("audioBase64", "")).strip()
        if not audio_b64:
            return
        text = f"[sidecar-stt {len(audio_b64)} bytes]"
        emit(
            {
                "type": "stt_chunk",
                "sessionId": session_id,
                "chunk": {
                    "text": text,
                    "startMs": 0,
                    "endMs": 220,
                    "confidence": 0.92,
                    "isFinal": False,
                },
            }
        )
        return

    if msg_type == "speak_text":
        if not store.has(session_id):
            emit({"type": "error", "sessionId": session_id, "message": "Unknown session for speak_text"})
            return
        text = str(payload.get("text", "")).strip()
        is_final = bool(payload.get("isFinal", False))
        if not text:
            return
        emit({"type": "llm_chunk", "sessionId": session_id, "chunk": {"text": text, "isFinal": is_final}})
        wav_b64 = build_sine_wav_base64(min(1.3, max(0.2, len(text) / 90.0)))
        emit(
            {
                "type": "tts_chunk",
                "sessionId": session_id,
                "chunk": {
                    "audioBase64": wav_b64,
                    "sampleRate": 22050,
                    "format": "wav",
                    "text": text,
                    "isFinal": is_final,
                },
            }
        )
        return

    emit({"type": "error", "sessionId": session_id or None, "message": f"Unsupported sidecar message: {msg_type}"})


def main() -> None:
    store = SessionStore()
    emit({"type": "status", "message": "Python voice sidecar booted"})
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            emit({"type": "error", "message": "Invalid JSON payload"})
            continue
        if not isinstance(payload, dict):
            emit({"type": "error", "message": "Payload must be a JSON object"})
            continue
        try:
            handle_message(store, payload)
        except Exception as exc:
            emit({"type": "error", "message": f"Sidecar handler failure: {exc}"})


if __name__ == "__main__":
    main()
