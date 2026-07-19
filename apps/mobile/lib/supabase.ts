import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Left on the default implicit flow on purpose. Signup confirmation and
      // password reset links from this client are opened on the web, which
      // cannot complete a PKCE exchange started here. Google sign in uses its
      // own PKCE client, see lib/oauth.ts.
    },
  },
);
