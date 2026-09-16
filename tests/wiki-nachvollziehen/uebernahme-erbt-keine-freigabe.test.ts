// ================================================================================================
// JOB 4213 · WIKI-NACHVOLLZIEHEN — EINE ZURÜCKGEHOLTE FASSUNG IST UNGEPRÜFT.
// ================================================================================================
//
// DER FEHLER, GEGEN DEN DIESE DATEI STEHT: eine Übernahme, die den Schnappschuss unbesehen
// zurückschreibt, holt `status: "validiert"` mit zurück — eine Freigabe, die für einen ANDEREN
// Inhalt erteilt wurde. Sie stünde dann an einem Text, den in dieser Fassung niemand geprüft hat.
//
// AM DRAHT GEMESSEN, nicht am Prädikat: jeder Fall läuft durch die echten HTTP-Wege (Anlage,
// Freigabe, Überarbeitung, Übernahme) einer echten App. Damit gilt die Zusage für den Weg, den der
// Browser wirklich geht, und nicht für eine Hilfsfunktion daneben.
//
// WAS VOR DIESER RUNDE ROT WAR, ehrlich getrennt (die Gegenprobe ist nur so viel wert, wie sie
// misst):
//   · A1 Herkunft — `restoredFromVersion` gab es nicht, der Historieneintrag trug keine Herkunft,
//     und der Schnappschuss führte sie folglich auch nicht mit.
//   · A4/A5 Freigabe UND Übernahme in einem Aufruf — `revise-release` hätte den zurückgeholten
//     Stand sofort freigegeben.
//   · A6 die Herkunftsprüfung — eine erfundene Zahl lief ungeprüft in den Datensatz.
//   · A3 (Prüfstand nach gewöhnlicher Übernahme) war AUCH VORHER schon grün: `naechsteFassung`
//     setzt `status`/`trust` seit jeher selbst. Der Fall steht hier trotzdem — er hält genau diese
//     Eigenschaft fest, an der die ganze Zusage hängt, und wird rot, sobald jemand die Werte künftig
//     aus der Eingabe übernähme.
//
// RUNDE 2 · A2 IST KEIN NEUER VERMERK MEHR, sondern die Zusage, dass KEINER entstanden ist: eine
// Übernahme trägt „überarbeitet" wie jede Revision. Ein sechster fester Dienst-Vermerk bräuchte
// einen Eintrag in `apps/web/src/lib/koHistoryNote.ts` — nicht Zielpfad dieses Auftrags — und stünde
// ohne ihn deutsch im englischen Text (JOB 3627). Die Herkunft reist deshalb als ZAHL.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/** Ein weiteres Konto in dieser App — für die Rollenhälfte von BENs Korrekturpflicht 3. */
async function konto(
  app: App,
  admin: Auth,
  marke: string,
  role: "experte" | "controller",
): Promise<Auth> {
  const email = `${role}@${marke}.test`;
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: email, email, password: "geheim12345", role },
  });
  expect(res.statusCode, res.body).toBe(201);
  return login(app, email, "geheim12345");
}

/** Eine App mit einem Admin — er darf anlegen, überarbeiten UND freigeben. */
async function setup(marke: string): Promise<{ app: App; admin: Auth }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  return { app, admin: await login(app, `admin@${marke}.test`, "geheim12345") };
}

async function anlegen(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      // Ohne ausdrückliche Einstufung entsteht gar kein Wissensobjekt (`MISSING_CONFIDENTIALITY`) —
      // die Anlage ist bewusst fail-closed, und dieser Fall nutzt sie wie jede Fläche des Hauses.
      confidentiality: "intern",
      title: "Reinigung Spritzzone",
      statement: "Nur trocken abkehren.",
      type: "technik",
      category: "Produktion",
      conditions: ["Anlage steht"],
      measures: ["Trockenreinigung"],
      bodyHtml: "<p>Frühere Anweisung: trocken abkehren.</p>",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

const freigeben = (app: App, wer: Auth, id: string) =>
  app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: wer,
    payload: { action: "admin-validate" },
  });

const holen = async (app: App, wer: Auth, id: string) => {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
};

const fassungen = async (app: App, wer: Auth, id: string) => {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}/versions`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    version: number;
    note: string;
    snapshot: { history?: unknown[] } & Record<string, unknown>;
  }[];
};

/**
 * Der Ausgangsstand JEDES Falls, Schritt für Schritt und ausdrücklich NACHEINANDER:
 * v1 (freigegeben) → überarbeitet zu v2 → v2 freigegeben. Zurückzuholen ist danach v1.
 */
async function zweiFreigegebeneFassungen(marke: string) {
  const { app, admin } = await setup(marke);
  const id = await anlegen(app, admin);
  expect((await freigeben(app, admin, id)).statusCode).toBe(200);
  const v1 = await holen(app, admin, id);
  expect(v1.status, "Vorbedingung: v1 ist freigegeben").toBe("validiert");

  const revise = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: admin,
    payload: {
      action: "revise",
      changes: {
        statement: "Nach jeder Schicht nass reinigen.",
        measures: ["Nassreinigung"],
        bodyHtml: "<p>Aktuelle Anweisung: nass reinigen.</p>",
      },
    },
  });
  expect(revise.statusCode, revise.body).toBe(200);
  expect((await freigeben(app, admin, id)).statusCode).toBe(200);
  const v2 = await holen(app, admin, id);
  expect(v2.version, "Vorbedingung: der Bestand steht auf Version 2").toBe(2);
  expect(v2.status, "Vorbedingung: v2 ist freigegeben").toBe("validiert");
  return { app, admin, id, v1, v2 };
}

describe("JOB 4213 · A — die alte Freigabe kommt NIE mit", () => {
  it("A1/A2/A3 · die Übernahme von v1 ergibt eine OFFENE Fassung, die ihre Herkunft nennt", async () => {
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-a1");

    // RUNDE 3: die Übernahme schickt NUR die Fassungsnummer. Den Inhalt holt der Dienst selbst aus
    // der Ablage — deshalb steht hier kein einziges Inhaltsfeld mehr.
    const uebernahme = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "revise",
        changes: { restoredFromVersion: 1 },
        expectedVersion: 2,
      },
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(200);

    const jetzt = await holen(app, admin, id);
    // A3 · DER PRÜFSTAND. „offen", obwohl die übernommene Fassung freigegeben WAR.
    expect(jetzt.version).toBe(3);
    expect(jetzt.status, "die alte Freigabe ist mit zurückgekommen").toBe("offen");
    expect(jetzt.trust, "der Vertrauenswert der alten Freigabe ist mitgewandert").toBe(0);
    // Der INHALT ist wirklich der alte — eine Übernahme, die nur den Status setzt, wäre keine.
    expect(jetzt.statement).toBe("Nur trocken abkehren.");
    expect(jetzt.measures).toEqual(["Trockenreinigung"]);
    expect(String(jetzt.bodyHtml)).toContain("trocken abkehren");

    // A1 · DIE HERKUNFT steht im Historieneintrag DIESER Fassung.
    const eintrag = (
      jetzt.history as { version: number; note: string; restoredFrom?: number }[]
    ).find((h) => h.version === 3);
    expect(eintrag?.restoredFrom, "die entstandene Fassung nennt ihre Herkunft nicht").toBe(1);
    // A2 · DER VERMERK BLEIBT DER BEKANNTE. Eine Übernahme führt KEINEN sechsten festen
    // Dienst-Vermerk ein: er bräuchte einen Eintrag im Vermerkkatalog (`koHistoryNote.ts`, nicht
    // Zielpfad) und stünde ohne ihn deutsch im englischen Text. Was die Fassung unterscheidet, ist
    // die Zahl darüber; die Fläche macht daraus ihren eigenen, übersetzten Satz.
    expect(eintrag?.note, "es ist ein neuer, unübersetzter Dienst-Vermerk entstanden").toBe(
      "überarbeitet",
    );
    const abgelegt = await fassungen(app, admin, id);
    expect(abgelegt.find((f) => f.version === 3)?.note).toBe("überarbeitet");
    // Und der Schnappschuss der Fassung führt die Herkunft mit — daran liest die Fassungskarte sie.
    const eintragImSchnappschuss = (
      (abgelegt.find((f) => f.version === 3)?.snapshot.history ?? []) as {
        version: number;
        restoredFrom?: number;
      }[]
    ).find((h) => h.version === 3);
    expect(
      eintragImSchnappschuss?.restoredFrom,
      "der abgelegte Schnappschuss trägt die Herkunft nicht",
    ).toBe(1);
  });

  it("A4 · GEGENPROBE: ein Aufruf, der die Freigabe ausdrücklich mitschickt, erhält sie NICHT", async () => {
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-a2");

    const uebernahme = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "revise",
        changes: {
          restoredFromVersion: 1,
          // WAS EIN AUFRUFER SICH WÜNSCHEN KÖNNTE — und was der Dienst nicht hergibt. Diese drei
          // Felder sind KEIN Inhalt (`ReviseKoInput` führt sie nicht), die Übernahme läuft also
          // durch; sie erreichen den Datensatz aber nicht.
          status: "validiert",
          trust: 99,
          confidence: 99,
        },
      },
    });
    expect(uebernahme.statusCode, uebernahme.body).toBe(200);

    const jetzt = await holen(app, admin, id);
    expect(jetzt.status, "ein mitgeschickter Prüfstand ist durchgereicht worden").toBe("offen");
    expect(jetzt.trust, "ein mitgeschickter Vertrauenswert ist durchgereicht worden").toBe(0);
  });

  it("A4b · und dieselbe Zusage gilt der GEWÖHNLICHEN Revision — sonst deckt A4 sie nicht mehr", async () => {
    // RUNDE 3, ehrlich gemessen: seit der Dienst den Inhalt einer Übernahme selbst zusammenstellt,
    // erreicht ein mitgeschickter Prüfstand `naechsteFassung` auf DIESEM Weg gar nicht mehr — A4
    // fängt eine Verstellung dort also nicht länger. Die Zusage „`status` kommt aus dem Vorgang,
    // nicht aus der Eingabe" gilt aber für JEDE Fassung, und dieser Fall hält genau sie fest.
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-a4b");
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "revise",
        changes: { statement: "Ganz normal überarbeitet.", status: "validiert", trust: 99 },
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    const jetzt = await holen(app, admin, id);
    expect(jetzt.status, "ein mitgeschickter Prüfstand ist durchgereicht worden").toBe("offen");
    expect(jetzt.trust, "ein mitgeschickter Vertrauenswert ist durchgereicht worden").toBe(0);
  });

  it("A5 · GEGENPROBE: auch „überarbeiten und freigeben“ gibt einen zurückgeholten Stand nicht frei", async () => {
    // Der Weg, über den die Freigabe sonst IN DERSELBEN Bewegung entsteht (`revise-release`). Eine
    // Freigabe, die hier griffe, wäre keine neue — sie wäre die Wiederauferstehung der alten.
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-a3");

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "revise-release", changes: { restoredFromVersion: 1 } },
    });
    expect(res.statusCode, res.body).toBe(200);
    const jetzt = await holen(app, admin, id);
    expect(jetzt.status, "der zurückgeholte Stand wurde in einem Zug freigegeben").toBe("offen");
    expect(jetzt.trust).toBe(0);
  });

  it("A6 · eine Herkunft, die es nicht gibt, wird abgewiesen — nicht gespeichert", async () => {
    // Eine erfundene Zahl stünde für immer als Auskunft im Datensatz. Der Dienst prüft sie gegen
    // den Bestand, innerhalb desselben serialisierten Abschnitts, in dem er schreibt.
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-a4");
    for (const falsch of [0, 9, 2.5]) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: admin,
        payload: { action: "revise", changes: { restoredFromVersion: falsch } },
      });
      expect(res.statusCode, `restoredFromVersion=${falsch} wurde angenommen: ${res.body}`).toBe(
        400,
      );
    }
    expect((await holen(app, admin, id)).version, "trotz Abweisung wurde geschrieben").toBe(2);
  });
});

// ================================================================================================
// JOB 4213 R3 · BENs KORREKTURPFLICHT 2 — DIE HERKUNFT IST KEINE BEHAUPTUNG MEHR.
// ================================================================================================
//
// GEMESSEN AN RUNDE 2: `BEN Herkunft {"http":200,"statement":"ERFUNDENER INHALT","herkunft":1}` —
// beliebiger neuer Text liess sich mit `restoredFromVersion: 1` speichern und wurde danach als „aus
// Fassung v1 übernommen" angezeigt. Vor dieser Runde sind beide Fälle hier rot.
describe("JOB 4213 · C — eine Übernahme trägt den Inhalt DER genannten Fassung, keinen anderen", () => {
  it("C1 · erfundener Inhalt mit gültiger Herkunftszahl wird ABGEWIESEN", async () => {
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-c1");

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "revise",
        changes: { statement: "ERFUNDENER INHALT", restoredFromVersion: 1 },
      },
    });
    expect(res.statusCode, `erfundener Inhalt mit Herkunft v1 wurde angenommen: ${res.body}`).toBe(
      400,
    );
    // ABGEWIESEN, NICHT STILL VERWORFEN: der Grund nennt das Feld, das im Weg stand.
    expect(String(res.json().message)).toContain("statement");

    const jetzt = await holen(app, admin, id);
    expect(jetzt.version, "trotz Abweisung ist eine Fassung entstanden").toBe(2);
    expect(jetzt.statement, "der erfundene Text ist im Bestand gelandet").not.toBe(
      "ERFUNDENER INHALT",
    );
  });

  it("C2 · jedes Inhaltsfeld neben der Herkunft wird abgewiesen, keins schlüpft durch", async () => {
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-c2");
    const felder: Record<string, unknown>[] = [
      { title: "Fremder Titel" },
      { statement: "Fremde Aussage" },
      { bodyHtml: "<p>Fremder Bericht</p>" },
      { conditions: ["Fremde Bedingung"] },
      { measures: ["Fremde Maßnahme"] },
      { type: "best_practice" },
      { asset: "FREMD-01" },
    ];
    for (const feld of felder) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: admin,
        payload: { action: "revise", changes: { ...feld, restoredFromVersion: 1 } },
      });
      expect(
        res.statusCode,
        `${Object.keys(feld)[0]} neben der Herkunft wurde angenommen: ${res.body}`,
      ).toBe(400);
    }
    expect((await holen(app, admin, id)).version, "trotz Abweisung wurde geschrieben").toBe(2);
  });

  it("C4 · die Fläche und die Route sprechen dieselbe Rechtematrix — am Draht gemessen", async () => {
    // BENs Korrekturpflicht 3, Serverhälfte: ein Experte bekommt am FREIGEGEBENEN Eintrag wirklich
    // 403 `PROPOSAL_REQUIRED`. Die Clienthälfte (kein Knopf, sondern ein Satz) misst
    // `uebernahme-folgt-dem-schreibrecht.test.tsx` an der gemounteten Fläche. Beide Hälften sind
    // nötig: ein Client, der sich richtig verhält, beweist nichts über die Route, und umgekehrt.
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-c4");
    const experte = await konto(app, admin, "wn-c4", "experte");

    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: experte,
      payload: { action: "revise", changes: { restoredFromVersion: 1 } },
    });
    expect(
      res.statusCode,
      `der Experte durfte einen freigegebenen Stand ersetzen: ${res.body}`,
    ).toBe(403);
    expect(res.json().error).toBe("PROPOSAL_REQUIRED");
    expect((await holen(app, admin, id)).version, "trotz 403 ist eine Fassung entstanden").toBe(2);
  });

  it("C3 · KALIBRIERUNG: dieselben Felder OHNE Herkunftsangabe gehen unverändert durch", async () => {
    // Sonst prüfte C2 nur, dass irgendetwas abgewiesen wird — die gewöhnliche Revision muss
    // Zeichen für Zeichen bleiben, wie sie war.
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-c3");
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "revise", changes: { statement: "Ganz normal überarbeitet." } },
    });
    expect(res.statusCode, res.body).toBe(200);
    const jetzt = await holen(app, admin, id);
    expect(jetzt.version).toBe(3);
    expect(jetzt.statement).toBe("Ganz normal überarbeitet.");
  });
});

describe("JOB 4213 · B — die gewöhnliche Überarbeitung bleibt, wie sie war", () => {
  it("ohne Herkunftsangabe trägt der Eintrag weiterhin „überarbeitet“ und KEINE Herkunft", async () => {
    const { app, admin, id } = await zweiFreigegebeneFassungen("wn-b1");
    const jetzt = await holen(app, admin, id);
    const eintrag = (
      jetzt.history as { version: number; note: string; restoredFrom?: number }[]
    ).find((h) => h.version === 2);
    expect(eintrag?.note).toBe("überarbeitet");
    expect(
      eintrag?.restoredFrom,
      "eine gewöhnliche Revision behauptet eine Herkunft",
    ).toBeUndefined();
  });
});
