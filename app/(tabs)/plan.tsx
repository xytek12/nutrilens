import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useProfileStore } from '../../src/stores/profileStore';

const GOAL_LABEL: Record<string, string> = {
  lose:     '🔥 Fat Loss',
  maintain: '⚖️  Stay Fit',
  gain:     '💪 Muscle Gain',
};
const GOAL_DESC: Record<string, string> = {
  lose:     'Lose fat and improve definition',
  maintain: 'Maintain weight and stay healthy',
  gain:     'Build strength and muscle mass',
};

// Static sample meals — in the future these will be AI-generated
const BASE_MEALS = [
  { time: '🌅', type: 'Breakfast', name: 'Oatmeal with berries & almonds', pct: 0.23, protein: 18, carbs: 62, fat: 10 },
  { time: '☀️', type: 'Lunch',     name: 'Grilled chicken salad',          pct: 0.29, protein: 42, carbs: 28, fat: 18 },
  { time: '🌙', type: 'Dinner',    name: 'Salmon with quinoa & veggies',   pct: 0.34, protein: 45, carbs: 55, fat: 16 },
  { time: '🍎', type: 'Snack',     name: 'Greek yogurt with nuts',         pct: 0.14, protein: 18, carbs: 22, fat: 9  },
];

function PlanMealRow({ time, type, name, cal, protein, carbs, fat }: {
  time: string; type: string; name: string; cal: number; protein: number; carbs: number; fat: number;
}) {
  return (
    <View style={mealRow.wrapper}>
      <View style={mealRow.dot} />
      <View style={mealRow.card}>
        <View style={mealRow.left}>
          <Text style={mealRow.time}>{time} {type}</Text>
          <Text style={mealRow.name}>{name}</Text>
          <Text style={mealRow.macros}>{protein}g Protein · {carbs}g Carbs · {fat}g Fat</Text>
        </View>
        <View style={mealRow.right}>
          <Text style={mealRow.cal}>{cal}</Text>
          <Text style={mealRow.calLabel}>kcal</Text>
        </View>
      </View>
    </View>
  );
}
const mealRow = StyleSheet.create({
  wrapper:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  dot:      { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2DB04B', marginTop: 16, marginRight: 12, flexShrink: 0 },
  card:     { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  left:     { flex: 1, marginRight: 8 },
  time:     { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  name:     { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginBottom: 4 },
  macros:   { fontSize: 12, color: '#6B7280' },
  right:    { alignItems: 'flex-end' },
  cal:      { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  calLabel: { fontSize: 11, color: '#6B7280' },
});

export default function PlanScreen() {
  const { profile } = useProfileStore();
  const [generating, setGenerating] = useState(false);

  const goal          = profile?.goal ?? 'maintain';
  const calorieTarget = profile?.daily_calorie_target ?? 2000;
  const proteinTarget = profile?.daily_protein_target ?? 160;
  const carbsTarget   = profile?.daily_carbs_target   ?? 275;
  const fatTarget     = profile?.daily_fat_target     ?? 73;

  // Scale static meals to fit the user's calorie target
  const meals = BASE_MEALS.map((m) => ({
    ...m,
    cal: Math.round(calorieTarget * m.pct),
  }));
  const totalCal = meals.reduce((s, m) => s + m.cal, 0);

  async function handleGenerate() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 1500)); // simulate loading
    setGenerating(false);
    Alert.alert(
      '✨ Plan Updated',
      'Your meal plan has been refreshed based on your current goals and activity level.',
      [{ text: 'Got it', style: 'default' }],
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Plan</Text>
        <Text style={styles.subtitle}>Meals and workouts tailored to your goals</Text>
      </View>

      {/* Goal Card */}
      <View style={styles.goalCard}>
        <View style={styles.goalLeft}>
          <View style={styles.goalIcon}>
            <Text style={{ fontSize: 22 }}>🎯</Text>
          </View>
          <View>
            <Text style={styles.goalType}>{GOAL_LABEL[goal] ?? goal}</Text>
            <Text style={styles.goalDesc}>{GOAL_DESC[goal] ?? ''}</Text>
          </View>
        </View>
        <View style={styles.goalRight}>
          <View style={styles.targetBadge}>
            <Text style={styles.targetBadgeText}>Daily Target</Text>
          </View>
          <Text style={styles.targetCal}>{totalCal.toLocaleString()}</Text>
          <Text style={styles.targetCalLabel}>kcal</Text>
        </View>
      </View>

      {/* Macro summary */}
      <View style={styles.macroSummary}>
        <View style={styles.macroItem}>
          <Text style={styles.macroNum}>{proteinTarget}g</Text>
          <Text style={[styles.macroLbl, { color: '#2DB04B' }]}>Protein</Text>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroNum}>{carbsTarget}g</Text>
          <Text style={[styles.macroLbl, { color: '#F97316' }]}>Carbs</Text>
        </View>
        <View style={styles.macroDivider} />
        <View style={styles.macroItem}>
          <Text style={styles.macroNum}>{fatTarget}g</Text>
          <Text style={[styles.macroLbl, { color: '#EAB308' }]}>Fat</Text>
        </View>
      </View>

      {/* Today's plan */}
      <Text style={styles.sectionTitle}>Your Plan for Today</Text>
      <View style={styles.timeline}>
        {meals.map((item) => (
          <PlanMealRow key={item.type} {...item} />
        ))}
      </View>

      {/* AI Workout Card */}
      <View style={styles.workoutCard}>
        <Text style={styles.workoutBadge}>✨ AI WORKOUT SUGGESTION</Text>
        <Text style={styles.workoutName}>Full Body Strength</Text>
        <Text style={styles.workoutMeta}>20 min · Intermediate · 210 kcal burned</Text>
        <TouchableOpacity style={styles.workoutBtn} onPress={() => Alert.alert('Coming soon', 'Workout plans are coming in the next update!')}>
          <Text style={styles.workoutBtnText}>Start Workout ›</Text>
        </TouchableOpacity>
      </View>

      {/* Why this plan */}
      <TouchableOpacity style={styles.whyCard} onPress={() => Alert.alert('Why this plan?', `Your plan is based on:\n\n• Goal: ${GOAL_LABEL[goal] ?? goal}\n• Daily calories: ${calorieTarget} kcal\n• Protein: ${proteinTarget}g\n• Carbs: ${carbsTarget}g\n• Fat: ${fatTarget}g\n\nTargets are calculated using the Mifflin-St Jeor formula.`)}>
        <View style={styles.whyIcon}>
          <Text style={{ fontSize: 20 }}>💡</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.whyTitle}>Why this plan?</Text>
          <Text style={styles.whyDesc}>Based on your goal, activity level, and body measurements.</Text>
        </View>
        <Text style={styles.whyArrow}>›</Text>
      </TouchableOpacity>

      {/* Generate new plan */}
      <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateBtnText}>✨ Generate New Plan</Text>
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

  goalCard:       { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 2, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  goalLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  goalIcon:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E8F5EC', justifyContent: 'center', alignItems: 'center' },
  goalType:       { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  goalDesc:       { fontSize: 12, color: '#6B7280', marginTop: 2 },
  goalRight:      { alignItems: 'flex-end' },
  targetBadge:    { backgroundColor: '#E8F5EC', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 4 },
  targetBadgeText:{ fontSize: 11, color: '#2DB04B', fontWeight: '600' },
  targetCal:      { fontSize: 22, fontWeight: 'bold', color: '#1A1A1A' },
  targetCalLabel: { fontSize: 12, color: '#6B7280' },

  macroSummary: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 24, flexDirection: 'row', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  macroItem:    { alignItems: 'center' },
  macroNum:     { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  macroLbl:     { fontSize: 12, fontWeight: '600', marginTop: 2 },
  macroDivider: { width: 1, backgroundColor: '#E5E7EB' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },
  timeline:     { marginBottom: 20 },

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
});
