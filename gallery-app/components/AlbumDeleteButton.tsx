"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Props = {
  albumId: string;
};

export function AlbumDeleteButton({ albumId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/gallery/albums/${albumId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? `Error ${res.status}`);
        setDeleting(false);
        return;
      }

      setOpen(false);
      setDeleting(false);
      router.push("/albums");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="default"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="text-red-500 hover:bg-red-500/10 hover:text-red-600"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Obriši album
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Obriši album i sve slike?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Ova akcija je nepovratna. Svi sadržaj albuma bit će trajno obrisan.
          </p>
          {error && (
            <div
              className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-400"
              role="alert"
            >
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
            >
              Odustani
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? "Brišem..." : "Obriši"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
