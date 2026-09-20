import { isSupabaseConfigured, supabase } from "./supabase";
import { compressMarketplaceImage } from "./marketplaceImages";

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
    seller: row.seller_display_name || (row.user_id === currentUserId ? "My listing" : "Airport community member"),
    age: "Community listing",
    icon: "📦",
    status: row.status,
    mine: row.user_id === currentUserId,
    images: row.images || [],
  };
}

export async function loadMarketplaceListings() {
  const c = client();
  const { data: authData } = await c.auth.getUser();
  const userId = authData?.user?.id || null;
  const { data, error } = await c.rpc("marketplace_feed");
  if (error) throw error;
  return (data || []).map((row) => {
    const images = (row.images || []).map((image) => {
      const { data: publicData } = c.storage.from("marketplace-images").getPublicUrl(image.path);
      return { ...image, url: publicData.publicUrl };
    });
    return toListing({ ...row, images }, userId);
  });
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


export async function uploadMarketplaceImages(listingId, files) {
  if (!files?.length) return [];
  const c = client();
  const { data: authData, error: authError } = await c.auth.getUser();
  if (authError) throw authError;
  const user = authData?.user;
  if (!user) throw new Error("Sign in before uploading photos.");

  const uploaded = [];
  try {
    for (let i = 0; i < files.length; i += 1) {
      const blob = await compressMarketplaceImage(files[i]);
      const path = `${user.id}/${listingId}/${crypto.randomUUID()}.webp`;
      const { error: storageError } = await c.storage.from("marketplace-images").upload(path, blob, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });
      if (storageError) throw storageError;

      const { error: recordError } = await c.from("marketplace_listing_images").insert({
        listing_id: listingId,
        user_id: user.id,
        storage_path: path,
        sort_order: i,
      });
      if (recordError) throw recordError;

      const { data: publicData } = c.storage.from("marketplace-images").getPublicUrl(path);
      uploaded.push({ path, url: publicData.publicUrl, sortOrder: i });
    }
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map(async (image) => {
      await c.storage.from("marketplace-images").remove([image.path]);
      await c.from("marketplace_listing_images").delete().eq("storage_path", image.path);
    }));
    throw error;
  }
}
