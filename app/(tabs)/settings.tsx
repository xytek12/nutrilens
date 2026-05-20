import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { useTrial } from '../../src/hooks/useTrial';
import { useTranslation } from 'react-i18next';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const { daysLeft, trialExpired } = useTrial();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.name}>{profile?.name || 'User'}</Text>
        <Text style={styles.email}>{profile?.email || ''}</Text>
        <Text style={[styles.trial, trialExpired && styles.trialExpired]}>
          {trialExpired
            ? t('trial.expired')
            : t('trial.daysLeft', { count: daysLeft })}
        </Text>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050D2D', padding: 24, paddingTop: 60 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  card: { backgroundColor: '#1A2444', borderRadius: 16, padding: 20, marginBottom: 16 },
  name: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  email: { color: '#888', marginTop: 4 },
  trial: { color: '#4CAF50', marginTop: 12, fontWeight: '500' },
  trialExpired: { color: '#FF6B6B' },
  signOutButton: { backgroundColor: '#1A2444', borderRadius: 12, padding: 16, alignItems: 'center' },
  signOutText: { color: '#FF6B6B', fontSize: 16, fontWeight: '600' },
});
