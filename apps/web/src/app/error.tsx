"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Do not log the error object: future errors may contain sensitive request data.
    window.dispatchEvent(new CustomEvent("watchroom:ui-error", { detail: { name: error.name } }));
  }, [error.name]);

  return (
    <main className="app-shell">
      <section className="status-card" role="alert">
        <p className="eyebrow">Ошибка интерфейса</p>
        <h1>Не удалось открыть WatchRoom</h1>
        <p className="hero-copy">Попробуйте загрузить экран ещё раз.</p>
        <button className="primary-button" type="button" onClick={reset}>
          Повторить
        </button>
      </section>
    </main>
  );
}
