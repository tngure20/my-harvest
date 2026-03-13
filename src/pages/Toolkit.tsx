import AppLayout from "@/components/AppLayout";
import { Calculator, Droplets, Wheat, Bug as Cow, Fish, Hexagon, Bot, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const tools = [
  {
    icon: Wheat,
    title: "Fertilizer Calculator",
    desc: "Calculate optimal fertilizer amounts based on crop type and land size",
    color: "bg-harvest-green-100 text-harvest-green-600",
  },
  {
    icon: Cow,
    title: "Feed Calculator",
    desc: "Estimate daily feed requirements for your livestock",
    color: "bg-harvest-gold-100 text-harvest-gold-500",
  },
  {
    icon: Droplets,
    title: "Irrigation Calculator",
    desc: "Calculate water needs for your crops and field size",
    color: "bg-blue-100 text-harvest-sky",
  },
  {
    icon: Fish,
    title: "Fish Feed Calculator",
    desc: "Estimate feed quantities for aquaculture systems",
    color: "bg-cyan-100 text-cyan-600",
  },
  {
    icon: Hexagon,
    title: "Beekeeping Estimator",
    desc: "Estimate honey production based on hive count",
    color: "bg-amber-100 text-amber-600",
  },
  {
    icon: Bot,
    title: "AI Farm Assistant",
    desc: "Ask questions about crops, livestock, pests, and more",
    color: "bg-primary/10 text-primary",
  },
];

const Toolkit = () => {
  const navigate = useNavigate();

  const handleToolClick = (title: string) => {
    if (title === "AI Farm Assistant") {
      navigate("/assistant");
    }
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Farming Toolkit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Professional agricultural calculators and tools
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {tools.map((tool, i) => (
            <motion.div
              key={tool.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="harvest-card p-4 cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => handleToolClick(tool.title)}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tool.color}`}>
                  <tool.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{tool.title}</h3>
                  <p className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">{tool.desc}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground" />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            ⚠️ All calculator results are estimates. Always consult with agricultural professionals for precise recommendations.
          </p>
        </div>
      </div>
    </AppLayout>
  );
};

export default Toolkit;
