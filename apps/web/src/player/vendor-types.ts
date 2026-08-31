export interface YouTubePlayerInstance {
  cueVideoById(videoId: string): void;
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  mute(): void;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  unMute(): void;
}

export interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onStateChange: (event: { data: number }) => void;
        onError: (event: { data: number }) => void;
        onAutoplayBlocked: () => void;
      };
    },
  ) => YouTubePlayerInstance;
}

export interface TwitchPlayerInstance {
  addEventListener(event: string, handler: () => void): void;
  destroy?: () => void;
  getCurrentTime(): number;
  getDuration(): number;
  isPaused(): boolean;
  pause(): void;
  play(): void;
  seek(seconds: number): void;
  setChannel(channel: string): void;
  setMuted(muted: boolean): void;
  setVideo(videoId: string, timestamp?: number): void;
}

export interface TwitchPlayerConstructor {
  new (
    elementId: string,
    options: {
      width: string;
      height: string;
      parent: string[];
      autoplay: boolean;
      muted: boolean;
      channel?: string;
      video?: string;
    },
  ): TwitchPlayerInstance;
  READY: string;
  PLAY: string;
  PLAYING: string;
  PAUSE: string;
  ENDED: string;
  PLAYBACK_BLOCKED: string;
  OFFLINE: string;
}

export interface TwitchNamespace {
  Player: TwitchPlayerConstructor;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    Twitch?: TwitchNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}
