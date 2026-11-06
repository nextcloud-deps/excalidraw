import * as Element from "@excalidraw/element";
import { DARK_THEME_FILTER, MIME_TYPES, THEME } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import { Excalidraw } from "../index";
import { getDefaultAppState } from "../appState";
import { exportToCanvas } from "../scene/export";

import { API } from "./helpers/api";
import { mockHTMLImageElement } from "./helpers/mocks";
import { act, render, waitFor } from "./test-utils";

import type { AppState, DataURL } from "../types";

const { h } = window;

const file = {
  id: "emoji" as FileId,
  mimeType: MIME_TYPES.svg,
  dataURL: `data:${MIME_TYPES.svg};base64,${btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="5" fill="#fcc21b"/></svg>',
  )}` as DataURL,
  created: 1,
};

describe("keepColorsInDarkMode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // The canvas filter set while each image is drawn
  const imageFilters = async (customData?: Record<string, any>) => {
    mockHTMLImageElement(10, 10);
    const filters: string[] = [];
    vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "drawImage",
    ).mockImplementation(function (this: CanvasRenderingContext2D) {
      filters.push(this.filter);
    });
    const image = {
      ...API.createElement({
        type: "image",
        fileId: file.id,
        status: "saved",
        width: 10,
        height: 10,
      }),
      customData,
    };

    await exportToCanvas(
      [image],
      {
        ...getDefaultAppState(),
        exportWithDarkMode: true,
        exportScale: 1,
        width: 100,
        height: 100,
        offsetLeft: 0,
        offsetTop: 0,
      } as AppState,
      { [file.id]: file },
      { exportBackground: false, viewBackgroundColor: "#ffffff" },
      undefined,
      async () => {},
    );
    return filters;
  };

  it("inverts an SVG image on the canvas in dark mode", async () => {
    expect(await imageFilters()).toContain(DARK_THEME_FILTER);
  });

  it("keeps the colors of an SVG image that asks for it", async () => {
    const filters = await imageFilters({ keepColorsInDarkMode: true });

    expect(filters.length).toBeGreaterThan(0);
    expect(filters).not.toContain(DARK_THEME_FILTER);
  });

  it("redraws an element when it starts keeping its colors", async () => {
    const rectangle = API.createElement({ type: "rectangle" });
    await render(
      <Excalidraw theme={THEME.DARK} initialData={{ elements: [rectangle] }} />,
    );
    const element = h.elements[0];
    const before = Element.elementWithCanvasCache.get(element);
    expect(before?.keepColorsInDarkMode).toBe(false);

    act(() => {
      h.app.scene.mutateElement(element, {
        customData: { keepColorsInDarkMode: true },
      });
    });

    await waitFor(() =>
      expect(
        Element.elementWithCanvasCache.get(element)?.keepColorsInDarkMode,
      ).toBe(true),
    );
  });
});
