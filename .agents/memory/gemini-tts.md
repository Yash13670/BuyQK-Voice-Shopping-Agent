---
name: Gemini voice output
description: Why BuyQK uses direct Gemini TTS and how its audio format is handled.
---

BuyQK's production voice replies use the direct Gemini TTS API through the server when managed Replit AI setup is unavailable. The API returns raw PCM audio rather than a browser-ready audio container, so the server must add a WAV header before returning the audio to the web client.

**Why:** The managed Gemini integration available in this workspace does not expose audio output, while browser playback cannot reliably consume the provider's raw PCM response.

**How to apply:** Keep the Gemini API key server-side, return browser-playable WAV audio, and preserve browser speech synthesis as a fallback when provider or autoplay requests fail.