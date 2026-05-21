import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/stores/authStore';
import { useProfileStore } from '../../../src/stores/profileStore';
import { useOnboardingStore, calculateTargets } from '../../../src/stores/onboardingStore';

const GOAL_LABELS: Record<string, string> = {
  lose:     '🔥 Lose Weight',
  maintain: '⚖️  Stay Fit',
  gain:     '💪 Build Muscle',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary:   'Sedentary',
  light:       'Lightly Active',
  moderate:    'Moderately Active',
  active:      'Active',
  very_active: 'Very Active',
};

export default function OnboardingComplete() {
  const session      = useAuthStore((s) => s.session);
  const fetchProfile = useProfileStore((s) => s.fetchProfile);
  const store        = useOnboardingStore();
  const { complete, reset } = useOnboardingStore();
  const [saving, setSaving] = useState(false);

  const targets = calculateTargets(store);

  async function handleStart() {
    const userId = session?.user?.id;
    if (!userId) return;

    setSaving(true);
    const result = await complete(userId);
    setSaving(false);

    if (result.error) {
      Alert.alert('Error', `Could not save your profile: ${result.error}\n\nPlease make sure you ran the database migration in Supabase.`);
      return;
    }

    await fetchProfile(userId);
    reset();
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.checkmark}>✅</Text>
          <Text style={s.title}>Your plan is ready!</Text>
          <Text style={s.sub}>Here's your personalized daily targets based on your profile</Text>
        </View>

        {/* Profile summary */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Profile Summary</Text>
          {store.name ? (
            <Row icon="👤" label="Name"       value={store.name} />
          ) : null}
          {store.goal ? (
            <Row icon="🎯" label="Goal"       value={GOAL_LABELS[store.goal] ?? store.goal} />
          ) : null}
          {store.activity_level ? (
            <Row icon="⚡" label="Activity"   value={ACTIVITY_LABELS[store.activity_level] ?? store.activity_level} />
          ) : null}
          {store.height_cm ? (
            <Row icon="📏" label="Height"     value={`${store.height_cm} cm`} />
          ) : null}
          {store.weight_kg ? (
            <Row icon="⚖️"  label="Weight"     value={`${store.weight_kg} kg`} />
          ) : null}
        </View>

        {/* Daily targets */}
        <View style={s.targetsCard}>
          <Text style={s.cardTitle}>Your Daily Targets</Text>
          <View style={s.calRow}>
            <Text style={s.calNum}>{targets.calories.toLocaleString()}</Text>
            <Text style={s.calLabel}>kcal / day</Text>
          </View>
          <View style={s.macroRow}>
            <MacroBox label="Protein" value={targets.protein} unit="g" color="#2DB04B" />
            <MacroBox label="Carbs"   value={targets.carbs}   unit="g" color="#F97316" />
            <MacroBox label="Fat"     value={targets.fat}     unit="g" color="#EAB308" />
          </View>
          <Text style={s.note}>
            Targets are calculated using the Mifflin-St Jeor formula. You can adjust them later in your profile.
          </Text>
        </View>

        <TouchableOpacity style={s.btn} onPress={handleStart} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnTxt}>Start My Journey 🚀</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={s.editLink}>
          <Text style={s.editLinkTxt}>← Edit my answers</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={row.wrap}>
      <Text style={row.icon}>{icon}</Text>
      <Text style={row.label}>{label}</Text>
      <Text style={row.value}>{value}</Text>
    </View>
  );
}
const row = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  icon:  { fontSize: 18, width: 28 },
  label: { flex: 1, fontSize: 14, color: '#6B7280' },
  value: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
});

function MacroBox({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={mb.box}>
      <Text style={[mb.num, { color }]}>{value}{unit}</Text>
      <Text style={mb.lbl}>{label}</Text>
    </View>
  );
}
const mb = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  num: { fontSize: 20, fontWeight: 'bold', marginBottom: 2 },
  lbl: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F8FAF8' },
  scroll: { padding: 24, paddingTop: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  checkmark: { fontSize: 56, marginBottom: 16 },
  title:  { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
  sub:    { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  card:   {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 16,
    shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
  targetsCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, marginBottom: 24,
    shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  calRow:  { alignItems: 'center', marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  calNum:  { fontSize: 48, fontWeight: 'bold', color: '#1A1A1A' },
  calLabel:{ fontSize: 14, color: '#6B7280', marginTop: -4 },
  macroRow:{ flexDirection: 'row' },
  note:    { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 12, lineHeight: 16 },
  btn:     { backgroundColor: '#2DB04B', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12 },
  btnTxt:  { color: '#fff', fontSize: 17, fontWeight: '700' },
  editLink:{ padding: 12, alignItems: 'center' },
  editLinkTxt: { color: '#9CA3AF', fontSize: 14 },
});
