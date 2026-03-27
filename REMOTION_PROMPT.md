# CampusPlate Remotion Teaser Ad — Build Prompt

## Overview

Build a 30–45 second Remotion teaser/advertisement video for **CampusPlate**, a Virginia Tech dining nutrition tracker mobile app. The video should feel premium, modern, and energetic — like an App Store featured ad or a Y Combinator demo day trailer. Target audience: college students at Virginia Tech who eat at campus dining halls and want to track nutrition, hit macros, and eat smarter without the guesswork.

---

## Brand Identity

### App Name
**CampusPlate**

### Tagline Ideas (pick or combine)
- "Your campus. Your macros. Your plan."
- "Eat smarter at Virginia Tech."
- "Every dining hall. Every macro. One app."

### App Icon
- File: `CampusPlate_AppIcon_1024.png` (rounded corners) or `CampusPlate_AppIcon_1024_square.png`
- Design: Crossed silver fork & knife over concentric circles (plate motif) on a deep maroon background

### Color Palette (use these EXACTLY)
| Role | Color | Hex |
|---|---|---|
| **Primary / Brand** | Maroon | `#8B1E3F` |
| **CTA / Accent** | Orange | `#E87722` |
| **Protein indicator** | Blue | `#5B7FFF` |
| **Fat indicator** | Yellow / Gold | `#FFD60A` |
| **Positive / Vegan** | Green | `#34C759` |
| **Negative / Warning** | Red | `#FF453A` |
| **Background (dark mode)** | Near-black | `#121212` |
| **Background (light mode)** | Off-white | `#F8F8F8` |
| **Card background (light)** | White | `#FFFFFF` |
| **Muted text** | Gray | `#8E8E93` |

### Typography
- **Headings:** Outfit (weight 700–800)
- **Body:** DM Sans (weight 400–600)
- Use Google Fonts — both are freely available

---

## Screenshot Assets (8 images)

Copy these into your Remotion `public/` folder. Each is an iPhone screenshot at native resolution.

| Filename | Screen | What It Shows | Best Used For |
|---|---|---|---|
| `home-dashboard-over.png` | Home | Calorie ring at 3,373/3,044 cal, macro breakdown (protein 137g, carbs 491g, fat 99g), streak "Day 1", daily goal 20%, water tracker "80/80 oz Goal hit!" | **Hero shot** — the main dashboard, shows the calorie ring prominently |
| `home-dashboard-under.png` | Home | Calorie ring at 2,776/3,044 cal, same layout but under goal | Alternate hero / "tracking in action" moment |
| `ai-chat-screen.png` | AI Chat | "CampusPlate AI — What can I help with?" with 4 quick actions: Plan My Day, What's good for dinner, Plan under 800 cal, Hit protein goal | **AI feature showcase** — this is a major differentiator |
| `meal-plan-screen.png` | Meal Plan | AI-generated meal plan (Falafel 147cal, Penne Pasta 637cal, Marinara 99cal, Parmesan 28cal), daily totals (3373 kcal / 139g P / 491g C / 98g F), calorie warning, "Regenerate" button | **AI output showcase** — shows the meal plan the AI creates |
| `menu-browse-screen.png` | Menu Browse | "Today's Menu" with dining halls (Deet's Place, Food Court/Hokie Grill at Owens, Viva Market), meal tabs (Breakfast/Lunch/Dinner), search bar | **Menu browsing** — shows real VT dining halls |
| `station-items-screen.png` | Station Items | Botrista Drinks at Deet's Place, items with calories + P/C/F macros, favorite hearts | **Nutrition detail** — every item has full macro data |
| `progress-trends-screen.png` | Progress | 1-day streak with weekly circles, calorie trend chart (Avg 3,769 cal/day), weight trend (200 lbs) | **Progress tracking** — long-term trends |
| `class-schedule-screen.png` | Schedule | Class Schedule modal with day-of-week selector, "Add Class" button | **Smart scheduling** — plans meals around your classes |

---

## Suggested Video Structure

### Scene 1: Hook (0–3s)
- Black or maroon background
- Bold text fades/slams in: **"Still guessing what to eat on campus?"** (Outfit, white, large)
- Quick beat/pulse animation
- Optional: subtle fork-and-knife icon animation

### Scene 2: App Reveal (3–7s)
- App icon slides/scales in from center
- **"CampusPlate"** types out or fades in below the icon
- Subtitle: *"The nutrition tracker built for Virginia Tech"*
- Background transitions from maroon to light/white

### Scene 3: Dashboard Hero (7–13s)
- `home-dashboard-under.png` slides in as a phone mockup (use a device frame or floating phone with shadow)
- Animate attention to the calorie ring — maybe a glow pulse or scale bounce
- Overlay text callouts that animate in:
  - "Track every calorie" (near the ring)
  - "Hit your macros" (near the protein/carbs/fat row)
  - "Stay hydrated" (near the water tracker)
- Smooth transition: phone tilts/slides to make room for next screen

### Scene 4: Menu Browsing (13–18s)
- `menu-browse-screen.png` slides in
- Quick zoom into "Deet's Place — Open" row
- Transition to `station-items-screen.png` (like a drill-down)
- Overlay: **"Every dining hall. Every item. Full macros."**
- Items animate with subtle stagger (slide-up, fade-in)

### Scene 5: AI Features (18–26s)
- This is the **wow moment** — make it feel futuristic
- `ai-chat-screen.png` flies in
- Sparkle/glow effect on the lightning bolt icon
- One of the quick-action cards highlights/pulses: **"Plan My Day"**
- Quick cut/morph to `meal-plan-screen.png`
- Text overlay: **"AI builds your meal plan in seconds"**
- Show the food items appearing with a typewriter/cascade effect
- Flash the daily totals row (3373 kcal / 139g P / 491g C / 98g F) with color-coded numbers matching the brand palette:
  - Calories in maroon `#8B1E3F`
  - Protein in blue `#5B7FFF`
  - Carbs in green `#34C759`
  - Fat in yellow `#FFD60A`

### Scene 6: Smart Features Montage (26–32s)
- Quick 2-second cuts of:
  - `progress-trends-screen.png` with the calorie chart animating (line drawing in)
  - `class-schedule-screen.png` with overlay: **"Plans around your class schedule"**
  - `home-dashboard-over.png` showing the calorie ring filled past 100% — overlay: **"Stay on track, every meal"**

### Scene 7: Closing CTA (32–40s)
- All screenshots shrink and fan out / cascade behind the app icon
- App icon centers and scales up
- **"CampusPlate"** in large Outfit Bold
- **"Eat smarter at Virginia Tech."** in DM Sans below
- CTA button animation: **"Download Free on the App Store"** (maroon button with white text, 14px border radius, matching the app's button style)
- Optional: QR code or "campusplate.app" URL
- Fade to maroon `#8B1E3F` background

---

## Animation & Motion Guidelines

- **Easing:** Use spring physics or `ease-in-out` — nothing linear, everything should feel organic
- **Phone mockups:** Float the screenshots inside a minimal iPhone frame with a soft drop shadow. No thick bezels. Consider using a slight 3D perspective tilt for depth.
- **Transitions:** Prefer slide + fade combos, scale-ins, and parallax movement over hard cuts
- **Text:** Animate text word-by-word or letter-by-letter for hero lines; simple fade-in for smaller labels
- **Pacing:** Quick but not frantic — each screen should be readable for at least 1.5 seconds
- **Background music:** Design the pacing to match an upbeat, techy lo-fi or electronic track (~120 BPM)

---

## Technical Notes for Remotion

- **Resolution:** 1080x1920 (vertical/portrait — this is a mobile app ad, optimized for Instagram Reels, TikTok, App Store previews)
- **FPS:** 30
- **Duration:** 30–45 seconds (~900–1350 frames at 30fps)
- Place all screenshot assets in `public/screenshots/`
- Place app icons in `public/icons/`
- Use `@remotion/transitions` for smooth scene changes
- Use `interpolate()` and `spring()` for animations
- Consider `<AbsoluteFill>` layers for parallax depth
- Font loading: use `@remotion/google-fonts` to load Outfit and DM Sans

### Suggested file structure:
```
src/
  Root.tsx              — Register composition
  Composition.tsx       — Main sequence
  scenes/
    Hook.tsx            — Scene 1: Opening hook text
    AppReveal.tsx       — Scene 2: Icon + name reveal
    DashboardHero.tsx   — Scene 3: Home dashboard showcase
    MenuBrowse.tsx      — Scene 4: Menu browsing drill-down
    AIFeatures.tsx      — Scene 5: AI chat + meal plan
    FeatureMontage.tsx  — Scene 6: Progress, schedule, tracking
    ClosingCTA.tsx      — Scene 7: Final CTA
  components/
    PhoneMockup.tsx     — Reusable iPhone frame wrapper
    AnimatedText.tsx    — Word-by-word or letter-by-letter text
    FeatureCallout.tsx  — Floating label with icon
  styles/
    colors.ts           — Brand color constants
    fonts.ts            — Font family constants
public/
  screenshots/
    home-dashboard-over.png
    home-dashboard-under.png
    ai-chat-screen.png
    meal-plan-screen.png
    menu-browse-screen.png
    station-items-screen.png
    progress-trends-screen.png
    class-schedule-screen.png
  icons/
    CampusPlate_AppIcon_1024.png
    CampusPlate_AppIcon_1024_square.png
```

### Color constants file:
```ts
export const COLORS = {
  primary: '#8B1E3F',       // Maroon — brand primary
  cta: '#E87722',           // Orange — call-to-action
  protein: '#5B7FFF',       // Blue — protein indicator
  fat: '#FFD60A',           // Yellow — fat indicator
  carbs: '#34C759',         // Green — carbs / positive
  negative: '#FF453A',      // Red — warnings
  bgDark: '#121212',        // Dark mode background
  bgLight: '#F8F8F8',       // Light mode background
  cardWhite: '#FFFFFF',     // Card surfaces
  muted: '#8E8E93',         // Muted/secondary text
  textWhite: '#FFFFFF',
  textBlack: '#1C1C1E',
} as const;
```

---

## Key Selling Points to Emphasize

1. **Built specifically for Virginia Tech** — real dining halls (Deet's Place, Owens, Viva Market), real menus updated daily
2. **AI-powered meal planning** — asks what you want, builds a plan from today's actual menu
3. **Full macro tracking** — calories, protein, carbs, fat for every single item
4. **Calorie ring dashboard** — beautiful, at-a-glance daily progress
5. **Class schedule integration** — plans meals around when you're actually free
6. **Progress tracking** — streaks, calorie trends, weight tracking over time
7. **Water tracking** — daily hydration goals
8. **Free to use** — no paywall for core features

---

## Tone & Vibe

Think: **Polished but relatable.** This isn't a corporate wellness app — it's built by students, for students. The energy should feel like a well-produced TikTok or a slick App Store preview video. Confident, clean, fast-paced, but never overwhelming. The maroon palette ties it to Virginia Tech pride without being heavy-handed.
