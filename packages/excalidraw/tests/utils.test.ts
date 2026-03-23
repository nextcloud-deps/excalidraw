import { isDarwin } from "../constants";
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { getShortcutKey, isTransparent } from "../utils";

describe("Test isTransparent", () => {
  it("should return true when color is rgb transparent", () => {
    expect(isTransparent("#ff00")).toEqual(true);
    expect(isTransparent("#fff00000")).toEqual(true);
    expect(isTransparent("transparent")).toEqual(true);
  });

  it("should return false when color is not transparent", () => {
    expect(isTransparent("#ced4da")).toEqual(false);
  });
});

describe("shortcut display labels", () => {
  it("should use layout-neutral labels for position-based shortcuts", () => {
    expect(getShortcutFromShortcutName("gridMode")).toBe(
      getShortcutKey("CtrlOrCmd+Quote"),
    );
    expect(getShortcutFromShortcutName("stats")).toBe(
      getShortcutKey("Alt+Slash"),
    );
    expect(getShortcutFromShortcutName("sendBackward")).toBe(
      getShortcutKey("CtrlOrCmd+Left bracket"),
    );
    expect(getShortcutFromShortcutName("bringForward")).toBe(
      getShortcutKey("CtrlOrCmd+Right bracket"),
    );
    expect(getShortcutFromShortcutName("sendToBack")).toBe(
      isDarwin
        ? getShortcutKey("CtrlOrCmd+Alt+Left bracket")
        : getShortcutKey("CtrlOrCmd+Shift+Left bracket"),
    );
    expect(getShortcutFromShortcutName("bringToFront")).toBe(
      isDarwin
        ? getShortcutKey("CtrlOrCmd+Alt+Right bracket")
        : getShortcutKey("CtrlOrCmd+Shift+Right bracket"),
    );
  });
});
