// ─── /room/[roomId]/page.js ───────────────────────────────────────────────────
// Dynamic route — roomId comes from the URL.
// If user lands here directly without a name, redirect to landing page.

"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import useWhiteboardStore from "../../stores/useWhiteboardStore";
import ClientCanvas from "../../components/ClientCanvas";

export default function RoomPage() {
  const { roomId } = useParams();
  const router = useRouter();
  const userName = useWhiteboardStore((state) => state.userName);

  // if user has no name ()eg: they navigate drectly to the URL
  // rediredt them to the landing page to set theri name first
  useEffect(() => {
    if (!userName) {
      router.replace(`/?join=${roomId}`);
    }
  }, [userName, router]);

  // Don't render canvas until we have a name
  if (!userName) return null;

  return <ClientCanvas roomId={roomId} />;
}
