import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../../src/stores/onboardingStore';

type HeightUnit = 'cm' | 'ft';
type WeightUnit = 'kg' | 'lbs';

export default function Step3Measurements() {
  const { height_cm, weight_kg, setField } = useOnboardingStore();

  const [hUnit, setHUnit] = useState<HeightUnit>('cm');
  const [wUnit, setWUnit] = useState<WeightUnit>('kg');

  const [heightCm,  setHeightCm]  = useState(height_cm ? String(height_cm) : '');
  const [heightFt,  setHeightFt]  = useState('');
  const [heightIn,  setHeightIn]  = useState('');
  const [weightKg,  setWeightKg]  = useState(weight_kg ? String(weight_kg) : '');
  const [weightLbs, setWeightLbs] = useState('');

  function getHeightCm(): number | null {
    if (hUnit === 'cm') {
      const v = parseFloat(heightCm);
      return v >= 50 && v <= 280 ? Math.round(v) : null;
    }
    const ft = parseFloat(heightFt) || 0;
    const inches = parseFloat(heightIn) || 0;
    const cm = Math.round(ft * 30.48 + inches * 2.54);
    return cm >= 50 && cm <= 280 ? cm : null;
  }

  function getWeightKg(): number | null {
    if (wUnit === 'kg') {
      const v = parseFloat(weightKg);
      return v >= 20 && v <= 500 ? Math.round(v * 10) / 10 : null;
    }
    const kg = parseFloat(weightLbs) * 0.453592;
    return kg >= 20 && kg <= 500 ? Math.round(kg * 10) / 10 : null;
  }

  const hCm = getHeightCm();
  const wKg = getWeightKg();
  const ok  = hCm !== null && wKg !== null;

  function proceed() {
    if (!ok) return;
    setField('height_cm', hCm!);
    setField('weight_kg', wKg!);
    router.push('/(auth)/onboarding/step4');
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
          <ProgressBar step={3} />

          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Text style={s.backTxt}>← Back</Text>
          </TouchableOpacity>

          <Text style={s.emoji}>📏</Text>
          <Text style={s.title}>Your measurements</Text>
          <Text style={s.sub}>Used to calculate your personal calorie target</Text>

          {/* Height */}
          <View style={s.rowHeader}>
            <Text style={s.rowLabel}>Height</Text>
            <UnitToggle options={['cm', 'ft']} active={hUnit} onSelect={(u) => setHUnit(u as HeightUnit)} />
          </View>
          {hUnit === 'cm' ? (
            <TextInput
              style={s.input}
              placeholder="e.g. 175"
              placeholderTextColor="#9CA3AF"
              value={heightCm}
              onChangeText={(t) => setHeightCm(t.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          ) : (
            <View style={s.ftRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="ft"
                placeholderTextColor="#9CA3AF"
                value={heightFt}
                onChangeText={(t) => setHeightFt(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={1}
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="in"
                placeholderTextColor="#9CA3AF"
                value={heightIn}
                onChangeText={(t) => setHeightIn(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          )}

          {/* Weight */}
          <View style={[s.rowHeader, { marginTop: 28 }]}>
            <Text style={s.rowLabel}>Weight</Text>
            <UnitToggle options={['kg', 'lbs']} active={wUnit} onSelect={(u) => setWUnit(u as WeightUnit)} />
          </View>
          <TextInput
            style={s.input}
            placeholder={wUnit === 'kg' ? 'e.g. 75' : 'e.g. 165'}
            placeholderTextColor="#9CA3AF"
            value={wUnit === 'kg' ? weightKg : weightLbs}
            onChangeText={(t) => {
              const clean = t.replace(/[^0-9.]/g, '');
              wUnit === 'kg' ? setWeightKg(clean) : setWeightLbs(clean);
            }}
            keyboardType="decimal-pad"
            returnKeyType="done"
          />

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

function UnitToggle({ options, active, onSelect }: { options: string[]; active: string; onSelect: (v: string) => void }) {
  return (
    <View style={ut.wrap}>
      {options.map((o) => (
        <TouchableOpacity
          key={o}
          style={[ut.btn, active === o && ut.btnActive]}
          onPress={() => onSelect(o)}
        >
          <Text style={[ut.lbl, active === o && ut.lblActive]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const ut = StyleSheet.create({
  wrap:      { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 8, padding: 2 },
  btn:       { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 6 },
  btnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  lbl:       { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  lblActive: { color: '#1A1A1A', fontWeight: '700' },
});

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
  safe:      { flex: 1, backgroundColor: '#F8FAF8' },
  scroll:    { flexGrow: 1, padding: 24, paddingTop: 20, paddingBottom: 40 },
  back:      { marginBottom: 16 },
  backTxt:   { color: '#6B7280', fontSize: 14 },
  emoji:     { fontSize: 48, textAlign: 'center', marginBottom: 12 },
  title:     { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 6 },
  sub:       { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 28 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  rowLabel:  { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  input:     {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    fontSize: 18, color: '#1A1A1A', borderWidth: 1.5, borderColor: '#E5E7EB',
    textAlign: 'center', fontWeight: '600', marginBottom: 4,
  },
  ftRow:     { flexDirection: 'row', gap: 10 },
  btn:       { backgroundColor: '#2DB04B', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 32 },
  btnOff:    { backgroundColor: '#A7D7B4' },
  btnTxt:    { color: '#fff', fontSize: 16, fontWeight: '700' },
});
