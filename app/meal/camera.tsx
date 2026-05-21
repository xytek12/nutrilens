import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { analyzeMealPhoto } from '../../src/lib/gemini';
import { useMealStore } from '../../src/stores/mealStore';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/lib/supabase';
import { MealEntry } from '../../src/types';

async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Camera Permission Required',
      'Please allow camera access in your iPhone Settings → NutriLens (or Expo Go) → Camera.',
    );
    return false;
  }
  return true;
}

async function requestLibraryPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      'Photo Library Permission Required',
      'Please allow photo access in your iPhone Settings → NutriLens (or Expo Go) → Photos.',
    );
    return false;
  }
  return true;
}

// Upload photo to Supabase Storage — returns public URL or null on failure
async function uploadMealPhoto(photoUri: string, userId: string): Promise<string | null> {
  try {
    const fileName = `${userId}/${Date.now()}.jpg`;
    const fetchResponse = await fetch(photoUri);
    const blob = await fetchResponse.blob();

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('meal-photos')
      .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

    if (uploadError || !uploadData) {
      console.error('Photo upload failed:', uploadError?.message);
      return null;
    }

    const { data: urlData } = supabase.storage.from('meal-photos').getPublicUrl(fileName);
    return urlData?.publicUrl ?? null;
  } catch (err) {
    console.error('Photo upload error:', err);
    return null;
  }
}

export default function CameraScreen() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'uploading' | 'saving'>('idle');
  const addMeal = useMealStore((s) => s.addMeal);
  const session = useAuthStore((s) => s.session);

  async function pickAndAnalyze(source: 'camera' | 'library') {
    const hasPermission =
      source === 'camera'
        ? await requestCameraPermission()
        : await requestLibraryPermission();

    if (!hasPermission) return;

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.4 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.4 });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    const userId = session?.user.id;
    if (!userId) {
      Alert.alert('Error', 'You must be signed in to save meals.');
      router.replace('/(auth)/sign-in');
      return;
    }

    const photoUri = result.assets[0].uri;
    const base64 = result.assets[0].base64;

    try {
      // Step 1: Analyze with AI
      setStatus('analyzing');
      const geminiResult = await analyzeMealPhoto(base64);

      // Step 2: Upload photo to Supabase Storage
      setStatus('uploading');
      const photoUrl = await uploadMealPhoto(photoUri, userId);
      if (!photoUrl) {
        // Non-fatal: continue without photo, warn user
        Alert.alert(
          'Photo Upload',
          t('errors.photo_upload_failed') || 'Photo upload failed. Meal will be saved without a photo.',
        );
      }

      // Step 3: Save meal record
      setStatus('saving');
      const totalProtein = geminiResult.items.reduce((s, i) => s + i.protein, 0);
      const totalCarbs = geminiResult.items.reduce((s, i) => s + i.carbs, 0);
      const totalFat = geminiResult.items.reduce((s, i) => s + i.fat, 0);
      const totalFiber = geminiResult.items.reduce((s, i) => s + i.fiber, 0);

      const { data: mealRow, error: insertError } = await supabase
        .from('meals')
        .insert({
          user_id: userId,
          meal_name: geminiResult.meal_name,
          eaten_at: new Date().toISOString(),
          photo_url: photoUrl,
          total_calories: geminiResult.total_calories,
          total_protein_g: Math.round(totalProtein * 10) / 10,
          total_carbs_g: Math.round(totalCarbs * 10) / 10,
          total_fat_g: Math.round(totalFat * 10) / 10,
          total_fiber_g: Math.round(totalFiber * 10) / 10,
          source: 'ai_vision',
        })
        .select()
        .single();

      if (insertError || !mealRow) {
        Alert.alert('Save Error', `Meal analyzed but could not be saved: ${insertError?.message}`);
        return;
      }

      // Step 4: Save individual meal items
      const mealItems = geminiResult.items.map((item) => ({
        meal_id: mealRow.id,
        food_name: item.name,
        weight_g: item.weight_grams,
        calories: item.calories,
        protein_g: item.protein,
        carbs_g: item.carbs,
        fat_g: item.fat,
        fiber_g: item.fiber,
        source: 'ai_vision',
      }));

      const { error: itemsError } = await supabase.from('meal_items').insert(mealItems);
      if (itemsError) {
        // Non-fatal — meal is saved, just items failed
        console.error('meal_items insert error:', itemsError.message);
      }

      // Step 5: Update local store
      const mealId = mealRow.id;
      const meal: MealEntry = {
        id: mealId,
        user_id: userId,
        meal_name: geminiResult.meal_name,
        eaten_at: mealRow.eaten_at,
        total_calories: geminiResult.total_calories,
        total_protein: totalProtein,
        total_carbs: totalCarbs,
        total_fat: totalFat,
        total_fiber: totalFiber,
        photo_url: photoUrl ?? undefined,
        source: 'ai',
        items: geminiResult.items.map((item, idx) => ({
          id: `item-${idx}`,
          meal_id: mealId,
          food_name: item.name,
          weight_grams: item.weight_grams,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
        })),
      };

      addMeal(meal);
      router.back();
    } catch (err) {
      Alert.alert(
        "Couldn't analyze photo",
        'Try again or add your meal manually.',
        [
          { text: 'Try Again', onPress: () => pickAndAnalyze(source) },
          { text: 'Add Manually', onPress: () => router.push('/meal/manual') },
        ],
      );
      console.error('Meal analysis error:', err);
    } finally {
      setStatus('idle');
    }
  }

  const loadingLabel: Record<string, string> = {
    analyzing: t('meals.analyzing') || 'Analyzing your meal with AI...',
    uploading: t('meals.uploading') || 'Uploading photo...',
    saving: t('meals.saving') || 'Saving...',
  };

  if (status !== 'idle') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2DB04B" />
        <Text style={styles.loadingText}>{loadingLabel[status]}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('meals.add_meal_title') || 'Add Meal'}</Text>
      <Text style={styles.subtitle}>{t('meals.add_meal_subtitle') || "Choose how you'd like to add your meal"}</Text>

      <TouchableOpacity style={styles.option} onPress={() => pickAndAnalyze('camera')}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>📷</Text>
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{t('meals.scan_camera') || 'Scan with Camera'}</Text>
          <Text style={styles.optionDesc}>{t('meals.scan_camera_desc') || 'Take a photo and let AI detect the food.'}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => pickAndAnalyze('library')}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>🖼️</Text>
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{t('meals.upload_gallery') || 'Upload from Gallery'}</Text>
          <Text style={styles.optionDesc}>{t('meals.upload_gallery_desc') || 'Choose a photo from your gallery.'}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push('/meal/manual')}>
        <View style={styles.iconBox}>
          <Text style={styles.icon}>✏️</Text>
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionTitle}>{t('meals.manual_entry') || 'Manual Entry'}</Text>
          <Text style={styles.optionDesc}>{t('meals.manual_entry_desc') || 'Enter your meal details manually.'}</Text>
        </View>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      <View style={styles.aiBanner}>
        <Text style={styles.aiBannerTitle}>✨ {t('meals.ai_powered') || 'AI-Powered Recognition'}</Text>
        <Text style={styles.aiBannerDesc}>
          {t('meals.ai_powered_desc') || "Snap a meal photo and we'll estimate calories and macros automatically."}
        </Text>
      </View>

      <TouchableOpacity style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>{t('common.cancel') || 'Cancel'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF8', padding: 24, paddingTop: 60 },
  loadingContainer: { flex: 1, backgroundColor: '#F8FAF8', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#1A1A1A', marginTop: 16, fontSize: 16, fontWeight: '500' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E8F5EC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  icon: { fontSize: 22 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  optionDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  arrow: { fontSize: 20, color: '#9CA3AF', marginLeft: 8 },
  aiBanner: {
    backgroundColor: '#E8F5EC',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  aiBannerTitle: { fontSize: 14, fontWeight: '700', color: '#2DB04B', marginBottom: 4 },
  aiBannerDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  cancel: { padding: 16, alignItems: 'center' },
  cancelText: { color: '#2DB04B', fontSize: 16, fontWeight: '600' },
});
