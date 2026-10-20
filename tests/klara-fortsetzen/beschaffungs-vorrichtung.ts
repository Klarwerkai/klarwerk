import { expect } from "vitest";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { type App, draht } from "./vorrichtung";
export async function beschaffung(
  app: App,
  token: string,
  quelle = "getippt",
  werte: Record<string, unknown> = {},
) {
  const g = await draht(app, token)("POST", "/api/me/klara/gespraeche", {
    objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "Fiktive BES-Vorbereitung" },
  });
  expect(g.statusCode, g.body).toBe(201);
  const gid = g.json().gespraech.id as string;
  const v = { gid, basis: `/api/me/klara/gespraeche/${gid}/auftraege` };
  const ziele = ["Anforderung für PX-17", "Anfrage für PX-17"].map((titel) => ({
    art: "neuer_entwurf",
    id: null,
    titel,
    stand: null,
    pfad: null,
  }));
  const b = {
    produkt: "PX-17",
    bedarf: "Neue Angebote für Verpackung",
    menge: "500 Stück",
    termin: "2035-11-30",
    empfaengerVorschlaege: ["Fiktiver Lieferant X"],
    erlaubteEmpfaenger: [],
    quellen: [],
    aussenwirkung: "keine",
    ...werte,
  };
  const body = {
    quelle,
    wortlaut:
      "Besorge neue Angebote für die Verpackung von Produkt „PX-17“ für 500 Stück bis 2035-11-30",
    ziel: "Interne Vorbereitung",
    erlaubteAktionen: ["entwurf_erstellen"],
    erlaubteZiele: ziele,
    erlaubteQuellen: [
      "Eigener ausdrücklicher Auftrag",
      ...(b.quellen as { id: string }[]).map((q) => `ko:${q.id}`),
    ],
    ergebnis: "Zwei interne Entwürfe; keine Außenwirkung",
    geplanteSchritte: 2,
    plan: ziele.map((ziel) => ({ aktion: "entwurf_erstellen", ziel, ausSchritt: null })),
    beschaffung: b,
  };
  const auf = draht(app, token);
  const r = await auf("POST", v.basis, body);
  expect(r.statusCode, r.body).toBe(201);
  const a = r.json().auftrag as KlaraAuftrag;
  const pfad = `${v.basis}/${a.id}`;
  return {
    ...v,
    a,
    pfad,
    body,
    b,
    aus: (nr: number, fassung = 1) =>
      auf("POST", `${pfad}/schritte/bes-${nr}/ausfuehrung`, { nr, auftragFassung: fassung }),
    lese: async () =>
      (await auf("GET", v.basis))
        .json()
        .auftraege.find((x: KlaraAuftrag) => x.id === a.id) as KlaraAuftrag,
  };
}
