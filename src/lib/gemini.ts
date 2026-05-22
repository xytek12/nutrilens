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
You are an expert food recognition AI and nutritionist.
Analyze this meal photo and identify ALL food items visible.

IMPORTANT RULES:
- You MUST return valid JSON only. No text before or after the JSON.
- Do NOT use markdown code fences like \`\`\`json
- If you see a complex dish (pasta with sauce, salad with toppings, stir-fry),
  treat it as ONE item with combined nutrition, not separate ingredients.
- If you cannot identify the food, make your BEST GUESS based on visual appearance.
  Never return an empty items array. Always provide at least one item.
- Pasta dishes: estimate based on portion size (typical plate = 300-400g)
- Salads: estimate based on bowl size (side salad = 150g, main salad = 300g)
- Mixed rice dishes: estimate total portion (typical = 200-350g)

For EACH food item provide ALL fields:
- name: specific name (e.g. "pasta with tomato sauce", "greek salad", "fried rice")
- weight_g: total weight estimate in grams (REQUIRED - never null)
- per_100g.calories: kcal per 100g
- per_100g.protein_g: grams protein per 100g
- per_100g.carbs_g: grams carbs per 100g
- per_100g.fat_g: grams fat per 100g
- per_100g.fiber_g: grams fiber per 100g

Common reference values:
- Pasta with tomato sauce: cal=131, protein=4.5, carbs=22, fat=3.2, weight=350g
- Pasta with cream sauce: cal=180, protein=5, carbs=22, fat=8, weight=350g
- Greek salad: cal=96, protein=3, carbs=6, fat=7, weight=250g
- Caesar salad: cal=130, protein=4, carbs=8, fat=9, weight=200g
- Mixed green salad: cal=35, protein=2, carbs=5, fat=1, weight=150g
- Fried rice: cal=163, protein=3.4, carbs=28, fat=4.5, weight=250g
- Shakshuka (2 eggs): cal=120, protein=8, carbs=6, fat=7, weight=300g
- Hummus plate: cal=170, protein=8, carbs=14, fat=9.6, weight=150g
- Chicken schnitzel: cal=229, protein=22, carbs=12, fat=11, weight=150g
- Grilled chicken breast: cal=165, protein=31, carbs=0, fat=3.6, weight=150g
- Gouda cheese (slices): cal=356, protein=25, carbs=2, fat=27, weight=30g per slice
- Oatmeal with toppings: cal=150, protein=5, carbs=27, fat=3, weight=300g
- Salmon fillet: cal=208, protein=20, carbs=0, fat=13, weight=180g
- White rice (cooked): cal=130, protein=2.7, carbs=28, fat=0.3
- Eggs (fried): cal=196, protein=14, carbs=0, fat=15

Return ONLY this JSON structure, nothing else:
{
  "items": [
    {
      "name": "pasta with tomato sauce",
      "weight_g": 350,
      "per_100g": {
        "calories": 131,
        "protein_g": 4.5,
        "carbs_g": 22.0,
        "fat_g": 3.2,
        "fiber_g": 1.5
      }
    }
  ],
  "confidence": "high",
  "notes": "Single serving of pasta with tomato sauce, estimated from plate size"
}

confidence values: "high" = clear photo, "medium" = some uncertainty, "low" = poor photo
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
  // Step 1: Strip markdown fences
  let cleaned = rawResponse
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: Extract the JSON object (first { to last })
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Step 3: Try to fix common JSON issues
    const fixed = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/'/g, '"');
    try {
      parsed = JSON.parse(fixed);
    } catch {
      throw new Error('AI returned invalid JSON. Please try again.');
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// AI MEAL PLAN GENERATION
// Builds a 1-day meal plan + workout suggestion from the user's profile.
// Uses the same Gemini → OpenAI cascade as analyzeMealPhoto.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanGoal = 'lose' | 'maintain' | 'gain';
export type PlanLevel = 'beginner' | 'intermediate' | 'advanced';
export type PlanMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface PlanInput {
  goal: PlanGoal;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  activity_level?: string;
  dietary_preferences?: string[];
  language?: string;
}

export interface PlanMeal {
  type: PlanMealType;
  emoji: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface PlanWorkout {
  name: string;
  duration_min: number;
  level: PlanLevel;
  kcal_burned: number;
}

export interface AIPlan {
  meals: PlanMeal[];
  workout: PlanWorkout;
}

function buildPlanPrompt(input: PlanInput): string {
  const diet = input.dietary_preferences?.length
    ? input.dietary_preferences.join(', ')
    : 'no restrictions';
  const goalDesc =
    input.goal === 'lose' ? 'fat loss (calorie deficit)' :
    input.goal === 'gain' ? 'muscle gain (calorie surplus, high protein)' :
    'maintenance';

  return `You are a certified nutritionist and fitness coach.
Generate a balanced 1-day meal plan AND a single workout suggestion for this user.

USER PROFILE:
- Goal: ${goalDesc}
- Daily calories target: ${input.calories} kcal
- Daily protein target: ${input.protein_g} g
- Daily carbs target: ${input.carbs_g} g
- Daily fat target: ${input.fat_g} g
- Activity level: ${input.activity_level || 'moderate'}
- Dietary preferences: ${diet}

REQUIREMENTS:
- Exactly 4 meals: breakfast, lunch, dinner, snack
- Sum of meal calories should be within 5% of the daily target
- Use realistic, common foods (no exotic ingredients)
- Each meal name must be in ENGLISH, descriptive but short (max 50 chars)
- The workout should fit the activity level and goal

Return ONLY this JSON structure. No prose, no markdown fences, no comments:
{
  "meals": [
    { "type": "breakfast", "emoji": "🌅", "name": "Oatmeal with berries and almonds", "calories": 500, "protein_g": 25, "carbs_g": 60, "fat_g": 15 },
    { "type": "lunch",     "emoji": "☀️", "name": "Grilled chicken salad",            "calories": 650, "protein_g": 45, "carbs_g": 35, "fat_g": 20 },
    { "type": "dinner",    "emoji": "🌙", "name": "Salmon with quinoa and veggies",   "calories": 750, "protein_g": 50, "carbs_g": 55, "fat_g": 18 },
    { "type": "snack",     "emoji": "🍎", "name": "Greek yogurt with nuts",            "calories": 320, "protein_g": 18, "carbs_g": 22, "fat_g": 12 }
  ],
  "workout": {
    "name": "Full Body Strength",
    "duration_min": 30,
    "level": "intermediate",
    "kcal_burned": 280
  }
}

Valid level values: beginner, intermediate, advanced.`;
}

function parsePlanJson(raw: string): AIPlan {
  let cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const first = cleaned.indexOf('{');
  const last  = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1) cleaned = cleaned.slice(first, last + 1);

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const fixed = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/'/g, '"');
    parsed = JSON.parse(fixed);
  }

  if (!Array.isArray(parsed.meals) || parsed.meals.length !== 4) {
    throw new Error('AI returned an invalid plan (wrong meals count).');
  }
  if (!parsed.workout?.name) {
    throw new Error('AI returned an invalid plan (no workout).');
  }

  // Coerce + clamp values defensively
  const meals: PlanMeal[] = parsed.meals.map((m: any): PlanMeal => ({
    type: (['breakfast', 'lunch', 'dinner', 'snack'].includes(m.type) ? m.type : 'snack') as PlanMealType,
    emoji: m.emoji || '🍽️',
    name: String(m.name || 'Meal').slice(0, 80),
    calories: Math.max(0, Math.round(Number(m.calories) || 0)),
    protein_g: Math.max(0, Math.round((Number(m.protein_g) || 0) * 10) / 10),
    carbs_g:   Math.max(0, Math.round((Number(m.carbs_g)   || 0) * 10) / 10),
    fat_g:     Math.max(0, Math.round((Number(m.fat_g)     || 0) * 10) / 10),
  }));

  const lvl = parsed.workout.level;
  const workout: PlanWorkout = {
    name: String(parsed.workout.name).slice(0, 60),
    duration_min: Math.max(5, Math.min(120, Math.round(Number(parsed.workout.duration_min) || 30))),
    level: (['beginner', 'intermediate', 'advanced'].includes(lvl) ? lvl : 'intermediate') as PlanLevel,
    kcal_burned: Math.max(0, Math.round(Number(parsed.workout.kcal_burned) || 200)),
  };

  return { meals, workout };
}

async function generatePlanWithOpenAI(prompt: string): Promise<AIPlan> {
  if (!OPENAI_API_KEY) throw new Error('OpenAI key not configured');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenAI plan error: ${res.status} — ${err?.error?.message ?? 'Unknown'}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from OpenAI');
  return parsePlanJson(text);
}

export async function generatePlan(input: PlanInput): Promise<AIPlan> {
  const prompt = buildPlanPrompt(input);
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
  });

  for (const model of GEMINI_MODELS) {
    const res = await fetch(geminiUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (res.status === 503 || res.status === 429) continue;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini plan error: ${res.status} — ${err?.error?.message ?? JSON.stringify(err)}`);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from Gemini');
    return parsePlanJson(text);
  }

  // All Gemini models overloaded — try OpenAI
  if (OPENAI_API_KEY) return generatePlanWithOpenAI(prompt);
  throw new Error('All AI models are currently overloaded. Please try again in a moment.');
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
