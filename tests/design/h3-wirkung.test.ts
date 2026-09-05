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
//   W3  Live-Befund     → der Chip zeigt „neu“, „Ähnlich“, „Könnte widersprechen“; `pending` und
//                         `unavailable` bleiben still und stehen im Menü … → „Status“.
//   W4  Quelle          → die Zeile im Status nennt die erfassende Person.
//   W5  Fehler          → EIN Satz und „Erneut versuchen“; der Knopf wiederholt WIRKLICH.
//
// ALLES LÄUFT AN DER GEBAUTEN SEITE IN CHROMIUM, gegen die echte Fastify-App — dasselbe Muster wie
// `zielbild-validierung.test.ts` und die drei H3-Messungen daneben. Wo eine Antwort im hermetischen
// Betrieb gar nicht entstehen kann, wird sie ausdrücklich gescriptet und das steht am Fall dabei
// (W3; die Begründung im Kopf von `h3-blatt-buehne.ts`).
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Buehne, MOCKUP, ORIGIN, buehneAufbauen, fn } from "./h3-blatt-buehne";

const mockupDa = existsSync(MOCKUP);

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
  payload: { category?: string; title?: string };
}
interface Ko {
  id: string;
  title: string;
  category: string;
}

describe.runIf(mockupDa)("JOB 3062 · H3 · R6 · Wirkungsnachweise am gebauten Blatt", () => {
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

    it("W3a · „done“ ohne Fund → der Chip sagt „Das ist neu“", async () => {
      const r = await chipLage({ status: "done", similar: [], conflicts: [] });
      expect(r.lage).toBe("new");
      expect(r.text).toContain("Das ist neu");
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
  // Der Abriss ist derselbe wie in W5: `fetch` wird für genau EINEN Aufruf hart abgewiesen
  // (`TypeError: Failed to fetch`), danach ist der echte Weg wieder in Kraft.
  const KI_ABRISS_UND_MITSCHNITT = `() => {
    const echt = window.fetch;
    window.__ki = [];
    let einmal = true;
    window.fetch = (u, o) => {
      const url = typeof u === 'string' ? u : (u && u.url) || '';
      if (url.indexOf('/api/reasoner') !== -1 && o && o.method === 'POST') {
        window.__ki.push(String(o.body || ''));
        if (einmal) {
          einmal = false;
          return Promise.reject(new TypeError('Failed to fetch'));
        }
      }
      return echt(u, o);
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
    let vorschlag = null;
    for (let i = 0; i < 60; i++) {
      vorschlag = document.querySelector('[data-testid="blatt-ki-vorschlag"]');
      if (vorschlag) break;
      await warte(100);
    }
    return {
      gefunden: true,
      karte: kartenText,
      erneut: true,
      lageDaneben: lageDaneben ? (lageDaneben.textContent || '').trim() : null,
      vorschlagDa: vorschlag !== null,
      fehlerWeg: document.querySelector('[data-testid="blatt-ki-fehler"]') === null,
      rumpfe: window.__ki,
    };
  }`;

  interface KiLage {
    gefunden: boolean;
    karte?: string | null;
    erneut?: boolean;
    lageDaneben?: string | null;
    vorschlagDa?: boolean;
    fehlerWeg?: boolean;
    rumpfe?: string[];
  }

  async function kiFehlerfall(eintrag: string): Promise<KiLage> {
    const b = await buehneAufbauen("/erfassen");
    try {
      expect(b.fehler).toBeNull();
      expect(await b.seite.evaluate<string>(fn(SCHREIBEN), SATZ)).toContain("Dosierwert");
      await b.seite.evaluate(fn(KI_ABRISS_UND_MITSCHNITT));
      return await b.seite.evaluate<KiLage>(fn(KI_FEHLER_UND_WIEDERHOLUNG), eintrag);
    } finally {
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
    it("W7 · „Klarer“ scheitert einmal — die Wiederholung schickt wieder „Klarer“, nicht irgendetwas", async () => {
      const r = await kiFehlerfall("Klarer");
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
    }, 180_000);
  });
});

describe.runIf(!mockupDa)("JOB 3062 · H3 · R6 · Wirkungsnachweise übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
