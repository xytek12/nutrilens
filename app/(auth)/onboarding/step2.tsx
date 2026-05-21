import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../../src/stores/onboardingStore';
import type { Gender } from '../../../src/types';

const GENDERS: { code: Gender; label: string; emoji: string }[] = [
  { code: 'male',   label: 'Male',   emoji: '♂️' },
  { code: 'female', label: 'Female', emoji: '♀️' },
  { code: 'other',  label: 'Other',  emoji: '🫶' },
];

export default function Step2BirthdateGender() {
  const { birthdate, gender, setField } = useOnboardingStore();
  const parts = birthdate ? birthdate.split('-') : ['', '', ''];
  const [year,  setYear]  = useState(parts[0]);
  const [month, setMonth] = useState(parts[1]);
  const [day,   setDay]   = useState(parts[2]);
  const [sel,   setSel]   = useState<Gender | ''>(gender as Gender | '');

  const currentYear = new Date().getFullYear();
  const yearNum  = parseInt(year, 10);
  const validYear  = year.length === 4 && yearNum >= 1920 && yearNum <= currentYear - 5;
  const validMonth = parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12;
  const validDay   = parseInt(day,   10) >= 1 && parseInt(day,   10) <= 31;
  const ok = validYear && validMonth && validDay && sel !== '';

  function proceed() {
    if (!ok) return;
    setField('birthdate', `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    setField('gender', sel as Gender);
    router.push('/(auth)/onboarding/step3');
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProgressBar step={2} />

          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Text style={s.backTxt}>← Back</Text>
          </TouchableOpacity>

          <Text style={s.emoji}>🎂</Text>
          <Text style={s.title}>About you</Text>
          <Text style={s.sub}>Used to calculate your personal calorie target</Text>

          {/* Date inputs */}
          <Text style={s.label}>Date of birth</Text>
          <View style={s.dateRow}>
            <View style={s.dateBlock}>
              <TextInput
                style={s.dateInput}
                placeholder="DD"
                placeholderTextColor="#9CA3AF"
                value={day}
                onChangeText={(t) => setDay(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
              <Text style={s.dateHint}>Day</Text>
            </View>
            <View style={s.dateBlock}>
              <TextInput
                style={s.dateInput}
                placeholder="MM"
                placeholderTextColor="#9CA3AF"
                value={month}
                onChangeText={(t) => setMonth(t.replace(/\D/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
              />
              <Text style={s.dateHint}>Month</Text>
            </View>
            <View style={[s.dateBlock, { flex: 2 }]}>
              <TextInput
                style={s.dateInput}
                placeholder="YYYY"
                placeholderTextColor="#9CA3AF"
                value={year}
                onChangeText={(t) => setYear(t.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
              />
              <Text style={s.dateHint}>Year</Text>
            </View>
          </View>

          {/* Gender */}
          <Text style={[s.label, { marginTop: 32 }]}>Gender</Text>
          <View style={s.genderRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g.code}
                style={[s.genderBtn, sel === g.code && s.genderBtnActive]}
                onPress={() => setSel(g.code)}
              >
                <Text style={s.genderEmoji}>{g.emoji}</Text>
                <Text style={[s.genderLabel, sel === g.code && s.genderLabelActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.btn, !ok && s.btnOff]}
            onPress={proceed}
            disabled={!ok}
          >
            <Text style={s.btnTxt}>Continue →</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scroll: { flexGrow: 1, padding: 24, paddingTop: 20, paddingBottom: 40 },
  back:   { marginBottom: 16 },
  backTxt:{ color: '#6B7280', fontSize: 14 },
  emoji:  { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title:  { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 6 },
  sub:    { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 28 },
  label:  { fontSize: 13, fontWeight: '700', color: '#6B7280', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  dateRow:{ flexDirection: 'row', gap: 10 },
  dateBlock:  { flex: 1, alignItems: 'center' },
  dateInput:  {
    width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    fontSize: 18, color: '#1A1A1A', borderWidth: 1.5, borderColor: '#E5E7EB',
    textAlign: 'center', fontWeight: '600',
  },
  dateHint:   { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  genderRow:  { flexDirection: 'row', gap: 10, marginBottom: 32 },
  genderBtn:  {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  genderBtnActive:   { borderColor: '#2DB04B', backgroundColor: '#F0FDF4' },
  genderEmoji:       { fontSize: 22, marginBottom: 4 },
  genderLabel:       { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  genderLabelActive: { color: '#2DB04B' },
  btn:    { backgroundColor: '#2DB04B', borderRadius: 14, padding: 18, alignItems: 'center' },
  btnOff: { backgroundColor: '#A7D7B4' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
