import { KEYS, ROUNDNESS } from "@excalidraw/common";

import {
  convertElementTypePopupAtom,
  convertElementTypes,
} from "../components/ConvertElementTypePopup";
import { editorJotaiStore } from "../editor-jotai";
import { Excalidraw } from "../index";

import { API } from "./helpers/api";
import { act, fireEvent, render } from "./test-utils";

const { h } = window;

describe("convert element type", () => {
  beforeEach(async () => {
    await render(<Excalidraw handleKeyboardGlobally={true} />);
  });

  // #9662
  it("recalculates roundness type when switching between generic shapes", () => {
    const rectangle = API.createElement({
      type: "rectangle",
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS }, // Dooesn't matter as long as it is set
    });

    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);

    act(() => {
      convertElementTypes(h.app, {
        conversionType: "generic",
        nextType: "diamond",
      });
    });

    expect(h.elements[0].type).toBe("diamond");
    expect(h.elements[0].roundness?.type).toBe(ROUNDNESS.PROPORTIONAL_RADIUS);

    act(() => {
      convertElementTypes(h.app, {
        conversionType: "generic",
        nextType: "rectangle",
      });
    });

    expect(h.elements[0].type).toBe("rectangle");
    expect(h.elements[0].roundness?.type).toBe(ROUNDNESS.ADAPTIVE_RADIUS);
  });

  it("leaves Tab to move the focus when nothing can be converted", () => {
    const container = document.querySelector<HTMLElement>(".excalidraw")!;
    container.focus();

    expect(fireEvent.keyDown(container, { key: KEYS.TAB })).toBe(true);
    expect(editorJotaiStore.get(convertElementTypePopupAtom)).toBe(null);
  });

  it("uses Tab to switch the type of a selected shape", () => {
    const rectangle = API.createElement({ type: "rectangle" });
    API.setElements([rectangle]);
    API.setSelectedElements([rectangle]);
    const container = document.querySelector<HTMLElement>(".excalidraw")!;
    container.focus();

    expect(fireEvent.keyDown(container, { key: KEYS.TAB })).toBe(false);
    expect(editorJotaiStore.get(convertElementTypePopupAtom)).toEqual({
      type: "panel",
    });

    fireEvent.keyDown(container, { key: KEYS.TAB });
    expect(h.elements[0].type).toBe("diamond");

    fireEvent.keyDown(container, { key: KEYS.TAB, shiftKey: true });
    expect(h.elements[0].type).toBe("rectangle");
  });

  it("leaves Tab to move the focus when the selection can't be converted", () => {
    const text = API.createElement({ type: "text", text: "Hello" });
    API.setElements([text]);
    API.setSelectedElements([text]);
    const container = document.querySelector<HTMLElement>(".excalidraw")!;
    container.focus();

    expect(fireEvent.keyDown(container, { key: KEYS.TAB })).toBe(true);
    expect(
      fireEvent.keyDown(container, { key: KEYS.TAB, shiftKey: true }),
    ).toBe(true);
    expect(editorJotaiStore.get(convertElementTypePopupAtom)).toBe(null);
  });
});
