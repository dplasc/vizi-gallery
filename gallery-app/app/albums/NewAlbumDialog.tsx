"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NewAlbumDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button">Novi album</Button>
      </DialogTrigger>
      <DialogContent showClose={true}>
        <DialogHeader>
          <DialogTitle>Novi album</DialogTitle>
          <p className="text-muted-foreground text-sm">
            Unesi naziv i opcionalno opis.
          </p>
        </DialogHeader>
        <form
          action="/api/albums"
          method="POST"
          className="flex flex-col gap-4"
        >
          <div className="space-y-2">
            <label htmlFor="album-name-dialog" className="text-sm font-medium">
              Naziv (obavezno)
            </label>
            <Input
              id="album-name-dialog"
              name="name"
              type="text"
              placeholder="npr. Ljeto 2025"
              required
              maxLength={200}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="album-description-dialog" className="text-sm font-medium">
              Opis (opcionalno)
            </label>
            <Textarea
              id="album-description-dialog"
              name="description"
              placeholder="Kratki opis albuma"
              rows={2}
              maxLength={2000}
              className="resize-none"
            />
          </div>
          <Button type="submit">Kreiraj album</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
