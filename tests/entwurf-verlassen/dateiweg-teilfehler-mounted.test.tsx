// @vitest-environment jsdom
// ================================================================================================
// JOB 3600 — EIN TEILFEHLER BEIM VERLASSEN KOSTET KEINEN ENTWURF DOPPELT.
// ================================================================================================
//
// DER BEFUND. Ein Mensch hat aus einer Datei mehrere Punkte bestätigt und will die Fläche
// verlassen. Er wählt „Entwurf speichern und wechseln". Zwei Punkte werden gespeichert, einer
// scheitert. Der Dialog bleibt offen und nennt den Grund — das ist seit JOB 3572 D3 so GEBAUT
// (`Capture.tsx`, Wächter-Rückruf, `throw new NavGuardSaveError(grund)`), aber es war in keinem
// einzigen Fall GEFAHREN: die Bahn von JOB 3572 hat das selbst gemeldet
// (`archiv/3572/runde-2/RUECKGABE.md:58`), und `git log -S"draftsPartial" -- tests/entwurf-verlassen`
// liefert bis heute keinen Commit. Gemessen waren nur die beiden ANDEREN Wurfstellen (D4, D5 der
// Nachbardatei).
//
// UND HINTER DER MESSLÜCKE LAG EIN SCHADEN. Der Dialog bleibt offen, der Knopf wird wieder
// freigegeben (`NavGuardContext.tsx`, `saving` im `finally`) — der zweite Druck ist der
// naheliegendste Handgriff der Welt. Er lief bis zu diesem Auftrag erneut über ALLE Punkte, denn
// `createPointDrafts` meldete nur eine ZAHL zurück („created"), nie WELCHE. Die beim ersten Lauf
// gelungenen Entwürfe entstanden ein zweites Mal, und in „Meine Entwürfe" standen danach
// Doppelungen, die der Mensch nie angelegt hat.
//
// WAS HIER GEMESSEN WIRD:
//   T1  Der Grund erreicht den Dialog.        (schliesst die Messlücke — KEIN Rotnachweis)
//   T2  Kein Entwurf entsteht zweimal.        (der Rotnachweis)
//   T3  Der zweite Grund nennt den zweiten Stand.
//   T4  Gelingt der zweite Versuch, zählt die Erfolgsmeldung DIESEN Versuch.
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
  draftsRemove,
  draftsUpdate,
  extrakt,
  lasseCreateScheiternFuer,
} from "./attrappen";
import {
  abbauen,
  adresse,
  dateiAblegen,
  erreichbareStellen,
  gesperrteBereiche,
  grundzustand,
  imWacheDialog,
  klick,
  knopf,
  mount,
  sichtbar,
  stellen,
  wacheDialoge,
  wechselLink,
} from "./huelle";

const DATEI = "bericht.txt";

/** Die drei bestätigten Punkte. Punkt 2 ist der, dessen Anlage scheitert. */
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

/**
 * DIESELBE Prüfung wie in der Nachbardatei (D4/D5): der Grund steht nicht bloss irgendwo im DOM,
 * sondern IM Dialog und für Tastatur und Screenreader erreichbar. Bei offenem Dialog sperrt die
 * Modalgrenze den Fehlerkasten der Seite per `inert` — ein `body.textContent`-Treffer allein wäre
 * hier also eine Scheinmessung.
 */
function grundIstImDialog(satz: string): void {
  expect(gesperrteBereiche(), "die Modalgrenze sperrt gerade nichts").toBeGreaterThan(0);
  const alle = stellen(satz);
  const offen = erreichbareStellen(satz);
  expect(alle.length, `„${satz}" steht nirgends im Baum`).toBeGreaterThan(0);
  expect(offen.length, `„${satz}" steht nur im gesperrten Teil`).toBeGreaterThan(0);
  expect(
    offen.map((el) => imWacheDialog(el)),
    "erreichbare Fundstellen ausserhalb des Wache-Dialogs",
  ).toEqual(offen.map(() => true));
  // Und er steht an der Stelle, die der Dialog dafür hat — nicht irgendwo in seinem Fliesstext.
  expect(document.querySelectorAll("[data-navguard-save-error]").length).toBe(1);
  expect(
    (document.querySelector("[data-navguard-save-error]")?.textContent ?? "").replace(/\s+/g, " "),
  ).toContain(satz);
}

/** Der Satz, den der Teilfehler für genau diese Titel formuliert. */
function teilfehlerSatz(...titel: readonly string[]): string {
  return i18n.t("capture.file.draftsPartial", { failed: titel.join(", ") });
}

// ================================================================================================
// DER BEFUND VON HIER IST BEHOBEN — JOB 3621.
// ================================================================================================
//
// Bis JOB 3621 stand hier ein gemessener, aber ausdrücklich nicht reparierter Fund: der
// Wächter-Rückruf speicherte VOR den Datei-Punkten den EINTRAG (`saveDraft`), und seine Bedingung
// zählte die geladene Datei mit (`hasUnsavedEntry` enthielt `Boolean(fileName)` und `fileText`).
// Der erste Druck legte deshalb NEBEN den Punktentwürfen einen leeren Entwurf mit dem
// Rückfalltitel an, der zweite nach einem Teilfehler noch einen. Die beiden Zeilen unten haben
// das mit 1 bzw. 2 festgehalten und den, der es behebt, genau hierher geführt.
//
// SEIT JOB 3621 gilt: die geladene Datei löst den Eintrags-Zweig nicht mehr aus, solange der
// DATEIWEG sie in diesem Durchlauf trägt (`Capture.tsx`, `hasUnsavedEntryOhneDatei` und der
// Rückfall an derselben Bedingung). Die Zahlen unten sind deshalb 0 — und sie bleiben die Probe:
// nimmt jemand die zwei Datei-Glieder in die Bedingung zurück, stehen hier wieder 1 und 2.
// Was der Eintrags-Zweig weiterhin tut, wenn wirklich etwas getippt wurde, misst die
// Nachbardatei `dateiweg-eintragsentwurf-mounted.test.tsx` (E3).
const EINTRAGS_TITEL = "Entwurf";

/** Die Anlageversuche der DATEI-PUNKTE — ohne den Eintrags-Entwurf von oben. */
function punkteversuche(): Record<string, number> {
  const alle = anlageversucheJeTitel();
  delete alle[EINTRAGS_TITEL];
  return alle;
}

/**
 * Der Weg bis zur offenen Wache: Datei einlesen, auswerten lassen, hinauswollen.
 * Alles über die echten Bedienelemente — Ablegezone, „Datei analysieren", ein Verweis mit Wache.
 */
async function bisZurWache(): Promise<void> {
  await mount("/erfassen", "datei", true);
  await dateiAblegen(
    new File([[P1.sourceExcerpt, P2.sourceExcerpt, P3.sourceExcerpt].join("\n")], DATEI, {
      type: "text/plain",
    }),
  );
  await klick(knopf(i18n.t("capture.file.searchCta")));
  // Die drei Punkte stehen als bestätigte Funde auf der Fläche — sonst misst alles Weitere nichts.
  expect(sichtbar()).toContain(P1.title);
  expect(sichtbar()).toContain(P2.title);
  expect(sichtbar()).toContain(P3.title);

  await klick(wechselLink() as HTMLAnchorElement);
  expect(wacheDialoge()).toBe(1);
}

/** Ein Druck auf „Entwurf speichern und wechseln". */
async function speichernUndWechseln(): Promise<void> {
  await klick(knopf(i18n.t("nav.guard.save")));
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

describe("JOB 3600 · der Teilfehler des Dateiwegs beim Verlassen", () => {
  // ==============================================================================================
  // T1 · DER GRUND ERREICHT DEN DIALOG — DIE MESSLÜCKE VON JOB 3572 D3.
  // ==============================================================================================
  //
  // EHRLICH GESAGT: dieser Fall ist am Ausgangsstand bereits GRÜN. Er ist kein Rotnachweis,
  // sondern der Beleg, dass ein seit JOB 3572 gebauter, aber nie gefahrener Zweig hält, was sein
  // Kommentar behauptet. Der Rotnachweis ist T2.
  it("T1 · Punkt 2 scheitert: der Dialog bleibt stehen und nennt IHN beim Namen", async () => {
    lasseCreateScheiternFuer(P2.title);
    await bisZurWache();
    await speichernUndWechseln();

    // Alle drei Punkte wurden versucht, zwei sind angelegt.
    expect(punkteversuche()).toEqual({ [P1.title]: 1, [P2.title]: 1, [P3.title]: 1 });
    // Kein Eintragsentwurf daneben (JOB 3621).
    expect(anlageversucheJeTitel()[EINTRAGS_TITEL] ?? 0).toBe(0);
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBeUndefined();
    expect(bestandJeTitel()[P3.title]).toBe(1);

    // Genau EIN Dialog, die Adresse ist unverändert — gewechselt wurde nicht.
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe("/erfassen");
    // Keine Erfolgsmeldung über einen Erfolg, den es so nicht gab.
    expect(sichtbar()).not.toContain(i18n.t("capture.file.draftsSaved", { count: 2, name: DATEI }));
    // Und der Grund nennt den gescheiterten Punkt, im Dialog, erreichbar.
    grundIstImDialog(teilfehlerSatz(P2.title));
  });

  // ==============================================================================================
  // T2 · DER ROTNACHWEIS: KEIN ENTWURF ENTSTEHT ZWEIMAL.
  // ==============================================================================================
  it("T2 · der zweite Druck legt die gelungenen Punkte NICHT noch einmal an", async () => {
    lasseCreateScheiternFuer(P2.title);
    await bisZurWache();
    await speichernUndWechseln();
    expect(wacheDialoge()).toBe(1);

    // Derselbe Knopf, ein zweites Mal — er ist wieder freigegeben, das ist der ganze Punkt.
    expect(knopf(i18n.t("nav.guard.save")).disabled).toBe(false);
    await speichernUndWechseln();

    // Punkt 1 und Punkt 3 sind je GENAU EINMAL angelegt worden — über beide Versuche hinweg.
    // Punkt 2 wurde zweimal VERSUCHT und ist zweimal gescheitert.
    expect(punkteversuche()).toEqual({
      [P1.title]: 1,
      [P2.title]: 2,
      [P3.title]: 1,
    });
    // Und das, was der Mensch danach in „Meine Entwürfe" findet, ist genau das: kein Duplikat.
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBe(1);
    // Auch über beide Drücke zusammen entsteht kein Eintragsentwurf (JOB 3621).
    expect(anlageversucheJeTitel()[EINTRAGS_TITEL] ?? 0).toBe(0);

    // Nichts anderes ist dabei angefasst worden.
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(adresse()).toBe("/erfassen");
  });

  // ==============================================================================================
  // T3 · DER ZWEITE GRUND NENNT DEN ZWEITEN STAND.
  // ==============================================================================================
  //
  // WARUM DER SERVER BEIM ZWEITEN MAL EINEN ZWEITEN PUNKT ABLEHNT: ohne diesen Wechsel wäre der
  // Satz in beiden Versuchen zufällig derselbe (Punkt 1 und 3 gelängen ja wieder), und der Fall
  // wäre auch am kaputten Stand grün — er misst dann nichts. Mit dem Wechsel trennt er sauber:
  // wird Punkt 1 erneut versucht, taucht sein Name im Grund auf, OBWOHL sein Entwurf längst
  // sicher liegt. Genau diese Unwahrheit soll der Mensch nie lesen.
  it("T3 · beim zweiten Teilfehler nennt der Dialog NUR die noch offenen Punkte", async () => {
    lasseCreateScheiternFuer(P2.title);
    await bisZurWache();
    await speichernUndWechseln();
    grundIstImDialog(teilfehlerSatz(P2.title));

    // Der Server lehnt beim zweiten Mal auch Punkt 1 ab — der aber ist längst angelegt.
    lasseCreateScheiternFuer(P2.title, P1.title);
    await speichernUndWechseln();

    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe("/erfassen");
    // Der Grund gehört zu DIESEM Versuch: nur Punkt 2 ist noch offen.
    grundIstImDialog(teilfehlerSatz(P2.title));
    // Die längst angelegten Punkte stehen nicht im Grund — sie sind keine offene Arbeit mehr.
    const satz = (document.querySelector("[data-navguard-save-error]")?.textContent ?? "").replace(
      /\s+/g,
      " ",
    );
    expect(satz).not.toContain(P1.title);
    expect(satz).not.toContain(P3.title);
    // Und sie sind auch nicht erneut angefasst worden.
    expect(punkteversuche()).toEqual({ [P1.title]: 1, [P2.title]: 2, [P3.title]: 1 });
  });

  // ==============================================================================================
  // T4 · GELINGT DER ZWEITE VERSUCH, ZÄHLT DIE MELDUNG DIESEN VERSUCH.
  // ==============================================================================================
  it("T4 · der zweite Versuch gelingt: gewechselt, und die Meldung nennt den EINEN neuen Entwurf", async () => {
    lasseCreateScheiternFuer(P2.title);
    await bisZurWache();
    await speichernUndWechseln();
    expect(wacheDialoge()).toBe(1);

    // Der Grund war vorübergehend — beim zweiten Mal geht es durch.
    lasseCreateScheiternFuer();
    await speichernUndWechseln();

    // Jetzt ist gewechselt, und jeder bestätigte Punkt steht genau einmal im Bestand.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(punkteversuche()).toEqual({
      [P1.title]: 1,
      [P2.title]: 2,
      [P3.title]: 1,
    });
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBe(1);
    // Die Erfolgsmeldung zählt, was in DIESEM Versuch entstanden ist: einer, nicht drei.
    expect(sichtbar()).toContain(i18n.t("capture.file.draftsSaved", { count: 1, name: DATEI }));
    expect(sichtbar()).not.toContain(i18n.t("capture.file.draftsSaved", { count: 3, name: DATEI }));
  });
});
