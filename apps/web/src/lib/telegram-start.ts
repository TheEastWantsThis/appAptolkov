interface TelegramStartContext {
  initData: string;
  unsafeStartParam?: string;
  locationSearch: string;
  locationHash: string;
}

export function roomPublicIdFromTelegramStart(context: TelegramStartContext): string | null {
  const signedStartParam = new URLSearchParams(context.initData).get("start_param");
  const search = new URLSearchParams(context.locationSearch);
  const hash = new URLSearchParams(context.locationHash.replace(/^#/, ""));
  const candidates = [
    signedStartParam,
    search.get("tgWebAppStartParam"),
    hash.get("tgWebAppStartParam"),
    search.get("startapp"),
    context.unsafeStartParam,
  ];
  for (const candidate of candidates) {
    const match = /^room_([A-Za-z0-9_-]{20,24})$/.exec(candidate ?? "");
    if (match?.[1]) return match[1];
  }
  return null;
}
