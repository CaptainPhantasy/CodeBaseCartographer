import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { ModelType } from "../types";
import { CARTOGRAPHER_SYSTEM_INSTRUCTION } from "../constants";
import { getConfigManager } from "../config/configManager";

// Helper to get fresh instance with runtime API key (especially for Veo key selection)
const getAI = () => {
  const configManager = getConfigManager();
  const apiKey = configManager.getApiKey('google');
  if (!apiKey) {
    throw new Error('Google API key not configured. Please add your API key in Settings.');
  }
  return new GoogleGenAI({ apiKey });
};

export const generateTextResponse = async (
  history: { role: string; text: string }[],
  useThinking: boolean,
  useSearch: boolean,
  imagePart?: string, // base64
  mimeType?: string
) => {
  const ai = getAI();
  const modelId = useThinking ? ModelType.SMART_THINKING : ModelType.FAST_CHAT;
  
  const tools = [];
  if (useSearch && modelId === ModelType.FAST_CHAT) {
     // Search only on flash for this app to balance speed/cost unless specific pro features needed
     tools.push({ googleSearch: {} });
  }

  const systemInstruction = CARTOGRAPHER_SYSTEM_INSTRUCTION;

  // Transform history to API format
  // We exclude the last message which is the one we are about to send
  const previousHistory = history.slice(0, -1).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
  }));
  
  const chat = ai.chats.create({
    model: modelId,
    history: previousHistory,
    config: {
      systemInstruction,
      tools,
      ...(useThinking ? { thinkingConfig: { thinkingBudget: 16000 } } : {}), // 16k is a safe mid-range for 3-pro
    }
  });

  // Prepare the message content
  let messageContent: any = history[history.length - 1].text;
  
  if (imagePart && mimeType) {
    // When sending multi-modal content to chat, passing an array of parts is standard
    messageContent = [
        { inlineData: { data: imagePart, mimeType: mimeType } },
        { text: history[history.length - 1].text }
    ];
  }

  // FIX: sendMessage expects an object with a 'message' property
  const result = await chat.sendMessage({ message: messageContent });
  
  // Extract search grounding if present
  let groundingUrls: string[] = [];
  if (result.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      result.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
          if (chunk.web?.uri) groundingUrls.push(chunk.web.uri);
      });
  }

  return {
    text: result.text,
    groundingUrls
  };
};

export const generateGraphData = async (description: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: ModelType.FAST_CHAT, // Flash is good enough for JSON structure
    contents: `Generate a JSON object representing a node-link graph for a system described as: "${description}". 
    The JSON must adhere to this schema:
    {
      "nodes": [{ "id": "string", "group": number, "label": "string", "type": "entry" | "logic" | "storage" | "exit" | "external" }],
      "links": [{ "source": "string", "target": "string", "value": number }]
    }
    Return ONLY valid JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                group: { type: Type.INTEGER },
                label: { type: Type.STRING },
                type: { type: Type.STRING, enum: ["entry", "logic", "storage", "exit", "external"] }
              }
            }
          },
          links: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                value: { type: Type.INTEGER }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text || "{}");
};

export const generateSpeech = async (text: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: ModelType.TTS,
    contents: {
      parts: [{ text }]
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' },
        },
      },
    },
  });
  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
};

// VEO VIDEO GENERATION
export const generateVideo = async (prompt: string, imageBase64: string | null = null, mimeType: string = 'image/png') => {
  // Check/Request API Key for Veo
  if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
          await window.aistudio.openSelectKey();
      }
  }

  // Create new instance with potentially selected key
  const ai = getAI();
  
  let operation;
  
  if (imageBase64) {
      operation = await ai.models.generateVideos({
          model: ModelType.VIDEO_GEN,
          prompt: prompt || "Animate this architecture diagram showing data flow.",
          image: {
            imageBytes: imageBase64,
            mimeType: mimeType
          },
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
          }
      });
  } else {
      operation = await ai.models.generateVideos({
          model: ModelType.VIDEO_GEN,
          prompt: prompt,
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
          }
      });
  }

  // Polling
  while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation});
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("No video generated");

  const configManager = getConfigManager();
  const apiKey = configManager.getApiKey('google');
  if (!apiKey) {
    throw new Error('Google API key not configured. Please add your API key in Settings.');
  }
  const response = await fetch(`${videoUri}&key=${apiKey}`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

// AUDIO UTILS FOR LIVE API
export function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}