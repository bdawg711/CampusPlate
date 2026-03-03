import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Box, Text } from '@/src/theme/restyleTheme';
import { requireUserId } from '@/src/utils/auth';
import { supabase } from '@/src/utils/supabase';
import { getCurrentMealPeriod } from '@/src/utils/meals';

// ── Types ───────────────────────────────────────────────────────────────────

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void;
}

interface ProductNutrition {
  name: string;
  calories: number;
  protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  serving_size: string;
  barcode: string;
}

type MealPeriod = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

const MEAL_PERIODS: MealPeriod[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUTOUT_SIZE = SCREEN_WIDTH * 0.7;

// ── Component ───────────────────────────────────────────────────────────────

export default function BarcodeScannerModal({
  visible,
  onClose,
  onLogged,
}: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [looking, setLooking] = useState(false);
  const [product, setProduct] = useState<ProductNutrition | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealPeriod>(
    getCurrentMealPeriod() as MealPeriod,
  );
  const [logging, setLogging] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Prevent duplicate scans via ref (state updates can lag behind rapid scans)
  const scanLock = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setScanned(false);
      setProduct(null);
      setNotFound(false);
      setFlashOn(false);
      setLooking(false);
      setLogging(false);
      scanLock.current = false;
      setSelectedMeal(getCurrentMealPeriod() as MealPeriod);
    }
  }, [visible]);

  // Request permission on first open
  useEffect(() => {
    if (visible && !permission?.granted && permission?.canAskAgain !== false) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  // ── Barcode scanned handler ─────────────────────────────────────────────

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (scanLock.current || scanned) return;
      scanLock.current = true;
      setScanned(true);
      setLooking(true);
      setNotFound(false);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      try {
        const response = await fetch(
          `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(data)}.json`,
        );
        const json = await response.json();

        if (json.status === 1 && json.product) {
          const p = json.product;
          const nutriments = p.nutriments || {};

          const name =
            p.product_name || p.product_name_en || 'Unknown Product';
          const calories = Math.round(
            nutriments['energy-kcal_100g'] ||
              nutriments['energy-kcal_serving'] ||
              nutriments['energy-kcal'] ||
              0,
          );
          const protein_g = Math.round(
            nutriments.proteins_serving ||
              nutriments.proteins_100g ||
              nutriments.proteins ||
              0,
          );
          const total_carbs_g = Math.round(
            nutriments.carbohydrates_serving ||
              nutriments.carbohydrates_100g ||
              nutriments.carbohydrates ||
              0,
          );
          const total_fat_g = Math.round(
            nutriments.fat_serving ||
              nutriments.fat_100g ||
              nutriments.fat ||
              0,
          );
          const serving_size = p.serving_size || p.quantity || 'Unknown';

          // Prefer per-serving values when available
          const calsServing = nutriments['energy-kcal_serving'];
          const finalCalories = calsServing
            ? Math.round(calsServing)
            : calories;

          setProduct({
            name,
            calories: finalCalories,
            protein_g,
            total_carbs_g,
            total_fat_g,
            serving_size,
            barcode: data,
          });
        } else {
          setNotFound(true);
        }
      } catch (err) {
        if (__DEV__) console.error('OpenFoodFacts lookup failed:', err);
        setNotFound(true);
      } finally {
        setLooking(false);
      }
    },
    [scanned],
  );

  // ── Log meal to custom_meals ────────────────────────────────────────────

  const handleLogMeal = async () => {
    if (!product || logging) return;
    setLogging(true);

    try {
      const userId = await requireUserId();
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const { error } = await supabase.from('custom_meals').insert({
        user_id: userId,
        name: product.name,
        calories: product.calories,
        protein_g: product.protein_g,
        total_carbs_g: product.total_carbs_g,
        total_fat_g: product.total_fat_g,
        meal: selectedMeal,
        date: today,
        barcode: product.barcode,
        serving_size: product.serving_size,
      });

      if (error) {
        if (__DEV__) console.error('Log custom meal failed:', error.message);
        Alert.alert('Error', 'Failed to log meal. Please try again.');
        setLogging(false);
        return;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onLogged();
      onClose();
    } catch (e: any) {
      if (__DEV__) console.error('Log error:', e?.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLogging(false);
    }
  };

  // ── Scan again ──────────────────────────────────────────────────────────

  const handleScanAgain = () => {
    setScanned(false);
    setProduct(null);
    setNotFound(false);
    scanLock.current = false;
  };

  // ── Permission denied state ─────────────────────────────────────────────

  if (visible && permission && !permission.granted) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}
      >
        <Box flex={1} backgroundColor="background" justifyContent="center" alignItems="center" padding="l">
          <Feather name="camera-off" size={64} color="#9A9A9E" style={{ opacity: 0.3 }} />
          <Text
            variant="cardTitle"
            style={{ fontSize: 18, fontFamily: 'Outfit_600SemiBold', marginTop: 24, textAlign: 'center' }}
          >
            Camera Access Required
          </Text>
          <Text
            variant="muted"
            style={{ textAlign: 'center', marginTop: 12, maxWidth: 280, lineHeight: 20 }}
          >
            CampusPlate needs camera access to scan food barcodes. Enable it in your device settings.
          </Text>
          {permission.canAskAgain && (
            <TouchableOpacity
              onPress={requestPermission}
              activeOpacity={0.7}
              style={styles.permissionButton}
            >
              <Text variant="body" style={{ color: '#FFFFFF', fontFamily: 'DMSans_600SemiBold' }}>
                Grant Permission
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ marginTop: 16 }}>
            <Text variant="body" style={{ color: '#861F41', fontFamily: 'DMSans_500Medium' }}>
              Go Back
            </Text>
          </TouchableOpacity>
        </Box>
      </Modal>
    );
  }

  // ── Main camera modal ───────────────────────────────────────────────────

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Camera */}
        {visible && permission?.granted && (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={flashOn}
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code128',
                'code39',
              ],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
        )}

        {/* Overlay with cutout */}
        <View style={styles.overlay}>
          {/* Top overlay */}
          <View style={styles.overlayTop} />

          {/* Middle row: left + cutout + right */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.cutout}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={styles.overlaySide} />
          </View>

          {/* Bottom overlay */}
          <View style={styles.overlayBottom} />
        </View>

        {/* Header controls */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setFlashOn((f) => !f)}
            activeOpacity={0.7}
            style={styles.headerButton}
            accessibilityLabel={flashOn ? 'Turn off flash' : 'Turn on flash'}
            accessibilityRole="button"
          >
            <Feather
              name={flashOn ? 'zap' : 'zap-off'}
              size={22}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={styles.headerButton}
            accessibilityLabel="Close scanner"
            accessibilityRole="button"
          >
            <Feather name="x" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Instruction text above cutout */}
        {!scanned && (
          <View style={styles.instructionContainer}>
            <Text
              variant="body"
              style={{ color: '#FFFFFF', fontSize: 16, fontFamily: 'DMSans_500Medium', textAlign: 'center' }}
            >
              Scan a barcode
            </Text>
            <Text
              variant="muted"
              style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4, textAlign: 'center' }}
            >
              Position the barcode inside the frame
            </Text>
          </View>
        )}

        {/* Loading state */}
        {looking && (
          <View style={styles.resultSheet}>
            <Box alignItems="center" padding="l">
              <ActivityIndicator size="large" color="#861F41" />
              <Text variant="body" style={{ marginTop: 16, fontFamily: 'DMSans_500Medium' }}>
                Looking up product...
              </Text>
            </Box>
          </View>
        )}

        {/* Not found state */}
        {notFound && !looking && (
          <View style={styles.resultSheet}>
            <Box alignItems="center" padding="l">
              <Feather name="alert-circle" size={40} color="#C0392B" style={{ opacity: 0.6 }} />
              <Text
                variant="cardTitle"
                style={{ fontSize: 16, marginTop: 16, textAlign: 'center' }}
              >
                Product not found
              </Text>
              <Text
                variant="muted"
                style={{ textAlign: 'center', marginTop: 8, maxWidth: 260, lineHeight: 20 }}
              >
                This barcode isn't in our database. Try scanning again or use manual entry.
              </Text>
              <TouchableOpacity
                onPress={handleScanAgain}
                activeOpacity={0.7}
                style={styles.scanAgainButton}
              >
                <Feather name="camera" size={16} color="#861F41" style={{ marginRight: 8 }} />
                <Text variant="body" style={{ color: '#861F41', fontFamily: 'DMSans_600SemiBold' }}>
                  Scan Again
                </Text>
              </TouchableOpacity>
            </Box>
          </View>
        )}

        {/* Product found — confirmation card */}
        {product && !looking && (
          <View style={styles.resultSheet}>
            <Box padding="l">
              {/* Product name + serving */}
              <Text
                variant="cardTitle"
                style={{ fontSize: 18, fontFamily: 'Outfit_600SemiBold' }}
                numberOfLines={2}
              >
                {product.name}
              </Text>
              <Text variant="muted" style={{ marginTop: 4 }}>
                Serving: {product.serving_size}
              </Text>

              {/* Nutrition grid */}
              <Box
                flexDirection="row"
                justifyContent="space-between"
                style={{ marginTop: 20, gap: 8 }}
              >
                <NutritionPill
                  label="Calories"
                  value={`${product.calories}`}
                  unit="kcal"
                  color="#861F41"
                />
                <NutritionPill
                  label="Protein"
                  value={`${product.protein_g}`}
                  unit="g"
                  color="#4A7FC5"
                />
                <NutritionPill
                  label="Carbs"
                  value={`${product.total_carbs_g}`}
                  unit="g"
                  color="#E87722"
                />
                <NutritionPill
                  label="Fat"
                  value={`${product.total_fat_g}`}
                  unit="g"
                  color="#D4A024"
                />
              </Box>

              {/* Incomplete data warning */}
              {product.calories === 0 && (
                <Box
                  flexDirection="row"
                  alignItems="center"
                  style={{
                    marginTop: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    backgroundColor: 'rgba(212,160,36,0.10)',
                    borderRadius: 8,
                  }}
                >
                  <Feather name="alert-triangle" size={14} color="#D4A024" style={{ marginRight: 8 }} />
                  <Text variant="dim" style={{ color: '#D4A024', flex: 1 }}>
                    Some nutrition data may be missing for this product.
                  </Text>
                </Box>
              )}

              {/* Meal period picker */}
              <Box style={{ marginTop: 20 }}>
                <Text variant="sectionHeader" style={{ marginBottom: 10 }}>
                  MEAL PERIOD
                </Text>
                <Box flexDirection="row" style={{ gap: 8 }}>
                  {MEAL_PERIODS.map((meal) => (
                    <Pressable
                      key={meal}
                      onPress={() => setSelectedMeal(meal)}
                      style={[
                        styles.mealPill,
                        selectedMeal === meal && styles.mealPillActive,
                      ]}
                    >
                      <Text
                        variant="bodySmall"
                        style={{
                          fontFamily: 'DMSans_500Medium',
                          fontSize: 13,
                          color: selectedMeal === meal ? '#FFFFFF' : '#6B6B6F',
                        }}
                      >
                        {meal}
                      </Text>
                    </Pressable>
                  ))}
                </Box>
              </Box>

              {/* Action buttons */}
              <Box style={{ marginTop: 24, gap: 10 }}>
                <TouchableOpacity
                  onPress={handleLogMeal}
                  activeOpacity={0.7}
                  disabled={logging}
                  style={[styles.logButton, logging && { opacity: 0.6 }]}
                >
                  {logging ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="check" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text variant="body" style={{ color: '#FFFFFF', fontFamily: 'DMSans_600SemiBold', fontSize: 16 }}>
                        Log Meal
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleScanAgain}
                  activeOpacity={0.7}
                  style={styles.scanAgainButtonSecondary}
                >
                  <Text variant="body" style={{ color: '#6B6B6F', fontFamily: 'DMSans_500Medium' }}>
                    Scan Another
                  </Text>
                </TouchableOpacity>
              </Box>
            </Box>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Nutrition pill sub-component ──────────────────────────────────────────

function NutritionPill({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <Box
      flex={1}
      alignItems="center"
      style={{
        paddingVertical: 12,
        paddingHorizontal: 4,
        backgroundColor: `${color}10`,
        borderRadius: 10,
      }}
    >
      <Text
        variant="body"
        style={{ fontSize: 18, fontFamily: 'DMSans_700Bold', color }}
      >
        {value}
      </Text>
      <Text variant="dim" style={{ marginTop: 2, color: '#6B6B6F' }}>
        {unit}
      </Text>
      <Text variant="dim" style={{ marginTop: 1, fontSize: 10, color: '#9A9A9E' }}>
        {label}
      </Text>
    </Box>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: CUTOUT_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cutout: {
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  // Corner brackets
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#FFFFFF',
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
    borderTopLeftRadius: 16,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderTopRightRadius: 16,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 16,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 16,
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Instruction text
  instructionContainer: {
    position: 'absolute',
    top: (SCREEN_HEIGHT - CUTOUT_SIZE) / 2 - 70,
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  // Result bottom sheet
  resultSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.55,
  },

  // Meal period pills
  mealPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F7',
    alignItems: 'center',
  },
  mealPillActive: {
    backgroundColor: '#861F41',
  },

  // Buttons
  logButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#861F41',
    paddingVertical: 14,
    borderRadius: 14,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8EA',
  },
  scanAgainButtonSecondary: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  permissionButton: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: '#861F41',
  },
});
