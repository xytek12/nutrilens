import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useMealStore } from '../../src/stores/mealStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { formatMacro } from '../../src/utils/formatting';

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconBox, { backgroundColor: color + '20' }]}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <Text style={statStyles.label}>{label}</Text>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={[statStyles.sub, { color }]}>{sub}</Text>
    </View>
  );
}
const statStyles = StyleSheet.create({
  card:    { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  label:   { fontSize: 11, color: '#6B7280', textAlign: 'center' },
  value:   { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginTop: 2 },
  sub:     { fontSize: 11, fontWeight: '600', marginTop: 2 },
});

function MacroRow({ label, value, target, color, icon }: { label: string; value: number; target: number; color: string; icon: string }) {
  const pct = Math.min(Math.round((value / target) * 100), 100);
  return (
    <View style={macroStyles.row}>
      <View style={[macroStyles.iconBox, { backgroundColor: color + '20' }]}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={macroStyles.label}>{label}</Text>
          <Text style={macroStyles.values}>{formatMacro(value)} <Text style={macroStyles.target}>/ {target}g</Text></Text>
        </View>
        <View style={macroStyles.track}>
          <View style={[macroStyles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[macroStyles.pct, { color }]}>{pct}%</Text>
    </View>
  );
}
const macroStyles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconBox:{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  label:  { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  values: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A' },
  target: { fontWeight: '400', color: '#9CA3AF' },
  track:  { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  fill:   { height: 6, borderRadius: 3 },
  pct:    { width: 40, textAlign: 'right', fontSize: 12, fontWeight: '700' },
});

export default function ProgressScreen() {
  const session   = useAuthStore((s) => s.session);
  const { todayMeals, loadTodayMeals } = useMealStore();
  const { profile } = useProfileStore();
  const [period, setPeriod] = useState<'Week' | 'Month' | '3 Months'>('Week');

  useEffect(() => {
    if (session?.user) loadTodayMeals(session.user.id);
  }, [session?.user?.id]);

  // Use profile targets or safe defaults
  const CALORIE_TARGET = profile?.daily_calorie_target ?? 2000;
  const PROTEIN_TARGET = profile?.daily_protein_target ?? 160;
  const CARBS_TARGET   = profile?.daily_carbs_target   ?? 275;
  const FAT_TARGET     = profile?.daily_fat_target     ?? 73;

  const totalCalories = todayMeals.reduce((s, m) => s + m.total_calories, 0);
  const totalProtein  = todayMeals.reduce((s, m) => s + m.total_protein, 0);
  const totalCarbs    = todayMeals.reduce((s, m) => s + m.total_carbs, 0);
  const totalFat      = todayMeals.reduce((s, m) => s + m.total_fat, 0);
  const calPct        = Math.round((totalCalories / CALORIE_TARGET) * 100);
  const onTrack       = totalCalories <= CALORIE_TARGET;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.header}>
        <Text style={styles.title}>Progress</Text>
        <Text style={[styles.subtitle, { color: onTrack ? '#2DB04B' : '#EF4444' }]}>
          {onTrack ? "You're on track today ✅" : "Over your calorie goal today ⚠️"}
        </Text>
      </View>

      {/* Period toggle */}
      <View style={styles.toggle}>
        {(['Week', 'Month', '3 Months'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.toggleLabel, period === p && styles.toggleLabelActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Today's stats */}
      <Text style={styles.sectionTitle}>Today's Summary</Text>
      <View style={styles.statsRow}>
        <StatCard icon="🔥" label="Calories" value={`${Math.round(totalCalories)}`} sub={`${calPct}% of goal`} color="#F97316" />
        <StatCard icon="💧" label="Remaining" value={`${Math.max(0, CALORIE_TARGET - Math.round(totalCalories))}`} sub="kcal left" color="#2DB04B" />
        <StatCard icon="🍽️" label="Meals" value={`${todayMeals.length}`} sub="logged today" color="#3B82F6" />
      </View>

      {/* Macros breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Macros</Text>
        <MacroRow label="Protein"       value={totalProtein} target={PROTEIN_TARGET} color="#2DB04B" icon="💪" />
        <MacroRow label="Carbohydrates" value={totalCarbs}   target={CARBS_TARGET}   color="#F97316" icon="🌾" />
        <MacroRow label="Fat"           value={totalFat}     target={FAT_TARGET}     color="#EAB308" icon="🥑" />
      </View>

      {/* Calories bar */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Calories vs Goal</Text>
        <View style={styles.calBarRow}>
          <Text style={styles.calBarLabel}>Consumed</Text>
          <Text style={styles.calBarValue}>{Math.round(totalCalories)} kcal</Text>
        </View>
        <View style={styles.calTrack}>
          <View style={[styles.calFill, {
            width: `${Math.min(calPct, 100)}%` as any,
            backgroundColor: onTrack ? '#2DB04B' : '#EF4444',
          }]} />
        </View>
        <View style={styles.calBarRow}>
          <Text style={styles.calBarLabel}>Goal</Text>
          <Text style={styles.calBarValue}>{CALORIE_TARGET} kcal</Text>
        </View>
        <Text style={[styles.calStatus, { color: onTrack ? '#2DB04B' : '#EF4444' }]}>
          {onTrack
            ? `${CALORIE_TARGET - Math.round(totalCalories)} kcal remaining`
            : `${Math.round(totalCalories) - CALORIE_TARGET} kcal over goal`}
        </Text>
      </View>

      {/* Charts coming soon */}
      <View style={styles.comingSoon}>
        <Text style={styles.comingSoonIcon}>📈</Text>
        <Text style={styles.comingSoonText}>Weight trend charts coming soon</Text>
        <Text style={styles.comingSoonHint}>Log your weight daily to track progress over time</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF8' },
  content:   { padding: 16, paddingTop: 56, paddingBottom: 40 },

  header:   { marginBottom: 20 },
  title:    { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A' },
  subtitle: { fontSize: 14, marginTop: 4, fontWeight: '500' },

  toggle:           { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4, marginBottom: 24 },
  toggleBtn:        { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive:  { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  toggleLabel:      { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  toggleLabelActive:{ color: '#1A1A1A', fontWeight: '700' },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 12 },
  statsRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },

  card:      { backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 16 },

  calBarRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  calBarLabel: { fontSize: 13, color: '#6B7280' },
  calBarValue: { fontSize: 13, fontWeight: '600', color: '#1A1A1A' },
  calTrack:    { height: 12, backgroundColor: '#E5E7EB', borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  calFill:     { height: 12, borderRadius: 6 },
  calStatus:   { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 4 },

  comingSoon:     { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  comingSoonIcon: { fontSize: 48, marginBottom: 12 },
  comingSoonText: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  comingSoonHint: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 6 },
});
