import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { USERNAME_RE, isUsernameAvailable, resolveLoginEmail } from '@todoer/shared';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

export default function LoginScreen() {
  const t = useTheme();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setNotice(null);
    if (mode === 'signup') {
      if (!USERNAME_RE.test(username)) {
        return setError('Usernames are 3-30 characters: letters, numbers, and underscores only.');
      }
      setLoading(true);
      try {
        if (!(await isUsernameAvailable(supabase, username))) {
          setLoading(false);
          return setError('That username is taken.');
        }
      } catch {
        // availability check is best-effort; the database still enforces uniqueness
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, username } },
      });
      setLoading(false);
      if (error) return setError(error.message);
      if (!data.session) setNotice('Check your email to confirm your account, then log in.');
      return;
    }
    setLoading(true);
    let loginEmail: string | null = null;
    try {
      loginEmail = await resolveLoginEmail(supabase, identifier);
    } catch {
      loginEmail = null;
    }
    if (!loginEmail) {
      setLoading(false);
      return setError('No account found with that username.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  const inputStyle = [styles.input, { borderColor: t.border, color: t.fg, backgroundColor: t.bgElevated }];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: t.bg }]}
    >
      <View style={styles.logoRow}>
        <Ionicons name="checkmark-circle" size={40} color={t.brand} />
        <Text style={[styles.logoText, { color: t.fg }]}>Todoer</Text>
      </View>

      <Text style={[styles.title, { color: t.fg }]}>
        {mode === 'login' ? 'Log in' : 'Create your account'}
      </Text>

      {mode === 'signup' && (
        <>
          <TextInput
            style={inputStyle}
            placeholder="Your name"
            placeholderTextColor={t.fgFaint}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={inputStyle}
            placeholder="Username"
            placeholderTextColor={t.fgFaint}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={t.fgFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </>
      )}
      {mode === 'login' && (
        <TextInput
          style={inputStyle}
          placeholder="Email or username"
          placeholderTextColor={t.fgFaint}
          autoCapitalize="none"
          autoCorrect={false}
          value={identifier}
          onChangeText={setIdentifier}
        />
      )}
      <TextInput
        style={inputStyle}
        placeholder="Password"
        placeholderTextColor={t.fgFaint}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {notice && <Text style={styles.notice}>{notice}</Text>}

      <Pressable
        onPress={submit}
        disabled={loading}
        style={[styles.button, { backgroundColor: t.brand, opacity: loading ? 0.7 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{mode === 'login' ? 'Log in' : 'Sign up'}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={[styles.switch, { color: t.fgSecondary }]}>
          {mode === 'login' ? (
            <>
              Don&apos;t have an account? <Text style={{ color: t.brand }}>Sign up</Text>
            </>
          ) : (
            <>
              Already have an account? <Text style={{ color: t.brand }}>Log in</Text>
            </>
          )}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  logoText: { fontSize: 28, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  error: { color: '#d1453b', fontSize: 13, marginBottom: 8 },
  notice: { color: '#246fe0', fontSize: 13, marginBottom: 8 },
  button: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  switch: { textAlign: 'center', marginTop: 20, fontSize: 14 },
});
