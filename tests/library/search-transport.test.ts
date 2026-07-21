// WP-BILD-1f (bens P4, PFLICHT): die Such-Trefferliste transportiert KEINE Bilddaten zum Client.
// Ein KO mit megabyte-großem eingebettetem base64-Bild wird über seine Fußnote gefunden — aber die
// Antwort der Suchroute enthält weder das bodyHtml noch die Bilddaten; die Fußnoten reisen als
// kleines additives captionTexts-Feld mit. (Detailansichten laden ihr KO weiterhin einzeln voll.)
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const PAYLOAD_MARKER = "QURCQ0FCQ0Q"; // eindeutiges Fragment der Bilddaten
const BIG_SRC = `data:image/png;base64,${PAYLOAD_MARKER.repeat(200_000)}`; // > 2 Mio. Zeichen

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

describe("WP-BILD-1f P4: /api/library/search transportiert keine Bilddaten", () => {
  it("findet das KO über die Fußnote; Antwort ohne bodyHtml/Bilddaten, mit kleinem captionTexts", async () => {
    const services = buildServices();
    const app = buildApp(services);
    await services.ko.create({
      title: "Dosierpumpe warten",
      statement: "Regelmäßig entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: `<figure><img src="${BIG_SRC}"><figcaption data-image-id="kw-1">Verschraubung am Pumpenkopf</figcaption></figure>`,
    });
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "GET",
      url: "/api/library/search?q=Verschraubung",
      headers,
    });
    expect(res.statusCode).toBe(200);
    const hits = res.json() as Array<{
      title: string;
      bodyHtml?: unknown;
      captionTexts?: string[];
    }>;
    expect(hits.map((h) => h.title)).toEqual(["Dosierpumpe warten"]);
    // Die Fußnote reist als kleines Feld mit (Fundstellen-Kennzeichnung im Client) …
    expect(hits[0]?.captionTexts).toEqual(["Verschraubung am Pumpenkopf"]);
    // … das bodyHtml (mit den Bilddaten) reist NICHT mit.
    expect(hits[0]?.bodyHtml).toBeUndefined();
    expect(res.body).not.toContain(PAYLOAD_MARKER.repeat(3));
    // Grobe Transport-Schranke: die Antwort ist um Größenordnungen kleiner als die Bilddaten.
    expect(res.body.length).toBeLessThan(100_000);
  });
});
