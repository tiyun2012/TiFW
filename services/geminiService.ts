import { GoogleGenAI } from "@google/genai";

// Helper to get a fresh instance (important for key updates)
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// 1. FAST CHAT (Flash Lite)
export const chatFast = async (prompt: string, context: string): Promise<string> => {
  const ai = getAI();
  try {
    const fullPrompt = `
      You are an expert C++ Game Engine developer assisting in 'Nebula Engine'.
      Current Engine Code Context:
      \`\`\`cpp
      ${context}
      \`\`\`
      User: ${prompt}
      Keep response concise and technical.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: fullPrompt,
    });
    return response.text || "No response.";
  } catch (error) {
    console.error("Fast Chat Error:", error);
    return "Error generating response.";
  }
};

// 2. THINKING MODE (Pro Preview)
export const chatThinking = async (prompt: string, context: string): Promise<string> => {
  const ai = getAI();
  try {
    const fullPrompt = `
      You are a senior architect for 'Nebula Engine'.
      Analyze the user's request deeply.
      Current Context:
      \`\`\`cpp
      ${context}
      \`\`\`
      User: ${prompt}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: fullPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 } // Max budget for deep reasoning
      }
    });
    return response.text || "No response.";
  } catch (error) {
    console.error("Thinking Error:", error);
    return "Error generating detailed response.";
  }
};

// 3. VISION (Analyze Image)
export const analyzeImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt || "Analyze this image for game asset usage." }
        ]
      }
    });
    return response.text || "Analysis failed.";
  } catch (error) {
    console.error("Vision Error:", error);
    return "Error analyzing image.";
  }
};

// 4. VEO (Generate Video)
export const generateVideo = async (prompt: string, imageBase64?: string, mimeType?: string): Promise<string> => {
  // Check for paid key first
  const win = window as any;
  if (win.aistudio && await win.aistudio.hasSelectedApiKey() === false) {
    throw new Error("API_KEY_REQUIRED");
  }

  const ai = getAI();
  
  try {
    let operation;
    
    const config = {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9' // Default landscape
    };

    if (imageBase64 && mimeType) {
      // Image + Text to Video
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt || "Animate this",
        image: {
          imageBytes: imageBase64,
          mimeType: mimeType
        },
        config: config
      });
    } else {
      // Text to Video
      operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: config
      });
    }

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video URI returned.");
    
    // Fetch the actual binary (or return URL to be fetched with key)
    // The browser needs the key attached to the URL to play/download it directly
    return `${downloadLink}&key=${process.env.API_KEY}`;
    
  } catch (error) {
    console.error("Veo Error:", error);
    throw error;
  }
};
