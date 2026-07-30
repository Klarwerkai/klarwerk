// ================================================================================================
// AUFTRAG-mega62 BLOCK H — DER EINE WEG VOM VERZEICHNIS ZUM ANGEZEIGTEN NAMEN.
// ================================================================================================
//
// Bis mega61 stand in SECHS Seiten (Bibliothek, Objektdetail, Aufgaben, Fragen, Risiko,
// Validierung) dieselbe dreizeilige Auflösung, wörtlich abgeschrieben:
//
//     const nameOf = (uid) => authorDisplayName(uid, dir.data?.find(d => d.id === uid)?.name, …)
//
// Genau in diesen drei Zeilen sass der Fehler aus Register A22 — `dir.data` kann `undefined` sein
// (Abfrage läuft noch ODER ist fehlgeschlagen), und dann sagte jede der sechs Flächen „Unbekannte
// Person" über jeden Autor. Sechsmal derselbe Satz heisst: sechsmal derselbe Fehler, und wer eine
// siebte Fläche baut, schreibt ihn ein siebtes Mal ab.
//
// Deshalb steht der Weg jetzt EINMAL hier. Die Entscheidung selbst (drei Zustände) liegt DOM-frei
// in lib/koAuthor.ts und ist dort ohne React prüfbar; dieser Haken verbindet sie nur mit der
// Abfrage und dem Wörterbuch.
import { useTranslation } from "react-i18next";
import { useDirectory } from "../api/hooks";
import {
  AUTHOR_LOADING_KEY,
  AUTHOR_UNAVAILABLE_KEY,
  AUTHOR_UNKNOWN_KEY,
  type NameResolver,
  makeAuthorNameResolver,
} from "./koAuthor";

export function useAuthorName(): NameResolver {
  const { t } = useTranslation();
  const directory = useDirectory();
  // AUFTRAG-mega63 Block B: der VOLLE Abfragezustand geht weiter, nicht nur `data`. Vorher fielen
  // „läuft noch" und „fehlgeschlagen" hier zusammen, weil beide `data === undefined` bedeuten —
  // die Unterscheidung war schon da (api/hooks.ts), sie wurde nur an dieser Zeile weggeworfen.
  return makeAuthorNameResolver(
    { data: directory.data, isPending: directory.isPending, isError: directory.isError },
    {
      unknown: (ref) => t(AUTHOR_UNKNOWN_KEY, { ref }),
      loading: () => t(AUTHOR_LOADING_KEY),
      unavailable: () => t(AUTHOR_UNAVAILABLE_KEY),
    },
  );
}
