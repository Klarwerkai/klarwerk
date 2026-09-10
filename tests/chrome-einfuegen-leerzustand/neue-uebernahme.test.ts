// ================================================================================================
// JOB 3524 · Lieferung 3+4 — DIE LEISTE IST NACH DEM SPEICHERN UND NACH DEM VERWERFEN WIEDER BEREIT.
// ================================================================================================
//
// DIE ZWEI SACKGASSEN, in denen Pedi am 10.09. steckengeblieben ist:
//
//   Bildschirmfoto 09.18.36 — er hat links einen ChatGPT-Absatz TATSÄCHLICH markiert. Rechts steht
//   die Leiste noch auf dem zuvor gespeicherten Artikel (grüne Speicherbestätigung), und
//   „Markierung · nicht vorhanden" ist deaktiviert. Er kommt an seine neue Markierung nicht heran.
//   Der Grund steht in `worker.js`, `capture()`: solange eine Übernahme im Zustand liegt, wird eine
//   neue NICHT darübergeschrieben — sie wird nur als `pendingCapture` gemerkt. Das ist richtig, aber
//   der einzige Ausweg war „Auswahl verwerfen" und danach ein neuer Griff zum Symbol.
//
//   Bildschirmfoto 09.00.06 — nach dem Verwerfen steht „Keine Auswahl. Text markieren, dann
//   Rechtsklick." und sonst nichts. Pedi hat die Erweiterung neu gestartet.
//
// WAS HIER GEMESSEN WIRD:
//
//   N1  Nach dem Speichern steht die Führung OBEN: der Link auf GENAU die gespeicherte Kennung und
//       daneben „Neue Übernahme". Vorher rot: `#done` stand ganz unten, ohne zweite Handlung.
//   N2  DER KERN (Nachtrag der Steuerung 09:2x): der Weg erfasst die aktuelle Auswahl der Seite NEU.
//       Danach ist „Markierung" wählbar und trägt den NEUEN Text — und der zuvor gespeicherte
//       Entwurf ist unverändert. Vorher rot: es gab diesen Weg gar nicht.
//   N3  Nach dem Verwerfen trägt der Zustand „Keine Auswahl" eine sichtbare Aktion, die in eine
//       neue Übernahme führt, ohne die Erweiterung neu zu starten.
//   N4  Auf bewusste Aktion, nie im Hintergrund: das blosse Öffnen und Zeichnen der Leiste erfasst
//       nichts. Und ohne einen Tab, den die Erweiterung schon einmal lesen durfte, steht kein Knopf
//       da, der nichts tun könnte.
import { afterEach, describe, expect, it } from "vitest";
import { mount, schliesseFenster } from "../klara-browser/panel-dom";
import { nachrichten, wortschatz } from "./werkzeug";

const NEUER_TEXT = `Der frisch markierte Absatz aus dem Chat. ${"Noch ein Satz. ".repeat(20)}`;

afterEach(schliesseFenster);

/** Anmelden, Titel setzen, bestätigen, speichern — der kurze Weg zu einem echten Entwurf. */
async function speichere(view: Awaited<ReturnType<typeof mount>>, titel: string) {
  await view.login();
  view.input("title", titel);
  await view.settle();
  view.el("confirm").checked = true;
  view.el("confirm").dispatchEvent(new view.win.Event("change"));
  view.el("save").click();
  await view.settle();
}

describe("JOB 3524 · die Leiste führt nach dem Speichern und nach dem Verwerfen weiter", () => {
  it("N1 · die Erfolgsmeldung oben trägt den Link auf die gespeicherte Kennung und „Neue Übernahme“", async () => {
    const view = await mount();
    await speichere(view, "Der erste Entwurf");

    expect(view.el("status").className, "gespeichert ist grün").toBe("ok");
    expect(view.el("done").hidden, "die Bestätigung fehlt").toBe(false);
    // GENAU die gespeicherte Kennung, kein Bibliothekslink.
    expect(view.el("open").hidden).toBe(false);
    expect(view.el("open").getAttribute("href")).toBe(
      "https://app.klarwerk.ai/capture/frontdoor?draft=draft-test&lang=de",
    );
    expect(view.el("neu").hidden, "die zweite Handlung fehlt neben dem Link").toBe(false);
    for (const sprache of ["de", "en"]) {
      view.sprache(sprache);
      expect(view.el("neu").textContent).toBe(wortschatz(view.win)[sprache]?.newCapture);
    }
    // Sie steht OBEN: vor der Vorschau, also vor Inhalt, Angaben und den beiden Knöpfen.
    const html = view.win.document.documentElement.outerHTML;
    expect(html.indexOf('id="done"'), "die Führung steht unter der Vorschau").toBeLessThan(
      html.indexOf('id="preview"'),
    );
  });

  it("N2 · „Neue Übernahme“ liest die Seite neu — die neue Markierung ist da, der Entwurf unberührt", async () => {
    const view = await mount();
    await speichere(view, "Der erste Entwurf");
    const gespeichert = view.koerper.filter((k) => k.url.endsWith("/api/drafts"));
    expect(gespeichert.length, "es wurde gar nichts gespeichert").toBe(1);
    const alterText = String(view.el("content").textContent);
    // Der Stand VOR der neuen Übernahme — verglichen wird gegen ihn, nicht gegen null: der Weg zum
    // Entwurf hat selbst Anfragen gestellt, und die gehören nicht dieser Messung.
    const vorher = [...view.requests];

    // Die Seite hat sich unter der Leiste geändert: Pedi hat einen anderen Absatz markiert.
    // Dieselbe Adresse, derselbe Tab — nur eine andere Markierung.
    view.setSelected({
      text: NEUER_TEXT,
      url: view.selected.url,
      title: view.selected.title,
    });

    view.el("neu").click();
    await view.settle();

    // Der Umfang „Markierung" ist wieder wählbar und trägt den NEUEN Text.
    expect(view.el("preview").hidden, "die Leiste blieb ohne Übernahme").toBe(false);
    expect(view.el("mode-selection").disabled, "die neue Markierung blieb unerreichbar").toBe(
      false,
    );
    expect(view.el("mode-selection").checked).toBe(true);
    expect(view.el("info-selection").textContent).toBe(
      `· ${NEUER_TEXT.length} ${wortschatz(view.win).de?.chars}`,
    );
    expect(view.el("content").textContent).toContain("Der frisch markierte Absatz");
    expect(view.el("content").textContent, "der alte Inhalt stand noch da").not.toBe(alterText);

    // UND DER GESPEICHERTE ENTWURF IST UNVERÄNDERT: es ging kein einziger Schreibauftrag hinaus.
    expect(
      view.koerper.filter((k) => k.url.endsWith("/api/drafts")),
      "die neue Übernahme hat den Entwurf angefasst",
    ).toEqual(gespeichert);
    expect(view.requests, "die neue Übernahme hat überhaupt eine Anfrage gestellt").toEqual(vorher);
    // Die neue Übernahme ist eine NEUE: eigene Kennung, keine Erfolgsbehauptung mehr.
    expect(
      view.el("done").hidden,
      "die alte Erfolgsmeldung stand noch über der neuen Übernahme",
    ).toBe(true);
  });

  it("N3 · nach dem Verwerfen führt eine sichtbare Aktion in eine neue Übernahme", async () => {
    const view = await mount();
    view.el("cancel").click();
    await view.settle();

    expect(view.el("preview").hidden, "die Auswahl wurde nicht verworfen").toBe(true);
    expect(view.el("rest").hidden, "der Ruhezustand fehlt").toBe(false);
    // DIE SACKGASSE IST WEG: hier steht eine Aktion, nicht nur ein Satz.
    expect(view.el("neu-rest").hidden, "der Zustand „Keine Auswahl“ ist eine Sackgasse").toBe(
      false,
    );
    for (const sprache of ["de", "en"]) {
      view.sprache(sprache);
      expect(view.el("neu-rest").textContent).toBe(wortschatz(view.win)[sprache]?.newCapture);
    }

    view.setSelected({
      text: NEUER_TEXT,
      url: view.selected.url,
      title: view.selected.title,
    });
    view.el("neu-rest").click();
    await view.settle();

    expect(view.el("preview").hidden, "die neue Übernahme kam nicht zustande").toBe(false);
    expect(view.el("content").textContent).toContain("Der frisch markierte Absatz");
    expect(view.el("rest").hidden).toBe(true);
  });

  it("N4 · nur auf bewusste Aktion — und kein Knopf, der nichts tun könnte", async () => {
    // Ohne vorherige Übernahme gibt es keinen Tab, den die Erweiterung lesen durfte.
    const leer = await mount({ auswahl: false });
    expect(leer.el("rest").hidden).toBe(false);
    expect(leer.el("neu-rest").hidden, "ein Knopf ohne Tab dahinter").toBe(true);
    expect(
      nachrichten(leer.messages, "recapture"),
      "das blosse Öffnen der Leiste hat erfasst",
    ).toEqual([]);
    // Und die eine Zeile sagt trotzdem, was zu tun ist (JOB 3278, Pflichtlieferung 4).
    expect(leer.el("status").textContent).toBe("Keine Auswahl. Text markieren, dann Rechtsklick.");
    schliesseFenster();

    // Mit Übernahme: erst der Klick erfasst, das Zeichnen nicht.
    const view = await mount();
    view.sprache("en");
    view.sprache("de");
    await view.settle();
    expect(
      nachrichten(view.messages, "recapture"),
      "das Zeichnen der Leiste hat nebenher erfasst",
    ).toEqual([]);
    view.el("cancel").click();
    await view.settle();
    view.el("neu-rest").click();
    await view.settle();
    expect(
      nachrichten(view.messages, "recapture").length,
      "die bewusste Aktion hat nicht genau einmal erfasst",
    ).toBe(1);
  });
});
