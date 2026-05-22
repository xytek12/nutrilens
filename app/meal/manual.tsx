import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Image,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n/index';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import { useMealStore } from '../../src/stores/mealStore';
import { searchFoods, getFoodDisplayName, getFoodEmoji, fetchFoodImage, fetchFoodImageByName, FoodItem } from '../../src/lib/foodSearch';
import { MealEntry } from '../../src/types';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'drink' | 'supplement';

const MEAL_TYPES: { key: MealType; emoji: string }[] = [
  { key: 'breakfast', emoji: '🌅' },
  { key: 'lunch',     emoji: '☀️' },
  { key: 'dinner',    emoji: '🌙' },
  { key: 'snack',     emoji: '🍎' },
];

export default function ManualEntryScreen() {
  const { t } = useTranslation();
  const lang = i18n.language;
  const session = useAuthStore((s) => s.session);
  const addMeal = useMealStore((s) => s.addMeal);

  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<FoodItem[]>([]);
  const [searching, setSearching]       = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingImg, setLoadingImg]     = useState(false);
  const [weightStr, setWeightStr]       = useState('100');
  const [mealType, setMealType]         = useState<MealType>('lunch');
  const [saving, setSaving]             = useState(false);

  // Debounced search
  useEffect(() => {
    if (selectedFood) return;
    const timer = setTimeout(async () => {
      if (query.trim().length >= 2) {
        setSearching(true);
        const foods = await searchFoods(query, lang);
        setResults(foods);
        setSearching(false);
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, lang]);

  // Fetch real product image: try barcode first, fall back to name search
  async function selectFood(food: FoodItem) {
    setSelectedFood(food);
    setQuery(getFoodDisplayName(food, lang));
    setResults([]);
    setSelectedImage(null);
    setLoadingImg(true);
    let imgUrl: string | null = null;
    if (food.barcode) {
      imgUrl = await fetchFoodImage(food.barcode);
    }
    if (!imgUrl) {
      imgUrl = await fetchFoodImageByName(food.name_en);
    }
    setSelectedImage(imgUrl);
    setLoadingImg(false);
  }

  const weightGrams = parseFloat(weightStr) || 0;
  const factor = weightGrams / 100;

  const calcMacros = () => {
    if (!selectedFood || weightGrams <= 0) return null;
    return {
      calories: Math.round(selectedFood.calories_per_100g * factor),
      protein: Math.round(selectedFood.protein_per_100g * factor * 10) / 10,
      carbs:   Math.round(selectedFood.carbs_per_100g * factor * 10) / 10,
      fat:     Math.round(selectedFood.fat_per_100g * factor * 10) / 10,
      fiber:   Math.round((selectedFood.fiber_per_100g || 0) * factor * 10) / 10,
    };
  };

  const macros = calcMacros();
  const canSave = selectedFood !== null && weightGrams > 0;

  async function handleSave() {
    if (!canSave || !macros) return;
    const userId = session?.user?.id;
    if (!userId) {
      Alert.alert('Error', 'You must be signed in.');
      return;
    }

    setSaving(true);
    try {
      const foodName = getFoodDisplayName(selectedFood!, lang);

      const { data: mealRow, error: mealError } = await supabase
        .from('meals')
        .insert({
          user_id: userId,
          meal_name: foodName,
          meal_type: mealType,
          eaten_at: new Date().toISOString(),
          total_calories: macros.calories,
          total_protein_g: macros.protein,
          total_carbs_g: macros.carbs,
          total_fat_g: macros.fat,
          total_fiber_g: macros.fiber,
          photo_url: selectedImage ?? null,
          source: 'database',
        })
        .select()
        .single();

      if (mealError || !mealRow) {
        Alert.alert('Error', mealError?.message || 'Could not save meal.');
        return;
      }

      await supabase.from('meal_items').insert({
        meal_id: mealRow.id,
        food_name: foodName,
        weight_g: weightGrams,
        calories: macros.calories,
        protein_g: macros.protein,
        carbs_g: macros.carbs,
        fat_g: macros.fat,
        fiber_g: macros.fiber,
        source: 'database',
      });

      const meal: MealEntry = {
        id: mealRow.id,
        user_id: userId,
        meal_name: foodName,
        eaten_at: mealRow.eaten_at,
        total_calories: macros.calories,
        total_protein: macros.protein,
        total_carbs: macros.carbs,
        total_fat: macros.fat,
        total_fiber: macros.fiber,
        photo_url: selectedImage ?? undefined,
        source: 'manual',
        items: [],
      };
      addMeal(meal);
      router.replace('/(tabs)/');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
              <Text style={s.backTxt}>← {t('common.back')}</Text>
            </TouchableOpacity>
            <Text style={s.title}>{t('meals.manual_entry')}</Text>
          </View>

          {/* Search bar */}
          {!selectedFood && (
            <>
              <View style={s.searchBox}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  style={s.searchInput}
                  placeholder={t('food_search.placeholder')}
                  placeholderTextColor="#9CA3AF"
                  value={query}
                  onChangeText={setQuery}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searching && <ActivityIndicator size="small" color="#2DB04B" />}
              </View>

              {results.length > 0 && (
                <View style={s.resultsList}>
                  {results.map((food) => (
                    <TouchableOpacity
                      key={food.id}
                      style={s.resultRow}
                      onPress={() => selectFood(food)}
                    >
                      <View style={s.resultImgPlaceholder}>
                        <Text style={{ fontSize: 22 }}>{getFoodEmoji(food)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.resultName} numberOfLines={1}>
                          {getFoodDisplayName(food, lang)}
                        </Text>
                        {food.brand ? (
                          <Text style={s.resultBrand} numberOfLines={1}>{food.brand}</Text>
                        ) : null}
                      </View>
                      <Text style={s.resultCal}>{food.calories_per_100g} kcal/100g</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {query.length >= 2 && results.length === 0 && !searching && (
                <Text style={s.noResults}>{t('food_search.not_found')}</Text>
              )}
            </>
          )}

          {/* Selected food details */}
          {selectedFood && (
            <>
              <View style={s.selectedCard}>
                {/* Image: real photo from OFF API (if available) or food emoji */}
                {loadingImg ? (
                  <View style={s.selectedImgPlaceholder}>
                    <ActivityIndicator size="small" color="#2DB04B" />
                  </View>
                ) : selectedImage ? (
                  <Image source={{ uri: selectedImage }} style={s.selectedImg} />
                ) : (
                  <View style={s.selectedImgPlaceholder}>
                    <Text style={{ fontSize: 28 }}>{getFoodEmoji(selectedFood)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedName}>{getFoodDisplayName(selectedFood, lang)}</Text>
                  {selectedFood.brand ? (
                    <Text style={s.selectedBrand}>{selectedFood.brand}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => { setSelectedFood(null); setSelectedImage(null); setQuery(''); setWeightStr('100'); }}
                  style={s.changeBtn}
                >
                  <Text style={s.changeBtnTxt}>{t('common.edit')}</Text>
                </TouchableOpacity>
              </View>

              {/* Weight input */}
              <Text style={s.label}>{t('food_detail.serving_size')} (g)</Text>
              <TextInput
                style={s.weightInput}
                value={weightStr}
                onChangeText={(v) => setWeightStr(v.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                returnKeyType="done"
                placeholder="100"
                placeholderTextColor="#9CA3AF"
              />

              {/* Live macros preview */}
              {macros && (
                <View style={s.macroRow}>
                  <MacroChip label={t('food_detail.calories')} value={`${macros.calories}`} color="#EF4444" />
                  <MacroChip label={t('dashboard.protein')} value={`${macros.protein}g`} color="#2DB04B" />
                  <MacroChip label={t('dashboard.carbs')} value={`${macros.carbs}g`} color="#F97316" />
                  <MacroChip label={t('dashboard.fat')} value={`${macros.fat}g`} color="#EAB308" />
                </View>
              )}

              {/* Meal type selector */}
              <Text style={[s.label, { marginTop: 20 }]}>{t('meals.add_meal_title')}</Text>
              <View style={s.mealTypeRow}>
                {MEAL_TYPES.map((mt) => (
                  <TouchableOpacity
                    key={mt.key}
                    style={[s.mealTypeBtn, mealType === mt.key && s.mealTypeBtnActive]}
                    onPress={() => setMealType(mt.key)}
                  >
                    <Text style={s.mealTypeEmoji}>{mt.emoji}</Text>
                    <Text style={[s.mealTypeTxt, mealType === mt.key && s.mealTypeTxtActive]}>
                      {t(`meals.${mt.key}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[s.saveBtn, (!canSave || saving) && s.saveBtnOff]}
                onPress={handleSave}
                disabled={!canSave || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.saveBtnTxt}>{t('meals.save_meal')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MacroChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[chip.wrap, { borderColor: color + '40' }]}>
      <Text style={[chip.value, { color }]}>{value}</Text>
      <Text style={chip.label}>{label}</Text>
    </View>
  );
}
const chip = StyleSheet.create({
  wrap:  { flex: 1, alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 10, borderWidth: 1.5 },
  value: { fontSize: 15, fontWeight: 'bold' },
  label: { fontSize: 10, color: '#6B7280', marginTop: 2 },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F8FAF8' },
  scroll: { flexGrow: 1, padding: 20, paddingTop: 16, paddingBottom: 40 },

  header:  { marginBottom: 20 },
  backBtn: { marginBottom: 8 },
  backTxt: { color: '#6B7280', fontSize: 14 },
  title:   { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },

  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', paddingHorizontal: 14, marginBottom: 8 },
  searchIcon:  { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: '#1A1A1A' },

  resultsList:         { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', overflow: 'hidden', marginBottom: 8 },
  resultRow:           { flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 10 },
  resultImgPlaceholder:{ width: 44, height: 44, borderRadius: 8, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  resultName:          { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  resultBrand:         { fontSize: 12, color: '#6B7280', marginTop: 2 },
  resultCal:           { fontSize: 13, color: '#6B7280', marginLeft: 4 },
  noResults:           { textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginVertical: 16 },

  selectedCard:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#2DB04B', marginBottom: 16 },
  selectedImg:           { width: 60, height: 60, borderRadius: 10 },
  selectedImgPlaceholder:{ width: 60, height: 60, borderRadius: 10, backgroundColor: '#E8F5EC', justifyContent: 'center', alignItems: 'center' },
  selectedName:          { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  selectedBrand:         { fontSize: 12, color: '#6B7280', marginTop: 2 },
  changeBtn:             { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#D1D5DB' },
  changeBtnTxt:          { fontSize: 13, color: '#6B7280', fontWeight: '600' },

  label:       { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  weightInput: { backgroundColor: '#fff', borderRadius: 12, padding: 16, fontSize: 22, color: '#1A1A1A', borderWidth: 1.5, borderColor: '#E5E7EB', textAlign: 'center', fontWeight: '700', marginBottom: 16 },

  macroRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },

  mealTypeRow:       { flexDirection: 'row', gap: 8, marginBottom: 24 },
  mealTypeBtn:       { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  mealTypeBtnActive: { borderColor: '#2DB04B', backgroundColor: '#F0FDF4' },
  mealTypeEmoji:     { fontSize: 20, marginBottom: 4 },
  mealTypeTxt:       { fontSize: 11, color: '#6B7280', fontWeight: '600', textAlign: 'center' },
  mealTypeTxtActive: { color: '#2DB04B' },

  saveBtn:    { backgroundColor: '#2DB04B', borderRadius: 14, padding: 18, alignItems: 'center' },
  saveBtnOff: { backgroundColor: '#A7D7B4' },
  saveBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
