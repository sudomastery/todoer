import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { completeOAuthRedirect } from '../../lib/oauth';
import { useTheme } from '../../lib/theme';

/**
 * Handles the Google redirect when the OS delivers it as a deep link rather
 * than resolving it inside the in-app browser session, which is what happens
 * when the browser was killed or the user came back to the app by hand.
 */
export default function AuthCallbackScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error) query.set('error', params.error);
    if (params.error_description) query.set('error_description', params.error_description);

    completeOAuthRedirect(`todoer://auth/callback?${query.toString()}`)
      .then(() => {
        if (!cancelled) router.replace('/(tabs)/today');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Google sign in failed.');
      });

    return () => {
      cancelled = true;
    };
  }, [params.code, params.error, params.error_description, router]);

  return (
    <View style={[styles.screen, { backgroundColor: t.bg }]}>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => router.replace('/login')}>
            <Text style={[styles.link, { color: t.brand }]}>Back to log in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={t.brand} />
          <Text style={[styles.label, { color: t.fgSecondary }]}>Finishing sign in...</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  label: { fontSize: 14 },
  error: { color: '#d1453b', fontSize: 14, textAlign: 'center' },
  link: { fontSize: 14, fontWeight: '600' },
});
