import { useEffect, useState } from "react";
import { askAI } from "@/services/aiService";
import type { NormalizedAIResponse, AIAlert } from "@/services/aiService";
import { fetchFarmRecords } from "@/services/farmService";
import type { FarmRecord } from "@/services/farmService";

export default function TodayDashboard() {
  const [loading, setLoading] = useState(true);
  const [aiResult, setAiResult] = useState<NormalizedAIResponse | null>(null);
  const [farmRecords, setFarmRecords] = useState<FarmRecord[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    try {
      const records = await fetchFarmRecords();
      setFarmRecords(records);

      const ai = await askAI({
        mode: "general",
        query: "What should I focus on today on my farm?",
        farmRecords: records,
      });

      setAiResult(ai);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading today's farm overview...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Today's Farm Plan</h1>
        <p className="text-sm text-muted-foreground">Simple actions for today</p>
      </div>

      {/* ALERTS */}
      {aiResult && aiResult.alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Alerts</h2>
          {aiResult.alerts.map((a, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg text-sm ${
                a.level === "high"
                  ? "bg-destructive/10 text-destructive"
                  : a.level === "medium"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* AI TIPS */}
      <div>
        <h2 className="font-semibold mb-2">AI Recommendations</h2>
        <div className="p-3 rounded-lg bg-primary/5 text-sm whitespace-pre-line">
          {aiResult?.summary || "No tips available."}
        </div>
      </div>

      {/* ACTIONS FROM AI */}
      {aiResult && aiResult.actions.length > 0 && (
        <div>
          <h2 className="font-semibold mb-2">Suggested Actions</h2>
          <ul className="space-y-1">
            {aiResult.actions.map((a, i) => (
              <li key={i} className="text-sm flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${a.priority === "high" ? "bg-destructive" : a.priority === "medium" ? "bg-amber-500" : "bg-primary"}`} />
                {a.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="font-semibold mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-2">
          <button className="p-3 bg-primary text-primary-foreground rounded-lg min-h-[44px]">Scan Plant</button>
          <button className="p-3 bg-primary text-primary-foreground rounded-lg min-h-[44px]">Add Record</button>
          <button className="p-3 bg-secondary text-secondary-foreground rounded-lg min-h-[44px]">Ask AI</button>
          <button className="p-3 bg-muted text-foreground rounded-lg min-h-[44px]">Add Task</button>
        </div>
      </div>
    </div>
  );
}
