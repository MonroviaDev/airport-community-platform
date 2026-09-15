import { isSupabaseConfigured, supabase } from "./supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured for this environment.");
  }

  return supabase;
}

async function authenticatedUser() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();

  if (error) throw error;
  if (!data.user) throw new Error("Sign in before saving your profile.");

  return data.user;
}

export async function loadMyMemberProfile() {
  const client = requireSupabase();
  const user = await authenticatedUser();
  const { data, error } = await client
    .from("member_profiles")
    .select("display_name, airport_code, current_commute_mode, shared_ride_role, verification_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveMyMemberProfile(profile) {
  const client = requireSupabase();
  const user = await authenticatedUser();
  const payload = {
    user_id: user.id,
    display_name: profile.displayName.trim(),
    airport_code: "ATL",
    current_commute_mode: profile.currentCommuteMode,
    shared_ride_role: profile.sharedRideRole,
  };

  const { data, error } = await client
    .from("member_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
