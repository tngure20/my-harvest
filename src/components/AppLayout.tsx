import { ReactNode } from "react";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
  hideNav?: boolean;
  wide?: boolean;
}

const AppLayout = ({ children, hideHeader, hideNav, wide }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      {!hideHeader && <AppHeader />}
      <main className={`mx-auto ${wide ? "max-w-6xl" : "max-w-4xl"} ${!hideNav ? "pb-20 lg:pb-4" : ""}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};

export default AppLayout;
