import { redirect } from "next/navigation";
import Link from "next/link";
import { getGallerySession } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadToAlbumCard } from "@/components/UploadToAlbumCard";
import { AlbumImageGrid } from "@/components/AlbumImageGrid";
import { AlbumDeleteButton } from "@/components/AlbumDeleteButton";

export const dynamic = "force-dynamic";

const GALLERY_BUCKET = "gallery";

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
  params: Promise<{ albumId: string }>;
};

export default async function AlbumDetailPage({ params }: Props) {
  const { albumId } = await params;
  const userId = await getGallerySession();

  if (!userId) {
    return (
      <main className="flex min-h-screen flex-col items-center p-6">
        <div className="w-full max-w-3xl space-y-8">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="default">
              <Link href="/albums">← Natrag na albume</Link>
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Upload to album</CardTitle>
              <CardDescription>
                Prijavi se za učitavanje u ovaj album.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: album, error } = await admin
    .from("gallery_albums")
    .select("id, name, description, created_at, owner_id")
    .eq("id", albumId)
    .maybeSingle();

  if (error || !album || album.owner_id !== userId) {
    redirect("/albums");
  }

  const { data: imagesData } = await admin
    .from("gallery_images")
    .select("id, storage_key_original, storage_key_optimized")
    .eq("album_id", albumId)
    .eq("owner_id", userId)
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button asChild variant="outline" size="default">
            <Link href="/albums">← Natrag na albume</Link>
          </Button>
          <AlbumDeleteButton albumId={albumId} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {album.name}
          </h1>
          <a
            href="#upload-area"
            className={buttonVariants()}
          >
            Dodaj slike
          </a>
        </div>

        <section id="upload-area" className="space-y-3">
          <UploadToAlbumCard ownerId={userId} albumId={albumId} />
          {images.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Odaberi datoteku i klikni Upload da dodaš prvu sliku u album.
            </p>
          )}
        </section>

        <Card>
          <CardHeader>
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
              <AlbumImageGrid images={imagesWithUrlMapped} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
