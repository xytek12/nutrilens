import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../../src/stores/onboardingStore';
import type { Goal } from '../../../src/types';

const GOALS: { code: Goal; emoji: string; title: string; desc: string; color: string }[] = [
  {
    code: 'lose',
    emoji: '🔥',
    title: 'Lose Weight',
    desc: 'Reduce body fat with a calorie deficit and smart nutrition',
    color: '#F97316',
  },
  {
    code: 'maintain',
    emoji: '⚖️',
    title: 'Stay Fit',
    desc: 'Maintain your current weight while eating balanced meals',
    color: '#3B82F6',
  },
  {
    code: 'gain',
    emoji: '💪',
    title: 'Build Muscle',
    desc: 'Gain strength and muscle with a calorie surplus',
    color: '#2DB04B',
  },
];

export default function Step4Goal() {
  const { goal, setField } = useOnboardingStore();
  const [sel, setSel] = useState<Goal | ''>(goal as Goal | '');
  const ok = sel !== '';

  function proceed() {
    if (!ok) return;
    setField('goal', sel as Goal);
    router.push('/(auth)/onboarding/step5');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        <ProgressBar step={4} />
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>

        <Text style={s.emoji}>🎯</Text>
        <Text style={s.title}>What's your main goal?</Text>
        <Text style={s.sub}>We'll tailor your daily calories and meal plans around this</Text>

        {GOALS.map((g) => (
          <TouchableOpacity
            key={g.code}
            style={[s.card, sel === g.code && s.cardActive]}
            onPress={() => setSel(g.code)}
            activeOpacity={0.8}
          >
            <View style={[s.iconBox, { backgroundColor: g.color + '20' }]}>
              <Text style={s.icon}>{g.emoji}</Text>
            </View>
            <View style={s.cardBody}>
              <Text style={[s.cardTitle, sel === g.code && s.cardTitleActive]}>{g.title}</Text>
              <Text style={s.cardDesc}>{g.desc}</Text>
            </View>
            {sel === g.code && <Text style={s.check}>✓</Text>}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={[s.btn, !ok && s.btnOff]} onPress={proceed} disabled={!ok}>
          <Text style={s.btnTxt}>Continue →</Text>
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
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: {width:0,height:2}, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  cardActive:      { borderColor: '#2DB04B', backgroundColor: '#F0FDF4' },
  iconBox:         { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  icon:            { fontSize: 24 },
  cardBody:        { flex: 1 },
  cardTitle:       { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 3 },
  cardTitleActive: { color: '#2DB04B' },
  cardDesc:        { fontSize: 12, color: '#6B7280', lineHeight: 16 },
  check:           { fontSize: 18, color: '#2DB04B', fontWeight: 'bold', marginLeft: 8 },
  btn:    { backgroundColor: '#2DB04B', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 8 },
  btnOff: { backgroundColor: '#A7D7B4' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
