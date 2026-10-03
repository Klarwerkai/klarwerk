// ================================================================================================
// R-0658 · PERSONALNUMMERN UND KONTODATEN LANDEN NICHT IM DURCHSUCHBAREN BESTAND.
// ================================================================================================
//
// BEN-Befund K4 zu Kandidat 27c4a92d: „Automatische Gegenprobe für Schutzdatenerkennung, Warnung
// und Ausschluss aus der Suche durch Quarantäne fehlt." Gemessen wird der ECHTE Weg, kein
// Regex-Test: `buildServices`/`buildApp` (die Suchprojektion ist dort in Betrieb), Anlage über
// `POST /api/kos`, Suche über `GET /api/library/search`.
//
//   S1/S2 · Personalnummer bzw. IBAN im Text → die 201-Antwort trägt die Warnung
//           (`schutzdatenQuarantaene` mit der ART, nie dem Wert); der Fall bleibt in Quarantäne
//           und erscheint weder über seine eindeutige Textmarke noch über die Schutzdaten in der
//           Bibliothekssuche, auch nicht in der Bestandsliste.
//   S3    · POSITIVER GEGENFALL: dasselbe Dokument ohne Schutzdaten ist über seine Marke auffindbar.
//   S4    · GEGENPROBE: eine IBAN-ähnliche Folge mit FALSCHER Prüfziffer ist keine Kontoangabe.
//   S5    · die Suchprojektion des Falls trägt keinen Text — die Daten sind nicht im Suchbestand.
//   S6    · eine Überarbeitung, die die Schutzdaten entfernt, hebt die Quarantäne auf.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const IBAN = "DE89 3704 0044 0532 0130 00";
const IBAN_FALSCH = "DE00 3704 0044 0532 0130 00";

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "r0658@example.test", password: "geheim-r0658" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "r0658@example.test", password: "geheim-r0658" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  return { services, app, headers };
}
type Aufbau = Awaited<ReturnType<typeof aufbau>>;

interface Angelegt {
  id: string;
  schutzdatenQuarantaene?: { arten: string[]; seit: string };
}

async function anlegen(a: Aufbau, titel: string, aussage: string): Promise<Angelegt> {
  const res = await a.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: a.headers,
    payload: {
      title: titel,
      statement: aussage,
      type: "best_practice",
      category: "Personal",
      confidentiality: "intern",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as Angelegt;
}

async function suche(a: Aufbau, q: string): Promise<string[]> {
  const res = await a.app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers: a.headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { id: string }[]).map((k) => k.id);
}

describe("R-0658 · Schutzdaten: Warnung, Quarantäne, kein Treffer in der Suche", () => {
  it("S1 · Personalnummer: Warnung in der Antwort, kein Treffer über Marke oder Nummer", async () => {
    const a = await aufbau();
    const ko = await anlegen(
      a,
      "Lohnabrechnung Quarantaenewortalpha",
      "Für die Abrechnung gilt Personalnummer: 12345678 laut Stammblatt.",
    );
    expect(ko.schutzdatenQuarantaene?.arten).toEqual(["personalnummer"]);
    // Die Warnung nennt die ART — der Wert steht nicht in der Marke.
    expect(JSON.stringify(ko.schutzdatenQuarantaene)).not.toContain("12345678");
    expect(await suche(a, "Quarantaenewortalpha")).not.toContain(ko.id);
    expect(await suche(a, "12345678")).not.toContain(ko.id);
    expect(await suche(a, "")).not.toContain(ko.id);
    // Der Fall ist nicht verloren: er liegt gespeichert und weiter in Quarantäne.
    const gelesen = await a.app.inject({
      method: "GET",
      url: `/api/kos/${ko.id}`,
      headers: a.headers,
    });
    expect(gelesen.statusCode).toBe(200);
    const marke = (gelesen.json() as Angelegt).schutzdatenQuarantaene;
    expect(marke?.arten).toEqual(["personalnummer"]);
  });

  it("S2 · Kontodaten (IBAN): Warnung, kein Treffer über Marke oder Kontonummer", async () => {
    const a = await aufbau();
    const ko = await anlegen(
      a,
      "Erstattung Quarantaenewortbeta",
      `Die Erstattung geht auf IBAN: ${IBAN} der Mitarbeiterin.`,
    );
    expect(ko.schutzdatenQuarantaene?.arten).toEqual(["kontodaten"]);
    expect(JSON.stringify(ko.schutzdatenQuarantaene)).not.toContain("3704");
    expect(await suche(a, "Quarantaenewortbeta")).not.toContain(ko.id);
    expect(await suche(a, "DE89")).not.toContain(ko.id);
    expect(await suche(a, "0532")).not.toContain(ko.id);
    expect(await suche(a, "")).not.toContain(ko.id);
  });

  it("S3 · POSITIVER GEGENFALL: dasselbe Dokument ohne Schutzdaten ist auffindbar", async () => {
    const a = await aufbau();
    const ko = await anlegen(
      a,
      "Erstattung Sauberwortgamma",
      "Die Erstattung geht auf das hinterlegte Konto der Mitarbeiterin.",
    );
    expect(ko.schutzdatenQuarantaene).toBeUndefined();
    expect(await suche(a, "Sauberwortgamma")).toContain(ko.id);
    expect(await suche(a, "")).toContain(ko.id);
  });

  it("S4 · GEGENPROBE: eine IBAN-Folge mit falscher Prüfziffer löst keine Quarantäne aus", async () => {
    const a = await aufbau();
    const ko = await anlegen(
      a,
      "Beispiel Sauberwortdelta",
      `Ein Schulungsbeispiel mit der ungültigen Folge ${IBAN_FALSCH}.`,
    );
    expect(ko.schutzdatenQuarantaene).toBeUndefined();
    expect(await suche(a, "Sauberwortdelta")).toContain(ko.id);
  });

  it("S5 · die Suchprojektion des Falls trägt keinen Text — weder Marke noch Schutzdaten", async () => {
    const a = await aufbau();
    const ko = await anlegen(
      a,
      "Lohnabrechnung Quarantaenewortepsilon",
      `Personalnummer: 87654321, IBAN: ${IBAN}.`,
    );
    expect(ko.schutzdatenQuarantaene?.arten).toEqual(["personalnummer", "kontodaten"]);
    const projektion = await a.services.ko.searchProjectionOf(ko.id);
    expect(projektion, "die Projektionszeile entsteht weiter").toBeDefined();
    expect(projektion?.searchText).toBe("");
    expect(JSON.stringify(projektion)).not.toContain("87654321");
    expect(JSON.stringify(projektion)).not.toContain("Quarantaenewortepsilon");
  });

  it("S6 · eine Überarbeitung ohne Schutzdaten hebt die Quarantäne auf — dann ist es auffindbar", async () => {
    const a = await aufbau();
    const ko = await anlegen(
      a,
      "Lohnabrechnung Quarantaenewortzeta",
      "Für die Abrechnung gilt Personalnummer: 12345678 laut Stammblatt.",
    );
    expect(await suche(a, "Quarantaenewortzeta")).not.toContain(ko.id);
    const revidiert = await a.services.ko.revise(
      ko.id,
      { statement: "Für die Abrechnung gilt das Stammblatt der Personalabteilung." },
      "pedi",
    );
    expect(revidiert.schutzdatenQuarantaene).toBeUndefined();
    expect(await suche(a, "Quarantaenewortzeta")).toContain(ko.id);
  });

  // BEN, Nacharbeit 5: der DRITTE Schreibrand — die Dokumentübernahme (`appendDocumentExtract`)
  // schrieb neuen Inhalt und eine neue Suchprojektion, ohne die Schutzdaten zu prüfen.
  it("S7 · Dokumentübernahme mit Personalnummer: Befund, leere Projektion, kein Treffer — sauber übernommen wieder auffindbar", async () => {
    const a = await aufbau();
    const ko = await anlegen(
      a,
      "Lohnabrechnung Quarantaenewortomega",
      "Für die Abrechnung gilt das Stammblatt der Personalabteilung.",
    );
    expect(ko.schutzdatenQuarantaene).toBeUndefined();
    expect(await suche(a, "Quarantaenewortomega"), "Vorbedingung: sauber auffindbar").toContain(
      ko.id,
    );

    const uebernahme = (operationId: string, bodyHtml: string) =>
      a.services.ko.appendDocumentExtract(ko.id, "pedi", {
        operationId,
        anchor: { objectId: `anker-${operationId}`, name: "Stammblatt.docx", mime: "text/plain" },
        sources: [{ label: "Stammblatt, Abschnitt 2", excerpt: "Abrechnungsgrundlage" }],
        changes: { bodyHtml },
      });

    const mitSchutzdaten = await uebernahme(
      "s7-mit",
      "<p>Für die Abrechnung gilt Personalnummer: 12345678 laut Stammblatt.</p>",
    );
    expect(mitSchutzdaten.ko.schutzdatenQuarantaene?.arten).toEqual(["personalnummer"]);
    expect((await a.services.ko.get(ko.id))?.schutzdatenQuarantaene?.arten).toEqual([
      "personalnummer",
    ]);
    const projektion = await a.services.ko.searchProjectionOf(ko.id);
    expect(projektion?.searchText).toBe("");
    expect(JSON.stringify(projektion)).not.toContain("12345678");
    expect(await suche(a, "Quarantaenewortomega")).not.toContain(ko.id);
    expect(await suche(a, "12345678")).not.toContain(ko.id);
    expect(await suche(a, "")).not.toContain(ko.id);

    // Über DENSELBEN Produktweg sauberen Inhalt übernehmen: die Quarantäne fällt, die Suche kehrt zurück.
    const sauber = await uebernahme(
      "s7-sauber",
      "<p>Für die Abrechnung gilt das Stammblatt der Personalabteilung.</p>",
    );
    expect(sauber.ko.schutzdatenQuarantaene).toBeUndefined();
    expect(await suche(a, "Quarantaenewortomega")).toContain(ko.id);
    expect(await suche(a, "")).toContain(ko.id);
  });
});
