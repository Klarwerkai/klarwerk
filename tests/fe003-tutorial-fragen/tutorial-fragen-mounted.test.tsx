// @vitest-environment jsdom
// ================================================================================================
// FE-003 · INTERAKTIVES SEITENTUTORIAL „FRAGEN“ — die Kriterien E1–E7 an der montierten Hülle.
// ================================================================================================
//
// Gemessen wird die ECHTE Hülle (`AppShell`) mit der ECHTEN Fragen-Seite (`pages/Ask.tsx`); das Netz
// wird auf `fetch`-Ebene beobachtet (`./huelle.tsx`). Die Tests sind aus dem freigegebenen Ticket
// abgeleitet, nicht aus dem Code: Knopf und Position (E1), Unterrichtsfolge (E2), Bedienung (E3),
// gemeinsame Bausteine und Ziele (E4), KI-aus und Mutationsfreiheit (E5), Tastatur/Fokus/Bewegung
// (E6), Pilot vs. Rahmen (E7).
//
// WAS HIER NICHT GEMESSEN WIRD — und wo es steht: echte Breiten (1280/1024/390 px), echte
// Tastaturfolge und Layout brauchen einen Browser: `tests-smoke/fe003-tutorial-fragen.spec.ts`. Ob
// eine neue Person das Gelernte anwenden kann, misst KEIN Test — das ist die menschliche Abnahme mit
// Pedi und bleibt offen (E8).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FRAGEN_ZIEL } from "../../apps/web/src/components/fragen/ziele";
import i18n from "../../apps/web/src/i18n";
import { TutorialBereich } from "../../apps/web/src/tutorial/TutorialBereich";
import { TUTORIALS, tutorialFuerPfad } from "../../apps/web/src/tutorial/rahmen";
import type { TutorialDefinition } from "../../apps/web/src/tutorial/typen";
import {
  ECHTE_QUELLE,
  type Montiert,
  alle,
  bis,
  blattSchliessen,
  demo,
  demoBlatt,
  echtesFeld,
  klick,
  medienStub,
  mehrUeberMenue,
  montiere,
  mutationen,
  netz,
  netzStub,
  oeffneTutorial,
  q,
  ruhe,
  taste,
  tippe,
  warte,
  zuKapitel,
  zuTeil,
} from "./huelle";

const FRAGEN = tutorialFuerPfad("/fragen") as TutorialDefinition;
const SCHRITTE = [
  "verstehen",
  "formulieren",
  "absenden",
  "antwort",
  "quelle",
  "sonderfaelle",
  "ueben",
];

let m: Montiert | null = null;
const sprache = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
class Aeusserung {
  text: string;
  lang = "";
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function mitSprachausgabe(): void {
  (window as unknown as { speechSynthesis?: unknown }).speechSynthesis = sprache;
  (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance =
    Aeusserung;
}
function ohneSprachausgabe(): void {
  // `vorlesenMoeglich()` fragt `"speechSynthesis" in window` — die Eigenschaft muss also WEG sein,
  // nicht nur leer. Deshalb `Reflect.deleteProperty` statt einer Zuweisung.
  Reflect.deleteProperty(window, "speechSynthesis");
  Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
}

beforeEach(async () => {
  // Pedi 28.09.2026 · Ergänzung 1: die Fragenseite merkt sich Entwurf und Antwort je Konto im
  // Browserspeicher, und alle Fälle hier melden dasselbe Konto (`u-ex`). Jeder Fall ist ein
  // ERSTBESUCH — ohne diese Zeile begänne er mit dem Arbeitsstand des vorigen.
  localStorage.clear();
  netz.anfragen = [];
  netz.lage = { kiAktiv: true, rolle: "experte" };
  medienStub();
  vi.stubGlobal("fetch", vi.fn(netzStub));
  ohneSprachausgabe();
  sprache.speak.mockClear();
  sprache.cancel.mockClear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  m?.abbauen();
  m = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const t = (k: string, o: Record<string, unknown> = {}): string => i18n.t(k, o);

async function echteFrageStellen(wurzel: ParentNode, frage: string): Promise<void> {
  const feld = echtesFeld(wurzel);
  await tippe(feld, frage);
  await klick(feld.form?.querySelector('button[type="submit"]'));
  await bis(() => Boolean(q(wurzel, "ask-answer")));
}

function schrittDerErklaerung(wurzel: ParentNode): string | null {
  return q(wurzel, "tutorial-erklaerung")?.getAttribute("data-schritt") ?? null;
}

// ================================================================================================
describe("E1 · der Knopf „Tutorial“: Position, Farbe, Öffnen und Schliessen", () => {
  it("steht auf /fragen in eigener Leiste direkt unter dem Kopfband, vor <main>, farblich abgesetzt", async () => {
    m = await montiere("/fragen");
    const kopf = q(m.container, "kopfband");
    const leiste = q(m.container, "tutorial-leiste");
    const knopf = q<HTMLButtonElement>(m.container, "tutorial-knopf");
    expect(kopf, "Kopfband fehlt").not.toBeNull();
    expect(leiste, "Tutorial-Leiste fehlt").not.toBeNull();
    // Unmittelbar unter dem Kopfband: das nächste Element nach dem <header>.
    expect(kopf?.nextElementSibling).toBe(leiste);
    // Vor dem Inhalt: die Leiste scrollt nicht mit der Seite.
    const main = m.container.querySelector("main") as HTMLElement;
    expect(main.contains(leiste)).toBe(false);
    expect(leiste?.compareDocumentPosition(main)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    // Beschriftung genau „Tutorial“, andere Farbe als der schwarze Kopf.
    expect(knopf?.textContent?.trim()).toBe("Tutorial");
    expect(kopf?.className).toContain("bg-ink");
    expect(knopf?.className).toContain("bg-brand");
    expect(knopf?.className).not.toContain("bg-ink");
    expect(knopf?.getAttribute("aria-expanded")).toBe("false");
  });

  it("öffnet den Bereich OBEN in <main> vor der Seite und schliesst ihn wieder", async () => {
    m = await montiere("/fragen");
    const knopf = q<HTMLButtonElement>(m.container, "tutorial-knopf") as HTMLButtonElement;
    await oeffneTutorial(m.container);
    const bereich = q(m.container, "tutorial-bereich") as HTMLElement;
    expect(bereich).not.toBeNull();
    expect(knopf.getAttribute("aria-expanded")).toBe("true");
    expect(knopf.getAttribute("aria-controls")).toBe(bereich.id);
    expect(m.container.querySelector("main")?.contains(bereich)).toBe(true);
    const seite = q(m.container, "page-fragen") as HTMLElement;
    expect(bereich.compareDocumentPosition(seite)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(bereich.textContent).toContain(t("tutorial.fragen.titel"));
    expect(q(bereich, "tutorial-lernziel")?.textContent).toContain(t("tutorial.fragen.lernziel"));
    await klick(knopf);
    expect(q(m.container, "tutorial-bereich")).toBeNull();
    expect(knopf.getAttribute("aria-expanded")).toBe("false");
  });

  it("schmal (≤ 899 px) steht der Knopf ebenso direkt unter dem Kopfband", async () => {
    medienStub({ schmal: true });
    m = await montiere("/fragen");
    const kopf = q(m.container, "kopfband");
    expect(kopf?.nextElementSibling).toBe(q(m.container, "tutorial-leiste"));
    await oeffneTutorial(m.container);
    expect(m.container.querySelector("main")?.contains(q(m.container, "tutorial-bereich"))).toBe(
      true,
    );
  });
});

// ================================================================================================
describe("E7 · Pilot und Rahmen getrennt: nur /fragen hat ein Tutorial", () => {
  it("das Register trägt genau einen, vollständig ausgearbeiteten Eintrag: /fragen", () => {
    expect(TUTORIALS.map((x) => x.pfad)).toEqual(["/fragen"]);
    expect(FRAGEN.schritte.map((s) => s.id)).toEqual(SCHRITTE);
    for (const s of FRAGEN.schritte) {
      expect(s.teile.length, `${s.id} hat keine Vorführung`).toBeGreaterThan(0);
    }
  });

  for (const route of ["/start", "/bibliothek", "/erfassen", "/aufgaben", "/fragen/unterseite"]) {
    it(`auf ${route} erscheint weder Knopf noch leerer Bereich`, async () => {
      m = await montiere(route, "leer");
      expect(q(m.container, "leere-seite")).not.toBeNull();
      expect(q(m.container, "tutorial-leiste")).toBeNull();
      expect(q(m.container, "tutorial-knopf")).toBeNull();
      expect(q(m.container, "tutorial-bereich")).toBeNull();
      expect(tutorialFuerPfad(route)).toBeNull();
    });
  }
});

// ================================================================================================
describe("E1/E5 · die echte Seite behält Frage und Antwort — und das Tutorial sendet nichts", () => {
  it("Öffnen, vollständiges Durchlaufen samt Übung und Schliessen lassen Frage und Antwort stehen", async () => {
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    await echteFrageStellen(m.container, "Wie werden Reisen genehmigt?");
    const seite = q(m.container, "page-fragen");
    const karte = q(m.container, "ask-answer");
    expect(karte?.textContent).toContain("Reisen werden vorab");
    const vorher = netz.anfragen.length;
    const fragenVorher = netz.anfragen.filter((a) => a.pfad === "/api/ask").length;
    expect(fragenVorher).toBe(1);

    await oeffneTutorial(m.container);
    // Alle sieben Schritte über „Weiter“.
    for (let i = 0; i < SCHRITTE.length; i++) {
      expect(schrittDerErklaerung(m.container)).toBe(SCHRITTE[i]);
      if (SCHRITTE[i] === "absenden") {
        await klick(demo(m.container).querySelector('button[type="submit"]'));
      }
      if (SCHRITTE[i] === "quelle") {
        // Der tatsächliche Weg: „…“ → „Mehr …“ öffnet das Blatt mit der Quellenliste.
        await mehrUeberMenue(m.container);
        expect(
          demoBlatt()?.querySelector(`[data-tutorial-ziel="${FRAGEN_ZIEL.quellenliste}"]`),
        ).not.toBeNull();
        await blattSchliessen(demoBlatt());
        expect(demoBlatt()).toBeNull();
      }
      if (SCHRITTE[i] === "ueben") {
        const feld = demo(m.container).querySelector("input") as HTMLInputElement;
        await tippe(feld, "Meine Übungsfrage");
        await klick(demo(m.container).querySelector('button[type="submit"]'));
        await bis(
          () =>
            demo(m?.container as ParentNode).textContent?.includes(
              t("tutorial.fragen.demo.uebungsantwort"),
            ) ?? false,
        );
        expect(demo(m.container).textContent).toContain("Meine Übungsfrage");
      }
      if (i < SCHRITTE.length - 1) {
        await klick(q(m.container, "tutorial-weiter"));
      }
    }
    await klick(q(m.container, "tutorial-schliessen"));

    expect(q(m.container, "tutorial-bereich")).toBeNull();
    // Dieselbe Seite, derselbe Knoten — nichts wurde neu montiert.
    expect(q(m.container, "page-fragen")).toBe(seite);
    expect(q(m.container, "ask-answer")).toBe(karte);
    expect(echtesFeld(m.container).value).toBe("Wie werden Reisen genehmigt?");
    // Keine einzige verändernde Anfrage, keine weitere Frage.
    expect(mutationen(vorher)).toEqual([]);
    expect(netz.anfragen.filter((a) => a.pfad === "/api/ask").length).toBe(1);
  });

  it("„Eigene Frage stellen“: Fokus ins ECHTE Feld, die vorhandene Frage bleibt, nichts wird gesendet", async () => {
    m = await montiere("/fragen?q=Meine%20echte%20Frage");
    expect(echtesFeld(m.container).value).toBe("Meine echte Frage");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "ueben");
    await klick(q(m.container, "tutorial-eigene-frage"));
    expect(q(m.container, "tutorial-bereich")).toBeNull();
    const feld = echtesFeld(m.container);
    expect(document.activeElement).toBe(feld);
    expect(feld.value).toBe("Meine echte Frage");
    await warte(50);
    expect(mutationen()).toEqual([]);
    expect(netz.anfragen.some((a) => a.pfad === "/api/ask")).toBe(false);
  });
});

// ================================================================================================
describe("E5 · ohne KI-Verbindung: Tutorial und Übung funktionieren, ehrlicher Übergang", () => {
  it("alle Schritte und die Übung laufen ohne Modell, ohne Mutation, ohne Frage an den Server", async () => {
    netz.lage.kiAktiv = false;
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    const echtSenden = echtesFeld(m.container).form?.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    expect(echtSenden?.disabled, "ohne Modell ist der echte Sendeknopf gesperrt").toBe(true);

    await oeffneTutorial(m.container);
    for (const schritt of SCHRITTE) {
      await zuKapitel(m.container, schritt);
      expect(schrittDerErklaerung(m.container)).toBe(schritt);
      expect(demo(m.container).querySelector("[data-tutorial-ziel]")).not.toBeNull();
    }
    // Übung: tippen, in der Demo absenden, Antwort lesen, Quelle öffnen.
    const feld = demo(m.container).querySelector("input") as HTMLInputElement;
    await tippe(feld, "Wie viele Urlaubstage habe ich?");
    // Eingabetaste = implizites Absenden des Formulars.
    await act(async () => {
      feld.form?.requestSubmit();
    });
    await bis(
      () =>
        demo(m?.container as ParentNode).textContent?.includes(
          t("tutorial.fragen.demo.uebungHinweis"),
        ) ?? false,
    );
    await mehrUeberMenue(m.container);
    expect(
      demoBlatt()?.querySelector(`[data-tutorial-ziel="${FRAGEN_ZIEL.quellenliste}"]`),
    ).not.toBeNull();
    await blattSchliessen(demoBlatt());

    // Der Übergang sagt ehrlich, dass die echte Fragefunktion gerade fehlt — mit echten Wegen.
    const uebergang = q(m.container, "tutorial-uebergang") as HTMLElement;
    const kiAus = q(uebergang, "tutorial-uebergang-ki-aus") as HTMLElement;
    expect(kiAus).not.toBeNull();
    expect(kiAus.textContent).toContain(t("ai.unavailable.hint"));
    expect(
      kiAus.closest("[data-tutorial-demo]"),
      "die Alternativen sind ECHT, nicht Demo",
    ).toBeNull();
    expect(kiAus.querySelector('a[href="/bibliothek"]')?.textContent).toBe(
      t("ask.aiUnavailable.toLibrary"),
    );
    expect(kiAus.querySelector('a[href="/erfassen"]')?.textContent).toBe(
      t("ask.aiUnavailable.toCapture"),
    );

    expect(mutationen()).toEqual([]);
    expect(netz.anfragen.some((a) => a.pfad.startsWith("/api/ask"))).toBe(false);
  });

  it("Rolle Betrachter: „Wissen erfassen“ bleibt Lage ohne Link — die erlaubten Wege bleiben erhalten", async () => {
    netz.lage = { kiAktiv: false, rolle: "viewer" };
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "ueben");
    const kiAus = q(m.container, "tutorial-uebergang-ki-aus") as HTMLElement;
    expect(kiAus.textContent).toContain(t("ask.aiUnavailable.toCapture"));
    expect(kiAus.querySelector('a[href="/erfassen"]')).toBeNull();
    expect(kiAus.querySelector('a[href="/bibliothek"]')).not.toBeNull();
  });

  // Integration mit D5: hat der Administrator die KI abgeschaltet, sagt die Seite das mit eigenem
  // Satz — und der gemeinsame Baustein im Tutorial-Übergang sagt dasselbe, nicht „nicht verfügbar“.
  it("D5 · KI vom Administrator abgeschaltet: Seite und Übergang nennen die Abschaltung, die Wege bleiben", async () => {
    netz.lage = { kiAktiv: false, kiAbgeschaltet: true, rolle: "experte" };
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    const seite = q(m.container, "page-fragen") as HTMLElement;
    await bis(() => q(seite, "ask-ki-abgeschaltet-hinweis") !== null);
    expect(q(seite, "ask-ki-abgeschaltet-hinweis")?.textContent).toBe(t("d5kiaus.hinweis"));
    expect(
      q(seite, "ask-ki-abgeschaltet-hinweis")?.getAttribute("data-tutorial-ziel"),
      "derselbe Baustein wie im Tutorial",
    ).toBe(FRAGEN_ZIEL.kiAus);
    expect(seite.textContent).not.toContain(t("ai.unavailable.hint"));
    expect(q(seite, "ask-ai-alternative")).not.toBeNull();

    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "ueben");
    const kiAus = q(m.container, "tutorial-uebergang-ki-aus") as HTMLElement;
    expect(kiAus.textContent).toContain(t("d5kiaus.hinweis"));
    expect(kiAus.textContent).not.toContain(t("ai.unavailable.hint"));
    expect(kiAus.querySelector('a[href="/bibliothek"]')).not.toBeNull();
    expect(mutationen()).toEqual([]);
  });

  it("Verweise INNERHALB der Demo führen nirgends hin — die Demo erklärt, wohin sie auf der echten Seite führen", async () => {
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "sonderfaelle");
    await zuTeil(m.container, 2);
    const link = demo(m.container).querySelector<HTMLAnchorElement>('a[href="/bibliothek"]');
    expect(link, "der echte Baustein zeigt den Weg auch in der Demo").not.toBeNull();
    await klick(link);
    expect(q(m.container, "page-fragen"), "die Seite wurde verlassen").not.toBeNull();
    expect(q(m.container, "tutorial-bereich")?.textContent).toContain(
      t("tutorial.demo.verweis", { ziel: "/bibliothek" }),
    );
  });
});

// ================================================================================================
describe("E3 · Weiter/Zurück, Kapitelwahl, Fortschritt, Vorführen, Pause, Wiederholen, Vorlesen", () => {
  it("Weiter, Zurück, Kapitelwahl und Fortschritt", async () => {
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    const fortschritt = (): string =>
      q(m?.container as ParentNode, "tutorial-fortschritt")?.textContent ?? "";
    expect(fortschritt()).toBe(
      t("tutorial.fortschritt", { nr: 1, gesamt: 7, titel: t("tutorial.fragen.verstehen.kurz") }),
    );
    expect(q<HTMLButtonElement>(m.container, "tutorial-zurueck")?.disabled).toBe(true);
    await klick(q(m.container, "tutorial-weiter"));
    expect(schrittDerErklaerung(m.container)).toBe("formulieren");
    expect(q<HTMLProgressElement>(m.container, "tutorial-fortschrittsbalken")?.value).toBe(2);
    await klick(q(m.container, "tutorial-zurueck"));
    expect(schrittDerErklaerung(m.container)).toBe("verstehen");
    await zuKapitel(m.container, "quelle");
    expect(schrittDerErklaerung(m.container)).toBe("quelle");
    expect(fortschritt()).toContain("5");
    const aktiv = alle(m.container, "tutorial-kapitel").filter(
      (k) => k.getAttribute("aria-current") === "step",
    );
    expect(aktiv.map((k) => k.getAttribute("data-schritt"))).toEqual(["quelle"]);
    await zuKapitel(m.container, "ueben");
    expect(q(m.container, "tutorial-weiter")).toBeNull();
    const knopf = q<HTMLButtonElement>(m.container, "tutorial-knopf");
    await klick(q(m.container, "tutorial-beenden"));
    expect(q(m.container, "tutorial-bereich")).toBeNull();
    expect(document.activeElement).toBe(knopf);
  });

  it("die Tippvorführung läuft, hält bei Pause an und beginnt bei „Schritt wiederholen“ neu", async () => {
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "formulieren");
    const frage = t("tutorial.fragen.demo.frage");
    const wert = (): string =>
      (demo(m?.container as ParentNode).querySelector("input") as HTMLInputElement).value;
    const abspielen = q(m.container, "tutorial-abspielen") as HTMLButtonElement;
    expect(abspielen.getAttribute("aria-pressed")).toBe("true");
    await warte(700);
    const laufend = wert().length;
    expect(laufend).toBeGreaterThan(0);
    expect(laufend).toBeLessThan(frage.length);
    expect(frage.startsWith(wert())).toBe(true);
    await klick(abspielen);
    expect(abspielen.getAttribute("aria-pressed")).toBe("false");
    const angehalten = wert().length;
    await warte(600);
    expect(wert().length, "Pause hält die Vorführung an").toBe(angehalten);
    await klick(q(m.container, "tutorial-wiederholen"));
    expect(wert().length, "Wiederholen beginnt von vorn").toBeLessThan(angehalten);
    await warte(400);
    expect(wert().length).toBeGreaterThan(0);
  });

  it("mit reduzierter Bewegung steht die Frage sofort vollständig da — und das wird gesagt", async () => {
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "formulieren");
    expect((demo(m.container).querySelector("input") as HTMLInputElement).value).toBe(
      t("tutorial.fragen.demo.frage"),
    );
    expect(q(m.container, "tutorial-reduziert")?.textContent).toBe(t("tutorial.reduziert"));
  });

  it("jeder Teil ist einzeln anwählbar; wer wählt, übernimmt das Tempo", async () => {
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "antwort");
    await zuTeil(m.container, 2);
    const teile = alle(m.container, "tutorial-teil");
    expect(teile.map((x) => x.getAttribute("aria-current"))).toEqual([null, null, "step"]);
    expect(q(m.container, "tutorial-abspielen")?.getAttribute("aria-pressed")).toBe("false");
    expect(q(m.container, "tutorial-gerade")?.textContent).toContain(
      t("tutorial.fragen.antwort.teil.kennzeichnung"),
    );
  });

  it("die Vorführung läuft nicht in den nächsten Schritt weiter — sie hält am Schrittende an", async () => {
    const kurz: TutorialDefinition = {
      ...FRAGEN,
      schritte: FRAGEN.schritte.map((s) => ({
        ...s,
        teile: s.teile.map((x) => ({ ...x, dauerMs: 100 })),
      })),
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(TutorialBereich, { definition: kurz, id: "b", onSchliessen: () => {} }),
      );
    });
    // Die Uhr läuft in Echtzeit; das Laden des Demo-Moduls darf sie verzögern, nicht ändern.
    await bis(
      () => q(container, "tutorial-abspielen")?.getAttribute("aria-pressed") === "false",
      200,
    );
    await warte(400);
    expect(schrittDerErklaerung(container)).toBe("verstehen");
    const teile = alle(container, "tutorial-teil");
    expect(teile[teile.length - 1]?.getAttribute("aria-current")).toBe("step");
    expect(q(container, "tutorial-abspielen")?.getAttribute("aria-pressed")).toBe("false");
    act(() => root.unmount());
  });

  it("Vorlesen: nie ungefragt, auf Klick an, auf Klick aus, beim Schrittwechsel aus", async () => {
    mitSprachausgabe();
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await klick(q(m.container, "tutorial-weiter"));
    expect(sprache.speak, "kein ungefragter Ton").not.toHaveBeenCalled();
    const vorlesen = q(m.container, "tutorial-vorlesen") as HTMLButtonElement;
    expect(vorlesen.getAttribute("aria-pressed")).toBe("false");
    await klick(vorlesen);
    expect(sprache.speak).toHaveBeenCalledTimes(1);
    const gesagt = (sprache.speak.mock.calls[0]?.[0] as Aeusserung).text;
    expect(gesagt).toContain("Frage formulieren");
    expect((sprache.speak.mock.calls[0]?.[0] as Aeusserung).lang).toBe("de-DE");
    expect(vorlesen.getAttribute("aria-pressed")).toBe("true");
    sprache.cancel.mockClear();
    await klick(vorlesen);
    expect(sprache.cancel).toHaveBeenCalled();
    expect(vorlesen.getAttribute("aria-pressed")).toBe("false");
    await klick(vorlesen);
    sprache.cancel.mockClear();
    await klick(q(m.container, "tutorial-weiter"));
    expect(sprache.cancel, "Schrittwechsel stoppt das Vorlesen").toHaveBeenCalled();
    expect(q(m.container, "tutorial-vorlesen")?.getAttribute("aria-pressed")).toBe("false");
    sprache.cancel.mockClear();
    await klick(q(m.container, "tutorial-schliessen"));
    expect(sprache.cancel, "Schliessen stoppt das Vorlesen").toHaveBeenCalled();
  });

  it("ohne Sprachausgabe: kein Vorlese-Knopf, ein ehrlicher Satz — das Tutorial bleibt voll nutzbar", async () => {
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    expect(q(m.container, "tutorial-vorlesen")).toBeNull();
    expect(q(m.container, "tutorial-bereich")?.textContent).toContain(
      t("tutorial.vorlesen.nichtMoeglich"),
    );
    await klick(q(m.container, "tutorial-weiter"));
    expect(schrittDerErklaerung(m.container)).toBe("formulieren");
  });
});

// ================================================================================================
describe("E2 · die Unterrichtsfolge ist vollständig als Text da — in DE, EN und NL", () => {
  for (const lang of ["de", "en", "nl"]) {
    it(`${lang}: Titel, Lernziel, Erklärung, Vertiefung und jeder Teil der Vorführung sind ausgeschrieben`, async () => {
      await i18n.changeLanguage(lang);
      const tt = (k: string): string => i18n.t(k);
      const werte = FRAGEN.textWerte(tt);
      const texte = [FRAGEN.titelKey, FRAGEN.lernzielKey];
      for (const s of FRAGEN.schritte) {
        texte.push(
          s.titelKey,
          s.kurzKey,
          s.textKey,
          s.vertiefungKey,
          ...s.teile.map((x) => x.textKey),
        );
      }
      for (const k of texte) {
        const wert = i18n.t(k, werte);
        expect(wert, `${lang}: ${k} fehlt`).not.toBe(k);
        expect(wert.trim().length, `${lang}: ${k} leer`).toBeGreaterThan(0);
        expect(wert, `${lang}: ${k} hat einen offenen Platzhalter`).not.toMatch(/\{\{/);
      }
      for (const w of Object.values(werte)) {
        expect(w.trim().length).toBeGreaterThan(0);
      }
      // Die Erklärungen sind ausführlich, nicht Stichworte.
      for (const s of FRAGEN.schritte) {
        expect(i18n.t(s.textKey, werte).length, `${lang}: ${s.id} zu knapp`).toBeGreaterThan(250);
      }
    });
  }

  it("das Beispiel ist die Homeoffice-Frage und überall als fiktiv/Demo gekennzeichnet", async () => {
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    expect(q(m.container, "tutorial-erklaerung")?.textContent).toContain(
      "Wie viele Homeoffice-Tage sind erlaubt?",
    );
    for (const schritt of SCHRITTE) {
      await zuKapitel(m.container, schritt);
      const bereich = q(m.container, "tutorial-bereich") as HTMLElement;
      expect(bereich.textContent).toContain(t("tutorial.demo.kennzeichen"));
      expect(bereich.textContent).toContain(t("tutorial.demo.hinweis"));
      expect(demo(m.container).getAttribute("aria-label")).toBe(t("tutorial.demo.label"));
    }
    await zuKapitel(m.container, "quelle");
    await zuTeil(m.container, 4);
    expect(demo(m.container).textContent).toContain(t("tutorial.fragen.demo.beispielantwort"));
    // Der Teil „Original“ liegt im Blatt „Mehr“ — auch das Blatt ist als Demo gekennzeichnet.
    const d = demoBlatt() as HTMLElement;
    expect(d, "Teil „Original“ öffnet das Blatt „Mehr“").not.toBeNull();
    expect(d.textContent).toContain(t("tutorial.demo.kennzeichen"));
    expect(d.textContent).toContain(t("tutorial.fragen.demo.mehrHinweis"));
    expect(d.textContent).toContain("(fiktiv)");
    // Keine Tür, die es nicht gibt: die Demo-Quelle hat kein Original, und der echte Baustein sagt
    // das mit seinem eigenen Satz.
    expect(d.querySelector('[data-testid="answer-source-original"]')).toBeNull();
    expect(d.querySelector('[data-testid="answer-source-no-original"]')?.textContent).toBe(
      t("answerSource.noOriginal"),
    );
    // Die Demo-Quelle verlinkt nirgends in den echten Bestand.
    expect(d.querySelector('a[href^="/wissen/"]')).toBeNull();
    expect(demo(m.container).querySelector('a[href^="/wissen/"]')).toBeNull();
  });
});

// ================================================================================================
// FE-003 · RUNDE 2 (Bens Befunde 1 und 2) — DER TATSÄCHLICHE QUELLENWEG, BEDIENBAR UND KONSISTENT.
// ================================================================================================
//
// Befund 1: die Demo hatte „Chip → Quellenliste“ erfunden; auf der Seite öffnet der Chip das
// Wissensobjekt und die Liste steht unter „…“ → „Mehr …“. Befund 2: im Kapitel „Antwort“ tat der
// Chip nichts, im Kapitel „Quelle“ liess er sich nicht wieder schliessen. Beide Bedienfälle stehen
// hier als Regressionstests — und die Übereinstimmung mit der echten Seite gleich daneben.
describe("E2/E4 · Runde 2: der Quellenweg der Seite, in der Demo bedienbar", () => {
  for (const kapitel of ["antwort", "quelle", "ueben"]) {
    it(`${kapitel}: der Chip wirkt und lässt sich wieder schliessen`, async () => {
      medienStub({ reduziert: true });
      m = await montiere("/fragen");
      await oeffneTutorial(m.container);
      await zuKapitel(m.container, kapitel);
      if (kapitel === "ueben") {
        await zuTeil(m.container, 2);
      }
      const chip = q<HTMLButtonElement>(
        demo(m.container),
        "tutorial-demo-chip",
      ) as HTMLButtonElement;
      expect(chip, "Chip muss da sein").not.toBeNull();
      expect(chip.getAttribute("aria-expanded")).toBe("false");
      await klick(chip);
      expect(chip.getAttribute("aria-expanded"), "Chip geklickt: er muss wirken").toBe("true");
      expect(q(demo(m.container), "tutorial-demo-chip-hinweis")?.textContent).toBe(
        t("tutorial.fragen.demo.chip", { mehr: t("ask.menu.mehr") }),
      );
      await klick(chip);
      expect(chip.getAttribute("aria-expanded"), "zweiter Klick schliesst wieder").toBe("false");
      expect(q(demo(m.container), "tutorial-demo-chip-hinweis")).toBeNull();
      // Der Chip ist KEIN Link in den Bestand: die Demo-Quelle hat kein Wissensobjekt.
      expect(chip.tagName).toBe("BUTTON");
      expect(mutationen()).toEqual([]);
    });

    it(`${kapitel}: „…“ → „Mehr …“ öffnet das Blatt mit der Quellenliste, Schliessen schliesst es`, async () => {
      medienStub({ reduziert: true });
      m = await montiere("/fragen");
      await oeffneTutorial(m.container);
      await zuKapitel(m.container, kapitel);
      if (kapitel === "ueben") {
        await zuTeil(m.container, 2);
      }
      expect(demoBlatt()).toBeNull();
      await mehrUeberMenue(m.container);
      const blatt = demoBlatt() as HTMLElement;
      expect(blatt, "„Mehr …“ gewählt: das Blatt muss offen sein").not.toBeNull();
      expect(blatt.getAttribute("aria-label")).toBe(t("ask.menu.label"));
      expect(
        blatt.querySelector(`[data-tutorial-ziel="${FRAGEN_ZIEL.quellenliste}"]`),
      ).not.toBeNull();
      expect(blatt.querySelector('[data-testid="ask-source-carrying"]')).not.toBeNull();
      expect(blatt.querySelector('[data-testid="ask-source-pruefstand"]')).not.toBeNull();
      expect(blatt.querySelector('[data-testid="answer-source-originals"]')).not.toBeNull();
      // Kein Titel-Link und kein „Danke“ an der erfundenen Quelle.
      expect(blatt.querySelector("a")).toBeNull();
      expect(blatt.textContent).not.toContain(t("ask.helpful"));
      if (kapitel === "quelle") {
        const aktiv = alle(m.container, "tutorial-teil").findIndex(
          (x) => x.getAttribute("aria-current") === "step",
        );
        expect(aktiv, "die Erklärung folgt dem Nutzer ins Blatt").toBe(2);
        expect(m.container.querySelector("[data-tutorial-ziel-fehlt]")).toBeNull();
        expect(blatt.querySelector('[data-tutorial-aktiv="true"]')).not.toBeNull();
      }
      await blattSchliessen(blatt);
      expect(demoBlatt(), "Schliessen schliesst das Blatt").toBeNull();
      if (kapitel === "quelle") {
        const aktiv = alle(m.container, "tutorial-teil").findIndex(
          (x) => x.getAttribute("aria-current") === "step",
        );
        expect(aktiv, "zurück beim Menü").toBe(1);
        expect(q(m.container, "tutorial-abspielen")?.getAttribute("aria-pressed")).toBe("false");
      }
      // Erneut öffnen geht — der Weg ist wiederholbar.
      await mehrUeberMenue(m.container);
      expect(demoBlatt()).not.toBeNull();
      await blattSchliessen(demoBlatt());
      expect(demoBlatt()).toBeNull();
      expect(mutationen()).toEqual([]);
    });
  }

  // RUNDE 3 (Bens Befund): „Vorführen“ im Kapitel „Quelle“ läuft nach „…“ in das MODALE Blatt
  // „Mehr“. Dessen Modalgrenze (die der echten Seite, unverändert) setzt den Tutorial-Bereich auf
  // `inert` — ohne Begleitung im Blatt wären Pause und Erklärung unerreichbar, während die
  // Vorführung weiterläuft. Gemessen wird der ECHTE Lauf, in Echtzeit, ohne Abkürzung.
  it("laufende Vorführung im Blatt „Mehr“: Pause und Erklärung bleiben bedienbar", async () => {
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "quelle");
    const rahmenPause = q<HTMLButtonElement>(
      m.container,
      "tutorial-abspielen",
    ) as HTMLButtonElement;
    expect(rahmenPause.getAttribute("aria-pressed"), "das Kapitel spielt nicht von selbst").toBe(
      "false",
    );
    await klick(rahmenPause);
    expect(rahmenPause.getAttribute("aria-pressed")).toBe("true");
    // Zwei Teile à 4,5 s, dann öffnet die Vorführung das Blatt.
    await bis(() => demoBlatt() !== null, 480);
    const blatt = demoBlatt() as HTMLElement;
    expect(blatt, "die Vorführung hat das Blatt geöffnet").not.toBeNull();

    // Die Lage, die Ben gemessen hat: der Rahmen ist jetzt gesperrt …
    expect(rahmenPause.closest("[inert]"), "die Modalgrenze der Seite gilt weiter").not.toBeNull();
    // … und die Begleitung im Blatt ist es nicht.
    const begleitung = q(blatt, "tutorial-begleitung") as HTMLElement;
    expect(begleitung, "Begleitung im Blatt").not.toBeNull();
    const blattPause = q<HTMLButtonElement>(blatt, "tutorial-abspielen-blatt") as HTMLButtonElement;
    expect(blattPause.closest("[inert]"), "Pause im Blatt ist bedienbar").toBeNull();
    expect(blattPause.getAttribute("aria-pressed"), "die Vorführung läuft").toBe("true");
    expect(q(blatt, "tutorial-gerade-blatt")?.textContent).toContain(
      t("tutorial.fragen.quelle.teil.liste", { mehr: t("ask.menu.mehr") }),
    );
    // Die Erklärung des Schritts steht im Blatt vollständig als Text.
    expect(q(blatt, "tutorial-begleitung-erklaerung")?.textContent).toContain(
      "Um eine Aussage zu prüfen",
    );

    // Pause im Blatt hält DIESELBE Vorführung an — auch die des Rahmens.
    await klick(blattPause);
    expect(blattPause.getAttribute("aria-pressed")).toBe("false");
    expect(rahmenPause.getAttribute("aria-pressed")).toBe("false");
    const vorher = alle(blatt, "tutorial-teil-blatt").findIndex(
      (x) => x.getAttribute("aria-current") === "step",
    );
    await warte(5000);
    const nachher = alle(blatt, "tutorial-teil-blatt").findIndex(
      (x) => x.getAttribute("aria-current") === "step",
    );
    expect(nachher, "angehalten heisst angehalten").toBe(vorher);
    // Teile sind im Blatt einzeln anwählbar, und die Hervorhebung folgt.
    await klick(alle(blatt, "tutorial-teil-blatt")[4]);
    expect(alle(blatt, "tutorial-teil-blatt")[4]?.getAttribute("aria-current")).toBe("step");
    expect(
      blatt.querySelector(
        `[data-tutorial-ziel="${FRAGEN_ZIEL.original}"][data-tutorial-aktiv="true"]`,
      ),
    ).not.toBeNull();
    // Weiterspielen geht ebenfalls von hier aus.
    await klick(blattPause);
    expect(rahmenPause.getAttribute("aria-pressed")).toBe("true");
    await klick(blattPause);
    // Das Blatt schliesst wie auf der echten Seite; danach ist der Rahmen wieder frei.
    await blattSchliessen(blatt);
    expect(demoBlatt()).toBeNull();
    expect(rahmenPause.closest("[inert]")).toBeNull();
    expect(mutationen()).toEqual([]);
  }, 60_000);

  // LAUF 2 (Bens Befund d0496390): wurde das Blatt über „…“ → „Mehr“ geöffnet, hielt die Rückwahl
  // „Chip“ oder „…“ in der Begleitung das Blatt offen — das gewählte Ziel blieb hinter der
  // Modalgrenze gesperrt. Beide Öffnungswege × beide Rückwahlen.
  for (const weg of ["menue", "teilliste"] as const) {
    for (const [rueckwahl, ziel] of [
      [0, FRAGEN_ZIEL.quellenchip],
      [1, FRAGEN_ZIEL.menue],
    ] as const) {
      it(`Blatt geöffnet über ${weg}, Rückwahl auf Teil ${rueckwahl + 1}: Blatt zu, Ziel bedienbar`, async () => {
        medienStub({ reduziert: true });
        m = await montiere("/fragen");
        await oeffneTutorial(m.container);
        await zuKapitel(m.container, "quelle");
        if (weg === "menue") {
          await mehrUeberMenue(m.container);
        } else {
          await zuTeil(m.container, 2);
        }
        const blatt = demoBlatt() as HTMLElement;
        expect(blatt, "das Blatt ist offen").not.toBeNull();
        await klick(alle(blatt, "tutorial-teil-blatt")[rueckwahl]);
        expect(demoBlatt(), "die Rückwahl schliesst das Blatt").toBeNull();
        const aktiv = alle(m.container, "tutorial-teil").findIndex(
          (x) => x.getAttribute("aria-current") === "step",
        );
        expect(aktiv, "der gewählte Teil bleibt gewählt").toBe(rueckwahl);
        const zielEl = demo(m.container).querySelector(
          `[data-tutorial-ziel="${ziel}"][data-tutorial-aktiv="true"]`,
        );
        expect(zielEl, "das gewählte Ziel ist hervorgehoben").not.toBeNull();
        expect(zielEl?.closest("[inert]"), "das gewählte Ziel ist nicht gesperrt").toBeNull();
        expect(q(m.container, "tutorial-abspielen")?.closest("[inert]")).toBeNull();
        expect(mutationen()).toEqual([]);
      });
    }
  }

  // LAUF 3: derselbe Befund in den Kapiteln, deren Antwortkarte das Blatt ebenfalls öffnet. Dort
  // liegt KEIN Ziel im Blatt: das Öffnen hält die Vorführung an, und JEDE Teilwahl in der
  // Begleitung — auch die des gerade gewählten Teils — schliesst das Blatt.
  for (const [kapitel, vorTeil, ziele] of [
    ["antwort", 0, [FRAGEN_ZIEL.antworttext, FRAGEN_ZIEL.quellenchip, FRAGEN_ZIEL.kiHinweis]],
    ["sonderfaelle", 1, [FRAGEN_ZIEL.luecke, FRAGEN_ZIEL.quellenchip, FRAGEN_ZIEL.kiAus]],
    ["ueben", 2, [FRAGEN_ZIEL.fragefeld, FRAGEN_ZIEL.absenden, FRAGEN_ZIEL.quellenchip]],
  ] as const) {
    ziele.forEach((ziel, wahl) => {
      it(`${kapitel}: Blatt über „…“ geöffnet, Teilwahl ${wahl + 1} in der Begleitung: Blatt zu, Ziel bedienbar`, async () => {
        medienStub({ reduziert: true });
        m = await montiere("/fragen");
        await oeffneTutorial(m.container);
        await zuKapitel(m.container, kapitel);
        if (vorTeil > 0) {
          await zuTeil(m.container, vorTeil);
        }
        const rahmenPause = q(m.container, "tutorial-abspielen") as HTMLElement;
        if (kapitel === "antwort") {
          expect(rahmenPause.getAttribute("aria-pressed"), "das Kapitel spielt").toBe("true");
        }
        await mehrUeberMenue(m.container);
        const blatt = demoBlatt() as HTMLElement;
        expect(blatt, "das Blatt ist offen").not.toBeNull();
        expect(
          rahmenPause.getAttribute("aria-pressed"),
          "wer das Blatt selbst öffnet, hält die Vorführung an",
        ).toBe("false");
        await klick(alle(blatt, "tutorial-teil-blatt")[wahl]);
        expect(demoBlatt(), "die Teilwahl schliesst das Blatt").toBeNull();
        const aktiv = alle(m.container, "tutorial-teil").findIndex(
          (x) => x.getAttribute("aria-current") === "step",
        );
        expect(aktiv, "der gewählte Teil bleibt gewählt").toBe(wahl);
        const zielEl = demo(m.container).querySelector(
          `[data-tutorial-ziel="${ziel}"][data-tutorial-aktiv="true"]`,
        );
        expect(zielEl, "das gewählte Ziel ist hervorgehoben").not.toBeNull();
        expect(zielEl?.closest("[inert]"), "das gewählte Ziel ist nicht gesperrt").toBeNull();
        expect(rahmenPause.closest("[inert]")).toBeNull();
        expect(mutationen()).toEqual([]);
      });
    });
  }

  it("Escape im Blatt schliesst das Blatt, nicht das Tutorial", async () => {
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "antwort");
    await mehrUeberMenue(m.container);
    const blatt = demoBlatt() as HTMLElement;
    await taste(blatt.querySelector("button") as Element, "Escape");
    expect(demoBlatt()).toBeNull();
    expect(q(m.container, "tutorial-bereich")).not.toBeNull();
  });

  it("„Drucken“ und „Als Markdown“ im Demo-Menü drucken und speichern nichts — und sagen das", async () => {
    medienStub({ reduziert: true });
    const drucken = vi.fn();
    vi.stubGlobal("print", drucken);
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "antwort");
    for (const punkt of ["print", "download"]) {
      await klick(demo(m.container).querySelector('[data-testid="tutorial-demo-menue"]'));
      await klick(document.querySelector(`[data-testid="tutorial-demo-menue-punkt-${punkt}"]`));
      expect(q(demo(m.container), "tutorial-demo-menue-hinweis")?.textContent).toBe(
        t("tutorial.fragen.demo.menueNichts"),
      );
    }
    expect(drucken).not.toHaveBeenCalled();
  });

  it("dieselben Bedienelemente wie auf der echten Seite: Menü „…“ mit denselben Punkten, dasselbe Blatt, dieselbe Liste", async () => {
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    await echteFrageStellen(m.container, "Wie werden Reisen genehmigt?");
    // Die echte Seite: Menü an der Antwortkarte trägt das Ziel, „Mehr …“ öffnet das Blatt.
    const echtesMenue = Array.from(
      m.container.querySelectorAll(`[data-tutorial-ziel="${FRAGEN_ZIEL.menue}"]`),
    ).filter((el) => !el.closest("[data-tutorial-demo]"));
    expect(echtesMenue.length).toBe(1);
    await klick(echtesMenue[0]?.querySelector('[data-testid="ask-menu"]'));
    const echtePunkte = Array.from(
      document.querySelectorAll('[data-testid^="ask-menu-punkt-"]'),
    ).map((b) => b.textContent);
    await klick(document.querySelector('[data-testid="ask-menu-punkt-mehr"]'));
    const echtesBlatt = document.querySelector('[data-testid="ask-mehr"]') as HTMLElement;
    expect(echtesBlatt).not.toBeNull();
    const echteListe = echtesBlatt.querySelector(
      `[data-tutorial-ziel="${FRAGEN_ZIEL.quellenliste}"]`,
    );
    expect(echteListe, "die echte Seite rendert dieselbe QuellenListe").not.toBeNull();
    // Der echte Chip führt zum Wissensobjekt.
    const echterChip = Array.from(
      m.container.querySelectorAll(`[data-tutorial-ziel="${FRAGEN_ZIEL.quellenchip}"]`),
    ).find((el) => !el.closest("[data-tutorial-demo]"));
    expect(echterChip?.getAttribute("href")).toBe(`/wissen/${ECHTE_QUELLE.id}`);
    await blattSchliessen(echtesBlatt);

    await oeffneTutorial(m.container);
    await zuKapitel(m.container, "quelle");
    await klick(demo(m.container).querySelector('[data-testid="tutorial-demo-menue"]'));
    const demoPunkte = Array.from(
      document.querySelectorAll('[data-testid^="tutorial-demo-menue-punkt-"]'),
    ).map((b) => b.textContent);
    expect(demoPunkte, "dieselben Menüpunkte in derselben Reihenfolge").toEqual(echtePunkte);
    await klick(document.querySelector('[data-testid="tutorial-demo-menue-punkt-mehr"]'));
    const blatt = demoBlatt() as HTMLElement;
    expect(blatt.getAttribute("aria-label")).toBe(echtesBlatt.getAttribute("aria-label"));
    // Dieselbe Liste: dieselben Kennzeichen-Anker in derselben Reihenfolge je Zeile.
    const anker = (w: Element): string[] =>
      Array.from(w.querySelectorAll("li [data-testid]"))
        .map((el) => el.getAttribute("data-testid") ?? "")
        .filter((x) => x.startsWith("ask-source-") || x.startsWith("answer-source-originals"));
    const listeDemo = blatt.querySelector(
      `[data-tutorial-ziel="${FRAGEN_ZIEL.quellenliste}"]`,
    ) as Element;
    expect(anker(listeDemo)).toEqual(anker(echteListe as Element));
    expect(mutationen().filter((a) => a.pfad !== "/api/ask")).toEqual([]);
  });
});

// ================================================================================================
describe("E4 · Ziele über Namen, nicht über Koordinaten — und fehlende Ziele fallen auf", () => {
  it("jedes Ziel jedes Teils jedes Schritts steht in der Demo und wird hervorgehoben", async () => {
    medienStub({ reduziert: true });
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    for (const s of FRAGEN.schritte) {
      await zuKapitel(m.container, s.id);
      for (let i = 0; i < s.teile.length; i++) {
        await zuTeil(m.container, i);
        await ruhe(5);
        const ziel = s.teile[i]?.ziel ?? null;
        expect(
          m.container.querySelector("[data-tutorial-ziel-fehlt]"),
          `${s.id}/${i}: Ziel fehlt`,
        ).toBeNull();
        // Die Demo hat zwei Wurzeln: die Miniatur und — ab „Liste“ im Kapitel „Quelle“ — das Blatt
        // „Mehr“ am Rand der Anwendung. Gesucht wird in beiden, nie auf der echten Seite.
        const aktiv = Array.from(
          document.querySelectorAll('[data-tutorial-demo] [data-tutorial-aktiv="true"]'),
        );
        if (ziel) {
          expect(aktiv.length, `${s.id}/${i}: ${ziel} nicht hervorgehoben`).toBeGreaterThan(0);
          for (const el of aktiv) {
            expect(el.getAttribute("data-tutorial-ziel")).toBe(ziel);
          }
        } else {
          expect(aktiv).toEqual([]);
        }
      }
    }
  });

  it("die Ziele der Lektion sind die Namen der gemeinsamen Bausteine — und stehen auf der echten Seite", async () => {
    const bekannt = new Set<string>(Object.values(FRAGEN_ZIEL));
    for (const s of FRAGEN.schritte) {
      for (const x of s.teile) {
        if (x.ziel) {
          expect(bekannt.has(x.ziel), `${s.id}: unbekanntes Ziel ${x.ziel}`).toBe(true);
        }
      }
    }
    m = await montiere("/fragen");
    const echt = (ziel: string): Element[] =>
      Array.from(m?.container.querySelectorAll(`[data-tutorial-ziel="${ziel}"]`) ?? []).filter(
        (el) => !el.closest("[data-tutorial-demo]"),
      );
    expect(echt(FRAGEN_ZIEL.fragefeld).length).toBe(1);
    expect(echt(FRAGEN_ZIEL.beispiele).length).toBe(1);
    expect(echt(FRAGEN_ZIEL.absenden).length).toBe(1);
    await echteFrageStellen(m.container, "Wie werden Reisen genehmigt?");
    expect(echt(FRAGEN_ZIEL.quellenchip).length).toBe(1);
    expect(echt(FRAGEN_ZIEL.quellenchip)[0]?.getAttribute("href")).toBe(
      `/wissen/${ECHTE_QUELLE.id}`,
    );
    m.abbauen();
    netz.lage.kiAktiv = false;
    m = await montiere("/fragen");
    expect(echt(FRAGEN_ZIEL.kiAus).length).toBe(1);
  });

  it("ein fehlendes Ziel fällt sichtbar auf — kein stummer Zeiger ins Leere", async () => {
    const kaputt: TutorialDefinition = {
      ...FRAGEN,
      schritte: [
        {
          id: "probe",
          titelKey: "tutorial.fragen.verstehen.titel",
          kurzKey: "tutorial.fragen.verstehen.kurz",
          textKey: "tutorial.fragen.verstehen.text",
          vertiefungKey: "tutorial.fragen.verstehen.vertiefung",
          teile: [
            {
              id: "x",
              textKey: "tutorial.fragen.verstehen.teil.feld",
              ziel: "gibt.es.nicht",
              dauerMs: 1000,
            },
          ],
        },
      ],
      laden: async () => ({
        Demo: () => createElement("p", { "data-tutorial-ziel": "etwas.anderes" }, "Demo"),
        Uebergang: () => createElement("p", null, "Ende"),
      }),
    };
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(TutorialBereich, { definition: kaputt, id: "b", onSchliessen: () => {} }),
      );
    });
    await ruhe();
    const meldung = container.querySelector("[data-tutorial-ziel-fehlt]");
    expect(meldung?.getAttribute("data-tutorial-ziel-fehlt")).toBe("gibt.es.nicht");
    expect(meldung?.textContent).toContain("gibt.es.nicht");
    act(() => root.unmount());
  });
});

// ================================================================================================
describe("E6 · Tastatur und Fokus, und die Seite bleibt danach bedienbar", () => {
  it("Öffnen fokussiert die Überschrift; Escape und „Tutorial schließen“ geben den Fokus an den Knopf zurück", async () => {
    m = await montiere("/fragen");
    const knopf = q<HTMLButtonElement>(m.container, "tutorial-knopf") as HTMLButtonElement;
    await oeffneTutorial(m.container);
    expect(document.activeElement?.tagName).toBe("H2");
    expect(document.activeElement?.textContent).toBe(t("tutorial.fragen.titel"));
    await taste(document.activeElement as Element, "Escape");
    expect(q(m.container, "tutorial-bereich")).toBeNull();
    expect(document.activeElement).toBe(knopf);
    await oeffneTutorial(m.container);
    await klick(q(m.container, "tutorial-schliessen"));
    expect(document.activeElement).toBe(knopf);
    // Die echte Seite ist danach normal bedienbar: fragen, Antwort bekommen.
    await echteFrageStellen(m.container, "Wie werden Reisen genehmigt?");
    expect(netz.anfragen.filter((a) => a.pfad === "/api/ask").length).toBe(1);
  });

  it("jede Steuerung des Rahmens ist ein Knopf mit sichtbarem Namen und sichtbarem Fokusrahmen", async () => {
    mitSprachausgabe();
    m = await montiere("/fragen");
    await oeffneTutorial(m.container);
    const bereich = q(m.container, "tutorial-bereich") as HTMLElement;
    const steuerung = Array.from(bereich.querySelectorAll("button")).filter(
      (b) => !b.closest("[data-tutorial-demo]") && !b.closest("details"),
    );
    expect(steuerung.length).toBeGreaterThan(10);
    for (const b of steuerung) {
      expect(b.textContent?.trim().length, b.outerHTML).toBeGreaterThan(0);
      expect(b.className, `${b.textContent}: kein sichtbarer Fokus`).toContain(
        "focus-visible:outline",
      );
    }
    const knopf = q(m.container, "tutorial-knopf") as HTMLElement;
    expect(knopf.className).toContain("focus-visible:outline");
  });
});
