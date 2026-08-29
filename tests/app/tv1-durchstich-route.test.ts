// ================================================================================================
// JOB 1504 · D1 — TV1: DER TITELVORSCHLAG ÜBERLEBT DIE ROUTE.
// ================================================================================================
//
// REICHWEITE, VORWEG UND OHNE BESCHÖNIGUNG: Dieser Test belegt, dass das Feld `titelVorschlag` den
// HTTP-Weg übersteht — Route, Serialisierung, Antwortkörper. Er belegt NICHT, dass ein Anwender
// einen Titelvorschlag sieht. Der Renderer existiert nicht (`apps/web/src/api/types.ts:1045`:
// „WAS DIE OBERFLÄCHE HEUTE DAMIT MACHT: nichts. Es gibt keinen Leser."), und er war in diesem
// Durchgang nicht geleast. Wer aus diesem grünen Test einen sichtbaren Nutzen liest, liest ihn
// falsch — genau dieser Fehlschluss hat JOB 508 D8 das PRODUKT-ROT eingetragen.
//
// WARUM ES DIESEN TEST BRAUCHT, OBWOHL JOB 1164 SCHON GRÜN IST: `tests/reasoner/job1164-wiretyp-
// dienstgrenze.test.ts` misst `describeImage` DIREKT und vergleicht beide Wiretypen im QUELLTEXT.
// Zwischen diesen beiden Belegen liegt eine ungemessene Strecke: die Route
// (`services/app/src/routes/reasoner-routes.ts:322-324`) und die JSON-Serialisierung. Ein
// deklariertes Feld und ein ausgeliefertes Feld sind nicht dasselbe.
//
// DIE KONKRETE GEFAHR, gemessen und nicht vermutet: Die describe-Route trägt HEUTE kein
// `response`-Schema (nachgemessen in diesem Durchgang: in `reasoner-routes.ts` kommt weder
// `schema:` noch `response:` noch `additionalProperties` vor). Fastify serialisiert deshalb das
// ganze Objekt. Bekommt die Route später eines — eine übliche Härtung —, verschwindet ein NICHT
// aufgeführtes verschachteltes Feld STILL. Kein Fehler, kein Log, nur ein Vorschlag, der nicht
// mehr ankommt. Dieser Test ist der Riegel davor: Er ist heute grün und wird an genau dem Tag rot,
// an dem das Feld die Serialisierung nicht mehr übersteht.
//
// DER NEGATIVFALL IST HIER DIE HÄLFTE DER ZUSAGE, nicht das Beiwerk. „Kein Vorschlag" muss auf dem
// Draht als ABWESENHEIT ankommen — nicht als `null`, nicht als leeres Objekt. Deshalb prüft dieser
// Test nicht nur den geparsten Körper, sondern auch den ROHEN Antworttext: Ein Schlüssel, der im
// JSON gar nicht vorkommt, kann von keinem künftigen Renderer für einen Vorschlag gehalten werden.
//
// DER VERTRAULICHKEITSFALL IST KEIN RANDFALL. Ein vertrauliches Bild geht bewusst nicht an die
// Cloud-Vision. Entstünde daraus über den Umweg eines Titels doch noch eine Aussage, wäre der
// Egress-Ausschluss inhaltlich unterlaufen (`services/reasoner/src/titel-vorschlag.ts:43-48`).
// JOB 1164 prüft das am Dienst; hier steht es am Draht — der Stelle, an der die Aussage das Haus
// verlassen würde.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ModelProvider, Reasoner } from "../../services/reasoner";

// Ein gültiges Mini-PNG: die Magic Bytes müssen echt sein, sonst weist die frühe Bildprüfung
// (bens P3) den Request mit 400 ab, bevor irgendein Titel entstehen könnte.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_URL = `data:image/png;base64,${Buffer.concat([PNG_MAGIC, Buffer.alloc(8)]).toString("base64")}`;

/** Ein Vision-Provider, der genau den übergebenen Text liefert. Kein Netz, kein Schlüssel. */
function visionMit(text: string): ModelProvider {
  return new ModelProvider({
    name: "anthropic:test",
    complete: async () => "",
    completeVision: async () => text,
  });
}

type TestServices = ReturnType<typeof buildServices>;

async function loginHeaders(app: ReturnType<typeof buildApp>): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Nutzer", email: "n@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

interface DescribeAntwort {
  status: number;
  /** Der geparste Körper — für die Aussage über Werte. */
  koerper: {
    text: string | null;
    demo: boolean;
    fallbackReason?: string;
    titelVorschlag?: unknown;
  };
  /** Der ROHE Antworttext — für die Aussage über An- und Abwesenheit des Schlüssels. */
  roh: string;
}

/**
 * Ein describe-Request über die ECHTE Route, mit einem gesetzten Vision-Provider oder ohne.
 *
 * Der Reasoner wird VOR `buildApp` ersetzt: die Routen bekommen die Instanz beim Bau
 * (`build-app.ts:1107`), ein späterer Tausch käme nicht mehr an.
 */
async function describeUeberRoute(
  vision: string | null,
  confidentiality: "intern" | "streng_vertraulich",
): Promise<DescribeAntwort> {
  const services: TestServices = buildServices();
  if (vision !== null) {
    services.reasoner = new Reasoner(visionMit(vision));
  }
  const app = buildApp(services);
  const headers = await loginHeaders(app);
  // JOB 2692 D2: `source:"draft"` braucht einen aufgelösten Anker — ohne `draftId`/`koId` gilt der
  // Aufruf serverseitig als vertraulich (kein Cloud-Vision, kein Titel). Dieser Test misst die
  // Serialisierung des Titelvorschlags, nicht den Anker; er bekommt deshalb den Entwurf, aus dem
  // das Bild stammt — mit derselben Stufe, die der Aufruf deklariert.
  const entwurf = await services.capture.createDraft(
    { title: "TV1", statement: "Bild aus dem Entwurf.", confidentiality },
    "u1",
  );
  const res = await app.inject({
    method: "POST",
    url: "/api/reasoner/describe",
    headers,
    payload: { dataUrl: PNG_URL, source: "draft", confidentiality, draftId: entwurf.id },
  });
  return {
    status: res.statusCode,
    koerper: res.json() as DescribeAntwort["koerper"],
    roh: res.payload,
  };
}

describe("JOB 1504 · TV1 — der Titelvorschlag kommt über die Route heraus", () => {
  it("POSITIV: das Feld übersteht Route und Serialisierung, mit Titel und Grund", async () => {
    const { status, koerper, roh } = await describeUeberRoute(
      "Ein Kegelradgetriebe. Daneben liegt ein Schlüssel.",
      "intern",
    );

    expect(status).toBe(200);
    // Der ERSTE Satz, ohne Schlusspunkt — die Ableitungsregel ist am Draht dieselbe wie im Dienst.
    // Käme hier der ganze Text an, wäre unterwegs eine andere Ableitung im Spiel als die geprüfte.
    expect(koerper.titelVorschlag).toEqual({ titel: "Ein Kegelradgetriebe", grund: "abgeleitet" });
    // Und derselbe Befund am ROHEN Text: das Feld ist wirklich serialisiert worden und nicht erst
    // beim Parsen entstanden.
    expect(roh).toContain("titelVorschlag");
  });

  it("NEGATIV ohne Modell: der Schlüssel taucht im JSON GAR NICHT auf", async () => {
    const { status, koerper, roh } = await describeUeberRoute(null, "intern");

    expect(status).toBe(200);
    // Die bestehende Ehrlichkeit: ohne Modell gibt es keinen Text, nur einen wahren Grund.
    expect(koerper.text).toBeNull();
    expect(koerper.fallbackReason).toBe("no-model");
    // Die schärfste Form der Zusage — der Schlüssel existiert nicht. `toBeUndefined()` allein wäre
    // auch bei `titelVorschlag: null` grün, und das wäre ein gesetztes Feld ohne Wert.
    expect("titelVorschlag" in koerper).toBe(false);
    expect(roh).not.toContain("titelVorschlag");
  });

  it("NEGATIV vertraulich: auch über den Draht entsteht keine Aussage über das Bild", async () => {
    // Cloud-Vision ist verdrahtet, der Beitrag ist streng vertraulich → die Cloud fällt aus der
    // Kette. Es gibt keinen Text, und es darf auch keinen Titel geben. Erschiene hier ein Feld,
    // wäre der Egress-Ausschluss inhaltlich unterlaufen.
    const { status, koerper, roh } = await describeUeberRoute(
      "Der Bauplan der Anlage XY-7.",
      "streng_vertraulich",
    );

    expect(status).toBe(200);
    expect(koerper.fallbackReason).toBe("confidential");
    expect("titelVorschlag" in koerper).toBe(false);
    expect(roh).not.toContain("titelVorschlag");
    // Der Bildinhalt selbst darf ebenso wenig auftauchen — weder als Text noch als Titel.
    expect(roh).not.toContain("XY-7");
  });
});
