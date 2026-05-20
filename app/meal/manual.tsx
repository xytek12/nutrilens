import { View, Text, StyleSheet } from 'react-native';

export default function ManualEntryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manual Entry</Text>
      <Text style={styles.subtitle}>Food search and manual entry coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050D2D', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  subtitle: { color: '#888', marginTop: 8 },
});
