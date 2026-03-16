import { supabase } from "./supabaseClient";

export const syncProfile = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") return;

  if (!data) {
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0],
      email: user.email,
      avatar_url: user.user_metadata?.avatar_url || null,
      role: "farmer",
    });
  }
};
