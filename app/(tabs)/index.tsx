import { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { useMealStore } from '../../src/stores/mealStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { formatCalories, formatMacro } from '../../src/utils/formatting';

function getGreeting(name: string, t: (key: string, opts?: any) => string) {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t('dashboard.greeting_morning', { name });
  if (h >= 12 && h < 17) return t('dashboard.greeting_afternoon', { name });
  return t('dashboard.greeting_evening', { name });
}

function MacroBar({ value, target, color }: { value: number; target: number; color: string }) {
  const pct = Math.min(value / target, 1);
  return (
    <View style={macroBarStyles.track}>
      <View style={[macroBarStyles.fill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const macroBarStyles = StyleSheet.create({
  track: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  fill:  { height: 4, borderRadius: 2 },
});

export default function DashboardScreen() {
  const { t } = useTranslation();
  const session = useAuthStore((s) => s.session);
  const loading = useAuthStore((s) => s.loading);
  const { todayMeals, loadTodayMeals } = useMealStore();
  const { profile, fetchProfile, loading: profileLoading } = useProfileStore();

  useEffect(() => {
    if (session?.user) {
      fetchProfile(session.user.id);
      loadTodayMeals(session.user.id);
    }
  }, [session?.user?.id]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!profileLoading && profile !== null && profile.onboarding_completed !== true) {
      router.replace('/(auth)/onboarding/step1');
    }
  }, [profile, profileLoading]);

  if (loading || profileLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2DB04B" />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/sign-in" />;

  // Use profile targets or safe defaults
  const CALORIE_TARGET = profile?.daily_calorie_target ?? 2000;
  const PROTEIN_TARGET = profile?.daily_protein_target ?? 160;
  const CARBS_TARGET   = profile?.daily_carbs_target   ?? 275;
  const FAT_TARGET     = profile?.daily_fat_target     ?? 73;

  const totalCalories = todayMeals.reduce((s, m) => s + m.total_calories, 0);
  const totalProtein  = todayMeals.reduce((s, m) => s + m.total_protein, 0);
  const totalCarbs    = todayMeals.reduce((s, m) => s + m.total_carbs, 0);
  const totalFat      = todayMeals.reduce((s, m) => s + m.total_fat, 0);

  const remaining = CALORIE_TARGET - totalCalories;
  const isOver    = remaining < 0;

  const displayName =
    profile?.name ||
    session.user.email?.split('@')[0] ||
    'there';

  const greeting = getGreeting(displayName, t);
  const dateStr  = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const macros = [
    { label: t('dashboard.protein'), value: totalProtein, target: PROTEIN_TARGET, color: '#2DB04B', icon: '💪' },
    { label: t('dashboard.carbs'),   value: totalCarbs,   target: CARBS_TARGET,   color: '#F97316', icon: '🌾' },
    { label: t('dashboard.fat'),     value: totalFat,     target: FAT_TARGET,     color: '#EAB308', icon: '🥑' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.date}>{dateStr}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
        </View>
      </View>

      {/* Calorie Ring Card */}
      <View style={styles.card}>
        <View style={styles.calorieRow}>
          <View style={styles.ring}>
            <Text style={styles.ringNumber}>{Math.round(totalCalories)}</Text>
            <Text style={styles.ringKcal}>kcal</Text>
            <Text style={styles.ringLabel}>consumed</Text>
          </View>
          <View style={styles.calorieMeta}>
            <View>
              <Text style={styles.metaLabel}>🔥 {t('dashboard.daily_goal')}</Text>
              <Text style={styles.metaValue}>{CALORIE_TARGET.toLocaleString()} kcal</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={styles.metaLabel}>{t('dashboard.remaining')}</Text>
              <Text style={[styles.metaRemaining, isOver && styles.metaOver]}>
                {isOver
                  ? `Over by ${formatCalories(Math.abs(remaining))}`
                  : formatCalories(remaining)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Macro Cards */}
      <View style={styles.macroRow}>
        {macros.map((m) => {
          const pct = Math.round((m.value / m.target) * 100);
          return (
            <View key={m.label} style={styles.macroCard}>
              <View style={[styles.macroIcon, { backgroundColor: m.color + '20' }]}>
                <Text style={styles.macroIconText}>{m.icon}</Text>
              </View>
              <Text style={styles.macroLabel}>{m.label}</Text>
              <Text style={styles.macroValue}>{formatMacro(m.value)}</Text>
              <Text style={styles.macroTarget}>/ {m.target}g goal</Text>
              <MacroBar value={m.value} target={m.target} color={m.color} />
              <Text style={[styles.macroPct, { color: m.color }]}>{pct}%</Text>
            </View>
          );
        })}
      </View>

      {/* Add Meal Button */}
      <TouchableOpacity style={styles.addButton} onPress={() => router.push('/meal/camera')}>
        <Text style={styles.addButtonText}>＋ {t('dashboard.add_meal')}</Text>
        <Text style={styles.addButtonIcon}>📷</Text>
      </TouchableOpacity>

      {/* Today's Meals */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('dashboard.todays_meals')}</Text>
      </View>

      {todayMeals.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🍽️</Text>
          <Text style={styles.emptyText}>No meals logged yet.</Text>
          <Text style={styles.emptyHint}>Tap the green button above to add your first meal!</Text>
        </View>
      ) : (
        <View style={styles.mealsCard}>
          {todayMeals.map((meal, idx) => (
            <View key={meal.id}>
              <TouchableOpacity style={styles.mealRow} activeOpacity={0.7}>
                {meal.photo_url ? (
                  <Image source={{ uri: meal.photo_url }} style={styles.mealPhoto} />
                ) : (
                  <View style={[styles.mealPhoto, styles.mealPhotoPlaceholder]}>
                    <Text style={{ fontSize: 26 }}>🍽️</Text>
                  </View>
                )}
                <View style={styles.mealInfo}>
                  <Text style={styles.mealName} numberOfLines={1}>{meal.meal_name}</Text>
                  <Text style={styles.mealMacros}>
                    {formatMacro(meal.total_protein)} Protein · {formatMacro(meal.total_carbs)} Carbs · {formatMacro(meal.total_fat)} Fat
                  </Text>
                </View>
                <View style={styles.mealRight}>
                  <Text style={styles.mealCal}>{Math.round(meal.total_calories)}</Text>
                  <Text style={styles.mealCalLabel}>kcal</Text>
                </View>
              </TouchableOpacity>
              {idx < todayMeals.length - 1 && <View style={styles.separator} />}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF8' },
  content:   { padding: 16, paddingTop: 56, paddingBottom: 40 },
  center:    { flex: 1, backgroundColor: '#F8FAF8', justifyContent: 'center', alignItems: 'center' },

  header:      { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  greeting:    { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A' },
  date:        { fontSize: 13, color: '#6B7280', marginTop: 2 },
  avatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2DB04B', justifyContent: 'center', alignItems: 'center', marginLeft: 12 },
  avatarText:  { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  calorieRow:  { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ring:        { width: 110, height: 110, borderRadius: 55, borderWidth: 10, borderColor: '#2DB04B', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  ringNumber:  { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A' },
  ringKcal:    { fontSize: 11, color: '#2DB04B', fontWeight: '600' },
  ringLabel:   { fontSize: 10, color: '#6B7280' },
  calorieMeta: { flex: 1, gap: 12 },
  metaLabel:   { fontSize: 12, color: '#6B7280' },
  metaValue:   { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  metaRemaining:{ fontSize: 18, fontWeight: 'bold', color: '#2DB04B' },
  metaOver:    { color: '#EF4444' },
  divider:     { height: 1, backgroundColor: '#E5E7EB' },

  macroRow:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  macroCard:     { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  macroIcon:     { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  macroIconText: { fontSize: 18 },
  macroLabel:    { fontSize: 11, color: '#6B7280' },
  macroValue:    { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginTop: 2 },
  macroTarget:   { fontSize: 10, color: '#9CA3AF' },
  macroPct:      { fontSize: 11, fontWeight: '600', marginTop: 4 },

  addButton:     { backgroundColor: '#2DB04B', borderRadius: 12, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  addButtonIcon: { fontSize: 20 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },

  emptyCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  emptyHint:  { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6 },

  mealsCard:          { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  mealRow:            { flexDirection: 'row', alignItems: 'center', padding: 14 },
  mealPhoto:          { width: 58, height: 58, borderRadius: 10, marginRight: 12 },
  mealPhotoPlaceholder:{ backgroundColor: '#E8F5EC', justifyContent: 'center', alignItems: 'center' },
  mealInfo:           { flex: 1 },
  mealName:           { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  mealMacros:         { fontSize: 12, color: '#6B7280' },
  mealRight:          { alignItems: 'flex-end', marginLeft: 8 },
  mealCal:            { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  mealCalLabel:       { fontSize: 11, color: '#6B7280' },
  separator:          { height: 1, backgroundColor: '#F3F4F6', marginLeft: 84 },
});
