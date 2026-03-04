import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Determine which meal periods to include based on the current hour (ET). */
function getRelevantMealPeriods(): string[] {
  // Convert UTC to approximate Eastern Time (UTC-5)
  const now = new Date();
  const etHour =
    now.getUTCHours() - 5 + (now.getUTCHours() < 5 ? 24 : 0);
  const etMinutes = etHour * 60 + now.getUTCMinutes();

  if (etMinutes < 630) {
    // Before 10:30 AM
    return ["Breakfast", "Lunch"];
  } else if (etMinutes < 990) {
    // Before 4:30 PM
    return ["Lunch", "Dinner"];
  } else {
    return ["Dinner"];
  }
}

/** Parse [MEAL_ITEM]{...}[/MEAL_ITEM] blocks from assistant text. */
function parseMealItems(
  text: string
): { cleaned: string; mealItems: Record<string, unknown>[] } {
  const mealItems: Record<string, unknown>[] = [];
  const cleaned = text.replace(
    /\[MEAL_ITEM\]([\s\S]*?)\[\/MEAL_ITEM\]/g,
    (_, json) => {
      try {
        mealItems.push(JSON.parse(json.trim()));
      } catch {
        // skip malformed blocks
      }
      return "";
    }
  );
  return { cleaned: cleaned.trim(), mealItems };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Authenticate user from JWT ──────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: { user }, error: authError } = await adminClient.auth.getUser(authHeader);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = user.id;

    // ── Parse & sanitize input ──────────────────────────────────────────
    const body = await req.json();
    const mode: string | undefined = body.mode;
    const rawMessage: string | undefined = body.message;
    const rawDescription: string | undefined = body.description;
    const history: { role: string; content: string }[] = body.history ?? [];
    const date: string | undefined = body.date;

    // ── estimate_meal mode ────────────────────────────────────────────────
    if (mode === "estimate_meal") {
      const description = rawDescription?.trim();
      if (!description || description.length === 0) {
        return jsonResponse({ error: "Description is required." }, 400);
      }
      if (description.length > 500) {
        return jsonResponse({ error: "Description too long. Keep it under 500 characters." }, 400);
      }

      // Rate limit: 15 estimates/day via estimate_count
      const ESTIMATE_LIMIT = 15;
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const { data: usageRow, error: usageError } = await adminClient
        .from("ai_usage")
        .select("id, estimate_count")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .maybeSingle();

      if (usageError) {
        console.error("Estimate usage check failed:", usageError.message);
        return jsonResponse({ error: "Unable to verify rate limit." }, 500);
      }

      const currentEstimates = usageRow?.estimate_count ?? 0;
      if (currentEstimates >= ESTIMATE_LIMIT) {
        return jsonResponse(
          { error: "You've reached your daily estimate limit (15). Resets at midnight." },
          429
        );
      }

      // Increment estimate_count
      if (usageRow) {
        await adminClient
          .from("ai_usage")
          .update({ estimate_count: currentEstimates + 1 })
          .eq("id", usageRow.id);
      } else {
        await adminClient.from("ai_usage").insert({
          user_id: userId,
          date: todayStr,
          message_count: 0,
          estimate_count: 1,
        });
      }

      // Call Claude with focused estimation prompt
      const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
      if (!claudeApiKey) {
        return jsonResponse({ error: "AI is temporarily unavailable." }, 503);
      }

      const estimateSystemPrompt = `You are a nutrition estimation tool. The user will describe a meal they ate. Respond with ONLY a valid JSON object containing these fields: name (string, a short clean name for the meal), calories (number), protein_g (number), total_carbs_g (number), total_fat_g (number). Be accurate based on typical restaurant or homemade portions. Round all numbers to whole integers. Do not include any other text, explanation, or markdown formatting — ONLY the JSON object.`;

      const claudeResponse = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 300,
            system: estimateSystemPrompt,
            messages: [{ role: "user", content: description }],
          }),
        }
      );

      if (!claudeResponse.ok) {
        const errBody = await claudeResponse.text();
        console.error(`Claude API error ${claudeResponse.status}: ${errBody}`);
        return jsonResponse({ error: "AI estimation failed. Please try again." }, 502);
      }

      const claudeData = await claudeResponse.json();
      const rawText = claudeData?.content?.[0]?.text ?? "";

      try {
        const parsed = JSON.parse(rawText);
        const estimateRemaining = ESTIMATE_LIMIT - (currentEstimates + 1);
        return jsonResponse({
          name: parsed.name ?? "Custom Meal",
          calories: Math.round(parsed.calories ?? 0),
          protein_g: Math.round(parsed.protein_g ?? 0),
          total_carbs_g: Math.round(parsed.total_carbs_g ?? 0),
          total_fat_g: Math.round(parsed.total_fat_g ?? 0),
          remaining: estimateRemaining,
          estimateLimit: ESTIMATE_LIMIT,
        });
      } catch {
        console.error("Failed to parse estimate JSON:", rawText);
        return jsonResponse(
          { error: "Couldn't estimate nutrition. Try being more specific." },
          422
        );
      }
    }

    // ── meal_plan mode ──────────────────────────────────────────────────
    if (mode === "meal_plan") {
      const schedule: { name: string; start: string; end: string; location?: string }[] = body.schedule ?? [];
      const goals = body.goals ?? { calories: 2000, protein: 100, carbs: 250, fat: 65 };
      const preferences = body.preferences ?? { dietary: [], allergies: [] };

      // Rate limit: 3 meal plans per day via plan_count
      const PLAN_LIMIT = 3;
      const d = new Date();
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const { data: usageRow, error: usageError } = await adminClient
        .from("ai_usage")
        .select("id, plan_count")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .maybeSingle();

      if (usageError) {
        console.error("Plan usage check failed:", usageError.message);
        return jsonResponse({ error: "Unable to verify rate limit." }, 500);
      }

      const currentPlans = usageRow?.plan_count ?? 0;
      if (currentPlans >= PLAN_LIMIT) {
        return jsonResponse(
          { error: "You've used all 3 meal plans for today. Resets at midnight." },
          429
        );
      }

      // Increment plan_count
      if (usageRow) {
        await adminClient
          .from("ai_usage")
          .update({ plan_count: currentPlans + 1 })
          .eq("id", usageRow.id);
      } else {
        await adminClient.from("ai_usage").insert({
          user_id: userId,
          date: todayStr,
          message_count: 0,
          estimate_count: 0,
          plan_count: 1,
        });
      }

      // Fetch today's full menu for the plan
      const { data: menuData } = await adminClient
        .from("menu_items")
        .select("id, name, station, dining_halls(name), meal, nutrition(calories, protein_g, total_carbs_g, total_fat_g)")
        .eq("date", todayStr);

      let menuJson = JSON.stringify(menuData ?? []);
      if (menuJson.length > 60000) {
        let truncated = menuData ?? [];
        while (JSON.stringify(truncated).length > 60000 && truncated.length > 0) {
          truncated = truncated.slice(0, Math.floor(truncated.length * 0.75));
        }
        menuJson = JSON.stringify(truncated);
      }

      const scheduleBlock = schedule.length > 0
        ? `\n## User's Class Schedule Today\n${schedule.map((c) => `- ${c.start} - ${c.end}: ${c.name}${c.location ? ` (${c.location})` : ""}`).join("\n")}`
        : "\nNo class schedule provided — suggest meals at typical times (8 AM, 12 PM, 6 PM).";

      const dietaryBlock = preferences.dietary?.length > 0
        ? `Dietary preferences: ${preferences.dietary.join(", ")}`
        : "No specific dietary preferences";

      const allergyBlock = preferences.allergies?.length > 0
        ? `Allergies: ${preferences.allergies.join(", ")}`
        : "No known allergies";

      const planSystemPrompt = `You are a campus meal planning assistant for Virginia Tech.
Generate a complete daily meal plan using ONLY items from today's dining hall menus (provided below). The plan must:
1. Fit within the user's calorie and macro goals
2. Schedule meals around their class times (if provided)
3. Respect dietary preferences and allergies
4. Suggest specific dining halls and items
5. Include estimated nutrition totals per meal and daily total

## User Goals
- Calories: ${goals.calories} kcal
- Protein: ${goals.protein}g
- Carbs: ${goals.carbs}g
- Fat: ${goals.fat}g
- ${dietaryBlock}
- ${allergyBlock}
${scheduleBlock}

## Today's Dining Hall Menus
${menuJson}

Respond with ONLY a valid JSON object (no markdown, no backticks, no explanation):
{
  "meals": [
    {
      "type": "Breakfast",
      "time": "8:00 AM",
      "location": "D2",
      "items": [{ "name": "Scrambled Eggs", "calories": 180, "protein": 12, "carbs": 2, "fat": 14 }],
      "totalCalories": 450,
      "note": "Before your 9:30 CS class"
    }
  ],
  "dailyTotal": { "calories": 2480, "protein": 98, "carbs": 105, "fat": 90 },
  "tip": "You have a 2-hour gap at noon — perfect time for a bigger lunch at Owen's."
}`;

      const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
      if (!claudeApiKey) {
        return jsonResponse({ error: "AI is temporarily unavailable." }, 503);
      }

      const claudeResponse = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": claudeApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 3000,
            system: planSystemPrompt,
            messages: [{ role: "user", content: "Generate my meal plan for today." }],
          }),
        }
      );

      if (!claudeResponse.ok) {
        const errBody = await claudeResponse.text();
        console.error(`Claude API error ${claudeResponse.status}: ${errBody}`);
        return jsonResponse({ error: "AI meal planning failed. Please try again." }, 502);
      }

      const claudeData = await claudeResponse.json();
      const rawText = claudeData?.content?.[0]?.text ?? "";

      try {
        // Strip any accidental markdown fencing
        const cleanedText = rawText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(cleanedText);
        const remaining = PLAN_LIMIT - (currentPlans + 1);
        return jsonResponse({
          ...parsed,
          remaining,
          planLimit: PLAN_LIMIT,
        });
      } catch {
        console.error("Failed to parse meal plan JSON:", rawText);
        return jsonResponse(
          { error: "Couldn't generate meal plan. Please try again." },
          422
        );
      }
    }

    // ── Standard chat mode ────────────────────────────────────────────────

    if (!rawMessage || !date) {
      return jsonResponse(
        { error: "Missing required fields: message, date" },
        400
      );
    }

    const message = rawMessage.trim();
    if (message.length === 0) {
      return jsonResponse({ error: "Message cannot be empty" }, 400);
    }
    if (message.length > 1000) {
      await adminClient.from("ai_chat_logs").insert({
        user_id: userId,
        role: "user",
        content: message.slice(0, 1000),
        is_blocked: true,
      });
      return jsonResponse(
        { error: "Message is too long. Please keep it under 1000 characters." },
        400
      );
    }

    // ── Get AI context via RPC ─────────────────────────────────────────
    const { data: context, error: rpcError } = await adminClient.rpc(
      "get_ai_context",
      { p_user_id: userId, p_date: date }
    );

    if (rpcError) {
      console.error("get_ai_context RPC failed:", rpcError.message);
      return jsonResponse(
        { error: "AI is temporarily unavailable. Please try again." },
        503
      );
    }

    const profile = context?.profile;
    const consumed = context?.consumed_today;
    const fullMenu: Record<string, unknown>[] = context?.todays_menu ?? [];

    // ── Build system prompt ────────────────────────────────────────────
    const goalCal = profile?.goal_calories ?? 2000;
    const goalP = profile?.goal_protein_g ?? 150;
    const goalC = profile?.goal_carbs_g ?? 250;
    const goalF = profile?.goal_fat_g ?? 65;

    const remainCal = Math.max(0, goalCal - (consumed?.calories ?? 0));
    const remainP = Math.max(0, goalP - (consumed?.protein ?? 0));
    const remainC = Math.max(0, goalC - (consumed?.carbs ?? 0));
    const remainF = Math.max(0, goalF - (consumed?.fat ?? 0));

    const relevantPeriods = getRelevantMealPeriods();
    const filteredMenu = fullMenu.filter((item) =>
      relevantPeriods.includes(item.meal as string)
    );

    let menuJson = JSON.stringify(filteredMenu);
    if (menuJson.length > 60000) {
      // Truncate by taking fewer items until within limit
      let truncated = filteredMenu;
      while (JSON.stringify(truncated).length > 60000 && truncated.length > 0) {
        truncated = truncated.slice(0, Math.floor(truncated.length * 0.75));
      }
      menuJson = JSON.stringify(truncated);
    }

    const dietaryNeeds = profile?.dietary_needs ?? "none specified";
    const bodyGoal = profile?.goal ?? "not specified";
    const highProtein = profile?.high_protein ? "Yes — prioritize protein." : "";

    const systemPrompt = `You are CampusPlate AI, a friendly and concise nutrition assistant for Virginia Tech students.

## User Profile
- Daily goals: ${goalCal} cal | ${goalP}g protein | ${goalC}g carbs | ${goalF}g fat
- Body goal: ${bodyGoal}
- Dietary needs: ${dietaryNeeds}
${highProtein ? `- High protein preference: ${highProtein}` : ""}

## Today's Progress
- Consumed: ${consumed?.calories ?? 0} cal | ${consumed?.protein ?? 0}g P | ${consumed?.carbs ?? 0}g C | ${consumed?.fat ?? 0}g F
- Remaining: ${remainCal} cal | ${remainP}g P | ${remainC}g C | ${remainF}g F

## Available Menu Items (${relevantPeriods.join(" & ")})
${menuJson}

## Rules
1. ONLY recommend items from the menu above. Never invent items.
2. Always include the dining hall name, station, and nutrition info (calories, protein, carbs, fat) for each recommendation.
3. Respect the user's dietary restrictions and body goal.
4. Be concise and friendly. Use short paragraphs. Virginia Tech students are busy.
5. When suggesting a menu item, include it as a structured block so the app can offer one-tap logging. Use this exact format:
   [MEAL_ITEM]{"id":<menu_item_id>,"name":"<item name>","hall":"<dining hall>","calories":<cal>,"protein_g":<p>,"carbs_g":<c>,"fat_g":<f>}[/MEAL_ITEM]
6. You can suggest multiple items. Place each [MEAL_ITEM] block on its own line after describing it.
7. If the user has already consumed most of their daily calories, suggest lighter options.
8. If no menu items are available, let the user know that today's menu hasn't been loaded yet and to check back later.
9. IMPORTANT — MEAL ITEM CARDS: Only include [MEAL_ITEM] blocks when the user explicitly asks to LOG or ADD a meal to their tracker.
   - Examples that SHOULD include [MEAL_ITEM] blocks: "log the grilled chicken", "add that to my log", "I just ate the turkey club"
   - Examples that should NOT include [MEAL_ITEM] blocks: "what should I eat?", "give me a high protein meal", "what's good at D2?", "plan my meals today"
   - For general recommendations, describe the food with nutrition info in your text response WITHOUT [MEAL_ITEM] blocks.
   - Only use [MEAL_ITEM] blocks when the user wants to actually log something they ate.`;

    // ── Call Claude API ────────────────────────────────────────────────
    const claudeApiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!claudeApiKey) {
      console.error("CLAUDE_API_KEY not set");
      return jsonResponse(
        { error: "AI is temporarily unavailable. Please try again." },
        503
      );
    }

    // Sanitize history: only valid roles, ensure alternation, start with "user"
    const validHistory = history
      .slice(-10)
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      .map((m) => ({ role: m.role, content: m.content }));

    // Deduplicate consecutive same-role messages (keep the last one)
    const trimmedHistory: { role: string; content: string }[] = [];
    for (const m of validHistory) {
      if (
        trimmedHistory.length > 0 &&
        trimmedHistory[trimmedHistory.length - 1].role === m.role
      ) {
        trimmedHistory[trimmedHistory.length - 1] = m;
      } else {
        trimmedHistory.push(m);
      }
    }

    // Ensure history starts with "user" (Claude API requirement)
    while (
      trimmedHistory.length > 0 &&
      trimmedHistory[0].role !== "user"
    ) {
      trimmedHistory.shift();
    }

    // Ensure history ends with "assistant" so the new user message continues alternation
    while (
      trimmedHistory.length > 0 &&
      trimmedHistory[trimmedHistory.length - 1].role !== "assistant"
    ) {
      trimmedHistory.pop();
    }

    const claudeResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": claudeApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: systemPrompt,
          messages: [
            ...trimmedHistory,
            { role: "user", content: message },
          ],
        }),
      }
    );

    if (!claudeResponse.ok) {
      const errBody = await claudeResponse.text();
      console.error(
        `Claude API error ${claudeResponse.status}: ${errBody}`
      );
      return jsonResponse(
        {
          error: `Claude API error (${claudeResponse.status}): ${errBody.slice(0, 200)}`,
        },
        502
      );
    }

    const claudeData = await claudeResponse.json();
    const assistantRaw =
      claudeData?.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";

    // ── Parse meal item blocks ─────────────────────────────────────────
    const { cleaned: assistantText, mealItems } = parseMealItems(assistantRaw);

    // ── Save to ai_chat_logs ───────────────────────────────────────────
    const { error: insertErr } = await adminClient.from("ai_chat_logs").insert([
      {
        user_id: userId,
        role: "user",
        content: message,
        meal_items: null,
      },
      {
        user_id: userId,
        role: "assistant",
        content: assistantText,
        meal_items: mealItems.length > 0 ? mealItems : null,
      },
    ]);

    if (insertErr) {
      console.error("Failed to save chat logs:", insertErr.message);
      // Non-fatal — still return the response to the user
    }

    // ── Return response ────────────────────────────────────────────────
    return jsonResponse({
      content: assistantText,
      mealItems: mealItems.length > 0 ? mealItems : [],
    });
  } catch (err) {
    const errMsg = (err as Error).message ?? String(err);
    console.error("Unexpected error:", errMsg, (err as Error).stack);
    return jsonResponse({ error: errMsg }, 500);
  }
});
