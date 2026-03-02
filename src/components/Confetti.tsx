import React, { useEffect, useState, useCallback } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
interface Props {
  visible: boolean;
  onComplete?: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PIECE_COUNT = 30;

const COLORS = ['#861F41', '#C5A55A', '#A8A9AD', '#4A7FC5', '#E87722', '#34C759'];

interface PieceConfig {
  startX: number;
  startY: number;
  color: string;
  width: number;
  height: number;
  borderRadius: number;
  duration: number;
  driftX: number;
  rotation: number;
}

function generatePieces(): PieceConfig[] {
  return Array.from({ length: PIECE_COUNT }, () => {
    const isCircle = Math.random() > 0.5;
    const size = 4 + Math.random() * 6; // 4-10px varied sizes
    return {
      startX: Math.random() * SCREEN_WIDTH,
      startY: -10 - Math.random() * 30, // stagger start positions
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      width: isCircle ? size : size * (0.8 + Math.random() * 0.6),
      height: isCircle ? size : size * (0.3 + Math.random() * 0.4),
      borderRadius: isCircle ? size / 2 : 1,
      duration: 2000 + Math.random() * 1000, // 2-3 seconds
      driftX: (Math.random() - 0.5) * 120, // wider horizontal drift
      rotation: Math.random() * 720,
    };
  });
}

function ConfettiPiece({ config, onDone }: { config: PieceConfig; onDone?: () => void }) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    // Fall with deceleration
    translateY.value = withTiming(SCREEN_HEIGHT * 0.7, {
      duration: config.duration,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
    // Horizontal drift with sinusoidal easing
    translateX.value = withTiming(config.driftX, {
      duration: config.duration,
      easing: Easing.inOut(Easing.sin),
    });
    // Spin
    rotate.value = withTiming(config.rotation, {
      duration: config.duration,
      easing: Easing.out(Easing.quad),
    });
    // Fade out in the last third of the animation
    opacity.value = withTiming(0, {
      duration: config.duration,
      easing: Easing.in(Easing.quad),
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: config.startX,
          top: config.startY,
          width: config.width,
          height: config.height,
          borderRadius: config.borderRadius,
          backgroundColor: config.color,
        },
        animStyle,
      ]}
    />
  );
}

export default function Confetti({ visible, onComplete }: Props) {
  const [pieces, setPieces] = useState<PieceConfig[]>([]);
  const [active, setActive] = useState(false);
  const doneCount = React.useRef(0);

  const handlePieceDone = useCallback(() => {
    doneCount.current += 1;
    if (doneCount.current >= PIECE_COUNT) {
      setActive(false);
      setPieces([]);
      onComplete?.();
    }
  }, [onComplete]);

  useEffect(() => {
    if (visible && !active) {
      doneCount.current = 0;
      setPieces(generatePieces());
      setActive(true);
    }
  }, [visible]);

  if (!active || pieces.length === 0) return null;

  // Find the longest-duration piece to attach onDone callback
  const maxDuration = Math.max(...pieces.map(p => p.duration));

  return (
    <View style={styles.container} pointerEvents="none">
      {pieces.map((piece, i) => (
        <ConfettiPiece
          key={i}
          config={piece}
          onDone={piece.duration === maxDuration && i === pieces.findIndex(p => p.duration === maxDuration) ? handlePieceDone : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
});
