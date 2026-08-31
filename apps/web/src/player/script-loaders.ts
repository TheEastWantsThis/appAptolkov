import type { TwitchNamespace, YouTubeNamespace } from "./vendor-types";

let youTubePromise: Promise<YouTubeNamespace> | null = null;
let twitchPromise: Promise<TwitchNamespace> | null = null;

export function loadYouTubeSdk(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youTubePromise) return youTubePromise;
  youTubePromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YOUTUBE_SDK_UNAVAILABLE"));
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existing) return;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YOUTUBE_SDK_LOAD_FAILED"));
    document.head.append(script);
  });
  return youTubePromise;
}

export function loadTwitchSdk(): Promise<TwitchNamespace> {
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
  if (twitchPromise) return twitchPromise;
  twitchPromise = new Promise<TwitchNamespace>((resolve, reject) => {
    const finish = () => {
      if (window.Twitch?.Player) resolve(window.Twitch);
      else reject(new Error("TWITCH_SDK_UNAVAILABLE"));
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://player.twitch.tv/js/embed/v1.js"]',
    );
    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("TWITCH_SDK_LOAD_FAILED")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.async = true;
    script.onload = finish;
    script.onerror = () => reject(new Error("TWITCH_SDK_LOAD_FAILED"));
    document.head.append(script);
  });
  return twitchPromise;
}
