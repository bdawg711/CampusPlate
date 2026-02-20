# Sprint 4 — Parallel Development Plan

## Developers
- **Cameron**: All shared file edits, integration, nav restructure, restyle
- **Bandhip**: New utility files + new components only

---

## IRON RULES

1. **Bandhip NEVER touches these files:**
   - app/(tabs)/index.tsx
   - app/(tabs)/browse.tsx
   - app/(tabs)/progress.tsx
   - app/(tabs)/more.tsx
   - app/(tabs)/_layout.tsx
   - app/(tabs)/ai.tsx
   - src/components/AIChat.tsx
   - src/components/AIChatBubble.tsx

2. **Bandhip ONLY creates NEW files in:**
   - src/utils/ (new files only)
   - src/components/ (new files only)
   - src/context/ThemeContext.tsx (task 2.1 ONLY — add tokens, don't change existing values)

3. **Git discipline:**
   - `git pull origin main` BEFORE every task
   - `git push origin main` AFTER every task
   - One task = one commit = one push
   - Commit format: `feat(sprint4): [task#] short description`
   - If push is rejected, `git pull` then push again
   - NEVER force push

4. **Communication checkpoints (described below):**
   - Both devs STOP at checkpoints and confirm status before continuing

---

## TASK ASSIGNMENTS

### BANDHIP'S TASKS (16 tasks — all new files)

**Phase 1 — Utilities (do these first, in order):**
```
2.1  Update ThemeContext.tsx — add 5 new tokens (cardGlass, cardGlassBorder, barTrack, glowMaroon, tabBarBg)
     ONLY add new properties. Do NOT change any existing color values.
     
3.1  Create src/utils/streaks.ts
     
4.1  Create src/utils/dailyScore.ts
     
6.1  Create src/utils/progressData.ts
     NOTE: nutrition join returns array — use item.nutrition[0].calories pattern
     
7.1  Create src/utils/weightData.ts
     CONFIRMED: weight_logs columns are: id, user_id, date, weight_lbs, created_at
     Use: .select('date, weight_lbs') and map to { date, weight: entry.weight_lbs }
     
8.1  Create src/utils/micronutrients.ts
     ALL micronutrient columns confirmed:
     calories, total_fat_g, sat_fat_g, trans_fat_g, cholesterol_mg, sodium_mg,
     total_carbs_g, dietary_fiber_g, sugars_g, added_sugars_g, protein_g,
     vitamin_d_mcg, calcium_mg, iron_mg, potassium_mg, ingredients
     Build with real data, no mocks.
```

**Phase 2 — Components (do these after ALL Phase 1 is done):**
```
3.2  Create src/components/StreakBadge.tsx
3.3  Create src/components/StreakDisplay.tsx
4.2  Create src/components/DailyScoreCard.tsx
5.1  Create src/components/Confetti.tsx
     NOTE: Do NOT use AsyncStorage. Use useRef for celebration tracking.
5.2  Create src/components/GoalHitBanner.tsx
6.2  Create src/components/CalorieChart.tsx
6.3  Create src/components/MacroBreakdown.tsx
7.2  Create src/components/WeightChart.tsx
8.2  Create src/components/MicronutrientScreen.tsx
9.2  Create src/components/ShareCard.tsx
```

### CAMERON'S TASKS (30 tasks — integration + shared files)

**Phase 1 — Nav Restructure (do while Bandhip does Phase 1):**
```
1.1  Create src/components/FloatingTabBar.tsx
1.2  Modify src/components/AIChat.tsx — add mode prop
1.3  Create app/(tabs)/ai.tsx
1.4  Update app/(tabs)/_layout.tsx — new tab structure
1.5  Update app/(tabs)/index.tsx — remove FAB, add history access
```

**Phase 3 — Integration (do AFTER Bandhip finishes Phase 2):**
```
3.4  Add streak card to Dashboard (index.tsx)
3.5  Add badges to Settings (more.tsx)
4.3  Integrate daily score into Dashboard + Progress
5.3  Wire celebrations into Dashboard
6.4  Rebuild app/(tabs)/progress.tsx
7.3  Wire WeightChart into Progress tab
8.3  Wire MicronutrientScreen into Progress + Browse
9.1  Install react-native-view-shot + expo-sharing
9.3  Wire share button on Progress tab
```

**Phase 4 — Polish:**
```
10.1 Fix pulsing + button state (skip if Feature 1 done)
10.2 Pull-to-refresh on Browse
10.3 Improve empty states
10.4 Nutrition detail goal indicators
10.5 Promote Weekly Report + Weight (skip if 6.4 done)
10.6 Date strip scroll-to-selected animation
```

**Phase 5 — Visual Restyle (do LAST, alone):**
```
11.1 Restyle Dashboard — Header + Multi-Ring
11.2 Restyle Dashboard — Cards + Sections
11.3 Restyle Browse
11.4 Restyle AI Chat
11.5 Restyle Settings/More
11.6 Global Polish Pass
```

---

## CHECKPOINTS

### ✅ CHECKPOINT 1 — After Bandhip's Phase 1 (Utilities)
**When:** Bandhip finishes tasks 2.1, 3.1, 4.1, 6.1, 7.1, 8.1

**Bandhip does:**
1. Push all changes
2. Run `npx tsc --noEmit` in the CampusPlate directory — screenshot the result
3. Send Cameron this message:
   > "Phase 1 complete. All 6 utility files pushed. TSC result: [pass/fail]. Starting Phase 2."
4. List every file you created and every export from each file

**Cameron does:**
1. `git pull origin main`
2. Run `npx tsc --noEmit` — verify 0 new errors
3. Open each new file and verify:
   - All functions use try/catch on Supabase calls
   - All queries filter by user_id
   - Dates use manual formatting, not toISOString()
   - weight_lbs is used (not weight)
4. Reply: "Phase 1 verified. Proceed to Phase 2." or list issues to fix

**DO NOT proceed to Phase 2 until Cameron confirms.**

---

### ✅ CHECKPOINT 2 — After Bandhip's Phase 2 (Components)
**When:** Bandhip finishes tasks 3.2, 3.3, 4.2, 5.1, 5.2, 6.2, 6.3, 7.2, 8.2, 9.2

**Bandhip does:**
1. Push all changes
2. Run `npx tsc --noEmit` — screenshot
3. Send Cameron:
   > "Phase 2 complete. All 10 components pushed. TSC result: [pass/fail]. Here's the prop interface for each component: [list them]"
4. List every component with its required props so Cameron knows how to integrate

**Cameron does:**
1. `git pull origin main`
2. Run `npx tsc --noEmit`
3. Open each component and verify:
   - Uses `const { colors } = useTheme()` not hardcoded colors
   - Uses approved fonts (Outfit/DMSans)
   - Handles empty/null data gracefully
   - No imports from shared files that would create circular deps
4. Reply: "Phase 2 verified. I'm starting integration." or list issues

**Bandhip STOPS here.** No more tasks until Cameron finishes Phases 3-5.

---

### ✅ CHECKPOINT 3 — After Cameron's Phase 3 (Integration)
**When:** Cameron finishes all integration tasks (3.4 through 9.3)

**Cameron does:**
1. Push all changes
2. Run `npx tsc --noEmit`
3. Test on phone: verify every new feature renders on every screen
4. Send Bandhip:
   > "Phase 3 integration complete. All components wired in. [list any issues found with components]. Starting Phase 4 polish."

**Bandhip does:**
1. Pull and test on their phone
2. Report any visual bugs or issues they see
3. DO NOT push any code fixes — just report. Cameron fixes.

---

### ✅ CHECKPOINT 4 — After Cameron's Phase 4 (Polish)
**When:** Cameron finishes tasks 10.1 through 10.6

**Cameron does:**
1. Push
2. Send Bandhip:
   > "Phase 4 done. Starting restyle. DO NOT PUSH ANYTHING until I finish Phase 5."

**Bandhip does:**
1. Acknowledge and wait
2. Can review v0 prototypes and prepare feedback for after restyle

---

### ✅ CHECKPOINT 5 — After Cameron's Phase 5 (Restyle)
**When:** Cameron finishes tasks 11.1 through 11.6

**Cameron does:**
1. Push all changes
2. Test every screen in both dark and light themes
3. Run `npx tsc --noEmit` — must be 0 errors
4. Send Bandhip:
   > "Sprint 4 complete. Pull and do a full review."

**Bandhip does:**
1. Pull and test every screen
2. Compare to v0 prototypes
3. Create a punch list of anything that doesn't match
4. Send punch list to Cameron for final fixes

---

## TIMELINE ESTIMATE

| Phase | Owner | Tasks | Est. Time |
|-------|-------|-------|-----------|
| Phase 1 Utilities | Bandhip | 6 | 1-2 hours |
| Phase 1 Nav | Cameron | 5 | 1-2 hours |
| CHECKPOINT 1 | Both | — | 15 min |
| Phase 2 Components | Bandhip | 10 | 3-4 hours |
| CHECKPOINT 2 | Both | — | 15 min |
| Phase 3 Integration | Cameron | 11 | 2-3 hours |
| CHECKPOINT 3 | Both | — | 30 min |
| Phase 4 Polish | Cameron | 6 | 1-2 hours |
| CHECKPOINT 4 | Both | — | 5 min |
| Phase 5 Restyle | Cameron | 6 | 3-4 hours |
| CHECKPOINT 5 | Both | — | 30 min |
| **TOTAL** | | **46** | **12-18 hours** |

---

## EMERGENCY MERGE CONFLICT PROTOCOL

If you get a push rejection:
1. `git pull origin main`
2. If auto-merge succeeds → push
3. If conflicts appear → **STOP. Do NOT resolve yourself.**
4. Message the other dev: "Merge conflict in [filename]. Who touched this file last?"
5. The person who owns that file resolves the conflict

---

## DESIGN REFERENCES

Cameron: Before starting Phase 5, push these into a /design folder in the repo:
- v0 prototype screenshots (dashboard, browse, AI chat, progress)
- CampusPlate_Micronutrients.html
- CampusPlate_Settings.html

---

## RALPH LOOP PROMPT (Same for both devs)

```
Read PRD_Sprint4.txt and Progress_Sprint4.txt in the project root. Complete task [TASK NUMBER] — [TASK NAME]. Follow all Global Rules in the PRD. When done, update Progress_Sprint4.txt and stop.
```
