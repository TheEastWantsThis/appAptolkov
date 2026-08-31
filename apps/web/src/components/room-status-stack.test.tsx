// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RoomStatusStack } from "./room-status-stack";

afterEach(cleanup);

describe("RoomStatusStack", () => {
  it("shows waiting, loading and reconnect states without replacing the room", () => {
    render(
      <RoomStatusStack
        connectionState="RECONNECTING"
        paused
        playerState="LOADING"
        roomStatus="WAITING"
      />,
    );
    expect(screen.getByText("Переподключаемся…")).toBeTruthy();
    expect(screen.getByText("Ожидаем начала")).toBeTruthy();
    expect(screen.getByText("Загружаем официальный плеер…")).toBeTruthy();
    expect(screen.getByText("Пауза")).toBeTruthy();
  });

  it("shows tap recovery and buffering as distinct critical states", () => {
    const { rerender } = render(
      <RoomStatusStack
        connectionState="CONNECTED"
        paused={false}
        playerState="AUTOPLAY_BLOCKED"
        roomStatus="LIVE"
      />,
    );
    expect(screen.getByText(/пользовательский жест/)).toBeTruthy();
    rerender(
      <RoomStatusStack
        connectionState="CONNECTED"
        paused={false}
        playerState="BUFFERING"
        roomStatus="LIVE"
      />,
    );
    expect(screen.getByText(/Буферизация/)).toBeTruthy();
  });

  it("prioritizes the ended state over a pause attribution", () => {
    render(
      <RoomStatusStack
        connectionState="CONNECTED"
        paused
        playbackActorName="Анна"
        playerState="ENDED"
        roomStatus="ENDED"
      />,
    );
    expect(screen.getByText("Комната завершена")).toBeTruthy();
    expect(screen.queryByText("Пауза от Анна")).toBeNull();
  });
});
