import { redirect } from "next/navigation";
import { getGallerySession } from "@/lib/cookies";
import { getViziBaseUrl } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const userId = await getGallerySession();
  const viziBase = getViziBaseUrl();

  if (userId) {
    redirect("/albums");
  }

  redirect(`${viziBase}/app`);
}
