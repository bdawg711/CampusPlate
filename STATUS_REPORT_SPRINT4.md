# CampusPlate — Sprint 4 Status Report (UI/UX Focus)

> **Generated:** 2026-02-19
> **Purpose:** Give Bandhip everything needed to write the Sprint 4 PRD without reading code.
> **Branch:** `main` (clean, latest commit `23c60de`)

---

## Table of Contents

1. [Complete File Inventory](#1-complete-file-inventory)
2. [Current Screens](#2-current-screens)
3. [Database Tables](#3-database-tables)
4. [Available Utility Functions](#4-available-utility-functions)
5. [Component Library](#5-component-library)
6. [Theme System](#6-theme-system)
7. [Known UI/UX Issues](#7-known-uiux-issues)
8. [Navigation Structure](#8-navigation-structure)
9. [Global Rules](#9-global-rules)
10. [What Not to Touch](#10-what-not-to-touch)

---

## 1. Complete File Inventory

### App Screens & Navigation (`app/`)

| File | Description |
|------|-------------|
| `app/_layout.tsx` | Root layout — font loading, auth state, onboarding flow, notification deep-linking, reminder restoration |
| `app/auth.tsx` | Login / signup / password-reset screen with email validation and error handling |
| `app/onboarding.tsx` | 10-step onboarding wizard: goal, activity, body stats, dietary needs, home hall, campus life, plan summary |
| `app/+html.tsx` | Web-only HTML root for static rendering (scroll reset, dark mode background) |
| `app/(tabs)/_layout.tsx` | Tab navigator with 5 tabs: Home, History, Browse (+), Progress, More — animated icons + pulsing + button |
| `app/(tabs)/index.tsx` | Home dashboard: calorie ring, macro cards, water tracker, "Open Now" halls, "For You" collections, meal logs, AI FAB |
| `app/(tabs)/history.tsx` | 30-day meal history with date strip, daily summary card, and meal-period grouping |
| `app/(tabs)/browse.tsx` | Multi-level menu browser: halls → stations → items → nutrition detail + search, favorites, ratings, meal logging |
| `app/(tabs)/progress.tsx` | Weekly progress: streak tracker, calorie bar chart, stats grid, weight logging, full weekly report |
| `app/(tabs)/more.tsx` | Settings menu: profile, goals, preferences, water goal, reminders, appearance, help, sign out |

### Context (`src/context/`)

| File | Description |
|------|-------------|
| `src/context/ThemeContext.tsx` | Dark/light theme provider with full color palette, font families, and persistent preference via AsyncStorage |

### Utilities (`src/utils/`)

| File | Description |
|------|-------------|
| `src/utils/supabase.ts` | Supabase client singleton with AsyncStorage persistence and auto-refresh token |
| `src/utils/auth.ts` | Auth functions: signUp, signIn, signOut, resetPassword, getSession, onAuthChange, getCurrentUserId, requireUserId |
| `src/utils/nutrition.ts` | TDEE calculator (Mifflin-St Jeor), daily goal calculator, weekly projection |
| `src/utils/goals.ts` | Fetch, save, and recalculate custom nutrition goals with macro splits |
| `src/utils/meals.ts` | Meal period detection, meal group filtering, fallback date logic for late scraper updates |
| `src/utils/mealPlans.ts` | Meal planning: add/remove items, fetch planned meals with nutrition summaries |
| `src/utils/water.ts` | Water logging: get/add/remove daily water, get/set water goal |
| `src/utils/favorites.ts` | Favorite item management: toggle, list, check, find favorites on today's menu |
| `src/utils/ratings.ts` | Dining hall ratings/reviews: rate, get averages, get reviews, check user rating |
| `src/utils/hours.ts` | Dining hall open/closed status: single hall, all halls batch, time formatting |
| `src/utils/recommendations.ts` | "For You" engine: favorites today, fits macros, top rated, try something new, quick & light |
| `src/utils/ai.ts` | AI chat: send message to Edge Function, get/clear chat history |
| `src/utils/aiPrompt.ts` | System prompt builder for AI: user context, remaining macros, menu filtering |
| `src/utils/weeklyReport.ts` | 7-day report generator: daily totals, macro averages, adherence %, hydration, weight trend, streak |
| `src/utils/notifications.ts` | Meal reminder system: register push, schedule/save/load reminders, cancel all |

### Components (`src/components/`)

| File | Description |
|------|-------------|
| `src/components/Skeleton.tsx` | Pulsing loading placeholder with configurable width/height/radius |
| `src/components/WaterTracker.tsx` | Water ring (SVG) + quick-add/remove buttons with haptic feedback |
| `src/components/EditProfile.tsx` | Modal: edit name, year, dorm, body stats, activity, goal, home hall |
| `src/components/EditGoals.tsx` | Modal: custom or calculated calorie/macro goal editing with macro calorie chips |
| `src/components/EditNutritionPrefs.tsx` | Modal: dietary needs chips, high-protein toggle, meals-per-day selector |
| `src/components/ReminderSettings.tsx` | Modal: per-meal reminder toggles with inline time picker (hour/minute/AM-PM) |
| `src/components/HelpFAQ.tsx` | Modal: 8 collapsible FAQ entries with footer |
| `src/components/WeeklyReport.tsx` | Modal: calorie/macro charts, hydration circles, streak stats, weight trend line graph |
| `src/components/AIChat.tsx` | Modal: full chat interface with suggestion chips, typing indicator, error retry, clear history |
| `src/components/AIChatBubble.tsx` | Chat bubble: user/assistant styling with optional meal item cards and "Log this" buttons |

### Hooks (`src/hooks/`)

| File | Description |
|------|-------------|
| `src/hooks/useStaggerAnimation.ts` | Staggered opacity animation hook: creates N animated values that fade in sequentially |

**Total: 37 source files** (10 screens, 1 context, 15 utilities, 10 components, 1 hook)

---

## 2. Current Screens

### Home Tab (`app/(tabs)/index.tsx`)

**Top to bottom:**

1. **Header** — Greeting with date ("Friday, Feb 19"), "Hey [Name] 👋", maroon avatar circle with initial
2. **Calorie Ring** — 170px SVG circle, animates fill as calories are logged. Center shows "X of Y cal"
3. **Macro Cards** — 3 staggered-entry cards: Protein (blue), Carbs (orange), Fat (yellow). Each shows value in grams, goal label, animated horizontal progress bar
4. **Water Tracker** — `<WaterTracker>` component: 96px blue/green ring, quick-add pills (+8/12/16/24 oz), −8 and Reset buttons
5. **Open Now** — Horizontal scroll of hall cards. Each shows emoji + hall name + green meal badge + closing time. Taps navigate to Browse
6. **For You Collections** — Up to 5 horizontal-scroll sections:
   - "Your Favorites Today" ❤️ — favorited items on today's menu
   - "Fits Your Macros" 🎯 — items matching goal type
   - "Top Rated Halls" 🏛️ — halls sorted by avg rating with open/closed badge
   - "Try Something New" ✨ — items at home hall user hasn't logged
   - "Quick & Light" 🥗 — items under 300 cal from open halls
   - Each card: 140px wide, emoji + name + calories + hall name. "See All →" links to Browse
7. **Today's Meals** — Grouped by BREAKFAST / LUNCH / DINNER. Each item: maroon dot + name + calories + delete ✕. Empty state: bouncing 🍽️ + "No [meal] logged yet"
8. **AI Chat FAB** — 52px maroon circle with ✨, absolute bottom-right. Opens `<AIChat>` modal

**Pull-to-refresh enabled. Full skeleton loading on first load.**

---

### History Tab (`app/(tabs)/history.tsx`)

**Top to bottom:**

1. **Header** — "History" title (26px Outfit Bold)
2. **30-Day Date Strip** — Horizontal scroll of 30 pill buttons (day number + day name). Selected = maroon bg + white text. Haptic feedback on tap
3. **Daily Summary Card** — Large calorie total (36px Outfit ExtraBold), "of X calories" subtext, three stat items below: Protein (blue), Carbs (orange), Fat (yellow) with gram values
4. **Meal Groups** — Same layout as Home but **read-only** (no delete buttons). BREAKFAST / LUNCH / DINNER grouping with item lists. Empty state: 🍽️ + "No [meal] logged"

**Pull-to-refresh enabled. ActivityIndicator while loading.**

---

### Browse Tab (`app/(tabs)/browse.tsx`)

This is a **multi-view screen** with animated transitions between 4 views:

#### View 1: Halls
- **Search bar** — "Search dining halls..."
- **Meal filter chips** — Breakfast / Lunch / Dinner (maroon when selected)
- **Fallback banner** — Orange alert if showing yesterday's menu
- **Hall cards** — Spring-animated PressableCards: emoji + hall name + status badge (green "Open · Lunch" or gray "Closed · Opens 5 PM") + item count (maroon circle) + ⭐ rating. Open halls sorted first

#### View 2: Stations (inside a hall)
- **Header** — Hall name + "Breakfast · Today" + back button
- **Rate This Hall** button — ⭐ opens rating modal (1-5 stars + optional review text)
- **Search bar** — "Search items..."
- **Station cards** — 2-column grid: emoji + station name + item count. Search mode shows items grouped by station
- **Recent Reviews** — Up to 10 reviews: ⭐ rating + user name + date + text. Empty: "No reviews yet — be the first!"

#### View 3: Items (inside a station)
- **Header** — 🔥 Station name + hall · meal subtext + back button
- **Search bar** — Filters items in this station
- **Item list** — Dietary dot (green V/VG, blue H) + name + macros + favorite heart (❤️/🤍) + calorie count

#### View 4: Detail (item nutrition)
- **Item name** header + back button
- **Calorie display** — Large number (adjusted for servings) + "calories per serving"
- **Macro row** — Protein (blue) · Carbs (orange) · Fat (yellow)
- **Servings selector** — 4 chips: 0.5, 1, 1.5, 2
- **Nutrition grid** — 2 columns, 14 fields: Total Fat, Sat Fat, Trans Fat, Cholesterol, Sodium, Total Carbs, Fiber, Sugars, Added Sugars, Protein, Vitamin D, Calcium, Iron, Potassium
- **Dietary flags** — Green pills if present
- **Ingredients** — Card with text if available
- **Footer bar** — "X cal · Y serving(s)" + orange "Log This Meal ✓" button → green "Logged! ✓" on success

**Rating modal, toast notification (spring animation, auto-dismiss 2s), view transitions (slide + fade).**

---

### Progress Tab (`app/(tabs)/progress.tsx`)

**Top to bottom:**

1. **Header** — "Progress" title (26px Outfit Bold)
2. **Streak Card** — "Current Streak" label + large day count + 7-day dot row (green ✓ if logged, gray if not, day labels M/T/W/T/F/S/S)
3. **Weekly Calories Chart** — 7 vertical bars. Today's bar = orange, other days = maroon. Day name + calorie count above each bar. Max height 120px
4. **Stats Grid** (2×2) — Avg Calories (blue), Avg Protein (blue), Current Weight (or "—"), Goal Adherence % (green)
5. **Log Weight** — Collapsible card: tap to reveal TextInput (50-500 lbs) + Save button
6. **View Full Report** — Maroon full-width button → opens `<WeeklyReport>` modal

**Pull-to-refresh enabled. ActivityIndicator while loading.**

---

### More Tab (`app/(tabs)/more.tsx`)

**Top to bottom:**

1. **Profile Header** — Maroon avatar circle + initial, name (20px Outfit Bold), year · dorm, streak + goal calories. "Edit Profile" link
2. **Settings Card 1:**
   - My Profile → `<EditProfile>` modal
   - Nutrition Goals → shows "2,000 kcal" chip → `<EditGoals>` modal
   - Nutrition Preferences → `<EditNutritionPrefs>` modal
   - Water Goal → shows "64 oz" chip → inline modal with TextInput
   - Gym Mode (High Protein) → toggle switch + "PRO" orange badge
3. **Settings Card 2:**
   - Reminders → shows On/Off chip → `<ReminderSettings>` modal
   - Appearance → shows Dark/Light chip → toggles theme on tap
   - Weekly Report → "NEW" blue badge → `<WeeklyReport>` modal
   - Dining Halls → info alert
   - Help & FAQ → `<HelpFAQ>` modal
4. **Settings Card 3:**
   - Share CampusPlate → native Share sheet
   - Sign Out → red text, confirmation alert
5. **Footer** — "CampusPlate v1.0 · Built for Virginia Tech" (very muted)

---

## 3. Database Tables

### profiles
**Purpose:** User account, body stats, nutrition goals, preferences, and settings

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Supabase auth user ID |
| `name` | text | User's name |
| `year` | text | Freshman / Sophomore / Junior / Senior / Graduate |
| `dorm` | text | Residence hall |
| `weight` | numeric | Weight in lbs |
| `height` | numeric | Height in cm |
| `age` | integer | Age in years |
| `is_male` | boolean | Gender flag |
| `activity_level` | text | sedentary / light / moderate / active |
| `goal` | text | aggressive_cut / moderate_cut / maintain / lean_bulk / aggressive_bulk |
| `home_hall_id` | integer (FK) | Default dining hall |
| `goal_calories` | integer | Daily calorie target |
| `goal_protein_g` | integer | Daily protein target (g) |
| `goal_carbs_g` | integer | Daily carbs target (g) |
| `goal_fat_g` | integer | Daily fat target (g) |
| `water_goal_oz` | integer | Daily water goal (oz), default 64 |
| `dietary_needs` | text[] | Array: Vegetarian, Vegan, Gluten-Free, Halal, Kosher, Dairy-Free, Nut-Free |
| `high_protein` | boolean | Gym mode / prioritize protein |
| `meals_per_day` | integer | Expected meals per day |
| `onboarding_complete` | boolean | Finished 10-step onboarding |
| `reminder_prefs` | json[] | [{meal, enabled, hour, minute}] |
| `created_at` | timestamptz | Account creation |
| `updated_at` | timestamptz | Last update |

### dining_halls
**Purpose:** Master list of Virginia Tech dining facilities

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Hall ID |
| `name` | text | Hall name |
| `location_num` | integer | Location identifier |

### menu_items
**Purpose:** Food items available at dining halls on specific dates

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Item ID |
| `dining_hall_id` | integer (FK) | Which hall |
| `date` | text | YYYY-MM-DD |
| `meal` | text | Breakfast / Lunch / Dinner / Lunch/Dinner / Daily Items |
| `rec_num` | text | Stable recipe identifier (same dish across dates) |
| `name` | text | Item name |
| `station` | text | Serving station |
| `dietary_flags` | text[] | Dietary tags |

### nutrition
**Purpose:** Macronutrient breakdown for menu items (1:1 with menu_items)

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Row ID |
| `menu_item_id` | integer (FK) | Which menu item |
| `calories` | integer | Calories |
| `protein_g` | numeric | Protein grams |
| `total_carbs_g` | numeric | Carb grams |
| `total_fat_g` | numeric | Fat grams |

### meal_logs
**Purpose:** What users ate and when

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Log ID |
| `user_id` | UUID (FK) | Who logged |
| `menu_item_id` | integer (FK) | What was eaten |
| `date` | text | YYYY-MM-DD |
| `meal` | text | Meal period |
| `servings` | numeric | Number of servings (default 1) |
| `created_at` | timestamptz | When logged |

### water_logs
**Purpose:** Daily water consumption tracking

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID (FK) | Who |
| `date` | text | YYYY-MM-DD |
| `glasses` | integer | Total ounces consumed |
| `updated_at` | timestamptz | Last update |

Composite key: `(user_id, date)` — upsert pattern

### favorites
**Purpose:** Favorited menu items for quick access

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Favorite ID |
| `user_id` | UUID (FK) | Who favorited |
| `rec_num` | text | Recipe identifier |
| `item_name` | text | Item name |
| `created_at` | timestamptz | When favorited |

### hall_ratings
**Purpose:** User ratings and reviews for dining halls

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Rating ID |
| `user_id` | UUID (FK) | Who rated |
| `dining_hall_id` | integer (FK) | Which hall |
| `rating` | integer | Star rating (1-5) |
| `review_text` | text | Optional review text |
| `date` | text | YYYY-MM-DD |
| `updated_at` | timestamptz | Last update |

Constraint: one rating per `(user_id, dining_hall_id, date)`

### dining_hall_hours
**Purpose:** Operating hours per hall per meal per date

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Row ID |
| `dining_hall_id` | integer (FK) | Which hall |
| `date` | text | YYYY-MM-DD |
| `meal` | text | Meal period |
| `open_time` | text | HH:MM:SS |
| `close_time` | text | HH:MM:SS |

### meal_plans
**Purpose:** Pre-planned meals (meal prep feature)

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Plan ID |
| `user_id` | UUID (FK) | Who planned |
| `menu_item_id` | integer (FK) | What item |
| `date` | text | YYYY-MM-DD |
| `meal` | text | Meal period |
| `servings` | numeric | Servings (default 1) |
| `created_at` | timestamptz | When planned |

### ai_chat_logs
**Purpose:** AI assistant conversation history

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer (PK) | Message ID |
| `user_id` | UUID (FK) | Who chatted |
| `role` | text | user / assistant |
| `content` | text | Message text |
| `meal_items` | json[] | Structured meal suggestions from AI |
| `created_at` | timestamptz | When sent |

### RPC Functions

| Function | Parameters | Returns | Purpose |
|----------|------------|---------|---------|
| `get_weekly_report` | `p_user_id: UUID, p_end_date: text` | JSON with daily_totals, goals, water_totals, weight_entries, streak | 7-day nutrition report data |
| `get_hall_averages` | none | Array of {dining_hall_id, avg_rating, total_ratings} | Average ratings for all halls |
| `get_hall_reviews` | `p_hall_id: integer, p_limit: integer` | Array of {rating, review_text, date, user_name} | Recent reviews for a hall (max 20) |
| `get_ai_context` | `p_user_id: UUID, p_date: text` | JSON with profile, consumed_today, todays_menu | Full context for AI system prompt |

### Entity Relationships

```
auth.users
  └─ profiles (1:1)
       ├─ meal_logs (1:N) → menu_items (N:1) → nutrition (1:1)
       ├─ water_logs (1:N)
       ├─ favorites (1:N) → menu_items via rec_num
       ├─ hall_ratings (1:N) → dining_halls
       ├─ meal_plans (1:N) → menu_items (N:1) → nutrition (1:1)
       └─ ai_chat_logs (1:N)

dining_halls (1:N)
  ├─ menu_items (1:N) → nutrition (1:1)
  └─ dining_hall_hours (1:N)
```

---

## 4. Available Utility Functions

### src/utils/auth.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `signUp` | `(email: string, password: string) => Promise<any>` | Sign up new user |
| `signIn` | `(email: string, password: string) => Promise<any>` | Sign in existing user |
| `signOut` | `() => Promise<void>` | Sign out current user |
| `resetPassword` | `(email: string) => Promise<void>` | Send password reset email with deep link |
| `getSession` | `() => Promise<Session \| null>` | Get current auth session |
| `onAuthChange` | `(callback: (session: any) => void) => any` | Listen for auth state changes |
| `getCurrentUserId` | `() => Promise<string \| null>` | Get current user ID or null |
| `requireUserId` | `() => Promise<string>` | Get current user ID or throw |

### src/utils/supabase.ts

| Export | Type | What It Does |
|--------|------|--------------|
| `supabase` | `SupabaseClient` | Singleton Supabase client with AsyncStorage persistence |

### src/utils/nutrition.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `calculateTDEE` | `(weight, height, age, isMale, activityLevel?) => number` | Mifflin-St Jeor TDEE calculation |
| `calculateDailyGoal` | `(weight, height, age, isMale, goal, activityLevel?) => number` | Daily calories based on TDEE + goal modifier |
| `getWeeklyProjection` | `(goalCalories, tdee) => string` | Estimated weekly weight change string |

**Types:** `ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'`
**Types:** `GoalType = 'aggressive_cut' | 'moderate_cut' | 'maintain' | 'lean_bulk' | 'aggressive_bulk'`
**Constants:** `GOAL_OPTIONS` — array of {key, label, description} for goal picker

### src/utils/goals.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `getGoals` | `(userId: string) => Promise<Goals>` | Fetch user's nutrition goals (defaults if missing) |
| `saveCustomGoals` | `(userId: string, goals: Goals) => Promise<void>` | Save custom calorie/macro goals |
| `recalculateGoals` | `(userId: string) => Promise<Goals>` | Recalculate from body stats and save |

**Interface:** `Goals = { goalCalories, goalProtein, goalCarbs, goalFat }`

### src/utils/meals.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `getMealQueryValues` | `(meal: string) => string[]` | Map meal name to all matching DB values |
| `getCurrentMealPeriod` | `() => string` | Return Breakfast (before 10:30), Lunch (before 16:30), or Dinner |
| `logBelongsToMealGroup` | `(logMeal, group) => boolean` | Check if a log belongs to a display group |
| `getEffectiveMenuDate` | `() => Promise<string>` | Today's date or yesterday if no menu today |

### src/utils/mealPlans.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `addToPlan` | `(userId, menuItemId, date, meal, servings?) => Promise<void>` | Add item to meal plan |
| `removeFromPlan` | `(userId, menuItemId, date) => Promise<void>` | Remove item from meal plan |
| `getPlannedMeals` | `(userId, date) => Promise<PlannedMeal[]>` | Get all planned meals for a date |
| `getPlannedMealsSummary` | `(userId, date) => Promise<PlannedMealsSummary>` | Get calorie/macro totals for planned day |

### src/utils/water.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `getTodayWater` | `(userId) => Promise<number>` | Get today's water intake (oz) |
| `addWater` | `(userId, ounces) => Promise<number>` | Add water, return new total |
| `removeWater` | `(userId, ounces) => Promise<number>` | Remove water (min 0), return new total |
| `getWaterGoal` | `(userId) => Promise<number>` | Get water goal (default 64 oz) |
| `setWaterGoal` | `(userId, goalOz) => Promise<void>` | Set water goal |

### src/utils/favorites.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `toggleFavorite` | `(userId, recNum, itemName) => Promise<boolean>` | Toggle favorite; returns true if now favorited |
| `getFavorites` | `(userId) => Promise<Favorite[]>` | Get all favorites (newest first) |
| `isFavorited` | `(userId, recNum) => Promise<boolean>` | Check if item is favorited |
| `getFavoritesOnTodaysMenu` | `(userId, date) => Promise<FavoriteMenuItem[]>` | Favorited items on today's menu |

### src/utils/ratings.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `rateHall` | `(userId, hallId, rating, reviewText?, date?) => Promise<void>` | Rate a hall (upsert per user/hall/day) |
| `getHallAverages` | `() => Promise<Record<number, HallAverage>>` | Average ratings for all halls via RPC |
| `getHallReviews` | `(hallId) => Promise<HallReview[]>` | Recent reviews for a hall (max 20) |
| `getUserRating` | `(userId, hallId, date?) => Promise<UserRating \| null>` | Check if user already rated today |

### src/utils/hours.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `getHallHours` | `(hallId) => Promise<HallHourRow[]>` | Get all hour entries for a hall |
| `isHallOpen` | `(hallId, now) => Promise<HallStatus>` | Check if a hall is open with current/next meal |
| `getAllHallStatuses` | `(now) => Promise<Record<number, HallStatus>>` | Batch open/closed status for all halls |

**Interface:** `HallStatus = { isOpen, currentMeal?, closingTime?, nextOpen?, nextMeal? }`

### src/utils/recommendations.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `getFavoritesToday` | `(userId, date) => Promise<FavoriteMenuItem[]>` | Favorites on today's menu |
| `getFitsYourMacros` | `(userId, date, mealPeriod) => Promise<RecommendedItem[]>` | Items matching goal type (max 10) |
| `getTopRatedHalls` | `() => Promise<TopRatedHallItem[]>` | Top 5 halls by avg rating with status |
| `getTrySomethingNew` | `(userId, date) => Promise<RecommendedItem[]>` | Items at home hall user hasn't logged (max 8) |
| `getQuickAndLight` | `(date) => Promise<RecommendedItem[]>` | Items under 300 cal from open halls (max 10) |

### src/utils/ai.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `sendMessage` | `(userId, message, history) => Promise<{content, mealItems}>` | Send message to AI Edge Function |
| `getChatHistory` | `(userId) => Promise<ChatLogRow[]>` | Fetch full chat history (oldest first) |
| `clearChatHistory` | `(userId) => Promise<void>` | Delete all chat history |

### src/utils/aiPrompt.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `getRelevantMealPeriods` | `() => string[]` | Current + next meal period |
| `buildSystemPrompt` | `(context: AIContext) => string` | Build full system prompt for AI with goals, consumption, menu |

### src/utils/weeklyReport.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `getWeeklyReport` | `(userId, endDate?) => Promise<WeeklyReportData>` | 7-day report: daily totals, averages, adherence, water, weight, streak |

**Interface:** `WeeklyReportData = { dailyTotals, averages, goals, adherence, waterTotals, avgWaterOz, daysWaterGoalMet, weightEntries, streak, daysLogged, mostConsistentMeal, startDate, endDate }`

### src/utils/notifications.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `registerForPushNotifications` | `() => Promise<string \| null>` | Request permissions, return push token |
| `scheduleMealReminders` | `(reminders) => Promise<void>` | Schedule daily repeating notifications |
| `saveMealReminders` | `(userId, reminders) => Promise<void>` | Save prefs + schedule notifications |
| `loadMealReminders` | `(userId) => Promise<MealReminders>` | Load prefs (defaults if missing) |
| `cancelAllNotifications` | `() => Promise<void>` | Cancel all scheduled notifications |

**Constants:** `DEFAULT_REMINDERS` — all disabled, 8:00 AM / 12:00 PM / 6:00 PM

### src/hooks/useStaggerAnimation.ts

| Function | Signature | What It Does |
|----------|-----------|--------------|
| `useStaggerAnimation` | `(count, { staggerMs?, durationMs?, delayMs? }) => { anims, play }` | Creates N animated values (0→1) that fade in sequentially. Returns array of Animated.Values + play() trigger |

---

## 5. Component Library

### Skeleton
**Props:** `width: number|string`, `height: number`, `borderRadius?: number` (default 8), `style?: ViewStyle`
**Renders:** Pulsing placeholder block (opacity loops 0.15–0.3 over 1600ms). Uses theme card background color.

### WaterTracker
**Props:** `consumed: number`, `goal: number`, `onAddWater: (oz) => void`, `onRemoveWater: (oz) => void`, `loading: boolean`
**Renders:** Card with 96px SVG ring (blue under goal, green when met) + 2×2 quick-add pill grid (+8/12/16/24 oz) + −8 and Reset buttons. Spring-scale press animations. Haptic feedback on add (Light if under goal, Medium if reaching goal).

### EditProfile
**Props:** `visible: boolean`, `onClose: () => void`, `onSaved: () => void`
**Renders:** Full-screen modal (pageSheet). Three sections: Personal Info (name, year pills, dorm), Body Stats (weight, height ft/in, age, gender buttons), Preferences (activity level pills, goal pills, home hall radio list). Save prompts recalculate.

### EditGoals
**Props:** `visible: boolean`, `currentGoals: Goals`, `onSave: (goals) => Promise<void>`, `onRecalculate: () => Promise<Goals>`, `onClose: () => void`
**Renders:** Modal with Custom/Calculated toggle. 4 input fields (Calories, Protein, Carbs, Fat) with colored dots. Macro calorie chips (P kcal, C kcal, F kcal, total). Read-only in Calculated mode. Recalculate button.

### EditNutritionPrefs
**Props:** `visible: boolean`, `onClose: () => void`, `onSaved: () => void`
**Renders:** Modal with 3 sections: Dietary Needs (7 toggle chips), Gym Mode (switch), Meals Per Day (5 pills).

### ReminderSettings
**Props:** `visible: boolean`, `onClose: () => void`
**Renders:** Modal with 3 meal rows (🌅 Breakfast, ☀️ Lunch, 🌙 Dinner). Each has switch + time chip. Expanded shows inline time editor (hour/minute arrows, AM/PM toggle). Registers push notifications when enabling.

### HelpFAQ
**Props:** `visible: boolean`, `onClose: () => void`
**Renders:** Modal with 8 collapsible FAQ entries (tap chevron to expand). Footer: "CampusPlate v1.0 · Built for Virginia Tech".

### WeeklyReport
**Props:** `visible: boolean`, `onClose: () => void`, `initialEndDate?: string`
**Renders:** Complex modal with week navigation arrows. 6 sections:
1. Daily Averages — 2×2 grid of SummaryCards (cal/P/C/F with % of goal, color-coded)
2. Daily Calories — 7-bar chart with dashed goal line, tap-to-tooltip
3. Macro Breakdown — Stacked horizontal bars (Actual vs Goal P/C/F %)
4. Hydration — Avg oz/day, days goal met (X/7), 7 circles (blue if met)
5. Streaks — 3 cards (🔥 streak, 📅 days logged, ⭐ most consistent meal)
6. Weight Trend — Line chart (conditional, only if 2+ entries)

### AIChat
**Props:** `visible: boolean`, `onClose: () => void`, `onLogItem?: (item: MealItem) => void`
**Renders:** Modal with FlatList of messages. User bubbles: maroon, right-aligned. Assistant bubbles: card bg, left-aligned, with optional meal item cards. Empty state: 4 suggestion chips. Typing indicator: 3 bouncing dots. Error state: retry button. Sticky input row: multiline TextInput + circular send button.

### AIChatBubble
**Props:** `role: 'user'|'assistant'`, `content: string`, `mealItems?: MealItem[]`, `onLogItem?: (item) => void`
**Renders:** Single message bubble. 82% max width, 14px radius with one sharpened corner. Meal item cards: name (Outfit Bold), hall name, macro pills (cal/P/C/F), green "Log this" button.

---

## 6. Theme System

### How It Works

`ThemeContext.tsx` provides a React Context with:
- `mode: 'dark' | 'light'` — current theme
- `colors: ThemeColors` — merged color object (base + accents)
- `toggleTheme()` — switches mode and persists to AsyncStorage (key: `campusplate_theme`)

Default is **dark mode**. Every component uses `const { colors } = useTheme()`.

### Dark Theme Colors

| Property | Value | Usage |
|----------|-------|-------|
| `background` | `#0F0F1A` | Main app background |
| `card` | `#1A1A2E` | Card/elevated surface |
| `cardAlt` | `#16162A` | Alternative card (slightly darker) |
| `text` | `#F0EDE6` | Primary text (warm off-white) |
| `textMuted` | `#7A7A90` | Secondary text |
| `textDim` | `#4A4A60` | Tertiary/hint text |
| `border` | `rgba(255,255,255,0.05)` | Subtle borders |
| `inputBg` | `#1A1A2E` | Input backgrounds |
| `inputBorder` | `rgba(255,255,255,0.08)` | Input borders |

### Light Theme Colors

| Property | Value | Usage |
|----------|-------|-------|
| `background` | `#FAF8F4` | Main app background (warm cream) |
| `card` | `#FFFFFF` | Card/elevated surface |
| `cardAlt` | `#F5F3EF` | Alternative card (off-white) |
| `text` | `#1A1A1A` | Primary text |
| `textMuted` | `#8A8A8A` | Secondary text |
| `textDim` | `#BCBCBC` | Tertiary/hint text |
| `border` | `rgba(0,0,0,0.05)` | Subtle borders |
| `inputBg` | `#FFFFFF` | Input backgrounds |
| `inputBorder` | `rgba(0,0,0,0.1)` | Input borders |

### Accent Colors (Both Themes)

| Property | Value | Usage |
|----------|-------|-------|
| `maroon` | `#8B1E3F` | Primary brand, VT maroon, buttons, selected pills |
| `maroonLight` | `#A8274D` | Hover/active states |
| `orange` | `#E87722` | CTAs, active tab tint, log button |
| `green` | `#34C759` | Positive indicators, vegan, on-target, water goal met |
| `blue` | `#5B7FFF` | Protein macro, stats, water ring |
| `yellow` | `#FFD60A` | Fat/carb macro color |
| `red` | `#FF453A` | Errors, sign out, over-goal |

### Font Families

**DM Sans** (body text):
- `DMSans_400Regular` — default body
- `DMSans_500Medium` — emphasized body
- `DMSans_600SemiBold` — input labels, tab labels
- `DMSans_700Bold` — button text

**Outfit** (headings):
- `Outfit_300Light` — light headings
- `Outfit_400Regular` — standard headings
- `Outfit_500Medium` — medium emphasis
- `Outfit_600SemiBold` — strong headings
- `Outfit_700Bold` — main headings, item names
- `Outfit_800ExtraBold` — hero text, calorie numbers, app title

---

## 7. Known UI/UX Issues

### Screens That Feel Empty or Unfinished

1. **History screen** — Very simple. Just a date strip + summary card + meal list. No charts, no trends, no comparison to goals. Could show macro ring or progress indicators
2. **Progress screen** — Stats grid is basic (4 plain boxes). No goal progress visualization beyond the simple bar chart. Weight section is hidden behind a collapsible
3. **More screen** — "Dining Halls" row opens a basic `Alert.alert()` with text instead of a proper screen. Feels like a placeholder

### Inconsistencies

4. **Pulsing + button** is hardcoded to `hasLoggedToday={false}` — it always pulses regardless of whether user has logged. Needs real state integration
5. **Meal plan utils exist** (`mealPlans.ts`) but are **not exposed in any UI**. The meal_plans table and all CRUD functions are built but there's no screen to use them
6. **No "Favorites" screen** — users can favorite items from Browse but there's no dedicated place to see all favorites. Only appears in "For You" if items are on today's menu
7. **Hall reviews capped at 10** in the stations view — no "see more" or pagination

### Missing Animations & Transitions

8. **No screen transition animations** between tabs — instant switches
9. **History date strip** has no scroll-to-selected animation on load
10. **Meal group sections** on Home/History don't animate in — they just appear
11. **Modal transitions** are all `presentationStyle: 'pageSheet'` with default slide — no custom animations
12. **No confetti or celebration** when hitting daily goals

### Features Hard to Discover

13. **AI Chat** is only accessible via a small FAB in the bottom-right of Home — easy to miss
14. **Weekly Report** is buried in More > Weekly Report — not promoted after the week ends
15. **Weight logging** is hidden behind a collapsible card on Progress — users might not know it exists
16. **Rating halls** requires navigating into a hall's stations view — not obvious from the halls list
17. **Water tracker reset** is a small text button that could be accidentally tapped

### Empty States That Could Be Better

18. **For You collections** silently show nothing if recommendations fail — no error or "check back later"
19. **Browse search** empty state is just "No items found" with emoji — could suggest alternatives
20. **Progress screen** when no data: just shows 0s and dashes — could show onboarding prompts

### Placeholders / "Coming Soon"

21. **Meal Plans** — full backend exists, zero UI
22. **"Dining Halls" row** in More — just an alert, not a real feature
23. **Share CampusPlate** — uses basic native Share sheet, no deep link or referral system
24. **No social features** — no friends, no leaderboards, no shared meals

### Other Issues

25. **AI chat is allowlisted** to only 2 users during beta — needs proper rollout or paywall UI
26. **No onboarding re-entry** — if a user wants to redo onboarding or see the plan summary again, there's no way
27. **Skeleton loading** adds hardcoded 3 rows even when there might be fewer items
28. **Fallback menu banner** (yesterday's menu) is functional but could be more prominent or actionable
29. **No pull-to-refresh on Browse** — only Home, History, and Progress have it
30. **Nutrition detail view** shows 14 fields but doesn't highlight which are good/bad relative to goals

---

## 8. Navigation Structure

### Root Flow

```
App Launch
  ├─ [Loading] → ActivityIndicator (fonts + session + onboarding check)
  ├─ [No Session] → AuthScreen (signin / signup / forgot password)
  ├─ [Session, No Onboarding] → OnboardingScreen (10 steps)
  └─ [Session, Onboarded] → Tab Navigator
```

### Tab Navigator

```
Tab Navigator (5 tabs)
  ├─ Home (index) ──── 🏠
  ├─ History ────────── 📅
  ├─ Browse (+) ──────── ⊕ (animated maroon circle)
  ├─ Progress ────────── 📊
  └─ More ────────────── •••
```

### Screen-to-Screen Navigation

| From | To | Trigger | Params Passed |
|------|----|---------|---------------|
| Home → Browse | Tap "Open Now" hall card | `{ meal: currentMealPeriod }` |
| Home → Browse | Tap "See All →" on For You | `{ filter: 'favorites'|'macros'|'new'|'light' }` |
| Home → AIChat | Tap FAB (✨) | Opens modal (no navigation) |
| Progress → WeeklyReport | Tap "View Full Report" | Opens modal (no navigation) |
| More → EditProfile | Tap profile header or "My Profile" | Opens modal |
| More → EditGoals | Tap "Nutrition Goals" | Opens modal |
| More → EditNutritionPrefs | Tap "Nutrition Preferences" | Opens modal |
| More → ReminderSettings | Tap "Reminders" | Opens modal |
| More → WeeklyReport | Tap "Weekly Report" | Opens modal |
| More → HelpFAQ | Tap "Help & FAQ" | Opens modal |

### Browse Internal Navigation (View Stack)

```
Halls View
  └─ tap hall → Stations View (slide transition)
       └─ tap station → Items View (slide transition)
            └─ tap item → Detail View (slide transition)
```

Each transition uses animated slide + fade. Back button reverses the animation.

### Deep Linking

- **URL Scheme:** `campusplate://`
- **Notification deep link:** When a meal reminder is tapped, navigates to `/(tabs)/browse` with `{ meal: 'Breakfast'|'Lunch'|'Dinner' }`
- **Password reset deep link:** Uses `campusplate://` scheme for auth callback

### Params Reference

**Browse screen accepts:**
- `filter?: 'favorites' | 'macros' | 'new' | 'light'` — shows filtered item list instead of halls view
- `meal?: 'Breakfast' | 'Lunch' | 'Dinner'` — pre-selects meal filter chip

---

## 9. Global Rules

Every Sprint 4 task **must** follow these rules:

### Date Handling
```typescript
// NEVER use toISOString() for dates
// ALWAYS use local date formatting:
const d = new Date();
const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```

### Colors
- **NEVER** hardcode colors — always use `const { colors } = useTheme()`
- All accent colors available on both themes: maroon, maroonLight, orange, green, blue, yellow, red
- Theme-specific colors change with mode: background, card, cardAlt, text, textMuted, textDim, border, inputBg, inputBorder

### Typography
- **Headings:** Outfit font, weight 700-800
- **Body text:** DM Sans, weight 400-600
- **Muted text:** theme `textMuted` color, 11-13px
- **Section headers:** 12px uppercase, 1.5px letter spacing, 30% opacity

### Spacing & Borders
- Cards: 14px border radius, theme `card` background, theme `border` (1px)
- Chips/pills: 24px border radius
- Buttons: 14px border radius
- Screen horizontal padding: 20px
- Card internal padding: 16px

### Icons
- **NEVER** use external image URLs — emojis only for icons

### Supabase Queries
- **ALWAYS** use optional chaining (`?.`) on response data
- **ALWAYS** wrap in try/catch with user-friendly error messages
- **ALWAYS** add loading states (`ActivityIndicator`) while fetching
- **ALWAYS** handle empty states with emoji + helpful text

### TextInputs
- Must be **stable** — don't recreate inside conditional renders (causes keyboard dismissal on every keystroke)
- Define input components outside of `renderStep()` or conditional blocks

### Animations
- Use `react-native-reanimated` or `Animated` API
- Haptic feedback via `expo-haptics` on interactive elements
- Spring animations for press effects (scale 0.97 on press)

### The + Tab Button
- 52px circle, maroon bg, -16px margin top, box shadow with maroon glow
- This is a branded element — don't change its appearance

---

## 10. What Not to Touch

### Backend-Only (Cameron's Domain)

| Item | Why |
|------|-----|
| `supabase/functions/ai-chat/index.ts` | Edge Function — backend logic, rate limiting, Claude API |
| `supabase/functions/ai-chat/deno.json` | Edge Function config |
| Supabase schema (new tables/columns) | Coordinate with Cameron before any DB changes |
| Scraper code (separate repo: `campusplate-scraper`) | Completely separate project |
| Supabase credentials / auth config | Security-sensitive backend config |
| RPC functions (`get_weekly_report`, `get_hall_averages`, etc.) | Server-side SQL — Cameron maintains these |

### Config Files (Don't Modify Without Reason)

| File | Why |
|------|-----|
| `src/utils/supabase.ts` | Supabase client init — stable, no reason to change |
| `app.json` | Expo config — only change for new plugins or permissions |
| `tsconfig.json` | TypeScript config — stable |
| `.env` | Environment variables — contains secrets |

### Files Safe to Modify in UI Sprint

Everything in `app/(tabs)/`, `src/components/`, `src/context/ThemeContext.tsx`, `src/hooks/`, and most of `src/utils/` (for new client-side utility functions). New components can be created in `src/components/`. New hooks can be created in `src/hooks/`.

---

*End of Sprint 4 Status Report*
