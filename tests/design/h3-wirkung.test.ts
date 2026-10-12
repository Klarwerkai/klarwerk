// ================================================================================================
// JOB 3062 · H3 · R6 — WIRKUNGSNACHWEISE: die Funktion TUT etwas, sie steht nicht nur da.
// ================================================================================================
//
// BENS BEFUND ZUR RUNDE 5, und er trifft den Kern: „Das Funktionsinventar prüft überwiegend
// sichtbare Elemente statt deren tatsächliche Wirkung.“ Der teuerste Beleg dafür war das Menü
// „Bereich“: es stand da, es liess sich öffnen, es zeigte die Kategorien des Bestandes, und der
// Inventartest fand es — nur kam die Wahl nirgends an. Wer „Konstruktion“ wählte, bekam
// „Allgemein“. Ein Test, der ein Element findet, hat über eine Scheinwahl nichts gesagt.
//
// DIESE DATEI IST DIE ANTWORT DARAUF. Sie misst nicht, ob etwas DA ist, sondern was passiert, wenn
// man es benutzt — und sie fragt für die Folge den SERVER, nicht die Fläche, die den Wert selbst
// hält (`b.frage`, dieselbe `buildApp`-Instanz über `inject`). Fünf Wirkungen, je eine je
// Korrekturpflicht:
//
//   W1  Bereich wählen  → Entwurf, erneutes Öffnen und Wissensobjekt tragen ihn.
//   W2  `?demo=stage1`  → Demo-Banner da; ohne Abfrage nicht.
//   W3  Live-Befund     → der Chip zeigt „Vorschau“ (leer, mit Umfang), „Ähnlich“, „Könnte
//                         widersprechen“ (Aufnahme 20260922: kein „neu“ mehr); `pending` und
//                         `unavailable` bleiben still und stehen im Menü … → „Status“.
//   W4  Quelle          → die Zeile im Status nennt die erfassende Person.
//   W5  Fehler          → EIN Satz und „Erneut versuchen“; der Knopf wiederholt WIRKLICH.
//
// ALLES LÄUFT AN DER GEBAUTEN SEITE IN CHROMIUM, gegen die echte Fastify-App — dasselbe Muster wie
// `zielbild-validierung.test.ts` und die drei H3-Messungen daneben. Wo eine Antwort im hermetischen
// Betrieb gar nicht entstehen kann, wird sie ausdrücklich gescriptet und das steht am Fall dabei
// (W3; die Begründung im Kopf von `h3-blatt-buehne.ts`).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import einstieg from "../../apps/web/src/texte/einstieg";
import * as appModul from "../../services/app/src/build-app";
import {
  DeterministicProvider,
  type ModelClient,
  ModelProvider,
  Reasoner,
  cappedModelClient,
} from "../../services/reasoner";
import { type Buehne, ORIGIN, buehneAufbauen, fn } from "./h3-blatt-buehne";

/** Der Bereich, den W1 wählt — er liegt als Kategorie des angelegten Bestands wirklich im Menü. */
const BEREICH = "Konstruktion";

const SATZ =
  "Beim Anfahren der Linie L4 nach dem Schichtwechsel den Dosierwert erst nach zehn Minuten anpassen.";

/** In der Seite: ein Menü öffnen und den Eintrag mit genau diesem Text klicken. */
const MENUE_WAEHLEN = `async ([werkzeug, eintrag]) => {
  const warte = () => new Promise((r) => setTimeout(r, 60));
  document.querySelector('[data-testid="' + werkzeug + '"]').click();
  await warte();
  const treffer = [...document.querySelectorAll('[role=menuitem]')]
    .find((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim() === eintrag);
  if (!treffer) return false;
  treffer.click();
  await warte();
  return true;
}`;

/** In der Seite: Text in das Schreibfeld setzen — über das echte Eingabeereignis des Editors. */
const SCHREIBEN = `async (text) => {
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));
  const feld = document.querySelector('[data-testid="blatt-text"] [role=textbox]');
  feld.focus();
  feld.innerHTML = '<p>' + text + '</p>';
  feld.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await warte(700);
  return (feld.textContent || '').trim();
}`;

/** In der Seite: auf einen Knopf klicken und dem Blatt Zeit für die Antwort lassen. */
const KLICKEN = `async ([sel, ms]) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  el.click();
  await new Promise((r) => setTimeout(r, ms));
  return true;
}`;

const TEXT_VON = `(sel) => {
  const el = document.querySelector(sel);
  return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : null;
}`;

interface Entwurf {
  id: string;
  payload: { category?: string; title?: string; bodyHtml?: string | null };
}
interface Ko {
  id: string;
  title: string;
  category: string;
}

// Aufnahme `gesamt-erfassung-einstieg:layout`: Die Wirkungsnachweise lesen keinen Sollwert aus dem
// Mockup, hingen aber an dessen Vorhandensein und übersprangen sich so auf dem Linux-Prüfweg. Sie
// laufen jetzt immer; fehlt `apps/web/dist`, meldet die Bühne das in `fehler`.
describe("JOB 3062 · H3 · R6 · Wirkungsnachweise am gebauten Blatt", () => {
  // ==============================================================================================
  // W1 — DER BEREICH KOMMT AN. (bens Korrekturpflicht 1)
  // ==============================================================================================
  //
  // Drei Stationen, weil der Bereich auf DREI verschiedenen Wegen reist und R5 auf allen dreien
  // verlor: Anlegen (`POST /api/drafts`), erneutes Öffnen (`?draft=` → die Fläche muss ihn wieder
  // zeigen) und Einreichen (`draftPayload` im Promote → `toKoInput` → Wissensobjekt).
  describe("W1 · Bereich", () => {
    let b: Buehne;
    beforeAll(async () => {
      b = await buehneAufbauen("/erfassen");
    }, 180_000);
    afterAll(async () => {
      await b?.schliessen();
    }, 60_000);

    it("W1a · gewählter Bereich steht im gespeicherten Entwurf — am SERVER gefragt, nicht auf der Fläche", async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Dosierwert");
      expect(
        await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), ["blatt-werkzeug-bereich", BEREICH]),
        `Der Bereich „${BEREICH}“ steht nicht im Menü`,
      ).toBe(true);
      // Die Wahl ist auch am Werkzeug abzulesen — es trägt den gewählten Wert als sein Wort.
      expect(
        await b.seite.evaluate<string>(fn(TEXT_VON), '[data-testid="blatt-werkzeug-bereich"]'),
      ).toContain(BEREICH);

      expect(
        await b.seite.evaluate<boolean>(fn(KLICKEN), [
          '[data-testid="blatt-entwurf-sichern"]',
          1500,
        ]),
      ).toBe(true);

      const entwuerfe = await b.frage<Entwurf[]>("GET", "/api/drafts");
      expect(entwuerfe.length, "kein Entwurf angelegt").toBeGreaterThan(0);
      // DIE EIGENTLICHE ZUSICHERUNG: nicht „irgendeine Kategorie“, sondern die GEWÄHLTE. Vor R6
      // stand hier „Allgemein“ — der Vorgabewert aus `buildFrontDoorPayload`.
      expect(entwuerfe[0]?.payload.category, "der gewählte Bereich kam nicht am Server an").toBe(
        BEREICH,
      );
    });

    it("W1b · und nach dem erneuten Öffnen desselben Entwurfs steht er wieder am Werkzeug", async () => {
      expect(b.fehler).toBeNull();
      const entwuerfe = await b.frage<Entwurf[]>("GET", "/api/drafts");
      const id = entwuerfe[0]?.id ?? "";
      expect(id, "kein Entwurf zum Fortsetzen").not.toBe("");
      // AUSDRÜCKLICH DIESELBE BÜHNE, neu geladen: eine zweite Bühne wäre ein zweiter Server mit
      // eigenem, leerem Bestand — der Entwurf existierte dort gar nicht, und der Fall prüfte am Ende
      // die Fehlermeldung „Entwurf nicht gefunden" statt das Fortsetzen (in R6 einmal gemessen).
      await b.seite.goto(`${ORIGIN}/erfassen?draft=${id}`, { waitUntil: "load", timeout: 60_000 });
      // Das Blatt steht sofort, der Entwurf wird danach geholt (`GET /api/drafts/:id`). Gewartet
      // wird deshalb auf die FOLGE des Ladens, nicht auf eine feste Zeit.
      const wort = await b.seite.evaluate<string>(
        fn(`async (sel) => {
          for (let i = 0; i < 60; i++) {
            const el = document.querySelector(sel);
            const t = el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '';
            if (t && !t.startsWith('Bereich')) return t;
            await new Promise((r) => setTimeout(r, 100));
          }
          const el = document.querySelector(sel);
          return el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '';
        }`),
        '[data-testid="blatt-werkzeug-bereich"]',
      );
      expect(wort, "der fortgesetzte Entwurf zeigt seinen Bereich nicht").toContain(BEREICH);
    }, 120_000);

    it("W1c · und das eingereichte Wissensobjekt trägt ihn ebenfalls", async () => {
      expect(b.fehler).toBeNull();
      const vorher = await b.frage<Ko[]>("GET", "/api/kos");
      // §5.4: die Vertraulichkeit muss VOR dem Einreichen gewählt sein — ohne diesen Klick bekäme
      // das Menü nur den Fokus und es entstünde (richtigerweise) nichts. Der Fall fährt damit den
      // vollständigen Weg über den FORTGESETZTEN Entwurf aus W1b, nicht die halbe Strecke.
      expect(
        await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), [
          "blatt-werkzeug-vertraulichkeit",
          "Öffentlich-intern",
        ]),
        "die Vertraulichkeitsstufe steht nicht im Menü",
      ).toBe(true);
      expect(
        await b.seite.evaluate<boolean>(fn(KLICKEN), ['[data-testid="blatt-einreichen"]', 2500]),
      ).toBe(true);
      const nachher = await b.frage<Ko[]>("GET", "/api/kos");
      expect(nachher.length, "kein Wissensobjekt entstanden").toBe(vorher.length + 1);
      const neu = nachher.find((k) => !vorher.some((v) => v.id === k.id));
      expect(neu?.category, "das Wissensobjekt trägt nicht den gewählten Bereich").toBe(BEREICH);
      // Und die Fläche sagt dasselbe wie der Server (Zustandsmodell §9: „eingereicht“ erst danach).
      expect(await b.seite.evaluate<string>(fn(TEXT_VON), '[data-testid="blatt-lage"]')).toContain(
        neu?.title ?? "",
      );
    });
  });

  // ==============================================================================================
  // W2 — DER DEMO-PFAD. (bens Korrekturpflicht 2)
  // ==============================================================================================
  // Positiv UND negativ, weil nur beide zusammen etwas sagen: ein Banner, das immer da ist, wäre
  // genauso falsch wie keines.
  describe("W2 · Demo-Banner", () => {
    it("W2a · `/erfassen?demo=stage1` zeigt das Demo-Banner", async () => {
      const b = await buehneAufbauen("/erfassen?demo=stage1");
      try {
        expect(b.fehler).toBeNull();
        const text = await b.seite.evaluate<string>(fn(TEXT_VON), '[data-testid="blatt-huelle"]');
        // Gesucht wird die Marke des Banners (`demo.banner.tag`), nicht irgendein Wort: sie steht
        // ausschliesslich im Demo-Banner und nirgends sonst auf dem Blatt.
        expect(text, "kein Demo-Kennzeichen auf dem Blatt").toContain("Demo-Pfad");
      } finally {
        await b.schliessen();
      }
    }, 180_000);

    it("W2b · ohne die Abfrage steht es nicht da", async () => {
      const b = await buehneAufbauen("/erfassen");
      try {
        expect(b.fehler).toBeNull();
        const text = await b.seite.evaluate<string>(fn(TEXT_VON), '[data-testid="blatt-huelle"]');
        expect(text, "Demo-Banner ohne Demo-Abfrage").not.toContain("Demo-Pfad");
      } finally {
        await b.schliessen();
      }
    }, 180_000);
  });

  // ==============================================================================================
  // W3 — DIE LIVE-REAKTION, ALLE FÜNF LAGEN. (bens Korrekturpflicht 4)
  // ==============================================================================================
  //
  // Drei bekommen einen Chip („neu“, „Ähnlich“, „Könnte widersprechen“ — die drei, die Auftrag §5
  // nennt), zwei bleiben still und stehen stattdessen im Menü … → „Status“. Beides wird gemessen:
  // die Stille ist hier eine Zusage, kein Weglassen.
  //
  // WARUM GESCRIPTET: ohne Modell antwortet `checkKnowledge` immer `status: "pending"` (kein Judge,
  // `services/app/src/knowledge-check.ts`). „neu“ und „conflict“ sind im hermetischen Tor also gar
  // nicht erreichbar. Gescriptet wird die SERVERANTWORT; gemessen, was der echte Client daraus
  // macht — Abbildung (`mapKnowledgeCheck`) und Fläche laufen unverändert.
  describe("W3 · Live-Reaktion", () => {
    const antwort = (r: unknown): Record<string, unknown> => ({ "POST /api/knowledge/check": r });
    const treffer = {
      id: "ko-1",
      title: "Profile in Spritzzonen",
      score: 0.9,
      koStatus: "approved",
      koCategory: BEREICH,
    };

    async function chipLage(r: unknown): Promise<{ lage: string | null; text: string | null }> {
      const b = await buehneAufbauen("/erfassen", '[data-testid="blatt"]', antwort(r));
      try {
        expect(b.fehler).toBeNull();
        await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ);
        // Der Hook ist entprellt (500 ms) — danach steht der Befund.
        await b.seite.evaluate(fn("() => new Promise((r) => setTimeout(r, 900))"));
        return await b.seite.evaluate<{ lage: string | null; text: string | null }>(
          fn(`() => {
            const chip = document.querySelector('[data-testid="blatt-live-chip"]');
            return {
              lage: chip ? chip.getAttribute('data-lage') : null,
              text: chip ? (chip.textContent || '').replace(/\\s+/g, ' ').trim() : null,
            };
          }`),
        );
      } finally {
        await b.schliessen();
      }
    }

    // AUFNAHME 20260922 · VORSCHAU-REICHWEITE — W3a ANGEPASST, WEIL DIE ANFORDERUNG ES VERLANGT.
    // Hier stand „„done“ ohne Fund → der Chip sagt „Das ist neu“". Der Server vergleicht höchstens
    // eine begrenzte Vorauswahl (CANDIDATE_LIMIT); Kriterium 1 der Aufnahme verbietet bei begrenzter
    // oder unbekannter Abdeckung genau diese bestandweite Aussage. Gemessen wird jetzt die leere
    // VORSCHAU mit ihrem belegten Umfang — und dass der alte Satz fehlt. W3a2 deckt die Antwort ohne
    // Umfangsangabe ab: sie ist „Umfang unbekannt", keine Vollprüfung.
    it("W3a · „done“ ohne Fund → der Chip sagt „Vorschau“ mit belegtem Umfang, nie „Das ist neu“", async () => {
      const r = await chipLage({
        status: "done",
        similar: [],
        conflicts: [],
        coverage: { kind: "candidates", checked: 40, limit: 40, limitReached: true },
      });
      expect(r.lage).toBe("empty");
      expect(r.text).toContain("Vorschau");
      expect(r.text).toContain("40 Einträge verglichen, Grenze erreicht");
      expect(r.text).not.toContain("Das ist neu");
    }, 180_000);

    it("W3a2 · „done“ ohne Fund und ohne Umfangsangabe → „Umfang unbekannt“, nie „Das ist neu“", async () => {
      const r = await chipLage({ status: "done", similar: [], conflicts: [] });
      expect(r.lage).toBe("empty");
      expect(r.text).toContain("Umfang unbekannt");
      expect(r.text).not.toContain("Das ist neu");
    }, 180_000);

    it("W3b · ein ähnliches Objekt → der Chip nennt es beim Titel", async () => {
      const r = await chipLage({ status: "done", similar: [treffer], conflicts: [] });
      expect(r.lage).toBe("similar");
      expect(r.text).toContain("Profile in Spritzzonen");
    }, 180_000);

    it("W3c · ein Widerspruch → der Chip sagt es, und er gewinnt gegen „ähnlich“", async () => {
      const r = await chipLage({
        status: "done",
        similar: [treffer],
        conflicts: [{ ...treffer, reason: "Gegenteilige Aussage" }],
      });
      expect(r.lage).toBe("conflict");
      expect(r.text).toContain("Könnte widersprechen");
    }, 180_000);

    it("W3d · „pending“ (ohne Modell nicht geprüft) → KEIN Chip, aber eine Zeile im Status", async () => {
      const b = await buehneAufbauen("/erfassen", '[data-testid="blatt"]', {
        "POST /api/knowledge/check": { status: "pending", similar: [], conflicts: [] },
      });
      try {
        expect(b.fehler).toBeNull();
        await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ);
        await b.seite.evaluate(fn("() => new Promise((r) => setTimeout(r, 900))"));
        expect(
          await b.seite.evaluate<boolean>(
            fn(`() => document.querySelector('[data-testid="blatt-live-chip"]') !== null`),
          ),
          "„nicht geprüft“ darf nicht als Chip auf dem Blatt stehen",
        ).toBe(false);
        // … aber im Menü … → „Status“ steht es. Es verschwindet nicht, es wird leise.
        const zeile = await b.seite.evaluate<string | null>(
          fn(`async () => {
            const warte = () => new Promise((r) => setTimeout(r, 80));
            document.querySelector('[data-testid="blatt-werkzeug-mehr"]').click();
            await warte();
            const status = [...document.querySelectorAll('[role=menuitem]')]
              .find((e) => (e.textContent || '').trim() === 'Status');
            if (!status) return null;
            status.click();
            await warte();
            const el = document.querySelector('[data-testid="blatt-status-livepruefung"]');
            return el ? (el.textContent || '').trim() : null;
          }`),
        );
        expect(zeile, "die nicht gelaufene Live-Prüfung steht nirgends").not.toBeNull();
        expect(zeile).toContain("noch nicht geprüft");
      } finally {
        await b.schliessen();
      }
    }, 180_000);

    it("W3e · KALIBRIERUNG: der ECHTE Endpunkt trägt den Weg auch ohne Skript", async () => {
      // Ohne diesen Fall sagten W3a–d nur etwas über gescriptete Antworten. Hier läuft der WIRKLICHE
      // Weg: echter POST an die echte App, echte Antwort, echte Abbildung. Ohne Modell ist sie
      // `pending` — und genau das wird verlangt, nicht mehr.
      const b = await buehneAufbauen("/erfassen");
      try {
        expect(b.fehler).toBeNull();
        const ergebnis = await b.seite.evaluate<{ status: string }>(
          fn(`async () => {
            const r = await fetch('/api/knowledge/check', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: 'Vollverschweisste Hohlprofile in Spritzzonen vermeiden.' }),
            });
            return await r.json();
          }`),
        );
        expect(ergebnis.status, "der Live-Check antwortet nicht mehr ehrlich").toBe("pending");
      } finally {
        await b.schliessen();
      }
    }, 180_000);
  });

  // ==============================================================================================
  // W4 — DIE QUELLENZEILE. (Auftrag §5a, bens Befund 4)
  // ==============================================================================================
  describe("W4 · Quelle im Status", () => {
    it("W4 · Menü … → „Status“ nennt die vermutete Quelle mit dem Namen der erfassenden Person", async () => {
      const b = await buehneAufbauen("/erfassen");
      try {
        expect(b.fehler).toBeNull();
        const zeile = await b.seite.evaluate<string | null>(
          fn(`async () => {
            const warte = () => new Promise((r) => setTimeout(r, 80));
            document.querySelector('[data-testid="blatt-werkzeug-mehr"]').click();
            await warte();
            const status = [...document.querySelectorAll('[role=menuitem]')]
              .find((e) => (e.textContent || '').trim() === 'Status');
            if (!status) return null;
            status.click();
            await warte();
            const el = document.querySelector('[data-testid="blatt-status-quelle"]');
            return el ? (el.textContent || '').trim() : null;
          }`),
        );
        // Die Bühne meldet sich als „Pedi“ an (`h3-blatt-buehne.ts`) — die Quelle ist die Person,
        // nicht ein fester Text.
        expect(zeile).toBe("Pedi");
      } finally {
        await b.schliessen();
      }
    }, 180_000);
  });

  // ==============================================================================================
  // W5 — FEHLER UND WIEDERHOLUNG. (Auftrag §9, bens Befund 4)
  // ==============================================================================================
  //
  // Gemessen wird BEIDES: dass der Fehler EINEN Satz und einen Wiederholweg bekommt — und dass der
  // Knopf wirklich wiederholt. Ein „Erneut versuchen“, das nichts tut, wäre schlimmer als keines.
  describe("W5 · Fehler und „Erneut versuchen“", () => {
    it("W5 · abgerissenes Speichern zeigt den Weg zurück, und er trägt", async () => {
      const b = await buehneAufbauen("/erfassen");
      try {
        expect(b.fehler).toBeNull();
        expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Dosierwert");
        expect(
          await b.seite.evaluate<boolean>(
            fn(`() => !document.querySelector('[data-testid="blatt-entwurf-sichern"]').disabled`),
          ),
          "der Entwurfsknopf ist gesperrt — es gäbe nichts abzureissen",
        ).toBe(true);

        // DER ABRISS, und zwar der echte Fehlerfall: `fetch` wird für den EINEN Entwurfsweg genau
        // EINMAL hart abgewiesen (`TypeError: Failed to fetch` — das, was ein Netzabriss auslöst).
        // Danach ist das echte `fetch` wieder in Kraft; deshalb kann derselbe Knopf den Fall auch
        // heilen, und genau das ist die zweite Hälfte dieses Falls.
        await b.seite.evaluate(
          fn(`() => {
            const echt = window.fetch;
            let einmal = true;
            window.fetch = (u, o) => {
              const url = typeof u === 'string' ? u : (u && u.url) || '';
              if (einmal && url.indexOf('/api/drafts') !== -1 && o && o.method === 'POST') {
                einmal = false;
                return Promise.reject(new TypeError('Failed to fetch'));
              }
              return echt(u, o);
            };
          }`),
        );

        const lage = await b.seite.evaluate<string | null>(
          fn(`async () => {
            document.querySelector('[data-testid="blatt-entwurf-sichern"]').click();
            for (let i = 0; i < 40; i++) {
              const el = document.querySelector('[data-testid="blatt-lage"]');
              if (el) return (el.textContent || '').replace(/\\s+/g, ' ').trim();
              await new Promise((r) => setTimeout(r, 100));
            }
            return null;
          }`),
        );
        expect(lage, "der gescheiterte Versuch sagt gar nichts").not.toBeNull();
        expect(lage, "der Fehler bietet keinen Wiederholweg an").toContain("Erneut versuchen");

        const vorher = await b.frage<Entwurf[]>("GET", "/api/drafts");
        expect(vorher.length, "der abgerissene Versuch hat trotzdem etwas angelegt").toBe(0);

        // UND DER KNOPF TUT ES WIRKLICH: derselbe Vorgang, diesmal ohne Abriss.
        expect(
          await b.seite.evaluate<boolean>(fn(KLICKEN), ['[data-testid="blatt-erneut"]', 2500]),
        ).toBe(true);
        const nachher = await b.frage<Entwurf[]>("GET", "/api/drafts");
        expect(nachher.length, "„Erneut versuchen“ hat den Entwurf nicht angelegt").toBe(1);
        // Und die Fehlerzeile ist weg — die Lage ist wirklich eine andere geworden, nicht nur der
        // Text ein anderer.
        expect(
          await b.seite.evaluate<string | null>(fn(TEXT_VON), '[data-testid="blatt-lage"]'),
        ).toBeNull();
      } finally {
        await b.schliessen();
      }
    }, 180_000);
  });

  // ==============================================================================================
  // W6/W7 — DER KI-FEHLER UND SEINE WIEDERHOLUNG. (bens Korrekturpflicht 2, Auftrag §9)
  // ==============================================================================================
  //
  // BENS MESSUNG AN R6, wörtlich: „erster Aufruf ‚KI → Struktur vorschlagen‘ mit einmaligem
  // Netzabbruch → Fehlertext erschien, aber kein Wiederholknopf". Grund war `letzteAktion`: sie
  // kannte nur Laden, Speichern und Einreichen, und in einer frischen Sitzung war sie beim ersten
  // KI-Klick noch `null`. Schlimmer noch: nach einem vorherigen Speichern hätte der Knopf das
  // SPEICHERN wiederholt — eine Handlung, die der Mensch gar nicht bestellt hatte.
  //
  // GEMESSEN WIRD DESHALB DREIERLEI, und zwar am ERSTEN Fehler einer frischen Bühne:
  //   1. Der Fehler steht in der VORSCHLAGSKARTE (§9), nicht in der Zeile unter den Knöpfen.
  //   2. Er bietet „Erneut versuchen" an.
  //   3. Der Klick schickt EXAKT DENSELBEN Request los — bei der KI-Hilfe mit derselben Anweisung.
  //      Dafür schneidet die Seite jeden `/api/reasoner`-Rumpf mit; verglichen werden die Rümpfe.
  //
  // W6 bricht wie W5 genau einen Fetch ab. W7 schneidet nur mit: dort entsteht
  // der erste Fehler im Modellclient und durchläuft den echten Serverfehlerweg.
  const KI_ABRISS_UND_MITSCHNITT = `(abbrechen) => {
    const echt = window.fetch;
    window.__ki = [];
    window.__kiAntworten = [];
    let einmal = abbrechen;
    window.fetch = (u, o) => {
      const url = typeof u === 'string' ? u : (u && u.url) || '';
      if (url.indexOf('/api/reasoner') !== -1 && o && o.method === 'POST') {
        window.__ki.push(String(o.body || ''));
        if (einmal) {
          einmal = false;
          return Promise.reject(new TypeError('Failed to fetch'));
        }
      }
      return echt(u, o).then(async (antwort) => {
        if (url.indexOf('/api/reasoner') !== -1 && o && o.method === 'POST') {
          window.__kiAntworten.push({ status: antwort.status, body: await antwort.clone().json() });
        }
        return antwort;
      });
    };
  }`;

  /**
   * In der Seite: das KI-Menü öffnen, den Eintrag klicken, auf die Fehlerkarte warten, dort
   * „Erneut versuchen" klicken und danach die Lage melden. Alles in EINEM Durchgang, damit
   * zwischen Fehler und Wiederholung nichts anderes passiert.
   */
  const KI_FEHLER_UND_WIEDERHOLUNG = `async (eintrag) => {
    const warte = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-testid="blatt-werkzeug-ki"]').click();
    await warte(80);
    const ziel = [...document.querySelectorAll('[role=menuitem]')]
      .find((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim() === eintrag);
    if (!ziel) return { gefunden: false };
    ziel.click();
    let karte = null;
    for (let i = 0; i < 60; i++) {
      karte = document.querySelector('[data-testid="blatt-ki-fehler"]');
      if (karte) break;
      await warte(100);
    }
    if (!karte) return { gefunden: true, karte: null };
    const kartenText = (karte.textContent || '').replace(/\\s+/g, ' ').trim();
    // §9 sagt „ein Satz IN DER VORSCHLAGSKARTE" — die Zeile unter den Knoepfen bleibt dabei leer.
    const lageDaneben = document.querySelector('[data-testid="blatt-lage"]');
    const erneut = karte.querySelector('[data-testid="blatt-ki-erneut"]');
    if (!erneut) return { gefunden: true, karte: kartenText, erneut: false };
    erneut.click();
    // JOB 3276: gewartet wird auf DAS ERGEBNIS der Wiederholung, nicht nur auf einen Vorschlag.
    // Der Klick leert beide Karten (onMutate); was danach steht, ist die Antwort auf die Handlung —
    // ein Vorschlag ODER eine Meldung. Wer nur auf den Vorschlag wartet, misst die Meldung als
    // „nichts passiert".
    await warte(120);
    let vorschlag = null;
    let fehlerDanach = null;
    for (let i = 0; i < 60; i++) {
      vorschlag = document.querySelector('[data-testid="blatt-ki-vorschlag"]');
      fehlerDanach = document.querySelector('[data-testid="blatt-ki-fehler"]');
      if (vorschlag || fehlerDanach) break;
      await warte(100);
    }
    const feld = document.querySelector('[data-testid="blatt-text"] [role=textbox]');
    return {
      gefunden: true,
      karte: kartenText,
      erneut: true,
      lageDaneben: lageDaneben ? (lageDaneben.textContent || '').trim() : null,
      vorschlagDa: vorschlag !== null,
      vorschlagText: vorschlag ? (vorschlag.textContent || '').replace(/\\s+/g, ' ').trim() : null,
      fehlerDanach: fehlerDanach ? (fehlerDanach.textContent || '').replace(/\\s+/g, ' ').trim() : null,
      fehlerWeg: fehlerDanach === null,
      blattText: feld ? (feld.textContent || '').replace(/\\s+/g, ' ').trim() : null,
      rumpfe: window.__ki,
      antworten: window.__kiAntworten,
    };
  }`;

  interface KiLage {
    gefunden: boolean;
    karte?: string | null;
    erneut?: boolean;
    lageDaneben?: string | null;
    vorschlagDa?: boolean;
    vorschlagText?: string | null;
    fehlerDanach?: string | null;
    fehlerWeg?: boolean;
    blattText?: string | null;
    rumpfe?: string[];
    antworten?: { status: number; body: { text?: string; demo?: boolean; message?: string } }[];
  }

  async function kiFehlerfall(eintrag: string, modell?: ModelClient): Promise<KiLage> {
    // JOB 3276 R4: nur die Modellantwort ist vorgegeben. Der echte ModelProvider, Reasoner,
    // Fastify-Endpunkt und das gebaute Blatt verarbeiten Fehler und Wiederholung selbst.
    const services = modell ? appModul.buildServices() : undefined;
    if (services && modell) {
      services.reasoner = new Reasoner(
        undefined,
        undefined,
        undefined,
        undefined,
        new ModelProvider(
          cappedModelClient(
            {
              ...modell,
              // Der Verfügbarkeitstest beim Start ist unabhängig von den zwei Assist-Versuchen.
              complete: (...args) =>
                args[1] === "ping" ? Promise.resolve("OK") : modell.complete(...args),
            },
            { rejectsConfidential: false },
          ),
        ),
      );
      // Lokales Testmodell: der interne Text bleibt auf dem dafür zugelassenen Weg.
      // Nur Assist bekommt die Antwortfolge; Hintergrundprüfungen verbrauchen sie nicht.
      await services.reasoner.setTaskConfig({
        global: "deterministic",
        perTask: { assist: "local" },
      });
    }
    const aufbau = services
      ? vi.spyOn(appModul, "buildServices").mockReturnValueOnce(services)
      : undefined;
    const b = await buehneAufbauen("/erfassen");
    try {
      expect(b.fehler).toBeNull();
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Dosierwert");
      if (modell) {
        expect(
          await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), [
            "blatt-werkzeug-vertraulichkeit",
            "Öffentlich-intern",
          ]),
        ).toBe(true);
      }
      await b.seite.evaluate(fn(KI_ABRISS_UND_MITSCHNITT), modell === undefined);
      return await b.seite.evaluate<KiLage>(fn(KI_FEHLER_UND_WIEDERHOLUNG), eintrag);
    } finally {
      aufbau?.mockRestore();
      await b.schliessen();
    }
  }

  describe("W6 · KI-Struktur: Fehler in der Karte, und „Erneut versuchen“ trägt", () => {
    it("W6 · der ERSTE Netzfehler bietet den Weg zurück, und der Klick wiederholt denselben Request", async () => {
      const r = await kiFehlerfall("Struktur vorschlagen");
      expect(r.gefunden, "„Struktur vorschlagen“ steht nicht im KI-Menü").toBe(true);
      expect(r.karte, "der KI-Fehler steht in keiner Vorschlagskarte").not.toBeNull();
      // Die eigentliche Auskunft des Fehlers: am eigenen Text ist NICHTS geschehen.
      expect(r.karte).toContain("Originaltext bleibt unverändert");
      expect(r.erneut, "der erste KI-Fehler bietet keinen Wiederholweg an").toBe(true);
      // §9: die Zeile unter den Knöpfen bleibt dem Blattweg vorbehalten.
      expect(r.lageDaneben, "der KI-Fehler steht doppelt — auch unter den Knöpfen").toBeNull();
      // Und er wiederholt WIRKLICH: zwei Requests, Zeichen für Zeichen derselbe Rumpf.
      expect(r.rumpfe?.length, "der Wiederholklick hat gar nichts geschickt").toBe(2);
      expect(r.rumpfe?.[1], "die Wiederholung schickte einen ANDEREN Request").toBe(r.rumpfe?.[0]);
      expect(JSON.parse(r.rumpfe?.[0] ?? "{}").task).toBe("structure");
      // Der zweite Lauf gelingt (kein Abriss mehr) — Fehlerkarte weg, Vorschlagskarte da.
      expect(r.fehlerWeg, "die Fehlerkarte blieb nach der geglückten Wiederholung stehen").toBe(
        true,
      );
      expect(r.vorschlagDa, "die geglückte Wiederholung brachte keinen Vorschlag").toBe(true);
    }, 180_000);
  });

  describe("W7 · KI-Hilfe: die Wiederholung nimmt DIESELBE Handlung", () => {
    // Der Fall, den ben ausdrücklich verlangt: „‚Erneut versuchen‘ muss exakt dieselbe Handlung
    // wiederholen." Bei der KI-Hilfe ist die Handlung die ANWEISUNG im Rumpf — „Klarer" und
    // „Erweitern" gehen über denselben Endpunkt und unterscheiden sich nur dort. Ein
    // Wiederholknopf, der „Erweitern" statt „Klarer" schickte, wäre von aussen nicht zu sehen.
    it("W7a · „Klarer“ scheitert einmal — die Wiederholung zeigt den veränderten Modellvorschlag", async () => {
      const vorschlag =
        "Nach dem Schichtwechsel an Linie L4 zehn Minuten warten, dann den Dosierwert anpassen.";
      const complete = vi
        .fn<ModelClient["complete"]>()
        .mockRejectedValueOnce(new Error("Testanbieter antwortete mit HTTP 503"))
        .mockResolvedValueOnce(vorschlag);
      const r = await kiFehlerfall("Klarer", {
        name: "local:w7-test",
        model: "w7-test",
        complete,
      });
      expect(r.gefunden, "„Klarer“ steht nicht im KI-Menü").toBe(true);
      expect(r.karte, "der KI-Fehler steht in keiner Vorschlagskarte").not.toBeNull();
      expect(r.erneut, "der erste KI-Fehler bietet keinen Wiederholweg an").toBe(true);
      expect(r.rumpfe?.length, "der Wiederholklick hat gar nichts geschickt").toBe(2);
      const erst = JSON.parse(r.rumpfe?.[0] ?? "{}") as { task: string; instruction?: string };
      const zweit = JSON.parse(r.rumpfe?.[1] ?? "{}") as { task: string; instruction?: string };
      expect(erst.task).toBe("assist");
      expect(
        erst.instruction,
        "die Anweisung reist nicht mit — die Handlung wäre ununterscheidbar",
      ).toBeTruthy();
      expect(zweit.instruction, "die Wiederholung nahm eine ANDERE KI-Handlung").toBe(
        erst.instruction,
      );

      expect(r.vorschlagDa, "die geglückte Wiederholung brachte keinen Vorschlag").toBe(true);
      expect(r.vorschlagText).toContain(vorschlag);
      expect(r.vorschlagText).not.toContain(SATZ);
      expect(r.fehlerDanach).toBeNull();
      expect(complete).toHaveBeenCalledTimes(2);
      expect(complete.mock.calls[1]).toEqual(complete.mock.calls[0]);
      expect(complete.mock.calls[1]?.[0]).toContain(erst.instruction);
      expect(complete.mock.calls[1]?.[1]).toBe(SATZ);
      expect(r.antworten?.map((antwort) => antwort.status)).toEqual([500, 200]);
      expect(r.antworten?.[1]?.body).toEqual({ text: vorschlag, demo: false });
      expect(r.fehlerWeg, "die Fehlerkarte blieb nach der geglückten Wiederholung stehen").toBe(
        true,
      );
      // Und das ist keine Behauptung, sondern nachgesehen: der Absatz im Blatt ist unangetastet.
      expect(r.blattText, "der eigene Text hat sich bei alldem verändert").toBe(SATZ);
    }, 180_000);

    it("W7b · unveränderte Modellantwort und Ersatz bleiben ein ehrlicher Nichtvorschlag", async () => {
      const complete = vi
        .fn<ModelClient["complete"]>()
        .mockRejectedValueOnce(new Error("Testanbieter antwortete mit HTTP 503"))
        .mockResolvedValueOnce(SATZ);
      // Der Ersatz selbst bleibt echt; diese Eingabe wird durch ihn nicht verändert.
      expect(await new DeterministicProvider().assistText(SATZ)).toEqual({
        text: SATZ,
        demo: true,
      });
      const r = await kiFehlerfall("Klarer", {
        name: "local:w7-test",
        model: "w7-test",
        complete,
      });
      expect(r.gefunden).toBe(true);
      expect(r.erneut).toBe(true);
      expect(r.rumpfe).toHaveLength(2);
      expect(r.rumpfe?.[1]).toBe(r.rumpfe?.[0]);
      expect(complete).toHaveBeenCalledTimes(2);
      expect(r.vorschlagDa).toBe(false);
      expect(r.vorschlagText).toBeNull();
      expect(r.fehlerWeg).toBe(false);
      expect(r.fehlerDanach).toContain("Originaltext bleibt unverändert");
      expect(r.blattText).toBe(SATZ);
      // Blatt.tsx zeigt seinen eigenen Fehlersatz. Der genaue Grund wird am echten
      // Antwortvertrag geprüft, den das Expertenformular wörtlich anzeigen kann.
      expect(r.antworten?.map((antwort) => antwort.status)).toEqual([500, 500]);
      expect(r.antworten?.[1]?.body.message).toBe(
        "Die KI hat keine Änderungen vorgeschlagen. Grund: local:w7-test (w7-test) gab den Text unverändert zurück.",
      );
      expect(r.antworten?.[1]?.body.text).toBeUndefined();
    }, 180_000);
  });

  // ==============================================================================================
  // W8/W9 — DIE ÜBRIGEN WECHSEL-RÜCKFRAGEN IM ECHTEN CHROMIUM (Aufnahme
  // `gesamt-erfassung-einstieg:layout`, Nacharbeit 2, Bens Befunde zu K2).
  // ==============================================================================================
  //
  // `sichernFrage` und `ohneSichernFrage` misst `h3-wechsel-rueckfragen.test.ts` R0–R3. Hier stehen
  // die zwei Rückfragen, die bis dahin nur gemountet belegt waren (`formular-und-titel-mounted`
  // N8–N9c, B4–B4d):
  //   W8  `nachtragFrage` — während die Speicherung des Formularwechsels läuft, wird nachgetragen.
  //       Der ECHTE Speicherrequest wird dafür nur festgehalten (`route.fallback()` danach, also
  //       derselbe Weg zur echten Fastify-App), nicht ersetzt.
  //   W9  `vorschlagOffen` — ein offener KI-Vorschlag sperrt den Wechsel mit genau einer Meldung.
  //       Das Modell ist der lokale Test-ModelClient aus W7, kein externes Modell.
  // GRENZE: gemessen werden Art, vollständiger Text und Wirkung des nativen Dialogs, nicht sein
  // Pixelbild — das kopflose Chromium zeichnet ihn nicht.

  const SICHERN_FRAGE = einstieg.de["einstieg.formular.sichernFrage"];
  const NACHTRAG_FRAGE = einstieg.de["einstieg.formular.nachtragFrage"];
  const VORSCHLAG_OFFEN = einstieg.de["einstieg.formular.vorschlagOffen"];
  /** Sichtbare Beschriftungen — wörtlich aus `apps/web/src/i18n.ts`, DE-Block. */
  const FORMULAR_WEG = "Formular (Experten)"; // erfassen.weg.formular
  // EDITOR-EINHEITLICH (K1): das Titelfeld des Expertenformulars heisst wie beim Bearbeiten „Titel".
  const FORMULAR_TITEL = "Titel"; // capture.wizard.titleLabel
  const VERWERFEN = "Vorschlag verwerfen"; // fd.discardProposal
  const NACHTRAG = "Nachtrag Ventil V2";

  interface Dialog {
    type(): string;
    message(): string;
    accept(): Promise<void>;
    dismiss(): Promise<void>;
  }
  type Antwort = "ok" | "abbrechen";

  /** Jeder `confirm`/`alert` der Seite: Art und vollständiger Text; beantwortet der Reihe nach. */
  function dialogeMitschneiden(b: Buehne, antworten: Antwort[]): { art: string; text: string }[] {
    const liste: { art: string; text: string }[] = [];
    b.seite.on("dialog", (roh: unknown) => {
      const d = roh as Dialog;
      // Die Verlassen-Wache beim Abbau ist nicht Gegenstand dieser Fälle.
      if (d.type() === "beforeunload") {
        void d.accept();
        return;
      }
      liste.push({ art: d.type(), text: d.message() });
      void ((antworten.shift() ?? "abbrechen") === "ok" ? d.accept() : d.dismiss());
    });
    return liste;
  }

  interface Speicherwache {
    /** Solange `true`, wird jeder Schreibrequest an `/api/drafts` festgehalten. */
    halten: boolean;
    festgehalten: (() => void)[];
    schreibvorgaenge: number;
  }

  /** Zählt jeden Schreibrequest an `/api/drafts[/:id]` und hält ihn auf Wunsch fest. */
  async function speicherwache(b: Buehne): Promise<Speicherwache> {
    const w: Speicherwache = { halten: false, festgehalten: [], schreibvorgaenge: 0 };
    await b.seite.route(`${ORIGIN}/api/drafts**`, async (route) => {
      const req = route.request();
      const pfad = new URL(req.url()).pathname;
      if (["POST", "PUT"].includes(req.method()) && /^\/api\/drafts(\/[^/]+)?$/.test(pfad)) {
        w.schreibvorgaenge += 1;
        if (w.halten) {
          await new Promise<void>((weiter) => w.festgehalten.push(weiter));
        }
      }
      await route.fallback();
    });
    return w;
  }

  async function bis(bedingung: () => boolean, ms = 8000): Promise<boolean> {
    for (let i = 0; i < ms / 100 && !bedingung(); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return bedingung();
  }

  /** In der Seite: steht das Expertenformular (Feld „Kernaussage")? Wartet bis zu fünf Sekunden. */
  const FORMULAR_OFFEN = `async (beschriftung) => {
    for (let i = 0; i < 50; i++) {
      const da = [...document.querySelectorAll('label span')]
        .some((s) => (s.textContent || '').trim() === beschriftung);
      if (da) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }`;

  const SICHTBARER_TEXT = `(sel) => {
    const el = document.querySelector(sel);
    return el ? (el.innerText || '').replace(/\\s+/g, ' ').trim() : null;
  }`;

  describe("W8 · nachtragFrage: Nachtrag während der Speicherung des Formularwechsels", () => {
    /** Bis zur zweiten Rückfrage: schreiben, Datei → Formular, sichern festhalten, nachtragen, freigeben. */
    async function bisZurNachtragFrage(
      antworten: Antwort[],
      nachtragen: boolean,
    ): Promise<{ b: Buehne; dialoge: { art: string; text: string }[]; w: Speicherwache }> {
      const b = await buehneAufbauen("/erfassen");
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      const dialoge = dialogeMitschneiden(b, antworten);
      const w = await speicherwache(b);
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Dosierwert");
      w.halten = true;
      expect(
        await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), ["blatt-werkzeug-datei", FORMULAR_WEG]),
        "„Formular (Experten)“ steht nicht im Menü „Datei“",
      ).toBe(true);
      expect(
        await bis(() => w.festgehalten.length === 1),
        "kein Speicherrequest festgehalten",
      ).toBe(true);
      expect(dialoge).toEqual([{ art: "confirm", text: SICHERN_FRAGE }]);
      // Solange die Anfrage läuft, öffnet kein Formular.
      expect(
        await b.seite.evaluate<string | null>(
          fn(SICHTBARER_TEXT),
          '[data-testid="blatt-arbeitsraum"]',
        ),
      ).toBeNull();
      if (nachtragen) {
        expect(await b.seite.evaluate<string>(fn(SCHREIBEN), `${SATZ} ${NACHTRAG}`)).toContain(
          NACHTRAG,
        );
      }
      w.halten = false;
      for (const weiter of w.festgehalten.splice(0)) {
        weiter();
      }
      return { b, dialoge, w };
    }

    it("W8a · Abbrechen: genau nachtragFrage mit vollständigem Text; Nachtrag und Blatt bleiben, gesichert ist der zugestimmte Stand", async () => {
      const { b, dialoge, w } = await bisZurNachtragFrage(["ok", "abbrechen"], true);
      try {
        expect(await bis(() => dialoge.length >= 2), "keine zweite Rückfrage").toBe(true);
        expect(dialoge).toEqual([
          { art: "confirm", text: SICHERN_FRAGE },
          { art: "confirm", text: NACHTRAG_FRAGE },
        ]);
        expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(false);
        expect(dialoge, "eine weitere Rückfrage kam hinterher").toHaveLength(2);
        expect(w.schreibvorgaenge, "nach dem Abbrechen wurde trotzdem gesichert").toBe(1);
        expect(
          await b.seite.evaluate<string>(
            fn(TEXT_VON),
            '[data-testid="blatt-text"] [role="textbox"]',
          ),
        ).toContain(NACHTRAG);
        const entwuerfe = await b.frage<Entwurf[]>("GET", "/api/drafts");
        expect(entwuerfe).toHaveLength(1);
        expect(entwuerfe[0]?.payload.bodyHtml ?? "").toContain("Dosierwert");
        expect(entwuerfe[0]?.payload.bodyHtml ?? "").not.toContain(NACHTRAG);
        expect(b.seitenfehler, "pageerror").toEqual([]);
      } finally {
        await b.schliessen();
      }
    }, 180_000);

    it("W8b · Bestätigen: der Nachtrag wird über den regulären Speicherweg gesichert, das Formular zeigt ihn", async () => {
      const { b, dialoge, w } = await bisZurNachtragFrage(["ok", "ok"], true);
      try {
        expect(await bis(() => dialoge.length >= 2), "keine zweite Rückfrage").toBe(true);
        expect(dialoge).toEqual([
          { art: "confirm", text: SICHERN_FRAGE },
          { art: "confirm", text: NACHTRAG_FRAGE },
        ]);
        expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(true);
        expect(w.schreibvorgaenge, "genau zwei Speicherungen: Stand und Nachtrag").toBe(2);
        const entwuerfe = await b.frage<Entwurf[]>("GET", "/api/drafts");
        expect(entwuerfe, "der Nachtrag legte einen zweiten Entwurf an").toHaveLength(1);
        expect(entwuerfe[0]?.payload.bodyHtml ?? "").toContain(NACHTRAG);
        // Das Formular zeigt DIESEN Stand: das Blatt ist abgebaut, der Text steht im Arbeitsraum.
        let arbeitsraum: string | null = null;
        for (let i = 0; i < 50 && !(arbeitsraum ?? "").includes(NACHTRAG); i++) {
          arbeitsraum = await b.seite.evaluate<string | null>(
            fn(SICHTBARER_TEXT),
            '[data-testid="blatt-arbeitsraum"]',
          );
          await new Promise((r) => setTimeout(r, 100));
        }
        expect(arbeitsraum, "das Formular zeigt den Nachtrag nicht").toContain(NACHTRAG);
        expect(dialoge, "eine weitere Rückfrage kam hinterher").toHaveLength(2);
        expect(b.seitenfehler, "pageerror").toEqual([]);
      } finally {
        await b.schliessen();
      }
    }, 180_000);

    it("W8c · Kalibrierung: festgehalten OHNE Nachtrag — keine zweite Rückfrage, das Formular öffnet", async () => {
      const { b, dialoge, w } = await bisZurNachtragFrage(["ok"], false);
      try {
        expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(true);
        expect(dialoge).toEqual([{ art: "confirm", text: SICHERN_FRAGE }]);
        expect(w.schreibvorgaenge).toBe(1);
      } finally {
        await b.schliessen();
      }
    }, 180_000);
  });

  describe("W9 · vorschlagOffen: offener KI-Vorschlag sperrt den Formularwechsel", () => {
    it("W9 · genau ein alert mit vollständigem Text, kein Speichern, kein Wechsel; nach Verwerfen öffnet derselbe Weg ohne Meldung", async () => {
      const vorschlag =
        "Nach dem Schichtwechsel an Linie L4 zehn Minuten warten, dann den Dosierwert anpassen.";
      const complete = vi.fn<ModelClient["complete"]>().mockResolvedValue(vorschlag);
      // Derselbe Aufbau wie W7 (`kiFehlerfall`): nur die Modellantwort ist vorgegeben.
      const services = appModul.buildServices();
      services.reasoner = new Reasoner(
        undefined,
        undefined,
        undefined,
        undefined,
        new ModelProvider(
          cappedModelClient(
            {
              name: "local:w9-test",
              model: "w9-test",
              complete: (...args) =>
                args[1] === "ping" ? Promise.resolve("OK") : complete(...args),
            },
            { rejectsConfidential: false },
          ),
        ),
      );
      await services.reasoner.setTaskConfig({
        global: "deterministic",
        perTask: { assist: "local" },
      });
      const aufbau = vi.spyOn(appModul, "buildServices").mockReturnValueOnce(services);
      const b = await buehneAufbauen("/erfassen");
      try {
        expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
        const dialoge = dialogeMitschneiden(b, []);
        const w = await speicherwache(b);
        expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Dosierwert");
        expect(
          await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), [
            "blatt-werkzeug-vertraulichkeit",
            "Öffentlich-intern",
          ]),
        ).toBe(true);
        expect(
          await b.seite.evaluate<boolean>(fn(KLICKEN), [
            '[data-testid="blatt-entwurf-sichern"]',
            1500,
          ]),
        ).toBe(true);
        expect((await b.frage<Entwurf[]>("GET", "/api/drafts")).length, "nicht gesichert").toBe(1);

        expect(
          await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), ["blatt-werkzeug-ki", "Klarer"]),
          "„Klarer“ steht nicht im KI-Menü",
        ).toBe(true);
        const vorschlagDa = `async () => {
          for (let i = 0; i < 60; i++) {
            if (document.querySelector('[data-testid="blatt-ki-vorschlag"]')) return true;
            await new Promise((r) => setTimeout(r, 100));
          }
          return false;
        }`;
        expect(await b.seite.evaluate<boolean>(fn(vorschlagDa)), "kein offener Vorschlag").toBe(
          true,
        );
        expect(
          await b.seite.evaluate<string>(fn(TEXT_VON), '[data-testid="blatt-ki-vorschlag"]'),
        ).toContain(vorschlag);
        const schreibenVorher = w.schreibvorgaenge;

        // Datei → Formular bei offenem Vorschlag.
        expect(
          await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), [
            "blatt-werkzeug-datei",
            FORMULAR_WEG,
          ]),
        ).toBe(true);
        expect(await bis(() => dialoge.length >= 1), "keine Meldung").toBe(true);
        expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(false);
        expect(dialoge).toEqual([{ art: "alert", text: VORSCHLAG_OFFEN }]);
        expect(w.schreibvorgaenge, "die Meldung hat trotzdem gesichert").toBe(schreibenVorher);
        expect(
          await b.seite.evaluate<string>(fn(TEXT_VON), '[data-testid="blatt-ki-vorschlag"]'),
          "der Vorschlag ist weg",
        ).toContain(vorschlag);
        expect(
          await b.seite.evaluate<string>(
            fn(TEXT_VON),
            '[data-testid="blatt-text"] [role="textbox"]',
          ),
          "das Blatt hat sich verändert",
        ).toBe(SATZ);

        // Verwerfen — danach öffnet derselbe Weg ohne Meldung und ohne Speichern.
        const verworfen = await b.seite.evaluate<boolean>(
          fn(`async (wort) => {
            const karte = document.querySelector('[data-testid="blatt-ki-vorschlag"]');
            const knopf = karte && [...karte.querySelectorAll('button')]
              .find((k) => (k.textContent || '').replace(/\\s+/g, ' ').trim() === wort);
            if (!knopf) return false;
            knopf.click();
            await new Promise((r) => setTimeout(r, 400));
            return document.querySelector('[data-testid="blatt-ki-vorschlag"]') === null;
          }`),
          VERWERFEN,
        );
        expect(verworfen, "„Vorschlag verwerfen“ fehlt oder wirkt nicht").toBe(true);
        expect(
          await b.seite.evaluate<boolean>(fn(MENUE_WAEHLEN), [
            "blatt-werkzeug-datei",
            FORMULAR_WEG,
          ]),
        ).toBe(true);
        expect(await b.seite.evaluate<boolean>(fn(FORMULAR_OFFEN), FORMULAR_TITEL)).toBe(true);
        expect(dialoge, "nach dem Verwerfen kam erneut eine Meldung").toHaveLength(1);
        expect(w.schreibvorgaenge).toBe(schreibenVorher);
        expect(complete).toHaveBeenCalled();
        expect(b.seitenfehler, "pageerror").toEqual([]);
      } finally {
        aufbau.mockRestore();
        await b.schliessen();
      }
    }, 180_000);
  });
});
