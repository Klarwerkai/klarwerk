// Reiner, DOM-freier Query-Builder für die Bibliothekssuche (SCRUM-134 / FE-LIB-01).
// Bewusst ohne Import aus `api/endpoints`/`api/client`, damit dieses Modul (und
// sein Test) den API-Client nicht in den Node-/Root-Typecheck zieht.

export interface LibraryFilterState {
  q: string;
  type: string;
  status: string;
  category: string;
  tag: string;
}

export const EMPTY_LIBRARY_FILTER: LibraryFilterState = {
  q: "",
  type: "",
  status: "",
  category: "",
  tag: "",
};

// Querystring-Parameter für GET /api/library/search?q=&type=&status=&category=&tag=
// Strukturell kompatibel zu KoFilter & { q?: string }.
export interface LibraryQuery {
  q?: string;
  type?: string;
  status?: string;
  category?: string;
  tag?: string;
}

// Baut die Server-Query aus dem UI-Zustand: trimmt Volltext, lässt leere Felder weg.
export function buildLibraryQuery(state: LibraryFilterState): LibraryQuery {
  const out: LibraryQuery = {};
  const q = state.q.trim();
  if (q) {
    out.q = q;
  }
  if (state.type) {
    out.type = state.type;
  }
  if (state.status) {
    out.status = state.status;
  }
  if (state.category) {
    out.category = state.category;
  }
  if (state.tag) {
    out.tag = state.tag;
  }
  return out;
}
