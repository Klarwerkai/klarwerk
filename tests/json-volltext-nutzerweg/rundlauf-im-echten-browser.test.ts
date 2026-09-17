// ================================================================================================
// JOB 4293 · B — DER SICHTBARE WEG: echtes Chromium, echte Dateiauswahl, echter HTTP-Socket.
// ================================================================================================
//
// DIE FRAGE, DIE NUR HIER BEANTWORTET WIRD: Kommt der Volltext dort an, wo der MENSCH ihn braucht —
// auf der Prüfkarte, VOR dem Annehmen? `rundlauf-am-echten-socket.test.ts` misst die Datenkette und
// sagt selbst, dass er über den Bedienweg nichts aussagt. Die vorhandene Anzeigeprüfung des
// Confluence-Strangs (`tests/import-volltext/pruefkarte-zeigt-volltext-und-quelle.test.tsx`, JOB
// 3288) läuft in jsdom und beginnt bei einem fertigen Kandidaten — weder Datei noch Dateiauswahl
// noch „Annehmen" noch der Zielbestand kommen darin vor. Beide bleiben unverändert stehen.
//
// WAS HIER ECHT IST: ein echter Chromium (`starteChromium`), die echte gebaute Fläche
// (`registerWebStatic` vor dem Horchen, wie `server.ts:66`), ein echter Port, die echte
// Anmeldemaske mit echten Tastendrücken, der echte `<input type="file">` der Import-Seite und am
// Ende ein FRISCHES Browserprofil, das die Leseansicht des Zielobjekts von vorn lädt.
//
// KEIN ZWEITER ANZEIGEWEG: die Karte zeichnet den Volltext mit `ImportVolltextAufklapper`
// (`apps/web/src/pages/Stufe2.tsx`) — demselben Bauteil, das der Confluence-Strang benutzt. Dieser
// Auftrag hat daran kein Zeichen geändert; er hat dafür gesorgt, dass überhaupt etwas ankommt.
//
// DER ABLAUF STEHT NICHT HIER, sondern in `flaeche.ts` — er wird von der PostgreSQL-Fassung
// (`rundlauf-pg.integration.test.ts`) mit demselben Wortlaut gefahren.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  liesImFrischenProfil,
  stelleFlaecheBereit,
} from "../fassungsrueckholung-echter-browser/weg";
import { type Browser, DIST, mitFlaeche, starteChromium } from "../gast-nutzerweg/browserweg";
import {
  type Sitzung,
  type Strecke,
  ersteinrichtung,
  starteStrecke,
} from "../gast-nutzerweg/strecke";
import { T, fahreDenGrenzfall, fahreDenSichtbarenRundlauf, pruefeFlaechenzusage } from "./flaeche";
import {
  JOB,
  KERNAUSSAGE,
  LETZTER_ABSATZ,
  OHNE_VOLLTEXT_MARKE,
  TITEL,
  TITEL_OHNE,
  VOLLTEXT_MARKE,
  exportEintrag,
  exportdatei,
  exportiere,
  freigeben,
  legeQuellobjektAn,
  mitMutation,
  mussVolltextTragen,
  volltextHtml,
} from "./weg";

const ADMIN = "browser@volltext-4293.test";
const TAGS = ["dichtung", "presse-7"];

let browser: Browser | undefined;
// ZWEI INSTANZEN: `quellStrecke` exportiert, `zielStrecke` ist die FRISCHE, die der Browser bedient.
// Warum zwei und nicht eine, steht bei `Rundlaufinstanzen` in `weg.ts` — in einer Instanz wäre der
// Wiedereinspieler richtigerweise eine Dublette, und der Prüfstand hätte den Dublettenschutz
// gemessen statt den Volltext. Nur die ZIELinstanz braucht die gebaute Fläche; die Quelle wird
// ausschliesslich über HTTP abgefragt.
let quellStrecke: Strecke | undefined;
let zielStrecke: Strecke | undefined;
let quelle: Sitzung;
let ziel: Sitzung;
let flaeche = "nicht hergestellt";
let bereit = false;

beforeAll(async () => {
  // PRÜFGRENZE, LAUT GEMELDET (Auftrag § 7): Ohne Playwright gibt es keinen sichtbaren Weg zu
  // messen. Ein stiller Übersprung sähe aus wie ein bestandener Lauf — der Grund geht deshalb auf
  // stderr. Im Tor ist beides da (`tools/check:9` baut, die Browsergruppe fährt Chromium).
  try {
    createRequire(import.meta.url).resolve("playwright");
  } catch {
    process.stderr.write(
      `[KLARWERK] ${JOB} B ÜBERSPRUNGEN: kein Playwright verfügbar — der sichtbare Weg (Chromium, echte Dateiauswahl) ist damit nicht messbar.\n`,
    );
    return;
  }
  flaeche = stelleFlaecheBereit();
  if (!existsSync(join(DIST, "index.html"))) {
    process.stderr.write(
      `[KLARWERK] ${JOB} B ÜBERSPRUNGEN: ${DIST}/index.html fehlt auch nach dem Bau.\n`,
    );
    return;
  }
  browser = await starteChromium();
  quellStrecke = await starteStrecke();
  zielStrecke = await starteStrecke(mitMutation(undefined, mitFlaeche().vorListen));
  quelle = (await ersteinrichtung(quellStrecke, ADMIN)).sitzung;
  ziel = (await ersteinrichtung(zielStrecke, ADMIN)).sitzung;
  process.stderr.write(`[KLARWERK] ${JOB} · Prüfstand: Chromium · Fläche: ${flaeche}\n`);
  bereit = true;
}, 1_200_000);

afterAll(async () => {
  await browser?.close();
  await quellStrecke?.schliessen();
  await zielStrecke?.schliessen();
}, 120_000);

describe(`${JOB} · B · der sichtbare Weg im echten Browser`, () => {
  it("B1 · Datei wählen, den GANZEN Text lesen, bewusst annehmen — und er steht im Zielbestand", async (ctx) => {
    if (!bereit || !browser || !zielStrecke) {
      ctx.skip();
      return;
    }
    const titel = `${TITEL} · Browser`;
    // ── Die Ausgangsdatei entsteht aus einem ECHTEN Export der QUELLinstanz, nicht aus einer
    //    Erfindung. Der Browser bedient danach ausschliesslich die Zielinstanz. ────────────────
    const quellId = await legeQuellobjektAn(quelle, {
      titel,
      kern: KERNAUSSAGE,
      volltext: volltextHtml(),
      tags: TAGS,
    });
    await freigeben(quelle, quellId);
    const quellEintrag = exportEintrag(await exportiere(quelle), titel);
    mussVolltextTragen("die Ausgangsdatei", quellEintrag.bodyHtml);

    const befund = await fahreDenSichtbarenRundlauf({
      browser,
      strecke: zielStrecke,
      admin: ziel,
      email: ADMIN,
      titel,
      dateiInhalt: exportdatei([quellEintrag]),
      letzterAbsatz: LETZTER_ABSATZ,
    });
    pruefeFlaechenzusage(befund, LETZTER_ABSATZ);

    // ── DER ZIELBESTAND, in einem FRISCHEN Profil von vorn geladen. ──────────────────────────
    const imFrischenProfil = await liesImFrischenProfil(
      browser,
      zielStrecke.basis,
      ADMIN,
      befund.kandidat.koId as string,
      titel,
    );
    expect(
      imFrischenProfil,
      `${JOB}: B1 · die Leseansicht des Zielobjekts zeigt den Volltext nicht.`,
    ).toContain(VOLLTEXT_MARKE);
    expect(imFrischenProfil, `${JOB}: B1 · die Leseansicht zeigt nicht den GANZEN Text.`).toContain(
      LETZTER_ABSATZ,
    );
  }, 900_000);

  it("B2 · reist kein Volltext mit, steht dort eine benannte Grenze — kein leeres Feld", async (ctx) => {
    if (!bereit || !browser || !zielStrecke) {
      ctx.skip();
      return;
    }
    const titel = `${TITEL_OHNE} · Browser`;
    const { satz, seitentext } = await fahreDenGrenzfall({
      browser,
      strecke: zielStrecke,
      email: ADMIN,
      titel,
      dateiInhalt: JSON.stringify([
        {
          title: titel,
          statement: `Kurznotiz ${OHNE_VOLLTEXT_MARKE} ohne jeden Fliesstext.`,
          type: "technik",
          category: "Wartung",
        },
      ]),
    });
    // Der Satz stammt aus DEM Katalog des Hauses und wird nicht hier eingetippt.
    expect(satz, `${JOB}: B2 · die Grenze steht nicht im Wortlaut des Katalogs.`).toBe(
      T("imp.fullText.missing"),
    );
    expect(
      seitentext,
      `${JOB}: B2 · es steht ein Volltext da, den die Datei nie hatte.`,
    ).not.toContain(VOLLTEXT_MARKE);
  }, 900_000);

  it("B3 · dieser Ordner startet KEINEN eigenen Chromium — der Start bleibt die eine Stelle", () => {
    // `tests/tor-inventar/tor-bestand-vollstaendig.test.ts:381` pinnt die Zahl der STARTdateien auf
    // 29. Ein eigener `require("playwright")` hier hätte sie erhöht, und jene Datei steht laut
    // Auftrag § 10 ausserhalb dieses Auftrags. Gemessen wird am Quelltext, nicht behauptet.
    //
    // Der Ordner wird aus der EIGENEN Adresse abgeleitet (`import.meta.url`), nicht aus dem
    // Arbeitsverzeichnis — dieser Fall soll auch dann messen, wenn der Lauf woanders startet.
    //
    // KOMMENTARE ZÄHLEN NICHT, und das ist gemessen und nicht vermutet: die erste Fassung dieses
    // Falls war rot an ihrer EIGENEN Erklärung (Arbeitsprüfung 13291110…) — mehrere Dateien dieses
    // Ordners erklären in Prosa, warum sie den Browser NICHT selbst starten, und nannten dabei den
    // Aufruf beim Namen. Genau diese Falle beschreibt `tests/tor-inventar/browser-gruppe.ts:21-24`
    // für den Bestand. Gesucht wird deshalb in Zeilen, die Code sind.
    const hier = dirname(fileURLToPath(import.meta.url));
    for (const datei of [
      "weg.ts",
      "flaeche.ts",
      "rundlauf-im-echten-browser.test.ts",
      "rundlauf-am-echten-socket.test.ts",
      "kalibrierung.test.ts",
      "rundlauf-pg.integration.test.ts",
      // Runde 2 (§ 9): die beiden Fassungen der Zustandskette. Die gemountete startet gar keinen
      // Browser, die andere holt ihn wie diese Datei aus `browserweg.ts`.
      "stand-der-pruefkarte-mounted.test.tsx",
      "stand-im-echten-browser.test.ts",
    ]) {
      const codezeilen = readFileSync(join(hier, datei), "utf8")
        .split("\n")
        .filter((zeile) => !/^\s*(\/\/|\*|\/\*)/.test(zeile));
      expect(codezeilen.join("\n"), `${datei} startet einen eigenen Browser`).not.toMatch(
        /require\(\s*["']playwright/,
      );
    }
  });
});
