import { describe, expect, it, vi } from "vitest";
import { ModelProvider, Reasoner } from "../../../reasoner";
import { buildApp, buildServices } from "../build-app";

// SCRUM-502 R6: die Egress-Garantie wird an den TATSÄCHLICHEN reasoner-Aktionsrouten geprüft
// (/api/reasoner task=extract/assist), nicht nur über check-text. Spy = der EINE Modell-Chokepoint
// (client.complete). Vertraulicher Text → complete NIE aufgerufen (kein Cloud-Egress); bewusst
// intern → complete läuft.
describe("SCRUM-502 R6: /api/reasoner egress (echter complete-Spy)", () => {
  const DOC =
    "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften und den Druck prüfen. " +
    "Bei Überdruck sofort das Ventil schließen und den Vorgang dokumentieren.";

  // ================================================================================================
  // JOB 3570/3588/3657 · WELCHER FALL DIESER DATEI EINE KI-FREIGABE BEKOMMT — UND WELCHER NIE.
  // ================================================================================================
  //
  // Drei der vier Fälle unten sind SPERRFÄLLE: sie erwarten „Cloud-complete NIE aufgerufen" und
  // bekommen ausdrücklich KEINE Freigabe — der Schalter, den sie nicht brauchen, hat in einem Fall
  // nichts zu suchen, der die Sperre messt. Ihre Null steht nicht auf einer Vermutung, sondern auf
  // einem gezählten Spion (`expect(complete).not.toHaveBeenCalled()`).
  //
  // Der VIERTE Fall („Positiv: bewusst intern deklarierter Upload → Cloud-complete läuft") braucht
  // die Grundfreigabe, sobald der Kern von JOB 3549 eingebaut ist — und BEKOMMT SIE HIER NICHT.
  // Beide von hier aus gangbaren Wege sind versperrt, und JOB 3657 hat beide NACHGEMESSEN:
  //
  //   1. TESTHELFER IMPORTIEREN — verletzt die Modulgrenze. `npx depcruise --config
  //      .dependency-cruiser.cjs services` meldet mit dem Import in ALLEN VIER betroffenen Dateien
  //      „error module-boundaries: services/app/src/routes/reasoner-egress.test.ts →
  //      services/reasoner/src/testhelfer-ki-freigabe.ts" und schliesst mit
  //      „x 4 dependency violations (4 errors, 0 warnings). 493 modules, 1790 dependencies cruised."
  //      Die Regel steht in `.dependency-cruiser.cjs:16-27` und lässt Cross-Modul-Importe
  //      ausschliesslich über `services/reasoner/index.ts` zu.
  //   2. DIE FELDER SELBST SCHREIBEN — auch im Nutzlastobjekt des ECHTEN Adminwegs
  //      (`PUT /api/reasoner/config` mit `kiFreigabe: { … }`). Das verbietet der Freigabe-Wächter
  //      F2 (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`, `it("F2 · …")`) ausnahmslos und
  //      für die ganze Fläche. JOB 3588 Runde 1 hat genau diesen Weg gebaut und ist daran rot
  //      geworden. Die Regel ist richtig: wer die Felder einmal von Hand schreiben darf, kann morgen
  //      `vertraulicheInhalte` danebenschreiben, ohne dass es jemand sieht.
  //
  // ------------------------------------------------------------------------------------------------
  // JOB 3657 · WAS DER NACHTRAG WIRKLICH KOSTET — GEMESSEN, NICHT GESCHÄTZT.
  // ------------------------------------------------------------------------------------------------
  //
  // Der Punkt bleibt offen, weil er EINE Zeile PRODUKTCODE ausserhalb der Zielpfade braucht: einen
  // Re-Export des Helfers in `services/reasoner/index.ts`. JOB 3657 hat diesen Stand auf einem
  // Messstand (Kern JOB 3549, Commit 1bcb283) gebaut, gemessen und wieder verworfen. Ergebnis:
  //
  //   OHNE die Zeile, MIT dem Kern:  Test Files 4 failed (4) · Tests 5 failed | 83 passed (88).
  //   MIT der Zeile:                 depcruise „no dependency violations (493 modules, 1787
  //                                  dependencies cruised)", `npx tsc --noEmit` ohne Ausgabe,
  //                                  Test Files 6 passed (6) · Tests 128 passed (128) — die vier
  //                                  Dateien UND die beiden Wächter.
  //
  // ZWEI BEFUNDE, DIE DEN BISHERIGEN TEXT KORRIGIEREN:
  //   (a) Der zweite angekündigte Nachtrag entfällt. `tests/ki-anbieterwahl/routing-zwei-
  //       attrappen.test.ts` sagt im Kopf von OHNE_FREIGABE_MIT_GRUND, es brauche AUSSERDEM einen
  //       Eintrag in REGISTER 1 von `tests/capture/aufrufer-waechter.test.ts`. Das stimmt nicht:
  //       der Eintrag für `testhelfer-ki-freigabe.ts::erteileKiFreigabe` steht dort bereits, und
  //       der Aufrufer-Wächter lief mit dem Re-Export grün (A1/A2/A3).
  //   (b) DAFÜR REISST DIE ZEILE EIN LOCH IN F1. Der Freigabe-Wächter erkennt einen Benutzer an
  //       einer Importzeile, deren Pfad auf den DATEINAMEN des Helfers endet. Wer ihn stattdessen
  //       über `../../../reasoner` holt, taucht darin NICHT auf — die vier Dateien wären echte
  //       Benutzer und stünden in keinem Register. Genau davor schützt F1. Wer die Zeile einbaut,
  //       muss deshalb IN DERSELBEN RUNDE F1 auf den Index-Weg erweitern und die vier Dateien aus
  //       OHNE_FREIGABE_MIT_GRUND nach FREIGABE_ERLAUBT (samt FALLAKTE) umtragen — sonst ist der
  //       Wächter danach schwächer als vorher, und zwar unbemerkt.
  //   (c) UND F1 LIEST DEN ROHTEXT, NICHT DEN CODE. JOB 3657 hat sein Suchmuster in Runde 1 hier
  //       WÖRTLICH zitiert, um (b) zu erklären — und wurde dadurch selbst als Benutzer gezählt:
  //       „expected [ …(60) ] to deeply equal [ …(59) ]", der Überhang genau diese Datei. Deshalb
  //       steht das Muster oben in Prosa statt als Zitat. F2 hat diese Falle seit JOB 3586 hinter
  //       sich (`bestandCode` blendet Kommentare aus); F1 hat sie noch, und sie bestraft dasselbe:
  //       die Begründung, warum eine Datei den Helfer NICHT benutzt.
  //
  // Die Zeile widerspricht ausserdem der Hausdoktrin in `services/reasoner/index.ts` (Kommentar zu
  // mega59 Block I): ein Re-Export ist die ÖFFENTLICHE Fläche des Moduls, und für einen Testhelfer
  // ist das „eine Zusage, die niemand geben wollte". Das ist eine Entscheidung über die Modulfläche
  // und gehört Pedi, nicht einer Bahn — deshalb steht sie hier benannt und nicht still gebaut.
  function appWithSpy() {
    const complete = vi.fn(async () => '{"points": []}');
    const services = buildServices();
    // Nur ein Cloud-Provider (usingPrimary), KEIN lokaler → vertraulich landet deterministisch,
    // die Cloud (dieser Spy) darf NIE laufen.
    (services as unknown as { reasoner: Reasoner }).reasoner = new Reasoner(
      new ModelProvider({ name: "cloud-spy", complete }),
    );
    return { app: buildApp(services), complete };
  }

  async function login(app: ReturnType<typeof buildApp>) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  it("extract: Upload (transient-document) OHNE Stufe → Cloud-complete NIE aufgerufen", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "extract", text: DOC, source: "transient-document" }, // fehlt Stufe → fail-safe
    });
    expect(res.statusCode).toBe(200);
    // SPERRFALL (JOB 3570): keine KI-Freigabe im Aufbau — die Null gehört der fehlenden Stufe.
    expect(complete).not.toHaveBeenCalled();
  });

  it("assist: Editor-Text (draft) ohne Stufe → Cloud-complete NIE aufgerufen", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "assist", text: DOC, source: "draft" }, // fehlt Stufe → fail-safe vertraulich
    });
    // JOB 3276: der Text kommt NICHT an die Cloud — daran hat sich nichts geändert, und das ist die
    // Zusage dieses Falls. Geändert hat sich, was der Nutzer dann sieht: früher der geglättete
    // Originaltext als „KI-Vorschlag", jetzt die ehrliche Meldung mit der Einstufung als Grund
    // (tests/ki-assist-leer). Deshalb kein 200 mehr — und der geschützte Text bleibt im Server.
    //
    // JOB 3353 B: die Meldung hat jetzt zusätzlich einen STATUS und eine KENNUNG. „Nicht 200" allein
    // wäre eine schwache Zusage — ein Absturz erfüllt sie auch. Geprüft wird deshalb die benannte
    // Form: 409 mit `CONFIDENTIAL_CLOUD_BLOCKED` und dem Grund `unsaved_draft` (draft OHNE Anker,
    // JOB 2692 D2). Der Satz nennt die Einstufung unverändert — sie ist die Regel, die greift.
    expect(res.statusCode).toBe(409);
    const koerper = res.json() as { code?: unknown; reason?: unknown; message?: unknown };
    expect(koerper.code).toBe("CONFIDENTIAL_CLOUD_BLOCKED");
    expect(koerper.reason).toBe("unsaved_draft");
    expect(String(koerper.message)).toContain("als vertraulich eingestuft");
    expect(res.body).not.toContain(DOC);
    // SPERRFALL (JOB 3570): keine KI-Freigabe im Aufbau — die Null gehört der Einstufung.
    expect(complete).not.toHaveBeenCalled();
  });

  it("extract: transient-document + koId eines INTERNEN KOs OHNE Stufe → erbt NICHT → complete null", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    // Ein internes (nicht vertrauliches) KO als Ziel-Behälter anlegen.
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: "Intern",
        statement: "Interner Kerntext.",
        type: "best_practice",
        category: "A",
      },
    });
    const koId = created.json().id as string;
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "extract", text: DOC, source: "transient-document", koId }, // keine Stufe
    });
    expect(res.statusCode).toBe(200);
    // SPERRFALL (JOB 3570): keine KI-Freigabe im Aufbau — die Null gehört der nicht geerbten Stufe.
    expect(complete).not.toHaveBeenCalled(); // kein Erben der intern-Container-Stufe
  });

  it("Positiv: bewusst intern deklarierter Upload → Cloud-complete läuft", async () => {
    const { app, complete } = appWithSpy();
    const headers = await login(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: {
        task: "extract",
        text: DOC,
        source: "transient-document",
        confidentiality: "intern",
      },
    });
    expect(res.statusCode).toBe(200);
    // OFFEN (JOB 3570/3588, nachgemessen von JOB 3657): dieser Fall braucht unter dem Kern von
    // JOB 3549 die Grundfreigabe; sie ist von hier aus auf KEINEM erlaubten Weg setzbar — beide
    // Sperren, der gemessene Rotstand („expected \"spy\" to be called at least once") und der Preis
    // des Nachtrags stehen im Kopf von `appWithSpy`.
    expect(complete).toHaveBeenCalled();
  });
});
