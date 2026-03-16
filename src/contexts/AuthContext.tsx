import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { getCurrentUser, setCurrentUser, type User } from "@/lib/dataService";
import { supabase } from "@/services/supabaseClient";
import { fetchProfile } from "@/lib/supabaseService";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (email: string, password: string, name: string) => { success: boolean; error?: string };
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  hasCompletedOnboarding: boolean;
  setOnboardingComplete: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStore<T>(key: string): T[] {
  try {
    const data = localStorage.getItem(`harvest_${key}`);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

function setStore<T>(key: string, data: T[]) {
  localStorage.setItem(`harvest_${key}`, JSON.stringify(data));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getCurrentUser);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() =>
    localStorage.getItem("harvest_onboarding_complete") === "true"
  );

  const isAuthenticated = user !== null;

  const applySupabaseSession = useCallback(async (supabaseUser: { id: string; email?: string; user_metadata?: Record<string, string> }) => {
    // Try to load full profile from Supabase
    const profile = await fetchProfile(supabaseUser.id);
    if (profile) {
      setCurrentUser(profile);
      setUser(profile);
      const onboarded = localStorage.getItem(`harvest_onboarded_${profile.id}`);
      setHasCompletedOnboarding(onboarded === "true");
    } else {
      // Fallback: build from auth metadata
      const meta = supabaseUser.user_metadata ?? {};
      const name = meta.full_name ?? meta.name ?? supabaseUser.email?.split("@")[0] ?? "User";
      const fallback: User = {
        id: supabaseUser.id,
        name,
        email: supabaseUser.email ?? "",
        role: "farmer",
        location: "",
        avatar: meta.avatar_url ?? name.charAt(0).toUpperCase(),
        farmingActivities: [],
        bio: "",
        followers: 0,
        following: 0,
        postsCount: 0,
        createdAt: new Date().toISOString(),
        suspended: false,
      };
      setCurrentUser(fallback);
      setUser(fallback);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await applySupabaseSession(session.user);
    }
  }, [applySupabaseSession]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) applySupabaseSession(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        applySupabaseSession(session.user);
      } else if (_event === "SIGNED_OUT") {
        setCurrentUser(null);
        setUser(null);
        setHasCompletedOnboarding(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [applySupabaseSession]);

  const login = useCallback((email: string, password: string) => {
    const users = getStore<User & { password: string }>("users");
    const found = users.find((u) => u.email === email);
    if (!found) return { success: false, error: "No account found with this email" };
    if (found.password !== password) return { success: false, error: "Incorrect password" };
    if (found.suspended) return { success: false, error: "This account has been suspended" };
    const { password: _, ...safeUser } = found;
    setCurrentUser(safeUser);
    setUser(safeUser);
    const onboarded = localStorage.getItem(`harvest_onboarded_${safeUser.id}`);
    setHasCompletedOnboarding(onboarded === "true");
    return { success: true };
  }, []);

  const signup = useCallback((email: string, password: string, name: string) => {
    const users = getStore<User & { password: string }>("users");
    if (users.find((u) => u.email === email)) {
      return { success: false, error: "An account with this email already exists" };
    }
    const newUser: User & { password: string } = {
      id: generateId(), name, email, password,
      role: "farmer", location: "", avatar: name.charAt(0).toUpperCase(),
      farmingActivities: [], bio: "", followers: 0, following: 0, postsCount: 0,
      createdAt: new Date().toISOString(), suspended: false,
    };
    users.push(newUser);
    setStore("users", users);
    const { password: _, ...safeUser } = newUser;
    setCurrentUser(safeUser);
    setUser(safeUser);
    setHasCompletedOnboarding(false);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setUser(null);
    setHasCompletedOnboarding(false);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      setCurrentUser(updated);
      const users = getStore<User & { password?: string }>("users");
      const idx = users.findIndex((u) => u.id === updated.id);
      if (idx !== -1) { users[idx] = { ...users[idx], ...updates }; setStore("users", users); }
      return updated;
    });
  }, []);

  const setOnboardingComplete = useCallback(() => {
    setHasCompletedOnboarding(true);
    localStorage.setItem("harvest_onboarding_complete", "true");
    if (user) localStorage.setItem(`harvest_onboarded_${user.id}`, "true");
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated, login, signup, logout,
      updateUser, hasCompletedOnboarding, setOnboardingComplete, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
