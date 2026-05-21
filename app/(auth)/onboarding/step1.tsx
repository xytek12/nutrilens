import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useOnboardingStore } from '../../../src/stores/onboardingStore';

export default function Step1Name() {
  const { name, setField } = useOnboardingStore();
  const [value, setValue] = useState(name);
  const ok = value.trim().length > 0;

  function proceed() {
    if (!ok) return;
    setField('name', value.trim());
    router.push('/(auth)/onboarding/step2');
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
          <ProgressBar step={1} />

          <View style={s.body}>
            <Text style={s.emoji}>👋</Text>
            <Text style={s.title}>What should we call you?</Text>
            <Text style={s.sub}>Your name will appear on your dashboard</Text>

            <TextInput
              style={s.input}
              value={value}
              onChangeText={setValue}
              placeholder="Your first name"
              placeholderTextColor="#9CA3AF"
              returnKeyType="done"
              onSubmitEditing={proceed}
              maxLength={40}
            />
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
  wrap:  { marginBottom: 32 },
  track: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  fill:  { height: 4, backgroundColor: '#2DB04B', borderRadius: 2 },
  lbl:   { fontSize: 12, color: '#9CA3AF', textAlign: 'right' },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#F8FAF8' },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 20 },
  body:   { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 380, paddingVertical: 20 },
  emoji:  { fontSize: 64, marginBottom: 20 },
  title:  { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 8 },
  sub:    { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 36 },
  input:  {
    width: '100%', backgroundColor: '#fff', borderRadius: 14, padding: 18,
    fontSize: 18, color: '#1A1A1A', borderWidth: 1.5, borderColor: '#E5E7EB',
    textAlign: 'center', fontWeight: '600',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1,
  },
  btn:    { backgroundColor: '#2DB04B', borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 16, marginBottom: 8 },
  btnOff: { backgroundColor: '#A7D7B4' },
  btnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
