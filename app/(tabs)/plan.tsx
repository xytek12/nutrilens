import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useProfileStore } from '../../src/stores/profileStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { generatePlan, AIPlan, PlanMealType, PlanLevel } from '../../src/lib/gemini';
import { loadActivePlan, saveActivePlan } from '../../src/lib/planCache';

type MealType = PlanMealType;
type WorkoutLevel = 'level_beginner' | 'level_intermediate' | 'level_advanced';

// Fallback shown only if AI generation fails on first load
const FALLBACK_PLAN: AIPlan = {
  meals: [
    { type: 'breakfast', emoji: '🌅', name: 'Oatmeal with berries & almonds', calories: 500, protein_g: 18, carbs_g: 62, fat_g: 10 },
    { type: 'lunch',     emoji: '☀️', name: 'Grilled chicken salad',          calories: 640, protein_g: 42, carbs_g: 28, fat_g: 18 },
    { type: 'dinner',    emoji: '🌙', name: 'Salmon with quinoa & veggies',   calories: 760, protein_g: 45, carbs_g: 55, fat_g: 16 },
    { type: 'snack',     emoji: '🍎', name: 'Greek yogurt with nuts',         calories: 320, protein_g: 18, carbs_g: 22, fat_g: 9  },
  ],
  workout: { name: 'Full Body Strength', duration_min: 30, level: 'intermediate', kcal_burned: 280 },
};

function workoutLevelKey(lvl: PlanLevel): WorkoutLevel {
  return lvl === 'beginner' ? 'level_beginner' : lvl === 'advanced' ? 'level_advanced' : 'level_intermediate';
}

function PlanMealRow({ emoji, type, name, cal, protein, carbs, fat, onReplace }: {
  emoji: string; type: MealType; name: string; cal: number; protein: number; carbs: number; fat: number; onReplace: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={mealRow.wrapper}>
      <View style={mealRow.dot} />
      <View style={mealRow.card}>
        <View style={mealRow.left}>
          <Text style={mealRow.time}>{emoji} {t(`meals.${type}`)}</Text>
          <Text style={mealRow.name}>{name}</Text>
          <Text style={mealRow.macros}>{protein}g {t('dashboard.protein')} · {carbs}g {t('dashboard.carbs')} · {fat}g {t('dashboard.fat')}</Text>
        </View>
        <View style={mealRow.right}>
          <Text style={mealRow.cal}>{cal}</Text>
          <Text style={mealRow.calLabel}>{t('common.kcal')}</Text>
          <TouchableOpacity style={mealRow.replaceBtn} onPress={onReplace}>
            <Text style={mealRow.replaceTxt}>↺</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
const mealRow = StyleSheet.create({
  wrapper:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  dot:        { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2DB04B', marginTop: 16, marginRight: 12, flexShrink: 0 },
  card:       { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  left:       { flex: 1, marginRight: 8 },
  time:       { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  name:       { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  macros:     { fontSize: 12, color: '#6B7280' },
  right:      { alignItems: 'flex-end', gap: 4 },
  cal:        { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  calLabel:   { fontSize: 11, color: '#6B7280' },
  replaceBtn: { backgroundColor: '#E8F5EC', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  replaceTxt: { fontSize: 14, color: '#2DB04B', fontWeight: '700' },
});

export default function PlanScreen() {
  const { t }       = useTranslation();
  const { profile } = useProfileStore();
  const session     = useAuthStore((s) => s.session);
  const userId      = session?.user?.id;

  const [plan, setPlan]             = useState<AIPlan>(FALLBACK_PLAN);
  const [generating, setGenerating] = useState(false);
  const [loadingCache, setLoadingCache] = useState(true);
  const [hasGenerated, setHasGenerated] = useState(false);

  const goal          = profile?.goal ?? 'maintain';
  const calorieTarget = profile?.daily_calorie_target ?? 2000;
  const proteinTarget = profile?.daily_protein_target ?? 160;
  const carbsTarget   = profile?.daily_carbs_target   ?? 275;
  const fatTarget     = profile?.daily_fat_target     ?? 73;

  const goalLabelKey = goal === 'lose' ? 'plan.goal_lose_label' : goal === 'gain' ? 'plan.goal_gain_label' : 'plan.goal_maintain_label';
  const goalDescKey  = goal === 'lose' ? 'plan.goal_lose_desc'  : goal === 'gain' ? 'plan.goal_gain_desc'  : 'plan.goal_maintain_desc';

  // Order meals in canonical breakfast → snack order for display
  const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
  const meals = [...plan.meals].sort(
    (a, b) => MEAL_ORDER.indexOf(a.type) - MEAL_ORDER.indexOf(b.type),
  );
  const totalCal = meals.reduce((s, m) => s + m.calories, 0);
  const workout  = plan.workout;

  // On mount / profile load: try cache first, only call AI if no cached plan for today
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (hasGenerated) return;
      if (!userId || !profile?.daily_calorie_target) return;

      setLoadingCache(true);
      const cached = await loadActivePlan(userId, i18n.language);
      if (cancelled) return;

      if (cached) {
        setPlan(cached);
        setHasGenerated(true);
        setLoadingCache(false);
        return;
      }
      // No cache hit — generate fresh in the background
      setLoadingCache(false);
      handleGenerate(true);
    }
    init();
    return () => { cancelled = true; };
  }, [userId, profile?.daily_calorie_target, i18n.language]);

  async function handleGenerate(silent = false) {
    if (generating) return;
    setGenerating(true);
    try {
      const generated = await generatePlan({
        goal: goal as 'lose' | 'maintain' | 'gain',
        calories: calorieTarget,
        protein_g: proteinTarget,
        carbs_g: carbsTarget,
        fat_g: fatTarget,
        activity_level: profile?.activity_level,
        dietary_preferences: profile?.dietary_preferences,
        language: i18n.language,
      });
      setPlan(generated);
      setHasGenerated(true);
      // Best-effort save — never blocks UI
      if (userId) saveActivePlan(userId, i18n.language, generated);
      if (!silent) {
        Alert.alert(
          t('plan.new_plan_ready'),
          t('plan.new_plan_msg'),
          [{ text: t('plan.got_it'), style: 'default' }],
        );
      }
    } catch (err: any) {
      if (!silent) {
        Alert.alert(t('common.error'), err?.message || 'Could not generate plan.');
      }
      // Keep the existing plan (fallback or previously generated)
    } finally {
      setGenerating(false);
    }
  }

  function replaceMeal() {
    // Quick action: regenerate the whole plan
    handleGenerate(true);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('plan.title')}</Text>
        <Text style={styles.subtitle}>{t('plan.subtitle')}</Text>
      </View>

      {/* Goal Card */}
      <View style={styles.goalCard}>
        <View style={styles.goalLeft}>
          <View style={styles.goalIcon}>
            <Text style={{ fontSize: 22 }}>🎯</Text>
          </View>
          <View>
            <Text style={styles.goalType}>{t(goalLabelKey)}</Text>
            <Text style={styles.goalDesc}>{t(goalDescKey)}</Text>
          </View>
        </View>
        <View style={styles.goalRight}>
          <View style={styles.targetBadge}>
            <Text style={styles.targetBadgeText}>{t('plan.daily_target')}</Text>
          </View>
          <Text style={styles.targetCal}>{totalCal.toLocaleString()}</Text>
          <Text style={styles.targetCalLabel}>{t('common.kcal')}</Text>
        </View>
      </View>

      {/* Macro summary */}
      <View style={styles.macroSummary}>
        <View style={styles.macroItem}>
          <Text style={styles.macroNum}>{proteinTarget}g</Text>
          <Text style={[styles.macroLbl, { color: '#2DB04B' }]}>{t('dashboard.protein')}</Text>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroNum}>{carbsTarget}g</Text>
          <Text style={[styles.macroLbl, { color: '#F97316' }]}>{t('dashboard.carbs')}</Text>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroNum}>{fatTarget}g</Text>
          <Text style={[styles.macroLbl, { color: '#EAB308' }]}>{t('dashboard.fat')}</Text>
        </View>
      </View>

      {/* Today's plan */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t('plan.plan_for_today')}</Text>
        <Text style={styles.sectionHint}>{t('plan.tap_to_replace')}</Text>
      </View>
      {(generating && !hasGenerated) || loadingCache ? (
        <View style={styles.generatingCard}>
          <ActivityIndicator size="large" color="#2DB04B" />
          <Text style={styles.generatingTxt}>{t('plan.generating')}</Text>
        </View>
      ) : (
        <View style={styles.timeline}>
          {meals.map((item) => (
            <PlanMealRow
              key={item.type}
              emoji={item.emoji}
              type={item.type}
              name={item.name}
              cal={item.calories}
              protein={item.protein_g}
              carbs={item.carbs_g}
              fat={item.fat_g}
              onReplace={() => replaceMeal()}
            />
          ))}
        </View>
      )}

      {/* AI Workout Card */}
      <View style={styles.workoutCard}>
        <Text style={styles.workoutBadge}>{t('plan.ai_workout_pick')}</Text>
        <Text style={styles.workoutName}>{workout.name}</Text>
        <Text style={styles.workoutMeta}>
          {workout.duration_min} min · {t(`plan.${workoutLevelKey(workout.level)}`)} · {workout.kcal_burned} {t('plan.kcal_burned')}
        </Text>
        <TouchableOpacity
          style={styles.workoutBtn}
          onPress={() => Alert.alert(t('plan.coming_soon_title'), t('plan.coming_soon_msg'))}
        >
          <Text style={styles.workoutBtnText}>{t('plan.start_workout')}</Text>
        </TouchableOpacity>
      </View>

      {/* Why this plan */}
      <TouchableOpacity
        style={styles.whyCard}
        onPress={() => Alert.alert(
          t('plan.why_this_plan'),
          t('plan.why_alert_body', {
            goal: t(goalLabelKey),
            calories: calorieTarget,
            protein: proteinTarget,
            carbs: carbsTarget,
            fat: fatTarget,
          }),
        )}
      >
        <View style={styles.whyIcon}>
          <Text style={{ fontSize: 20 }}>💡</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.whyTitle}>{t('plan.why_this_plan')}</Text>
          <Text style={styles.whyDesc}>{t('plan.why_desc')}</Text>
        </View>
        <Text style={styles.whyArrow}>›</Text>
      </TouchableOpacity>

      {/* Generate new plan */}
      <TouchableOpacity style={styles.generateBtn} onPress={() => handleGenerate(false)} disabled={generating}>
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateBtnText}>{t('plan.regenerate')}</Text>
        )}
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF8' },
  content:   { padding: 16, paddingTop: 56, paddingBottom: 40 },

  header:   { marginBottom: 20 },
  title:    { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 4 },

  goalCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  goalLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  goalIcon:        { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5EC', justifyContent: 'center', alignItems: 'center' },
  goalType:        { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  goalDesc:        { fontSize: 12, color: '#6B7280', marginTop: 2 },
  goalRight:       { alignItems: 'flex-end' },
  targetBadge:     { backgroundColor: '#E8F5EC', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  targetBadgeText: { fontSize: 11, color: '#2DB04B', fontWeight: '600' },
  targetCal:       { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  targetCalLabel:  { fontSize: 12, color: '#6B7280' },

  macroSummary: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  macroItem:    { alignItems: 'center' },
  macroNum:     { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  macroLbl:     { fontSize: 12, fontWeight: '600', marginTop: 2 },
  macroDivider: { width: 1, backgroundColor: '#E5E7EB' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  sectionHint:   { fontSize: 12, color: '#9CA3AF' },
  timeline:      { marginBottom: 20 },

  workoutCard:    { backgroundColor: '#E8F5EC', borderRadius: 16, padding: 20, marginBottom: 12 },
  workoutBadge:   { fontSize: 11, color: '#2DB04B', fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  workoutName:    { fontSize: 20, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  workoutMeta:    { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  workoutBtn:     { backgroundColor: '#2DB04B', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10, alignSelf: 'flex-start' },
  workoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  whyCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  whyIcon:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5EC', justifyContent: 'center', alignItems: 'center' },
  whyTitle: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  whyDesc:  { fontSize: 12, color: '#6B7280', marginTop: 2 },
  whyArrow: { fontSize: 20, color: '#9CA3AF', marginLeft: 8 },

  generateBtn:     { backgroundColor: '#2DB04B', borderRadius: 12, padding: 18, alignItems: 'center' },
  generateBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  generatingCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  generatingTxt:   { fontSize: 14, color: '#6B7280', marginTop: 12, fontWeight: '600' },
});
