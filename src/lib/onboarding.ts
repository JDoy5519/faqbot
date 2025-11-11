// src/lib/onboarding.ts
import { supaServer } from "@/lib/supaServer";

export async function setOnboardingFlag(
  userId: string,
  flag: "has_uploaded" | "has_embeddings" | "has_chatted"
) {
  const supabase = await supaServer();

  // Find the org for the user
  const { data: link, error: linkErr } = await supabase
    .from("users_orgs")
    .select("organization_id")
    .eq("user_id", userId)
    .single();

  if (linkErr || !link) return;

  // Update the org’s onboarding flag
  const { error: updateErr } = await supabase
    .from("organizations")
    .update({ [flag]: true })
    .eq("id", link.organization_id);

  if (updateErr) console.error("Failed to update onboarding flag:", updateErr.message);
}

