import { askAI, normalizeAIResponse } from "@/services/aiService";
import type { NormalizedAIResponse, AIAction, AIAlert } from "@/services/aiService";
import { supabase } from "@/services/supabaseClient";

export type { AIAction as Task, AIAlert as Alert };
export type { NormalizedAIResponse as AIResult };

export async function runFarmIntelligence(
  userId: string,
  query: string,
  farmRecords: any[]
): Promise<NormalizedAIResponse> {
  const result = await askAI({
    mode: "advice",
    query,
    farmRecords,
  });

  // Save tasks to database (non-blocking)
  if (result.actions.length > 0) {
    const tasks = result.actions.map((t) => ({
      user_id: userId,
      title: t.title,
      priority: t.priority,
      status: "pending",
      ai_generated: true,
    }));

    supabase.from("tasks").insert(tasks).then(() => {}, () => {});
  }

  // Save alerts (non-blocking)
  if (result.alerts.length > 0) {
    const alerts = result.alerts.map((a) => ({
      user_id: userId,
      level: a.level,
      message: a.message,
    }));

    supabase.from("alerts").insert(alerts).then(() => {}, () => {});
  }

  return result;
}
