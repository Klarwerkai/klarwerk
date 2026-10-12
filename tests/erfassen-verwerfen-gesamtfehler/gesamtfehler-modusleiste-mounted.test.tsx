// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME erfassen-verwerfen — VOLLAUSFALL, ECHTE MODUSLEISTE, VERWERFEN AUF DERSELBEN ROUTE.
// ================================================================================================
//
// HERKUNFT (wörtlich, `archiv/4231/runde-2/ben.md:23`, Prüfpunkt 6 im GRÜN-Urteil zu JOB 4231):
// „vollständigen Ausfall aller Punkte mit anschließendem Verwerfen prüfen; den Moduswechsel über die
// echte Leiste und Wiederöffnen samt Originalquelle im Browser messen. A4 prüft bislang den
// Teilfehler, der Moduswechsel verwendet einen Prop-Stellvertreter". Dazu die zugeordneten
// Zielzustände N-0061 (Nutzerprüfung review26-entwurf, 08.09.) und R-0075.
//
// WAS DIESE DATEI MISST — jeder Moduswechsel geht über das Menü „Datei ▾" des Blatts, montiert ist
// die Seite `Capture` (Begründung in `./seite.tsx`):
//
//   G1  ALLE Punkte scheitern beim „Entwurf speichern und wechseln": der Dialog bleibt, nennt den
//       Grund, nichts behauptet „gesichert"; „Hier bleiben" bewahrt die Eingabe — auch über zwei
//       Moduswechsel an der echten Leiste; danach „Verwerfen und wechseln": Quittung „verworfen",
//       der gespeicherte Entwurf unverändert, nichts gelöscht, nichts angelegt.
//   G2  Derselbe Vollausfall, dann bewusst ein zweiter Druck, der gelingt: jeder Punkt genau einmal
//       im Bestand, Quittung „gespeichert".
//   G3  Vollausfall ohne geöffneten Entwurf, verlassen über „Erfassen" der Hauptnavigation (dieselbe
//       Route): nach dem Verwerfen steht die LEERE Erfassung — kein Fund, keine Datei, und über die
//       echte Leiste wieder geöffnet taucht die verworfene Datei nicht wieder auf.
//   N1  N-0061, Verwerfen: `/erfassen?draft=<id>` → „Erfassen" → „Verwerfen und wechseln" ⇒ die
//       verworfenen Änderungen stehen nicht mehr im Editor, der Entwurf ist unverändert.
//   N2  N-0061, Speichern: dasselbe mit „Entwurf speichern und wechseln" ⇒ gesichert, und die
//       Bearbeitung ist beendet (leerer Editor; ein weiteres Tippen legte NEU an, statt den alten
//       Entwurf zu überschreiben).
//   N3  N-0061, ungespeicherte Neuanlage auf derselben Route: Verwerfen wirkt.
//
// ROT AM BASISSTAND (gemessen, nicht vermutet — Lauf vor der Reparatur in dieser Runde): N1 las nach
// dem Verwerfen den Titel „Alter Titel MARKE" und den alten Text im Editor, die Adresse ohne
// `?draft=`. Genau der Befund aus N-0061 („verschwindet nur die draft-Query").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () =>
  (await import("../entwurf-verlassen/attrappen")).authAttrappe(),
);

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../entwurf-verlassen/attrappen")).endpointsAttrappe(),
);

import i18n from "../../apps/web/src/i18n";
import {
  anlageversucheJeTitel,
  attrappenZuruecksetzen,
  bestandJeTitel,
  draftsCreate,
  draftsRemove,
  draftsUpdate,
  extrakt,
  lasseCreateScheiternFuer,
  server,
} from "../entwurf-verlassen/attrappen";
import {
  START_MARKE,
  abbauen,
  ablegezone,
  adresse,
  blattText,
  blattTitel,
  dateiAblegen,
  feld,
  flaeche,
  fundzeilen,
  grundImDialog,
  hauptnavigationErfassen,
  imDialog,
  klick,
  knopf,
  modusUeberLeiste,
  seiteOeffnen,
  sichtbar,
  tippe,
  verlassenKnopf,
  wacheDialoge,
} from "./seite";

const ENTWURF_ID = "e-verwerfen";
const ADRESSE = `/erfassen?draft=${ENTWURF_ID}`;
const DATEI = "bericht.txt";

const P1 = {
  title: "Filter wechseln",
  summary: "Der Filter wird monatlich gewechselt.",
  sourceExcerpt: "Ein Wechsel des Filters erfolgt monatlich.",
};
const P2 = {
  title: "Dosierwert prüfen",
  summary: "Nach Schichtwechsel den Dosierwert kontrollieren.",
  sourceExcerpt: "Der Dosierwert ist nach jedem Schichtwechsel zu prüfen.",
};
const DATEITEXT = [P1.sourceExcerpt, P2.sourceExcerpt].join("\n\n");

const GESPEICHERT = (): string => i18n.t("capture.leaveDraft.doneSaved");
const VERWORFEN = (): string => i18n.t("capture.leaveDraft.done");
/** Der Grund des Punkte-Zweigs, wenn ALLE scheitern — derselbe Satz, den die Seite bildet. */
const VOLLAUSFALL = (): string =>
  i18n.t("capture.file.draftsPartial", { failed: [P1.title, P2.title].join(", ") });

/**
 * Der Entwurf, an dem der Eintrags-Zweig der Wache nach dem Leeren des Titels nichts mehr zu sichern
 * hat (leere Aussage, keine Stufe) — dieselbe Ausgangslage wie A1–A5 in
 * `quittung-dateiwege-mounted.test.tsx`. So trägt ALLEIN der Punkte-Zweig, und sein Vollausfall ist
 * der Gegenstand.
 */
function entwurfNurTitel(): Record<string, unknown> {
  return {
    id: ENTWURF_ID,
    updatedAt: "2026-09-22T09:00:00.000Z",
    payload: { title: "Entwurf", statement: "", origin: "expert" },
  };
}

/** Ein gespeicherter Entwurf mit Text — der Gegenstand von N-0061. */
function entwurfMitText(): Record<string, unknown> {
  return {
    id: ENTWURF_ID,
    updatedAt: "2026-09-22T09:00:00.000Z",
    payload: {
      title: "Alter Titel",
      statement: "Alter Text im gespeicherten Entwurf.",
      origin: "expert",
    },
  };
}

/** Der Bestand als Zeichenkette — der Vergleichsgegenstand für „unverändert". */
const bestand = (): string => JSON.stringify(server.bestand);

/** Datei über die echte Ablegezone laden und auswerten lassen; beide Funde stehen angehakt. */
async function dateiLadenUndAuswerten(): Promise<void> {
  expect(
    ablegezone(),
    "der Moduswechsel über die Leiste hat die Ablegezone nicht gebracht",
  ).not.toBe(null);
  await dateiAblegen(new File([DATEITEXT], DATEI, { type: "text/plain" }));
  await klick(knopf(i18n.t("capture.file.searchCta")));
  expect(fundzeilen()).toEqual([
    { titel: P1.title, angehakt: true },
    { titel: P2.title, angehakt: true },
  ]);
}

/**
 * G1/G2: Entwurf öffnen, über die LEISTE ins Formular, Titel leeren, über die LEISTE in „Aus Datei",
 * Datei laden. Ab hier trägt allein der Punkte-Zweig.
 */
async function bisZuDenFunden(): Promise<void> {
  server.bestand = { [ENTWURF_ID]: entwurfNurTitel() };
  await seiteOeffnen(ADRESSE);
  await modusUeberLeiste("erfassen.weg.formular");
  expect(verlassenKnopf(), "der Entwurf ist im Formular nicht geöffnet").not.toBeNull();
  await tippe(feld(i18n.t("capture.wizard.titleLabel")), "");
  await modusUeberLeiste("erfassen.weg.datei");
  expect(
    verlassenKnopf(),
    "der geöffnete Entwurf hat den Wechsel über die Leiste nicht überlebt",
  ).not.toBeNull();
  await dateiLadenUndAuswerten();
}

/** Über den Verlassen-Knopf hinauswollen und „Entwurf speichern und wechseln" drücken. */
async function verlassenUndSpeichern(): Promise<void> {
  await klick(verlassenKnopf() as HTMLButtonElement);
  expect(wacheDialoge()).toBe(1);
  expect(imDialog(i18n.t("nav.guard.save")), "die Wache bietet kein Speichern an").toBe(true);
  await klick(knopf(i18n.t("nav.guard.save")));
}

/**
 * Der Dialog nach dem VOLLAUSFALL: offen, Grund darin, beide Auswege da und bedienbar, nichts
 * gewechselt, nichts quittiert, nichts im Bestand.
 */
function vollausfallSteht(vorher: string, wo: { pfad: string; abfrage: string }): void {
  expect(wacheDialoge(), "der Dialog ist nach dem Vollausfall zu").toBe(1);
  expect(adresse()).toEqual(wo);
  grundImDialog(VOLLAUSFALL());
  expect(sichtbar(), "ein Vollausfall darf nicht „gesichert“ melden").not.toContain(GESPEICHERT());
  expect(sichtbar()).not.toContain(VERWORFEN());
  expect(bestand(), "der Vollausfall hat den Bestand verändert").toBe(vorher);
  expect(knopf(i18n.t("nav.guard.discard")).disabled, "Verwerfen ist gesperrt").toBe(false);
  expect(knopf(i18n.t("nav.guard.stay")).disabled).toBe(false);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  await attrappenZuruecksetzen();
  extrakt.punkte = [P1, P2];
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("Aufnahme erfassen-verwerfen · Vollausfall aller Punkte, Moduswechsel über die echte Leiste", () => {
  it("G1 · alle Punkte scheitern: Grund im Dialog, Eingabe bleibt über „Hier bleiben“ und zwei Leistenwechsel, dann „verworfen“ ohne Speichernachweis", async () => {
    lasseCreateScheiternFuer(P1.title, P2.title);
    await bisZuDenFunden();
    const vorher = bestand();

    await verlassenUndSpeichern();

    vollausfallSteht(vorher, { pfad: "/erfassen", abfrage: `?draft=${ENTWURF_ID}` });
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 1 });

    // ── „Hier bleiben": die Eingabe ist bis zur bewussten Entscheidung da. ───────────────────
    await klick(knopf(i18n.t("nav.guard.stay")));
    expect(wacheDialoge()).toBe(0);
    expect(fundzeilen(), "nach dem Vollausfall sind Funde verloren").toEqual([
      { titel: P1.title, angehakt: true },
      { titel: P2.title, angehakt: true },
    ]);

    // Und sie übersteht den Weg über die ECHTE Leiste hin und zurück.
    await modusUeberLeiste("erfassen.weg.formular");
    expect(ablegezone(), "die Leiste hat nicht ins Formular gewechselt").toBeNull();
    await modusUeberLeiste("erfassen.weg.datei");
    expect(fundzeilen(), "der Leistenwechsel hat die Funde verloren").toEqual([
      { titel: P1.title, angehakt: true },
      { titel: P2.title, angehakt: true },
    ]);
    expect(sichtbar(), "der Dateiname ist nach dem Leistenwechsel nicht mehr da").toContain(DATEI);
    expect(verlassenKnopf()).not.toBeNull();

    // ── Die bewusste Entscheidung: verwerfen. ─────────────────────────────────────────────────
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheDialoge()).toBe(1);
    await klick(knopf(i18n.t("nav.guard.discard")));

    expect(wacheDialoge()).toBe(0);
    expect(adresse().pfad).toBe("/start");
    expect(flaeche().querySelector(`[data-testid="${START_MARKE}"]`)).not.toBeNull();
    expect(sichtbar()).toContain(VERWORFEN());
    expect(
      sichtbar(),
      "nach Vollausfall und Verwerfen behauptet die Fläche eine Sicherung",
    ).not.toContain(GESPEICHERT());
    // Nichts angelegt, nichts gelöscht, nichts überschrieben — und das Verwerfen hat keinen
    // weiteren Anlageversuch ausgelöst.
    expect(bestand()).toBe(vorher);
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 1, [P2.title]: 1 });
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  it("G2 · nach dem Vollausfall bewusst ein zweiter Druck, der Server nimmt an: jeder Punkt genau einmal, Quittung „gespeichert“", async () => {
    lasseCreateScheiternFuer(P1.title, P2.title);
    await bisZuDenFunden();
    const vorher = bestand();

    await verlassenUndSpeichern();
    vollausfallSteht(vorher, { pfad: "/erfassen", abfrage: `?draft=${ENTWURF_ID}` });

    lasseCreateScheiternFuer();
    await klick(knopf(i18n.t("nav.guard.save")));

    expect(wacheDialoge()).toBe(0);
    expect(adresse().pfad).toBe("/start");
    expect(sichtbar()).toContain(GESPEICHERT());
    expect(sichtbar()).not.toContain(VERWORFEN());
    expect(anlageversucheJeTitel()).toEqual({ [P1.title]: 2, [P2.title]: 2 });
    expect(bestandJeTitel()[P1.title]).toBe(1);
    expect(bestandJeTitel()[P2.title]).toBe(1);
    // Der geöffnete Entwurf ist nicht angefasst — getragen hat allein der Punkte-Zweig.
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(JSON.stringify(server.bestand[ENTWURF_ID])).toBe(JSON.stringify(entwurfNurTitel()));
  });

  it("G3 · Vollausfall ohne geöffneten Entwurf, „Erfassen“ in der Hauptnavigation, verwerfen: die Erfassung steht leer da, und die Datei kommt über die Leiste nicht zurück", async () => {
    lasseCreateScheiternFuer(P1.title, P2.title);
    server.bestand = {};
    await seiteOeffnen("/erfassen");
    await modusUeberLeiste("erfassen.weg.datei");
    await dateiLadenUndAuswerten();

    await hauptnavigationErfassen();
    expect(wacheDialoge()).toBe(1);
    await klick(knopf(i18n.t("nav.guard.save")));
    vollausfallSteht("{}", { pfad: "/erfassen", abfrage: "" });

    await klick(knopf(i18n.t("nav.guard.discard")));

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toEqual({ pfad: "/erfassen", abfrage: "" });
    // Die Zielansicht ist die LEERE Erfassung: Blatt statt Arbeitsraum, keine Funde, kein Titel.
    expect(ablegezone(), "nach dem Verwerfen steht noch der Dateiweg").toBeNull();
    expect(fundzeilen()).toEqual([]);
    expect(blattTitel().value).toBe("");
    expect(blattText()).toBe("");
    expect(sichtbar()).not.toContain(GESPEICHERT());
    expect(server.bestand).toEqual({});

    // Und wer den Dateiweg über die Leiste wieder öffnet, findet ihn leer vor.
    await modusUeberLeiste("erfassen.weg.datei");
    expect(ablegezone()).not.toBeNull();
    expect(fundzeilen(), "die verworfenen Funde sind wieder aufgetaucht").toEqual([]);
    expect(sichtbar(), "die verworfene Datei ist wieder aufgetaucht").not.toContain(DATEI);
  });
});

describe("N-0061 · Verwerfen bzw. Speichern und wechseln über „Erfassen“ auf derselben Route", () => {
  const MARKE = "Alter Titel MARKE-N0061";

  async function entwurfOffenUndGeaendert(): Promise<void> {
    server.bestand = { [ENTWURF_ID]: entwurfMitText() };
    await seiteOeffnen(ADRESSE);
    expect(blattTitel().value, "der Entwurf ist nicht ins Blatt geladen").toBe("Alter Titel");
    expect(blattText()).toContain("Alter Text im gespeicherten Entwurf.");
    await tippe(blattTitel(), MARKE);
    await hauptnavigationErfassen();
    expect(wacheDialoge(), "die Hauptnavigation hat nicht gefragt").toBe(1);
  }

  it("N1 · Verwerfen und wechseln: der Editor ist leer, die Adresse ohne draft, der Entwurf unverändert", async () => {
    await entwurfOffenUndGeaendert();
    const vorher = bestand();

    await klick(knopf(i18n.t("nav.guard.discard")));

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toEqual({ pfad: "/erfassen", abfrage: "" });
    expect(blattTitel().value, "der verworfene Titel steht noch im Editor").toBe("");
    expect(blattText(), "der Text des verlassenen Entwurfs steht noch im Editor").toBe("");
    expect(bestand()).toBe(vorher);
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(sichtbar()).not.toContain(i18n.t("fd.toastSaved"));
  });

  it("N2 · Entwurf speichern und wechseln: gesichert, und die Bearbeitung ist beendet — weiteres Tippen überschreibt den alten Entwurf nicht", async () => {
    await entwurfOffenUndGeaendert();

    await klick(knopf(i18n.t("nav.guard.save")));

    expect(wacheDialoge()).toBe(0);
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(
      JSON.stringify((server.bestand[ENTWURF_ID] as { payload: unknown }).payload),
      "die Änderung ist nicht im Entwurf gesichert",
    ).toContain(MARKE);
    expect(adresse()).toEqual({ pfad: "/erfassen", abfrage: "" });
    expect(blattTitel().value, "der gerade gesicherte Titel steht noch im Editor").toBe("");
    expect(blattText()).toBe("");

    // Die Bearbeitung des alten Entwurfs ist WIRKLICH beendet: ein neuer Titel wird eine neue
    // Erfassung und geht nicht als Aktualisierung in den alten Entwurf.
    await tippe(blattTitel(), "Neue Erfassung");
    const sichern = flaeche().querySelector<HTMLButtonElement>(
      '[data-testid="blatt-entwurf-sichern"]',
    );
    expect(sichern?.disabled, "„Entwurf sichern“ ist nicht bedienbar").toBe(false);
    await klick(sichern as HTMLButtonElement);
    expect(draftsUpdate, "der alte Entwurf wurde weiterbearbeitet").toHaveBeenCalledTimes(1);
    expect(draftsCreate).toHaveBeenCalledTimes(1);
  });

  it("N3 · ungespeicherte Neuanlage auf derselben Route: Verwerfen und wechseln leert sie wirklich", async () => {
    server.bestand = {};
    await seiteOeffnen("/erfassen");
    await tippe(blattTitel(), "Nie gespeichert");
    await hauptnavigationErfassen();
    expect(wacheDialoge()).toBe(1);

    await klick(knopf(i18n.t("nav.guard.discard")));

    expect(wacheDialoge()).toBe(0);
    expect(adresse()).toEqual({ pfad: "/erfassen", abfrage: "" });
    expect(blattTitel().value).toBe("");
    expect(server.bestand).toEqual({});
    expect(draftsCreate).not.toHaveBeenCalled();
  });
});
