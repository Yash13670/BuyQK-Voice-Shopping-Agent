import fs from 'fs';
import path from 'path';

// Parse .env
const envPath = path.resolve('.env');
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found!");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const match = envContent.match(/GEMINI_API_KEY\s*=\s*(.+)/);
if (!match) {
  console.error("❌ GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const apiKey = match[1].trim();
const masked = apiKey.substring(0, 8) + '...' + apiKey.slice(-4);
console.log(`\n🔑 Found Gemini API Key: ${masked}`);

async function verify() {
  // 1. Check API Key validity & Model access
  console.log('\n--- 1. Testing API Key & Model Listing ---');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (!res.ok) {
      console.error('❌ Failed:', data);
      return;
    }
    console.log(`✅ API Key Valid! Access to ${data.models?.length || 0} models.`);
  } catch (err) {
    console.error('❌ Network error:', err.message);
    return;
  }

  // 2. Test Content Generation (gemini-2.5-flash)
  console.log('\n--- 2. Testing Text Generation (gemini-2.5-flash) ---');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Respond in Hindi in 1 short sentence confirming you are working." }] }]
      })
    });
    const data = await res.json();
    if (res.ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      console.log(`✅ Gemini Response: "${text}"`);
    } else {
      console.error('❌ Failed:', data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // 3. Test Text-to-Speech (BuyQK Voice Feature: gemini-2.5-flash-preview-tts)
  console.log('\n--- 3. Testing Voice TTS (gemini-2.5-flash-preview-tts) ---');
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Read aloud the following text: Hello! BuyQK Voice Assistant is ready." }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" }
            }
          }
        }
      })
    });
    const data = await res.json();
    if (res.ok) {
      const inlineData = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)?.inlineData;
      if (inlineData?.data) {
        console.log(`✅ TTS Voice Generation Successful! Received ${inlineData.data.length} bytes of audio (${inlineData.mimeType}).`);
      } else {
        console.log('⚠️ Response received but no audio payload found:', data);
      }
    } else {
      console.error('❌ TTS Failed:', data);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.log('\n🎉 Result: Gemini API Key bilkul sahi kaam kar rahi hai!\n');
}

verify();
