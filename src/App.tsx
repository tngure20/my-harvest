import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { initializeApp } from "@/lib/dataService";
import Index from "./pages/Index";
import Marketplace from "./pages/Marketplace";
import Community from "./pages/Community";
import Toolkit from "./pages/Toolkit";
import FarmManagement from "./pages/FarmManagement";
import FarmAssistant from "./pages/FarmAssistant";
import Profile from "./pages/Profile";
import Onboarding from "./pages/Onboarding";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import SearchPage from "./pages/SearchPage";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Experts from "./pages/Experts";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

initializeApp();

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/community" element={<Community />} />
              <Route path="/toolkit" element={<Toolkit />} />
              <Route path="/farm" element={<FarmManagement />} />
              <Route path="/assistant" element={<FarmAssistant />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/experts" element={<Experts />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
