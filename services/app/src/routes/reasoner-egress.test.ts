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
  // JOB 3570/3588 · WELCHER FALL DIESER DATEI EINE KI-FREIGABE BEKOMMT — UND WELCHER NIE.
  // ================================================================================================
  //
  // Drei der vier Fälle unten sind SPERRFÄLLE: sie erwarten „Cloud-complete NIE aufgerufen" und
  // bekommen ausdrücklich KEINE Freigabe — der Schalter, den sie nicht brauchen, hat in einem Fall
  // nichts zu suchen, der die Sperre messt. Ihre Null steht nicht auf einer Vermutung, sondern auf
  // einem gezählten Spion (`expect(complete).not.toHaveBeenCalled()`).
  //
  // Der VIERTE Fall („Positiv: bewusst intern deklarierter Upload → Cloud-complete läuft") braucht
  // die Grundfreigabe, sobald der Kern von JOB 3549 eingebaut ist — und BEKOMMT SIE HIER NICHT.
  // JOB 3588 hat beide denkbaren Wege geprüft und beide versperrt gefunden:
  //
  //   1. TESTHELFER IMPORTIEREN — verletzt die Modulgrenze. Gemessen, nicht vermutet: mit dem
  //      Import meldet `npx depcruise --config .dependency-cruiser.cjs services`
  //      „error module-boundaries: <diese Datei> → services/reasoner/src/testhelfer-ki-freigabe.ts
  //      · 1 dependency violations (1 errors)". Die Regel steht in `.dependency-cruiser.cjs:16-27`
  //      und lässt Cross-Modul-Importe ausschliesslich über `services/reasoner/index.ts` zu.
  //   2. DIE FELDER SELBST SCHREIBEN — auch im Nutzlastobjekt des ECHTEN Adminwegs
  //      (`PUT /api/reasoner/config` mit `kiFreigabe: { … }`). Das verbietet der Freigabe-Wächter
  //      F2 (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts:2093`) ausnahmslos und für die
  //      ganze Fläche. JOB 3588 Runde 1 hat genau diesen Weg gebaut und ist daran rot geworden.
  //      Die Regel ist richtig: wer die Felder einmal von Hand schreiben darf, kann morgen
  //      `vertraulicheInhalte` danebenschreiben, ohne dass es jemand sieht.
  //
  // DER KLEINSTE UMBAU, DER ES KÖNNTE: eine Zeile in `services/reasoner/index.ts`, die den Helfer
  // re-exportiert. Sie liegt ausserhalb der Zielpfade dieses Auftrags UND widerspricht der
  // Hausdoktrin, die dort im Kommentar zu mega59 Block I (`services/reasoner/index.ts:38-52`)
  // festgehalten ist: ein Re-Export ist die ÖFFENTLICHE Fläche des Moduls, und für einen
  // Testhelfer ist das „eine Zusage, die niemand geben wollte". Der Punkt bleibt deshalb offen und
  // benannt, statt hier still am Wächter vorbei gebaut zu werden.
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
    // OFFEN (JOB 3570, gemessen und bestätigt von JOB 3588): dieser Fall braucht unter dem Kern von
    // JOB 3549 die Grundfreigabe; sie ist von hier aus auf KEINEM erlaubten Weg setzbar — beide
    // Sperren samt gemessener depcruise-Meldung stehen im Kopf von `appWithSpy`.
    expect(complete).toHaveBeenCalled();
  });
});
