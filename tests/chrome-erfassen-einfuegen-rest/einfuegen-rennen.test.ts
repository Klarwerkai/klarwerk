// ================================================================================================
// CHROME-ERFASSEN-EINFUEGEN (Rest aus 3412/3524/3279) — DOPPELKLICK, VERZÖGERTE RECHTEANFRAGE,
// VERTAUSCHTE ANTWORTEN UND KONKURRIERENDE ERFASSUNGEN.
// ================================================================================================
//
// DIE BEFUNDE, an der Quelle abgelesen (Basis 93c25f5a):
//
//   R1  Doppelklick auf „Aus Zwischenablage einfügen": der Klickzuhörer wartete zuerst auf die
//       Rechteanfrage, OHNE eine Sperre zu setzen. Ein zweiter Klick in dieser Zeit startete einen
//       zweiten Lauf — zwei Anfragen, zwei Lesevorgänge, zwei Sendungen.
//   R2  Verzögerte Rechteanfrage: die Kennung der Übernahme wurde erst NACH der Anfrage aus
//       `current` gelesen. Wechselte die Übernahme in der Zwischenzeit (verwerfen, neu erfassen),
//       landete der Ablagetext still in der NEUEN Übernahme.
//   R3  Dasselbe, wenn die ANTWORT DER ABLAGE erst nach dem Wechsel eintrifft (vertauschte
//       Reihenfolge: Klick → Lesen beginnt → neue Übernahme → Ablage antwortet).
//   W1  `worker.js`: zwei Erfassungen, während der Worker arbeitet — die zweite überschrieb die
//       erste im Merker, die erste verschwand ohne jede Spur.
//
// WAS ECHT IST: `panel.html`, `i18n.js`, `panel.js` und der Worker laufen unverändert
// (`tests/klara-browser/panel-dom.ts`, `harness.ts`). Gestellt sind allein Browserdinge, die jsdom
// nicht hat — die Rechteanfrage und die Zwischenablage, beide hier ANHALTBAR, damit das Rennen
// deterministisch eintritt statt zufällig.
//
// WAS HIER NICHT GEMESSEN WIRD, ausdrücklich: ob Chrome den Rechtedialog zeigt, wie lange er offen
// steht, und die echte installierte Erweiterung mit nativer Markierung und Tabwechsel. Das ist
// Browser- und Installationsverhalten und bleibt der Abnahme mit echter Erweiterung vorbehalten.
import { setImmediate } from "node:timers";
import { afterEach, describe, expect, it } from "vitest";
import type { View } from "../../extensions/klara-browser/types";
import { harness } from "../klara-browser/harness";
import { mount, schliesseFenster } from "../klara-browser/panel-dom";

afterEach(schliesseFenster);

const TEXT = "Antwort aus dem Chat.\n\nZweiter Absatz mit Umlauten: Größe äöü.";

/** Ein angehaltenes Versprechen und sein Auslöser — die Stelle, an der der Fall das Rennen steuert. */
function schranke(): { warte: Promise<void>; frei: () => void } {
  let frei = () => {};
  const warte = new Promise<void>((los) => {
    frei = los;
  });
  return { warte, frei };
}

/** Ein Durchlauf der Ereignisschleife. */
const runde = () => new Promise<void>((fertig) => setImmediate(fertig));

type Arbeit = { id: string; variants: { clipboard: { available: boolean; text: string } } };
const arbeit = (daten: Record<string, unknown>) => daten.work as Arbeit | undefined;
type Nachricht = { type?: string; captureId?: string; text?: string };
const nachrichten = (alle: unknown[], typ: string) =>
  alle.map((m) => m as Nachricht).filter((m) => m.type === typ);

type Wortschatz = Record<string, Record<string, string>>;
const wortschatz = (fenster: { eval(quelle: string): unknown }) =>
  fenster.eval("globalThis.KLARA_TEXT") as Wortschatz;

describe("Einfügen-Klick gegen Doppelklick, verzögerte Rechte und vertauschte Antworten", () => {
  it("R1 · Doppelklick während der Rechteanfrage: genau eine Anfrage, ein Lesen, eine Sendung", async () => {
    const recht = schranke();
    const view = await mount({ zwischenablage: { text: TEXT }, recht: { warte: recht.warte } });
    const vorgang = arbeit(view.data)?.id;
    expect(vorgang, "ohne Übernahme misst R1 nichts").toBeTruthy();

    view.el("paste").click();
    view.el("paste").click();
    await runde();
    recht.frei();
    await view.settle();
    await view.settle();

    expect(view.rechteAnfragen(), "der zweite Klick fragte ein zweites Mal an").toEqual([
      ["clipboardRead"],
    ]);
    expect(view.leseZaehler(), "der zweite Klick las die Ablage ein zweites Mal").toBe(1);
    const gesendet = nachrichten(view.messages, "clipboard");
    expect(gesendet, "der eingefügte Text ging mehr als einmal hinaus").toHaveLength(1);
    expect(gesendet[0]?.captureId).toBe(vorgang);
    expect(view.el("clipboard").value).toBe(TEXT);
  });

  it("R2 · die Übernahme wechselt, während der Rechtedialog offen steht — nichts landet in der neuen", async () => {
    const recht = schranke();
    const view = await mount({ zwischenablage: { text: TEXT }, recht: { warte: recht.warte } });
    const alt = arbeit(view.data)?.id;

    view.el("paste").click();
    await runde();
    expect(view.rechteAnfragen(), "die Anfrage hätte jetzt offen stehen müssen").toHaveLength(1);

    // Während der Dialog offen ist: verwerfen und eine neue Seite erfassen — derselbe Weg wie mit
    // dem Erweiterungssymbol. Die Leiste zieht von selbst auf die neue Übernahme nach.
    view.el("cancel").click();
    await view.settle();
    view.setSelected({
      text: "Neue Markierung auf derselben Seite.",
      url: view.selected.url,
      title: view.selected.title,
    });
    await view.capture();
    await view.settle();
    const neu = arbeit(view.data)?.id;
    expect(neu, "die neue Übernahme ist nicht entstanden").toBeTruthy();
    expect(neu).not.toBe(alt);

    recht.frei();
    await view.settle();
    await view.settle();

    const texte = wortschatz(view.win);
    expect(view.el("status").textContent).toBe(texte.de?.clipboard_stale);
    expect(view.el("status").className, "kein Ausfall, eine Nachfrage").toBe("warn");
    expect(view.leseZaehler(), "für eine verlassene Übernahme wurde gelesen").toBe(0);
    expect(view.el("clipboard").value, "der Text landete im Feld der neuen Übernahme").toBe("");
    expect(nachrichten(view.messages, "clipboard"), "es ging Ablagetext hinaus").toHaveLength(0);
    expect(arbeit(view.data)?.id).toBe(neu);
    expect(arbeit(view.data)?.variants.clipboard.available).toBe(false);
  });

  it("R3 · die Ablage antwortet erst nach dem Wechsel — der gelesene Text wird verworfen, nicht umgehängt", async () => {
    const ablage = schranke();
    const view = await mount({ zwischenablage: { text: TEXT, warte: ablage.warte } });
    const alt = arbeit(view.data)?.id;

    view.el("paste").click();
    await runde();
    await runde();
    expect(view.leseZaehler(), "das Lesen hätte jetzt begonnen haben müssen").toBe(1);

    view.el("cancel").click();
    await view.settle();
    await view.capture();
    await view.settle();
    const neu = arbeit(view.data)?.id;
    expect(neu).not.toBe(alt);

    ablage.frei();
    await view.settle();
    await view.settle();

    const texte = wortschatz(view.win);
    expect(view.el("status").textContent).toBe(texte.de?.clipboard_stale);
    expect(view.el("clipboard").value).toBe("");
    expect(nachrichten(view.messages, "clipboard")).toHaveLength(0);
    expect(arbeit(view.data)?.variants.clipboard.available).toBe(false);
  });

  it("R4 · Gegenprobe: verzögerte Rechteanfrage OHNE Wechsel — der Text kommt in genau diesen Vorgang", async () => {
    const recht = schranke();
    const view = await mount({ zwischenablage: { text: TEXT }, recht: { warte: recht.warte } });
    const vorgang = arbeit(view.data)?.id;

    view.el("paste").click();
    await runde();
    recht.frei();
    await view.settle();
    await view.settle();

    expect(view.el("clipboard").value).toBe(TEXT);
    expect(nachrichten(view.messages, "clipboard").map((m) => m.captureId)).toEqual([vorgang]);
    expect(nachrichten(view.messages, "edit").every((m) => m.captureId === vorgang)).toBe(true);
    expect(arbeit(view.data)?.variants.clipboard.text).toBe(TEXT);
    expect(view.el("status").textContent).not.toBe(wortschatz(view.win).de?.clipboard_stale);
    // Einfügen ist kein Speichern.
    expect(view.requests.filter((u) => u.endsWith("/api/drafts"))).toHaveLength(0);
  });

  it("R5 · der neue Ausgang hat in DE und EN einen eigenen, ehrlichen Satz", async () => {
    const view = await mount({ auswahl: false });
    const texte = wortschatz(view.win);
    for (const [sprache, gesendet] of [
      ["de", /nichts eingefügt und nichts gesendet/],
      ["en", /nothing was pasted and nothing was sent/i],
    ] as const) {
      const satz = texte[sprache]?.clipboard_stale ?? "";
      expect(satz, `${sprache}: kein Satz`).toMatch(gesendet);
      expect(satz).not.toBe(texte[sprache]?.storage_error);
      expect(satz).not.toBe(texte[sprache]?.clipboard_manual);
    }
  });
});

describe("worker.js — konkurrierende Erfassungen verschwinden nicht still", () => {
  it("W1 · zwei Erfassungen während eines laufenden Vorgangs: die erste wird gelesen, die zweite steht zur Wahl", async () => {
    const anmeldung = schranke();
    const h = harness(async (input) => {
      if (String(input).endsWith("/login")) {
        await anmeldung.warte;
        return Response.json({
          token: "fixture-session-secret",
          user: { id: "person-a", email: "a@example.test" },
        });
      }
      throw new Error("kein Netz");
    });
    const laeuft = h.send({ type: "login", email: "a@example.test", password: "x" });
    await runde();
    // Mitten in die Anmeldung: zuerst das Symbol auf der erfassten Seite, dann ein Rechtsklick auf
    // einer zweiten Seite.
    await h.capture();
    const zweite = { id: 7, url: "https://example.test/zweite-seite", title: "Zweite Seite" };
    await h.listeners.action?.(zweite);
    expect(h.data.work, "die Erfassung lief, obwohl der Worker gesperrt war").toBeUndefined();

    anmeldung.frei();
    await laeuft;
    await runde();
    await runde();

    const zustand = (await h.send({ type: "state" })) as Ansicht;
    expect(zustand.status, "die erste Erfassung ist verschwunden").toBe("preview");
    expect(zustand.selection?.url).toBe(h.selected.url);
    expect(zustand.pendingCapture, "die zweite Erfassung ist still verschwunden").toBe(true);
    expect(zustand.pendingSource).toEqual({ url: zweite.url, title: zweite.title });
    // Bei zwei Erfassungen wird nichts verdrängt — es gibt auch keinen Hinweis darauf.
    expect(zustand.skippedCaptures).toBeUndefined();
  });

  it("W1b · DREI Erfassungen während eines laufenden Vorgangs: die mittlere wird gezählt und in der Leiste genannt, nicht still gelöscht", async () => {
    // Bens Minimalreproduktion (Nacharbeit 2): A, B, C während der Anmeldung — der Merker ging
    // [A, B] → [A, C], und B war ohne jede Rückmeldung weg.
    const anmeldung = schranke();
    const h = harness(async (input) => {
      if (String(input).endsWith("/login")) {
        await anmeldung.warte;
        return Response.json({
          token: "fixture-session-secret",
          user: { id: "person-a", email: "a@example.test" },
        });
      }
      throw new Error("kein Netz");
    });
    const laeuft = h.send({ type: "login", email: "a@example.test", password: "x" });
    await runde();
    await h.capture();
    const mittlere = { id: 7, url: "https://example.test/mittlere-seite", title: "Mittlere Seite" };
    const letzte = { id: 7, url: "https://example.test/letzte-seite", title: "Letzte Seite" };
    await h.listeners.action?.(mittlere);
    await h.listeners.action?.(letzte);
    expect(h.data.work, "die Erfassung lief, obwohl der Worker gesperrt war").toBeUndefined();
    // Schon WÄHREND der Sperre festgehalten — nicht erst, wenn alles vorbei ist.
    expect(h.data.skippedCaptures, "die verdrängte Erfassung wurde nicht festgehalten").toBe(1);

    anmeldung.frei();
    await laeuft;
    await runde();
    await runde();

    const zustand = (await h.send({ type: "state" })) as Ansicht;
    expect(zustand.selection?.url, "die erste Erfassung ist verschwunden").toBe(h.selected.url);
    expect(zustand.pendingCapture).toBe(true);
    expect(zustand.pendingSource).toEqual({ url: letzte.url, title: letzte.title });
    expect(zustand.skippedCaptures, "die mittlere Erfassung ist still verschwunden").toBe(1);

    // Und die Leiste SAGT es — als Warnung mit Zahl, in DE und EN.
    const view = await mount({ an: h, auswahl: false });
    expect(view.el("skipped-captures").hidden, "kein sichtbarer Hinweis").toBe(false);
    expect(view.el("skipped-captures").className).toContain("warn");
    expect(view.el("skipped-count").textContent).toBe("1");
    const texte = wortschatz(view.win);
    for (const sprache of ["de", "en"]) {
      view.sprache(sprache);
      expect(view.el("skipped-captures").textContent).toContain(
        texte[sprache]?.skippedCaptures ?? "kein Satz",
      );
    }

    // Beantwortet der Mensch die Lage, ist der Hinweis gesehen und verschwindet — nicht vorher.
    view.el("pending-keep").click();
    await view.settle();
    expect(view.el("skipped-captures").hidden).toBe(true);
    expect(h.data.skippedCaptures).toBe(0);
  });
});

type Ansicht = View & {
  pendingCapture?: boolean;
  pendingSource?: { url: string; title: string };
  skippedCaptures?: number;
};
