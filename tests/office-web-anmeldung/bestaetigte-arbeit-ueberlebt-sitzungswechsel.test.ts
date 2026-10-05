// ================================================================================================
// AUFNAHME m365-anmeldung · BESTÄTIGTE ARBEIT ÜBERLEBT ABMELDEN, SITZUNGSENDE UND KONTOWECHSEL
// ================================================================================================
//
// DER BEFUND (Ben, Runde 1): `ABNAHME-M365.md` sagte, ein bestätigter Entwurf bleibe über Abmelden,
// Sitzungsablauf und Kontowechsel erhalten — `kontowechsel-am-draht.test.ts` maß aber nur Widerruf
// und Identität, legte keine Arbeit an und las keine zurück.
//
// DIESER FALL FÄHRT DEN WEG DES SEITENFENSTERS IN WORD FÜR DAS WEB AM VOLLEN APP-AUFBAU
// (`buildApp(buildServices())`, im Speicher, echte Routen) — jeder Arbeitsschritt NUR mit dem
// übergebenen Schlüssel, nie mit Cookie:
//   1. Anna meldet sich im Dialog an (Cookie) → Übergabecode → Einlösen → Schlüssel.
//   2. Mit dem Schlüssel legt sie einen Entwurf an: 201 = „Entwurf angelegt" (bestätigte Arbeit).
//   3. SITZUNGSENDE VON AUSSEN: die Verwaltung setzt Annas Kennwort zurück — das beendet ihre
//      Sitzungen. Der Schlüssel ist tot (401); der Entwurf ist unberührt.
//   4. KONTOWECHSEL: Boris meldet sich im Dialog an und bekommt einen eigenen Schlüssel. Er sieht
//      Annas Entwurf NICHT; sein eigenes Abmelden beendet nur seine Sitzung.
//   5. WIEDERANMELDUNG: Anna meldet sich neu an, wieder über die Übergabe — ihr Entwurf ist
//      unverändert da (Titel, Aussage, Autorin, Kennung, Änderungszeit — die ganze Antwort).
//   6. ABMELDEN mit dem Schlüssel, erneute Anmeldung: der Entwurf ist immer noch da.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

const KENNWORT = "secret123";

function cookieKopf(gesetzt: string | string[] | undefined): string {
  const liste = Array.isArray(gesetzt) ? gesetzt : gesetzt ? [gesetzt] : [];
  const sitzung = liste.find((c) => c.startsWith("kw_session=")) ?? "";
  const erstes = sitzung.split(";")[0] ?? "";
  expect(erstes, "die Anmeldung hat kein Sitzungscookie gesetzt").toMatch(/^kw_session=.+/);
  return erstes;
}

/** Dialog (Cookie) → Übergabecode → Einlösen ohne Cookie → Schlüssel des Seitenfensters. */
async function anmeldenUeberDialog(app: App, email: string, kennwort = KENNWORT): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: kennwort },
  });
  expect(login.statusCode, `Anmeldung ${email}`).toBe(200);
  const cookie = cookieKopf(login.headers["set-cookie"]);
  const code = await app.inject({
    method: "POST",
    url: "/api/auth/office-handover",
    headers: { cookie },
  });
  expect(code.statusCode, code.body).toBe(201);
  const eingeloest = await app.inject({
    method: "POST",
    url: "/api/auth/office-handover/redeem",
    payload: { code: code.json().code },
  });
  expect(eingeloest.statusCode, eingeloest.body).toBe(200);
  return eingeloest.json().token as string;
}

function mit(schluessel: string): Record<string, string> {
  return { authorization: `Bearer ${schluessel}` };
}

interface Entwurf {
  id: string;
  payload: { title?: string; statement?: string };
  originalAuthor: string;
  updatedAt: string;
}

async function leseEntwurf(app: App, schluessel: string, id: string): Promise<Entwurf> {
  const res = await app.inject({
    method: "GET",
    url: `/api/drafts/${id}`,
    headers: mit(schluessel),
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Entwurf;
}

async function aufbau(): Promise<{ app: App; adminSchluessel: string }> {
  const app = buildApp(buildServices());
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Verwaltung", email: "chefin@x.de", password: KENNWORT },
  });
  expect(erst.statusCode, erst.body).toBeLessThan(300);
  const adminSchluessel = await anmeldenUeberDialog(app, "chefin@x.de");
  for (const [name, email] of [
    ["Anna", "anna@x.de"],
    ["Boris", "boris@x.de"],
  ]) {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: mit(adminSchluessel),
      payload: { name, email, password: KENNWORT, role: "experte" },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
  }
  return { app, adminSchluessel };
}

describe("Aufnahme m365-anmeldung · bestätigte Arbeit überlebt jeden Sitzungswechsel", () => {
  it("Sitzungsende, Kontowechsel, Wiederanmeldung und Abmelden lassen den Entwurf unverändert", async () => {
    const { app, adminSchluessel } = await aufbau();

    // 1.–2. Anna arbeitet in Word und bekommt „Entwurf angelegt".
    const anna1 = await anmeldenUeberDialog(app, "anna@x.de");
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: mit(anna1),
      payload: { title: "Aus Word", statement: "Markierter Absatz aus dem Dokument." },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const bestaetigt = angelegt.json() as Entwurf;
    const vorher = await leseEntwurf(app, anna1, bestaetigt.id);
    expect(vorher.payload.title).toBe("Aus Word");
    expect(vorher.payload.statement).toBe("Markierter Absatz aus dem Dokument.");

    // 3. Sitzungsende von aussen: Kennwort-Reset durch die Verwaltung beendet Annas Sitzungen.
    const annaId = vorher.originalAuthor;
    const reset = await app.inject({
      method: "POST",
      url: `/api/auth/users/${annaId}/reset`,
      headers: mit(adminSchluessel),
      payload: { password: "neu-secret456" },
    });
    expect(reset.statusCode, reset.body).toBeLessThan(300);
    const tot = await app.inject({ method: "GET", url: "/api/auth/me", headers: mit(anna1) });
    expect(tot.statusCode, "der alte Schlüssel trägt nach dem Sitzungsende nicht mehr").toBe(401);

    // 4. Kontowechsel: Boris im selben Seitenfenster.
    const boris = await anmeldenUeberDialog(app, "boris@x.de");
    const borisListe = await app.inject({ method: "GET", url: "/api/drafts", headers: mit(boris) });
    expect(borisListe.statusCode).toBe(200);
    expect((borisListe.json() as Entwurf[]).map((d) => d.id)).not.toContain(bestaetigt.id);
    const borisAb = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: mit(boris),
    });
    expect(borisAb.statusCode).toBe(204);

    // 5. Wiederanmeldung: Annas Entwurf ist unverändert da.
    const anna2 = await anmeldenUeberDialog(app, "anna@x.de", "neu-secret456");
    expect(anna2).not.toBe(anna1);
    const nachWechsel = await leseEntwurf(app, anna2, bestaetigt.id);
    expect(nachWechsel).toEqual(vorher);

    // 6. Abmelden mit dem Schlüssel und erneut anmelden: immer noch unverändert.
    const ab = await app.inject({ method: "POST", url: "/api/auth/logout", headers: mit(anna2) });
    expect(ab.statusCode).toBe(204);
    const anna3 = await anmeldenUeberDialog(app, "anna@x.de", "neu-secret456");
    expect(await leseEntwurf(app, anna3, bestaetigt.id)).toEqual(vorher);
    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers: mit(anna3) });
    expect((liste.json() as Entwurf[]).map((d) => d.id)).toContain(bestaetigt.id);
  });
});
