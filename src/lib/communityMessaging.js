import { isSupabaseConfigured, supabase } from "./supabase";

function client() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export async function startMarketplaceConversation(listingId) {
  const c = client();
  const { data, error } = await c.rpc("start_marketplace_conversation", { listing_id: listingId });
  if (error) throw error;
  return data;
}

export async function loadConversation(conversationId) {
  const c = client();
  const { data: userData, error: userError } = await c.auth.getUser();
  if (userError) throw userError;
  const user = userData?.user;
  if (!user) throw new Error("Sign in to view this conversation.");

  const { data: conversation, error: conversationError } = await c
    .from("conversations").select("id,context_type,context_id,created_at").eq("id", conversationId).single();
  if (conversationError) throw conversationError;

  const { data: messages, error: messagesError } = await c
    .from("messages").select("id,sender_id,body,created_at,read_at").eq("conversation_id", conversationId).order("created_at");
  if (messagesError) throw messagesError;

  return { conversation, messages: messages || [], userId: user.id };
}

export async function sendConversationMessage(conversationId, body) {
  const c = client();
  const text = body.trim();
  if (!text) return null;
  const { data: userData, error: userError } = await c.auth.getUser();
  if (userError) throw userError;
  const user = userData?.user;
  if (!user) throw new Error("Sign in to send a message.");

  const { data, error } = await c.from("messages").insert({
    conversation_id: conversationId,
    sender_id: user.id,
    body: text,
  }).select("id,sender_id,body,created_at,read_at").single();
  if (error) throw error;
  return data;
}
