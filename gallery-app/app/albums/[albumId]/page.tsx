import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/get-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UploadToAlbumCard } from "@/components/UploadToAlbumCard";
import { AlbumImageGrid } from "@/components/AlbumImageGrid";

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
  const user = await getUser();

  if (!user) {
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
                Sign in to upload to this album.
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

  if (error || !album || album.owner_id !== user.id) {
    redirect("/albums");
  }

  const { data: imagesData } = await admin
    .from("gallery_images")
    .select("id, storage_key_original")
    .eq("album_id", albumId)
    .eq("owner_id", user.id)
    .order("id", { ascending: false });
  const images = imagesData ?? [];

  const imagesWithUrl = await Promise.all(
    images.map(async (img) => {
      const { data } = await admin.storage
        .from(GALLERY_BUCKET)
        .createSignedUrl(img.storage_key_original, 60 * 60);
      return { ...img, url: data?.signedUrl ?? "" };
    })
  );
  const imagesWithUrlMapped = imagesWithUrl.map((x) => ({
    id: x.id,
    url: x.url,
    key: x.storage_key_original,
  }));

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
              <AlbumImageGrid images={imagesWithUrlMapped} />
            )}
          </CardContent>
        </Card>

        <UploadToAlbumCard ownerId={user.id} albumId={albumId} />
      </div>
    </main>
  );
}
