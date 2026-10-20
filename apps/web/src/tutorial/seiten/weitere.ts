import type { SeitenEintrag } from "./typen";
export const WEITERE: readonly SeitenEintrag[] = [
  {
    id: "output",
    pfade: ["/output"],
    titelKey: "nav.output",
    ziel: "main h1",
  },
  {
    id: "graph",
    pfade: ["/graph"],
    titelKey: "nav.graph",
    ziel: "main h1",
  },
  {
    id: "kapital",
    pfade: ["/kapital"],
    titelKey: "nav.capital",
    ziel: "main h1",
  },
];
