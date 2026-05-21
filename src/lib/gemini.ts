const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
];

function geminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

const GEMINI_MEAL_PROMPT = `
You are a professional nutritionist and food scale expert.
Analyze this meal photo carefully. Identify EVERY visible food item separately.

For EACH food item you must provide ALL of the following — never leave any field null or missing:
1. name: specific food name (e.g. "fried rice" not "rice", "chicken schnitzel" not "chicken")
2. weight_g: estimated weight in grams — use these visual reference points:
   - Standard dinner plate diameter = 26-28cm
   - A chicken breast = 120-180g
   - A palm-sized piece of meat = ~85g
   - One cup cooked rice = ~180g
   - One cup fried rice = ~200g
   - A schnitzel piece (medium) = 120-150g
   - One cup salad leaves = ~30g
   - One medium potato = ~150g
   ALWAYS provide a number. If uncertain, give your best estimate.
3. per_100g.calories: kcal per 100g (use standard food database values)
4. per_100g.protein_g: grams of protein per 100g — REQUIRED, never 0 unless truly 0
5. per_100g.carbs_g: grams of carbohydrates per 100g — REQUIRED
6. per_100g.fat_g: grams of fat per 100g — REQUIRED
7. per_100g.fiber_g: grams of fiber per 100g

Standard reference values to use:
- Chicken breast (grilled): cal=165, protein=31, carbs=0, fat=3.6
- Chicken schnitzel (fried): cal=229, protein=22, carbs=12, fat=11
- Fried rice: cal=163, protein=3.4, carbs=28, fat=4.5
- White rice (cooked): cal=130, protein=2.7, carbs=28, fat=0.3
- Brown rice (cooked): cal=112, protein=2.6, carbs=23, fat=0.9
- Eggs (fried): cal=196, protein=14, carbs=0, fat=15
- Salmon (grilled): cal=208, protein=20, carbs=0, fat=13

Return ONLY valid JSON — no markdown, no explanation, exactly this format:
{
  "items": [
    {
      "name": "chicken schnitzel",
      "weight_g": 135,
      "per_100g": {
        "calories": 229,
        "protein_g": 22.0,
        "carbs_g": 12.0,
        "fat_g": 11.0,
        "fiber_g": 0.5
      }
    }
  ],
  "confidence": "high",
  "total_weight_g": 135,
  "notes": "One medium chicken schnitzel, lightly breaded and fried"
}

confidence values: "high" = clear photo, "medium" = some uncertainty, "low" = poor photo
CRITICAL: Every item MUST have weight_g and ALL per_100g fields filled. No exceptions.
`;

export interface FoodItem {
  name: string;
  weight_grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  per_100g?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
  };
}

export interface GeminiMealResult {
  meal_name: string;
  items: FoodItem[];
  total_calories: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

// Calculate per-item totals from weight × per_100g and return in FoodItem shape
function processGeminiResponse(rawResponse: string): GeminiMealResult {
  const cleaned = rawResponse
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI returned invalid JSON. Please try again.');
  }

  if (!parsed.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('AI returned no food items. Please try again.');
  }

  const items: FoodItem[] = parsed.items.map((item: any) => {
    const weight = item.weight_g || 100;
    const p100 = item.per_100g || {};
    const ratio = weight / 100;
    return {
      name: item.name || 'Unknown food',
      weight_grams: weight,
      calories: Math.round(ratio * (p100.calories || 0)),
      protein: Math.round(ratio * (p100.protein_g || 0) * 10) / 10,
      carbs: Math.round(ratio * (p100.carbs_g || 0) * 10) / 10,
      fat: Math.round(ratio * (p100.fat_g || 0) * 10) / 10,
      fiber: Math.round(ratio * (p100.fiber_g || 0) * 10) / 10,
      per_100g: {
        calories: p100.calories || 0,
        protein_g: p100.protein_g || 0,
        carbs_g: p100.carbs_g || 0,
        fat_g: p100.fat_g || 0,
        fiber_g: p100.fiber_g || 0,
      },
    };
  });

  const total_calories = items.reduce((s, i) => s + i.calories, 0);
  // Generate meal name from items
  const meal_name =
    items.length === 1
      ? items[0].name
      : items
          .slice(0, 3)
          .map((i) => i.name)
          .join(', ') + (items.length > 3 ? ' & more' : '');

  return {
    meal_name,
    items,
    total_calories,
    confidence: parsed.confidence || 'medium',
    notes: parsed.notes || undefined,
  };
}

async function analyzeWithOpenAI(base64Image: string): Promise<GeminiMealResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: GEMINI_MEAL_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 1200,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`OpenAI error: ${response.status} — ${errBody?.error?.message ?? 'Unknown error'}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from OpenAI');

  return processGeminiResponse(text);
}

export async function analyzeMealPhoto(base64Image: string): Promise<GeminiMealResult> {
  const requestBody = JSON.stringify({
    contents: [
      {
        parts: [
          { text: GEMINI_MEAL_PROMPT },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
  });

  for (const model of GEMINI_MODELS) {
    const response = await fetch(geminiUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });

    // 503 = overloaded, 429 = rate limited — try next model
    if (response.status === 503 || response.status === 429) {
      continue;
    }

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} — ${errBody?.error?.message ?? JSON.stringify(errBody)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from Gemini');

    return processGeminiResponse(text);
  }

  // All Gemini models are overloaded — try OpenAI if key is configured
  if (OPENAI_API_KEY) {
    return analyzeWithOpenAI(base64Image);
  }

  throw new Error('All AI models are currently overloaded. Please try again in a moment.');
}
