import { Router, type IRouter } from "express";

import fs from "fs";
import path from "path";

const router: IRouter = Router();
const ttsModels = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash-preview-tts"];

function getApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try {
    const envPaths = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "../../.env"),
    ];
    for (const p of envPaths) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        const m = content.match(/GEMINI_API_KEY\s*=\s*(.+)/);
        if (m) return m[1].trim();
      }
    }
  } catch {}
  return undefined;
}

type GeminiAudioResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  }>;
};

function pcm16ToWav(pcm: Buffer, sampleRate = 24_000, channels = 1): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

router.post("/tts", async (req, res): Promise<void> => {
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!text || text.length > 2000) {
    res.status(400).json({ error: "Text must be between 1 and 2000 characters." });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    req.log.error("Gemini TTS is not configured");
    res.status(503).json({ error: "Text-to-speech is not configured." });
    return;
  }

  let lastStatus = 502;
  for (const model of ttsModels) {
    const endpoint = new URL(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    );
    endpoint.searchParams.set("key", apiKey);

    try {
      const providerResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Read aloud: ${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Kore" },
              },
            },
          },
        }),
      });

      if (!providerResponse.ok) {
        lastStatus = providerResponse.status;
        req.log.warn(
          { model, statusCode: providerResponse.status },
          "Gemini TTS model failed, trying next",
        );
        continue;
      }

      const payload = (await providerResponse.json()) as GeminiAudioResponse;
      const inlineData = payload.candidates?.[0]?.content?.parts?.find(
        (part) => part.inlineData?.data,
      )?.inlineData;

      if (!inlineData?.data) {
        req.log.warn({ model }, "Gemini TTS returned no audio, trying next");
        continue;
      }

      const pcm = Buffer.from(inlineData.data, "base64");
      const wav = pcm16ToWav(pcm);
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Cache-Control", "no-store");
      res.send(wav);
      return;
    } catch (error) {
      req.log.warn({ model, err: error }, "Gemini TTS model error, trying next");
    }
  }

  req.log.error({ lastStatus }, "All Gemini TTS models exhausted");
  res.status(lastStatus === 429 ? 429 : 502).json({ error: "Text-to-speech provider failed or rate limited." });
});

export default router;