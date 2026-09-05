// ================================================================================================
// JOB 3062 · H3 — DAS FUNKTIONSINVENTAR: keine Zeile „entfällt".
// ================================================================================================
//
// PEDI, 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs. Behalte die klare Linie bei. Wir haben sehr, sehr viele
// Informationsfunktionen."
//
// DER SCHADEN, GEGEN DEN DIESE DATEI STEHT, ist der einzige, der bei diesem Umbau wirklich weh tut:
// Eine Fläche wird ruhig — und dabei geht still etwas verloren. Drei Seiten mit 8158 Zeilen werden
// zu einem Blatt; wer das nur ansieht, kann nicht sagen, ob das Interview noch da ist.
//
// DESHALB IST DIE TABELLE AUS AUFTRAG §5a HIER EINE DATENLISTE, und der Test FÄHRT SIE NACH: für
// jede Zeile öffnet er in Chromium den genannten Ort (Menü klicken) und sucht das Element über
// seinen SICHTBAREN Text — so, wie ein Mensch es täte. Fehlt eines, ist der Fall rot und trägt den
// Namen der Funktion.
//
// GEMESSEN WIRD DIE GEBAUTE SEITE (`apps/web/dist`) an der echten Fastify-App, Theme `modern` —
// dieselbe Bühne wie die beiden anderen H3-Messungen (`h3-blatt-buehne.ts`).
//
// WAS DIESER TEST NICHT LEISTET, ausdrücklich: Er prüft, dass die Funktion ERREICHBAR ist, nicht
// dass sie tut, was sie verspricht. Dafür laufen die Fachprüfungen unter `tests/capture/` weiter.
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { BESTAND_KATEGORIE, type Buehne, MOCKUP, buehneAufbauen, fn } from "./h3-blatt-buehne";

/** Der deutsche Wortlaut zu einem Schlüssel — die Bühne läuft auf Deutsch. */
const de = (key: string): string => i18n.getFixedT("de")(key);

// ================================================================================================
// JOB 3062 R7 — DIE HILFE-KENNUNGEN DES BASISSTANDES 237b44c, ERHOBEN UND FESTGENAGELT.
// ================================================================================================
//
// Erhoben mit `git show 237b44c:apps/web/src/pages/{Capture,CaptureFrontDoor}.tsx | grep HelpTip`:
// 32 Aufrufe in `Capture.tsx`, 8 in `CaptureFrontDoor.tsx`. Nach Abzug der Mehrfachnennungen
// (`savedNext`, `readiness`, `discardHelp`, `docsImages` stehen je zweimal) bleiben 31 Themen:
// 23 aus der Hilfekarte (`lib/captureHelp.ts`, Schema `chelp.<id>.title|body`) und acht, die ihre
// Schlüssel unmittelbar am `HelpTip` trugen.
//
// SIE STEHEN HIER ALS EIGENER BESTAND und werden ausdrücklich NICHT aus
// `components/erfassen/hilfe.ts` importiert. Ein Test, der seine Erwartung aus der Quelle bezieht,
// die er misst, ist grün, sobald beide gleich falsch sind — genau die Bauart, die ben an der
// R6-Fassung (`>= 20 Themen`) beanstandet hat.
const CHELP_IDS_BASIS = [
  "modes",
  "expertPath",
  "wizardSteps",
  "loadExample",
  "tellRaw",
  "dictate",
  "tellUpload",
  "structureNow",
  "interview",
  "filePoints",
  "captureTitle",
  "saveDraftHelp",
  "discardHelp",
  "submitReview",
  "readiness",
  "savedNext",
  "advancedDetails",
  "knowledgeType",
  "assetField",
  "tagsField",
  "docsImages",
  "sourcesPanel",
  "expertForm",
] as const;

/** Titel- und Textschlüssel je Thema. */
const HILFE_KENNUNGEN_BASIS: readonly (readonly [string, string])[] = [
  ...CHELP_IDS_BASIS.map(
    (id) => [`chelp.${id}.title`, `chelp.${id}.body`] as readonly [string, string],
  ),
  // CaptureFrontDoor.tsx:1138
  ["conf.field", "conf.help"],
  // Capture.tsx:5018 — die Kennung, deren Verlust ben in Chromium gemessen hat.
  ["capture.help.category.title", "capture.help.category.body"],
  // Capture.tsx:5031
  ["capture.help.validations.title", "capture.help.validations.body"],
  // Capture.tsx:5108
  ["capture.reviewers.helpTitle", "capture.reviewers.helpBody"],
  // Capture.tsx:6043 (CAPTURE_WIZARD_TEXT.structData / .condMeasuresHint)
  ["capture.wizard.structData", "capture.wizard.condMeasuresHint"],
  // Capture.tsx:6089 (CAPTURE_WIZARD_TEXT.helpers / .helpersHint)
  ["capture.wizard.helpers", "capture.wizard.helpersHint"],
  // Capture.tsx:4676 (CAPTURE_FILE_TEXT.queryHelpTitle / .queryHelpBody)
  ["capture.file.queryHelp.title", "capture.file.queryHelp.body"],
  // Capture.tsx:4690 (CAPTURE_FILE_TEXT.langHelpTitle / .langHelpBody)
  ["capture.file.langHelp.title", "capture.file.langHelp.body"],
];

/**
 * Eine Zeile des Inventars: die Funktion von heute, ihre Fundstelle im alten Code und der Ort, an
 * dem sie im Blatt liegt. `menue` ist der Testanker des Werkzeugs, das geöffnet werden muss
 * (`null` = liegt offen auf der Fläche); `text` ist der sichtbare Wortlaut, den der Test sucht.
 */
interface Zeile {
  funktion: string;
  fundstelle: string;
  ort: string;
  /** Testanker des zu öffnenden Werkzeugs — oder null, wenn die Funktion offen sichtbar ist. */
  menue: string | null;
  /** Der sichtbare Text, über den das Element gefunden wird. */
  text?: string;
  /** Alternativ: ein Selektor, wenn die Funktion ein Feld und kein beschriftetes Element ist. */
  selektor?: string;
}

const INVENTAR: Zeile[] = [
  {
    funktion: "Freitext schreiben (Modus freitext)",
    fundstelle: "Capture.tsx:4234",
    ort: "Blatt: Text",
    menue: null,
    selektor: '[data-testid="blatt-text"] [role="textbox"]',
  },
  {
    funktion: "Diktat (Modus diktat)",
    fundstelle: "Capture.tsx:4240",
    ort: "Werkzeug „Diktieren“",
    menue: null,
    text: "Diktieren",
  },
  {
    funktion: "Interview (Modus interview)",
    fundstelle: "Capture.tsx:2059, 2220",
    ort: "Menü Datei ▾ → „Interview führen“",
    menue: "blatt-werkzeug-datei",
    text: "Interview führen",
  },
  {
    funktion: "Datei importieren (Modus datei)",
    fundstelle: "Capture.tsx:2233, 4547",
    ort: "Menü Datei ▾ → „Datei importieren“",
    menue: "blatt-werkzeug-datei",
    text: "Datei importieren",
  },
  {
    funktion: "Expertenformular (EXPERT_MODE)",
    fundstelle: "Capture.tsx:4262",
    ort: "Menü Datei ▾ → „Formular (Experten)“",
    menue: "blatt-werkzeug-datei",
    text: "Formular (Experten)",
  },
  {
    funktion: "„Alle Erfassungs-Modi“ / „Weitere Wege“",
    fundstelle: "CaptureFrontDoor.tsx:1096, 1633",
    ort: "Menü Datei ▾ — alle Wege an einem Ort",
    menue: "blatt-werkzeug-datei",
    text: "Datei importieren",
  },
  {
    funktion: "KI-Struktur vorschlagen",
    fundstelle: "CaptureFrontDoor.tsx:881",
    ort: "Menü KI ▾ → „Struktur vorschlagen“",
    menue: "blatt-werkzeug-ki",
    text: "Struktur vorschlagen",
  },
  {
    funktion: "KI-Hilfe „klarer“",
    fundstelle: "CaptureFrontDoor.tsx (KI-Hilfe anwenden)",
    ort: "Menü KI ▾",
    menue: "blatt-werkzeug-ki",
    text: "Klarer",
  },
  {
    funktion: "KI-Hilfe „strukturieren“",
    fundstelle: "CaptureFrontDoor.tsx (KI-Hilfe anwenden)",
    ort: "Menü KI ▾",
    menue: "blatt-werkzeug-ki",
    text: "Strukturieren",
  },
  {
    funktion: "KI-Hilfe „erweitern“",
    fundstelle: "CaptureFrontDoor.tsx (KI-Hilfe anwenden)",
    ort: "Menü KI ▾",
    menue: "blatt-werkzeug-ki",
    text: "Erweitern",
  },
  {
    funktion: "KI-Hilfe „Rechtschreibung“",
    fundstelle: "CaptureFrontDoor.tsx (KI-Hilfe anwenden)",
    ort: "Menü KI ▾",
    menue: "blatt-werkzeug-ki",
    text: "Rechtschreibung",
  },
  {
    funktion: "KI-Hilfe „formatieren“",
    fundstelle: "CaptureFrontDoor.tsx (KI-Hilfe anwenden)",
    ort: "Menü KI ▾",
    menue: "blatt-werkzeug-ki",
    text: "Formatieren",
  },
  {
    funktion: "Titel (optional, abgeleitet)",
    fundstelle: "CaptureFrontDoor.tsx:1119",
    ort: "Blatt: Titel",
    menue: null,
    selektor: '[data-testid="blatt-titel"]',
  },
  {
    funktion: "Vertraulichkeit (Pflicht, Egress)",
    fundstelle: "CaptureFrontDoor.tsx:1134",
    ort: "Menü Vertraulichkeit (rechts)",
    menue: "blatt-werkzeug-vertraulichkeit",
    text: "Vertraulich",
  },
  {
    funktion: "Bereich / Kategorie",
    fundstelle: "Capture.tsx (Formular)",
    ort: "Menü Bereich (rechts)",
    menue: "blatt-werkzeug-bereich",
    text: BESTAND_KATEGORIE,
  },
  {
    funktion: "Bild einfügen (Rich-Text mit Bildern)",
    fundstelle: "CaptureFrontDoor.tsx:1186, 1204",
    ort: "Werkzeug „Bild“",
    menue: null,
    text: "Bild",
  },
  {
    funktion: "Anhänge hochladen/auflisten",
    fundstelle: "Capture.tsx (Anhänge)",
    ort: "Menü … → „Anhänge“",
    menue: "blatt-werkzeug-mehr",
    text: "Anhänge",
  },
  {
    funktion: "Entwurfsliste, Entwurf fortsetzen",
    fundstelle: "Capture.tsx; frontdoor-draft-deeplink",
    ort: "Menü … → „Entwürfe“",
    menue: "blatt-werkzeug-mehr",
    text: "Entwürfe",
  },
  {
    funktion: "Status-Karte / Bereitschafts-Karte",
    fundstelle: "CaptureFrontDoor.tsx:1633",
    ort: "Menü … → „Status“",
    menue: "blatt-werkzeug-mehr",
    text: "Status",
  },
  {
    funktion: "Beispiel-Wissensobjekt (Intake-Leerzustand)",
    fundstelle: "KnowledgeIntake.tsx:IntakeEmptyState",
    ort: "Menü … → „Beispiel ansehen“",
    menue: "blatt-werkzeug-mehr",
    text: "Beispiel ansehen",
  },
  {
    funktion: "Klara-Teaser",
    fundstelle: "Capture.tsx:3592",
    ort: "Menü … → „Klara in Word“",
    menue: "blatt-werkzeug-mehr",
    text: "Klara in Word",
  },
  {
    funktion: "Entwurf speichern",
    fundstelle: "CaptureFrontDoor.tsx:1595",
    ort: "Knopf „Entwurf sichern“",
    menue: null,
    text: "Entwurf sichern",
  },
  {
    funktion: "Einreichen",
    fundstelle: "CaptureFrontDoor.tsx:1584",
    ort: "Knopf „Einreichen“",
    menue: null,
    text: "Einreichen",
  },
];

/**
 * In der Seite: (1) alle offenen Menüs schliessen, (2) das genannte Werkzeug klicken, (3) prüfen,
 * ob ein sichtbares Element mit genau diesem Wortlaut existiert. Der Vergleich ist auf normalisierte
 * Leerzeichen getrimmt — sonst zerbräche er an einem Zeilenumbruch im Markup.
 */
const RUHE = "await new Promise((r) => setTimeout(r, 30));";

const SUCHE = `async ([menueAnker, text, selektor]) => {
  // Erst ALLE Menüs schliessen (ein Klick nach aussen), dann eine Runde warten: React verarbeitet
  // den Zustandswechsel nicht im selben Durchlauf. Ohne diese Ruhe läse der nächste Klick den
  // ALTEN Offen-Zustand und würde das Menü wieder zuklappen statt es zu öffnen.
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  ${RUHE}
  if (menueAnker) {
    const werkzeug = document.querySelector('[data-testid="' + menueAnker + '"]');
    if (!werkzeug) return { ok: false, grund: 'Werkzeug fehlt: ' + menueAnker };
    werkzeug.click();
    ${RUHE}
  }
  if (selektor) {
    const el = document.querySelector(selektor);
    return { ok: el !== null, grund: el ? '' : 'Selektor leer: ' + selektor };
  }
  const kandidaten = [...document.querySelectorAll('button, a, [role=menuitem], summary')];
  const treffer = kandidaten.find((e) => (e.textContent || '').replace(/\\s+/g, ' ').trim() === text
    && e.getClientRects().length > 0);
  return { ok: treffer !== undefined, grund: treffer ? '' : 'Kein sichtbares Element mit Text: ' + text };
}`;

const mockupDa = existsSync(MOCKUP);

describe.runIf(mockupDa)(
  "JOB 3062 · H3 · Funktionsinventar — jede Funktion der drei alten Flächen hat im Blatt ihren Ort",
  () => {
    let b: Buehne;

    beforeAll(async () => {
      b = await buehneAufbauen("/erfassen");
    }, 120_000);

    afterAll(async () => {
      await b?.schliessen();
    }, 60_000);

    it("S · die Bühne steht", () => {
      expect(b.fehler).toBeNull();
      expect(b.seitenfehler).toEqual([]);
    });

    for (const zeile of INVENTAR) {
      it(`I · ${zeile.funktion} — ${zeile.ort} (heute: ${zeile.fundstelle})`, async () => {
        expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
        const ergebnis = await b.seite.evaluate<{ ok: boolean; grund: string }>(fn(SUCHE), [
          zeile.menue,
          zeile.text ?? null,
          zeile.selektor ?? null,
        ]);
        expect(ergebnis.ok, `${zeile.funktion} → ${zeile.ort}: ${ergebnis.grund}`).toBe(true);
      });
    }

    // ---- Die vier Zeilen, die kein Menüeintrag sind ----------------------------------------------
    //
    // Auftrag §5a verlangt für JEDE Funktion einen Ort — auch für die, die keine Liste ist. Sie
    // bekommen deshalb ihren eigenen Fall statt einer Fussnote.

    it("I · Standardweg (heute: Capture.tsx:3595 „Standardweg — Neues Wissensobjekt erfassen“) — das Blatt IST der Standardweg", async () => {
      expect(b.fehler).toBeNull();
      const lage = await b.seite.evaluate<{ blattDa: boolean; kastenDa: boolean }>(
        fn(`() => ({
          blattDa: document.querySelector('[data-testid="blatt"]') !== null,
          kastenDa: (document.body.innerText || '').includes('Standardweg'),
        })`),
      );
      // Die FUNKTION („hier fängst du an") ist erfüllt, weil das Blatt die Ruhelage der Seite ist.
      // Die ANZEIGE („Standardweg"-Kasten mit Empfehlungs-Badge) ist es, die verschwindet.
      expect(lage.blattDa).toBe(true);
      expect(lage.kastenDa).toBe(false);
    });

    // ==============================================================================================
    // JOB 3062 R7 (bens Korrekturpflicht 1) — JEDE HILFE-KENNUNG DES BASISSTANDES, EINZELN.
    // ==============================================================================================
    //
    // BENS URTEIL ZU R6, wörtlich: „Der Inventartest muss jede am Basisstand vorhandene
    // HelpTip-Kennung samt Titel und Text einzeln im geöffneten Hilfe-Menü nachweisen;
    // Mengenuntergrenzen sind unzulässig." R6 verlangte `>= 20` Themen — und war damit auch dann
    // grün, wenn `capture.help.category.*` fehlte. Genau das war der Fall.
    //
    // DIE LISTE UNTEN IST AM BASISSTAND ERHOBEN und steht hier als eigener Bestand, NICHT als
    // Import aus dem Register, das die Fläche rendert: ein Test, der dieselbe Liste prüft, die er
    // misst, prüft gar nichts. Wer eine Hilfe aus dem Register nimmt, macht diesen Fall rot.
    //
    // Gemessen wird der WORTLAUT (Deutsch, die Sprache der Bühne), nicht der Schlüssel — der
    // Schlüssel könnte im Menü stehen und trotzdem unaufgelöst sein.
    it("I · Hilfe-Tipps — JEDE Kennung des Basisstandes steht mit Titel UND Text im „?“-Menü", async () => {
      expect(b.fehler).toBeNull();
      const themen = await b.seite.evaluate<{ titel: string; text: string }[]>(
        fn(`async () => {
          document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 30));
          document.querySelector('[data-testid="blatt-werkzeug-hilfe"]').click();
          await new Promise((r) => setTimeout(r, 30));
          const raus = (e) => (e ? (e.textContent || '').replace(/\\s+/g, ' ').trim() : '');
          return [...document.querySelectorAll('[data-testid="blatt-menue-hilfe"] details')]
            .map((d) => ({ titel: raus(d.querySelector('summary')), text: raus(d.querySelector('p')) }));
        }`),
      );
      // Ohne diese Zeile wäre der Fall auch dann grün, wenn das Menü gar nicht aufgegangen ist:
      // eine leere Erhebung erfüllt jede „enthält"-Prüfung von unten nicht, aber die Fehlermeldung
      // wäre irreführend.
      expect(themen.length, "das „?“-Menü ist nicht aufgegangen").toBeGreaterThan(0);

      const fehlend: string[] = [];
      for (const [titelKey, bodyKey] of HILFE_KENNUNGEN_BASIS) {
        const titel = de(titelKey);
        const text = de(bodyKey);
        // Der Wortlaut muss AUFGELÖST sein — steht der Schlüssel selbst da, fehlt die Übersetzung.
        expect(titel, `keine deutsche Übersetzung zu ${titelKey}`).not.toBe(titelKey);
        expect(text, `keine deutsche Übersetzung zu ${bodyKey}`).not.toBe(bodyKey);
        const treffer = themen.find(
          (x) =>
            x.titel === titel.replace(/\s+/g, " ").trim() && x.text.includes(text.slice(0, 40)),
        );
        if (!treffer) {
          fehlend.push(`${titelKey} („${titel}“)`);
        }
      }
      expect(
        fehlend,
        `Diese Hilfe-Kennungen des Basisstandes sind aus dem „?“-Menü verschwunden:\n  ${fehlend.join("\n  ")}`,
      ).toEqual([]);
    });

    // ==============================================================================================
    // JOB 3062 · NACHZUG 1 — DIESELBEN KENNUNGEN AUCH IN DER SEITENHILFE DER HÜLLE (JOB 3060 H1).
    // ==============================================================================================
    //
    // H1 hat parallel den `HelpTip` umgebaut: er rendert nichts mehr und meldet sich bei
    // `shell/SeitenhilfeContext` an; das Zahnrad-Menü zeigt unter „Seitenhilfe" die Tipps der
    // aktuellen Seite. Sein Inventar (`tests/design/h1-funktionsinventar.test.ts`, Z-helptips)
    // nennt „Erfassen 33" und war nach dem Umbau dieser Fläche leer, weil hier kein `HelpTip`
    // mehr montierte. Seit dem Nachzug meldet das Blatt sein Register `BLATT_HILFE_THEMEN` dort an.
    //
    // WARUM DIESER FALL HIER STEHT UND NICHT NUR DORT: H1 misst `länge > 1` und EINEN Wortlaut
    // (den Nav-Erklärsatz). Damit wäre auch ein einziger angemeldeter Tipp grün. Hier gilt
    // dieselbe Strenge wie am „?"-Menü: JEDE am Basisstand erhobene Kennung, mit Titel UND Text.
    // Eine Tür darf der anderen nicht davonlaufen.
    it("I · Hilfe-Tipps — JEDE Kennung steht auch in der „Seitenhilfe“ des Zahnrads (JOB 3060 H1)", async () => {
      expect(b.fehler).toBeNull();
      const eintraege = await b.seite.evaluate<{ titel: string; text: string }[]>(
        fn(`async () => {
          document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 30));
          document.querySelector('[data-testid="kopfband-zahnrad"]').click();
          await new Promise((r) => setTimeout(r, 60));
          document.querySelector('[data-testid="zahnrad-seitenhilfe"]').click();
          await new Promise((r) => setTimeout(r, 60));
          const raus = (e) => (e ? (e.textContent || '').replace(/\\s+/g, ' ').trim() : '');
          return [...document.querySelectorAll('[data-testid="seitenhilfe-liste"] li')]
            .map((li) => ({ titel: raus(li.querySelector('div')), text: raus(li.querySelector('p')) }));
        }`),
      );
      expect(eintraege.length, "die „Seitenhilfe“ ist nicht aufgegangen").toBeGreaterThan(0);

      const fehlend: string[] = [];
      for (const [titelKey, bodyKey] of HILFE_KENNUNGEN_BASIS) {
        const titel = de(titelKey).replace(/\s+/g, " ").trim();
        const text = de(bodyKey);
        const treffer = eintraege.find(
          (x) => x.titel === titel && x.text.includes(text.slice(0, 40)),
        );
        if (!treffer) {
          fehlend.push(`${titelKey} („${titel}“)`);
        }
      }
      expect(
        fehlend,
        `Diese Hilfe-Kennungen fehlen in der Seitenhilfe des Zahnrads:\n  ${fehlend.join("\n  ")}`,
      ).toEqual([]);
    });

    it("K2 · KALIBRIERUNG: die Hilfe-Prüfung findet einen Wortlaut NICHT, den es nicht gibt", async () => {
      // Die Gegenprobe zum Fall darüber: sein „alles gefunden" wäre wertlos, wenn die Suche jeden
      // beliebigen Text fände. Gesucht wird derselbe Weg, mit einem erfundenen Titel.
      expect(b.fehler).toBeNull();
      const titel = await b.seite.evaluate<string[]>(
        fn(`() => [...document.querySelectorAll('[data-testid="blatt-menue-hilfe"] details summary')]
          .map((s) => (s.textContent || '').trim())`),
      );
      expect(titel).not.toContain("Diese Hilfe gibt es nicht");
    });

    it("I · Starter-Chips (heute: KnowledgeIntake.tsx IntakeEmptyState) — Titel-Menü des LEEREN Blattes", async () => {
      expect(b.fehler).toBeNull();
      const eintraege = await b.seite.evaluate<string[]>(
        fn(`async () => {
          document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 30));
          const titel = document.querySelector('[data-testid="blatt-titel"]');
          titel.focus();
          await new Promise((r) => setTimeout(r, 30));
          return [...document.querySelectorAll('[data-testid="blatt-menue-titel"] [role=menuitem]')]
            .map((e) => (e.textContent || '').trim());
        }`),
      );
      expect(eintraege.length).toBe(4);
    });

    it("I · Titelvorschlag (heute: gerahmte Karte über dem Schreibfeld) — Titel-Menü, sobald Text da ist", async () => {
      // ============================================================================================
      // JOB 3062 R6 — DER ZWEITE HALBE SATZ DES UMZUGS, und deshalb ein WIRKUNGSnachweis.
      // ============================================================================================
      // `zielbild-h3-kein-erklaertext.test.ts` misst, dass die Karte VON DER FLÄCHE weg ist. Allein
      // wäre das ein Funktionsverlust. Hier wird gemessen, dass sie an ihrem neuen Ort WIRKT: Text
      // schreiben → Titel anfassen → der Vorschlag steht im Menü → Klick → er steht im Titelfeld.
      // Geprüft wird die Übernahme, nicht die Anzeige (bens Massstab für R6).
      expect(b.fehler).toBeNull();
      const ergebnis = await b.seite.evaluate<{ eintrag: string | null; titel: string }>(
        fn(`async () => {
          const warte = (ms) => new Promise((r) => setTimeout(r, ms));
          const feld = document.querySelector('[data-testid="blatt-text"] [role=textbox]');
          feld.focus();
          feld.innerHTML = '<p>Dosierwert nach dem Schichtwechsel erst nach zehn Minuten anpassen.</p>';
          feld.dispatchEvent(new InputEvent('input', { bubbles: true }));
          await warte(500);
          const titel = document.querySelector('[data-testid="blatt-titel"]');
          titel.focus();
          await warte(80);
          const vorschlag = document.querySelector('[data-testid="blatt-titelvorschlag"]');
          const eintrag = vorschlag ? (vorschlag.textContent || '').trim() : null;
          if (vorschlag) {
            vorschlag.closest('[role=menuitem]').click();
            await warte(80);
          }
          const stand = titel.value;
          // DAS BLATT WIEDER IN DIE RUHELAGE — sonst misst der naechste Fall (leeres Blatt darf
          // nicht warnen) den Waechter an einem Blatt, das dieser Fall schmutzig gemacht hat.
          // Der Titel ist ein KONTROLLIERTES Feld: value zu setzen erreicht React nicht, dafuer
          // braucht es den nativen Setter und ein echtes input-Ereignis.
          feld.innerHTML = '';
          feld.dispatchEvent(new InputEvent('input', { bubbles: true }));
          const setzer = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value',
          ).set;
          setzer.call(titel, '');
          titel.dispatchEvent(new Event('input', { bubbles: true }));
          titel.blur();
          document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          await warte(250);
          return { eintrag, titel: stand };
        }`),
      );
      expect(ergebnis.eintrag, "kein Titelvorschlag im Titel-Menü").not.toBeNull();
      expect(ergebnis.eintrag).toContain("Titelvorschlag");
      expect(ergebnis.titel, "der Vorschlag wurde nicht in den Titel übernommen").toContain(
        "Dosierwert",
      );
    });

    it("I · Navigationswächter bei ungespeichertem Inhalt (heute: GuardedLink) — unverändert am Blatt", async () => {
      expect(b.fehler).toBeNull();
      // Der Wächter meldet sich über `setGuard` an und hängt an `isDirty`. Gemessen wird die
      // ANMELDUNG an ihrer sichtbaren Folge: das `beforeunload`-Ereignis wird abgebrochen, sobald
      // etwas Ungespeichertes im Blatt steht (`useUnloadGuard`, dieselbe Vorrichtung wie bisher).
      const abgebrochen = await b.seite.evaluate<{ leer: boolean; getippt: boolean }>(
        fn(`async () => {
          const feuern = () => {
            const e = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(e);
            return e.defaultPrevented;
          };
          const leer = feuern();
          const titel = document.querySelector('[data-testid="blatt-titel"]');
          const setzer = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setzer.call(titel, 'Ungespeicherter Titel');
          titel.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 50));
          const getippt = feuern();
          // Zurücksetzen, damit die übrigen Fälle das ruhige Blatt messen.
          setzer.call(titel, '');
          titel.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise((r) => setTimeout(r, 50));
          return { leer, getippt };
        }`),
      );
      expect(abgebrochen.leer, "leeres Blatt darf nicht warnen").toBe(false);
      expect(abgebrochen.getippt, "ungespeicherter Titel muss warnen").toBe(true);
    });

    it("I · Live-Reaktion (heute: KnowledgeIntake.tsx LiveReactionZone) — stiller Chip unter dem Blatt, NUR im Fall", async () => {
      expect(b.fehler).toBeNull();
      // Im Ruhezustand steht der Chip NICHT da — genau das ist die Zusage („nur im Fall").
      const imRuhezustand = await b.seite.evaluate<boolean>(
        fn(`() => document.querySelector('[data-testid="blatt-live-chip"]') !== null`),
      );
      expect(imRuhezustand).toBe(false);
    });

    // Gemessen wird die BLATT-HÜLLE, nicht `document.body`: Kopfband und Seitenleiste gehören der
    // Hülle (H1) und stehen nicht in diesem Auftrag.
    it("I · Demo-Banner (heute: Capture.tsx:3590) — bleibt NUR bei ?demo=", async () => {
      expect(b.fehler).toBeNull();
      const ohneDemo = await b.seite.evaluate<boolean>(
        fn(`() => {
          const h = document.querySelector('[data-testid="blatt-huelle"]');
          return (h ? h.innerText || '' : '').toLowerCase().includes('demo');
        }`),
      );
      expect(ohneDemo).toBe(false);
    });

    it("K · KALIBRIERUNG: die Suche findet NICHT, was nicht da ist", async () => {
      expect(b.fehler).toBeNull();
      const ergebnis = await b.seite.evaluate<{ ok: boolean; grund: string }>(fn(SUCHE), [
        "blatt-werkzeug-datei",
        "Diesen Eintrag gibt es nicht",
        null,
      ]);
      expect(ergebnis.ok).toBe(false);
    });

    it("V · das Inventar ist vollständig: jede Zeile trägt Funktion, Fundstelle und Ort — keine „entfällt“", () => {
      for (const z of INVENTAR) {
        expect(z.funktion.length, "Funktion").toBeGreaterThan(0);
        expect(z.fundstelle.length, `Fundstelle zu ${z.funktion}`).toBeGreaterThan(0);
        expect(z.ort.length, `Ort zu ${z.funktion}`).toBeGreaterThan(0);
        expect(z.ort.toLowerCase(), `Ort zu ${z.funktion}`).not.toContain("entfällt");
        expect(Boolean(z.text || z.selektor), `Suchweg zu ${z.funktion}`).toBe(true);
      }
    });

    it("V2 · der Hilfe-Bestand des Basisstandes ist vollständig erhoben: 31 Themen, keine doppelte Kennung", () => {
      // Der Pin auf die ERHEBUNG selbst. Ohne ihn liesse sich der Fall darüber grün machen, indem
      // man eine Zeile aus der Liste nimmt statt die Hilfe wiederherzustellen.
      expect(HILFE_KENNUNGEN_BASIS.length).toBe(31);
      expect(new Set(HILFE_KENNUNGEN_BASIS.map(([t]) => t)).size).toBe(31);
    });
  },
);

describe.runIf(!mockupDa)("JOB 3062 · H3 · Funktionsinventar übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
