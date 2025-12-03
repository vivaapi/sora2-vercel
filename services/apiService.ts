import { ApiSettings, CreateVideoRequest, CreateVideoResponse, QueryVideoResponse, OptimizationModel, CreateCharacterRequest, CreateCharacterResponse } from '../types';

// Helper to safely join base URL and endpoint
const buildUrl = (baseUrl: string, endpoint: string): string => {
  const base = baseUrl.replace(/\/+$/, '');
  const path = endpoint.replace(/^\/+/, '');
  return `${base}/${path}`;
};

// Default headers helper
const getHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json; charset=utf-8',
  'Accept': 'application/json',
  'Authorization': `Bearer ${apiKey}`,
});

// Helper for unified error handling
const handleFetchError = async (error: any, response?: Response) => {
  console.error("API Call Error:", error);

  // Safely check for network/fetch errors using optional chaining
  if (error?.name === 'TypeError' && error?.message === 'Failed to fetch') {
    throw new Error('网络请求失败：请检查网络连接、API地址配置或跨域设置(CORS)');
  }
  
  if (response && !response.ok) {
     if (response.status === 404) {
         throw new Error(`API 路径错误 (404): 请检查 API 地址配置。`);
     }
     
     const errorText = await response.text();
     let errorMessage = `Request failed: ${response.status}`;
     try {
         const errorJson = JSON.parse(errorText);
         if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
         } else if (errorJson.message) {
            errorMessage = errorJson.message;
         } else {
            errorMessage += ` - ${errorText.substring(0, 100)}`;
         }
      } catch (e) {
         if (errorText) errorMessage += ` - ${errorText.substring(0, 100)}`;
      }
      throw new Error(errorMessage);
  }
  
  if (error) {
    throw error;
  }

  throw new Error('Unknown Error Occurred');
};

const dataURLtoBlob = (dataurl: string) => {
    try {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    } catch (e) {
        console.error("Failed to convert data URL to Blob", e);
        return null;
    }
};

/**
 * Optimizes the user prompt using GPT-5
 */
export const optimizePrompt = async (
  prompt: string,
  settings: ApiSettings,
  mode: 'text' | 'segments' | 'script' = 'text'
): Promise<string> => {
  if (!prompt) return "";

  let systemContent = "";
  
  if (mode === 'script') {
     systemContent = "You are an expert film director. Refine the following video storyboard script. You MUST preserve the timestamp format `[start-end]` exactly as is (e.g. `[0s-5s]`) at the beginning of each scene. Improve the scene descriptions to be visually stunning, cinematic, and detailed, ensuring narrative continuity. Output ONLY the fully optimized script text. Do not add conversational filler.";
  } else if (mode === 'segments') {
     systemContent = "Analyze the following sequence of video storyboard scenes (separated by '|||') as a cohesive narrative. Optimize EACH scene's description to be visually stunning, cinematic, and detailed. Ensure logical continuity and consistent artistic style across the sequence. Return exactly the same number of segments, separated by '|||'. Output ONLY the optimized descriptions.";
  } else {
     systemContent = "You are an expert film director and prompt engineer. Reword the user's video description into a highly detailed, visual, and cinematic prompt suitable for AI video generation (like Sora). Focus on lighting, camera angles, texture, and motion. Output ONLY the optimized prompt, no conversational filler. Do NOT include video duration, length, aspect ratio, resolution, or technical camera settings (like 4k, 16:9) in the generated text.";
  }

  try {
    const url = buildUrl(settings.baseUrl, 'v1/chat/completions');
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(settings.apiKey),
      body: JSON.stringify({
        model: OptimizationModel.GPT_5,
        messages: [
          {
            role: "system",
            content: systemContent
          },
          {
            role: "user",
            content: prompt
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      await handleFetchError(null, response);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || prompt;
  } catch (error: any) {
    await handleFetchError(error);
    return prompt; // Fallback
  }
};

/**
 * Creates a video generation task
 */
export const createVideoTask = async (
  request: CreateVideoRequest,
  settings: ApiSettings
): Promise<CreateVideoResponse> => {
  try {
    const url = buildUrl(settings.baseUrl, 'v1/videos');
    const formData = new FormData();
    
    formData.append('model', request.model);
    formData.append('prompt', request.prompt);
    formData.append('seconds', request.duration.toString());
    
    // Map size based on orientation
    const sizeStr = request.orientation === 'landscape' ? '16x9' : '9x16';
    formData.append('size', sizeStr);
    
    // Set watermark to false per requirement
    formData.append('watermark', 'false');
    // formData.append('private', 'false'); // Optional based on spec examples

    // Handle Image Input
    if (request.images && request.images.length > 0) {
        const image = request.images[0];
        if (image.startsWith('data:')) {
            const blob = dataURLtoBlob(image);
            if (blob) {
                formData.append('input_reference', blob, 'input_image.png');
            }
        } else {
             // If it's a URL or other format
             formData.append('input_reference', image);
        }
    }
    
    if (request.character_url) {
        formData.append('character_url', request.character_url);
    }
    if (request.character_timestamps) {
        formData.append('character_timestamps', request.character_timestamps);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Accept': 'application/json',
          // Content-Type is set automatically by browser for FormData
      },
      body: formData
    });

    if (!response.ok) {
      await handleFetchError(null, response);
    }

    return await response.json();
  } catch (error: any) {
    await handleFetchError(error);
    throw error;
  }
};

/**
 * Creates a character
 */
export const createCharacter = async (
  request: CreateCharacterRequest,
  settings: ApiSettings
): Promise<CreateCharacterResponse> => {
  try {
    const url = buildUrl(settings.baseUrl, 'sora/v1/characters');
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(settings.apiKey),
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      await handleFetchError(null, response);
    }

    return await response.json();
  } catch (error: any) {
    await handleFetchError(error);
    throw error;
  }
};

/**
 * Queries the status of a video task
 */
export const queryVideoTask = async (
  taskId: string,
  settings: ApiSettings
): Promise<QueryVideoResponse> => {
  try {
    const url = buildUrl(settings.baseUrl, `v1/videos/${taskId}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(settings.apiKey)
    });

    if (!response.ok) {
       await handleFetchError(null, response);
    }

    return await response.json();
  } catch (error) {
    // Suppress console error spam for polling unless it's critical
    if (error instanceof Error && error.message.includes('NetworkError')) {
       // Silent fail for polling interruptions
    } else {
       console.error("Error querying video task:", error);
    }
    throw error;
  }
};