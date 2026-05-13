import asyncio
from livekit.agents import AgentContext, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import openai, deepgram, cartesia

async def entrypoint(ctx: JobContext):
    # Initializing the voice assistant with a pipeline:
    # STT: Deepgram, LLM: OpenAI, TTS: Cartesia (high quality)
    assistant = VoiceAssistant(
        vad=openai.VAD(),
        stt=deepgram.STT(),
        llm=openai.LLM(),
        tts=cartesia.TTS(),
    )

    await ctx.connect()
    assistant.start(ctx.room)
    
    # This is where the "Brain" logic connects. 
    # We will later extend this to call the specific tool execution safety logic.
    await assistant.say("Hello! I am your virtual assistant. How can I help you today?")

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
