import { supabase } from './supabase';

export interface FoodItem {
  id: string;
  name_en: string;
  name_he?: string;
  name_ar?: string;
  name_de?: string;
  name_zh?: string;
  brand?: string;
  category?: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fiber_per_100g?: number;
  sugar_per_100g?: number;
  sodium_per_100g?: number;
  contains_gluten?: boolean;
  contains_nuts?: boolean;
  contains_dairy?: boolean;
  is_vegan?: boolean;
  is_vegetarian?: boolean;
  is_kosher?: boolean;
  is_halal?: boolean;
  barcode?: string;
  // image_url is intentionally excluded from SELECT — column exists but is null for all rows.
  // Use fetchFoodImage(barcode) to get images from Open Food Facts API on demand.
}

// Columns known to exist in the foods table
const FOOD_SELECT = [
  'id', 'name_en', 'name_he', 'name_ar', 'name_de', 'name_zh',
  'brand', 'category',
  'calories_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g',
  'fiber_per_100g', 'sugar_per_100g', 'sodium_per_100g',
  'contains_gluten', 'contains_nuts', 'contains_dairy',
  'is_vegan', 'is_vegetarian', 'is_kosher', 'is_halal',
  'barcode',
].join(', ');

// Built-in dictionary for the most common food terms — instant, offline, reliable.
// Keys are normalized (lowercase, trimmed). Values are the English search term.
// This covers ~95% of typical searches before we ever hit a translation API.
const FOOD_DICT: Record<string, Record<string, string>> = {
  he: {
    'ביצה':    'egg',
    'ביצים':   'egg',
    'עוף':     'chicken',
    'חזה עוף': 'chicken breast',
    'בקר':     'beef',
    'בשר':     'meat',
    'דג':      'fish',
    'סלמון':   'salmon',
    'טונה':    'tuna',
    'אורז':    'rice',
    'פסטה':    'pasta',
    'לחם':     'bread',
    'גבינה':   'cheese',
    'יוגורט':  'yogurt',
    'חלב':     'milk',
    'תפוח':    'apple',
    'בננה':    'banana',
    'תפוז':    'orange',
    'עגבנייה': 'tomato',
    'מלפפון':  'cucumber',
    'גזר':     'carrot',
    'בצל':     'onion',
    'שום':     'garlic',
    'תפוח אדמה': 'potato',
    'בטטה':    'sweet potato',
    'שניצל':   'schnitzel',
    'המבורגר': 'hamburger',
    'פיצה':    'pizza',
    'סלט':     'salad',
    'מרק':     'soup',
    'אגוזים':  'nuts',
    'שקדים':   'almonds',
    'בוטנים':  'peanut',
    'שוקולד':  'chocolate',
    'עוגה':    'cake',
    'קפה':     'coffee',
    'תה':      'tea',
    'מים':     'water',
    'חומוס':   'hummus',
    'פלאפל':   'falafel',
    'טחינה':   'tahini',
    'קוואקר':  'oatmeal',
    'שיבולת שועל': 'oat',
    'בורגול':  'bulgur',
    'קינואה':  'quinoa',
    'עדשים':   'lentils',
    'שעועית':  'beans',
    'אבוקדו':  'avocado',
    'ברוקולי': 'broccoli',
    'תרד':     'spinach',
    'תירס':    'corn',
    'דבש':     'honey',
    'חמאה':    'butter',
    'שמן':     'oil',
    'מלח':     'salt',
    'סוכר':    'sugar',
    'קמח':     'flour',
  },
  ar: {
    'بيض': 'egg', 'دجاج': 'chicken', 'لحم': 'meat', 'سمك': 'fish',
    'أرز': 'rice', 'خبز': 'bread', 'جبن': 'cheese', 'حليب': 'milk',
    'تفاح': 'apple', 'موز': 'banana', 'برتقال': 'orange',
    'بطاطس': 'potato', 'بطاطا': 'potato', 'بصل': 'onion', 'ثوم': 'garlic',
    'سلطة': 'salad', 'حساء': 'soup', 'بيتزا': 'pizza',
    'حمص': 'hummus', 'فلافل': 'falafel', 'طحينة': 'tahini',
    'شاي': 'tea', 'قهوة': 'coffee', 'ماء': 'water',
  },
  de: {
    'ei': 'egg', 'eier': 'egg', 'huhn': 'chicken', 'hähnchen': 'chicken',
    'rind': 'beef', 'fisch': 'fish', 'lachs': 'salmon',
    'reis': 'rice', 'nudeln': 'pasta', 'brot': 'bread',
    'käse': 'cheese', 'joghurt': 'yogurt', 'milch': 'milk',
    'apfel': 'apple', 'banane': 'banana', 'orange': 'orange',
    'kartoffel': 'potato', 'tomate': 'tomato', 'gurke': 'cucumber',
    'salat': 'salad', 'suppe': 'soup', 'pizza': 'pizza',
    'schokolade': 'chocolate', 'kaffee': 'coffee', 'tee': 'tea',
  },
  zh: {
    '鸡蛋': 'egg', '蛋': 'egg', '鸡肉': 'chicken', '鸡': 'chicken',
    '牛肉': 'beef', '猪肉': 'pork', '鱼': 'fish', '三文鱼': 'salmon',
    '米饭': 'rice', '米': 'rice', '面条': 'noodle', '面包': 'bread',
    '奶酪': 'cheese', '酸奶': 'yogurt', '牛奶': 'milk',
    '苹果': 'apple', '香蕉': 'banana', '橙子': 'orange',
    '土豆': 'potato', '番茄': 'tomato', '西红柿': 'tomato',
    '沙拉': 'salad', '汤': 'soup', '披萨': 'pizza',
    '巧克力': 'chocolate', '咖啡': 'coffee', '茶': 'tea',
  },
};

// Translate using dictionary first, then MyMemory API as a network fallback.
// Returns the English search term, or the original input if everything fails.
async function translateToEnglish(text: string, lang: string): Promise<string> {
  if (!['he', 'ar', 'de', 'zh'].includes(lang)) return text;

  // Dictionary lookup — instant, no network
  const key = text.toLowerCase().trim();
  const fromDict = FOOD_DICT[lang]?.[key];
  if (fromDict) return fromDict;

  // Network fallback to MyMemory (free, no key)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${lang}|en`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return text;
    const json = await res.json();
    const translated = (json.responseData?.translatedText as string) || '';
    // MyMemory sometimes returns the original text wrapped in junk — sanity check
    return translated && translated.length < 60 ? translated : text;
  } catch {
    return text;
  }
}

// Fetch the product image URL from Open Food Facts API by barcode.
// Called once when a user selects a food — not on every search result.
export async function fetchFoodImage(barcode: string): Promise<string | null> {
  if (!barcode) return null;
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=image_front_small_url,image_front_url`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NutriLens/1.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status !== 1) return null;
    return json.product?.image_front_small_url
      ?? json.product?.image_front_url
      ?? null;
  } catch {
    return null;
  }
}

// Fallback: search Open Food Facts by food name to find a representative image.
// Used for generic foods (chicken breast, rice, etc.) that have no barcode.
export async function fetchFoodImageByName(foodName: string): Promise<string | null> {
  if (!foodName) return null;
  try {
    const encoded = encodeURIComponent(foodName);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encoded}&action=process&json=1&fields=image_front_small_url&page_size=1&sort_by=unique_scans_n`;
    const res = await fetch(url, { headers: { 'User-Agent': 'NutriLens/1.0' } });
    if (!res.ok) return null;
    const json = await res.json();
    const img = json.products?.[0]?.image_front_small_url;
    return img || null;
  } catch {
    return null;
  }
}

// Return a food emoji based on category/name — used as fallback when no image available
export function getFoodEmoji(food: FoodItem): string {
  const n = (food.name_en + (food.category ?? '')).toLowerCase();
  if (n.includes('chicken') || n.includes('poultry') || n.includes('turkey')) return '🍗';
  if (n.includes('beef') || n.includes('steak') || n.includes('burger') || n.includes('meat')) return '🥩';
  if (n.includes('fish') || n.includes('salmon') || n.includes('tuna') || n.includes('sushi')) return '🐟';
  if (n.includes('pizza')) return '🍕';
  if (n.includes('pasta') || n.includes('spaghetti') || n.includes('noodle')) return '🍝';
  if (n.includes('rice')) return '🍚';
  if (n.includes('salad')) return '🥗';
  if (n.includes('soup')) return '🍲';
  if (n.includes('bread') || n.includes('toast') || n.includes('sandwich')) return '🥪';
  if (n.includes('egg') || n.includes('omelet')) return '🥚';
  if (n.includes('cheese') || n.includes('dairy') || n.includes('milk') || n.includes('yogurt')) return '🧀';
  if (n.includes('fruit') || n.includes('apple') || n.includes('banana') || n.includes('orange')) return '🍎';
  if (n.includes('coffee') || n.includes('tea') || n.includes('drink') || n.includes('juice')) return '☕';
  if (n.includes('protein') || n.includes('supplement') || n.includes('whey') || n.includes('shake')) return '💪';
  if (n.includes('chocolate') || n.includes('cake') || n.includes('cookie') || n.includes('sweet')) return '🍫';
  if (n.includes('hummus') || n.includes('falafel')) return '🧆';
  if (n.includes('oat') || n.includes('cereal') || n.includes('granola')) return '🥣';
  if (n.includes('vegetable') || n.includes('carrot') || n.includes('broccoli') || n.includes('spinach')) return '🥦';
  if (n.includes('nut') || n.includes('almond') || n.includes('peanut') || n.includes('walnut')) return '🥜';
  if (n.includes('oil') || n.includes('fat') || n.includes('butter') || n.includes('cream')) return '🫙';
  if (n.includes('water') || n.includes('beverage')) return '💧';
  if (n.includes('snack') || n.includes('chip') || n.includes('crisp')) return '🍿';
  return '🍽️';
}

export const searchFoods = async (
  query: string,
  language: string = 'en',
  limit: number = 20,
): Promise<FoodItem[]> => {
  if (!query || query.trim().length < 2) return [];

  const trimmed = query.trim();

  // Translate non-English queries to English so we can search name_en
  const translated = language !== 'en'
    ? await translateToEnglish(trimmed, language)
    : trimmed;

  // Sanitize for PostgREST OR query: remove commas/parens/quotes that would
  // break the .or() clause syntax. Keep alphanumerics, spaces, hyphens.
  const safe = (s: string) => s.replace(/[,()'"`]/g, ' ').trim();
  const searchTerm = safe(translated);
  const origSafe   = safe(trimmed);

  const nameColumn: Record<string, string> = {
    he: 'name_he',
    ar: 'name_ar',
    de: 'name_de',
    zh: 'name_zh',
  };
  const langCol = nameColumn[language];

  try {
    let q = supabase
      .from('foods')
      .select(FOOD_SELECT)
      .limit(limit)
      .order('name_en');

    if (langCol && origSafe && searchTerm && origSafe !== searchTerm) {
      // original text → locale column (for any rows with native names)
      // translated text → name_en (the main search path)
      q = q.or(`${langCol}.ilike.%${origSafe}%,name_en.ilike.%${searchTerm}%`);
    } else {
      // Either English, or translation failed: just search name_en
      q = q.ilike('name_en', `%${searchTerm || origSafe}%`);
    }

    const { data, error } = await q;
    if (error) {
      console.error('Food search error:', error);
      return [];
    }
    return (data || []) as FoodItem[];
  } catch (err) {
    console.error('Food search exception:', err);
    return [];
  }
};

export const getFoodDisplayName = (food: FoodItem, language: string): string => {
  const map: Record<string, keyof FoodItem> = {
    he: 'name_he',
    ar: 'name_ar',
    de: 'name_de',
    zh: 'name_zh',
  };
  const key = map[language];
  if (key && food[key]) return food[key] as string;
  return food.name_en;
};

export const searchByBarcode = async (barcode: string): Promise<FoodItem | null> => {
  const { data, error } = await supabase
    .from('foods')
    .select(FOOD_SELECT)
    .eq('barcode', barcode)
    .single();
  if (error || !data) return null;
  return data as FoodItem;
};
