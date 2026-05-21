import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../../src/stores/onboardingStore';
import type { ActivityLevel } from '../../../src/types';

const LEVELS: { code: ActivityLevel; emoji: string; title: string; desc: string }[] = [
  {
    code: 'sedentary',
    emoji: '🪑',
    title: 'Sedentary',
    desc: 'Desk job, little or no exercise',
  },
  {
    code: 'light',
    emoji: '🚶',
    title: 'Lightly Active',
    desc: 'Light exercise 1–2 days per week',
  },
  {
    code: 'moderate',
    emoji: '🏃',
    title: 'Moderately Active',
    desc: 'Exercise 3–4 days per week',
  },
  {
    code: 'active',
    emoji: '🏋️',
    title: 'Active',
    desc: 'Hard exercise 5–6 days per week',
  },
  {
    code: 'very_active',
    emoji: '⚡',
    title: 'Very Active',
    desc: 'Athlete or physical job, daily training',
  },
];

export default function Step5Activity() {
  const { activity_level, setField } = useOnboardingStore();
  const [sel, setSel] = useState<ActivityLevel | ''>(activity_level as ActivityLevel | '');
  const ok = sel !== '';

  function proceed() {
    if (!ok) return;
    setField('activity_level', sel as ActivityLevel);
    router.push('/(auth)/onboarding/complete');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <ProgressBar step={5} />
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.emoji}>⚡</Text>
        <Text style={s.title}>How active are you?</Text>
        <Text style={s.sub}>Be honest — this affects your daily calorie target</Text>

        {LEVELS.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[s.card, sel === l.code && s.cardActive]}
            onPress={() => setSel(l.code)}
            activeOpacity={0.8}
          >
            <Text style={s.icon}>{l.emoji}</Text>
            <View style={s.cardBody}>
              <Text style={[s.cardTitle, sel === l.code && s.cardTitleActive]}>{l.title}</Text>
              <Text style={s.cardDesc}>{l.desc}</Text>
            </View>
            {sel === l.code && <Text style={s.check}>✓</Text>}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[s.btn, !ok && s.btnOff]} onPress={proceed} disabled={!ok}>
          <Text style={s.btnTxt}>See My Plan →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={pb.wrap}>
      <View style={pb.track}>
        <View style={[pb.fill, { width: `${(step / 5) * 100}%` as any }]} />
      </View>
      <Text style={pb.lbl}>Step {step} of 5</Text>
    </View>
  );
}

const pb = StyleSheet.create({
  wrap:  { marginBottom: 16 },
  track: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  fill:  { height: 4, backgroundColor: '#2DB04B', borderRadius: 2 },
  lbl:   { fontSize: 12, color: '#9CA3AF', textAlign: 'right' },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F8FAF8' },
  scroll: { padding: 24, paddingTop: 16, paddingBottom: 40 },
  back:   { marginBottom: 8 },
  backTxt:{ color: '#6B7280', fontSize: 14 },
  emoji:  { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title:  { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 6 },
  sub:    { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: {width:0,height:1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardActive:      { borderColor: '#2DB04B', backgroundColor: '#F0FDF4' },
  icon:            { fontSize: 28, marginRight: 14, width: 36, textAlign: 'center' },
  cardBody:        { flex: 1 },
  cardTitle:       { fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  cardTitleActive: { color: '#2DB04B' },
  cardDesc:        { fontSize: 12, color: '#6B7280' },
  check:           { fontSize: 18, color: '#2DB04B', fontWeight: 'bold', marginLeft: 8 },
  btn:    { backgroundColor: '#2DB04B', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  btnOff: { backgroundColor: '#A7D7B4' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
