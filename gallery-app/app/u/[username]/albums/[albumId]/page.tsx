import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlbumImageGrid } from "@/components/AlbumImageGrid";

export const dynamic = "force-dynamic";

const GALLERY_BUCKET = "gallery";

function normalizeUsername(raw: string): string {
  return raw.replace(/^@/, "").trim().toLowerCase();
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("hr-HR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type Props = {
  params: Promise<{ username: string; albumId: string }>;
};

/**
 * Public album view. Resolves owner_id from username; fetches album by id AND owner_id.
 * Signs thumbnail and original URLs server-side in one batch. No auth required.
 */
export default async function PublicAlbumPage({ params }: Props) {
  const { username: rawUsername, albumId } = await params;
  const username = normalizeUsername(rawUsername);
  if (!username || !albumId?.trim()) notFound();

  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (profileError || !profile) notFound();
  const ownerId = profile.id;

  const { data: album, error: albumError } = await admin
    .from("gallery_albums")
    .select("id, name, description, created_at, owner_id")
    .eq("id", albumId.trim())
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (albumError || !album) notFound();

  const { data: imagesData } = await admin
    .from("gallery_images")
    .select("id, storage_key_original, storage_key_optimized")
    .eq("album_id", albumId.trim())
    .eq("owner_id", ownerId)
    .order("id", { ascending: false });
  const images = imagesData ?? [];

  const allKeys = new Set<string>();
  for (const img of images) {
    const orig = img.storage_key_original?.trim();
    const opt = img.storage_key_optimized?.trim();
    if (orig) allKeys.add(orig);
    if (opt) allKeys.add(opt);
  }
  const keysToSign = Array.from(allKeys);

  const keyToUrl = new Map<string, string>();
  if (keysToSign.length > 0) {
    const { data: signedData } = await admin.storage
      .from(GALLERY_BUCKET)
      .createSignedUrls(keysToSign, 60 * 10);
    if (signedData) {
      for (const item of signedData) {
        if (item.path && item.signedUrl) {
          keyToUrl.set(item.path, item.signedUrl);
        }
      }
    }
  }

  const imagesWithUrlMapped = images.map((img) => {
    const thumbKey =
      (img.storage_key_optimized ?? img.storage_key_original)?.trim() ?? "";
    const origKey = img.storage_key_original?.trim() ?? "";
    const url = keyToUrl.get(origKey) ?? "";
    const thumbnailUrl = thumbKey ? (keyToUrl.get(thumbKey) ?? url) : url;
    return {
      id: img.id,
      url,
      thumbnailUrl: thumbnailUrl || url,
      key: origKey || thumbKey,
    };
  });

  return (
    <main className="flex min-h-screen flex-col items-center p-6">
      <div className="w-full max-w-3xl space-y-8">
        <Button asChild variant="outline" size="default">
          <Link href={`/u/${encodeURIComponent(rawUsername)}`}>
            ← Natrag na galeriju
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{album.name}</CardTitle>
            {album.description && (
              <CardDescription className="text-base">
                {album.description}
              </CardDescription>
            )}
            <p className="text-muted-foreground text-sm">
              Kreirano: {formatDate(album.created_at)}
            </p>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-border bg-muted/30 px-4 py-8 text-center">
                Ovdje će uskoro biti slike.
              </p>
            ) : (
              <AlbumImageGrid images={imagesWithUrlMapped} readOnly />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
