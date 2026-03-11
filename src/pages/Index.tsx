import AppLayout from "@/components/AppLayout";
import WeatherWidget from "@/components/home/WeatherWidget";
import FarmingAdvice from "@/components/home/FarmingAdvice";
import RegionalAlerts from "@/components/home/RegionalAlerts";
import AgriNews from "@/components/home/AgriNews";
import SocialFeed from "@/components/home/SocialFeed";

const Index = () => {
  return (
    <AppLayout>
      <div className="space-y-6 px-4 py-4">
        <div>
          <p className="text-sm text-muted-foreground">Good morning,</p>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, Farmer 🌾</h1>
        </div>
        <RegionalAlerts />
        <WeatherWidget />
        <FarmingAdvice />
        <AgriNews />
        <SocialFeed />
      </div>
    </AppLayout>
  );
};

export default Index;
