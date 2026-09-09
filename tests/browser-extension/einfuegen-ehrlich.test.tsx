// ================================================================================================
// JOB 3412 · EINFUEGEN-KNOPF-EHRLICH — DER KNOPF SAGT DEN WEG, DER WIRKLICH FUNKTIONIERT.
// ================================================================================================
//
// DER BEFUND (Codex-Abnahme 09.09. 16:13, `gespraech/arbeitsfenster-20260909/CHATGPT-ABNAHME.md`):
// Klick auf „Aus Zwischenablage einfügen" → „Clipboard access was not granted. Please allow the
// browser prompt and paste again." Es erschien KEIN Dialog. Unmittelbar danach fügte Cmd+V im
// selben Feld den Text ein. Der Mensch bekam also eine Fehlermeldung für einen Weg, den es nicht
// gibt, während der Vorgang möglich war.
//
// WAS HIER GEMESSEN WIRD, und woran es VOR der Änderung scheitert:
//
//   F1  Wird das Recht nicht erteilt, nennt die Zustandszeile den Tastenweg (Cmd+V / Strg+V) und
//       KEINEN Browserdialog — in DE und EN. Vorher rot: `i18n.js` trug in beiden Sprachen genau
//       diesen Verweis („die Nachfrage des Browsers erlauben" / „allow the browser prompt").
//   F1b Dasselbe, wenn es die Rechteanfrage in diesem Browser gar nicht gibt oder sie scheitert.
//   F2  Ein SONSTIGER Lesefehler bekommt einen eigenen Satz. Vorher rot: ein einziges `catch` legte
//       jeden Fehler auf denselben Sammelstatus.
//   F3  Gegenprobe: Recht erteilt, Ablage voll → der Text steht im Feld, die Bestätigung ist
//       zurückgenommen, und es ging KEIN Speicheraufruf hinaus.
//   F4  Gegenprobe gegen den stummen Rückfall in `panel.js` (`t()` liefert bei unbekanntem
//       Schlüssel den Text von `storage_error`): jeder der drei Ausgänge hat in DE und EN einen
//       eigenen Satz, und keiner ist der Rückfalltext.
//   F5  Der Manifestvertrag: `clipboardRead` steht AUSSCHLIESSLICH unter `optional_permissions`.
//   F6  Ablösung: der Sammelausgang `clipboard_denied` ist ersatzlos verschwunden.
//   F7  Bei jedem der drei Ausgänge bleibt unangetastet, was schon getan ist — eingefügter Text,
//       Umfang, Herkunftswahl und der Link auf den gespeicherten Entwurf.
//
// DIE UMGEBUNG WIRD GESTELLT, NIE DER PRÜFLING: jsdom hat weder Zwischenablage noch Rechteanfrage,
// also bekommt das Fenster beides (`panel-dom.ts`). `panel.js`, `i18n.js` und `panel.html` laufen
// unverändert; der echte Worker steht dahinter. Kein Chromium — diese Datei fällt damit in die
// Testgruppe `rest`.
//
// NICHT GEMESSEN, ausdrücklich: ob Chrome auf `permissions.request` wirklich seinen Zustimmungs-
// dialog zeigt. Das ist Browserverhalten und gehört in die Abnahme mit echter Erweiterung. Genau
// deshalb behauptet KEIN Text der Leiste mehr, dass ein Dialog erscheint — die Zusage, die diese
// Datei prüft, hält auch dann, wenn keiner kommt.
import { afterEach, describe, expect, it } from "vitest";
import { read } from "../klara-browser/harness";
import { mount, schliesseFenster } from "../klara-browser/panel-dom";

const TEXT = "Ein Verbesserungsvorschlag aus dem Chat.\n\nZweiter Absatz mit Umlauten: Größe äöü.";

/** Die drei Ausgänge des Klicks. Genau diese Schlüssel dürfen in der Zustandszeile landen. */
const AUSGAENGE = ["clipboard_manual", "clipboard_empty", "clipboard_failed"] as const;

/**
 * Wörter, die auf einen Browserdialog verweisen. Steht eines davon in der Meldung, verspricht die
 * Leiste wieder etwas, das in der Liveprobe nicht eintrat.
 */
const DIALOGWORT = /Nachfrage|erlauben|Dialog|prompt|allow the browser|grant/i;

type Wortschatz = Record<string, Record<string, string>>;

/** Dieselbe Aufräumregel wie in den Nachbardateien: jedes gemountete Fenster wird geschlossen. */
afterEach(schliesseFenster);

const wortschatz = (fenster: { eval(quelle: string): unknown }) =>
  fenster.eval("globalThis.KLARA_TEXT") as Wortschatz;

describe("JOB 3412 · der Einfügen-Knopf nennt den gangbaren Weg", () => {
  it("F1 · abgelehntes Recht: die Zeile nennt Cmd+V/Strg+V statt eines Browserdialogs (DE und EN)", async () => {
    const view = await mount({ zwischenablage: { fehler: true }, recht: { erteilt: false } });
    expect(view.rechteAnfragen(), "vor dem Klick wurde bereits ein Recht angefragt").toEqual([]);

    view.el("paste").click();
    await view.settle();

    // Das Recht wird GENAU EINMAL und GENAU als `clipboardRead` angefragt — in der Klickgeste.
    expect(view.rechteAnfragen()).toEqual([["clipboardRead"]]);
    // Und ohne Recht wird nicht gelesen: der Wunsch ist keine Erlaubnis.
    expect(view.leseZaehler(), "ohne erteiltes Recht wurde trotzdem gelesen").toBe(0);
    expect(view.el("status").className, "der Ausgang trägt keinen Ton").toBe("warn");

    const texte = wortschatz(view.win);
    const tastenwege: [string, string][] = [
      ["de", "Cmd+V (Windows und Linux: Strg+V)"],
      ["en", "Cmd+V (Windows and Linux: Ctrl+V)"],
    ];
    for (const [sprache, tasten] of tastenwege) {
      view.sprache(sprache);
      const satz = view.el("status").textContent ?? "";
      expect(satz, `${sprache}: der Tastenweg fehlt`).toContain(tasten);
      expect(satz, `${sprache}: die Meldung verweist wieder auf einen Browserdialog`).not.toMatch(
        DIALOGWORT,
      );
      expect(satz, `${sprache}: es steht nicht da, dass nichts hinausging`).toMatch(
        /nichts gesendet|nothing was sent/i,
      );
      expect(satz, `${sprache}: der stumme Rückfall auf storage_error`).not.toBe(
        texte[sprache]?.storage_error,
      );
    }
  });

  it("F1b · keine Rechteanfrage vorhanden oder gescheitert — derselbe ehrliche Satz", async () => {
    for (const lage of [{ fehlt: true }, { wirft: true }]) {
      const view = await mount({ zwischenablage: { text: TEXT }, recht: lage });
      view.el("paste").click();
      await view.settle();
      const texte = wortschatz(view.win);
      expect(view.el("status").textContent, `${JSON.stringify(lage)}: nicht der Weg-Satz`).toBe(
        texte.de?.clipboard_manual,
      );
      expect(view.leseZaehler(), `${JSON.stringify(lage)}: es wurde doch gelesen`).toBe(0);
      // Nichts ist im Feld gelandet: die Leiste behauptet keine Übernahme, die nicht stattfand.
      expect(view.el("clipboard").value).toBe("");
      schliesseFenster();
    }
  });

  it("F2 · ein sonstiger Lesefehler bekommt einen EIGENEN Satz, nicht den der Verweigerung", async () => {
    const view = await mount({ zwischenablage: { fehler: true, fehlerName: "DataError" } });
    view.el("paste").click();
    await view.settle();

    // Das Recht war erteilt, also wurde wirklich gelesen — und dabei ging etwas anderes schief.
    expect(view.rechteAnfragen()).toEqual([["clipboardRead"]]);
    expect(view.leseZaehler()).toBe(1);
    expect(view.el("status").className, "ein Ausfall ist rot").toBe("crit");

    const texte = wortschatz(view.win);
    for (const sprache of ["de", "en"]) {
      view.sprache(sprache);
      const satz = view.el("status").textContent ?? "";
      expect(satz, `${sprache}: nicht der eigene Ausfallsatz`).toBe(
        texte[sprache]?.clipboard_failed,
      );
      expect(satz, `${sprache}: derselbe Satz wie bei der Verweigerung`).not.toBe(
        texte[sprache]?.clipboard_manual,
      );
      expect(satz, `${sprache}: der stumme Rückfall auf storage_error`).not.toBe(
        texte[sprache]?.storage_error,
      );
      expect(satz, `${sprache}: es steht nicht da, dass nichts hinausging`).toMatch(
        /nichts gesendet|nothing was sent/i,
      );
    }
  });

  it("F3 · Gegenprobe: erteiltes Recht und voller Ablageninhalt — der Text steht da, nichts geht hinaus", async () => {
    const view = await mount({ zwischenablage: { text: TEXT } });
    view.el("confirm").checked = true;
    view.el("paste").click();
    await view.settle();
    await view.settle();

    expect(view.rechteAnfragen()).toEqual([["clipboardRead"]]);
    expect(view.leseZaehler()).toBe(1);
    expect(view.el("clipboard").value).toBe(TEXT);
    expect(view.el("mode-clipboard").checked, "der vierte Umfang wurde nicht gewählt").toBe(true);
    expect(view.plain("content")).toContain("Ein Verbesserungsvorschlag aus dem Chat.");
    // Ein anderer Inhalt ist eine andere Übernahme: die Bestätigung verfällt.
    expect(view.el("confirm").checked, "die Bestätigung überlebte den neuen Inhalt").toBe(false);
    // Und einfügen ist kein Speichern.
    expect(view.requests.filter((u) => u.endsWith("/api/drafts"))).toHaveLength(0);
  });

  it("F4 · jeder der drei Ausgänge hat in DE und EN einen eigenen Satz — keiner fällt auf storage_error", async () => {
    const view = await mount({ auswahl: false });
    const texte = wortschatz(view.win);
    for (const sprache of ["de", "en"]) {
      const wort = texte[sprache] ?? {};
      for (const schluessel of AUSGAENGE) {
        expect(wort[schluessel], `${sprache}/${schluessel}: kein Text`).toBeTruthy();
        expect(wort[schluessel], `${sprache}/${schluessel}: der Rückfalltext`).not.toBe(
          wort.storage_error,
        );
      }
      expect(
        new Set(AUSGAENGE.map((k) => wort[k])).size,
        `${sprache}: zwei Ausgänge teilen sich einen Satz`,
      ).toBe(AUSGAENGE.length);
    }
    // Und beide Sprachen tragen dieselbe Menge — ein Schlüssel nur in einer Sprache liefe in der
    // anderen still in den Rückfall.
    expect(Object.keys(texte.de ?? {}).sort()).toEqual(Object.keys(texte.en ?? {}).sort());
  });

  it("F5 · `clipboardRead` steht ausschliesslich als OPTIONALES Recht im Manifest", () => {
    const gelesen = JSON.parse(read("manifest.json"));
    expect(gelesen.optional_permissions).toEqual(["clipboardRead"]);
    // KEINE PFLICHTBERECHTIGUNG: die feste Liste bleibt, wie sie war. Was dieser Fall damit NICHT
    // behauptet (Runde 2, BEN): dass das Recht nach der Zustimmung wieder verfällt. Ein erteiltes
    // optionales Recht kann bestehen bleiben; gemessen wird hier allein das Manifest.
    expect(gelesen.permissions).toEqual([
      "activeTab",
      "contextMenus",
      "scripting",
      "sidePanel",
      "storage",
    ]);
    expect(gelesen.permissions).not.toContain("clipboardRead");
    // JOB 3412 fasst die Nummer nicht an (JOB 3413 führt die Anleitung dazu nach).
    expect(gelesen.version).toBe("0.4.0");
    expect(gelesen.host_permissions).toEqual(["https://app.klarwerk.ai/*"]);
  });

  it("F6 · Ablösung: der Sammelausgang `clipboard_denied` ist nirgends mehr übrig", () => {
    // GEZÄHLT WIRD DER CODE, NICHT DIE ERKLÄRUNG — dieselbe Regel wie in `zwischenablage.test.ts`
    // (A2). Die Kommentare der geänderten Stellen nennen den abgelösten Schlüssel ausdrücklich und
    // sollen es weiter tun: wer eine Ablösung dokumentiert, muss den alten Namen schreiben dürfen.
    // Wörter aus einem Kommentar zu streichen, um einem Sensor auszuweichen, wäre die schlechtere
    // Antwort — dann stünde in der Datei, dass etwas ersetzt wurde, aber nicht mehr WAS.
    const ohneKommentar = (datei: string) =>
      read(datei)
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    for (const datei of ["panel.js", "i18n.js", "panel.html"]) {
      expect(
        ohneKommentar(datei),
        `${datei} trägt den abgelösten Sammelausgang noch im CODE`,
      ).not.toContain("clipboard_denied");
    }
    // `i18n.js` steht ausdrücklich in der Liste: ein verwaister Schlüssel dort wäre ein zweiter
    // Weg, auf dem der alte Satz wieder erscheinen könnte.
    const code = ohneKommentar("panel.js");
    // Und es gibt weiterhin genau EINEN Leser der Zwischenablage: der neue Rechteweg hat keinen
    // zweiten daneben gestellt, und die Rechteanfrage steht genau einmal.
    expect([...code.matchAll(/clipboard\.readText/g)]).toHaveLength(1);
    expect([...code.matchAll(/\.request\(/g)]).toHaveLength(1);
  });

  it("F7 · bei allen drei Ausgängen bleibt stehen, was schon getan ist — Text, Umfang, Herkunft, Link", async () => {
    // Die Lage wird während des Laufs verstellt, nicht neu gemountet: der Prüfstand liest beide
    // Angaben erst im Augenblick des Klicks, genau wie der Browser seinen Zustand.
    const ablage: { text?: string; fehler?: boolean; fehlerName?: string } = { text: TEXT };
    const recht: { erteilt?: boolean } = {};
    const view = await mount({ zwischenablage: ablage, recht });
    await view.login();
    view.el("paste").click();
    await view.settle();
    await view.settle();
    view.input("origin", "eigen");
    view.input("title", "Aus der Ablage");
    await view.settle();
    view.el("confirm").checked = true;
    view.el("confirm").dispatchEvent(new view.win.Event("change"));
    view.el("save").click();
    await view.settle();

    const link = view.el("open").getAttribute("href");
    expect(link, "ohne gespeicherten Entwurf misst F7 die halbe Zusage").toContain(
      "draft=draft-test",
    );
    expect(view.el("status").className).toBe("ok");
    const texte = wortschatz(view.win);

    /** Was nach jedem Ausgang unverändert dastehen muss. */
    const unveraendert = (ausgang: string) => {
      expect(view.el("clipboard").value, `${ausgang}: der eingefügte Text ging verloren`).toBe(
        TEXT,
      );
      expect(view.el("mode-clipboard").checked, `${ausgang}: der Umfang wurde verstellt`).toBe(
        true,
      );
      expect(view.el("origin").value, `${ausgang}: die Herkunftsangabe ging verloren`).toBe(
        "eigen",
      );
      expect(view.el("open").getAttribute("href"), `${ausgang}: der Öffnen-Link verschwand`).toBe(
        link,
      );
      expect(view.el("open").hidden, `${ausgang}: der Öffnen-Link wurde versteckt`).toBe(false);
      expect(view.plain("content"), `${ausgang}: die Vorschau wurde geleert`).toContain(
        "Ein Verbesserungsvorschlag aus dem Chat.",
      );
      expect(view.requests.filter((u) => u.endsWith("/api/drafts"))).toHaveLength(1);
    };

    // (a) kein Recht → der Weg-Satz, und nichts wurde gelesen.
    recht.erteilt = false;
    view.el("paste").click();
    await view.settle();
    expect(view.el("status").textContent).toBe(texte.de?.clipboard_manual);
    expect(view.leseZaehler(), "ohne Recht wurde gelesen").toBe(1);
    unveraendert("kein Recht");

    // (b) leere Ablage → der eigene Satz dafür; gelesen wurde, gefunden nichts.
    recht.erteilt = true;
    ablage.text = "   ";
    view.el("paste").click();
    await view.settle();
    expect(view.el("status").textContent).toBe(texte.de?.clipboard_empty);
    expect(view.leseZaehler()).toBe(2);
    unveraendert("leere Ablage");

    // (c) sonstiger Fehler → der Ausfallsatz.
    ablage.text = TEXT;
    ablage.fehler = true;
    ablage.fehlerName = "DataError";
    view.el("paste").click();
    await view.settle();
    expect(view.el("status").textContent).toBe(texte.de?.clipboard_failed);
    expect(view.leseZaehler()).toBe(3);
    unveraendert("sonstiger Fehler");
  });
});
