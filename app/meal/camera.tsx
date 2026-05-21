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

export default function CameraScreen() {
  const { t } = useTranslation();
  const [analyzing, setAnalyzing] = useState(false);
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
        ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.2 })
        : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.2 });

    if (result.canceled || !result.assets?.[0]?.base64) return;

    setAnalyzing(true);
    try {
      const geminiResult = await analyzeMealPhoto(result.assets[0].base64);
      const userId = session?.user.id;
      if (!userId) return;

      const mealId = `local-${Date.now()}`;
      const meal: MealEntry = {
        id: mealId,
        user_id: userId,
        meal_name: geminiResult.meal_name,
        eaten_at: new Date().toISOString(),
        total_calories: geminiResult.total_calories,
        total_protein: geminiResult.items.reduce((s, i) => s + i.protein, 0),
        total_carbs: geminiResult.items.reduce((s, i) => s + i.carbs, 0),
        total_fat: geminiResult.items.reduce((s, i) => s + i.fat, 0),
        total_fiber: geminiResult.items.reduce((s, i) => s + i.fiber, 0),
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

      await supabase.from('meals').insert({
        user_id: userId,
        meal_name: meal.meal_name,
        eaten_at: meal.eaten_at,
        total_calories: meal.total_calories,
        total_protein_g: meal.total_protein,
        total_carbs_g: meal.total_carbs,
        total_fat_g: meal.total_fat,
        source: 'ai_vision',
      });

      addMeal(meal);
      router.back();
    } catch (err) {
      Alert.alert(t('errors.generic'), String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  if (analyzing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>{t('meal.analyzing')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('dashboard.addMeal')}</Text>

      <TouchableOpacity style={styles.option} onPress={() => pickAndAnalyze('camera')}>
        <Text style={styles.optionText}>📷  {t('meal.takePhoto')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => pickAndAnalyze('library')}>
        <Text style={styles.optionText}>🖼️  {t('meal.chooseFromLibrary')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.option} onPress={() => router.push('/meal/manual')}>
        <Text style={styles.optionText}>✏️  {t('meal.manualEntry')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancel} onPress={() => router.back()}>
        <Text style={styles.cancelText}>{t('cancel')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050D2D', justifyContent: 'center', padding: 24 },
  loadingContainer: { flex: 1, backgroundColor: '#050D2D', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16, fontSize: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 32, textAlign: 'center' },
  option: { backgroundColor: '#1A2444', borderRadius: 12, padding: 18, marginBottom: 12 },
  optionText: { color: '#fff', fontSize: 16 },
  cancel: { marginTop: 8, padding: 16, alignItems: 'center' },
  cancelText: { color: '#888', fontSize: 16 },
});
