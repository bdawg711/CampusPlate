import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

/**
 * Returns an array of Animated.Values (one per element) that animate
 * from 0 → 1 in a staggered sequence.
 *
 * Each returned value drives opacity; combine with interpolated
 * translateY / scale as needed in the consuming component.
 */
export function useStaggerAnimation(count: number, { staggerMs = 50, durationMs = 300, delayMs = 0 } = {}) {
  const anims = useRef<Animated.Value[]>(
    Array.from({ length: count }, () => new Animated.Value(0))
  ).current;

  const play = useCallback(() => {
    // Reset all to 0
    anims.forEach((a) => a.setValue(0));

    const animations = anims.map((a, i) =>
      Animated.timing(a, {
        toValue: 1,
        duration: durationMs,
        delay: delayMs + i * staggerMs,
        useNativeDriver: true,
      })
    );

    Animated.parallel(animations).start();
  }, [anims, staggerMs, durationMs, delayMs]);

  return { anims, play };
}
