// @vitest-environment jsdom
// ================================================================================================
// JOB 4333 · ENTWURF-MOBIL-DESKTOP-R — DIE DREI ANTWORTEN UND DIE EINE ZAHL.
// ================================================================================================
//
// Hier steht der RAHMENFREIE Teil dieses Auftrags: die reine Sitzungslogik, der Gerätebestand, die
// drei Sprachen und der Wächter über den Speicherschlüssel. Er braucht kein React und keine
// Anwendung — jsdom nur wegen `localStorage`.
//
// DER GEMOUNTETE TEIL (der Torwächter, die Fläche, die Sichtbarkeitskalibrierungen) wohnt in
// `apps/web/src/app/job4333-offline-neuladen.test.tsx` und NICHT hier. Der Grund ist ein Wächter
// des Hauses: `tests/legal/mega61-rechtsseiten.test.tsx` verbietet, dass ein Test unter `tests/**`
// `apps/web/src/App` importiert — das zöge über `routes.tsx` die ganze Anwendung in den
// WURZEL-Typprüfer, der dafür nicht eingerichtet ist. Gemountete Torwächter-Tests wohnen deshalb
// unter `apps/web/src/**`, wie `apps/web/src/legal/mega61-rechtsseiten.test.tsx`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  OFFLINE_WARTESCHLANGE_SCHLUESSEL,
  offeneVorgaengeAmGeraet,
  resolveSitzungslage,
} from "../../apps/web/src/lib/sessionState";

/** Ein Vorgang, wie ihn `useOfflineQueue` offline anlegt und persistiert (JOB 4249: mit Eigentümer). */
const VORGANG = {
  id: "op-4333-a",
  kind: "draft.create",
  draftId: null,
  payload: { title: "Unterwegs an der Anlage erfasst", statement: "Ohne Netz getippt." },
  status: "queued",
  error: null,
  createdAt: "2026-09-17T06:00:00.000Z",
  title: "Unterwegs an der Anlage erfasst",
  eigentuemer: "konto-a",
};

beforeEach(() => {
  localStorage.clear();
});

describe("JOB 4333: die Sitzungsfrage hat drei Antworten", () => {
  it("bestätigt · beantwortet ohne Sitzung · unbeantwortet", () => {
    expect(resolveSitzungslage({ user: { id: "u1" }, ohneAntwort: false })).toBe("bestaetigt");
    // Eine bestehende Sitzung kippt NICHT in die Wissenslücke, nur weil eine spätere Auffrischung
    // am Transport gescheitert ist.
    expect(resolveSitzungslage({ user: { id: "u1" }, ohneAntwort: true })).toBe("bestaetigt");
    expect(resolveSitzungslage({ user: null, ohneAntwort: false })).toBe("keineSitzung");
    expect(resolveSitzungslage({ user: null, ohneAntwort: true })).toBe("unbeantwortet");
    expect(resolveSitzungslage({ user: undefined, ohneAntwort: true })).toBe("unbeantwortet");
  });

  it("der Gerätebestand zählt alles, was nicht übertragen ist — und verschluckt keinen Schrott", () => {
    expect(offeneVorgaengeAmGeraet()).toBe(0);
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, "kein json");
    expect(offeneVorgaengeAmGeraet()).toBe(0);
    localStorage.setItem(OFFLINE_WARTESCHLANGE_SCHLUESSEL, JSON.stringify({ nicht: "liste" }));
    expect(offeneVorgaengeAmGeraet()).toBe(0);
    localStorage.setItem(
      OFFLINE_WARTESCHLANGE_SCHLUESSEL,
      JSON.stringify([
        VORGANG,
        { ...VORGANG, id: "op-2", status: "failed" },
        // `synced` ist übertragen und zählt nicht mit — dieselbe Regel wie `pendingCount`.
        { ...VORGANG, id: "op-3", status: "synced" },
      ]),
    );
    expect(offeneVorgaengeAmGeraet()).toBe(2);
  });

  // ==============================================================================================
  // LIEFERUNG 4 — DER EHRLICHE SATZ STEHT IN DREI SPRACHEN DA, UND JEDE SAGT ETWAS.
  // ==============================================================================================
  //
  // Die reine Schlüsselparität prüft `tests/i18n/nl-completeness.test.ts` für den GESAMTEN Bestand.
  // Hier wird gemessen, was jene Parität nicht sieht: dass die drei Werte auch wirklich DREI Sätze
  // sind und nicht dreimal der deutsche (eine leere Übersetzung fiele dort auf, eine abgeschriebene
  // nicht).
  it("der neue Satz steht in DE, EN und NL — und in drei Fassungen", () => {
    const schluessel = ["mob.sitzung.unbeantwortet"];
    const sprachen = ["de", "en", "nl"];
    for (const k of schluessel) {
      const werte = sprachen.map((s) => i18n.getFixedT(s)(k));
      for (const [i, wert] of werte.entries()) {
        expect(wert, `${k} fehlt in ${sprachen[i]}`).not.toBe(k);
        expect(wert.length, `${k} ist in ${sprachen[i]} leer`).toBeGreaterThan(40);
      }
      expect(new Set(werte).size, `${k} ist nicht wirklich übersetzt`).toBe(3);
    }
  });

  // ==============================================================================================
  // DER WÄCHTER GEGEN ZWEI WAHRHEITEN ÜBER DENSELBEN SPEICHERPLATZ.
  // ==============================================================================================
  //
  // `app/useOfflineQueue.ts` ist der EINZIGE Schreiber der Warteschlange und hält den Schlüssel
  // bewusst privat (er ist dort nicht exportiert). Dieser Auftrag darf die Datei nicht anfassen
  // (Zielpfade), braucht den Namen aber lesend — also steht er ein zweites Mal da. Dass daraus
  // keine zweite Wahrheit werden kann, hält dieser Wächter fest: laufen die beiden Zeichenketten
  // auseinander, wird er rot und nennt beide.
  it("der Speicherschlüssel ist wörtlich derselbe wie in useOfflineQueue.ts", () => {
    const quelle = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/useOfflineQueue.ts"),
      "utf8",
    );
    const treffer = /const STORAGE_KEY = "([^"]+)"/.exec(quelle);
    expect(treffer, "in useOfflineQueue.ts steht kein STORAGE_KEY mehr").not.toBeNull();
    expect(treffer?.[1]).toBe(OFFLINE_WARTESCHLANGE_SCHLUESSEL);
  });
});
