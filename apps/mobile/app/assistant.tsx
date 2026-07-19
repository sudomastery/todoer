import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../lib/hooks';
import { useTheme } from '../lib/theme';

const REPO = 'https://github.com/sudomastery/todoer';

/** Plain-language explainer, with the technical setup kept behind a toggle. */
export default function AssistantScreen() {
  const t = useTheme();
  const { data: profile } = useProfile();
  const [showSetup, setShowSetup] = useState(false);
  const who = profile?.username || profile?.email || 'your_username_or_email';

  const clone = `git clone ${REPO}\ncd todoer\nnpm install`;
  const claudeCode = [
    'claude mcp add todoer \\',
    `  --env TODOER_LOGIN=${who} \\`,
    '  --env TODOER_PASSWORD=your_password \\',
    '  -- npx tsx "$PWD/packages/mcp/src/index.ts"',
  ].join('\n');

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      <Text style={{ color: t.fg, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
        Connect an AI assistant
      </Text>
      <Text style={{ color: t.fgSecondary, fontSize: 14, lineHeight: 21, marginBottom: 16 }}>
        You can let an AI assistant manage your tasks by talking to it. Ask it to &quot;add buy
        milk tomorrow&quot; or &quot;what is due today?&quot; and it updates Todoer for you. The
        assistant signs in as you and only ever sees your own tasks.
      </Text>

      <View style={[styles.card, { borderColor: t.border, backgroundColor: t.bgElevated }]}>
        <Text style={{ color: t.fgSecondary, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>
          WHAT IT CAN DO
        </Text>
        {[
          'Add, edit, complete, and delete tasks',
          'Organize projects, sections, and labels',
          'Leave comments and summarize what you finished',
        ].map((line) => (
          <View key={line} style={styles.bullet}>
            <Ionicons name="checkmark" size={15} color={t.brand} />
            <Text style={{ color: t.fgSecondary, fontSize: 14, flex: 1 }}>{line}</Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={() => setShowSetup((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showSetup }}
        style={[styles.toggle, { borderColor: t.border }]}
      >
        <Text style={{ color: t.fg, fontSize: 14, fontWeight: '600' }}>Learn how to set it up</Text>
        <Ionicons name={showSetup ? 'chevron-up' : 'chevron-down'} size={17} color={t.fgSecondary} />
      </Pressable>

      {showSetup && (
        <View style={{ marginTop: 14 }}>
          <Text style={{ color: t.fgFaint, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
            Setup is a one-off and is done on a computer, not the phone. Todoer ships an MCP
            server that any MCP-capable assistant (Claude Code, Claude Desktop, and others) can
            connect to.
          </Text>
          <Text style={[styles.stepLabel, { color: t.fgSecondary }]}>1. Get the server (once)</Text>
          <Text style={[styles.code, { backgroundColor: t.bgElevated, color: t.fg, borderColor: t.border }]}>
            {clone}
          </Text>
          <Text style={[styles.stepLabel, { color: t.fgSecondary }]}>
            2. Point Claude Code at it
          </Text>
          <Text style={[styles.code, { backgroundColor: t.bgElevated, color: t.fg, borderColor: t.border }]}>
            {claudeCode}
          </Text>
          <Text style={{ color: t.fgFaint, fontSize: 12, lineHeight: 18 }}>
            Task text supports the same quick add syntax as this app. Your password stays in your
            local configuration and is only sent to Todoer&apos;s own backend.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, marginBottom: 16 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  code: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    fontSize: 11.5,
    fontFamily: 'monospace',
    lineHeight: 18,
    marginBottom: 14,
  },
});
