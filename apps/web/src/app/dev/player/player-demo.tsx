"use client";

import { parsePlayerSource, type PlayerSource, type SourceMetadata } from "@watchroom/shared";
import { useState, type FormEvent } from "react";

import { OfficialPlayer } from "../../../components/official-player";
import { useWatchRoom } from "../../../components/watchroom-provider";

export function PlayerDemo() {
  const { request } = useWatchRoom();
  const [provider, setProvider] = useState<"YOUTUBE" | "TWITCH">("YOUTUBE");
  const [kind, setKind] = useState<"VIDEO" | "VOD" | "LIVE">("VIDEO");
  const [input, setInput] = useState("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  const [source, setSource] = useState<PlayerSource | null>(null);
  const [metadata, setMetadata] = useState<SourceMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const parsed = parsePlayerSource({ provider, kind, input });
      setSource(parsed);
      const result = await request<{ metadata: SourceMetadata }>("/v1/sources/metadata", {
        method: "POST",
        body: JSON.stringify({ provider, kind, input }),
      });
      setMetadata(result.metadata);
    } catch (reason: unknown) {
      setSource(null);
      setMetadata(null);
      setError(reason instanceof Error ? reason.message : "Источник недопустим.");
    }
  }

  return (
    <main className="app-shell">
      <section className="form-card dev-panel">
        <div>
          <p className="eyebrow">Только development</p>
          <h1>PlayerAdapter lab</h1>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-columns">
            <label>
              Провайдер
              <select
                value={provider}
                onChange={(event) => {
                  const next = event.target.value as "YOUTUBE" | "TWITCH";
                  setProvider(next);
                  if (next === "TWITCH" && kind === "VIDEO") setKind("LIVE");
                }}
              >
                <option value="YOUTUBE">YouTube</option>
                <option value="TWITCH">Twitch</option>
              </select>
            </label>
            <label>
              Тип
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as "VIDEO" | "VOD" | "LIVE")}
              >
                <option disabled={provider === "TWITCH"} value="VIDEO">
                  Видео
                </option>
                <option value="VOD">VOD</option>
                <option value="LIVE">Live</option>
              </select>
            </label>
          </div>
          <label>
            Официальная ссылка или ID
            <input value={input} onChange={(event) => setInput(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            Загрузить официальный embed
          </button>
        </form>
        {error ? <p className="error-text">{error}</p> : null}
      </section>
      {source ? (
        <section className="status-card">
          <OfficialPlayer embeddable={metadata?.embeddable ?? null} source={source} />
          <p className="muted">
            {metadata?.available
              ? `${metadata.title ?? source.sourceId} · ${metadata.creatorName ?? "автор неизвестен"}`
              : "Метаданные недоступны — плеер продолжает работать по sourceId."}
          </p>
        </section>
      ) : null}
    </main>
  );
}
