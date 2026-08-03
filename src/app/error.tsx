"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle />
        </div>
        <h1 className="mt-5 text-2xl font-extrabold">
          Не удалось загрузить страницу
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Повторите попытку. Если ошибка сохраняется, сообщите администратору
          время её возникновения.
        </p>
        <Button onClick={reset} className="mt-6">
          <RotateCcw /> Повторить
        </Button>
      </div>
    </main>
  );
}
