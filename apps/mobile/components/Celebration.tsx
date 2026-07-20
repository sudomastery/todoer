import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CONFETTI_COLORS, type Milestone } from '@todoer/shared';
import { registerCelebrationHandler } from '../lib/celebration';
import { useTheme } from '../lib/theme';

const PIECE_COUNT = 42;

interface Piece {
  x: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  round: boolean;
}

function makePieces(width: number): Piece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    x: Math.random() * width,
    size: 8 + Math.random() * 8,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 500,
    duration: 2200 + Math.random() * 1400,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 720,
    round: Math.random() > 0.5,
  }));
}

function ConfettiPiece({ piece, height }: { piece: Piece; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: piece.duration,
      delay: piece.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress, piece]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -20,
        left: piece.x,
        width: piece.size,
        height: piece.round ? piece.size : piece.size * 0.45,
        borderRadius: piece.round ? piece.size / 2 : 2,
        backgroundColor: piece.color,
        opacity: progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.drift] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.spin}deg`] }) },
        ],
      }}
    />
  );
}

/**
 * Confetti and a congratulations card when a daily completion milestone
 * lands. Mounted once at the root; triggered through the celebration bridge
 * so the complete task mutation stays free of UI concerns.
 */
export function Celebration() {
  const t = useTheme();
  const { width, height } = useWindowDimensions();
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [pieces, setPieces] = useState<Piece[]>([]);
  const cardScale = useRef(new Animated.Value(0.6)).current;

  useEffect(
    () =>
      registerCelebrationHandler((m) => {
        setPieces(makePieces(width));
        setMilestone(m);
      }),
    [width],
  );

  useEffect(() => {
    if (!milestone) return;
    cardScale.setValue(0.6);
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 5,
      tension: 120,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setMilestone(null), 3800);
    return () => clearTimeout(timer);
  }, [milestone, cardScale]);

  if (!milestone) return null;

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={() => setMilestone(null)}>
      <Pressable style={styles.root} onPress={() => setMilestone(null)}>
        {pieces.map((piece, i) => (
          <ConfettiPiece key={i} piece={piece} height={height} />
        ))}
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: t.bgElevated, transform: [{ scale: cardScale }] },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: t.brand }]}>
            <Ionicons name="trophy" size={28} color="#fff" />
          </View>
          <Text style={[styles.title, { color: t.fg }]}>{milestone.title}</Text>
          <Text style={[styles.message, { color: t.fgSecondary }]}>{milestone.message}</Text>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 28,
    marginHorizontal: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
