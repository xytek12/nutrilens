import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { useMealStore } from '../../src/stores/mealStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { formatCalories, formatMacro } from '../../src/utils/formatting';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const { todayMeals } = useMealStore();
  const { profile, fetchProfile } = useProfileStore();

  useEffect(() => {
    if (session?.user) fetchProfile(session.user.id);
  }, [session?.user?.id]);

  // Show spinner while Supabase is checking the session
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // Use Redirect component (not router.replace) — safe before layout mounts
  if (!session) return <Redirect href="/(auth)/sign-in" />;

  const totalCalories = todayMeals.reduce((s, m) => s + m.total_calories, 0);
  const totalProtein = todayMeals.reduce((s, m) => s + m.total_protein, 0);
  const totalCarbs = todayMeals.reduce((s, m) => s + m.total_carbs, 0);
  const totalFat = todayMeals.reduce((s, m) => s + m.total_fat, 0);
  const calorieTarget = 2000;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hey {profile?.name || 'there'} 👋</Text>
        <Text style={styles.date}>{new Date().toDateString()}</Text>
      </View>

      <View style={styles.calorieCard}>
        <Text style={styles.calorieNumber}>{Math.round(totalCalories)}</Text>
        <Text style={styles.calorieLabel}>{t('dashboard.calories')}</Text>
        <Text style={styles.calorieRemaining}>
          {t('dashboard.remaining')}: {formatCalories(calorieTarget - totalCalories)}
        </Text>
      </View>

      <View style={styles.macroRow}>
        {[
          { label: t('dashboard.protein'), value: totalProtein },
          { label: t('dashboard.carbs'), value: totalCarbs },
          { label: t('dashboard.fat'), value: totalFat },
        ].map((m) => (
          <View key={m.label} style={styles.macroBox}>
            <Text style={styles.macroValue}>{formatMacro(m.value)}</Text>
            <Text style={styles.macroLabel}>{m.label}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/meal/camera')}>
        <Text style={styles.addButtonText}>+ {t('dashboard.addMeal')}</Text>
      </TouchableOpacity>

      {todayMeals.map((meal) => (
        <View key={meal.id} style={styles.mealCard}>
          <Text style={styles.mealName}>{meal.meal_name}</Text>
          <Text style={styles.mealCal}>{formatCalories(meal.total_calories)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050D2D' },
  center: { flex: 1, backgroundColor: '#050D2D', justifyContent: 'center', alignItems: 'center' },
  header: { padding: 24, paddingTop: 60 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  date: { fontSize: 14, color: '#888', marginTop: 4 },
  calorieCard: { margin: 16, backgroundColor: '#1A2444', borderRadius: 16, padding: 24, alignItems: 'center' },
  calorieNumber: { fontSize: 48, fontWeight: 'bold', color: '#4CAF50' },
  calorieLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  calorieRemaining: { fontSize: 14, color: '#fff', marginTop: 8 },
  macroRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8 },
  macroBox: { flex: 1, backgroundColor: '#1A2444', borderRadius: 12, padding: 16, alignItems: 'center' },
  macroValue: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  macroLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  addButton: { margin: 16, backgroundColor: '#4CAF50', borderRadius: 12, padding: 16, alignItems: 'center' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  mealCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: '#1A2444', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between' },
  mealName: { color: '#fff', fontSize: 15 },
  mealCal: { color: '#4CAF50', fontSize: 15, fontWeight: '600' },
});
