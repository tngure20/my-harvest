import { motion } from "framer-motion";
import { ReactNode } from "react";

interface OnboardingStepWrapperProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

const OnboardingStepWrapper = ({ title, subtitle, children }: OnboardingStepWrapperProps) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.25 }}
    className="flex flex-1 flex-col"
  >
    <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    <div className="mt-8 flex-1">{children}</div>
  </motion.div>
);

export default OnboardingStepWrapper;
