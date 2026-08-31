export default function Loading() {
  return (
    <main className="app-shell" aria-busy="true" aria-live="polite">
      <div className="loading-card">
        <span className="loading-spinner" aria-hidden="true" />
        <div>
          <p className="eyebrow">WatchRoom</p>
          <p className="loading-title">Загружаем приложение…</p>
        </div>
      </div>
    </main>
  );
}
