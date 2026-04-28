import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  MessageSquare, Camera, Sprout, CalendarDays, CloudSun, Newspaper,
  type LucideIcon,
} from "lucide-react";

type Action = {
  icon: LucideIcon;
  label: string;
  desc: string;
  to: string;
  iconClass: string;
  bgClass: string;
  testId: string;
};

const actions: Action[] = [
  {
    icon: MessageSquare,
    label: "AI Chat",
    desc: "Ask a farm question",
    to: "/assistant",
    iconClass: "text-emerald-700 dark:text-emerald-300",
    bgClass: "bg-emerald-100 dark:bg-emerald-900/40",
    testId: "quick-action-ai-chat",
  },
  {
    icon: Camera,
    label: "Image Diagnosis",
    desc: "Scan a crop or pest",
    to: "/diagnose",
    iconClass: "text-rose-700 dark:text-rose-300",
    bgClass: "bg-rose-100 dark:bg-rose-900/40",
    testId: "quick-action-image-diagnosis",
  },
  {
    icon: Sprout,
    label: "My Farm",
    desc: "Activities & records",
    to: "/farm",
    iconClass: "text-green-700 dark:text-green-300",
    bgClass: "bg-green-100 dark:bg-green-900/40",
    testId: "quick-action-my-farm",
  },
  {
    icon: CalendarDays,
    label: "Farm Planner",
    desc: "Tasks & schedule",
    to: "/planner",
    iconClass: "text-amber-700 dark:text-amber-300",
    bgClass: "bg-amber-100 dark:bg-amber-900/40",
    testId: "quick-action-farm-planner",
  },
  {
    icon: CloudSun,
    label: "Weather Details",
    desc: "Forecast & alerts",
    to: "/weather",
    iconClass: "text-sky-700 dark:text-sky-300",
    bgClass: "bg-sky-100 dark:bg-sky-900/40",
    testId: "quick-action-weather",
  },
  {
    icon: Newspaper,
    label: "Agri News",
    desc: "Latest stories",
    to: "/#agri-news",
    iconClass: "text-violet-700 dark:text-violet-300",
    bgClass: "bg-violet-100 dark:bg-violet-900/40",
    testId: "quick-action-agri-news",
  },
];

const QuickActions = () => {
  const navigate = useNavigate();

  const handleClick = (to: string) => {
    if (to.startsWith("/#")) {
      const id = to.slice(2);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    navigate(to);
  };

  return (
    <section aria-label="Quick actions">
      <h2 className="harvest-section-title mb-3">Quick actions</h2>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.label}
              type="button"
              onClick={() => handleClick(a.to)}
              data-testid={a.testId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="harvest-card flex flex-col items-start gap-2 p-3 text-left transition-shadow hover:shadow-md active:scale-[0.98]"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.bgClass}`}>
                <Icon className={`h-4.5 w-4.5 ${a.iconClass}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground leading-tight">{a.label}</p>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground leading-snug line-clamp-2">{a.desc}</p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};

export default QuickActions;
