import { expect, test, type BrowserContext, type Route } from "@playwright/test";

const publicId = "abcdefghijklmnopqrst";
const now = "2026-08-30T10:00:00.000Z";
const ownerId = "11111111-1111-4111-8111-111111111111";
const viewerId = "22222222-2222-4222-8222-222222222222";
const roomId = "33333333-3333-4333-8333-333333333333";
const channelId = "44444444-4444-4444-8444-444444444444";
const messages: Array<Record<string, unknown>> = [];

const room = {
  id: roomId,
  publicId,
  channelId,
  ownerId,
  name: "Ночной кинозал",
  description: "Смотрим вместе без лишнего шума",
  visibility: "PRIVATE",
  status: "LIVE",
  controlPolicy: "EVERYONE",
  sourceProvider: "YOUTUBE",
  sourceKind: "VIDEO",
  sourceId: "dQw4w9WgXcQ",
  canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  cachedTitle: "Демо-видео",
  cachedThumbnailUrl: null,
  cachedCreatorName: "WatchRoom",
  cachedLiveStatus: "VOD",
  cachedEmbeddable: false,
  metadataFetchedAt: now,
  nowWatchingText: "Демо-видео",
  reactionsEnabled: true,
  playback: {
    paused: true,
    state: "PAUSED",
    positionSeconds: 12,
    changedAtServerMs: Date.parse(now),
    playbackRate: 1,
    version: 3,
    actorUserId: ownerId,
    liveEdge: false,
    updatedAt: now,
  },
  linkedTelegramChatId: null,
  linkedTelegramChatUsername: "watchroom_demo",
  linkedTelegramChatUrl: "https://t.me/watchroom_demo",
  role: "VIEWER",
  permissions: ["play", "pause", "seek"],
  viewerCount: 2,
  createdAt: now,
  updatedAt: now,
  startedAt: now,
  endedAt: null,
};

const user = {
  id: viewerId,
  telegramId: "900000002",
  username: "viewer",
  firstName: "Зритель",
  lastName: null,
  photoUrl: null,
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now,
  lastSeenAt: now,
};

const roomPreview = {
  publicId,
  name: room.name,
  description: room.description,
  visibility: room.visibility,
  status: room.status,
  sourceProvider: room.sourceProvider,
  sourceKind: room.sourceKind,
  cachedTitle: room.cachedTitle,
  cachedThumbnailUrl: room.cachedThumbnailUrl,
  cachedCreatorName: room.cachedCreatorName,
  cachedLiveStatus: room.cachedLiveStatus,
  nowWatchingText: room.nowWatchingText,
  viewerCount: 2,
  viewerNames: ["Анна", "Зритель"],
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ json: body, status });
}

async function mockApi(context: BrowserContext) {
  await context.route("http://localhost:4000/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === "/v1/auth/telegram") return json(route, { csrfToken: "x".repeat(32), user });
    if (path === `/v1/rooms/${publicId}/unlock`) {
      const body = request.postDataJSON() as { password?: string };
      if (body.password !== "correct-password")
        return json(route, { error: { message: "Не удалось открыть комнату." } }, 403);
      return json(route, { grantToken: "g".repeat(32) });
    }
    if (path === `/v1/rooms/${publicId}/preview`)
      return json(route, { preview: { ...roomPreview, visibility: "PRIVATE" } });
    if (path === `/v1/rooms/${publicId}`) {
      if (!request.headers()["x-room-grant"])
        return json(route, { locked: true, publicId, visibility: "PRIVATE" });
      return json(route, { locked: false, room });
    }
    if (path === `/v1/rooms/${publicId}/join`) return json(route, { room });
    if (path === `/v1/rooms/${roomId}/members`)
      return json(route, {
        members: [
          { userId: ownerId, firstName: "Анна", username: "anna", role: "OWNER" },
          { userId: viewerId, firstName: "Зритель", username: "viewer", role: "VIEWER" },
        ],
      });
    if (path === `/v1/rooms/${publicId}/messages` && request.method() === "GET")
      return json(route, { messages });
    if (path === `/v1/rooms/${publicId}/messages` && request.method() === "POST") {
      const body = request.postDataJSON() as { text: string };
      const message = {
        id: "55555555-5555-4555-8555-555555555555",
        roomId,
        authorId: viewerId,
        authorFirstName: "Зритель",
        authorUsername: "viewer",
        text: body.text,
        createdAt: now,
        expiresAt: "2026-08-31T10:00:00.000Z",
      };
      messages.splice(0, messages.length, message);
      return json(route, { message });
    }
    if (path === `/v1/rooms/${publicId}/invite`)
      return json(route, {
        canonical: `https://t.me/watchroom/app?startapp=room_${publicId}`,
        compact: `https://t.me/watchroom/app?startapp=room_${publicId}&mode=compact`,
      });
    return json(route, { error: { message: `Unmocked ${request.method()} ${path}` } }, 404);
  });
}

async function mockLifecycleApi(context: BrowserContext, actor: "owner" | "viewer") {
  const actorUser = actor === "owner" ? { ...user, id: ownerId, firstName: "Анна" } : user;
  const channel = {
    id: channelId,
    ownerId,
    publicId: "qa-channel-public-id",
    slug: "qa-channel",
    name: "QA канал",
    description: "Проверка полного пути",
    avatarUrl: null,
    visibility: "PUBLIC",
    role: actor === "owner" ? "OWNER" : "MEMBER",
    memberCount: 1,
    createdAt: now,
    updatedAt: now,
  };
  await context.route("http://localhost:4000/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/v1/auth/telegram")
      return json(route, { csrfToken: "x".repeat(32), user: actorUser });
    if (path === "/v1/channels" && request.method() === "GET") return json(route, { channels: [] });
    if (path === "/v1/channels" && request.method() === "POST")
      return json(route, { channel }, 201);
    if (path === "/v1/channels/qa-channel") return json(route, { channel });
    if (path === `/v1/channels/${channelId}/rooms`) return json(route, { rooms: [] });
    if (path === "/v1/rooms" && request.method() === "POST") {
      Object.assign(room, {
        visibility: "PUBLIC",
        status: "WAITING",
        controlPolicy: "OWNER_ONLY",
      });
      return json(
        route,
        {
          room: {
            ...room,
            role: "OWNER",
            permissions: [
              "play",
              "pause",
              "seek",
              "change_source",
              "end_room",
              "manage_members",
              "delete_chat_message",
              "mute_chat_member",
            ],
          },
        },
        201,
      );
    }
    if (path === `/v1/rooms/${publicId}`) {
      const role = actor === "owner" ? "OWNER" : "VIEWER";
      const permissions =
        actor === "owner"
          ? [
              "play",
              "pause",
              "seek",
              "change_source",
              "end_room",
              "manage_members",
              "delete_chat_message",
              "mute_chat_member",
            ]
          : [];
      return json(route, { locked: false, room: { ...room, role, permissions } });
    }
    if (path === `/v1/rooms/${publicId}/preview`)
      return json(route, {
        preview: { ...roomPreview, visibility: "PUBLIC", status: room.status },
      });
    if (path === `/v1/rooms/${publicId}/join`)
      return json(route, {
        room: {
          ...room,
          role: actor === "owner" ? "OWNER" : "VIEWER",
          permissions:
            actor === "owner"
              ? [
                  "play",
                  "pause",
                  "seek",
                  "change_source",
                  "end_room",
                  "manage_members",
                  "delete_chat_message",
                  "mute_chat_member",
                ]
              : [],
        },
      });
    if (path === `/v1/rooms/${roomId}/members`)
      return json(route, {
        members: [
          { userId: ownerId, firstName: "Анна", username: "anna", role: "OWNER" },
          { userId: viewerId, firstName: "Зритель", username: "viewer", role: "VIEWER" },
        ],
      });
    if (path === `/v1/rooms/${publicId}/messages`) return json(route, { messages: [] });
    if (path === `/v1/rooms/${publicId}/invite`)
      return json(route, {
        canonical: `https://t.me/watchroom/app?startapp=room_${publicId}`,
        compact: `https://t.me/watchroom/app?startapp=room_${publicId}&mode=compact`,
      });
    if (path === `/v1/rooms/${publicId}/playback`) {
      room.playback = {
        ...room.playback,
        paused: false,
        state: "PLAYING",
        version: room.playback.version + 1,
      };
      return json(route, {
        room: { ...room, role: "OWNER", permissions: ["play", "pause", "seek"] },
      });
    }
    if (path === `/v1/rooms/${roomId}` && request.method() === "PATCH") {
      const body = request.postDataJSON() as { status?: string };
      if (body.status) room.status = body.status;
      return json(route, {
        room: {
          ...room,
          role: "OWNER",
          permissions: [
            "play",
            "pause",
            "seek",
            "change_source",
            "end_room",
            "manage_members",
            "delete_chat_message",
            "mute_chat_member",
          ],
        },
      });
    }
    return json(route, { error: { message: `Unmocked ${request.method()} ${path}` } }, 404);
  });
}

test("private room works across two isolated browser contexts", async ({ browser }) => {
  messages.length = 0;
  const first = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const second = await browser.newContext({ viewport: { width: 430, height: 900 } });
  await mockApi(first);
  await mockApi(second);
  await first.addInitScript((id) => {
    sessionStorage.setItem(`watchroom.room-grant.${id}`, "g".repeat(32));
  }, publicId);

  const ownerView = await first.newPage();
  const guestView = await second.newPage();
  const response = await ownerView.goto(`/rooms/${publicId}`);
  expect(response?.headers()["content-security-policy"]).toContain("frame-src");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(ownerView.getByRole("heading", { name: "Ночной кинозал" })).toBeVisible();
  await expect(ownerView.locator(".player-error")).toContainText("Автор запретил встраивание");

  await guestView.goto(`/rooms/${publicId}`);
  await expect(guestView.getByRole("heading", { name: "Ночной кинозал" })).toBeVisible();
  await guestView.getByLabel("Пароль").fill("wrong-password");
  await guestView.getByRole("button", { name: "Войти" }).click();
  await expect(guestView.locator(".error-text")).toContainText("Не удалось открыть комнату");
  await guestView.getByLabel("Пароль").fill("correct-password");
  await guestView.getByRole("button", { name: "Войти" }).click();
  await expect(guestView.getByRole("heading", { name: "Ночной кинозал" })).toBeVisible();

  await ownerView.getByPlaceholder("Сообщение…").fill("Привет из первого окна");
  await ownerView.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(ownerView.getByText("Привет из первого окна")).toBeVisible();
  await guestView.reload();
  await expect(guestView.getByText("Привет из первого окна")).toBeVisible();

  // The same mounted player switches between normal and sticky modes without a close action.
  await ownerView.getByRole("button", { name: "Закрепить компактный плеер" }).click();
  await expect(ownerView.getByRole("button", { name: "Развернуть плеер" })).toBeVisible();
  await expect(ownerView.getByRole("button", { name: "Закрыть плеер" })).toHaveCount(0);

  for (const page of [ownerView, guestView]) {
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("watchroom:telegram-deactivated"));
      window.dispatchEvent(new Event("watchroom:telegram-activated"));
    });
    await expect(page.getByRole("heading", { name: "Ночной кинозал" })).toBeVisible();
  }

  await expect(guestView.getByRole("button", { name: "Завершить комнату" })).toHaveCount(0);

  await first.close();
  await second.close();
});

test("owner creates a channel and room, shares, controls and ends it", async ({ browser }) => {
  room.status = "LIVE";
  room.playback = { ...room.playback, paused: true, state: "PAUSED", version: 3 };
  const ownerContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
  await mockLifecycleApi(ownerContext, "owner");
  const ownerPage = await ownerContext.newPage();

  await ownerPage.goto("/channels/new");
  await ownerPage.getByLabel("Название").fill("QA канал");
  await ownerPage.getByLabel("Адрес канала").fill("qa-channel");
  await ownerPage.getByRole("button", { name: "Создать канал" }).click();
  await expect(ownerPage.getByRole("heading", { name: "QA канал" })).toBeVisible();

  await ownerPage.getByRole("link", { name: "Создать комнату" }).click();
  await expect(ownerPage).toHaveURL(`/rooms/new?channel=${channelId}`);
  await ownerPage.getByLabel("Название").fill("Полный MVP сценарий");
  await ownerPage
    .getByLabel("Ссылка на видео или трансляцию")
    .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await ownerPage.getByLabel("Сейчас смотрят (необязательно)").fill("Проверяем WatchRoom");
  const [, createdRoomResponse] = await Promise.all([
    ownerPage.getByRole("button", { name: "Создать комнату" }).click(),
    ownerPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/rooms",
    ),
  ]);
  expect(createdRoomResponse.status()).toBe(201);
  await expect(ownerPage).toHaveURL(`/rooms/${publicId}`);
  await ownerPage.getByRole("button", { name: "Войти в комнату" }).click();
  await expect(ownerPage.getByRole("heading", { name: "Ночной кинозал" })).toBeVisible();
  await expect(ownerPage.getByRole("heading", { name: "Управление владельца" })).toBeVisible();
  await expect(ownerPage.getByRole("button", { name: "Копировать" })).toBeVisible();

  await expect(ownerPage.getByRole("button", { name: "▶ Play" })).toHaveCount(0);
  await expect(ownerPage.getByRole("heading", { name: "Управление просмотром" })).toHaveCount(0);

  const viewerContext = await browser.newContext({ viewport: { width: 320, height: 700 } });
  await mockLifecycleApi(viewerContext, "viewer");
  const viewerPage = await viewerContext.newPage();
  await viewerPage.goto(`/rooms/${publicId}`);
  await viewerPage.getByRole("button", { name: "Войти в комнату" }).click();
  await expect(viewerPage.getByRole("heading", { name: "Ночной кинозал" })).toBeVisible();
  await expect(viewerPage.getByRole("button", { name: "▶ Play" })).toHaveCount(0);
  await expect(viewerPage.getByRole("button", { name: "Завершить комнату" })).toHaveCount(0);

  await ownerPage.getByRole("button", { name: "Завершить комнату" }).click();
  await expect(ownerPage.getByText("Комната завершена")).toBeVisible();
  await viewerPage.reload();
  await viewerPage.getByRole("button", { name: "Войти в комнату" }).click();
  await expect(viewerPage.getByText("Комната завершена")).toBeVisible();

  await ownerContext.close();
  await viewerContext.close();
});
