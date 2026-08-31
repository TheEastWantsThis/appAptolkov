import { notFound } from "next/navigation";

import { RoomPreview } from "./room-preview";

export default function RoomPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RoomPreview />;
}
