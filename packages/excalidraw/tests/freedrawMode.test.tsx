import type {
  ExcalidrawFreeDrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { UI } from "./helpers/ui";
import {
  act,
  createEvent,
  fireEvent,
  GlobalTestState,
  render,
  screen,
} from "./test-utils";

const { h } = window;

describe("freedraw mode action", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    // https://github.com/floating-ui/floating-ui/issues/1908#issuecomment-1301553793
    await act(async () => {});
  });

  it("applies currentItemStrokeVariability to newly drawn freedraw elements", () => {
    // default app state draws constant-width strokes
    expect(h.state.currentItemStrokeVariability).toBe("constant");

    UI.createElement("freedraw", { x: 0, y: 0 });

    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("constant");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
  });

  it("toggling the radio updates both the selected element and the default", () => {
    const element = UI.createElement("freedraw", { x: 0, y: 0 });
    API.setSelectedElements([element.get()] as NonDeletedExcalidrawElement[]);

    fireEvent.click(screen.getByTitle("Variable"));
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("variable");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
    expect(h.state.currentItemStrokeVariability).toBe("variable");

    fireEvent.click(screen.getByTitle("Constant"));
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.variability,
    ).toBe("constant");
    expect(
      (h.elements[0] as ExcalidrawFreeDrawElement).strokeOptions?.streamline,
    ).toBe(0.5);
    expect(h.state.currentItemStrokeVariability).toBe("constant");
  });
});

describe("freedraw pointer samples", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  afterEach(async () => {
    await act(async () => {});
  });

  const coalesced = [
    { clientX: 10, clientY: 10, pressure: 0.6 },
    { clientX: 20, clientY: 10, pressure: 0.7 },
    { clientX: 30, clientY: 0, pressure: 0.8 },
  ];

  const drawWithOneCoalescedMove = (pointerType: "pen" | "mouse") => {
    const canvas = GlobalTestState.interactiveCanvas;
    const init = { pointerId: 1, pointerType, pressure: 0.8 };

    UI.clickTool("freedraw");
    fireEvent.pointerDown(canvas, { ...init, clientX: 0, clientY: 0 });

    const move = createEvent.pointerMove(canvas, {
      ...init,
      clientX: 30,
      clientY: 0,
    });
    Object.defineProperty(move, "getCoalescedEvents", {
      value: () => coalesced,
    });
    fireEvent(canvas, move);

    fireEvent.pointerUp(canvas, { ...init, clientX: 30, clientY: 0 });

    return h.elements[0] as ExcalidrawFreeDrawElement;
  };

  it("keeps the pen samples coalesced into one pointer move", () => {
    const element = drawWithOneCoalescedMove("pen");

    expect(element.points.slice(0, 4)).toEqual([
      [0, 0],
      [10, 10],
      [20, 10],
      [30, 0],
    ]);
    expect(element.pressures.slice(1, 4)).toEqual([0.6, 0.7, 0.8]);
  });

  it("uses only the dispatched event for a mouse", () => {
    const element = drawWithOneCoalescedMove("mouse");

    expect(element.points.slice(0, 2)).toEqual([
      [0, 0],
      [30, 0],
    ]);
  });
});
