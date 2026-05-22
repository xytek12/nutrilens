import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { useMealStore } from '../../src/stores/mealStore';
import { useProfileStore } from '../../src/stores/profileStore';
import { formatMacro } from '../../src/utils/formatting';
import { supabase } from '../../src/lib/supabase';

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

type Period = 'week' | 'month' | '3months';

export default function ProgressScreen() {
  const { t } = useTranslation();
  const session   = useAuthStore((s) => s.session);
  const { todayMeals, loadTodayMeals } = useMealStore();
  const { profile, fetchProfile } = useProfileStore();
  const [period, setPeriod] = useState<Period>('week');

  // Weight log modal state
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  useEffect(() => {
    if (session?.user) loadTodayMeals(session.user.id);
  }, [session?.user?.id]);

  function openWeightModal() {
    // Pre-fill with current weight from profile
    setWeightInput(profile?.weight_kg ? String(profile.weight_kg) : '');
    setWeightModalOpen(true);
  }

  async function saveWeight() {
    const userId = session?.user?.id;
    if (!userId) return;
    const w = parseFloat(weightInput.replace(',', '.'));
    if (!w || w < 20 || w > 400) {
      Alert.alert(t('common.error'), 'Please enter a valid weight (20-400 kg).');
      return;
    }
    setSavingWeight(true);
    try {
      // Insert into weight_logs
      const { error: logErr } = await supabase
        .from('weight_logs')
        .insert({
          user_id: userId,
          weight_kg: w,
          logged_at: new Date().toISOString(),
        });
      if (logErr) {
        Alert.alert(t('common.error'), logErr.message);
        return;
      }
      // Update the profile's current weight too, so dashboard/plan reflect it
      await supabase.from('profiles').update({ weight_kg: w }).eq('id', userId);
      await fetchProfile(userId);
      setWeightModalOpen(false);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || 'Could not save weight.');
    } finally {
      setSavingWeight(false);
    }
  }

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

  const periods: { key: Period; label: string }[] = [
    { key: 'week',    label: t('progress.chart_7d') },
    { key: 'month',   label: t('progress.chart_30d') },
    { key: '3months', label: t('progress.chart_90d') },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.header}>
        <Text style={styles.title}>{t('progress.title')}</Text>
        <Text style={[styles.subtitle, { color: onTrack ? '#2DB04B' : '#EF4444' }]}>
          {onTrack ? t('progress.on_track_today') : t('progress.over_goal')}
        </Text>
      </View>

      {/* Period toggle */}
      <View style={styles.toggle}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.toggleBtn, period === p.key && styles.toggleBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.toggleLabel, period === p.key && styles.toggleLabelActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Log Weight button */}
      <TouchableOpacity style={styles.logWeightBtn} onPress={openWeightModal}>
        <Text style={styles.logWeightIcon}>⚖️</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.logWeightTitle}>{t('progress.log_weight')}</Text>
          {profile?.weight_kg ? (
            <Text style={styles.logWeightSub}>{t('progress.current_weight')}: {profile.weight_kg} kg</Text>
          ) : null}
        </View>
        <Text style={styles.logWeightArrow}>›</Text>
      </TouchableOpacity>

      {/* Today's stats */}
      <Text style={styles.sectionTitle}>{t('progress.today_summary')}</Text>
      <View style={styles.statsRow}>
        <StatCard
          icon="🔥"
          label={t('food_detail.calories')}
          value={`${Math.round(totalCalories)}`}
          sub={t('progress.pct_of_goal', { pct: calPct })}
          color="#F97316"
        />
        <StatCard
          icon="💧"
          label={t('dashboard.remaining')}
          value={`${Math.max(0, CALORIE_TARGET - Math.round(totalCalories))}`}
          sub={t('progress.kcal_left')}
          color="#2DB04B"
        />
        <StatCard
          icon="🍽️"
          label={t('progress.meals')}
          value={`${todayMeals.length}`}
          sub={t('progress.logged_today')}
          color="#3B82F6"
        />
      </View>

      {/* Macros breakdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('progress.today_macros')}</Text>
        <MacroRow label={t('dashboard.protein')}       value={totalProtein} target={PROTEIN_TARGET} color="#2DB04B" icon="💪" />
        <MacroRow label={t('progress.carbohydrates')}  value={totalCarbs}   target={CARBS_TARGET}   color="#F97316" icon="🌾" />
        <MacroRow label={t('dashboard.fat')}           value={totalFat}     target={FAT_TARGET}     color="#EAB308" icon="🥑" />
      </View>

      {/* Calories bar */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('progress.calories_vs_goal')}</Text>
        <View style={styles.calBarRow}>
          <Text style={styles.calBarLabel}>{t('dashboard.consumed')}</Text>
          <Text style={styles.calBarValue}>{Math.round(totalCalories)} {t('common.kcal')}</Text>
        </View>
        <View style={styles.calTrack}>
          <View style={[styles.calFill, {
            width: `${Math.min(calPct, 100)}%` as any,
            backgroundColor: onTrack ? '#2DB04B' : '#EF4444',
          }]} />
        </View>
        <View style={styles.calBarRow}>
          <Text style={styles.calBarLabel}>{t('progress.goal_label')}</Text>
          <Text style={styles.calBarValue}>{CALORIE_TARGET} {t('common.kcal')}</Text>
        </View>
        <Text style={[styles.calStatus, { color: onTrack ? '#2DB04B' : '#EF4444' }]}>
          {onTrack
            ? t('progress.kcal_remaining', { count: CALORIE_TARGET - Math.round(totalCalories) })
            : t('progress.kcal_over', { count: Math.round(totalCalories) - CALORIE_TARGET })}
        </Text>
      </View>

      {/* Historical charts */}
      {period === 'week' ? (
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonIcon}>📈</Text>
          <Text style={styles.comingSoonText}>{t('progress.weekly_soon')}</Text>
          <Text style={styles.comingSoonHint}>{t('progress.weekly_hint')}</Text>
        </View>
      ) : period === 'month' ? (
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonIcon}>📅</Text>
          <Text style={styles.comingSoonText}>{t('progress.monthly_soon')}</Text>
          <Text style={styles.comingSoonHint}>{t('progress.monthly_hint')}</Text>
        </View>
      ) : (
        <View style={styles.comingSoon}>
          <Text style={styles.comingSoonIcon}>🏆</Text>
          <Text style={styles.comingSoonText}>{t('progress.quarterly_soon')}</Text>
          <Text style={styles.comingSoonHint}>{t('progress.quarterly_hint')}</Text>
        </View>
      )}

      {/* Weight log modal */}
      <Modal
        visible={weightModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setWeightModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('progress.log_weight')}</Text>
            <Text style={styles.modalHint}>kg</Text>
            <TextInput
              style={styles.modalInput}
              value={weightInput}
              onChangeText={(v) => setWeightInput(v.replace(/[^0-9.,]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="70.5"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setWeightModalOpen(false)}
                disabled={savingWeight}
              >
                <Text style={styles.modalBtnCancelTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSave]}
                onPress={saveWeight}
                disabled={savingWeight}
              >
                {savingWeight ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalBtnSaveTxt}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  logWeightBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  logWeightIcon:   { fontSize: 24 },
  logWeightTitle:  { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  logWeightSub:    { fontSize: 12, color: '#6B7280', marginTop: 2 },
  logWeightArrow:  { fontSize: 22, color: '#9CA3AF' },

  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:        { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 },
  modalTitle:       { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 4, textAlign: 'center' },
  modalHint:        { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  modalInput:       { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, fontSize: 28, color: '#1A1A1A', textAlign: 'center', fontWeight: '700', marginBottom: 20 },
  modalBtnRow:      { flexDirection: 'row', gap: 12 },
  modalBtn:         { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalBtnCancel:   { backgroundColor: '#F3F4F6' },
  modalBtnCancelTxt:{ color: '#6B7280', fontWeight: '600', fontSize: 14 },
  modalBtnSave:     { backgroundColor: '#2DB04B' },
  modalBtnSaveTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
});
