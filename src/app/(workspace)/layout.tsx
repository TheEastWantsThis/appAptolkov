import {
  DesktopSidebar,
  MobileBottomNavigation,
} from "@/components/layout/navigation";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { requirePageAuth } from "@/modules/auth/application/page-access";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requirePageAuth();
  const permissions = [...context.permissions];

  return (
    <div className="min-h-screen">
      <DesktopSidebar
        permissions={permissions}
        name={context.name}
        roles={context.roleCodes}
      />
      <MobileBottomNavigation permissions={permissions} />

      <div className="lg:pl-72">
        <header className="bg-background/88 sticky top-0 z-30 border-b backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <div className="text-sm font-extrabold tracking-tight">
                Aпотолков CRM
              </div>
              <div className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
                Рабочее пространство
              </div>
            </div>
            <div className="hidden lg:block" aria-hidden="true" />
            <SignOutButton />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 pt-6 pb-28 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
