// ================================================================================================
// JOB 3524 · CHR-EINFUEGEN-KLARHEIT — DER VIERTE UMFANG SAGT DIE WAHRHEIT UND IST ERREICHBAR.
// ================================================================================================
//
// DER BEFUND (Pedi am 10.09. zwischen 08:57 und 09:08 an der offenen Leiste in Chrome). Drei Dinge
// standen auf dem Stand 81c5cc8 gleichzeitig auf der Fläche:
//
//     info-clipboard:          „· nicht vorhanden"        → eine Aussage über SEINE Zwischenablage
//     clipboard-box hidden:    false, bei jedem Umfang    → der Block drängte alles nach unten
//     mode-clipboard disabled: true, solange leer         → der vierte Umfang war nicht wählbar
//
// Aus „nicht vorhanden" hat Pedi geschlossen, die Erweiterung könne seine Zwischenablage nicht
// lesen. Sie hatte nur nichts eingefügt bekommen — zwei völlig verschiedene Sätze. Und der einzige
// Weg, etwas einzufügen, führte über die Taste, die ein Recht anfragt: der Umfang war leer, also
// gesperrt, also unerreichbar, ohne die Rechtefrage zu beantworten.
//
// WAS HIER GEMESSEN WIRD, und woran es VOR der Änderung scheitert:
//
//   L1  Der vierte Umfang trägt ohne Inhalt einen EIGENEN Satz („noch nicht eingefügt" /
//       „not pasted yet"); die drei Umfänge der Seite behalten `scopeEmpty`. Vorher rot: alle vier
//       trugen denselben Satz (`panel.js`, `· ${t("scopeEmpty")}`).
//   L2  Der Zwischenablageblock erscheint NUR bei gewähltem Umfang „Zwischenablage". Vorher rot:
//       `#clipboard-box` stand unabhängig vom Umfang im Dokument (`panel.html`).
//   L3  DER WICHTIGSTE WÄCHTER: die Wahl allein liest NICHTS und fragt KEIN Recht an. Der
//       Schreibpunkt steht danach im Feld, damit Cmd+V bzw. Strg+V sofort wirkt.
//   L4  Erst der eingefügte Text macht den Umfang speicherbar; ein Wechsel nimmt den Block wieder
//       weg, und die Umfangszeile nennt den vierten Umfang beim eigenen Namen.
//   L5  Lieferung 6: kein neues Recht, keine Hintergrundaktion — und der neue Leerzustand verdeckt
//       keinen der drei Zwischenablage-Ausgänge.
//   L6  Lieferung 5: die langen Erläuterungen wohnen in einem zugeklappten Aufklapper; konkrete
//       Warnungen bleiben ausserhalb, und die Reihenfolge der Fläche stimmt.
//
// DIE UMGEBUNG WIRD GESTELLT, NIE DER PRÜFLING: jsdom hat weder Zwischenablage noch Rechteanfrage,
// also bekommt das Fenster beides (`panel-dom.ts`). `panel.html`, `panel.js` und `i18n.js` laufen
// unverändert, der echte Worker steht dahinter. Kein Chromium — Testgruppe `rest`.
import { afterEach, describe, expect, it } from "vitest";
import { read } from "../klara-browser/harness";
import { mount, schliesseFenster } from "../klara-browser/panel-dom";
import { fokus, nachrichten, wortschatz } from "./werkzeug";

const TEXT = "Ein Verbesserungsvorschlag aus dem Chat.\n\nZweiter Absatz mit Umlauten: Größe äöü.";

afterEach(schliesseFenster);

describe("JOB 3524 · CHR-EINFUEGEN-KLARHEIT — der Leerzustand des vierten Umfangs", () => {
  it("L1 · leer heisst beim vierten Umfang „noch nicht eingefügt“, bei den drei anderen „nicht vorhanden“ (DE und EN)", async () => {
    const view = await mount();
    const texte = wortschatz(view.win);
    for (const sprache of ["de", "en"]) {
      view.sprache(sprache);
      const wort = texte[sprache] ?? {};
      expect(
        wort.scopeNotPasted,
        `${sprache}: kein eigener Satz für den vierten Umfang`,
      ).toBeTruthy();
      expect(
        wort.scopeNotPasted,
        `${sprache}: der vierte Umfang teilt sich den Satz mit den anderen`,
      ).not.toBe(wort.scopeEmpty);
      expect(view.el("info-clipboard").textContent).toBe(`· ${wort.scopeNotPasted}`);
      for (const leer of ["article", "page"])
        expect(view.el(`info-${leer}`).textContent, `${sprache}/${leer}`).toBe(
          `· ${wort.scopeEmpty}`,
        );
    }
    // Und der neue Satz behauptet nichts über die Zwischenablage des Menschen und nichts über
    // Rechte — beides weiss die Leiste an dieser Stelle gar nicht.
    for (const sprache of ["de", "en"])
      expect(texte[sprache]?.scopeNotPasted).not.toMatch(
        /Zwischenablage|clipboard|Recht|permission|erlaub|allow/i,
      );
  });

  it("L2 · der Zwischenablageblock steht nur beim gewählten Umfang „Zwischenablage“", async () => {
    const view = await mount();
    expect(view.el("mode-selection").checked, "die Markierung ist der Ausgangsumfang").toBe(true);
    expect(view.el("clipboard-box").hidden, "der Block drängt den Inhalt nach unten").toBe(true);

    view.el("mode-clipboard").click();
    await view.settle();
    expect(view.el("clipboard-box").hidden, "der gewählte Umfang zeigt sein Feld nicht").toBe(
      false,
    );
    expect(view.el("mode-clipboard").checked).toBe(true);

    view.el("mode-selection").click();
    await view.settle();
    expect(view.el("clipboard-box").hidden, "der Block blieb nach dem Wechsel stehen").toBe(true);
    expect(view.el("mode-clipboard").checked).toBe(false);
  });

  it("L3 · die Wahl allein liest nichts, fragt kein Recht an — und setzt den Schreibpunkt ins Feld", async () => {
    const view = await mount({ zwischenablage: { text: TEXT } });
    expect(view.el("mode-clipboard").disabled, "der vierte Umfang war nicht wählbar").toBe(false);

    view.el("mode-clipboard").click();
    await view.settle();

    expect(view.leseZaehler(), "die Wahl hat die Zwischenablage gelesen").toBe(0);
    expect(view.rechteAnfragen(), "die Wahl hat ein Recht angefragt").toEqual([]);
    expect(fokus(view.win), "der Schreibpunkt steht nicht im Feld").toBe("clipboard");
    // Der Worker trägt den Umfang MIT — die Fläche behauptet ihn nicht allein. Genau eine Nachricht,
    // und sie nennt den vierten Umfang; alles Weitere (Lesen, Recht) steht oben als Null gemessen.
    const gewaehlt = nachrichten(view.messages, "mode") as { mode?: string }[];
    expect(
      gewaehlt.map((m) => m.mode),
      "die Umfangswahl ging nicht genau einmal hinaus",
    ).toEqual(["clipboard"]);
    expect(view.el("scope-value").textContent).toBe(wortschatz(view.win).de?.modeClipboard);
    // Gespeichert wird trotzdem nichts: der gewählte Umfang hat noch keinen Inhalt.
    expect(view.el("save").disabled, "ein leerer Umfang war speicherbar").toBe(true);
  });

  it("L4 · erst der eingefügte Text macht den Umfang speicherbar — und er heisst dann so", async () => {
    const view = await mount({ zwischenablage: { text: TEXT } });
    view.el("mode-clipboard").click();
    await view.settle();
    const texte = wortschatz(view.win);
    expect(view.el("scope-value").textContent, "der vierte Umfang trug einen fremden Namen").toBe(
      texte.de?.modeClipboard,
    );

    view.input("clipboard", TEXT);
    await view.settle();
    await view.settle();

    expect(view.el("mode-clipboard").checked).toBe(true);
    expect(view.el("clipboard-box").hidden).toBe(false);
    expect(view.el("info-clipboard").textContent).toBe(
      `· ${TEXT.length} ${texte.de?.chars ?? "Zeichen"}`,
    );
    expect(view.el("origin-box").hidden, "die Herkunftswahl fehlt beim eingefügten Text").toBe(
      false,
    );

    view.el("mode-selection").click();
    await view.settle();
    expect(view.el("clipboard-box").hidden, "der Block blieb trotz anderem Umfang").toBe(true);
    expect(view.el("scope-value").textContent).toBe(texte.de?.modeSelection);
    expect(
      view.el("info-clipboard").textContent,
      "der eingefügte Text ging beim Wechsel verloren",
    ).toBe(`· ${TEXT.length} ${texte.de?.chars ?? "Zeichen"}`);
  });

  it("L5 · kein Recht, kein Lesen, keine Hintergrundaktion — und kein Ausgang wird verdeckt", async () => {
    const view = await mount({ zwischenablage: { text: TEXT } });
    view.sprache("en");
    view.el("mode-clipboard").click();
    await view.settle();
    view.sprache("de");
    await view.settle();
    expect(view.leseZaehler(), "irgendetwas hat nebenher gelesen").toBe(0);
    expect(view.rechteAnfragen(), "irgendetwas hat nebenher ein Recht angefragt").toEqual([]);

    // Der neue Leerzustand ist ein VIERTER Satz und verdeckt keinen der drei Ausgänge.
    const texte = wortschatz(view.win);
    for (const sprache of ["de", "en"]) {
      const wort = texte[sprache] ?? {};
      for (const ausgang of ["clipboard_manual", "clipboard_empty", "clipboard_failed"])
        expect(wort.scopeNotPasted, `${sprache}/${ausgang}`).not.toBe(wort[ausgang]);
      expect(wort.scopeNotPasted, `${sprache}: der Rückfalltext`).not.toBe(wort.storage_error);
    }
    // Und das Manifest bleibt, wie es war: `clipboardRead` nur als optionales Recht.
    const manifest = JSON.parse(read("manifest.json")) as {
      permissions?: string[];
      optional_permissions?: string[];
    };
    expect(manifest.permissions ?? []).not.toContain("clipboardRead");
    expect(manifest.optional_permissions ?? []).toContain("clipboardRead");
  });

  it("L6 · die langen Erläuterungen sind zugeklappt, die konkreten Warnungen nicht", async () => {
    const view = await mount();
    const details = view.el("details");
    expect(details.hasAttribute("open"), "der Aufklapper steht offen").toBe(false);
    const drin = details.innerHTML;
    for (const schluessel of [
      "scopeHint",
      "contentHint",
      "summaryHint",
      "classificationHint",
      "sourceHint",
      "originHint",
      "instructions",
      "sessionHint",
    ])
      expect(drin, `Erläuterung ${schluessel} steht nicht im Aufklapper`).toContain(
        `data-i18n="${schluessel}"`,
      );
    // Konkrete Warnungen und die Zustandszeile bleiben ausserhalb — sie sind keine Erläuterung.
    for (const marke of [
      'id="scope-none"',
      'id="ai-chat"',
      'id="source-changed"',
      'id="image-note"',
      'id="gaps-box"',
      'id="clipboard-box"',
      'id="status"',
    ])
      expect(drin, `${marke} wurde in den Aufklapper gesperrt`).not.toContain(marke);

    // Die Reihenfolge der Fläche, an der ausgelieferten Datei abgelesen.
    const html = read("panel.html");
    const stelle = (marke: string) => {
      const i = html.indexOf(marke);
      expect(i, `${marke} fehlt in panel.html`).toBeGreaterThan(-1);
      return i;
    };
    const reihe = [
      'id="done"',
      'id="preview"',
      'id="scope-box"',
      'id="clipboard-box"',
      'id="content"',
      'id="title"',
      'id="confidentiality"',
      'id="details"',
      'id="save"',
    ];
    for (let i = 1; i < reihe.length; i += 1)
      expect(
        stelle(reihe[i - 1] ?? ""),
        `${reihe[i - 1]} steht nicht vor ${reihe[i]}`,
      ).toBeLessThan(stelle(reihe[i] ?? ""));
  });
});
