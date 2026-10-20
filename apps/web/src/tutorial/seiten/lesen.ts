import type { SeitenEintrag } from "./typen";
export const LESEN: readonly SeitenEintrag[] = [
  {
    id: "start",
    pfade: ["/start"],
    titelKey: "nav.start",
    ziel: '[data-testid="page-start"]',
  },
  {
    id: "bibliothek",
    pfade: ["/bibliothek"],
    titelKey: "nav.library",
    ziel: '[data-testid="bib-suchfeld"]',
  },
  {
    id: "artikel",
    pfade: ["/wissen/:id"],
    titelKey: "seitenhilfe.wissen.title",
    ziel: '[data-testid="bib-lesen"][data-objekt="wissen"]',
  },
  {
    id: "wissensnetz",
    pfade: ["/wissensnetz"],
    titelKey: "nav.wissensnetz",
    ziel: '[data-testid="themenkarte"]',
  },
  {
    id: "extern",
    pfade: ["/extern"],
    titelKey: "nav.external",
    ziel: "main h1",
  },
  {
    id: "dokumentfragen",
    pfade: ["/fragen/dokument"],
    titelKey: "dokumentfragen.titel",
    ziel: '[data-testid="dokumentfragen-datei"]',
  },
  {
    id: "begriffe",
    pfade: ["/begriffe"],
    titelKey: "begriffe.seite.titel",
    ziel: '[data-testid="begriffe-suche"]',
  },
  {
    id: "livewall",
    pfade: ["/livewall"],
    titelKey: "start.livewall.title",
    ziel: "main h1",
  },
];
