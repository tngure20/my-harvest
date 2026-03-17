import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/services/supabaseClient";
import { syncProfile } from "@/services/profileService";
import { useNavigate, useLocation } from "react-router-dom";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

interface AppUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  location: string;
  farmingActivities: string[];
}

interface AuthContextType {
  user: AppUser | null;
  supabaseUser: SupabaseUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AppUser>) => void;
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function supabaseUserToAppUser(su: SupabaseUser): AppUser {
  const meta = su.user_metadata ?? {};
  const name = meta.full_name ?? meta.name ?? su.email?.split("@")[0] ?? "User";
  return {
    id: su.id,
    name,
    email: su.email ?? "",
    avatar: meta.avatar_url ?? name.charAt(0).toUpperCase(),
    location: "",
    farmingActivities: [],
  };
}

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/admin/login"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthenticated = user !== null;

  const handleSession = useCallback(async (session: Session | null, shouldRedirect: boolean) => {
    if (!session?.user) {
      setUser(null);
      setSupabaseUser(null);
      setIsLoading(false);
      return;
    }

    const su = session.user;
    setSupabaseUser(su);
    const appUser = supabaseUserToAppUser(su);

    // Load profile from Supabase to get location/farming data
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", su.id)
        .single();

      if (profile) {
        appUser.name = profile.full_name ?? appUser.name;
        appUser.location = profile.location ?? "";
        appUser.farmingActivities = profile.farming_activities ?? [];
        appUser.avatar = profile.avatar_url ?? appUser.avatar;
      } else {
        // First login – create profile
        await syncProfile();
      }
    } catch {
      // Profile table may not have extra columns yet, that's ok
      await syncProfile();
    }

    const onboarded = localStorage.getItem(`harvest_onboarded_${su.id}`) === "true";
    setHasCompletedOnboarding(onboarded);
    setUser(appUser);
    setIsLoading(false);

    if (shouldRedirect && AUTH_PAGES.some((p) => location.pathname.startsWith(p))) {
      if (!onboarded) {
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    // 1. Listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[Auth] Event:", event);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        handleSession(session, event === "SIGNED_IN");
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setSupabaseUser(null);
        setHasCompletedOnboarding(false);
        setIsLoading(false);
      } else if (event === "INITIAL_SESSION") {
        handleSession(session, false);
      }
    });

    return () => subscription.unsubscribe();
  }, [handleSession]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSupabaseUser(null);
    setHasCompletedOnboarding(false);
    navigate("/", { replace: true });
  }, [navigate]);

  const updateUser = useCallback((updates: Partial<AppUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      // Also update Supabase profile
      supabase.from("profiles").upsert({
        id: prev.id,
        full_name: updated.name,
        location: updated.location,
        farming_activities: updated.farmingActivities,
      }).then(() => {});
      return updated;
    });
  }, []);

  const setOnboardingComplete = useCallback(() => {
    setHasCompletedOnboarding(true);
    if (user) {
      localStorage.setItem(`harvest_onboarded_${user.id}`, "true");
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        supabaseUser,
        isAuthenticated,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
        hasCompletedOnboarding,
        setOnboardingComplete,
      }}
    >
      {isLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
