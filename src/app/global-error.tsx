"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-950">
        <main className="max-w-md text-center">
          <h1 className="text-2xl font-bold">Критическая ошибка приложения</h1>
          <p className="mt-3 text-sm text-slate-600">
            Обновите страницу или повторите попытку через несколько минут.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Повторить
          </button>
        </main>
      </body>
    </html>
  );
}
