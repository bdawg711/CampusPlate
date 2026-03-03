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

    // ALLOWLIST — removed; all authenticated users can use AI chat now
    // const allowedUsers = (Deno.env.get("AI_ALLOWED_USERS") || "").split(",").map((s) => s.trim()).filter(Boolean);
    // if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
    //   return jsonResponse(
    //     { error: "AI Meal Planner is coming soon! Stay tuned." },
    //     403
    //   );
    // }

    // ── 1. Rate limiting via ai_usage ────────────────────────────────────
    const DAILY_LIMIT = parseInt(Deno.env.get("AI_DAILY_LIMIT") || "25", 10);
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const { data: usageRow, error: usageError } = await adminClient
      .from("ai_usage")
      .select("id, message_count, last_message_at")
      .eq("user_id", userId)
      .eq("date", todayStr)
      .maybeSingle();

    if (usageError) {
      console.error("Usage check failed:", usageError.message);
      return jsonResponse({ error: "Unable to verify rate limit." }, 500);
    }

    // Cooldown: 2 seconds between messages
    if (usageRow?.last_message_at) {
      const elapsed = Date.now() - new Date(usageRow.last_message_at).getTime();
      if (elapsed < 2000) {
        return jsonResponse(
          { error: "Slow down! Please wait a moment between messages." },
          429
        );
      }
    }

    // Daily limit check
    const currentCount = usageRow?.message_count ?? 0;
    if (currentCount >= DAILY_LIMIT) {
      await adminClient.from("ai_chat_logs").insert({
        user_id: userId,
        role: "user",
        content: message,
        is_blocked: true,
      });
      return jsonResponse(
        { error: "You've reached your daily AI limit. Resets at midnight." },
        429
      );
    }

    // Increment usage
    if (usageRow) {
      await adminClient
        .from("ai_usage")
        .update({
          message_count: currentCount + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", usageRow.id);
    } else {
      await adminClient.from("ai_usage").insert({
        user_id: userId,
        date: todayStr,
        message_count: 1,
        last_message_at: new Date().toISOString(),
      });
    }

    const remaining = DAILY_LIMIT - (currentCount + 1);

    // ── 2. Get AI context via RPC ───────────────────────────────────────
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

    // ── 3. Build system prompt ──────────────────────────────────────────
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

    // ── 4. Call Claude API ──────────────────────────────────────────────
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

    // ── 5. Parse meal item blocks ───────────────────────────────────────
    const { cleaned: assistantText, mealItems } = parseMealItems(assistantRaw);

    // ── 6. Save to ai_chat_logs ─────────────────────────────────────────
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

    // ── 7. Return response ──────────────────────────────────────────────
    return jsonResponse({
      content: assistantText,
      mealItems: mealItems.length > 0 ? mealItems : [],
      remaining,
      dailyLimit: DAILY_LIMIT,
    });
  } catch (err) {
    const errMsg = (err as Error).message ?? String(err);
    console.error("Unexpected error:", errMsg, (err as Error).stack);
    return jsonResponse({ error: errMsg }, 500);
  }
});
