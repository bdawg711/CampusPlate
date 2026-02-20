import React, { useEffect, useState, useCallback } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { accent } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  onComplete?: () => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const PIECE_COUNT = 35;

const COLORS = [accent.maroon, accent.orange, accent.green, accent.blue, accent.yellow, accent.red];

interface PieceConfig {
  startX: number;
  color: string;
  isCircle: boolean;
  duration: number;
  driftX: number;
  rotation: number;
}

function generatePieces(): PieceConfig[] {
  return Array.from({ length: PIECE_COUNT }, () => ({
    startX: Math.random() * SCREEN_WIDTH,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    isCircle: Math.random() > 0.5,
    duration: 1500 + Math.random() * 1000,
    driftX: (Math.random() - 0.5) * 60,
    rotation: Math.random() * 720,
  }));
}

function ConfettiPiece({ config, onDone }: { config: PieceConfig; onDone?: () => void }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(SCREEN_HEIGHT + 20, {
      duration: config.duration,
      easing: Easing.out(Easing.quad),
    }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
    translateX.value = withTiming(config.driftX, {
      duration: config.duration,
      easing: Easing.inOut(Easing.sin),
    });
    rotate.value = withTiming(config.rotation, {
      duration: config.duration,
      easing: Easing.out(Easing.quad),
    });
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: config.startX,
          top: -20,
          width: config.isCircle ? 6 : 8,
          height: config.isCircle ? 6 : 4,
          borderRadius: config.isCircle ? 3 : 1,
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
