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
  if (!data.user) throw new Error("Sign in before saving a station ride request.");

  return data.user;
}

export async function saveStationRideRequest(request) {
  const client = requireSupabase();
  const user = await authenticatedUser();
  const payload = {
    user_id: user.id,
    home_zip: request.homeZip,
    origin_zone_lat: request.originZone.latitude,
    origin_zone_lng: request.originZone.longitude,
    origin_zone_label: request.originZone.label,
    origin_precision_miles: request.originZone.precisionMiles,
    airport_destination: request.airportDestination,
    shift_end: request.shiftEnd,
    station_node_code: request.station.nodeCode,
    station_name: request.station.name,
    station_lat: request.station.latitude,
    station_lng: request.station.longitude,
    station_arrival_time: request.stationArrivalTime,
    arrival_flex_minutes: Number(request.arrivalFlexMinutes),
    work_days: request.workDays,
    last_mile_mode: request.lastMileMode,
    ride_role: request.rideRole,
    seats_available:
      request.rideRole === "rider" ? null : Number(request.seatsAvailable),
    max_wait_minutes: Number(request.maxWaitMinutes),
    status: "active",
    consent_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from("station_last_mile_requests")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function loadMyStationRideRequest() {
  const client = requireSupabase();
  const user = await authenticatedUser();
  const { data, error } = await client
    .from("station_last_mile_requests")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
