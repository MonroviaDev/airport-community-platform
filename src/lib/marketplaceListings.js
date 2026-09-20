import { isSupabaseConfigured, supabase } from "./supabase";

function client() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured for this environment.");
  }
  return supabase;
}

function toListing(row, currentUserId) {
  const listingType = row.listing_type || "For Sale";
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category,
    price: listingType === "Free" ? 0 : listingType === "Wanted" ? null : row.price == null ? 0 : Number(row.price),
    area: row.meetup_location,
    seller: row.user_id === currentUserId ? "My listing" : "Airport community member",
    age: "Community listing",
    icon: "📦",
    status: row.status,
    mine: row.user_id === currentUserId,
  };
}

export async function loadMarketplaceListings() {
  const c = client();
  const { data: authData } = await c.auth.getUser();
  const userId = authData?.user?.id || null;
  const { data, error } = await c
    .from("marketplace_listings")
    .select("id,user_id,title,description,category,listing_type,price,meetup_location,status,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => toListing(row, userId));
}

export async function createMarketplaceListing(input) {
  const c = client();
  const { data: authData, error: authError } = await c.auth.getUser();
  if (authError) throw authError;
  const user = authData?.user;
  if (!user) throw new Error("Sign in before publishing a listing.");

  const payload = {
    user_id: user.id,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    listing_type: input.listingType,
    price: input.listingType === "Priced" ? Number(input.price || 0) : null,
    meetup_location: input.area,
    status: "active",
  };

  const { data, error } = await c
    .from("marketplace_listings")
    .insert(payload)
    .select("id,user_id,title,description,category,listing_type,price,meetup_location,status,created_at")
    .single();
  if (error) throw error;
  return toListing(data, user.id);
}

export async function markMarketplaceListingSold(id) {
  const c = client();
  const { error } = await c.from("marketplace_listings").update({ status: "sold", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
