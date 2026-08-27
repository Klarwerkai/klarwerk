// ================================================================================================
// JOB 2395 · D1 — TV1: DER TITELVORSCHLAG ÜBERLEBT AUCH DIE CLIENT-STRECKE.
// ================================================================================================
//
// REICHWEITE, VORWEG UND OHNE BESCHÖNIGUNG: Dieser Test belegt, dass `titelVorschlag` vom
// HTTP-Antwortkörper bis in den Rückgabewert von `endpoints.reasoner.describeImage()` durchkommt —
// also über `apiFetch`, `JSON.parse` und die Endpunktschicht. Er belegt NICHT, dass ein Anwender
// einen Titelvorschlag sieht. Der Renderer ist Scheibe (b) und existiert nicht.
//
// WARUM ES DIESEN TEST BRAUCHT, OBWOHL `tv1-durchstich-route.test.ts` SCHON GRÜN IST: Jener misst
// die SERVER-Seite — Route und Serialisierung — und endet am Antwortkörper. Danach liegt eine
// ungemessene Strecke: `api.post` → `apiFetch` → `JSON.parse` → `endpoints.reasoner.describeImage`.
// Ein Feld im Antwortkörper und ein Feld im Rückgabewert des Clients sind nicht dasselbe.
//
// DIE KONKRETE GEFAHR, gemessen und nicht vermutet: `apiFetch` gibt HEUTE das geparste Objekt
// unverändert zurück (`apps/web/src/api/client.ts:42`, `return data as T`). Es gibt keine
// Feldauswahl. Genau deshalb kommt der Vorschlag an — und genau deshalb verschwände er STILL, wenn
// jemand später eine Auswahl einzöge, etwa zur Härtung oder beim Umbau auf ein Schema. Kein Fehler,
// kein Log, nur ein Vorschlag, der nicht mehr ankommt. Das ist DIESELBE Bauart wie serverseitig:
// dort trägt die describe-Route bis heute kein `response`-Schema, und der Riegel dagegen ist
// `tv1-durchstich-route.test.ts`. Dieser Test hier ist der Riegel für die zweite Hälfte des Wegs.
//
// DER NEGATIVFALL IST DIE HÄLFTE DER ZUSAGE. „Kein Vorschlag" muss beim Client als ABWESENHEIT
// ankommen — nicht als `null`, nicht als leeres Objekt. Ein Schlüssel, den es nicht gibt, kann von
// keinem künftigen Renderer für einen Vorschlag gehalten werden. Der Server setzt das Feld
// ausschließlich im Erfolgsfall (`services/reasoner/src/service.ts`, `mitTitelVorschlag`).
//
// UND EIN DRITTER FALL, DER MEHR PRÜFT ALS DEN NAMEN: Der Client darf keine WEISSE LISTE führen.
// Prüfte man nur, dass `titelVorschlag` ankommt, wäre auch eine Auswahl grün, die genau dieses eine
// Feld kennt und jedes künftige verliert. Der dritte Fall schickt deshalb ein Feld mit, das der
// Client gar nicht kennen kann — kommt es an, ist die Strecke wirklich durchlässig und nicht nur
// zufällig für den heutigen Namen eingerichtet.
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { DescribeImageResult } from "../../apps/web/src/api/types";

/** Ein `fetch`, das genau diesen Körper als 200 zurückgibt — kein Netz, kein Server. */
function serverAntwortetMit(koerper: Record<string, unknown>): void {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify(koerper), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

/** Der eine Client-Aufruf, den auch `ImageDescribeContext` macht (dort: `describe`). */
function describeUeberClient(): Promise<DescribeImageResult> {
  return endpoints.reasoner.describeImage("data:image/png;base64,AAAA", "de", {
    source: "draft",
    confidentiality: "intern",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 2395 · TV1 — der Titelvorschlag kommt beim Client an", () => {
  it("POSITIV: das Feld übersteht apiFetch und JSON.parse, mit Titel und Grund", async () => {
    serverAntwortetMit({
      text: "Ein Kegelradgetriebe. Daneben liegt ein Schlüssel.",
      demo: false,
      titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
    });

    const ergebnis = await describeUeberClient();

    expect(ergebnis.titelVorschlag).toEqual({
      titel: "Ein Kegelradgetriebe",
      grund: "abgeleitet",
    });
  });

  it("NEGATIV: fehlt das Feld auf dem Draht, fehlt es auch beim Client — nicht `null`", async () => {
    // Die schärfste Form der Zusage. `toBeUndefined()` allein wäre auch bei
    // `titelVorschlag: null` grün, und das wäre ein gesetztes Feld ohne Wert — genau die
    // Unterscheidung, die ein Renderer nie treffen müssen soll.
    serverAntwortetMit({ text: null, demo: false, fallbackReason: "no-model" });

    const ergebnis = await describeUeberClient();

    expect(ergebnis.fallbackReason).toBe("no-model");
    expect("titelVorschlag" in ergebnis).toBe(false);
  });

  it("DURCHLÄSSIG, nicht weiße Liste: auch ein dem Client unbekanntes Feld kommt an", async () => {
    // Ohne diesen Fall belegte der positive Fall nur, dass DIESER EINE Name durchkommt. Eine
    // Feldauswahl, die `titelVorschlag` kennt und alles Künftige verliert, wäre dann grün.
    serverAntwortetMit({
      text: "Ein Kegelradgetriebe.",
      demo: false,
      titelVorschlag: { titel: "Ein Kegelradgetriebe", grund: "abgeleitet" },
      einFeldDasDerClientNichtKennt: "kommt es an, ist die Strecke wirklich durchlaessig",
    });

    const ergebnis = (await describeUeberClient()) as DescribeImageResult & Record<string, unknown>;

    expect(ergebnis.titelVorschlag).toBeDefined();
    expect(
      ergebnis.einFeldDasDerClientNichtKennt,
      "der Client darf keine Feldauswahl fuehren — sonst verliert er jedes kuenftige Feld still",
    ).toBe("kommt es an, ist die Strecke wirklich durchlaessig");
  });
});
