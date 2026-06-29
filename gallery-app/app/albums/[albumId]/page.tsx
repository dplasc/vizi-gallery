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
import { GalleryHeader } from "@/components/gallery-header";
import { cn } from "@/lib/utils";

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
      <>
        <GalleryHeader />
      <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-3xl space-y-6">
          <Button asChild variant="outline" size="default" className="h-8 text-muted-foreground">
            <Link href="/albums">← Natrag na albume</Link>
          </Button>
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Dodaj slike u album</CardTitle>
              <CardDescription>
                Prijavi se za učitavanje u ovaj album.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
      </>
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
    .select("id, storage_key_original, storage_key_optimized, storage_key_thumb")
    .eq("album_id", albumId)
    .eq("owner_id", userId)
    .order("id", { ascending: false });
  const images = imagesData ?? [];

  const allKeys = new Set<string>();
  for (const img of images) {
    const orig = img.storage_key_original?.trim();
    const opt = img.storage_key_optimized?.trim();
    const thumb = img.storage_key_thumb?.trim();
    if (orig) allKeys.add(orig);
    if (opt) allKeys.add(opt);
    if (thumb) allKeys.add(thumb);
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
      img.storage_key_thumb?.trim() ||
      (img.storage_key_optimized ?? img.storage_key_original)?.trim() ||
      "";
    const origKey = img.storage_key_original?.trim() ?? "";
    const url =
      keyToUrl.get(img.storage_key_optimized?.trim() ?? origKey) ??
      keyToUrl.get(origKey) ??
      "";
    const thumbnailUrl = thumbKey ? (keyToUrl.get(thumbKey) ?? url) : url;
    return {
      id: img.id,
      url,
      thumbnailUrl: thumbnailUrl || url,
      key: origKey || thumbKey,
    };
  });

  return (
    <>
      <GalleryHeader />
    <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6">
      <div className="w-full max-w-3xl space-y-6">
        <Button asChild variant="outline" size="default" className="h-8 text-muted-foreground">
          <Link href="/albums">← Natrag na albume</Link>
        </Button>

        <section className="space-y-4 border-b border-border pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {album.name}
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground">
                Dodajte, pregledajte i uredite slike koje se prikazuju u ovom
                albumu.
              </p>
              {album.description && (
                <p className="text-sm text-muted-foreground">{album.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Kreirano: {formatDate(album.created_at)}
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <a
                href="#upload-area"
                className={cn(buttonVariants(), "w-full sm:w-auto")}
              >
                Dodaj slike
              </a>
              <AlbumDeleteButton albumId={albumId} />
            </div>
          </div>
        </section>

        <section id="upload-area" className="space-y-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
            <UploadToAlbumCard ownerId={userId} albumId={albumId} />
          </div>
          {images.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              Odaberite datoteku i kliknite Učitaj da dodate prvu sliku u
              album.
            </p>
          )}
        </section>

        <Card className="border-border/60 bg-card shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base font-semibold">Slike u albumu</CardTitle>
            {images.length > 0 && (
              <p className="text-xs text-muted-foreground/80">
                Kliknite na sliku za pregled.
              </p>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            {images.length === 0 ? (
              <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-8 text-center">
                <p className="font-medium text-foreground">Album je još prazan</p>
                <p className="text-muted-foreground text-sm">
                  Dodajte prvu sliku kako bi se prikazala u galeriji.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/20 p-3 sm:p-4">
                <AlbumImageGrid images={imagesWithUrlMapped} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
    </>
  );
}
