# CampusPlate Security Audit Report

**Date:** 2026-02-18
**Auditor:** Claude (automated code review)
**Scope:** Full codebase — `app/`, `src/`, root config files
**Commit:** `f62d16b` (HEAD of `main`)

---

## 1. Executive Summary

CampusPlate has a **critical security gap**: Row Level Security (RLS) is not enabled on any Supabase table, meaning the client-side anon key (visible in the bundle) grants any authenticated user full read/write access to every other user's personal data — profiles, meal logs, water logs, and body stats. Additionally, the meal log delete operation does not verify ownership, compounding the risk. Beyond RLS, the codebase is reasonably well-structured with proper auth gating, safe date formatting for query filters, and correct servings multiplication. The primary work before any public release is enabling RLS with per-table policies, adding user_id checks to all mutations, and removing debug logging that leaks user IDs and profile data.

---

## 2. Recent Changes Summary (Last 2 Weeks)

| Commit | Description |
|--------|-------------|
| `f62d16b` | Water tracker: replaced undo with repeatable -8oz button and a reset-to-zero option |
| `7eb8a55` | More tab: activated FAQ modal, profile editor, nutrition prefs modal; fixed browse search keyboard dismiss bug |
| `8f0ee44` | Custom calorie/macro goal editing from the More tab with save and recalculate from profile |
| `d8a98b3` | Station grid: added contextual emoji mapping, fixed card heights, displayed full station names |
| `badf432` | UI polish pass: entry stagger animations, skeleton loading screens, haptic feedback, meal filter fix for Owens "Daily Items" |
| `0bf45c7` | Added undo button to water tracker |
| `427fe86` | Fixed onboarding: fetch dining hall IDs dynamically from Supabase instead of hardcoding, auth flow improvements |
| `058a50c` | Water tracker redesign: SVG ring, ounce-based tracking, quick-add pills, customizable daily goal |
| `e04827f` | Auth overhaul: password reset flow, onboarding persistence across sessions, sign-in UX improvements |
| `941d7c7` | Added water tracker to dashboard with Supabase persistence (water_logs table) |

**Highest-churn files:**
- `app/(tabs)/browse.tsx` — 896 lines changed (station grid, search, animations)
- `src/components/EditProfile.tsx` — 497 lines (new file)
- `src/components/EditGoals.tsx` — 438 lines (new file)
- `src/components/WaterTracker.tsx` — 322 lines (new file)
- `src/components/EditNutritionPrefs.tsx` — 266 lines (new file)
- `app/(tabs)/index.tsx` — 246 lines changed (water tracker integration, animations)
- `app/auth.tsx` — 219 lines changed (password reset, UX)
- `app/(tabs)/more.tsx` — 179 lines changed (modal launchers, settings)

---

## 3. Findings by Severity

### CRITICAL

#### C-1: Row Level Security (RLS) Not Enabled

**Location:** Supabase project configuration (not in code)
**Description:** No RLS policies exist on any table. The Supabase anon key (`eyJhbG...`) is embedded in the client bundle at `src/utils/supabase.ts:6`. This is expected for the anon key, BUT without RLS, the PostgREST API allows any authenticated user to:
- Read, update, or delete ANY user's profile (name, weight, age, gender, dorm, dietary needs)
- Read, insert, update, or delete ANY user's meal logs
- Read, insert, update, or delete ANY user's water logs
- Enumerate all users in the `profiles` table

**Why it's a problem:** This is a data breach waiting to happen. Any user who inspects network traffic or the JS bundle can craft direct Supabase REST calls to access all user data.

**Recommended fix:** Enable RLS on all user-data tables and create policies. See Section 5 for exact SQL.

---

#### C-2: Meal Log Deletion Without Ownership Check

**File:** `app/(tabs)/index.tsx`
**Line:** 231
```ts
await supabase.from('meal_logs').delete().eq('id', logId);
```

**Why it's a problem:** Deletes by log UUID only, with no `.eq('user_id', userId)` filter. Even after RLS is enabled, defense-in-depth requires the app to filter by user_id. Without RLS, any user can delete any other user's meal log if they obtain or guess the UUID.

**Recommended fix:**
```ts
const userId = await requireUserId();
await supabase.from('meal_logs').delete().eq('id', logId).eq('user_id', userId);
```

---

### HIGH

#### H-1: `toISOString()` Used for Timestamps (Project Convention Violation)

**Files & Lines:**
| File | Line | Code |
|------|------|------|
| `src/utils/water.ts` | 29 | `updated_at: new Date().toISOString()` |
| `src/utils/water.ts` | 62 | `updated_at: new Date().toISOString()` |
| `src/utils/goals.ts` | 47 | `updated_at: new Date().toISOString()` |

**Why it's a problem:** While these are `timestamp` columns (not `date` columns) and `toISOString()` is technically valid for timestamps, the project convention in CLAUDE.md explicitly says "NEVER use `toISOString()` for dates." This creates inconsistency and could lead to timezone-related bugs if the pattern spreads to date columns.

**Recommended fix:** Use `new Date().toISOString()` only for `timestamptz` columns (which is correct), but add a code comment clarifying this is intentional for the `updated_at` timestamp, or replace with a server-side `now()` default on the column.

---

#### H-2: Missing Error Handling on Supabase Mutations

Every Supabase `.insert()`, `.update()`, `.upsert()`, and `.delete()` should check the `error` return. The following calls silently discard errors:

| File | Line | Operation | Issue |
|------|------|-----------|-------|
| `src/utils/water.ts` | 26-33 | `.upsert()` (addWater) | No error check on Supabase return |
| `src/utils/water.ts` | 49-51 | `.update()` (setWaterGoal) | No error check on Supabase return |
| `src/utils/water.ts` | 59-64 | `.upsert()` (removeWater) | No error check on Supabase return |
| `app/(tabs)/index.tsx` | 231 | `.delete()` (deleteLog) | No error check on Supabase return |
| `app/(tabs)/browse.tsx` | 263-268 | `.insert()` (logMeal) | No error check on Supabase return |
| `app/(tabs)/more.tsx` | 89 | `.update()` (toggleHighProtein) | No error check on Supabase return |
| `app/(tabs)/progress.tsx` | 110 | `.update()` (logWeight) | No error check on Supabase return |
| `src/components/EditNutritionPrefs.tsx` | 94-98 | `.update()` (handleSave) | Catches JS errors but doesn't check `{ error }` return |
| `src/components/EditProfile.tsx` | 167-178 | `.update()` (handleSave) | Catches JS errors but doesn't check `{ error }` return |

**Why it's a problem:** Failed writes appear successful to the user. They see "Logged!" toast or a saved confirmation, but the data never persisted. This leads to data loss and user confusion.

**Recommended fix:** Destructure `{ error }` from every mutation and handle it:
```ts
const { error } = await supabase.from('meal_logs').insert({...});
if (error) throw new Error(`Failed to log meal: ${error.message}`);
```

---

#### H-3: Unprotected Profile Queries from loadCollections

**File:** `app/(tabs)/index.tsx`
**Line:** 148-152
```ts
const { data } = await supabase
  .from('menu_items')
  .select('id, name, station, nutrition(...), dietary_flags')
  .eq('date', today);
```

**Why it's a problem:** While `menu_items` should be public data, this query fetches ALL menu items for the date without any pagination or limit. If the menu grows large, this could cause performance issues. This is not a direct security issue but is flagged as a data loading concern.

**Recommended fix:** Consider adding `.limit(500)` as a safety net, or paginate if needed.

---

### MEDIUM

#### M-1: Console Logging of Sensitive User Data

| File | Line | Data Logged |
|------|------|-------------|
| `app/_layout.tsx` | 88 | `session.user.id` — user's Supabase UUID |
| `app/onboarding.tsx` | 141 | `JSON.stringify(data)` — all dining hall data |
| `app/onboarding.tsx` | 273 | `JSON.stringify(upsertData)` — full profile including name, weight, age, gender, dorm, dietary needs, body stats |

**Why it's a problem:** In production React Native builds, `console.log` output is accessible via debug bridges, device logs, and crash reporters. User profile data should never be logged in full.

**Recommended fix:** Remove all `console.log` statements before release, or use a logging library with environment-aware log levels. At minimum, remove the `JSON.stringify(upsertData)` call that dumps the full profile.

**Additional console statements that should be reviewed (lower risk):**
- `_layout.tsx`: Lines 65, 69, 74, 95, 99, 102 — auth flow debug logging
- `onboarding.tsx`: Lines 138, 144, 246, 270, 276 — onboarding debug logging
- `browse.tsx`: Lines 173, 213, 280 — data loading errors
- `history.tsx`: Line 62 — data loading errors
- `index.tsx`: Lines 140, 234, 244, 254 — dashboard errors
- `more.tsx`: Lines 77, 92, 108, 125 — settings errors
- `progress.tsx`: Lines 96, 115 — progress errors

Total: **28 console statements** across the app. Error logging is reasonable for development but all should be stripped or gated for production.

---

#### M-2: Hardcoded Colors Outside ThemeContext

| File | Line | Color | Should Be |
|------|------|-------|-----------|
| `app/(tabs)/_layout.tsx` | 153 | `backgroundColor: '#8B1E3F'` | `colors.maroon` |
| `app/(tabs)/_layout.tsx` | 157 | `shadowColor: 'rgba(139,30,63,0.3)'` | Derived from `colors.maroon` |
| `app/onboarding.tsx` | 561 | `color: '#8BB8FF'` | Not a defined theme color |
| `app/onboarding.tsx` | 565 | `color: '#FFB366'` | Not a defined theme color |
| `app/onboarding.tsx` | 569 | `color: '#FFE066'` | Not a defined theme color |
| `app/onboarding.tsx` | 632 | `backgroundColor: '#8B1E3F'` | `colors.maroon` |
| `app/onboarding.tsx` | 670 | `color: 'rgba(255,255,255,0.6)'` | Should use a theme token |
| `src/components/WaterTracker.tsx` | 17-18 | `WATER_BLUE = '#5B7FFF'`, `GOAL_GREEN = '#34C759'` | `colors.blue`, `colors.green` (these are the same values, but hardcoded) |

**Why it's a problem:** Hardcoded colors won't adapt to theme changes. The `_layout.tsx` plus button is always maroon regardless of theme mode. The onboarding macro colors don't match the theme system's blue/orange/yellow.

**Recommended fix:** Replace with `useTheme()` colors. For `_layout.tsx`, the `plusBtn` style in `StyleSheet.create` can't use hooks — consider moving to an inline style or a wrapper component that uses the theme.

---

#### M-3: Missing User Feedback on Failed Operations

| File | Line | Operation | Issue |
|------|------|-----------|-------|
| `app/(tabs)/index.tsx` | 229-235 | Delete meal log | Silently fails — user sees item disappear from local state even if DB delete fails |
| `app/(tabs)/browse.tsx` | 257-283 | Log meal | Catches error but only logs to console — user sees success toast even on failure |
| `app/(tabs)/more.tsx` | 85-93 | Toggle high protein | Silently fails — UI toggles back if re-rendered but no error shown |
| `app/(tabs)/progress.tsx` | 104-118 | Save weight | Only logs to console |

**Recommended fix:** Show an `Alert.alert('Error', message)` or toast on failure, and revert optimistic UI updates.

---

### LOW

#### L-1: Extensive Use of `any` Type

**31 instances** of `: any` across the codebase. Key offenders:

| File | Count | Examples |
|------|-------|---------|
| `app/(tabs)/browse.tsx` | 10 | `hall: any`, `item: any`, `items: any[]`, style prop |
| `app/(tabs)/history.tsx` | 8 | `logs: any[]`, `profile: any`, all reduce callbacks |
| `app/(tabs)/more.tsx` | 3 | `setProfile((p: any) => ...)` |
| `app/(tabs)/progress.tsx` | 2 | `forEach((log: any) => ...)`, `setProfile((p: any) => ...)` |
| `src/utils/auth.ts` | 1 | `callback: (session: any) => void` |
| `app/_layout.tsx` | 1 | `useState<any>(undefined)` for session |

**Why it's a problem:** TypeScript's safety guarantees are bypassed. Typos in property access (e.g., `log.menu_items.nutriton` instead of `nutrition`) would not be caught at compile time.

**Recommended fix:** Define interfaces for all Supabase response shapes and use them consistently. The `NutritionData` and `MealLog` interfaces in `index.tsx` are a good pattern to extend to other files.

---

#### L-2: Dead Code — `src/utils/user.ts`

**File:** `src/utils/user.ts` (entire file — 26 lines)

```ts
export async function getUserId(): Promise<string> {
  // Generates a random UUID and stores in AsyncStorage
}
```

**Why it's a problem:** This is a legacy pre-auth user ID system that generates random UUIDs. It's never imported or used anywhere in the current codebase (all code uses `requireUserId()` from `auth.ts`). It creates confusion about which user ID system is active.

**Recommended fix:** Delete the file entirely.

---

#### L-3: Inconsistent Error Handling Patterns

The codebase uses three different error handling patterns:

1. **Try/catch with throw** (`auth.ts`): Functions throw errors for callers to handle
2. **Try/catch with console.error** (`index.tsx`, `browse.tsx`, etc.): Errors logged but swallowed
3. **Try/catch with fallback defaults** (`goals.ts`, `water.ts`): Returns safe defaults on error

Pattern 2 is the most problematic — errors are invisible to the user. There's no unified error handling strategy.

**Recommended fix:** Adopt a consistent pattern. For mutations, always surface errors to the user. For reads, fallback to defaults is acceptable but should still be logged.

---

## 4. Auth & Data Access Review

### Supabase Client Configuration (`src/utils/supabase.ts`)
- **Anon key only** — no service role key in the frontend. GOOD.
- `autoRefreshToken: true` — session tokens auto-refresh. GOOD.
- `persistSession: true` with `AsyncStorage` — session persists across app restarts. GOOD.
- `detectSessionInUrl: false` — correct for React Native (no URL-based auth). GOOD.

### Auth Functions (`src/utils/auth.ts`)
- `signUp`, `signIn`, `signOut`, `resetPassword` — all properly check for errors and throw. GOOD.
- `getSession` — checks error, returns session. GOOD.
- `onAuthChange` — returns subscription for cleanup. GOOD.
- `getCurrentUserId` / `requireUserId` — proper null checks. GOOD.

### Auth Gate (`app/_layout.tsx`)
- Session starts as `undefined` (loading state), not `null` (unauthenticated). GOOD — prevents content flash.
- Three-state gate: loading spinner → auth screen → onboarding → tabs. GOOD.
- **An unauthenticated user CANNOT reach protected screens.** Verified.
- Auth state change listener properly clears onboarding state on sign-out. GOOD.

### Data Access Queries Without RLS

All queries that access user-specific data MUST filter by user_id. Current status:

| Table | Operation | File:Line | Filters by user_id? | Risk without RLS |
|-------|-----------|-----------|---------------------|-----------------|
| `profiles` | SELECT | `_layout.tsx:89-93` | `.eq('id', session.user.id)` | Low — filtered |
| `profiles` | SELECT | `index.tsx:122` | `.eq('id', userId)` | Low — filtered |
| `profiles` | SELECT | `history.tsx:51` | `.eq('id', userId)` | Low — filtered |
| `profiles` | SELECT | `progress.tsx:54` | `.eq('id', userId)` | Low — filtered |
| `profiles` | SELECT | `more.tsx:48-52` | `.eq('id', userId)` | Low — filtered |
| `profiles` | SELECT | `EditProfile.tsx:123-128` | `.eq('id', userId)` | Low — filtered |
| `profiles` | SELECT | `EditNutritionPrefs.tsx:65-69` | `.eq('id', userId)` | Low — filtered |
| `profiles` | SELECT | `goals.ts:20-24` | `.eq('id', userId)` | Low — filtered |
| `profiles` | SELECT | `water.ts:37-41` | `.eq('id', userId)` | Low — filtered |
| `profiles` | UPDATE | `more.tsx:89` | `.eq('id', userId)` | Low — filtered |
| `profiles` | UPDATE | `progress.tsx:110` | `.eq('id', userId)` | Low — filtered |
| `profiles` | UPDATE | `goals.ts:40-49` | `.eq('id', userId)` | Low — filtered |
| `profiles` | UPDATE | `water.ts:49-51` | `.eq('id', userId)` | Low — filtered |
| `profiles` | UPDATE | `EditProfile.tsx:167-178` | `.eq('id', userId)` | Low — filtered |
| `profiles` | UPDATE | `EditNutritionPrefs.tsx:94-98` | `.eq('id', userId)` | Low — filtered |
| `profiles` | UPSERT | `onboarding.tsx:248` | `id: userId` in payload | Low — keyed |
| `meal_logs` | SELECT | `index.tsx:124-128` | `.eq('user_id', userId)` | Low — filtered |
| `meal_logs` | SELECT | `history.tsx:52-57` | `.eq('user_id', userId)` | Low — filtered |
| `meal_logs` | SELECT | `progress.tsx:62-66` | `.eq('user_id', userId)` | Low — filtered |
| `meal_logs` | SELECT | `more.tsx:68-71` | `.eq('user_id', userId)` | Low — filtered |
| `meal_logs` | INSERT | `browse.tsx:263-268` | `user_id: userId` in payload | Low — includes user_id |
| **`meal_logs`** | **DELETE** | **`index.tsx:231`** | **`.eq('id', logId)` ONLY** | **CRITICAL — no user_id filter** |
| `water_logs` | SELECT | `water.ts:10-15` | `.eq('user_id', userId)` | Low — filtered |
| `water_logs` | UPSERT | `water.ts:27-31` | `user_id: userId` in payload | Low — keyed |
| `water_logs` | UPSERT | `water.ts:60-64` | `user_id: userId` in payload | Low — keyed |
| `menu_items` | SELECT | Multiple locations | No user filter needed | N/A — public data |
| `dining_halls` | SELECT | Multiple locations | No user filter needed | N/A — public data |

---

## 5. Required RLS Policies

The following SQL must be executed in the Supabase dashboard (SQL Editor) before any public release:

```sql
-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can insert their own profile (for onboarding upsert)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. MEAL_LOGS TABLE
-- ============================================================
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own meal logs
CREATE POLICY "Users can read own meal_logs"
  ON meal_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own meal logs
CREATE POLICY "Users can insert own meal_logs"
  ON meal_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own meal logs
CREATE POLICY "Users can delete own meal_logs"
  ON meal_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Users can update their own meal logs (for future servings editing)
CREATE POLICY "Users can update own meal_logs"
  ON meal_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. WATER_LOGS TABLE
-- ============================================================
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own water logs
CREATE POLICY "Users can read own water_logs"
  ON water_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert/upsert their own water logs
CREATE POLICY "Users can insert own water_logs"
  ON water_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own water logs
CREATE POLICY "Users can update own water_logs"
  ON water_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. MENU_ITEMS TABLE (public read)
-- ============================================================
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

-- Anyone can read menu items (public data)
CREATE POLICY "Public read access to menu_items"
  ON menu_items FOR SELECT
  USING (true);

-- ============================================================
-- 5. NUTRITION TABLE (public read)
-- ============================================================
ALTER TABLE nutrition ENABLE ROW LEVEL SECURITY;

-- Anyone can read nutrition data (public data)
CREATE POLICY "Public read access to nutrition"
  ON nutrition FOR SELECT
  USING (true);

-- ============================================================
-- 6. DINING_HALLS TABLE (public read)
-- ============================================================
ALTER TABLE dining_halls ENABLE ROW LEVEL SECURITY;

-- Anyone can read dining halls (public data)
CREATE POLICY "Public read access to dining_halls"
  ON dining_halls FOR SELECT
  USING (true);
```

---

## 6. Top 10 Fixes Before Public Release

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | **Enable RLS on all tables** with policies from Section 5 | 30 min | Prevents all cross-user data access |
| 2 | **Add `.eq('user_id', userId)` to meal log delete** (`index.tsx:231`) | 5 min | Prevents cross-user deletion |
| 3 | **Add `{ error }` checks on all Supabase mutations** (9 locations per H-2) | 1 hr | Prevents silent data loss |
| 4 | **Remove `console.log(JSON.stringify(upsertData))`** from `onboarding.tsx:273` | 2 min | Stops full profile data from appearing in logs |
| 5 | **Remove or gate all 28 console statements** for production | 30 min | Prevents user data leaking to device logs |
| 6 | **Delete `src/utils/user.ts`** (dead code, legacy pre-auth system) | 2 min | Removes confusion about user ID source |
| 7 | **Add user-facing error feedback** on failed mutations (Alert or toast) | 1 hr | Users know when operations fail |
| 8 | **Move hardcoded `#8B1E3F` in `_layout.tsx` plusBtn** to theme system | 15 min | Theme consistency |
| 9 | **Replace `any` types** with proper interfaces (especially `browse.tsx`, `history.tsx`) | 2 hr | Catches bugs at compile time |
| 10 | **Add account deletion feature** (FAQ says "contact dev team") | 2 hr | Required for App Store / GDPR compliance |

---

*End of audit. Generated by automated security review.*
