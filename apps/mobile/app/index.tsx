import { Redirect } from 'expo-router';

// Cold start lands on '/', which has no screen of its own; send it to the
// tabs and let AuthGate bounce unauthenticated users to /login.
export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
