import { LogOut } from "lucide-react";

import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
      >
        <LogOut />
        <span className="hidden sm:inline">Выйти</span>
      </Button>
    </form>
  );
}
