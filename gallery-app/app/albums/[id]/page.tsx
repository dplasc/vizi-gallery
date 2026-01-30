import { redirect } from "next/navigation";
import Link from "next/link";
import { getGallerySession } from "@/lib/cookies";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

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
  params: Promise<{ id: string }>;
};

export default async function AlbumDetailPage({ params }: Props) {
  const userId = await getGallerySession();

  if (!userId) {
    redirect("/albums");
  }

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: album, error } = await admin
    .from("gallery_albums")
    .select("id, name, description, created_at, owner_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !album || album.owner_id !== userId) {
    redirect("/albums");
  }

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
            <p className="text-muted-foreground rounded-md border border-border bg-muted/30 px-4 py-8 text-center">
              Ovdje će uskoro biti slike.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
