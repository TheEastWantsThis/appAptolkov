import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="max-w-md text-center">
        <div className="bg-secondary text-primary mx-auto flex size-16 items-center justify-center rounded-3xl">
          <SearchX className="size-8" />
        </div>
        <div className="text-primary mt-6 text-xs font-extrabold tracking-[0.24em] uppercase">
          Ошибка 404
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          Страница не найдена
        </h1>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Возможно, адрес изменился или у вас нет ссылки на нужный раздел.
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
