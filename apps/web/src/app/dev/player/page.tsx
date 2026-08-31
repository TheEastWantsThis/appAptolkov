import { notFound } from "next/navigation";

import { PlayerDemo } from "./player-demo";

export default function PlayerDemoPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PlayerDemo />;
}
