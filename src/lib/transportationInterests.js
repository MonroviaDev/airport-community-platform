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
  if (!data.user) throw new Error("Sign in before saving transportation interest.");

  return data.user;
}

function normalizeWorkDays(workDays) {
  if (Array.isArray(workDays)) return workDays;
  if (typeof workDays === "string") {
    return workDays.split("|").filter(Boolean);
  }

  return [];
}

export async function saveTransportationInterest(interest) {
  const client = requireSupabase();
  const user = await authenticatedUser();
  const payload = {
    user_id: user.id,
    home_zip: interest.homeZip,
    home_county: interest.homeCounty || null,
    airport_destination: interest.airportDestination,
    shift_start: interest.shiftStart,
    shift_end: interest.shiftEnd,
    work_days: normalizeWorkDays(interest.workDays),
    ride_role: interest.rideRole,
    shared_mode: interest.sharedMode,
    frequency: interest.frequency,
    notification_preference: interest.notificationPreference,
    status: "active",
    consent_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("transportation_interests")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadMyTransportationInterest() {
  const client = requireSupabase();
  const user = await authenticatedUser();
  const { data, error } = await client
    .from("transportation_interests")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function closeMyTransportationInterest() {
  const client = requireSupabase();
  const user = await authenticatedUser();
  const { data, error } = await client
    .from("transportation_interests")
    .update({ status: "closed" })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
