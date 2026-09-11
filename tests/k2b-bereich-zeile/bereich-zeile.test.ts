// ================================================================================================
// JOB 3555 · K2b — DIE BEREICH-ZEILE DER ERFASSEN-FLAECHE, IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// DIE SCHULD, DIE HIER FAELLT: `apps/web/public/word-addin/taskpane.html` trug bis zu diesem Job den
// Satz „Die Bereich-Zeile der Vorlage (Z.39-45) ist bewusst nicht gebaut: kein Serverweg liefert
// eine Kategorienliste". Der Grund ist entfallen — `GET /api/categories` (JOB 3507,
// `services/app/src/routes/category-routes.ts`) liefert die Bereiche, die im SICHTBAREN Bestand des
// Fragenden wirklich vorkommen, sortiert, mit `cache-control: private, no-store` und mit leerer
// Liste statt Fehler bei fehlendem Leserecht.
//
// WAS EIN MENSCH JETZT SIEHT: Panel oeffnen → „Erfassen" → unter „Titel" steht eine zweite Zeile
// „Bereich". Sie zeigt AUSSCHLIESSLICH, was der Bestand hergibt: die Namen der Antwort, „Noch kein
// Bereich in deinem Bestand", wenn die Antwort leer ist, und „Bereiche nicht geladen", wenn der
// Abruf scheitert. Wer waehlt, findet seine Wahl im Entwurf wieder (`DraftPayload.category`,
// `services/capture/src/types.ts:8`); wer nicht waehlt, sendet exakt das, was er vorher sendete.
//
// WIE HIER GEMESSEN WIRD: auf der VORHANDENEN Buehne `tests/design/k2-buehne.ts` (keine zweite) —
// das ausgelieferte `taskpane.html` laeuft in Chromium bei 360 × 720, office.js ist eine Attrappe.
// `GET /api/categories` beantwortet DIESE Datei ueber eine eigene Playwright-Route, die VOR dem
// Laden registriert wird und deshalb vor der Auffangroute der Buehne greift; die Buehne selbst
// bleibt unangetastet. Gemessen wird an den REALEN Optionen des `<select>` und an der wirklich
// abgesetzten Nutzlast (`b.posts`), die Wortlaute kommen aus dem eingebauten Woerterbuch (`wort`),
// die Beschriftung zusaetzlich aus Pedis Zielbild `design/klara/Erfassen.dc.html` Z.40.
//
// RED-FIRST (10.09.2026, Basisstand 15d49dd): auf dem Basisstand fallen F1-F5 — es gibt weder
// `#capture-bereich` noch einen Abruf noch ein Feld `category` in der Nutzlast. Die zwei
// KALIBRIERUNGEN am Ende halten die Aussage scharf: eine hartkodierte Liste laesst F2 fallen, eine
// Nutzlast ohne `category` laesst F5 fallen.
//
// RUNDE 5 (11.09.2026) — DREI FAELLE MEHR, UND SIE SCHLIESSEN BENs LUECKE. F1-F5 luden JEDESMAL
// NEU; ein Neuladen wirft jeden gehaltenen Zustand ohnehin weg, und deshalb fiel nicht auf, dass
// eine getroffene Wahl eine LEERE Auffrischung ueberlebte und unsichtbar mitreiste. F6 geht den
// Weg des Menschen IN DERSELBEN SITZUNG (waehlen → Tab „Fragen" → Tab „Erfassen" → leere Antwort →
// senden), F7 dieselbe Frage waehrend einer noch haengenden Auffrischung, F8 haelt die gelieferten
// Namen Zeichen fuer Zeichen fest (" Technik " ist NICHT "Technik"). Rot-Nachweis wie oben, im
// Speicher: K-d stellt die zwei Zeilen von Runde 4 wieder her → F6 faellt; K-e stellt das
// Beschneiden wieder her → F8 faellt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Buehne,
  HTML,
  KLICK,
  SICHTBAR,
  SPRACHEN,
  TEXT,
  WERT,
  ZAEHLEN,
  buehneBauen,
  wort,
  zielTextZeile,
  zielbildDa,
} from "../design/k2-buehne";

/** Die Markierung, mit der die Flaeche ihren Ruhezustand zeigt (zwei Absaetze wie im Zielbild). */
const MARKIERUNG = "Erster Absatz der Markierung.\nZweiter Absatz der Markierung.";

/**
 * Die Antwort auf `GET /api/categories` — oder ein Netzabbruch („abbruch"), wie bei `DraftPlan`.
 * `halten: true` haelt die Antwort zurueck, bis `freigebenKategorien()` gerufen wird (RUNDE 5: die
 * Lage „Auffrischung laeuft noch" — BENs zweite Pruefluecke).
 */
type KategorienPlan = { status: number; body: unknown; halten?: boolean } | "abbruch";

/** Die Optionen der Zeile, so wie sie wirklich im Fenster stehen: Wert und sichtbarer Text. */
const OPTIONEN = `() => Array.from(document.querySelectorAll('#capture-bereich option')).map((o) => o.value + '|' + o.textContent)`;
/** Waehlen wie ein Mensch: Wert setzen und `change` ausloesen (das Ereignis, an dem das Panel haengt). */
const WAEHLEN = `([sel, wert]) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  el.value = wert;
  if (el.value !== wert) return false;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}`;

let b: Buehne | null = null;
let fehler: string | null = null;
/** Was die Route dieser Datei antwortet — je Fall gesetzt, VOR dem `oeffnen()`. */
let plan: KategorienPlan = { status: 200, body: { categories: [] } };
/** Die zurueckgehaltenen Antworten auf `GET /api/categories` (Plan `halten`). */
const gehalteneKategorien: Array<() => void> = [];
async function freigebenKategorien(): Promise<void> {
  const los = gehalteneKategorien.splice(0, gehalteneKategorien.length);
  for (const l of los) l();
  await new Promise((r) => setTimeout(r, 50));
}

function buehne(): Buehne {
  expect(fehler, "Seite nicht geladen").toBeNull();
  expect(b).not.toBeNull();
  return b as Buehne;
}
const lies = <T>(q: string, arg?: unknown) => buehne().lies<T>(q, arg);

/** Warten, bis die erste Option der Zeile den erwarteten Text traegt (die Lage ist erreicht). */
async function warteAufErsteOption(erwarteterErsterWert: string): Promise<void> {
  await buehne().seite.waitForFunction(
    new Function(
      "arg",
      "return ((t) => { const el = document.querySelector('#capture-bereich option'); return !!el && el.textContent === t; })(arg);",
    ) as (a: unknown) => unknown,
    erwarteterErsterWert,
    { timeout: 10_000 },
  );
}

/** Die Seite neu laden und warten, bis die Bereich-Zeile ihre Lage erreicht hat. */
async function oeffnenMit(neu: KategorienPlan, erwarteterErsterWert: string): Promise<void> {
  plan = neu;
  await buehne().oeffnen();
  await warteAufErsteOption(erwarteterErsterWert);
}

/**
 * Die Flaeche VERLASSEN und neu betreten — OHNE Neuladen, in DERSELBEN Sitzung. Das ist der Weg
 * eines Menschen (Tab „Fragen", dann wieder „Erfassen") und der Anlass, an dem `setTab` die
 * Bereiche frisch holt. RUNDE 5: genau dieser Uebergang fehlte — alle Faelle luden neu, und ein
 * Neuladen wirft jeden gehaltenen Zustand ohnehin weg.
 */
async function zurueckAufDieFlaeche(
  neu: KategorienPlan,
  erwarteterErsterWert: string,
): Promise<void> {
  plan = neu;
  expect(await lies<boolean>(KLICK, "#tab-ask")).toBe(true);
  expect(await lies<boolean>(KLICK, "#tab-capture")).toBe(true);
  await warteAufErsteOption(erwarteterErsterWert);
}

/** Senden und auf die Nutzlast warten, die dabei wirklich hinausging. */
async function sendenUndLesen(): Promise<Record<string, unknown>> {
  const bu = buehne();
  const vorher = bu.posts.length;
  expect(await lies<boolean>(KLICK, "#send-btn")).toBe(true);
  for (let i = 0; i < 100 && bu.posts.length === vorher; i += 1) {
    await new Promise((r) => setTimeout(r, 50));
  }
  expect(bu.posts.length, "kein POST /api/drafts angekommen").toBe(vorher + 1);
  const post = bu.posts[vorher];
  expect(post?.url).toBe("/api/drafts");
  return (post as { koerper: Record<string, unknown> }).koerper;
}

describe.runIf(zielbildDa)(
  "JOB 3555 · K2b · die Bereich-Zeile — das ausgelieferte taskpane.html in Chromium bei 360 px",
  () => {
    beforeAll(async () => {
      try {
        b = await buehneBauen({ markierung: MARKIERUNG });
        // Die eigene Route ZUERST registrieren: Playwright prueft die zuletzt angemeldete Route
        // zuerst, die Auffangroute der Buehne (`**/*`, sie antwortet sonst 404) kommt danach.
        await b.seite.route("**/api/categories*", async (route) => {
          // Der Plan wird BEIM EINGANG festgehalten — dieselbe Regel wie bei `/api/drafts` in der
          // Buehne: ein spaeter geaenderter Plan trifft nur spaetere Anfragen.
          const jetzt = plan;
          if (jetzt === "abbruch") {
            await route.abort("internetdisconnected");
            return;
          }
          if (jetzt.halten === true) {
            await new Promise<void>((los) => {
              gehalteneKategorien.push(los);
            });
          }
          await route.fulfill({
            status: jetzt.status,
            body: JSON.stringify(jetzt.body),
            contentType: "application/json",
          });
        });
        await oeffnenMit(
          { status: 200, body: { categories: [{ name: "Technik", count: 3 }] } },
          wort("de", "captureBereichWahl"),
        );
        console.info(
          `JOB 3555 K2b · Chromium ${b.version} · Seitenfehler ${JSON.stringify(b.seitenfehler)}`,
        );
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 3).join(" | ");
      }
    }, 120_000);

    afterAll(async () => {
      await b?.schliessen();
    }, 60_000);

    // ---- F1: die Zeile ---------------------------------------------------------------------------
    it("F1 · die Zeile steht GENAU EINMAL in #capture-felder, unter der Titelzeile, beschriftet in de/en/nl", async () => {
      expect(fehler).toBeNull();
      expect(await lies<boolean>(SICHTBAR, "#section-capture")).toBe(true);
      // Genau eine — im ganzen Fenster, nicht nur in der Flaeche.
      expect(await lies<number>(ZAEHLEN, "#capture-bereich")).toBe(1);
      expect(await lies<number>(ZAEHLEN, "#capture-felder > label.capture-zeile")).toBe(2);
      // UNTER der Titelzeile: zweites Kind, in derselben Bauform (label.capture-zeile + Span).
      expect(
        await lies<number>(
          ZAEHLEN,
          "#capture-felder > label.capture-zeile:nth-child(1) > #capture-titel",
        ),
      ).toBe(1);
      expect(
        await lies<number>(
          ZAEHLEN,
          "#capture-felder > label.capture-zeile:nth-child(2) > #capture-bereich",
        ),
      ).toBe(1);
      expect(await lies<boolean>(SICHTBAR, "#capture-bereich")).toBe(true);
      // Die Beschriftung ist Pedis Wort aus dem Zielbild (Z.40) — nicht dieses Tests Erfindung.
      const sel = "#capture-felder > label.capture-zeile:nth-child(2) > span";
      expect(await lies<string>(TEXT, sel)).toBe(zielTextZeile(40));
      expect(wort("de", "captureBereichLabel")).toBe(zielTextZeile(40));
      // Drei Sprachen, drei Fassungen — ueber denselben data-t-Mechanismus wie „Titel".
      try {
        for (const sprache of SPRACHEN) {
          await lies<boolean>(KLICK, `#lang-${sprache}`);
          await buehne().seite.waitForFunction(
            new Function(
              "arg",
              "return ((t) => document.querySelector('[data-t=captureBereichLabel]').textContent === t)(arg);",
            ) as (a: unknown) => unknown,
            wort(sprache, "captureBereichLabel"),
            { timeout: 10_000 },
          );
          expect(await lies<string>(TEXT, sel), sprache).toBe(wort(sprache, "captureBereichLabel"));
        }
        expect(new Set(SPRACHEN.map((s) => wort(s, "captureBereichLabel"))).size).toBe(3);
      } finally {
        await lies<boolean>(KLICK, "#lang-de");
      }
    }, 40_000);

    // ---- F2: die Namen kommen vom Server ---------------------------------------------------------
    it("F2 · zwei gelieferte Bereiche stehen zur Wahl — genau diese, in dieser Reihenfolge, kein dritter", async () => {
      await oeffnenMit(
        {
          status: 200,
          body: {
            categories: [
              { name: "Technik", count: 3 },
              { name: "Recht", count: 1 },
            ],
          },
        },
        wort("de", "captureBereichWahl"),
      );
      const optionen = await lies<string[]>(OPTIONEN);
      console.info(`JOB 3555 K2b · F2 · Optionen ${JSON.stringify(optionen)}`);
      expect(optionen).toEqual([
        `|${wort("de", "captureBereichWahl")}`,
        "Technik|Technik",
        "Recht|Recht",
      ]);
      // Die Zahl `count` steht NIRGENDS in der Zeile: sie beschreibt den sichtbaren Bestand des
      // Fragenden und waere ohne diesen Zusatz als Gesamtbestand zu lesen (Auftrag §5.5).
      expect(await lies<string>(TEXT, "#capture-bereich")).not.toContain("3");
      // Waehlbar ist die Zeile erst jetzt — in den anderen Lagen gibt es nichts zu waehlen.
      expect(
        await lies<boolean>("() => !document.getElementById('capture-bereich').disabled"),
      ).toBe(true);
    }, 60_000);

    // ---- F3: erfolgreich leer --------------------------------------------------------------------
    it("F3 · leere Antwort: die Zeile bleibt sichtbar, spricht vom EIGENEN Bestand — und Senden bleibt moeglich", async () => {
      await oeffnenMit({ status: 200, body: { categories: [] } }, wort("de", "captureBereichLeer"));
      expect(await lies<boolean>(SICHTBAR, "#capture-bereich")).toBe(true);
      expect(await lies<string[]>(OPTIONEN)).toEqual([`|${wort("de", "captureBereichLeer")}`]);
      // KEINE Behauptung ueber die Welt: der Satz sagt „in deinem Bestand", nicht „es gibt keine".
      for (const sprache of SPRACHEN) {
        const satz = wort(sprache, "captureBereichLeer").toLowerCase();
        expect(satz, sprache).toMatch(/dein|jouw|your/);
      }
      // Der Weg bleibt offen: der Knopf ist frei, und ohne Wahl geht kein Feld hinaus.
      expect(await lies<boolean>("() => document.getElementById('send-btn').disabled")).toBe(false);
      const koerper = await sendenUndLesen();
      expect(Object.keys(koerper)).not.toContain("category");
    }, 60_000);

    // ---- F4: Fehler und Abbruch ------------------------------------------------------------------
    for (const [name, dieser] of [
      ["Serverfehler 500", { status: 500, body: { error: "BOOM" } } as KategorienPlan],
      ["Abbruch (offline)", "abbruch" as KategorienPlan],
    ] as const) {
      it(`F4 · ${name}: ehrlicher Satz statt leerer Liste — und Senden bleibt moeglich`, async () => {
        await oeffnenMit(dieser, wort("de", "captureBereichFehler"));
        expect(await lies<boolean>(SICHTBAR, "#capture-bereich")).toBe(true);
        expect(await lies<string[]>(OPTIONEN)).toEqual([`|${wort("de", "captureBereichFehler")}`]);
        // Der Fehler wird NICHT als „kein Bereich vorhanden" ausgegeben — die zwei Saetze sind zwei.
        expect(await lies<string>(TEXT, "#capture-bereich")).not.toBe(
          wort("de", "captureBereichLeer"),
        );
        expect(wort("de", "captureBereichFehler")).not.toBe(wort("de", "captureBereichLeer"));
        const koerper = await sendenUndLesen();
        expect(koerper.title).toBe("Erster Absatz der Markierung.");
        expect(Object.keys(koerper)).not.toContain("category");
      }, 60_000);
    }

    // ---- F5: die Wahl reist mit ------------------------------------------------------------------
    it("F5 · Auswahl getroffen → die Nutzlast traegt `category` mit genau diesem Wert; keine Auswahl → das Feld fehlt", async () => {
      await oeffnenMit(
        {
          status: 200,
          body: {
            categories: [
              { name: "Technik", count: 3 },
              { name: "Recht", count: 1 },
            ],
          },
        },
        wort("de", "captureBereichWahl"),
      );
      // (a) ohne Wahl: die Nutzlast ist die von vorher — kein `""`, kein `null`, kein Feld.
      const ohne = await sendenUndLesen();
      expect(Object.keys(ohne)).not.toContain("category");
      expect(ohne.origin).toBe("word_addin");
      // (b) mit Wahl: genau dieser Wert.
      expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", "Recht"])).toBe(true);
      const mit = await sendenUndLesen();
      console.info(`JOB 3555 K2b · F5 · Nutzlast ${JSON.stringify(Object.keys(mit))}`);
      expect(mit.category).toBe("Recht");
      // Sonst hat sich an der Nutzlast nichts geaendert: Titel, Text, Herkunft, Rumpf stehen.
      expect(mit.title).toBe(ohne.title);
      expect(mit.statement).toBe(ohne.statement);
      expect(mit.bodyHtml).toBe(ohne.bodyHtml);
      expect(mit.origin).toBe("word_addin");
      // (c) zurueck auf den Platzhalter: das Feld verschwindet wieder.
      expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", ""])).toBe(true);
      const wiederOhne = await sendenUndLesen();
      expect(Object.keys(wiederOhne)).not.toContain("category");
    }, 60_000);

    // ---- F6: der Uebergang IN DERSELBEN SITZUNG — sichtbarer Zustand und Nutzlast sind eins ------
    // BENs Befund aus Runde 4: „Technik" waehlen, die Flaeche verlassen, mit einer LEEREN Antwort
    // zurueckkehren, senden — sichtbar stand „Noch kein Bereich in deinem Bestand", der POST trug
    // aber weiter `"category":"Technik"`. Ein unsichtbarer alter Bereich, der mitreist. Hier wird
    // genau dieser Weg gegangen: OHNE Neuladen, mit dem POST als Beleg.
    it("F6 · Wahl → Flaeche verlassen → leere Antwort: die Wahl faellt sichtbar UND in der Nutzlast", async () => {
      await oeffnenMit(
        {
          status: 200,
          body: {
            categories: [
              { name: "Technik", count: 3 },
              { name: "Recht", count: 1 },
            ],
          },
        },
        wort("de", "captureBereichWahl"),
      );
      // (1) Die Wahl ist wirklich getroffen — und sie reist, solange sie belegt ist.
      expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", "Technik"])).toBe(true);
      expect((await sendenUndLesen()).category).toBe("Technik");
      // (2) Dieselbe Sitzung, neuer Anlass: raus aus der Flaeche, rein in die Flaeche — und der
      //     Bestand gibt jetzt nichts mehr her.
      await zurueckAufDieFlaeche(
        { status: 200, body: { categories: [] } },
        wort("de", "captureBereichLeer"),
      );
      expect(await lies<string[]>(OPTIONEN)).toEqual([`|${wort("de", "captureBereichLeer")}`]);
      expect(await lies<string>(WERT, "#capture-bereich")).toBe("");
      // (3) Der Beleg, um den es geht: was nicht sichtbar ist, geht auch nicht hinaus.
      const koerper = await sendenUndLesen();
      console.info(
        `JOB 3555 K2b · F6 · sichtbar "" · Nutzlast ${JSON.stringify(Object.keys(koerper))}`,
      );
      expect(Object.keys(koerper)).not.toContain("category");
      expect(koerper.title).toBe("Erster Absatz der Markierung.");
      // Und der Weg bleibt offen: die leere Lage sperrt das Erfassen nicht.
      expect(await lies<boolean>("() => document.getElementById('send-btn').disabled")).toBe(false);
    }, 90_000);

    // ---- F7: senden, WAEHREND die Auffrischung noch laeuft ----------------------------------------
    it("F7 · waehrend die Auffrischung haengt, geht kein Bereich hinaus — danach steht die belegte Wahl wieder", async () => {
      await oeffnenMit(
        {
          status: 200,
          body: {
            categories: [
              { name: "Technik", count: 3 },
              { name: "Recht", count: 1 },
            ],
          },
        },
        wort("de", "captureBereichWahl"),
      );
      expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", "Technik"])).toBe(true);
      try {
        // Die Antwort bleibt haengen: die Zeile steht in der Lage „laedt" — nichts ist belegt.
        await zurueckAufDieFlaeche(
          { status: 200, body: { categories: [{ name: "Technik", count: 3 }] }, halten: true },
          wort("de", "captureBereichLaedt"),
        );
        expect(await lies<string[]>(OPTIONEN)).toEqual([`|${wort("de", "captureBereichLaedt")}`]);
        expect(
          await lies<boolean>("() => document.getElementById('capture-bereich').disabled"),
        ).toBe(true);
        const waehrend = await sendenUndLesen();
        console.info(
          `JOB 3555 K2b · F7 · waehrend der Auffrischung ${JSON.stringify(Object.keys(waehrend))}`,
        );
        expect(Object.keys(waehrend)).not.toContain("category");
      } finally {
        await freigebenKategorien();
      }
      // Jetzt ist die Wahl wieder belegt: die Antwort fuehrt „Technik", also steht sie auch wieder
      // in der Zeile — und reist mit. Das ist die andere Haelfte der Ehrlichkeit.
      await warteAufErsteOption(wort("de", "captureBereichWahl"));
      expect(await lies<string>(WERT, "#capture-bereich")).toBe("Technik");
      expect((await sendenUndLesen()).category).toBe("Technik");
    }, 90_000);

    // ---- F8: gelieferte Namen bleiben, was sie sind -----------------------------------------------
    // BENs zweiter Befund: aus dem gelieferten `" Technik "` machte das Panel `"Technik"`. Der
    // Bestand vergleicht Bereichsnamen exakt (`category-routes.ts:33`) — ein umgeschriebener Name
    // bezeichnet einen anderen Bereich, und zwei am Rand unterschiedliche Namen fielen zu einem
    // zusammen. Gemessen wird an den Optionen UND an der Nutzlast.
    it("F8 · zwei nur am Rand verschiedene Namen bleiben zwei — und der gewaehlte reist Zeichen fuer Zeichen", async () => {
      await oeffnenMit(
        {
          status: 200,
          body: {
            categories: [
              { name: " Technik ", count: 3 },
              { name: "Technik", count: 1 },
              { name: "   ", count: 9 },
            ],
          },
        },
        wort("de", "captureBereichWahl"),
      );
      const optionen = await lies<string[]>(OPTIONEN);
      console.info(`JOB 3555 K2b · F8 · Optionen ${JSON.stringify(optionen)}`);
      // Der Name aus lauter Leerzeichen ist KEIN Name — er faellt weg. Die beiden anderen bleiben
      // unterscheidbar, in gelieferter Reihenfolge.
      expect(optionen).toEqual([
        `|${wort("de", "captureBereichWahl")}`,
        " Technik | Technik ",
        "Technik|Technik",
      ]);
      expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", " Technik "])).toBe(true);
      const mit = await sendenUndLesen();
      console.info(`JOB 3555 K2b · F8 · Nutzlast category ${JSON.stringify(mit.category)}`);
      expect(mit.category).toBe(" Technik ");
    }, 90_000);

    it("P · Protokoll: Seitenfehler des laufenden Panels (Chromium pageerror) — keine", () => {
      const bu = buehne();
      console.info(
        `JOB 3555 K2b · Seitenfehler: ${bu.seitenfehler.length === 0 ? "keine" : bu.seitenfehler.join(" | ")}`,
      );
      expect(bu.seitenfehler).toEqual([]);
    });

    // ---- KALIBRIERUNGEN: laden verstellte Fassungen, deshalb ZULETZT ------------------------------
    it("K-a · Kalibrierung: eine hartkodierte Liste laesst F2 fallen — die Namen kommen wirklich vom Server", async () => {
      const bu = buehne();
      const anker =
        "      return raus;\n    }\n\n    /**\n     * Die Bereiche beim Betreten der Flaeche frisch holen";
      expect(bu.plan.html.split(anker).length, "Anker im Skript nicht eindeutig").toBe(2);
      const verstellt = bu.plan.html.replace(
        anker,
        '      return ["Technik", "Recht"];\n    }\n\n    /**\n     * Die Bereiche beim Betreten der Flaeche frisch holen',
      );
      expect(verstellt).not.toBe(bu.plan.html);
      bu.plan.html = verstellt;
      try {
        // Der Server liefert jetzt etwas ANDERES. Eine ehrliche Zeile zeigte „Bau"; die verstellte
        // Fassung zeigt weiter Technik/Recht — genau das faengt F2.
        await oeffnenMit(
          { status: 200, body: { categories: [{ name: "Bau", count: 7 }] } },
          wort("de", "captureBereichWahl"),
        );
        const optionen = await lies<string[]>(OPTIONEN);
        console.info(`JOB 3555 K2b · Kalibrierung a · Optionen ${JSON.stringify(optionen)}`);
        expect(optionen).not.toEqual([`|${wort("de", "captureBereichWahl")}`, "Bau|Bau"]);
        expect(optionen).toEqual([
          `|${wort("de", "captureBereichWahl")}`,
          "Technik|Technik",
          "Recht|Recht",
        ]);
      } finally {
        bu.plan.html = HTML;
      }
    }, 90_000);

    it("K-b · Kalibrierung: ohne `category` in der Nutzlast faellt F5 — die Wahl reist wirklich mit", async () => {
      const bu = buehne();
      const anker = 'bodyHtml: bodyHtml, category: category, origin: "word_addin" });';
      expect(bu.plan.html.split(anker).length, "Anker in draftPostPayload nicht eindeutig").toBe(2);
      bu.plan.html = bu.plan.html.replace(anker, 'bodyHtml: bodyHtml, origin: "word_addin" });');
      try {
        await oeffnenMit(
          { status: 200, body: { categories: [{ name: "Recht", count: 1 }] } },
          wort("de", "captureBereichWahl"),
        );
        expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", "Recht"])).toBe(true);
        const koerper = await sendenUndLesen();
        console.info(
          `JOB 3555 K2b · Kalibrierung b · Nutzlast ${JSON.stringify(Object.keys(koerper))}`,
        );
        // Die EINE Aussage von F5 kippt — und nur sie: der Rest der Nutzlast steht unveraendert.
        expect(Object.keys(koerper)).not.toContain("category");
        expect(koerper.title).toBe("Erster Absatz der Markierung.");
        expect(koerper.origin).toBe("word_addin");
      } finally {
        bu.plan.html = HTML;
      }
    }, 90_000);

    // ---- K-d / K-e: DIE ZWEI FEHLER DER RUNDE 4, IM SPEICHER WIEDERHERGESTELLT -------------------
    // Nicht behauptet, dass F6 und F8 etwas faengen — gemessen: die beiden Zeilen von Runde 4
    // werden zurueckgesetzt, und genau die neuen Faelle fallen.
    it("K-d · Kalibrierung: mit dem Stand von Runde 4 faellt F6 — der unsichtbare alte Bereich reist wieder mit", async () => {
      const bu = buehne();
      const stellen: ReadonlyArray<readonly [string, string]> = [
        // (1) Die erfolgreiche LEERE Antwort verwarf die gehaltene Wahl nicht.
        ['if (namen.length === 0) { captureBereichWahl = ""; }\n          ', ""],
        // (2) Gesendet wurde der gehaltene Zustand statt des sichtbaren.
        ["var bereichWahl = captureBereichGewaehlt();", "var bereichWahl = captureBereichWahl;"],
      ];
      let verstellt = bu.plan.html;
      for (const [anker, ersatz] of stellen) {
        expect(verstellt.split(anker).length, `Anker nicht eindeutig: ${anker.slice(0, 48)}`).toBe(
          2,
        );
        verstellt = verstellt.replace(anker, ersatz);
      }
      expect(verstellt).not.toBe(bu.plan.html);
      bu.plan.html = verstellt;
      try {
        await oeffnenMit(
          { status: 200, body: { categories: [{ name: "Technik", count: 3 }] } },
          wort("de", "captureBereichWahl"),
        );
        expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", "Technik"])).toBe(true);
        await zurueckAufDieFlaeche(
          { status: 200, body: { categories: [] } },
          wort("de", "captureBereichLeer"),
        );
        // Sichtbar ist nichts gewaehlt — das war in Runde 4 schon so und ist nicht der Fehler.
        expect(await lies<string>(WERT, "#capture-bereich")).toBe("");
        const koerper = await sendenUndLesen();
        console.info(
          `JOB 3555 K2b · Kalibrierung d · Nutzlast ${JSON.stringify(Object.keys(koerper))} · category ${JSON.stringify(koerper.category)}`,
        );
        // DAS ist der Fehler, den F6 faengt: der POST traegt einen Bereich, den niemand sieht.
        expect(koerper.category).toBe("Technik");
      } finally {
        bu.plan.html = HTML;
      }
    }, 90_000);

    it("K-e · Kalibrierung: mit dem Beschneiden von Runde 4 faellt F8 — zwei Namen werden zu einem", async () => {
      const bu = buehne();
      const anker = 'var name = eintrag && typeof eintrag.name === "string" ? eintrag.name : null;';
      expect(
        bu.plan.html.split(anker).length,
        "Anker in captureBereicheAusAntwort nicht eindeutig",
      ).toBe(2);
      bu.plan.html = bu.plan.html.replace(
        anker,
        'var name = eintrag && typeof eintrag.name === "string" ? eintrag.name.replace(/^\\s+|\\s+$/g, "") : null;',
      );
      try {
        await oeffnenMit(
          {
            status: 200,
            body: {
              categories: [
                { name: " Technik ", count: 3 },
                { name: "Technik", count: 1 },
              ],
            },
          },
          wort("de", "captureBereichWahl"),
        );
        const optionen = await lies<string[]>(OPTIONEN);
        console.info(`JOB 3555 K2b · Kalibrierung e · Optionen ${JSON.stringify(optionen)}`);
        // Die beiden gelieferten Namen sind nicht mehr unterscheidbar — genau das faengt F8.
        expect(optionen).toEqual([
          `|${wort("de", "captureBereichWahl")}`,
          "Technik|Technik",
          "Technik|Technik",
        ]);
        // Und der gelieferte Name laesst sich gar nicht mehr waehlen: es gibt ihn nicht.
        expect(await lies<boolean>(WAEHLEN, ["#capture-bereich", " Technik "])).toBe(false);
      } finally {
        bu.plan.html = HTML;
      }
    }, 90_000);

    // ---- K-c: DER RED-FIRST-NACHWEIS, GEMESSEN STATT BEHAUPTET ------------------------------------
    // Auftrag §6 verlangt „VOR dem Bau rot". Die Bahn darf die Produktdatei nicht auf einen anderen
    // Stand zuruecksetzen (kein `git checkout`, nichts von Hand am Produkt), also wird der Zustand
    // VOR diesem Job hier IM SPEICHER hergestellt: die Zeile aus dem Markup, ihr Zuhoerer und ihr
    // Abruf beim Betreten der Flaeche entfallen — genau die drei Stellen, die JOB 3555 hinzugefuegt
    // hat. Was dann faellt, ist der rote Ausgangsbefund; was oben gruen ist, ist der Bau.
    it("K-c · RED-FIRST: ohne die Zeile, ihren Zuhoerer und ihren Abruf fallen F1, F3, F4 und F5 — der Stand vor JOB 3555", async () => {
      const bu = buehne();
      const stellen: ReadonlyArray<readonly [string, string]> = [
        [
          '<label class="capture-zeile" for="capture-bereich"><span data-t="captureBereichLabel"></span><select id="capture-bereich" disabled></select></label>',
          "",
        ],
        [
          'document.getElementById("capture-bereich").addEventListener("change", function () {\n      captureBereichWahl = this.value;\n    });',
          "",
        ],
        [
          'if (name === "capture") { captureMarkierungLesen(); captureBereicheLesen(); }',
          'if (name === "capture") { captureMarkierungLesen(); }',
        ],
      ];
      let vorher = bu.plan.html;
      for (const [anker, ersatz] of stellen) {
        expect(vorher.split(anker).length, `Anker nicht eindeutig: ${anker.slice(0, 48)}`).toBe(2);
        vorher = vorher.replace(anker, ersatz);
      }
      bu.plan.html = vorher;
      const fehlerVorher = bu.seitenfehler.length;
      try {
        // Kein `oeffnenMit`: es wartet auf eine Option, die es hier gar nicht gibt.
        plan = {
          status: 200,
          body: { categories: [{ name: "Technik", count: 3 }] },
        };
        await bu.oeffnen();
        // (1) F1 faellt: die Zeile gibt es nicht — der Feldblock traegt nur „Titel".
        expect(await lies<number>(ZAEHLEN, "#capture-bereich")).toBe(0);
        expect(await lies<number>(ZAEHLEN, "#capture-felder > label.capture-zeile")).toBe(1);
        // (2) F3/F4 fallen mit: es gibt keine Zeile, die eine Lage benennen koennte — weder die
        //     ehrliche Leere noch den ehrlichen Fehler.
        expect(await lies<string[]>(OPTIONEN)).toEqual([]);
        // (3) Und der Abruf unterbleibt ganz: die Namen kaemen aus dem Nichts, wenn sie kaemen.
        //     Gemessen an der Seite, nicht am Quelltext — die Buehne zaehlt nur POSTs, deshalb hier
        //     ueber die Wirkung: kein Element, kein Zustand, keine Wahl.
        expect(await lies<boolean>("() => !document.getElementById('capture-bereich')")).toBe(true);
        // (4) F5 faellt: gesendet wird, was vor diesem Job gesendet wurde — ohne `category`.
        const koerper = await sendenUndLesen();
        console.info(
          `JOB 3555 K2b · RED-FIRST · Nutzlast ${JSON.stringify(Object.keys(koerper))} · Optionen 0`,
        );
        expect(Object.keys(koerper)).not.toContain("category");
        expect(koerper.title).toBe("Erster Absatz der Markierung.");
        expect(koerper.origin).toBe("word_addin");
        // (5) Der Beleg, dass hier wirklich die BESTANDSFASSUNG laeuft und keine kaputte: das Panel
        //     wirft keinen Fehler. Ein Rest, der ins Leere greift, waere hier zu sehen.
        expect(bu.seitenfehler.slice(fehlerVorher)).toEqual([]);
      } finally {
        bu.plan.html = HTML;
      }
    }, 90_000);
  },
);

describe.runIf(!zielbildDa)("JOB 3555 · K2b · Zielbild-Abgleich uebersprungen", () => {
  it("meldet das fehlende Zielbild statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa, "Zielbild nicht lesbar: design/klara/Erfassen.dc.html").toBe(false);
  });
});
