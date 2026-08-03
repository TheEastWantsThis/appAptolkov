import Link from "next/link";
import { ArrowLeft, ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-3xl bg-red-100 text-red-700">
          <ShieldX className="size-8" />
        </div>
        <div className="mt-6 text-xs font-extrabold tracking-[0.24em] text-red-600 uppercase">
          Ошибка 403
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Недостаточно прав
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          У вашей учётной записи нет разрешения на просмотр этой страницы. Если
          доступ необходим для работы, обратитесь к администратору.
        </p>
        <Button asChild className="mt-7">
          <Link href="/dashboard">
            <ArrowLeft /> Вернуться на главную
          </Link>
        </Button>
      </div>
    </main>
  );
}
