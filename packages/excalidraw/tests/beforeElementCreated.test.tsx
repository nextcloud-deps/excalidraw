import React from "react";
import { vi } from "vitest";

import { reseed } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { Keyboard, Pointer, UI } from "./helpers/ui";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { act, render, unmountComponent } from "./test-utils";

const { h } = window;

const mouse = new Pointer("mouse");

const createHook = () =>
  vi.fn((element: ExcalidrawElement) => {
    // host apps mutate customData in place, as Whiteboard does
    (element as any).customData = { ...element.customData, creator: "alice" };
    return element;
  });

describe("beforeElementCreated", () => {
  let hook: ReturnType<typeof createHook>;

  beforeEach(async () => {
    unmountComponent();
    reseed(7);
    mouse.reset();
    hook = createHook();
  });

  it("runs once for a drawn shape", async () => {
    await render(<Excalidraw beforeElementCreated={hook} />);

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 80);

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook.mock.calls[0][0].type).toBe("rectangle");
    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].customData).toEqual({ creator: "alice" });
  });

  it("keeps drawing the element when the hook returns a copy", async () => {
    await render(
      <Excalidraw
        beforeElementCreated={(element) => ({
          ...element,
          customData: { creator: "alice" },
        })}
      />,
    );

    UI.clickTool("rectangle");
    mouse.down(10, 10);
    mouse.up(100, 80);

    expect(h.elements).toHaveLength(1);
    expect(h.elements[0].width).toBe(100);
    expect(h.elements[0].height).toBe(80);
    expect(h.elements[0].customData).toEqual({ creator: "alice" });
  });

  it("runs once for the bound text of a container", async () => {
    await render(<Excalidraw beforeElementCreated={hook} />);

    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 90,
      height: 75,
      backgroundColor: "red",
    });
    API.setElements([rectangle]);
    expect(hook).not.toHaveBeenCalled();

    mouse.doubleClickAt(rectangle.x + 10, rectangle.y + 10);
    const editor = await getTextEditor();
    updateTextEditor(editor, "Hello");
    Keyboard.exitTextEditor(editor);

    expect(hook).toHaveBeenCalledTimes(1);
    const [text] = hook.mock.calls[0];
    expect(text.type).toBe("text");
    expect((text as any).containerId).toBe(rectangle.id);
    expect(
      h.elements.find((element) => element.id === text.id)?.customData,
    ).toEqual({ creator: "alice" });
  });

  it("runs once for a bucket fill", async () => {
    await render(<Excalidraw beforeElementCreated={hook} />);

    const rectangle = API.createElement({
      type: "rectangle",
      x: 20,
      y: 20,
      width: 120,
      height: 100,
      roundness: null,
      backgroundColor: "transparent",
    });
    act(() => {
      h.app.updateScene({
        elements: [rectangle],
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
    });
    expect(hook).not.toHaveBeenCalled();

    act(() => {
      h.app.setActiveTool({ type: "bucketfill" });
    });
    mouse.clickAt(80, 70);

    expect(hook).toHaveBeenCalledTimes(1);
    const [fill] = hook.mock.calls[0];
    expect(fill.type).toBe("line");
    expect(h.elements.find((element) => element.id === fill.id)).toBeTruthy();
  });

  it("does not run for restored or remote elements", async () => {
    const restored = API.createElement({ type: "rectangle", id: "restored" });
    await render(
      <Excalidraw
        beforeElementCreated={hook}
        initialData={{ elements: [restored] }}
      />,
    );

    act(() => {
      h.app.updateScene({
        elements: [
          ...h.elements,
          API.createElement({ type: "ellipse", id: "remote" }),
        ],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    });

    expect(h.elements.map((element) => element.id)).toEqual([
      "restored",
      "remote",
    ]);
    expect(hook).not.toHaveBeenCalled();
  });
});
