// @vitest-environment jsdom
// ================================================================================================
// JOB 3526 — EIN GEÖFFNETER ENTWURF LÄSST SICH VERLASSEN, OHNE IHN ZU LÖSCHEN.
// ================================================================================================
//
// DER BEFUND (Pedi, 10.09., 09:08). Er hatte einen gespeicherten Entwurf offen. Angeboten waren
// „sichern" und „einreichen". Er wollte weder das eine noch das andere: er wollte seine Änderungen
// wegwerfen und gehen — und den gespeicherten Entwurf behalten. Diesen Weg gab es nicht.
//
// DER WICHTIGSTE WÄCHTER IST NICHT „DER KNOPF IST DA", SONDERN FALL 3: nach dem Verlassen muss der
// gespeicherte Entwurf UNVERÄNDERT auf dem Server stehen. Ein Bau, der beim Verlassen `remove`
// ruft, sieht auf dem Bildschirm richtig aus (die Fläche ist leer, der Mensch ist weg) und hat dem
// Nutzer trotzdem genau das genommen, was er behalten wollte. Der Server dieses Tests ist deshalb
// ein echter, schreibbarer Speicher: `update` schriebe hinein, `remove` löschte daraus, und der
// Vergleich ist der vollständige Bestand vorher/nachher — nicht ein einzelnes Feld.
//
// UND FALL 5 IST DER ZWEITE PRÜFSTEIN: es wird GENAU EINMAL gefragt. Der Weg läuft durch dieselbe
// Navigationswache wie jeder andere Weg von dieser Seite (`NavGuardContext`); sähe der Mensch nach
// seiner Antwort noch den Wache-Dialog, wären zwei Rückfragen für eine Entscheidung gebaut worden.
//
// JOB 3572, Lieferung 7/8: Testserver, Bremse und Bedienhelfer stehen nicht mehr HIER, sondern in
// `attrappen.ts` und `huelle.ts` — dieselben Werkzeuge benutzt die zweite Datei dieses Ordners,
// importiert statt abgeschrieben. Diese 24 Fälle sind der Wächter über diesen Umzug: sie tragen
// unverändert ihre Namen und ihre Zusicherungen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async () => (await import("./attrappen")).authAttrappe());

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import {
  bremse,
  draftsCreate,
  draftsPromote,
  draftsRemove,
  draftsUpdate,
  server,
} from "./attrappen";
import {
  ENTWURF_ID,
  abbauen,
  adresse,
  bestand,
  entwurf,
  feld,
  flaeche,
  flush,
  grundzustand,
  klick,
  knopf,
  mount,
  sichtbar,
  tippe,
  verlassenKnopf,
  wacheDialoge,
  wacheOffen,
  waehle,
} from "./huelle";

beforeEach(grundzustand);

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 3526 · der dritte Weg aus einem geöffneten Entwurf", () => {
  it("1 · der geöffnete Entwurf bietet den Weg an — das leere Formular nicht", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel");
    const knopfImEntwurf = verlassenKnopf();
    expect(knopfImEntwurf).not.toBeNull();
    expect((knopfImEntwurf?.textContent ?? "").trim()).toBe(i18n.t("capture.leaveDraft.action"));

    // Gegenstück: ohne geöffneten Entwurf gibt es nichts zu verlassen und nichts, was bliebe.
    abbauen();
    await mount("/erfassen", "formular");
    expect(verlassenKnopf()).toBeNull();
  });

  it("2 · mit Änderungen fragt die GEMEINSAME Wache — genau ein Dialog, kein eigener daneben", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    expect(wacheOffen()).toBe(false);
    await klick(verlassenKnopf() as HTMLButtonElement);

    // RUNDE 2, bens Korrekturpflicht 2: die Rückfrage ist DIE DER WACHE, und es gibt genau eine.
    expect(wacheOffen()).toBe(true);
    expect(wacheDialoge()).toBe(1);
    // Sie bietet die drei gemeinsamen Antworten an — dieselben wie auf jedem anderen Weg von hier.
    const beschriftungen = [...document.querySelectorAll("[data-navguard-dialog] button")].map(
      (b) => (b.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    expect(beschriftungen).toContain(i18n.t("nav.guard.stay"));
    expect(beschriftungen).toContain(i18n.t("nav.guard.discard"));
    expect(beschriftungen).toContain(i18n.t("nav.guard.save"));

    // Solange nicht geantwortet ist, ist nichts passiert: Fläche steht, Bestand unberührt.
    expect(adresse()).toBe(`/erfassen?draft=${ENTWURF_ID}`);
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel (neu gedacht)");
  });

  it("2b · Hier bleiben nimmt nichts weg — der geänderte Text steht weiter da", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");
    await klick(verlassenKnopf() as HTMLButtonElement);
    await klick(knopf(i18n.t("nav.guard.stay")));

    expect(wacheOffen()).toBe(false);
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel (neu gedacht)");
    expect(adresse()).toBe(`/erfassen?draft=${ENTWURF_ID}`);
  });

  it("2c · der Knopf sagt die Zusage, die Pedis Sorge beantwortet: der Entwurf bleibt", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const zusage = verlassenKnopf()?.getAttribute("title") ?? "";
    expect(zusage).toBe(i18n.t("capture.leaveDraft.keepsDraftHint"));
    expect(zusage).toContain("bleibt unverändert erhalten");
  });

  it("3 · DER WÄCHTER: nach dem Verwerfen ist der gespeicherte Entwurf unverändert vorhanden", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const vorher = bestand();
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    await klick(knopf(i18n.t("nav.guard.discard")));

    // (a) Der Entwurf steht noch — Zeichen für Zeichen derselbe Bestand.
    expect(bestand()).toBe(vorher);
    expect(server.bestand[ENTWURF_ID]).toBeTruthy();
    // (b) Und zwar nicht zufällig, sondern weil dieser Weg den Entwurf gar nicht anfasst.
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(draftsUpdate).not.toHaveBeenCalled();
    expect(draftsCreate).not.toHaveBeenCalled();
    // (c) Die Fläche ist wirklich verlassen.
    expect(adresse()).toBe("/start");
    // (d) RUNDE 5: und der Satz, den der Mensch danach liest, ist DER des Verwerfens — nicht der
    //     des Speicherns. Auf diesem Weg ist er wahr: nichts wurde geschrieben (siehe b).
    expect(sichtbar()).toContain(i18n.t("capture.leaveDraft.done"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.doneSaved"));
  });

  it("4 · ohne Änderungen wird nicht gefragt — es ist ja nichts zu verwerfen", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const vorher = bestand();
    expect(feld(i18n.t("capture.fTitle")).value).toBe("Zahlungsziel");

    await klick(verlassenKnopf() as HTMLButtonElement);

    expect(wacheOffen()).toBe(false);
    expect(adresse()).toBe("/start");
    expect(bestand()).toBe(vorher);
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  it("4b · eine zurückgenommene Änderung ist keine Änderung — der Ausgangsstand zählt", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    const feldTitel = feld(i18n.t("capture.fTitle"));
    await tippe(feldTitel, "Zahlungsziel (neu gedacht)");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel");

    await klick(verlassenKnopf() as HTMLButtonElement);

    expect(wacheOffen()).toBe(false);
    expect(adresse()).toBe("/start");
  });

  it("5 · GENAU EINMAL gefragt: nach der Antwort steht kein zweiter Dialog mehr", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheDialoge()).toBe(1);
    await klick(knopf(i18n.t("nav.guard.discard")));

    // Nach der Antwort ist der Wechsel vollzogen und KEIN Dialog mehr offen — weder ein zweiter
    // der Wache noch ein eigener der Seite.
    expect(wacheDialoge()).toBe(0);
    expect(wacheOffen()).toBe(false);
    expect(adresse()).toBe("/start");
  });

  it("5b · ABLÖSUNG: die vier eigenen Dialogtexte der Runde 1 gibt es nicht mehr", async () => {
    // Der harte Beleg für „kein zweiter Schutzweg": die Schlüssel des abgelösten Dialogs sind aus
    // allen drei Sprachen verschwunden. i18next gibt einen unbekannten Schlüssel unverändert
    // zurück — genau daran ist das messbar, ohne die Datei zu lesen.
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      for (const weg of ["title", "body", "keep", "confirm"]) {
        const schluessel = `capture.leaveDraft.${weg}`;
        expect(i18n.t(schluessel), `${schluessel} (${sprache}) lebt noch`).toBe(schluessel);
      }
      // Die verbliebenen Schlüssel sind dagegen echte Texte.
      expect(i18n.t("capture.leaveDraft.action")).not.toBe("capture.leaveDraft.action");
      expect(i18n.t("capture.leaveDraft.keepsDraftHint")).not.toBe(
        "capture.leaveDraft.keepsDraftHint",
      );
    }
    await i18n.changeLanguage("de");
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
  });

  it("6 · Sichern bleibt unverändert: es aktualisiert denselben Entwurf, es entsteht keine Dublette", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(knopf(i18n.t("capture.saveDraft")));

    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(draftsCreate).not.toHaveBeenCalled();
    const [id, payload] = draftsUpdate.mock.calls[0] as unknown as [string, { title: string }];
    expect(id).toBe(ENTWURF_ID);
    expect(payload.title).toBe("Zahlungsziel (neu gedacht)");
    expect(Object.keys(server.bestand)).toEqual([ENTWURF_ID]);
  });

  it("7 · Einreichen bleibt unverändert: derselbe Entwurf wird promotet", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");

    await klick(knopf(i18n.t("capture.submit")));

    expect(draftsPromote).toHaveBeenCalledTimes(1);
    expect((draftsPromote.mock.calls[0] as unknown as [string])[0]).toBe(ENTWURF_ID);
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  it("8 · der Weg steht auch im geführten Entscheiden-Schritt, wo Sichern und Einreichen stehen", async () => {
    server.bestand = { [ENTWURF_ID]: entwurf("studio") };
    await mount("/erfassen", undefined);

    // Entwurfsliste aufklappen und fortsetzen — der Weg, den Pedi nimmt.
    await klick(knopf(i18n.t("capture.resumeExpand", { count: 1 })));
    await klick(knopf(i18n.t("capture.resume")));

    const leiste = verlassenKnopf()?.parentElement;
    expect(leiste, "der Verlassen-Knopf steht in einer Aktionsleiste").toBeTruthy();
    const beschriftungen = [...(leiste?.querySelectorAll("button") ?? [])].map((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    // Er steht dort, wo auch Sichern und Einreichen stehen — nicht irgendwo auf der Seite.
    expect(beschriftungen).toContain(i18n.t("capture.leaveDraft.action"));
    expect(beschriftungen.some((b) => b.includes(i18n.t("capture.saveDraft")))).toBe(true);
    expect(beschriftungen.some((b) => b.includes(i18n.t("capture.submit")))).toBe(true);

    // Eine Änderung, die genau in dieser Karte erreichbar ist: die Vertraulichkeitsstufe.
    const stufe = flaeche().querySelector<HTMLSelectElement>(
      "[data-testid=capture-vertraulichkeit]",
    );
    expect(stufe?.value).toBe("intern");
    const andere = [...(stufe?.options ?? [])].map((o) => o.value).find((v) => v && v !== "intern");
    await waehle(stufe as HTMLSelectElement, andere as string);

    const vorher = bestand();
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheOffen()).toBe(true);
    await klick(knopf(i18n.t("nav.guard.discard")));
    expect(adresse()).toBe("/start");
    expect(bestand()).toBe(vorher);
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(draftsUpdate).not.toHaveBeenCalled();
  });

  it("9 · EN: Knopf, Zusage und Rückfrage stehen auch auf Englisch da", async () => {
    await i18n.changeLanguage("en");
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Payment terms (revised)");

    expect((verlassenKnopf()?.textContent ?? "").trim()).toBe("Leave draft");
    expect(verlassenKnopf()?.getAttribute("title")).toBe(
      "Discards the changes made since you opened it. The saved draft remains unchanged.",
    );
    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(document.body.textContent ?? "").toContain("Unsaved entry");

    const vorher = bestand();
    await klick(knopf(i18n.t("nav.guard.discard")));
    expect(adresse()).toBe("/start");
    expect(bestand()).toBe(vorher);
    expect(draftsRemove).not.toHaveBeenCalled();
  });

  // ==============================================================================================
  // RUNDE 2 · KORREKTURPFLICHT 1 (ben): KEIN AUSGANG, SOLANGE GESCHRIEBEN WIRD.
  // ==============================================================================================
  //
  // Bens Befund: mit verzögertem `update`/`promote` liess sich die Seite verlassen, WÄHREND der
  // Vorgang lief — und die Zusage „der gespeicherte Entwurf ist unverändert" war danach falsch
  // (Save schrieb, Promote löschte). Beide Fälle brauchen die Bremse, sonst sind sie unmessbar.

  it("10 · während SICHERN läuft, ist der Ausgang zu — und die Zusage wird nicht gegeben", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    bremse.halte();
    await klick(knopf(i18n.t("capture.saveDraft")));
    // Der Save hängt jetzt im Riegel: genau Bens Fenster.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(server.bestand[ENTWURF_ID]).toEqual(entwurf("expert"));

    // (a) Der Weg ist sichtbar zu und nennt den Grund.
    const aus = verlassenKnopf() as HTMLButtonElement;
    expect(aus.disabled).toBe(true);
    expect(aus.getAttribute("title")).toBe(i18n.t("capture.leaveDraft.busy"));

    // (b) Und er ist auch wirksam zu: ein Klick trotzdem bewegt nichts.
    await klick(aus);
    expect(wacheOffen()).toBe(false);
    expect(adresse()).toBe(`/erfassen?draft=${ENTWURF_ID}`);

    // (c) Nach dem Ende des Vorgangs steht der Bestand so da, wie der Save ihn hinterlässt —
    //     und niemand hat behauptet, er sei unverändert.
    await act(async () => {
      await bremse.loslassen();
      await flush();
    });
    expect(adresse()).toBe(`/erfassen?draft=${ENTWURF_ID}`);
    expect((server.bestand[ENTWURF_ID] as { payload: { title: string } }).payload.title).toBe(
      "Zahlungsziel (neu gedacht)",
    );
  });

  // ==============================================================================================
  // RUNDE 5 · KORREKTURPFLICHT 1 (ben): DIE DRITTE ANTWORT DARF NICHT „VERWORFEN" MELDEN.
  // ==============================================================================================
  //
  // Bens Gegenprobe: Titel ändern → „Entwurf verlassen" → „Entwurf speichern und wechseln". Gemessen
  // hat er genau ein `update`, einen GEÄNDERTEN Bestand, die Adresse `/start` — und dazu den Satz
  // „Die Änderungen seit dem Öffnen sind verworfen, der gespeicherte Entwurf ist unverändert."
  // Gespeichert UND verworfen kann nicht beides sein.
  //
  // Der Grund liegt in der gemeinsamen Wache und ist keine Nachlässigkeit dieser Seite: `runPending()`
  // — und damit der `proceed`-Rückruf — läuft nach „Verwerfen und wechseln" UND nach erfolgreichem
  // Speichern (NavGuardContext.tsx: `saveAndGo`). Wer hier eine Meldung fest an den Rückruf hängt,
  // hängt sie an ZWEI Antworten. Diese beiden Fälle halten das dauerhaft fest.

  it("12 · Speichern und wechseln: der Entwurf ist geschrieben — und die Meldung sagt genau das", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Zahlungsziel (neu gedacht)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    expect(wacheOffen()).toBe(true);
    await klick(knopf(i18n.t("nav.guard.save")));

    // (a) Es wurde wirklich gespeichert — derselbe Entwurf, keine Dublette.
    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect(draftsCreate).not.toHaveBeenCalled();
    expect(draftsRemove).not.toHaveBeenCalled();
    expect(Object.keys(server.bestand)).toEqual([ENTWURF_ID]);
    expect((server.bestand[ENTWURF_ID] as { payload: { title: string } }).payload.title).toBe(
      "Zahlungsziel (neu gedacht)",
    );
    // (b) Die Fläche ist verlassen.
    expect(adresse()).toBe("/start");
    expect(wacheDialoge()).toBe(0);
    // (c) DER PRÜFSTEIN: der Satz auf dem Bildschirm gehört zum Speichern. Die Verwerfen-Zusage
    //     („die Änderungen sind verworfen, der gespeicherte Entwurf ist unverändert") wäre hier
    //     Zeichen für Zeichen das Gegenteil des gemessenen Bestands.
    expect(sichtbar()).toContain(i18n.t("capture.leaveDraft.doneSaved"));
    expect(sichtbar()).not.toContain(i18n.t("capture.leaveDraft.done"));
  });

  it("12b · EN: derselbe Speicherweg, derselbe wahre Satz — auf Englisch", async () => {
    await i18n.changeLanguage("en");
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");
    await tippe(feld(i18n.t("capture.fTitle")), "Payment terms (revised)");

    await klick(verlassenKnopf() as HTMLButtonElement);
    await klick(knopf(i18n.t("nav.guard.save")));

    expect(draftsUpdate).toHaveBeenCalledTimes(1);
    expect((server.bestand[ENTWURF_ID] as { payload: { title: string } }).payload.title).toBe(
      "Payment terms (revised)",
    );
    expect(adresse()).toBe("/start");
    // Wörtlich, nicht über den Schlüssel: ein leerer oder fehlender EN-Text fiele sonst nicht auf.
    expect(sichtbar()).toContain(
      "Draft left. The changes made since you opened it are stored in the saved draft.",
    );
    expect(sichtbar()).not.toContain("were discarded");
  });

  it("11 · während EINREICHEN läuft, ist der Ausgang zu — sonst verspräche er einen Entwurf, den Promote löscht", async () => {
    await mount(`/erfassen?draft=${ENTWURF_ID}`, "formular");

    bremse.halte();
    await klick(knopf(i18n.t("capture.submit")));
    expect(draftsPromote).toHaveBeenCalledTimes(1);

    const aus = verlassenKnopf();
    // Der Knopf ist entweder gar nicht mehr da (die Fläche hat auf „eingereicht" umgeschaltet)
    // oder er ist gesperrt — beides ist richtig; ein BEDIENBARER Ausgang wäre der Fehler.
    if (aus) {
      expect(aus.disabled).toBe(true);
      await klick(aus);
      expect(adresse()).toBe(`/erfassen?draft=${ENTWURF_ID}`);
      expect(wacheOffen()).toBe(false);
    }

    await act(async () => {
      await bremse.loslassen();
      await flush();
    });
    // Promote hat den Entwurf serverseitig entfernt — genau die Zusage, die ein Verlassen im
    // Fenster davor gebrochen hätte.
    expect(server.bestand[ENTWURF_ID]).toBeUndefined();
  });
});
