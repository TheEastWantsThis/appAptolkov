import { redirect } from "next/navigation";

import { getAuthContext } from "@/modules/auth/application/auth-context";

export default async function HomePage() {
  const context = await getAuthContext();
  redirect(context ? "/dashboard" : "/login");
}
