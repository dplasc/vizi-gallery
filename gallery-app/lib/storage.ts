import type { SupabaseClient } from "@supabase/supabase-js";

export async function getStorageUsage(
  supabase: SupabaseClient,
  ownerId: string
): Promise<{ usedMb: number; limitMb: number; remainingMb: number }> {
  const { data: limitData } = await supabase.rpc("get_user_storage_limit", {
    p_owner_id: ownerId,
  });
  const limitMb =
    typeof limitData === "number" && limitData >= 0 ? limitData : 0;

  const { data: rows } = await supabase
    .from("gallery_images")
    .select("size_bytes", { count: "exact" })
    .eq("owner_id", ownerId);

  const totalBytes = Array.isArray(rows)
    ? rows.reduce(
        (sum, row) =>
          sum +
          (typeof row?.size_bytes === "number" && row.size_bytes >= 0
            ? row.size_bytes
            : 0),
        0
      )
    : 0;

  const usedMb = Math.round(totalBytes / 1024 / 1024);

  return {
    usedMb,
    limitMb,
    remainingMb: Math.max(limitMb - usedMb, 0),
  };
}
