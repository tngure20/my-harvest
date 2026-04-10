import { useEffect, useState } from "react";
import { askAI, buildDailyTipsQuery } from "@/services/aiService";
import { fetchFarmRecords } from "@/services/farmService";
import type { FarmRecord } from "@/services/farmService";

interface Task {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  due_date?: string;
}

interface Alert {
  level: "low" | "medium" | "high";
  message: string;
}

export default function TodayDashboard() {
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState("");
  const [farmRecords, setFarmRecords] = useState<FarmRecord[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    try {
      // 1. Load farm data
      const records = await fetchFarmRecords();
      setFarmRecords(records);

      // 2. Get AI daily tips
      const ai = await askAI({
  mode: "general",
  query: "What should I focus on today on my farm?",
  farmRecords: records,
});

      setTips(ai.content);

      // 3. Extract alerts if AI returns them (future-ready)
      if (ai.alerts) {
        setAlerts(ai.alerts);
      }
    } catch (err) {
      console.error("Dashboard error:", err);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Loading today’s farm overview...
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-xl font-bold">Today’s Farm Plan</h1>
        <p className="text-sm text-gray-500">
          Simple actions for today
        </p>
      </div>

      {/* ALERTS */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Alerts</h2>
          {alerts.map((a, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-red-50 text-red-700 text-sm"
            >
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* AI TIPS */}
      <div>
        <h2 className="font-semibold mb-2">AI Recommendations</h2>
        <div className="p-3 rounded-lg bg-green-50 text-sm whitespace-pre-line">
          {tips}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div>
        <h2 className="font-semibold mb-2">Quick Actions</h2>

        <div className="grid grid-cols-2 gap-2">
          <button className="p-3 bg-blue-600 text-white rounded-lg">
            Scan Plant
          </button>

          <button className="p-3 bg-green-600 text-white rounded-lg">
            Add Record
          </button>

          <button className="p-3 bg-purple-600 text-white rounded-lg">
            Ask AI
          </button>

          <button className="p-3 bg-gray-800 text-white rounded-lg">
            Add Task
          </button>
        </div>
      </div>
    </div>
  );
}
