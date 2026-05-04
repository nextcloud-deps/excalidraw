import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { serializeLibraryAsJSON } from "../data/json";
import { t } from "../i18n";
import type {
  ExcalidrawProps,
  LibraryItem,
  LibraryItems,
  TaggedLibraryItem,
  UIAppState,
} from "../types";
import { arrayToMap } from "../utils";
import Stack from "./Stack";
import { MIME_TYPES } from "../constants";
import Spinner from "./Spinner";
import { duplicateElements } from "../element/newElement";
import { LibraryMenuControlButtons } from "./LibraryMenuControlButtons";
import { LibraryDropdownMenu } from "./LibraryMenuHeaderContent";
import {
  LibraryMenuSection,
  LibraryMenuSectionGrid,
} from "./LibraryMenuSection";
import { useScrollPosition } from "../hooks/useScrollPosition";
import { useLibraryCache } from "../hooks/useLibraryItemSvg";

import "./LibraryMenuItems.scss";

// using an odd number of items per batch so the rendering creates an irregular
// pattern which looks more organic
const ITEMS_RENDERED_PER_BATCH = 17;
// when render outputs cached we can render many more items per batch to
// speed it up
const CACHED_ITEMS_RENDERED_PER_BATCH = 64;

// Items belonging to a read-only source (a saved or organization library)
// carry a `libraryName`. Items without one belong to the writable "My library".
const getLibraryName = (item: LibraryItem): string | undefined =>
  (item as TaggedLibraryItem).libraryName || undefined;

export default function LibraryMenuItems({
  isLoading,
  libraryItems,
  onAddToLibrary,
  onInsertLibraryItems,
  pendingElements,
  theme,
  id,
  libraryReturnUrl,
  onSelectItems,
  selectedItems,
  libraryMenuTitle,
  libraryMenuDescription,
}: {
  isLoading: boolean;
  libraryItems: LibraryItems;
  pendingElements: LibraryItem["elements"];
  onInsertLibraryItems: (libraryItems: LibraryItems) => void;
  onAddToLibrary: (elements: LibraryItem["elements"]) => void;
  libraryReturnUrl: ExcalidrawProps["libraryReturnUrl"];
  theme: UIAppState["theme"];
  id: string;
  selectedItems: LibraryItem["id"][];
  onSelectItems: (id: LibraryItem["id"][]) => void;
  libraryMenuTitle: ExcalidrawProps["libraryMenuTitle"];
  libraryMenuDescription: ExcalidrawProps["libraryMenuDescription"];
}) {
  const libraryContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useScrollPosition<HTMLDivElement>(libraryContainerRef);

  // This effect has to be called only on first render, therefore  `scrollPosition` isn't in the dependency array
  useEffect(() => {
    if (scrollPosition > 0) {
      libraryContainerRef.current?.scrollTo(0, scrollPosition);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { svgCache } = useLibraryCache();

  const isLibraryEmpty = !libraryItems.length && !pendingElements.length;
  const hasCustomLibraryMenuHeader = !!(
    libraryMenuTitle || libraryMenuDescription
  );

  // Writable "My library" items (no source tag).
  const personalItems = useMemo(
    () => libraryItems.filter((item) => !getLibraryName(item)),
    [libraryItems],
  );

  // Read-only sources (saved libraries, organization libraries), grouped by name.
  const readonlySections = useMemo(() => {
    const byName = new Map<string, LibraryItem[]>();
    for (const item of libraryItems) {
      const name = getLibraryName(item);
      if (!name) {
        continue;
      }
      const bucket = byName.get(name);
      if (bucket) {
        bucket.push(item);
      } else {
        byName.set(name, [item]);
      }
    }
    return [...byName.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, items]) => ({ name, items }));
  }, [libraryItems]);

  const hasPrivateLibraryItems =
    pendingElements.length > 0 || personalItems.length > 0;

  const [lastSelectedItem, setLastSelectedItem] = useState<
    LibraryItem["id"] | null
  >(null);

  const onItemSelectToggle = useCallback(
    (id: LibraryItem["id"], event: React.MouseEvent) => {
      const shouldSelect = !selectedItems.includes(id);

      // selection (and thus deletion / publishing) only applies to the writable
      // "My library" items.
      const orderedItems = personalItems;

      if (shouldSelect) {
        if (event.shiftKey && lastSelectedItem) {
          const rangeStart = orderedItems.findIndex(
            (item) => item.id === lastSelectedItem,
          );
          const rangeEnd = orderedItems.findIndex((item) => item.id === id);

          if (rangeStart === -1 || rangeEnd === -1) {
            onSelectItems([...selectedItems, id]);
            return;
          }

          const selectedItemsMap = arrayToMap(selectedItems);
          const nextSelectedIds = orderedItems.reduce(
            (acc: LibraryItem["id"][], item, idx) => {
              if (
                (idx >= rangeStart && idx <= rangeEnd) ||
                selectedItemsMap.has(item.id)
              ) {
                acc.push(item.id);
              }
              return acc;
            },
            [],
          );

          onSelectItems(nextSelectedIds);
        } else {
          onSelectItems([...selectedItems, id]);
        }
        setLastSelectedItem(id);
      } else {
        setLastSelectedItem(null);
        onSelectItems(selectedItems.filter((_id) => _id !== id));
      }
    },
    [lastSelectedItem, onSelectItems, personalItems, selectedItems],
  );

  const getInsertedElements = useCallback(
    (id: string) => {
      let targetElements;
      if (selectedItems.includes(id)) {
        targetElements = libraryItems.filter((item) =>
          selectedItems.includes(item.id),
        );
      } else {
        targetElements = libraryItems.filter((item) => item.id === id);
      }
      return targetElements.map((item) => {
        return {
          ...item,
          // duplicate each library item before inserting on canvas to confine
          // ids and bindings to each library item. See #6465
          elements: duplicateElements(item.elements, { randomizeSeed: true }),
        };
      });
    },
    [libraryItems, selectedItems],
  );

  const onItemDrag = useCallback(
    (id: LibraryItem["id"], event: React.DragEvent) => {
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlib,
        serializeLibraryAsJSON(getInsertedElements(id)),
      );
    },
    [getInsertedElements],
  );

  const isItemSelected = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (!id) {
        return false;
      }

      return selectedItems.includes(id);
    },
    [selectedItems],
  );

  // Read-only section items can be inserted and dragged, but never selected
  // (selection drives delete/publish, which only apply to writable items).
  const noSelectToggle = useCallback(() => {}, []);
  const neverSelected = useCallback(() => false, []);

  const onAddToLibraryClick = useCallback(() => {
    onAddToLibrary(pendingElements);
  }, [pendingElements, onAddToLibrary]);

  const onItemClick = useCallback(
    (id: LibraryItem["id"] | null) => {
      if (id) {
        onInsertLibraryItems(getInsertedElements(id));
      }
    },
    [getInsertedElements, onInsertLibraryItems],
  );

  const itemsRenderedPerBatch =
    svgCache.size >= libraryItems.length
      ? CACHED_ITEMS_RENDERED_PER_BATCH
      : ITEMS_RENDERED_PER_BATCH;

  return (
    <div
      className="library-menu-items-container"
      style={
        pendingElements.length || libraryItems.length
          ? { justifyContent: "flex-start" }
          : { borderBottom: 0 }
      }
    >
      {!isLibraryEmpty && (
        <LibraryDropdownMenu
          selectedItems={selectedItems}
          onSelectItems={onSelectItems}
          className="library-menu-dropdown-container--in-heading"
        />
      )}
      <Stack.Col
        className="library-menu-items-container__items"
        align="start"
        gap={1}
        style={{
          flex: readonlySections.length > 0 ? 1 : "0 1 auto",
          marginBottom: 0,
        }}
        ref={libraryContainerRef}
      >
        <>
          {(!isLibraryEmpty || hasCustomLibraryMenuHeader) && (
            <div
              className={clsx("library-menu-items-container__header", {
                "library-menu-items-container__header--stacked":
                  !!libraryMenuDescription,
              })}
            >
              <span>{libraryMenuTitle || t("labels.personalLib")}</span>
              {libraryMenuDescription && (
                <span className="library-menu-items-container__header__description">
                  {libraryMenuDescription}
                </span>
              )}
            </div>
          )}
          {isLoading && (
            <div
              style={{
                position: "absolute",
                top: "var(--container-padding-y)",
                right: "var(--container-padding-x)",
                transform: "translateY(50%)",
              }}
            >
              <Spinner />
            </div>
          )}
          {!hasPrivateLibraryItems && !readonlySections.length ? (
            <div className="library-menu-items__no-items">
              <div className="library-menu-items__no-items__label">
                {t("library.noItems")}
              </div>
              <div className="library-menu-items__no-items__hint">
                {t("library.hint_emptyLibrary")}
              </div>
            </div>
          ) : (
            <LibraryMenuSectionGrid>
              {pendingElements.length > 0 && (
                <LibraryMenuSection
                  itemsRenderedPerBatch={itemsRenderedPerBatch}
                  items={[{ id: null, elements: pendingElements }]}
                  onItemSelectToggle={onItemSelectToggle}
                  onItemDrag={onItemDrag}
                  onClick={onAddToLibraryClick}
                  isItemSelected={isItemSelected}
                  svgCache={svgCache}
                />
              )}
              <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={personalItems}
                onItemSelectToggle={onItemSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={isItemSelected}
                svgCache={svgCache}
              />
            </LibraryMenuSectionGrid>
          )}
        </>

        {readonlySections.map((section) => (
          <React.Fragment key={section.name}>
            <div
              className="library-menu-items-container__header"
              style={{ marginTop: "0.75rem" }}
            >
              {section.name}
            </div>
            <LibraryMenuSectionGrid>
              <LibraryMenuSection
                itemsRenderedPerBatch={itemsRenderedPerBatch}
                items={section.items}
                onItemSelectToggle={noSelectToggle}
                onItemDrag={onItemDrag}
                onClick={onItemClick}
                isItemSelected={neverSelected}
                svgCache={svgCache}
              />
            </LibraryMenuSectionGrid>
          </React.Fragment>
        ))}

        {isLibraryEmpty && (
          <LibraryMenuControlButtons
            style={{ padding: "16px 0", width: "100%" }}
            id={id}
            libraryReturnUrl={libraryReturnUrl}
            theme={theme}
          >
            <LibraryDropdownMenu
              selectedItems={selectedItems}
              onSelectItems={onSelectItems}
            />
          </LibraryMenuControlButtons>
        )}
      </Stack.Col>
    </div>
  );
}
