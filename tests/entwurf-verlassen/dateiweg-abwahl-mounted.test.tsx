// @vitest-environment jsdom
// ================================================================================================
// JOB 3770 — WAS DER MENSCH WEGGEKLICKT HAT, WIRD BEIM VERLASSEN NICHT GESPEICHERT.
// ================================================================================================
//
// DER BEFUND (von der Bahn des JOB 3621 am Code gelesen, dort ausdrücklich nicht repariert,
// `archiv/3621/runde-1/RUECKGABE.md:60`). Im Erfassen-Weg „Aus Datei" hakt der Mensch ab, was er
// behalten will, und klickt die anderen Funde weg. Der sichtbare Knopf der Liste achtet diese
// Auswahl (`Capture.tsx`, `doSaveDrafts`: `filter((p) => p.selected)`). Der Speicherzweig der
// NAVIGATIONSWACHE tat es nicht: er übergab `filePoints` VOLLSTÄNDIG an `createPointDrafts`. Wer
// „Entwurf speichern und wechseln" wählte, fand danach in „Meine Entwürfe" auch die Funde, die er
// gerade abgewählt hatte.
//
// WAS HIER GEMESSEN WIRD — am gemounteten Baum, über die echten Bedienelemente (Kästchen je Fund,
// „Alle abwählen"), gezählt an den `drafts.create`-VERSUCHEN, die der Server bekäme:
//
//   A1   Drei Funde, einer abgewählt, ein Druck: genau ZWEI Entwürfe — die angehakten.
//   A1b  Der Vergleichsfall: nichts abgewählt ⇒ weiterhin je Punkt ein Entwurf (Voreinstellung).
//   A2   ALLE abgewählt: KEIN Punktentwurf — aber ein Träger, der den DATEISTAND WIRKLICH HÄLT
//        (Text, Quellenvermerk, Originalreferenz) und nach dem Fortsetzen wieder auf der Fläche
//        steht. Nichts geht still verloren (der Rückfallzweig muss dieselbe Frage stellen).
//   A2b  Eine ANDERE Datei, ebenfalls ganz abgewählt: der Träger hält IHRE Quelle, nicht die aus A2
//        — ein fester Rückfalltext oder eine Attrappenkonstante fällt hier auf.
//   A2c  Getippter Eintrag UND alles abgewählt: ZWEI Träger, jeder mit seinem eigenen Inhalt —
//        der Eintrag im Eintragsentwurf, die Datei im Dateiträger. Keiner trägt den anderen.
//   A3   Teilfehler bei zwei angehakten Funden: der gelungene verlässt die Liste, der gescheiterte
//        UND der abgewählte bleiben; der zweite Druck legt genau EINEN weiteren Entwurf an.
//
// WARUM A2 IN RUNDE 4 GEWACHSEN IST (bens Befund Runde 3, Korrekturpflichten 1+2). Bis Runde 3 hat
// dieser Fall nur GEZÄHLT: eine Anlage, kein Punktentwurf. Grün war er damit auch an einem Träger,
// dessen Nutzlast `{"title":"Entwurf","statement":"", …}` war — der geladene Dateistand stand
// nirgends darin. „Nichts geht still verloren" war damit im Zähler erfüllt und für den Menschen
// nicht: er hätte nach dem Wechsel einen leeren Entwurf und seine Datei nirgends. Ein Träger zählt
// ab hier nur, wenn der Inhalt oder eine verwendbare Originalreferenz in ihm steht.
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
  anlageNutzlasten,
  anlageversucheJeTitel,
  bestandJeTitel,
  draftsCreate,
  extrakt,
  kennungJeTitel,
  lasseCreateScheiternFuer,
  server,
} from "./attrappen";
import {
  abbauen,
  adresse,
  dateiAblegen,
  feld,
  fundKaestchen,
  fundzeilen,
  grundzustand,
  klick,
  knopf,
  mount,
  sichtbar,
  speichernKnopfDa,
  tippe,
  wacheDialoge,
  wechselLink,
} from "./huelle";

const DATEI = "bericht.txt";

/** Der Rückfalltitel, den `saveDraft` setzt, wenn nie ein Titel getippt wurde. */
const EINTRAGS_TITEL = i18n.t("capture.draftFallbackTitle");

/** Die drei Funde der Auswertung. P2 ist der, dessen Anlage in A3 scheitert. */
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

/** Der Text, der in der Datei steht — in A2 ist GENAU ER der Stand, der nicht verloren gehen darf. */
const DATEITEXT = [P1.sourceExcerpt, P2.sourceExcerpt, P3.sourceExcerpt].join("\n");

/**
 * Datei einlesen und auswerten lassen — danach stehen die drei Funde auf der Fläche.
 * Name und Text sind Parameter, weil A2b mit einer ANDEREN Quelle messen muss: ein Träger, der in
 * A2 und A2b dasselbe enthielte, trüge nicht die Datei, sondern eine Konstante.
 */
async function dateiMitPunkten(datei = DATEI, text = DATEITEXT): Promise<void> {
  await mount("/erfassen", "datei", true);
  await dateiAblegen(new File([text], datei, { type: "text/plain" }));
  await klick(knopf(i18n.t("capture.file.searchCta")));
  // Alle drei stehen angehakt in der Liste — die Voreinstellung, von der aus abgewählt wird.
  expect(fundzeilen()).toEqual([
    { titel: P1.title, angehakt: true },
    { titel: P2.title, angehakt: true },
    { titel: P3.title, angehakt: true },
  ]);
}

/** Hinauswollen — über das Produktbauteil `GuardedLink`, wie jeder Menü- und Kachelklick. */
async function hinauswollen(): Promise<void> {
  await klick(wechselLink() as HTMLAnchorElement);
  expect(wacheDialoge()).toBe(1);
}

/** Ein Druck auf „Entwurf speichern und wechseln". */
async function speichernUndWechseln(): Promise<void> {
  await klick(knopf(i18n.t("nav.guard.save")));
}

/**
 * JOB 3770 RUNDE 4: DER DATEITRÄGER unter den Anlagen dieses Versuchs — die eine Nutzlast, die
 * weder ein Punktentwurf noch der Eintragsentwurf ist. Gefunden wird er über die Titel, die NICHT
 * er sein kann, nicht über einen erwarteten eigenen Titel: so misst der Fall den Träger und nicht
 * die Namensregel, nach der er heisst. Gibt es ihn nicht, scheitert der Fall genau hier — und das
 * ist der Rotnachweis aus Runde 3, wo es ihn nicht gab.
 */
function dateiTraeger(): Record<string, unknown> {
  const fremd = new Set([P1.title, P2.title, P3.title, EINTRAGS_TITEL]);
  const treffer = anlageNutzlasten().filter((p) => !fremd.has(String(p.title)));
  if (treffer.length !== 1) {
    throw new Error(
      `genau EIN Dateiträger erwartet, gefunden: ${treffer.length} — Anlagen: ${anlageNutzlasten()
        .map((p) => String(p.title))
        .join(" · ")}`,
    );
  }
  return treffer[0] as Record<string, unknown>;
}

/** Der sichtbare Zähler der Liste — er sagt dem Menschen, was seine Auswahl gerade ist. */
function auswahlZaehler(angehakt: number, gesamt: number): string {
  return i18n.t("capture.file.pointCount", { selected: angehakt, total: gesamt });
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

describe("JOB 3770 · abgewählte Funde bleiben beim Verlassen abgewählt", () => {
  // ==============================================================================================
  // A1 · DER ROTNACHWEIS: DER ABGEWÄHLTE FUND WIRD NICHT ANGELEGT.
  // ==============================================================================================
  //
  // Am unveränderten Produkt entstehen hier DREI Entwürfe, darunter der abgewählte Titel.
  it("A1 · ein Fund abgewählt: es entstehen genau die zwei angehakten Entwürfe", async () => {
    await dateiMitPunkten();

    // Wegklicken wie von Hand — über das Kästchen des dritten Funds.
    await klick(fundKaestchen(P3.title));
    expect(fundzeilen()).toEqual([
      { titel: P1.title, angehakt: true },
      { titel: P2.title, angehakt: true },
      { titel: P3.title, angehakt: false },
    ]);
    // Und die Fläche sagt es ihm auch: zwei von drei.
    expect(sichtbar()).toContain(auswahlZaehler(2, 3));

    await hinauswollen();
    // Der Weg hinaus bietet das Sichern an — sonst misst der Rest nichts.
    expect(speichernKnopfDa()).toBe(true);
    await speichernUndWechseln();

    // GENAU zwei Anlageversuche, und zwar die angehakten: der abgewählte wurde nicht einmal
    // VERSUCHT (ein Versuch, der am Server scheitert, wäre derselbe Schaden mit Glück).
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 1 });
    // Das, was der Mensch danach in „Meine Entwürfe" findet: seine zwei, nicht drei.
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBeUndefined();
    // Und kein Eintragsentwurf daneben (JOB 3621 bleibt gültig).
    expect(bestandJeTitel()[EINTRAGS_TITEL]).toBeUndefined();

    // Gewechselt wird, und die Meldung zählt die zwei Entwürfe dieses Versuchs.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(i18n.t("capture.file.draftsSaved", { count: 2, name: DATEI }));
    expect(sichtbar()).not.toContain(i18n.t("capture.file.draftsSaved", { count: 3, name: DATEI }));
  });

  // ==============================================================================================
  // A1b · DER VERGLEICHSFALL — AN DER VOREINSTELLUNG ÄNDERT SICH NICHTS.
  // ==============================================================================================
  //
  // „Die Auswahl gilt" darf nicht heissen „es wird weniger gespeichert". Alle Funde sind
  // vorausgewählt (`captureFromFile.ts`, `selectablePoints`); wer nichts wegklickt, bekommt
  // weiterhin je Fund einen Entwurf. Ohne diesen Fall wäre A1 auch mit einem Filter grün, der
  // versehentlich zu viel wegnimmt.
  it("A1b · nichts abgewählt: es entstehen weiterhin drei Entwürfe", async () => {
    await dateiMitPunkten();
    await hinauswollen();
    await speichernUndWechseln();

    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 1, [P3.title]: 1 });
    expect(bestandJeTitel()[EINTRAGS_TITEL]).toBeUndefined();
    expect(adresse()).toBe("/start");
    expect(sichtbar()).toContain(i18n.t("capture.file.draftsSaved", { count: 3, name: DATEI }));
  });

  // ==============================================================================================
  // A2 · ALLES ABGEWÄHLT — KEIN PUNKTENTWURF, ABER AUCH KEIN STILLER VERLUST.
  // ==============================================================================================
  //
  // DIE ERSTE HALBHEIT, die dieser Fall ausschliesst: nur den Aufruf des Dateiwegs zu filtern und
  // die Bedingung des Rückfallzweigs davor stehen zu lassen. Dann legt der Dateiweg nichts mehr an
  // (richtig), UND der Rückfall springt nicht ein (falsch) — weil er weiter glaubt, der Dateiweg
  // trage die Datei. Der Mensch wechselt die Seite und hat nichts.
  //
  // DIE ZWEITE HALBHEIT, und sie ist die von Runde 3 (bens Korrekturpflicht 1): irgendetwas
  // anzulegen und das „Träger" zu nennen. Der Eintragsentwurf, den `saveDraft` dort anlegte, trug
  // den Rückfalltitel und eine leere Aussage — vom Dateistand stand nichts in ihm. Gemessen wird
  // deshalb nicht die ZAHL der Anlagen, sondern ihr INHALT: der Dateitext, der Quellenvermerk mit
  // dem Dateinamen, die Referenz auf das abgelegte Original — und dass das Fortsetzen genau das
  // wieder auf die Fläche bringt.
  it("A2 · alle Funde abgewählt: kein Punktentwurf, aber ein Träger, der den Dateistand hält", async () => {
    await dateiMitPunkten();

    // „Alle abwählen" — das echte Bedienelement der Liste.
    await klick(knopf(i18n.t("capture.file.deselectAll")));
    expect(fundzeilen()).toEqual([
      { titel: P1.title, angehakt: false },
      { titel: P2.title, angehakt: false },
      { titel: P3.title, angehakt: false },
    ]);
    expect(sichtbar()).toContain(auswahlZaehler(0, 3));

    await hinauswollen();
    // Es wird überhaupt angeboten, zu sichern — sonst bliebe dem Menschen nur „Verwerfen".
    expect(speichernKnopfDa()).toBe(true);
    await speichernUndWechseln();

    // KEIN Punktentwurf, unter keinem der drei Titel — und genau EINE Anlage insgesamt.
    expect(draftsCreate).toHaveBeenCalledTimes(1);
    expect(bestandJeTitel()[P1.title]).toBeUndefined();
    expect(bestandJeTitel()[P2.title]).toBeUndefined();
    expect(bestandJeTitel()[P3.title]).toBeUndefined();
    // Auch nicht der leere Eintragsentwurf des Rückfalls: es wurde nie ein Titel getippt, und ein
    // Entwurf ohne Inhalt ist keine Sicherung (JOB 3621 bleibt gültig, bens Runde 3 dazu).
    expect(anlageversucheJeTitel()[EINTRAGS_TITEL]).toBeUndefined();

    // DER TRÄGER HÄLT DEN STAND — gemessen an der Nutzlast, die wirklich hinausging.
    const traeger = dateiTraeger();
    // 1. Der Dateitext selbst, vom ersten bis zum letzten Absatz.
    expect(String(traeger.statement)).toContain(P1.sourceExcerpt);
    expect(String(traeger.statement)).toContain(P3.sourceExcerpt);
    // 2. Der Rumpf nennt die Quelle mit Namen — ohne sie wäre der Text Inhalt ohne Herkunft.
    expect(String(traeger.bodyHtml)).toContain(DATEI);
    // 3. Das ORIGINAL liegt im Objektspeicher, und der Rumpf zeigt mit dessen Kennung darauf.
    const objekte = Object.keys(server.objekte);
    expect(objekte).toHaveLength(1);
    expect(String(traeger.bodyHtml)).toContain(String(objekte[0]));
    // Und er steht wirklich im Bestand, nicht bloss versucht.
    expect(bestandJeTitel()[String(traeger.title)]).toBe(1);

    // Der Mensch erfährt auch, WAS gesichert wurde — kein stummes Wegschreiben.
    expect(sichtbar()).toContain(i18n.t("capture.file.wholeSaved", { name: DATEI }));
    // Und der Wechsel geschieht erst danach.
    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toBe("/start");

    // ============================================================================================
    // DIE PROBE AUFS GANZE: FORTSETZEN. Ein Träger, aus dem der Stand nicht zurückkommt, ist keiner
    // (bens Korrekturpflicht 1: „bleibt nach Speichern und Fortsetzen erhalten").
    // ============================================================================================
    const kennung = kennungJeTitel(String(traeger.title));
    expect(kennung).not.toBeNull();
    abbauen();
    await mount(`/erfassen?draft=${kennung}`, "formular");
    expect(feld(i18n.t("capture.fStatement")).value).toContain(P1.sourceExcerpt);
    expect(feld(i18n.t("capture.fStatement")).value).toContain(P3.sourceExcerpt);
    expect(feld(i18n.t("capture.fTitle")).value).toBe(String(traeger.title));
  });

  // ==============================================================================================
  // A2b · DERSELBE WEG MIT EINER ANDEREN DATEI — DER TRÄGER HÄLT IHRE QUELLE, NICHT EINE KONSTANTE.
  // ==============================================================================================
  //
  // bens Prüflücke aus Runde 3, wörtlich: „zwei verschiedene Dateien vollständig abwählen und
  // prüfen, dass ihre gespeicherten Träger die jeweilige Quelle unterscheidbar erhalten". Ohne
  // diesen Fall wäre A2 auch mit einem festen Rückfalltext grün, der zufällig einmal passt.
  it("A2b · andere Datei, alles abgewählt: der Träger hält IHREN Text und IHREN Namen", async () => {
    const ZWEITE = "wartungsplan.txt";
    const ZWEITER_TEXT = "Die Spritzzone wird jeden Freitag gereinigt und das Ergebnis vermerkt.";
    await dateiMitPunkten(ZWEITE, ZWEITER_TEXT);

    await klick(knopf(i18n.t("capture.file.deselectAll")));
    await hinauswollen();
    await speichernUndWechseln();

    const traeger = dateiTraeger();
    expect(String(traeger.statement)).toContain(ZWEITER_TEXT);
    expect(String(traeger.bodyHtml)).toContain(ZWEITE);
    // Und nichts aus der Datei des Nachbarfalls: Titel und Text kommen aus DIESER Quelle.
    expect(String(traeger.statement)).not.toContain(P1.sourceExcerpt);
    expect(String(traeger.bodyHtml)).not.toContain(DATEI);
    expect(String(traeger.title)).toBe("wartungsplan");
    expect(sichtbar()).toContain(i18n.t("capture.file.wholeSaved", { name: ZWEITE }));
    expect(adresse()).toBe("/start");
  });

  // ==============================================================================================
  // A2c · GETIPPTER EINTRAG UND ALLES ABGEWÄHLT — ZWEI TRÄGER, JEDER MIT SEINEM EIGENEN INHALT.
  // ==============================================================================================
  //
  // Die Trennung, die JOB 3621 in `Capture.tsx` gezogen hat, gilt weiter: der EINTRAG ist eine
  // andere Sache als die DATEI, und die Wache muss auch einen Stand sichern, in dem nur ein
  // Nebenfeld getippt wurde (E3a der Nachbardatei). Beide Träger entstehen hier — und keiner
  // behauptet den Inhalt des anderen. Die Halbheit, die dieser Fall ausschliesst: den Dateiträger
  // nur dann anzulegen, wenn sonst nichts zu sichern ist.
  it("A2c · getippte Domäne UND alles abgewählt: Eintragsentwurf und Dateiträger, getrennt", async () => {
    await dateiMitPunkten();
    await klick(knopf(i18n.t("capture.advanced.title")));
    await tippe(feld(i18n.t("capture.fCategory")), "Instandhaltung");
    await klick(knopf(i18n.t("capture.file.deselectAll")));

    await hinauswollen();
    await speichernUndWechseln();

    // Genau zwei Anlagen: der Eintrag und die Datei. Kein Punktentwurf.
    expect(draftsCreate).toHaveBeenCalledTimes(2);
    expect(anlageversucheJeTitel()[P1.title]).toBeUndefined();
    expect(anlageversucheJeTitel()[P3.title]).toBeUndefined();

    // Der Eintragsentwurf trägt, was getippt wurde — und NICHT den Dateitext.
    const eintrag = anlageNutzlasten(EINTRAGS_TITEL)[0];
    expect(eintrag?.category).toBe("Instandhaltung");
    expect(String(eintrag?.statement ?? "")).not.toContain(P1.sourceExcerpt);
    // Der Dateiträger trägt die Datei — und nicht die getippte Domäne.
    const traeger = dateiTraeger();
    expect(String(traeger.statement)).toContain(P1.sourceExcerpt);
    expect(traeger.category).not.toBe("Instandhaltung");
    expect(adresse()).toBe("/start");
  });

  // ==============================================================================================
  // A3 · DER TEILFEHLER RÄUMT DEN ABGEWÄHLTEN FUND NICHT MIT WEG.
  // ==============================================================================================
  //
  // Der Aufräumschritt des Teilfehlerpfads nimmt die GELUNGENEN Punkte aus der Liste (JOB 3600).
  // Der abgewählte gehört nicht dazu: er wurde nicht gespeichert und steht weiter zur Wahl. Ginge
  // er hier mit, verlöre der Mensch beim zweiten Druck einen Fund, den er nur weggehakt — nicht
  // verworfen — hatte.
  it("A3 · Teilfehler: der gelungene geht, der gescheiterte und der abgewählte bleiben", async () => {
    lasseCreateScheiternFuer(P2.title);
    await dateiMitPunkten();
    await klick(fundKaestchen(P3.title));
    await hinauswollen();

    await speichernUndWechseln();

    // Versucht wurden die zwei angehakten; der abgewählte kommt nicht vor.
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 1 });
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBeUndefined();

    // Der Dialog bleibt stehen, gewechselt ist nicht.
    expect(wacheDialoge()).toBe(1);
    expect(adresse()).toBe("/erfassen");

    // Die Liste danach: der gelungene ist weg, der gescheiterte steht angehakt, der abgewählte
    // steht abgewählt da — unverändert, wie ihn der Mensch hinterlassen hat.
    expect(fundzeilen()).toEqual([
      { titel: P2.title, angehakt: true },
      { titel: P3.title, angehakt: false },
    ]);
    expect(sichtbar()).toContain(auswahlZaehler(1, 2));

    // Der zweite Druck — diesmal nimmt der Server den Punkt an.
    lasseCreateScheiternFuer();
    expect(knopf(i18n.t("nav.guard.save")).disabled).toBe(false);
    await speichernUndWechseln();

    // GENAU EINE weitere Anlage: der zuvor gescheiterte Punkt. Nicht der abgewählte, und der
    // längst gesicherte auch nicht noch einmal.
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 2 });
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    expect(bestandJeTitel()[P3.title]).toBeUndefined();
    // Die Erfolgsmeldung zählt, was in DIESEM Versuch entstanden ist: einer.
    expect(sichtbar()).toContain(i18n.t("capture.file.draftsSaved", { count: 1, name: DATEI }));
    expect(adresse()).toBe("/start");
  });
});
