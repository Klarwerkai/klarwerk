// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0216) · OFFENER WIDERSPRUCH → „IN PRÜFUNG", IN BIBLIOTHEK UND ANTWORTEN.
// ================================================================================================
//
// Zielzustand: „Ein Wissensobjekt mit offenem Widerspruch erscheint nicht mehr als uneingeschränkt
// nutzbar, sondern als ‚in Prüfung' — in der Detailansicht, in der Bibliothek und in Antworten
// gleichermaßen."
//
// ZWEI WEGE, AUF DENEN DER KONFLIKT ANKOMMT, und beide müssen dieselbe Wirkung haben:
//   · die Konfliktliste der Fläche (`useConflicts` → `conflictLimitedUsability`, SCRUM-357);
//   · seit R-0212 der Anzeigestatus des Servers (`anzeigestatus: "konflikt"`).
// Diese Datei prüft Bibliothek (Reife/Facette) und Antworten (Quellen-Nutzbarkeit); die montierte
// Detailansicht prüft `r0216-detail.test.tsx`. Die Wortwahl ist überall `use.review.label`.
//
// ABGRENZUNG ZU R-1003: das STATUSWORT bleibt „Konflikt" (einer der sieben Anzeigezustände). „In
// Prüfung" ist die NUTZBARKEIT — die Antwort auf „kann ich das verwenden?". Beides steht da.
import { describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";
import {
  conflictImpact,
  conflictLimitedUsability,
  effectiveUsability,
} from "../../apps/web/src/lib/conflictImpact";
import {
  type FacetValues,
  applyFacetSelection,
  combinableFacetCounts,
} from "../../apps/web/src/lib/facets";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { libraryFilterValues } from "../../apps/web/src/lib/libraryFacets";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ANZEIGESTATUS_LISTE_DECKEL } from "../../services/app/src/routes/ko-routes";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "k1",
    title: "Ventil X bei Überdruck schließen",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as KnowledgeObject;
}

const OFFENER_KONFLIKT = {
  id: "c1",
  koA: "k1",
  koB: "k9",
  type: "truth",
  status: "offen",
} as unknown as Conflict;

const label = (usability: Parameters<typeof useReadiness>[0]): string =>
  i18n.t(useReadiness(usability).labelKey, { lng: "de" }) as string;

describe("R-0216 · validiert + offener Widerspruch ist nicht mehr „nutzbar“", () => {
  it("Kalibrierung: ohne Konflikt ist ein validiertes Objekt nutzbar", () => {
    expect(libraryMaturity(ko({})).usability).toBe("ready");
    expect(conflictAwareSourceRefs(["k1"], [ko({})], [])[0]?.usability).toBe("ready");
  });

  it("Bibliothek, Konflikt vom SERVER: Reife „In Prüfung“", () => {
    const k = ko({ anzeigestatus: "konflikt" });
    expect(koOverview(k).usability).toBe("in-review");
    expect(libraryMaturity(k).usability).toBe("in-review");
    expect(label(libraryMaturity(k).usability)).toBe("In Prüfung");
  });

  it("Antworten, Konflikt vom SERVER: die Quelle ist „In Prüfung“", () => {
    const [ref] = conflictAwareSourceRefs(["k1"], [ko({ anzeigestatus: "konflikt" })], []);
    expect(ref?.usability).toBe("in-review");
  });

  it("Antworten, Konflikt aus der KONFLIKTLISTE der Fläche: dieselbe Wirkung", () => {
    const [ref] = conflictAwareSourceRefs(["k1"], [ko({})], [OFFENER_KONFLIKT]);
    expect(ref?.usability).toBe("in-review");
    expect(ref?.conflictLimited).toBe(true);
  });

  // Ben R3, BEN-07: der ECHTE Wahrheitswiderspruch setzt den Kern auf `offen` zurück (R-0231). Bis
  // hierher stand an dieser Stelle „offen + Konflikt bleibt zu prüfen" — genau die Annahme, die
  // Bens Gegenprobe widerlegt hat. Der reale Ablauf über die Produkt-Routen steht in
  // `r0216-echter-konflikt-gegenprobe.test.ts`; hier die reine Ableitung derselben Lage.
  it("offen/87 + Konflikt (der reale Zustand nach R-0231): überall „In Prüfung“", () => {
    const k = ko({ status: "offen", trust: 87, confidence: 87, anzeigestatus: "konflikt" });
    expect(koOverview(k).usability).toBe("in-review");
    expect(libraryMaturity(k).usability).toBe("in-review");
    expect(conflictAwareSourceRefs(["k1"], [k], [OFFENER_KONFLIKT])[0]?.usability).toBe(
      "in-review",
    );
    expect(label(koOverview(k).usability)).toBe("In Prüfung");
  });

  it("Gegenprobe: offen OHNE Konflikt bleibt „Zu prüfen“", () => {
    const k = ko({ status: "offen", trust: 0, confidence: 0, anzeigestatus: "offen" });
    expect(koOverview(k).usability).toBe("needs-work");
  });

  // Ben (Nacharbeit 1), Befund zu conflictImpact.ts:78: der Konflikt ist NUR separat bekannt (die
  // Konfliktliste der Fläche), der Serverstatus sagt `offen` — so liefert ihn der Lesepfad oberhalb
  // des Listendeckels oder nach gescheiterter Konflikterhebung. Bis hierher blieb das „Zu prüfen“,
  // weil `conflictLimitedUsability` nur „ready“ begrenzte.
  it("offen/87, Status offen, Konflikt nur separat bekannt: „In Prüfung“", () => {
    const k = ko({ status: "offen", trust: 87, confidence: 87, anzeigestatus: "offen" });
    const impact = conflictImpact("k1", [OFFENER_KONFLIKT]);
    expect(impact.limited).toBe(true);
    // Detail (MehrAbschnitte: seit R-1349 `effectiveUsability`, dieselbe Verkettung wie hier)
    expect(conflictLimitedUsability(koOverview(k).usability, impact)).toBe("in-review");
    expect(effectiveUsability(k, [OFFENER_KONFLIKT])).toBe("in-review");
    // Antwort (askView)
    const [ref] = conflictAwareSourceRefs(["k1"], [k], [OFFENER_KONFLIKT]);
    expect(ref?.usability).toBe("in-review");
    expect(label(effectiveUsability(k, [OFFENER_KONFLIKT]))).toBe("In Prüfung");
  });

  it("Kontrolle: offen ohne wirksamen Konflikt bleibt „Zu prüfen“", () => {
    const k = ko({ status: "offen", trust: 0, confidence: 0, anzeigestatus: "offen" });
    expect(effectiveUsability(k, [])).toBe("needs-work");
    const geloest = { ...OFFENER_KONFLIKT, status: "geloest" } as unknown as Conflict;
    expect(effectiveUsability(k, [geloest])).toBe("needs-work");
    expect(conflictAwareSourceRefs(["k1"], [k], [geloest])[0]?.usability).toBe("needs-work");
    // Ein Konflikt an einem ANDEREN Objekt wirkt hier nicht.
    const fremd = { ...OFFENER_KONFLIKT, koA: "k7", koB: "k8" } as unknown as Conflict;
    expect(effectiveUsability(k, [fremd])).toBe("needs-work");
  });
});

// ================================================================================================
// Ben (Nacharbeit 1): DER REALE WEG OBERHALB DES LISTENDECKELS — Antworten von /api/kos UND
// /api/conflicts gemeinsam ausgewertet, über die unveränderten Produkt-Routen (Fastify-Injection).
// ================================================================================================
//
// Oberhalb von ANZEIGESTATUS_LISTE_DECKEL erhebt `GET /api/kos` den Konflikt nicht (benannter
// Deckelgrund, `ko-routes.ts`); das zurückgesetzte Objekt kommt als `offen` an. Die Konfliktliste
// kennt den Widerspruch trotzdem — und genau diese Kombination muss „In Prüfung“ ergeben.
describe("R-0216 · Listenweg oberhalb des Deckels: /api/kos + /api/conflicts", () => {
  it("validiert/99 → Widerspruch → offen/87, >200 Einträge: „In Prüfung“", async () => {
    const services = buildServices();
    const app = buildApp(services);
    try {
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: {
          name: "Deckel Test",
          email: "deckel@probe.test",
          password: "test-only-password",
        },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "deckel@probe.test", password: "test-only-password" },
      });
      expect(login.statusCode).toBe(200);
      const headers = { authorization: `Bearer ${login.json().token}` };
      const anlegen = async (title: string): Promise<string> => {
        const r = await app.inject({
          method: "POST",
          url: "/api/kos",
          headers,
          payload: {
            title,
            statement: title,
            confidentiality: "intern",
            type: "best_practice",
            category: "Test",
            neededValidations: 1,
          },
        });
        expect(r.statusCode).toBe(201);
        return r.json().id as string;
      };
      const a = await anlegen("Vor der Wartung Druck ablassen");
      const b = await anlegen("Während der Wartung Druck beibehalten");
      const kontrolle = await anlegen("Konfliktfreie offene Kontrolle");
      const rate = await app.inject({
        method: "PUT",
        url: `/api/kos/${a}`,
        headers,
        payload: { action: "rate", verdict: "up" },
      });
      expect(rate.statusCode).toBe(200);
      const konflikt = await app.inject({
        method: "PUT",
        url: `/api/kos/${a}`,
        headers,
        payload: {
          action: "conflict",
          conflict: { koA: a, koB: b, type: "truth", description: "Widerspruch zur Wartung" },
        },
      });
      expect(konflikt.statusCode).toBe(201);
      // Bestand über den Deckel heben — direkt am Dienst, ohne Prüflauf je Objekt.
      for (let i = 0; i < ANZEIGESTATUS_LISTE_DECKEL; i += 1) {
        await services.ko.create({
          title: `Füllobjekt ${i}`,
          statement: `Kerntext ${i}.`,
          type: "best_practice",
          category: "Test",
          author: "u-fuell",
        });
      }

      const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
      expect(liste.statusCode).toBe(200);
      const kos = liste.json() as KnowledgeObject[];
      expect(kos.length).toBeGreaterThan(ANZEIGESTATUS_LISTE_DECKEL);
      const konfliktAntwort = await app.inject({
        method: "GET",
        url: "/api/conflicts",
        headers,
      });
      expect(konfliktAntwort.statusCode).toBe(200);
      const konflikte = konfliktAntwort.json() as Conflict[];

      const zielA = kos.find((k) => k.id === a) as KnowledgeObject;
      const zielKontrolle = kos.find((k) => k.id === kontrolle) as KnowledgeObject;
      // Kalibrierung: die Liste meldet den Konflikt hier NICHT (Deckel), der Kern ist zurückgesetzt.
      expect(zielA.status).toBe("offen");
      expect(zielA.trust).toBe(87);
      expect(zielA.anzeigestatus).not.toBe("konflikt");
      expect(konflikte.some((c) => c.koA === a && c.koB === b)).toBe(true);

      // Detail- und Antwortweg mit den tatsächlichen Antworten:
      expect(effectiveUsability(zielA, konflikte)).toBe("in-review");
      const [refA, refKontrolle] = conflictAwareSourceRefs([a, kontrolle], kos, konflikte);
      expect(refA?.usability).toBe("in-review");
      expect(label(effectiveUsability(zielA, konflikte))).toBe("In Prüfung");
      // Kontrolle: das konfliktfreie offene Objekt bleibt „Zu prüfen“.
      expect(effectiveUsability(zielKontrolle, konflikte)).toBe("needs-work");
      expect(refKontrolle?.usability).toBe("needs-work");

      // Ben (Nacharbeit 3): DER TATSÄCHLICHE BIBLIOTHEKSFILTER — dieselbe Ableitung, die
      // `BibliothekFlaeche` für Zähler und Filter benutzt (`libraryFilterValues` mit der
      // Konfliktliste der Fläche), dieselben Zähl-/Filterfunktionen (`combinableFacetCounts`,
      // `applyFacetSelection`).
      const jetzt = Date.now();
      const werte = new Map(kos.map((k) => [k.id, libraryFilterValues(k, jetzt, konflikte)]));
      const werteVon = (k: KnowledgeObject): FacetValues => werte.get(k.id) ?? {};
      expect(werteVon(zielA).maturity).toEqual(["in-review"]);
      expect(werteVon(zielKontrolle).maturity).toEqual(["needs-work"]);
      const inPruefung = applyFacetSelection(kos, werteVon, { maturity: ["in-review"] });
      const zuPruefen = applyFacetSelection(kos, werteVon, { maturity: ["needs-work"] });
      expect(inPruefung.map((k) => k.id)).toContain(a);
      expect(inPruefung.map((k) => k.id)).not.toContain(kontrolle);
      expect(zuPruefen.map((k) => k.id)).toContain(kontrolle);
      expect(zuPruefen.map((k) => k.id)).not.toContain(a);
      const zaehler = combinableFacetCounts([...werte.values()], ["maturity"], {}).maturity ?? [];
      const anzahl = (wert: string) => zaehler.find((z) => z.value === wert)?.count ?? 0;
      // Zähler und Filter sagen dasselbe.
      expect(anzahl("in-review")).toBe(inPruefung.length);
      expect(anzahl("needs-work")).toBe(zuPruefen.length);
      // Kalibrierung: OHNE Konfliktliste (die alte Ableitung) läge `a` unter „Zu prüfen“.
      expect(libraryFilterValues(zielA, jetzt).maturity).toEqual(["needs-work"]);
    } finally {
      await app.close();
    }
  }, 60_000);
});
