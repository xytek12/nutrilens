import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { useProfileStore } from '../../src/stores/profileStore';
import i18n from '../../src/i18n/index';

const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', native: 'English',  english: 'English' },
  { code: 'he', flag: '🇮🇱', native: 'עברית',    english: 'Hebrew' },
  { code: 'ar', flag: '🇸🇦', native: 'العربية',  english: 'Arabic' },
  { code: 'de', flag: '🇩🇪', native: 'Deutsch',  english: 'German' },
  { code: 'zh', flag: '🇨🇳', native: '中文',     english: 'Chinese' },
];

function SettingRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <Text style={rowStyles.label}>{label}</Text>
      {value ? <Text style={rowStyles.value}>{value}</Text> : null}
      {onPress ? <Text style={rowStyles.arrow}>›</Text> : null}
    </TouchableOpacity>
  );
}
const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  icon:  { fontSize: 20, width: 32 },
  label: { flex: 1, fontSize: 15, color: '#1A1A1A', fontWeight: '500' },
  value: { fontSize: 14, color: '#6B7280', marginRight: 8 },
  arrow: { fontSize: 20, color: '#9CA3AF' },
});

export default function SettingsScreen() {
  const { t } = useTranslation();
  const signOut  = useAuthStore((s) => s.signOut);
  const session  = useAuthStore((s) => s.session);
  const { profile } = useProfileStore();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');
  const [showLangPicker, setShowLangPicker] = useState(false);

  const displayName  = profile?.name || session?.user?.email?.split('@')[0] || 'User';
  const displayEmail = session?.user?.email || '';

  const activeLang = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  async function changeLang(code: string) {
    await i18n.changeLanguage(code);
    setCurrentLang(code);
    setShowLangPicker(false);
  }

  const comingSoon = () => Alert.alert(t('common.loading'), 'This feature is coming in the next update.');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.title}>{t('settings.title')}</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{displayEmail}</Text>
        </View>
      </View>

      {/* Account section */}
      <Text style={styles.sectionLabel}>ACCOUNT</Text>
      <View style={styles.card}>
        <SettingRow icon="👤" label={t('settings.personal_info')}   onPress={comingSoon} />
        <View style={styles.separator} />
        <SettingRow icon="🥗" label={t('settings.dietary')}         onPress={comingSoon} />
        <View style={styles.separator} />
        <SettingRow icon="🔔" label={t('settings.notifications')}   onPress={comingSoon} />
      </View>

      {/* Language section */}
      <Text style={styles.sectionLabel}>LANGUAGE</Text>
      <View style={styles.card}>
        <TouchableOpacity style={rowStyles.row} onPress={() => setShowLangPicker(!showLangPicker)} activeOpacity={0.7}>
          <Text style={rowStyles.icon}>🌐</Text>
          <Text style={rowStyles.label}>{t('settings.language')}</Text>
          <Text style={rowStyles.value}>{activeLang.flag} {activeLang.native}</Text>
          <Text style={[rowStyles.arrow, { transform: [{ rotate: showLangPicker ? '90deg' : '0deg' }] }]}>›</Text>
        </TouchableOpacity>

        {showLangPicker && (
          <View style={styles.langPicker}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.langOption, currentLang === lang.code && styles.langOptionActive]}
                onPress={() => changeLang(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.langNative}>{lang.native}</Text>
                  <Text style={styles.langEnglish}>{lang.english}</Text>
                </View>
                {currentLang === lang.code && (
                  <Text style={styles.langCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Subscription */}
      <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
      <View style={styles.card}>
        <SettingRow icon="⭐" label={t('settings.subscription')} value="Free Trial" />
        <View style={styles.separator} />
        <TouchableOpacity style={rowStyles.row} onPress={() => Alert.alert('Upgrade', 'Premium subscription coming soon!')}>
          <Text style={rowStyles.icon}>🚀</Text>
          <View style={{ flex: 1 }}>
            <Text style={[rowStyles.label, { color: '#2DB04B' }]}>Upgrade to Premium</Text>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>Unlock AI plans, unlimited meals & more</Text>
          </View>
          <Text style={rowStyles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={() =>
          Alert.alert(t('auth.signout'), 'Are you sure you want to sign out?', [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('auth.signout'), style: 'destructive', onPress: signOut },
          ])
        }
      >
        <Text style={styles.signOutText}>{t('auth.signout')}</Text>
      </TouchableOpacity>

      <Text style={styles.version}>NutriLens v1.0.0</Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAF8' },
  content:   { padding: 16, paddingTop: 56, paddingBottom: 40 },

  title: { fontSize: 26, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 20 },

  profileCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  avatar:       { width: 56, height: 56, borderRadius: 28, backgroundColor: '#2DB04B', justifyContent: 'center', alignItems: 'center' },
  avatarText:   { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  name:         { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  email:        { fontSize: 13, color: '#6B7280', marginTop: 2 },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  card:         { backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  separator:    { height: 1, backgroundColor: '#F3F4F6', marginLeft: 52 },

  langPicker:       { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingVertical: 8 },
  langOption:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  langOptionActive: { backgroundColor: '#F0FDF4' },
  langFlag:         { fontSize: 24, width: 36 },
  langNative:       { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  langEnglish:      { fontSize: 12, color: '#6B7280' },
  langCheck:        { fontSize: 16, color: '#2DB04B', fontWeight: 'bold' },

  signOutBtn:  { backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#EF4444', marginBottom: 16 },
  signOutText: { color: '#EF4444', fontSize: 16, fontWeight: '700' },

  version: { textAlign: 'center', fontSize: 12, color: '#9CA3AF' },
});
