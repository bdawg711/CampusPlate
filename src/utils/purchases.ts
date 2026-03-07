import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

// Replace with your actual RevenueCat API key from app.revenuecat.com
const REVENUECAT_APPLE_KEY = 'test_xjbniTSvsGRqJmAauSgFfAzhFdT';

const ENTITLEMENT_ID = 'premium';

/**
 * Initialize RevenueCat SDK. Call once on app startup after auth is ready.
 */
export async function initializePurchases(userId?: string) {
  if (Platform.OS === 'web') return;

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({
      apiKey: REVENUECAT_APPLE_KEY,
      appUserID: userId ?? undefined,
    });

    if (__DEV__) console.log('[Purchases] RevenueCat initialized');
  } catch (e: any) {
    console.warn('[Purchases] Failed to initialize:', e?.message);
  }
}

/**
 * Check if the current user has an active premium subscription.
 */
export async function checkSubscription(): Promise<{
  isPremium: boolean;
  expiresAt: Date | null;
}> {
  if (Platform.OS === 'web') {
    return { isPremium: false, expiresAt: null };
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (entitlement) {
      const expiresAt = entitlement.expirationDate
        ? new Date(entitlement.expirationDate)
        : null;
      return { isPremium: true, expiresAt };
    }

    return { isPremium: false, expiresAt: null };
  } catch (e: any) {
    console.warn('[Purchases] Failed to check subscription:', e?.message);
    return { isPremium: false, expiresAt: null };
  }
}

/**
 * Purchase the monthly premium subscription ($10/month).
 * Returns true if purchase was successful.
 */
export async function purchaseMonthly(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const monthlyPackage: PurchasesPackage | undefined =
      offerings.current?.monthly ?? offerings.current?.availablePackages?.[0];

    if (!monthlyPackage) {
      throw new Error('No subscription package available');
    }

    const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
    const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (__DEV__) console.log('[Purchases] Purchase result: isPremium =', isPremium);

    return isPremium;
  } catch (e: any) {
    // User cancelled — not an error
    if (e.userCancelled) {
      if (__DEV__) console.log('[Purchases] User cancelled purchase');
      return false;
    }
    throw e;
  }
}

/**
 * Restore previous purchases (e.g., after reinstall or new device).
 * Returns true if premium entitlement was restored.
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = !!customerInfo.entitlements.active[ENTITLEMENT_ID];

    if (__DEV__) console.log('[Purchases] Restore result: isPremium =', isPremium);

    return isPremium;
  } catch (e: any) {
    console.warn('[Purchases] Failed to restore purchases:', e?.message);
    throw e;
  }
}
