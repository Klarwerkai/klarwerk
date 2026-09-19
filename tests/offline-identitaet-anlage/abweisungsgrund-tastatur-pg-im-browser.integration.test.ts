// ================================================================================================
// JOB 4354 R3 · DER GRUND IST MIT ECHTEN TAB-ANSCHLÄGEN ERREICHBAR — IM ECHTEN CHROMIUM.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESE DATEI SCHLIESST, hat BEN in Runde 2 GEMESSEN und nicht vermutet: Er hat die
// Tab-Taste im Produkt vollständig blockiert (`onKeyDownCapture` am äusseren Mobile-Container mit
// `preventDefault()`) — und der gemountete Fall nebenan blieb mit „16 passed" grün
// (Cloud-Auftrag `4b7aebafd0df4006aa31391481215209`). Der Grund ist bauartbedingt: jsdom kennt
// keine Tabulator-Taste, der jsdom-Fall RECHNET die Fokusfolge aus und ruft `.focus()`. Das misst
// die Bauart des Elements, nicht den Weg der Hand.
//
// HIER WIRD DIE TASTE GEDRÜCKT. `seite.keyboard.press("Tab")` in einem echten Chromium, an der
// echten gebauten Fläche (`apps/web/dist`), ausgeliefert von der echten Anwendung über einen echten
// Socket, gegen eine echte PostgreSQL. Ein Fänger, der Tab verschluckt, macht diesen Fall rot —
// das ist unten Fall T2b, und zwar als STEHENDE Kalibrierung, nicht als einmalige Handprobe.
//
// DIE KETTE, in EINEM Lauf:
//     Chromium (390 px, ein Profil) → gebaute Fläche → HTTP über echten Socket →
//     `POST /api/drafts` mit Kontovoraussetzung → Serverriegel → 409 DRAFT_OWNER_MISMATCH aus dem
//     VORHANDENEN Katalog (`services/auth/src/meldungen.ts`) → `op.error` im echten `localStorage`
//     → die gerenderte Zeile am Vorgang → `document.activeElement` nach echten Tab-Anschlägen.
//
// WIE DIE ABWEISUNG ENTSTEHT — und warum das kein gestellter Fehler ist: Die Warteschlange schickt
// ihre Anlage seit JOB 4249 R6 MIT ihrer Voraussetzung (`expectedOwner`, `useOfflineQueue.ts:792`).
// Genau dafür ist der Riegel gebaut: Kommt der Aufruf unter einem anderen Konto an, als der Vorgang
// erwartet, legt der Server NICHTS an und antwortet 409. Im Browser lässt sich das nicht über das
// Cookie herstellen (die Fläche liest dieselbe Sitzung und sendet dann gar nicht erst) — deshalb
// wird auf dem DRAHT genau ein Feld verstellt: `expectedOwner` trägt die Kennung von B, während das
// Cookie A ist (`kontext.route`, unten). Serverriegel, Katalog, Sprachwahl, Antwortweg, Client und
// Fläche sind dabei UNVERÄNDERT und echt; verstellt ist allein die Voraussetzung, deren Prüfung
// hier gemessen wird. Dieselbe Bauform wie die Brücke aus JOB 4249 R8, nur eine Ebene tiefer.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668): Ohne echte PostgreSQL wird der Grund SICHTBAR
// auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import {
  type Kontext,
  SCHMAL,
  type Seite,
  fn,
  profil,
  tabBisZu,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT } from "../gast-nutzerweg/strecke";
import { SCHLUESSEL, mussSichtbarSein, sichtbefund } from "./offlineweg";
import {
  A_MAIL,
  type Pruefstand,
  type Welt,
  inFrischerDatenbank,
  pruefstandAbbauen,
  pruefstandAufbauen,
} from "./pruefstand";

const JOB = "[KLARWERK] JOB 4354";

/** Der Titel des Vorgangs, der abgewiesen wird — er steht am Eintrag über dem Grund. */
const TITEL = "Ventil bei Ueberdruck (JOB 4354)";
const TEXT = "Unterwegs erfasst, ohne Netz.";

/** Die Meldung am Vorgang (`pages/Mobile.tsx`, das `<output>` der Warteschlange). */
const GRUND = '[data-testid="mob-queue-grund"]';
/** Der Sendeknopf in der KOPFZEILE der Warteschlange — die einzige Station neben der Überschrift. */
const KOPFZEILE = '[data-testid="mob-warteschlange"] button';
/** Die Überschrift selbst: ein `<span>`, also keine Fokusstation. Sie markiert den Ausgangspunkt. */
const UEBERSCHRIFT = '[data-testid="mob-queue-zaehler"]';

/** Der Satz, den der Server in dieser Sprache schickt — aus dem VORHANDENEN Katalog. */
const SATZ = MELDUNGEN.DRAFT_OWNER_MISMATCH.de;

// ------------------------------------------------------------------------------------------------
// Die Playwright-Flächen, die `browserweg.ts` und `offlineweg.ts` (noch) nicht führen. Sie stehen
// HIER und nicht dort, weil beide Dateien Bestand anderer Aufträge sind und dieser Auftrag sie
// nicht anfassen darf (Zielpfade). Genannt statt stillschweigend mitgenommen.
// ------------------------------------------------------------------------------------------------
interface WeicheMitRumpf {
  request(): { method(): string; url(): string; postData(): string | null };
  continue(optionen?: { postData?: string }): Promise<void>;
}
interface KontextMitWeiche extends Kontext {
  route(muster: string, behandler: (weiche: WeicheMitRumpf) => Promise<void>): Promise<void>;
}

/** Ein Vorgang, wie er wirklich im `localStorage` liegt — mit seinem Fehlertext. */
interface VorgangMitFehler {
  id: string;
  status: string;
  title: string;
  error: string | null;
  eigentuemer?: string;
}

const BESTAND = `(s) => { try { return JSON.parse(localStorage.getItem(s) || "[]"); } catch (e) { return []; } }`;
const AKTIV = `() => {
  const a = document.activeElement;
  if (!a) { return { tag: "", text: "", testid: null, tabindex: null }; }
  return {
    tag: a.tagName.toLowerCase(),
    text: String(a.innerText || "").replace(/\\s+/g, " ").trim(),
    testid: a.getAttribute("data-testid"),
    tabindex: a.getAttribute("tabindex"),
  };
}`;

interface Fokuslage {
  tag: string;
  text: string;
  testid: string | null;
  tabindex: string | null;
}

/** Was in `localStorage` liegt — dieselbe Quelle, aus der die Fläche rendert. */
async function bestand(seite: Seite): Promise<VorgangMitFehler[]> {
  return seite.evaluate<VorgangMitFehler[]>(fn(BESTAND), SCHLUESSEL);
}

function normal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ================================================================================================
// (a) ANKUNFT und (b) SICHTBARKEIT — getrennt gemessen, wie der Auftrag es verlangt.
// ================================================================================================
//
// Sie stehen hier als eigene Funktionen, weil JEDE Kalibrierung unten sie erneut fährt: eine
// Verstellung, die den Tastaturweg rot macht, DARF die beiden anderen Hälften nicht berühren. Wäre
// alles in einer Zusicherung, bewiese eine rote Kalibrierung nur, dass irgendetwas kaputt ist.
async function abnahmeAnkunft(seite: Seite): Promise<VorgangMitFehler> {
  const liste = await bestand(seite);
  expect(liste, "es liegt nicht genau ein Vorgang in der Warteschlange").toHaveLength(1);
  const vorgang = liste[0] as VorgangMitFehler;
  expect(vorgang.status, "der Vorgang steht nicht auf failed").toBe("failed");
  expect(vorgang.error, "op.error trägt nicht den Satz des Servers").toBe(SATZ);
  return vorgang;
}

async function abnahmeSichtbar(seite: Seite): Promise<string> {
  const text = await mussSichtbarSein(seite, GRUND, SATZ, "der Grund am abgewiesenen Vorgang");
  expect(normal(text), "der SICHTBARE Text ist nicht genau der Serversatz").toBe(normal(SATZ));
  return text;
}

// ================================================================================================
// (c) DER TASTATURWEG — echte Anschläge, gezählt, mit benanntem Ausgangspunkt.
// ================================================================================================
//
// Gemessen wird in zwei Abschnitten, weil die Abnahme den AUSGANGSPUNKT benennt: erst mit echten
// Anschlägen BIS IN DIE KOPFZEILE der Warteschlange (dort steht die Überschrift; ihre einzige
// Fokusstation ist der Sendeknopf daneben), dann von dort WEITER bis zur Meldung. Kein `.focus()`
// auf dem Weg — `tabBisZu` drückt `Tab` und liest danach `document.activeElement`
// (`browserweg.ts:219-238`).
//
// DIE ERSTE ZAHL IST EIN PROTOKOLL, DIE ZWEITE DIE ZUSAGE: `vonVorn` löst nur den Fokus
// (`blur()`); Chromium setzt die Tabulatorfolge danach an der zuletzt fokussierten Stelle fort,
// nicht am Dokumentanfang. Wie viele Anschläge bis zur Kopfzeile nötig sind, hängt deshalb von der
// Vorgeschichte ab (gemessen: 1 nach dem Erfassen, 35 nach den Kalibrierungsläufen) — das wird
// berichtet, nicht zugesichert. ZUGESICHERT ist der zweite Abschnitt: von der Kopfzeile der
// Warteschlange aus führen echte Tab-Anschläge auf die Meldung, und dort steht der Serversatz.
async function tastaturweg(seite: Seite): Promise<{ bisKopfzeile: number; weiter: number }> {
  // DER AUSGANGSPUNKT WIRD BELEGT, nicht behauptet: die Überschrift steht wirklich VOR der Meldung.
  // Ohne diese Zeile hiesse „von der Warteschlangenüberschrift aus" nur, dass beide auf der Seite
  // vorkommen.
  const reihenfolge = await seite.evaluate<boolean>(
    fn(`([u, g]) => {
      const kopf = document.querySelector(u);
      const ziel = document.querySelector(g);
      if (!kopf || !ziel) { return false; }
      return (kopf.compareDocumentPosition(ziel) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    }`),
    [UEBERSCHRIFT, GRUND],
  );
  expect(
    reihenfolge,
    "die Meldung steht nicht hinter der Warteschlangenüberschrift — dann ist der Ausgangspunkt ein anderer",
  ).toBe(true);
  await warte(
    seite,
    "(sel) => { const b = document.querySelector(sel); return !!b && !b.disabled; }",
    "der Sendeknopf in der Kopfzeile der Warteschlange ist bedienbar (sonst ist er keine Fokusstation)",
    KOPFZEILE,
  );
  const bisKopfzeile = await tabBisZu(seite, KOPFZEILE, 150, true);
  const weiter = await tabBisZu(seite, GRUND, 25, false);
  return { bisKopfzeile, weiter };
}

async function abnahmeTastatur(seite: Seite): Promise<{ bisKopfzeile: number; weiter: number }> {
  const weg = await tastaturweg(seite);
  const lage = await seite.evaluate<Fokuslage>(fn(AKTIV));
  expect(lage.testid, "nach den Tab-Anschlägen steht der Fokus nicht auf der Meldung").toBe(
    "mob-queue-grund",
  );
  expect(lage.tabindex, "die Meldung ist keine eigene Fokusstation").toBe("0");
  expect(
    lage.text,
    `document.activeElement trägt nicht genau den Serversatz · gemessen: „${lage.text}"`,
  ).toBe(normal(SATZ));
  return weg;
}

// ------------------------------------------------------------------------------------------------
// DER WEG BIS ZUR ABWEISUNG — anmelden, offline erfassen, Verbindung zurück, Server weist ab.
// ------------------------------------------------------------------------------------------------
async function bisZurAbweisung(welt: Welt): Promise<{ seite: Seite; kontext: KontextMitWeiche }> {
  const { kontext: roh, seite } = await profil(welt.browser, SCHMAL, "de");
  const kontext = roh as KontextMitWeiche;
  const basis = welt.strecke.basis;

  // DIE VERSTELLTE VORAUSSETZUNG — ein Feld, auf dem Draht, vor dem Server (s. Kopf der Datei).
  await kontext.route("**/api/drafts", async (weiche) => {
    const anfrage = weiche.request();
    if (anfrage.method() !== "POST") {
      await weiche.continue();
      return;
    }
    const rumpf = JSON.parse(anfrage.postData() ?? "{}") as Record<string, unknown>;
    await weiche.continue({ postData: JSON.stringify({ ...rumpf, expectedOwner: welt.bId }) });
  });

  // Anmelden über die ECHTE Maske, getippt statt gesetzt (Bauform `offlineweg.ts:370`).
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske für A");
  await tippeMitTastatur(seite, "#auth-email", A_MAIL, "E-Mail (A)");
  await tippeMitTastatur(seite, "#auth-password", PASSWORT, "Passwort (A)");
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    "die Anmeldung von A trägt",
    undefined,
    45_000,
  );

  await seite.goto(`${basis}/mobile`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    `(p) => !!document.querySelector('input[placeholder="' + p + '"]') && !!document.querySelector('[data-testid="mob-statement"]')`,
    "die Erfassungsfläche für A",
    i18n.t("mob.formTitle"),
    45_000,
  );

  // Ohne Netz erfassen — der Vorgang geht in die Warteschlange, mit A als Eigentümer.
  await kontext.setOffline(true);
  await warte(
    seite,
    "() => navigator.onLine === false",
    "die Fläche merkt die fehlende Verbindung",
  );
  await tippeMitTastatur(
    seite,
    `input[placeholder="${i18n.t("mob.formTitle")}"]`,
    TITEL,
    "Kernaussage",
  );
  await tippeMitTastatur(seite, '[data-testid="mob-statement"]', TEXT, "Text");
  await seite.click(`button:has-text("${i18n.t("mob.save")}")`);
  await warte(
    seite,
    `(s) => { try { const q = JSON.parse(localStorage.getItem(s) || "[]"); return q.length === 1 && q[0].status === "queued"; } catch (e) { return false; } }`,
    "der offline erfasste Vorgang liegt in der Warteschlange",
    SCHLUESSEL,
  );

  // Verbindung zurück: der Nachsendelauf geht los — und läuft in den Riegel.
  await kontext.setOffline(false);
  await warte(seite, "() => navigator.onLine === true", "die Fläche merkt die Verbindung");
  await warte(
    seite,
    `(s) => { try { const q = JSON.parse(localStorage.getItem(s) || "[]"); return q.length === 1 && q[0].status === "failed" && !!q[0].error; } catch (e) { return false; } }`,
    "der Server hat den nachgesendeten Vorgang abgewiesen und der Grund liegt am Vorgang",
    SCHLUESSEL,
    60_000,
  );
  await warte(
    seite,
    "(sel) => !!document.querySelector(sel)",
    "die Meldung steht am betroffenen Eintrag",
    GRUND,
  );
  return { seite, kontext };
}

describe("JOB 4354 · der Abweisungsgrund am Vorgang, mit der Tastatur erreicht", () => {
  let stand: Pruefstand | undefined;

  beforeAll(async () => {
    stand = await pruefstandAufbauen("T1");
  }, 900_000);

  afterAll(async () => {
    await pruefstandAbbauen(stand);
  }, 120_000);

  it("T1 — offline erfassen · Server weist ab · der Grund steht da und ist ERTASTBAR", async (ctx) => {
    if (!stand?.verfuegbar) {
      ctx.skip();
      return;
    }
    const pruefstand = stand;
    process.stderr.write(`${JOB} T1 läuft · Fläche: ${pruefstand.flaeche}\n`);
    await inFrischerDatenbank(pruefstand, "T1", async (welt) => {
      const { seite, kontext } = await bisZurAbweisung(welt);
      try {
        const vorgang = await abnahmeAnkunft(seite);
        const sichtbar = await abnahmeSichtbar(seite);
        const weg = await abnahmeTastatur(seite);
        // Der Beleg, dass der SICHTBARE Satz derselbe ist wie der GESPEICHERTE — eine Fläche mit
        // eigenem Wortlaut wäre hier nicht zu unterscheiden, wenn nur einer von beiden gemessen
        // würde.
        expect(normal(sichtbar), "sichtbarer Satz ≠ gespeicherter op.error").toBe(
          normal(String(vorgang.error)),
        );
        // Und der Eintrag trägt weiterhin Titel und Marke — der Grund ERSETZT nichts.
        const karte = await sichtbefund(seite, '[data-testid="mob-warteschlange"]');
        expect(karte.sichtbar, `die Warteschlange ist nicht sichtbar: ${karte.grund}`).toBe(true);
        expect(karte.text).toContain(TITEL);
        expect(karte.text).toContain(i18n.t("mob.status.failed"));
        process.stderr.write(
          `${JOB} T1 · ${weg.bisKopfzeile} Tab-Anschläge bis zur Kopfzeile der Warteschlange, ${weg.weiter} weiter bis zum Grund · Satz: „${normal(sichtbar).slice(0, 60)}…"\n`,
        );
      } finally {
        await kontext.close().catch(() => undefined);
      }
    });
  }, 900_000);

  // ==============================================================================================
  // T2 — DIE KALIBRIERUNGEN, STEHEND UND MIT RÜCKNAHME.
  // ==============================================================================================
  //
  // Beide Verstellungen sind genau die, die BEN in Runde 2 von Hand gefahren hat. Sie stehen hier
  // als Fälle, damit der Nachweis nicht an einer einmaligen Handprobe hängt:
  //   T2a  `tabindex` weg  → die Meldung ist keine Fokusstation mehr.
  //   T2b  Tab verschluckt → die Taste bewirkt nichts (Fänger in der Auffangphase).
  // Nach JEDER Rücknahme wird der Weg erneut gefahren und MUSS wieder gelingen (§9: „nach Rücknahme
  // wieder grün"). Ankunft und Sichtbarkeit werden in beiden Lagen mitgeprüft: sie dürfen sich
  // nicht bewegen, sonst misst die Kalibrierung etwas anderes als den Tastaturweg.
  it("T2 — ohne tabindex und mit verschluckter Tab-Taste ist der Grund NICHT ertastbar", async (ctx) => {
    if (!stand?.verfuegbar) {
      ctx.skip();
      return;
    }
    const pruefstand = stand;
    process.stderr.write(`${JOB} T2 läuft · Fläche: ${pruefstand.flaeche}\n`);
    await inFrischerDatenbank(pruefstand, "T2", async (welt) => {
      const { seite, kontext } = await bisZurAbweisung(welt);
      try {
        // Ausgangslage: der Weg gelingt.
        await abnahmeTastatur(seite);

        // ---- T2a: `tabindex` entfernt -----------------------------------------------------------
        //
        // DER ENTZUG WIRD GEHALTEN, und das ist kein Zierrat, sondern ein MESSBEFUND dieser Runde:
        // Ein einmaliges `removeAttribute` verliert gegen das Produkt. Die Meldung hängt an
        // `op.status === "failed"`; holt die Warteschlange den Vorgang erneut (Fokuswechsel,
        // Auffrischung), steht er kurz auf `pending`, das Element wird AUSGEHÄNGT und danach mit
        // `tabIndex={0}` neu gebaut. Gemessen im Lauf 62f2208a: der Tab-Weg erreichte die Meldung
        // trotz Entzug nach 17 Anschlägen wieder. Ein Wächter hält den Entzug deshalb über jeden
        // Neuaufbau hinweg — sonst misst diese Kalibrierung den Zufall ihrer Laufzeit.
        const ohneAttribut = await seite.evaluate<{ attribut: string | null; eigenschaft: number }>(
          fn(`(sel) => {
            const entziehen = () => {
              const el = document.querySelector(sel);
              if (el && el.getAttribute("tabindex") !== null) { el.removeAttribute("tabindex"); }
            };
            const el = document.querySelector(sel);
            if (!el) { throw new Error("Kalibrierung T2a: die Meldung ist nicht da"); }
            entziehen();
            window.__kwEntzug = new MutationObserver(entziehen);
            window.__kwEntzug.observe(document.body, { subtree: true, childList: true, attributes: true });
            return { attribut: el.getAttribute("tabindex"), eigenschaft: el.tabIndex };
          }`),
          GRUND,
        );
        // DER BELEG, dass `tabIndex={0}` im Produkt trägt und nicht bloss danebensteht: ohne das
        // Attribut meldet Chromium `el.tabIndex === -1` — ein `<output>` ist von sich aus KEINE
        // Fokusstation.
        expect(ohneAttribut.attribut, "das Attribut liess sich nicht entziehen").toBe(null);
        expect(
          ohneAttribut.eigenschaft,
          "ohne Attribut wäre die Meldung von sich aus fokussierbar — dann trüge tabIndex={0} nichts",
        ).toBe(-1);
        await expect(tabBisZu(seite, GRUND, 40, true)).rejects.toThrow(/nicht erreichbar/);
        await abnahmeAnkunft(seite);
        await abnahmeSichtbar(seite);

        // Rücknahme — und der Weg gelingt wieder.
        await seite.evaluate<boolean>(
          fn(`(sel) => {
            window.__kwEntzug.disconnect();
            delete window.__kwEntzug;
            document.querySelector(sel).setAttribute("tabindex", "0");
            return true;
          }`),
          GRUND,
        );
        await abnahmeTastatur(seite);

        // ---- T2b: die Tab-Taste wird verschluckt ------------------------------------------------
        await seite.evaluate<boolean>(
          fn(`() => {
            window.__kwTabSperre = (e) => { if (e.key === "Tab") { e.preventDefault(); } };
            document.addEventListener("keydown", window.__kwTabSperre, true);
            return true;
          }`),
        );
        await expect(tabBisZu(seite, GRUND, 40, true)).rejects.toThrow(/nicht erreichbar/);
        await abnahmeAnkunft(seite);
        await abnahmeSichtbar(seite);

        // Rücknahme — und der Weg gelingt wieder.
        await seite.evaluate<boolean>(
          fn(`() => {
            document.removeEventListener("keydown", window.__kwTabSperre, true);
            delete window.__kwTabSperre;
            return true;
          }`),
        );
        const wieder = await abnahmeTastatur(seite);
        process.stderr.write(
          `${JOB} T2 · beide Verstellungen rot, beide zurückgenommen, Weg wieder frei (${wieder.bisKopfzeile}+${wieder.weiter} Anschläge)\n`,
        );
      } finally {
        await kontext.close().catch(() => undefined);
      }
    });
  }, 900_000);
});
