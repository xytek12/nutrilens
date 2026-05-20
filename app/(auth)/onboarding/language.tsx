import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Language } from '../../../src/types';

const LANGUAGES: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'he', label: 'Hebrew', native: 'עברית' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'de', label: 'German', native: 'Deutsch' },
  { code: 'zh', label: 'Chinese', native: '中文' },
];

export default function LanguageScreen() {
  const { i18n, t } = useTranslation();

  function selectLanguage(lang: Language) {
    i18n.changeLanguage(lang);
    router.push('/(auth)/onboarding/step1');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('onboarding.selectLanguage')}</Text>
      {LANGUAGES.map((lang) => (
        <TouchableOpacity
          key={lang.code}
          style={styles.option}
          onPress={() => selectLanguage(lang.code)}
        >
          <Text style={styles.native}>{lang.native}</Text>
          <Text style={styles.label}>{lang.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050D2D', justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 32, textAlign: 'center' },
  option: { backgroundColor: '#1A2444', borderRadius: 12, padding: 18, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  native: { fontSize: 18, color: '#fff', fontWeight: '600' },
  label: { fontSize: 14, color: '#888' },
});
