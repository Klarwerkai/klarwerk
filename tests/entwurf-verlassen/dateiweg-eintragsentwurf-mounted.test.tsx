// @vitest-environment jsdom
// ================================================================================================
// JOB 3621 — EIN DATEIWEG-SPEICHERN LEGT KEINEN LEEREN ENTWURF DANEBEN.
// ================================================================================================
//
// DER BEFUND (aus JOB 3600 gemessen, dort benannt und bewusst nicht repariert). Der Wächter-Rückruf
// speichert VOR den Datei-Punkten den EINTRAG (`saveDraft`), und seine Bedingung zählte die
// geladene Datei mit: `hasUnsavedEntry` enthielt `Boolean(fileName)` und `fileText`. Dieselbe
// Datei trägt aber der DATEIWEG darunter — der Dateizustand wurde also ZWEIMAL gezählt. Wer aus
// einer Datei drei Punkte bestätigt hatte und „Entwurf speichern und wechseln" drückte, fand
// danach in „Meine Entwürfe" die drei Punkte UND einen vierten, leeren Entwurf mit dem
// Rückfalltitel „Entwurf", den er nie angelegt hat. Nach einem Teilfehler und einem zweiten Druck
// standen dort zwei davon.
//
// WAS HIER GEMESSEN WIRD — am gemounteten Baum, über die echten Bedienelemente, gezählt an den
// `drafts.create`-Aufrufen, die der Server bekäme:
//   E1  Drei Punkte, nichts getippt, ein Druck: drei Punktentwürfe, KEIN Eintragsentwurf.
//   E2  Teilfehler und zwei Drücke: über beide Versuche zusammen KEIN Eintragsentwurf.
//   E3  Punkte UND getippter Inhalt / gewählte Vertraulichkeit: der Eintragsentwurf entsteht
//       weiterhin genau EINMAL und trägt, was getippt wurde.
//   E4  Datei geladen, noch keine Punkte: die Wache fragt weiterhin — nichts geht still verloren.
//
// WERKZEUGE: Baum, Bedienhelfer, Messfenster und Attrappen werden IMPORTIERT, nicht abgeschrieben
// (`huelle.tsx`, `attrappen.ts` — Lehre JOB 3572 R1, Prüfpunkt 7).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () => (await import("./attrappen")).authAttrappe());

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./attrappen")).endpointsAttrappe(),
);

import i18n from "../../apps/web/src/i18n";
import {
  anlageversucheJeTitel,
  bestandJeTitel,
  draftsCreate,
  extrakt,
  lasseCreateScheiternFuer,
} from "./attrappen";
import {
  abbauen,
  adresse,
  dateiAblegen,
  feld,
  flaeche,
  grundzustand,
  klick,
  knopf,
  mount,
  sichtbar,
  tippe,
  wacheDialoge,
  waehle,
  wechselLink,
} from "./huelle";

const DATEI = "bericht.txt";

/** Der Rückfalltitel, den `saveDraft` setzt, wenn nie ein Titel getippt wurde. */
const EINTRAGS_TITEL = i18n.t("capture.draftFallbackTitle");

/** Die drei bestätigten Punkte. Punkt 2 ist der, dessen Anlage in E2 scheitert. */
const P1 = {
  title: "Dosierwert prüfen",
  summary: "Nach Schichtwechsel den Dosierwert kontrollieren.",
  sourceExcerpt: "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.",
};
const P2 = {
  title: "Filter wechseln",
  summary: "Der Filter wird monatlich gewechselt.",
  sourceExcerpt: "Ein Wechsel des Filters erfolgt monatlich.",
};
const P3 = {
  title: "Schichtbuch führen",
  summary: "Jede Schicht trägt ihre Störungen ein.",
  sourceExcerpt: "Störungen gehören in das Schichtbuch der jeweiligen Schicht.",
};

/** Die Nutzlasten, mit denen eine Anlage unter diesem Titel versucht wurde. */
function anlagen(titel: string): Record<string, unknown>[] {
  return draftsCreate.mock.calls
    .map(([p]) => p as Record<string, unknown>)
    .filter((p) => p?.title === titel);
}

/** Die Datei in die Fläche geben — ohne Auswertung. Danach steht nur der Dateizustand. */
async function dateiEinlesen(): Promise<void> {
  await mount("/erfassen", "datei", true);
  await dateiAblegen(
    new File([[P1.sourceExcerpt, P2.sourceExcerpt, P3.sourceExcerpt].join("\n")], DATEI, {
      type: "text/plain",
    }),
  );
}

/** Datei einlesen, auswerten lassen — danach stehen die drei Punkte bestätigt auf der Fläche. */
async function dateiMitPunkten(): Promise<void> {
  await dateiEinlesen();
  await klick(knopf(i18n.t("capture.file.searchCta")));
  expect(sichtbar()).toContain(P1.title);
  expect(sichtbar()).toContain(P2.title);
  expect(sichtbar()).toContain(P3.title);
}

/** Hinauswollen — über das Produktbauteil `GuardedLink`, wie jeder Menü- und Kachelklick. */
async function hinauswollen(): Promise<void> {
  await klick(wechselLink() as HTMLAnchorElement);
}

/** Ein Druck auf „Entwurf speichern und wechseln". */
async function speichernUndWechseln(): Promise<void> {
  await klick(knopf(i18n.t("nav.guard.save")));
}

/** Die erweiterten Felder aufklappen — dort liegen Domäne, Vertraulichkeit und Schlagworte. */
async function erweiterteFelderOeffnen(): Promise<void> {
  await klick(knopf(i18n.t("capture.advanced.title")));
}

/** Steht der Knopf „Entwurf speichern und wechseln" im offenen Dialog? */
function speichernKnopfDa(): boolean {
  return [...document.querySelectorAll("[data-navguard-dialog] button")].some((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("nav.guard.save")),
  );
}

beforeEach(async () => {
  await grundzustand();
  extrakt.punkte = [P1, P2, P3];
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 3621 · der Dateiweg legt keinen leeren Eintragsentwurf daneben", () => {
  // ==============================================================================================
  // E1 · DER ERSTE DRUCK — UND SCHON ER DARF KEINEN LEEREN EINTRAG ANLEGEN.
  // ==============================================================================================
  //
  // Die naheliegende Halbheit wäre, nur den ZWEITEN Druck zu heilen (etwa durch Räumen von
  // `fileName`/`fileText` nach `saveDraft`). Dieser Fall schliesst sie aus: schon der erste Druck
  // legt nichts an, was der Mensch nicht bestätigt hat.
  it("E1 · drei Punkte, nichts getippt: drei Punktentwürfe und KEIN Eintragsentwurf", async () => {
    await dateiMitPunkten();
    await hinauswollen();
    expect(wacheDialoge()).toBe(1);

    await speichernUndWechseln();

    // Genau die drei bestätigten Punkte wurden angelegt — kein vierter Aufruf, unter keinem Titel.
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 1, [P3.title]: 1 });
    expect(anlageversucheJeTitel()[EINTRAGS_TITEL]).toBeUndefined();
    // Und das, was der Mensch in „Meine Entwürfe" findet, ist genau das.
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBe(1);
    expect(bestandJeTitel()[EINTRAGS_TITEL]).toBeUndefined();

    // Gewechselt wird, und die Meldung zählt die drei Entwürfe dieses Versuchs.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(i18n.t("capture.file.draftsSaved", { count: 3, name: DATEI }));
  });

  // ==============================================================================================
  // E2 · TEILFEHLER UND ZWEI DRÜCKE — ÜBER BEIDE VERSUCHE ZUSAMMEN KEINE EINTRAGSANLAGE.
  // ==============================================================================================
  it("E2 · Punkt 2 scheitert, zweimal gedrückt: kein Eintragsentwurf, kein Punkt doppelt", async () => {
    lasseCreateScheiternFuer(P2.title);
    await dateiMitPunkten();
    await hinauswollen();

    await speichernUndWechseln();
    expect(wacheDialoge()).toBe(1);
    expect(knopf(i18n.t("nav.guard.save")).disabled).toBe(false);
    await speichernUndWechseln();

    // Punkt 1 und 3 je genau einmal versucht, Punkt 2 zweimal — und sonst nichts.
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 2, [P3.title]: 1 });
    expect(anlageversucheJeTitel()[EINTRAGS_TITEL]).toBeUndefined();
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBe(1);
    expect(bestandJeTitel()[EINTRAGS_TITEL]).toBeUndefined();

    // Der Dialog steht noch, die Adresse ist unverändert.
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe("/erfassen");
  });

  // ==============================================================================================
  // E3 · DIE TRENNUNG AUS `Capture.tsx:2975`–`:2990` BLEIBT ERHALTEN.
  // ==============================================================================================
  //
  // Die Wache hat bewusst ein WEITERES Dirty-Prädikat als der sichtbare Knopf: sie muss auch einen
  // Stand sichern, in dem nur getippte Nebenfelder oder die Vertraulichkeit geändert wurden. Wird
  // der Eintrags-Zweig pauschal abgeschaltet, werden diese beiden Fälle rot.
  it("E3a · Punkte UND getippte Domäne: der Eintragsentwurf entsteht genau einmal und trägt sie", async () => {
    await dateiMitPunkten();
    await erweiterteFelderOeffnen();
    await tippe(feld(i18n.t("capture.fCategory")), "Instandhaltung");
    await hinauswollen();

    await speichernUndWechseln();

    expect(anlageversucheJeTitel()[EINTRAGS_TITEL]).toBe(1);
    expect(bestandJeTitel()[EINTRAGS_TITEL]).toBe(1);
    // Er trägt, was getippt wurde — sonst wäre er selbst der leere Entwurf, den dieser Job abstellt.
    expect(anlagen(EINTRAGS_TITEL)[0]?.category).toBe("Instandhaltung");
    // Die Punkte gehen unverändert mit.
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBe(1);
    expect(adresse()).toBe("/start");
  });

  it("E3b · Punkte UND gewählte Vertraulichkeit: der Eintragsentwurf entsteht genau einmal", async () => {
    await dateiMitPunkten();
    await erweiterteFelderOeffnen();
    const wahl = flaeche().querySelector<HTMLSelectElement>(
      "[data-testid=capture-vertraulichkeit]",
    );
    if (!wahl) {
      throw new Error("Vertraulichkeitswahl nicht gefunden");
    }
    await waehle(wahl, "vertraulich");
    await hinauswollen();

    await speichernUndWechseln();

    expect(anlageversucheJeTitel()[EINTRAGS_TITEL]).toBe(1);
    expect(anlagen(EINTRAGS_TITEL)[0]?.confidentiality).toBe("vertraulich");
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBe(1);
    expect(adresse()).toBe("/start");
  });

  // ==============================================================================================
  // E4 · DIE BLOSS GELADENE DATEI BLEIBT EIN GRUND ZU FRAGEN.
  // ==============================================================================================
  //
  // Die zweite Halbheit wäre, `Boolean(fileName)` ersatzlos aus `hasUnsavedEntry` zu streichen.
  // Dann wäre `isCaptureDirty` bei einer bloss geladenen, noch nicht ausgewerteten Datei falsch,
  // die Wache fragte nicht mehr, und Pedis Befund vom 05.07. („Aus Datei: hochgeladene Datei
  // bereits VOR der KI-Auswertung") käme zurück. Dieser Fall misst genau das: es wird gefragt,
  // nichts wird still gewechselt, und der Dialog benennt die Datei als noch nicht sicherbar.
  it("E4 · Datei geladen, keine Punkte: die Wache fragt, nichts wechselt still", async () => {
    await dateiEinlesen();
    await hinauswollen();

    // Es wird GEFRAGT — der Wechsel ist nicht einfach passiert.
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe("/erfassen");
    // Nichts ist geschrieben worden.
    expect(draftsCreate).not.toHaveBeenCalled();
    // Und der Dialog sagt, woran es liegt: die Datei ist noch nicht ausgewertet und deshalb noch
    // nicht sicherbar — er bietet dafür ehrlich kein „Entwurf speichern und wechseln" an.
    expect(sichtbar()).toContain(i18n.t("capture.unsavable.file", { name: DATEI }));
    expect(speichernKnopfDa()).toBe(false);

    // Wer ausdrücklich verwirft, kommt weiter — und auch dann entsteht kein Entwurf.
    await klick(knopf(i18n.t("nav.guard.discard")));
    expect(adresse()).toBe("/start");
    expect(draftsCreate).not.toHaveBeenCalled();
  });
});
