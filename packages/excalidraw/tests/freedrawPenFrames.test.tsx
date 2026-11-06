import { vi } from "vitest";

import type { ExcalidrawFreeDrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import {
  act,
  createEvent,
  fireEvent,
  GlobalTestState,
  render,
} from "./test-utils";

import type { NormalizedZoomValue } from "../types";

// the real throttling, which handles only the last pointer move of a frame
vi.mock("@excalidraw/common", async (importOriginal) =>
  importOriginal<typeof import("@excalidraw/common")>(),
);

const { h } = window;

describe("freedraw pen moves within one frame", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => {});
  });

  const penMove = (
    clientX: number,
    clientY: number,
    coalesced?: { clientX: number; clientY: number; pressure: number }[],
  ) => {
    const canvas = GlobalTestState.interactiveCanvas;
    const move = createEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX,
      clientY,
    });
    if (coalesced) {
      Object.defineProperty(move, "getCoalescedEvents", {
        value: () => coalesced,
      });
    }
    fireEvent(canvas, move);
  };

  const penDown = (clientX: number, clientY: number) => {
    UI.clickTool("freedraw");
    fireEvent.pointerDown(GlobalTestState.interactiveCanvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX,
      clientY,
    });
  };

  const nextFrame = () =>
    act(() => {
      vi.advanceTimersToNextFrame();
    });

  const points = () => (h.elements[0] as ExcalidrawFreeDrawElement).points;

  it("keeps the samples of every move, not only the last one", () => {
    penDown(0, 0);
    penMove(20, 10, [
      { clientX: 10, clientY: 10, pressure: 0.6 },
      { clientX: 20, clientY: 10, pressure: 0.6 },
    ]);
    penMove(40, 0, [
      { clientX: 30, clientY: 5, pressure: 0.6 },
      { clientX: 40, clientY: 0, pressure: 0.6 },
    ]);
    nextFrame();

    expect(points().slice(0, 5)).toEqual([
      [0, 0],
      [10, 10],
      [20, 10],
      [30, 5],
      [40, 0],
    ]);
  });

  it.each([
    ["without coalesced samples", undefined],
    ["with an empty list of coalesced samples", []],
  ])("keeps every move of a frame %s", (_, coalesced) => {
    penDown(0, 0);
    penMove(10, 10, coalesced);
    penMove(20, 0, coalesced);
    nextFrame();

    expect(points().slice(0, 3)).toEqual([
      [0, 0],
      [10, 10],
      [20, 0],
    ]);
  });

  it("keeps a bend of a few screen pixels at a high zoom", () => {
    API.setAppState({ zoom: { value: 30 as NormalizedZoomValue } });
    penDown(300, 300);
    penMove(306, 294);
    nextFrame();
    penMove(312, 300);
    nextFrame();

    expect(points().slice(0, 3)).toHaveLength(3);
    expect(points()[1][1]).toBeCloseTo(-0.2);
  });

  it("keeps the samples of a frame when the pen lifts before it", () => {
    penDown(0, 0);
    penMove(20, 10, [
      { clientX: 10, clientY: 10, pressure: 0.6 },
      { clientX: 20, clientY: 10, pressure: 0.7 },
    ]);
    fireEvent.pointerUp(GlobalTestState.interactiveCanvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 20,
      clientY: 10,
    });

    expect(points().slice(0, 3)).toEqual([
      [0, 0],
      [10, 10],
      [20, 10],
    ]);
  });

  it("keeps one pressure per point", () => {
    penDown(0, 0);
    penMove(20, 10, [
      { clientX: 10, clientY: 10, pressure: 0.6 },
      { clientX: 20, clientY: 10, pressure: 0.7 },
    ]);
    penMove(40, 0, [
      { clientX: 30, clientY: 5, pressure: 0.8 },
      { clientX: 40, clientY: 0, pressure: 0.9 },
    ]);
    nextFrame();

    const element = h.elements[0] as ExcalidrawFreeDrawElement;
    expect(element.pressures).toHaveLength(element.points.length);
    expect(element.pressures.slice(1)).toEqual([0.6, 0.7, 0.8, 0.9]);
  });
});
