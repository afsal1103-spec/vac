import base64
import io
import json
import math
import os
import struct
import sys
import threading
import time
import wave
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple


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


def pcm16_to_wav_base64(pcm_bytes: bytes, sample_rate: int = 22050) -> str:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def http_post_json(url: str, headers: Dict[str, str], payload: Dict[str, Any], timeout_sec: int = 25) -> Dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url=url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    for key, value in headers.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=timeout_sec) as response:
        body = response.read().decode("utf-8")
    parsed = json.loads(body)
    if not isinstance(parsed, dict):
        raise RuntimeError("JSON response was not an object")
    return parsed


def http_post_binary(url: str, headers: Dict[str, str], body: bytes, timeout_sec: int = 25) -> bytes:
    req = urllib.request.Request(url=url, data=body, method="POST")
    for key, value in headers.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=timeout_sec) as response:
        return response.read()


def multipart_form_data(fields: Dict[str, str], file_field: str, filename: str, content_type: str, file_bytes: bytes) -> Tuple[bytes, str]:
    boundary = f"----vacBoundary{int(time.time() * 1000)}"
    chunks: list[bytes] = []
    for key, value in fields.items():
        chunks.append(f"--{boundary}\r\n".encode("utf-8"))
        chunks.append(f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode("utf-8"))
        chunks.append(value.encode("utf-8"))
        chunks.append(b"\r\n")

    chunks.append(f"--{boundary}\r\n".encode("utf-8"))
    chunks.append(
        f'Content-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\n'.encode("utf-8")
    )
    chunks.append(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    chunks.append(file_bytes)
    chunks.append(b"\r\n")
    chunks.append(f"--{boundary}--\r\n".encode("utf-8"))
    body = b"".join(chunks)
    return body, boundary


def transcribe_with_openai(audio_bytes: bytes, language: str) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.getenv("OPENAI_STT_MODEL", "gpt-4o-mini-transcribe").strip() or "gpt-4o-mini-transcribe"
    fields = {"model": model}
    if language:
        fields["language"] = language
    body, boundary = multipart_form_data(
        fields=fields,
        file_field="file",
        filename="chunk.webm",
        content_type="audio/webm",
        file_bytes=audio_bytes,
    )
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    req = urllib.request.Request(url="https://api.openai.com/v1/audio/transcriptions", data=body, method="POST")
    for key, value in headers.items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=35) as response:
        parsed = json.loads(response.read().decode("utf-8"))
    text = str(parsed.get("text", "")).strip() if isinstance(parsed, dict) else ""
    return text or None


def transcribe_with_deepgram(audio_bytes: bytes, language: str) -> Optional[str]:
    api_key = os.getenv("DEEPGRAM_API_KEY", "").strip()
    if not api_key:
        return None
    query = "model=nova-2&smart_format=true"
    if language:
        query += f"&language={urllib.parse.quote(language)}"
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "audio/webm",
    }
    raw = http_post_binary(f"https://api.deepgram.com/v1/listen?{query}", headers, audio_bytes, timeout_sec=30)
    parsed = json.loads(raw.decode("utf-8"))
    if not isinstance(parsed, dict):
        return None
    results = parsed.get("results", {})
    channels = results.get("channels", []) if isinstance(results, dict) else []
    if not channels:
        return None
    channel0 = channels[0] if isinstance(channels[0], dict) else {}
    alternatives = channel0.get("alternatives", []) if isinstance(channel0, dict) else []
    if not alternatives:
        return None
    alt0 = alternatives[0] if isinstance(alternatives[0], dict) else {}
    transcript = str(alt0.get("transcript", "")).strip()
    return transcript or None


def synthesize_with_openai(text: str, voice_id: str) -> Optional[str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.getenv("OPENAI_TTS_MODEL", "gpt-4o-mini-tts").strip() or "gpt-4o-mini-tts"
    payload = {
        "model": model,
        "voice": voice_id or "alloy",
        "input": text,
        "format": "wav",
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    raw = http_post_binary(
        "https://api.openai.com/v1/audio/speech",
        {**headers, "Content-Type": "application/json"},
        json.dumps(payload).encode("utf-8"),
        timeout_sec=35,
    )
    return base64.b64encode(raw).decode("utf-8")


def synthesize_with_elevenlabs(text: str, voice_id: str) -> Optional[str]:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        return None
    chosen_voice = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
    model_id = os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    output_format = os.getenv("ELEVENLABS_OUTPUT_FORMAT", "pcm_22050")
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{urllib.parse.quote(chosen_voice)}?output_format={urllib.parse.quote(output_format)}"
    payload = {
        "text": text,
        "model_id": model_id,
    }
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/octet-stream",
    }
    raw = http_post_binary(url, headers, json.dumps(payload).encode("utf-8"), timeout_sec=35)
    if output_format.startswith("pcm_"):
        try:
            sample_rate = int(output_format.split("_")[1])
        except (IndexError, ValueError):
            sample_rate = 22050
        return pcm16_to_wav_base64(raw, sample_rate=sample_rate)
    return base64.b64encode(raw).decode("utf-8")


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

    def get_config(self, session_id: str) -> Dict[str, Any]:
        with self._lock:
            session = self._sessions.get(session_id, {})
            config = session.get("config", {}) if isinstance(session, dict) else {}
            return config if isinstance(config, dict) else {}


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
        session_config = store.get_config(session_id)
        audio_b64 = str(payload.get("audioBase64", "")).strip()
        if not audio_b64:
            return
        language = str(payload.get("language", "")).strip() or str(session_config.get("language", "en")).strip()
        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception:
            emit({"type": "error", "sessionId": session_id, "message": "Invalid base64 audio payload"})
            return

        text: Optional[str] = None
        errors: list[str] = []
        for fn in (transcribe_with_deepgram, transcribe_with_openai):
            try:
                text = fn(audio_bytes, language)
            except urllib.error.HTTPError as exc:
                errors.append(f"{fn.__name__}: HTTP {exc.code}")
            except Exception as exc:
                errors.append(f"{fn.__name__}: {exc}")
            if text:
                break

        if not text:
            text = f"[sidecar-stt {len(audio_b64)} bytes]"
            if errors:
                emit({"type": "status", "sessionId": session_id, "message": "Cloud STT unavailable, using synthetic fallback."})

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
        session_config = store.get_config(session_id)
        text = str(payload.get("text", "")).strip()
        is_final = bool(payload.get("isFinal", False))
        voice_id = str(payload.get("voiceId", "")).strip() or str(session_config.get("voiceId", "")).strip()
        if not text:
            return
        emit({"type": "llm_chunk", "sessionId": session_id, "chunk": {"text": text, "isFinal": is_final}})

        wav_b64: Optional[str] = None
        errors: list[str] = []
        for fn in (synthesize_with_elevenlabs, synthesize_with_openai):
            try:
                wav_b64 = fn(text, voice_id)
            except urllib.error.HTTPError as exc:
                errors.append(f"{fn.__name__}: HTTP {exc.code}")
            except Exception as exc:
                errors.append(f"{fn.__name__}: {exc}")
            if wav_b64:
                break

        if not wav_b64:
            wav_b64 = build_sine_wav_base64(min(1.3, max(0.2, len(text) / 90.0)))
            if errors:
                emit({"type": "status", "sessionId": session_id, "message": "Cloud TTS unavailable, using synthetic fallback."})

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
