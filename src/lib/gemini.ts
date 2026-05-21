const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export interface FoodItem {
  name: string;
  weight_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface GeminiMealResult {
  meal_name: string;
  items: FoodItem[];
  total_calories: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

export async function analyzeMealPhoto(base64Image: string): Promise<GeminiMealResult> {
  const prompt = `Analyze this meal photo and return a JSON object with this exact structure:
{
  "meal_name": "string",
  "items": [
    {
      "name": "string",
      "weight_grams": number,
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "fiber": number
    }
  ],
  "total_calories": number,
  "confidence": "high" | "medium" | "low",
  "notes": "string or null"
}

Be precise with portion estimates. Return ONLY valid JSON, no markdown.`;

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = errBody?.error?.message ?? JSON.stringify(errBody);
    throw new Error(`Gemini API error: ${response.status} — ${errMsg}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('No response from Gemini');

  // Strip markdown code blocks that Gemini sometimes adds despite being asked not to
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  return JSON.parse(cleaned) as GeminiMealResult;
}
