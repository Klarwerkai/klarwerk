import { expect, it } from "vitest";
import {
  LIBRARY_SAVED_VIEW_DIMENSIONS,
  readLibrarySavedViewState,
} from "../../apps/web/src/lib/librarySavedViewState";

// Der Node-Test bindet die Deklaration auch an den Root-Typecheck (tsx wird dort ausgeschlossen).
it("UX-29 C · der Hinweis deckt genau die wiederhergestellten Zustandsfelder", () => {
  expect(Object.keys(LIBRARY_SAVED_VIEW_DIMENSIONS).sort()).toEqual(
    Object.keys(readLibrarySavedViewState({}, [])).sort(),
  );
});
