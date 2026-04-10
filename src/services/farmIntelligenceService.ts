import { askAI } from "@/services/aiService";
import { supabase } from "@/services/supabaseClient";

export type Task = {
  title: string;
  priority: "low" | "medium" | "high";
  due_date?: string;
};

export type Alert = {
  level: "low" | "medium" | "high";
  message: string;
};

export type AIResult = {
  response: string;
  actions: Task[];
  alerts: Alert[];
  insights: string[];
  priorityScore: number;
};

export async function runFarmIntelligence(
  userId: string,
  query: string,
  farmRecords: any[]
): Promise<AIResult> {
  const ai = await askAI({
    mode: "advice",
    query,
    farmRecords,
  });

  // STEP 1: normalize AI output (safe fallback)
  const result: AIResult = {
    response: ai.content || "",
    actions: (ai.actions as Task[]) || [],
    alerts: (ai.alerts as Alert[]) || [],
    insights: [],
    priorityScore: 50,
  };

  // STEP 2: save tasks to database
  if (result.actions.length > 0) {
    const tasks = result.actions.map((t) => ({
      user_id: userId,
      title: t.title,
      priority: t.priority,
      status: "pending",
      due_date: t.due_date || null,
      ai_generated: true,
    }));

    await supabase.from("tasks").insert(tasks);
  }

  // STEP 3: save alerts
  if (result.alerts.length > 0) {
    const alerts = result.alerts.map((a) => ({
      user_id: userId,
      level: a.level,
      message: a.message,
    }));

    await supabase.from("alerts").insert(alerts);
  }

  return result;
}
