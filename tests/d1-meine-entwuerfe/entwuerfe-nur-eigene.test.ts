// ================================================================================================
// JOB 3266 · D1 — DER POOL HINTER „MEINE ENTWÜRFE" IST DER EIGENE, UND ZWAR AM ECHTEN SERVER.
// ================================================================================================
//
// Lieferung 3 und 5 des Auftrags: Die Liste nutzt den VORHANDENEN Pool und den TATSÄCHLICHEN
// Rollen-/Eigentumsfilter, und „ein unberechtigter Nutzer sieht keinen fremden Titel".
//
// WARUM DIESE ZUSAGE NICHT IN DER OBERFLÄCHE GEMESSEN WIRD: Die Oberfläche zeigt, was
// `GET /api/drafts` ihr reicht — mehr kann sie nicht wissen und weniger soll sie nicht raten. Wer
// wen sieht, entscheidet der Server (`services/app/src/routes/capture-routes.ts`,
// `visibleDraftsFor` + die Vorfilterung `listByAuthor`). Ein Fall mit nachgestelltem Bestand
// könnte an dieser Stelle nur seine eigene Attrappe prüfen. Deshalb läuft dieser Fall gegen die
// ECHTE zusammengesetzte Anwendung (`buildApp`) mit zwei echten Konten.
//
// GEGENPROBE (im Bericht belegt): den Filter in `capture-routes.ts` entfernen → E1 wird rot.
import { describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

interface Kennung {
  id: string;
}

describe('JOB 3266 D1 · „Meine Entwürfe" zeigt nur die eigenen', () => {
  it("E1: die zweite Person sieht ihren eigenen Entwurf — und den fremden Titel nirgends", async () => {
    const app = buildApp(buildServices());
    await app.ready();

    // Das erste Konto ist die Administratorin (Hausregel der Registrierung).
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "pedi@job3266.test", password: "geheim12345" },
    });
    const adminAnmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi@job3266.test", password: "geheim12345" },
    });
    const adminKopf = {
      authorization: `Bearer ${(adminAnmeldung.json() as { token: string }).token}`,
    };

    const fremd = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: adminKopf,
      payload: {
        title: "NIT-Prüfplan Spritzzone",
        statement: "Nur für Pedi.",
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(fremd.statusCode).toBe(201);
    const fremdeKennung = (fremd.json() as Kennung).id;

    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminKopf,
      payload: {
        name: "Erik",
        email: "erik@job3266.test",
        password: "geheim12345",
        role: "experte",
      },
    });
    const erikAnmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "erik@job3266.test", password: "geheim12345" },
    });
    const erikKopf = {
      authorization: `Bearer ${(erikAnmeldung.json() as { token: string }).token}`,
    };

    const eigen = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: erikKopf,
      payload: {
        title: "Ventil bei Überdruck",
        statement: "Nur für Erik.",
        type: "best_practice",
        category: "Anlage 2",
      },
    });
    expect(eigen.statusCode).toBe(201);
    const eigeneKennung = (eigen.json() as Kennung).id;

    // DIE LISTE, die „Meine Entwürfe" füllt (`endpoints.drafts.list`).
    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers: erikKopf });
    expect(liste.statusCode).toBe(200);
    const roh = liste.body;
    const kennungen = (liste.json() as Kennung[]).map((d) => d.id);
    expect(kennungen, "die eigene Liste ist nicht die eigene Liste").toEqual([eigeneKennung]);
    expect(kennungen).not.toContain(fremdeKennung);
    // Und zwar nicht nur die Kennung: der fremde TITEL steht in keinem Byte der Antwort — er ist
    // das, was auf der Fläche stünde.
    expect(roh).not.toContain("NIT-Prüfplan Spritzzone");
    expect(roh).toContain("Ventil bei Überdruck");

    // Auch der direkte Griff auf den fremden Entwurf (der Weg, den ein Titel in der Liste geht)
    // bleibt zu — sonst wäre die Liste nur eine Sichtblende.
    const direkt = await app.inject({
      method: "GET",
      url: `/api/drafts/${fremdeKennung}`,
      headers: erikKopf,
    });
    expect(direkt.statusCode).toBe(403);

    await app.close();
  });
});
