# CLAUDE.md — Bandhip's Agent Configuration

## Who I Am
I am the frontend/UI agent for CampusPlate, a Virginia Tech dining nutrition tracker. I work alongside Cameron's agent who handles backend, scraping, and Supabase schema. We work in parallel on separate tasks.

## Project Context
- **Repo:** https://github.com/bdawg711/CampusPlate
- **Stack:** React Native, Expo, TypeScript, Supabase
- **Design:** DM Sans (body) + Outfit (headings), dark/light theme via ThemeContext
- **Colors:** Maroon #8B1E3F (primary), Orange #E87722 (CTAs), Blue #5B7FFF (protein), Yellow #FFD60A (fat), Green #34C759 (vegan/positive), Red #FF453A (negative)

## My Responsibilities
- UI/UX design and polish
- New frontend features (water tracker, custom goals, animations, social features)
- Component design and reusability
- Making the app feel premium and native
- Fixing visual bugs and design inconsistencies

## What I Do NOT Touch Without Coordinating
- Supabase schema changes (new tables, new columns) — tell Cameron first
- scraper code (separate repo: campusplate-scraper)
- Supabase credentials or auth configuration

## Code Rules
1. **ALWAYS** `git pull` before starting any work
2. **ALWAYS** `git push` when done with a task
3. **NEVER** use `toISOString()` for dates — use local date formatting:
```ts
   const d = new Date();
   const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
```
4. **NEVER** hardcode colors — always use ThemeContext (`const { colors } = useTheme()`)
5. **NEVER** use external image URLs — emojis only for icons
6. **ALWAYS** use optional chaining (`?.`) on Supabase response data
7. **ALWAYS** wrap Supabase queries in try/catch with user-friendly error messages
8. **ALWAYS** add loading states (ActivityIndicator) while fetching data
9. **ALWAYS** handle empty states with emoji + helpful text
10. TextInputs must be stable — don't recreate them inside conditional renders or they'll dismiss the keyboard on every keystroke

## Supabase Query Patterns
```ts
// Menu items with nutrition (nested response)
const { data } = await supabase
  .from('menu_items')
  .select('*, nutrition(*)')
  .eq('dining_hall_id', hallId)
  .eq('date', today)
  .eq('meal', 'Lunch');
// Access: data[0].nutrition.calories

// Meal logs with nested joins
const { data } = await supabase
  .from('meal_logs')
  .select('id, servings, meal, created_at, menu_items(id, name, station, nutrition(calories, protein_g, total_carbs_g, total_fat_g))')
  .eq('user_id', userId)
  .eq('date', today);
// Access: data[0].menu_items.nutrition.calories * data[0].servings
```

## File Structure
- `app/_layout.tsx` — Root: fonts → auth → onboarding → tabs
- `app/auth.tsx` — Login/signup
- `app/onboarding.tsx` — 10-step wizard
- `app/(tabs)/_layout.tsx` — 5 tabs: Home, History, +, Progress, More
- `app/(tabs)/index.tsx` — Dashboard (calorie ring, macros, collections, meals)
- `app/(tabs)/history.tsx` — 30-day history
- `app/(tabs)/browse.tsx` — Hall → station → item → nutrition detail + log
- `app/(tabs)/progress.tsx` — Streak, charts, stats, weight
- `app/(tabs)/more.tsx` — Settings menu
- `src/context/ThemeContext.tsx` — Dark/light theme
- `src/utils/supabase.ts` — Supabase client
- `src/utils/auth.ts` — Auth functions
- `src/utils/nutrition.ts` — TDEE calculator

## Style Guide
- Cards: 14px border radius, theme card background, subtle border
- Chips/pills: 24px border radius
- Buttons: 14px border radius, maroon primary, orange for CTAs
- Spacing: 20px horizontal padding on screens, 16px card padding
- Headings: Outfit font, 700-800 weight
- Body: DM Sans, 400-600 weight
- Muted text: theme textMuted color, 11-13px
- Section headers: 12px uppercase, 1.5px letter spacing, 30% opacity
- The + tab button: 52px circle, maroon bg, -16px margin top, box shadow with maroon glow

## Current State
The app is fully functional with real users testing it. All core features work. Focus on polish, new features, and making it feel like a $10M app.
