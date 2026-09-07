import { Router, type IRouter } from "express";

const router: IRouter = Router();
const geminiTtsModel = "gemini-2.5-flash-preview-tts";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    req.log.error("Gemini TTS is not configured");
    res.status(503).json({ error: "Text-to-speech is not configured." });
    return;
  }

  const endpoint = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiTtsModel}:generateContent`,
  );
  endpoint.searchParams.set("key", apiKey);

  try {
    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
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
      req.log.error(
        { statusCode: providerResponse.status },
        "Gemini TTS provider request failed",
      );
      res.status(502).json({ error: "Text-to-speech provider failed." });
      return;
    }

    const payload = (await providerResponse.json()) as GeminiAudioResponse;
    const inlineData = payload.candidates?.[0]?.content?.parts?.find(
      (part) => part.inlineData?.data,
    )?.inlineData;

    if (!inlineData?.data) {
      req.log.error("Gemini TTS returned no audio");
      res.status(502).json({ error: "Text-to-speech returned no audio." });
      return;
    }

    const pcm = Buffer.from(inlineData.data, "base64");
    const wav = pcm16ToWav(pcm);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Cache-Control", "no-store");
    res.send(wav);
  } catch (error) {
    req.log.error({ err: error }, "Gemini TTS request crashed");
    res.status(502).json({ error: "Text-to-speech provider failed." });
  }
});

export default router;