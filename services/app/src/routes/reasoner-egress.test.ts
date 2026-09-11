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
  // JOB 3570 · WARUM IN DIESER DATEI KEINE KI-FREIGABE STEHT.
  // ================================================================================================
  //
  // Drei der vier Fälle unten sind SPERRFÄLLE: sie erwarten „Cloud-complete NIE aufgerufen" und
  // bekommen ausdrücklich KEINE Freigabe — der Schalter, den sie nicht brauchen, hat in einem Fall
  // nichts zu suchen, der die Sperre messt. Ihre Null steht nicht auf einer Vermutung, sondern auf
  // einem gezählten Spion (`expect(complete).not.toHaveBeenCalled()`).
  //
  // Der VIERTE Fall („Positiv: bewusst intern deklarierter Upload → Cloud-complete läuft") bräuchte
  // die Grundfreigabe, sobald der Kern von JOB 3549 eingebaut ist — und kann sie hier nicht
  // bekommen: der Testhelfer liegt in `services/reasoner/src/testhelfer-ki-freigabe.ts`, und ein
  // Import von `services/app` dorthin verletzt die Modulgrenze. Gemessen, nicht vermutet:
  // `npx depcruise --config .dependency-cruiser.cjs services` meldet dann
  // „error module-boundaries: services/app/src/routes/reasoner-egress.test.ts →
  // services/reasoner/src/testhelfer-ki-freigabe.ts". Der Nachtrag dafür ist EINE Zeile in
  // `services/reasoner/index.ts` (Re-Export des Helfers) — außerhalb der Zielpfade von JOB 3570
  // und deshalb dort als offener Punkt benannt, nicht heimlich hier gebaut.
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
    // OFFEN (JOB 3570): dieser Fall braucht unter dem Kern von JOB 3549 die Grundfreigabe; sie ist
    // von hier aus nicht setzbar (Modulgrenze, s. Kopf von `appWithSpy`).
    expect(complete).toHaveBeenCalled();
  });
});
