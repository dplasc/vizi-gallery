"use client";

/*
 * Flow: upload-url (temp path) -> PUT to signed URL -> promote (copy temp to album + insert gallery_images) -> router.refresh().
 * - upload-url called without albumId so path is ownerId/temp/... (promote requires tempPath).
 * - Promote requires gallery_session (cookies sent by same-origin fetch).
 * - 403 quota_exceeded -> "Quota exceeded"; promote failure -> show response error.
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type UploadUrlApiResponse = {
  signedUrl: string;
  path: string;
  bucket: string;
};

type Props = {
  ownerId: string;
  albumId: string;
};

export function UploadToAlbumCard({ ownerId, albumId }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const selectedFile = file;
    if (!selectedFile || uploading) return;

    setResult(null);
    setMessage(null);
    setUploadedPath(null);
    setUploading(true);

    const contentType =
      selectedFile.type && selectedFile.type.trim()
        ? selectedFile.type.trim()
        : "application/octet-stream";

    try {
      // Request temp path (no albumId) so promote can copy temp -> album and insert into gallery_images
      const postRes = await fetch("/api/gallery/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId,
          filename: selectedFile.name,
          fileSize: selectedFile.size,
          contentType,
        }),
      });

      const postData = await postRes.json().catch(() => ({}));

      if (!postRes.ok) {
        if (postRes.status === 403 && postData?.error === "quota_exceeded") {
          setResult("error");
          setMessage("Quota exceeded");
        } else {
          setResult("error");
          setMessage(
            postData?.error
              ? String(postData.error)
              : `Error ${postRes.status}`
          );
        }
        setUploading(false);
        return;
      }

      const { signedUrl, path } = postData as UploadUrlApiResponse;
      if (!signedUrl || !path) {
        setResult("error");
        setMessage("Invalid response from server");
        setUploading(false);
        return;
      }

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: selectedFile,
      });

      if (putRes.status !== 200 && putRes.status !== 201) {
        setResult("error");
        setMessage(`Upload failed: ${putRes.status}`);
        setUploading(false);
        return;
      }

      // Promote: copy temp -> album, insert into gallery_images (requires gallery_session; cookies sent by default)
      const promoteRes = await fetch("/api/gallery/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempPath: path, albumId }),
      });
      const promoteData = await promoteRes.json().catch(() => ({}));

      if (!promoteRes.ok) {
        setResult("error");
        setMessage(
          promoteData?.error != null
            ? String(promoteData.error)
            : `Promote failed: ${promoteRes.status}`
        );
        setUploadedPath(path);
        setUploading(false);
        return;
      }

      setResult("success");
      setUploadedPath(
        typeof promoteData?.finalPath === "string"
          ? promoteData.finalPath
          : path
      );
      setMessage("Dodano u album");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setResult("error");
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  const hasFile = !!file;
  const disabled = !hasFile || uploading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload to album</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            ref={inputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={uploading}
            className="max-w-xs"
          />
          <Button onClick={handleUpload} disabled={disabled}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>

        {result === "success" && message && (
          <Alert>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              {message}
              {uploadedPath && (
                <span className="mt-1 block font-mono text-xs">
                  {uploadedPath}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {result === "error" && message && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
