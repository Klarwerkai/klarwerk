// ================================================================================================
// aufnahme:20260922:gesamt-leserechte · R-0543 — DIE ROLLENMATRIX DER AUFGENOMMENEN AUSGABEWEGE.
// ================================================================================================
//
// DER BEFUND (Ben, Nacharbeit 5): `POST /api/output/generate` und `POST /api/media/analyze` standen
// in der Rollenabnahme nur in der Restliste (`NICHT_ABGENOMMEN`) — „braucht eine Quellenauswahl"
// bzw. „braucht einen echten Anhang". Beides ist keine externe Voraussetzung, sondern Testbestand.
//
// HIER WIRD DIESER BESTAND HERGESTELLT, und zwar über die echten Produktwege: eine Autorin legt ein
// Wissensobjekt an, hängt ein selbst hochgeladenes Bild an, stuft es vertraulich ein; der Admin gibt
// es frei. Daneben ein internes, freigegebenes Objekt. Dann fährt JEDER der sechs Akteure — anonym,
// Gast (viewer), Autorin (experte), fremder Experte, Prüferin (controller), Admin — jede Tür, und
// das Ergebnis wird gegen die Lesepolicy (`darfSehen`) erwartet:
//
//   · anonym                              → 401 an jeder Tür
//   · internes Objekt                     → alle Angemeldeten erhalten den Inhalt
//   · vertrauliches Objekt, ohne Leserecht (Gast, fremder Experte)
//                                         → zeichengleich mit einer unbekannten Kennung
//   · vertrauliches Objekt, mit Leserecht (Autorin, Prüferin, Admin)
//                                         → die ehrliche Auskunft (Stufen-Sperre der Ausgabe bzw.
//                                           die Fachantwort der Medienanalyse), nie „gibt es nicht"
//
// Die Tür-Zeilen derselben Routen (Rechtetor je Rolle) stehen in `tests/beta-rollenabnahme/tabelle.ts`.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;
type Akteur = "anonym" | "gast" | "autorin" | "fremd" | "pruefer" | "admin";

const PASSWORT = "geheim12345";
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const GEHEIMER_TITEL = "Rollenmatrix Rezeptur nur fuer Pruefende";
const UNBEKANNT = "00000000-0000-4000-8000-000000000543";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${(res.json() as { token: string }).token}` };
}

async function erfolgreich(
  app: App,
  kopf: Kopf,
  method: "POST" | "PUT",
  url: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await app.inject({ method, url, headers: kopf, payload });
  if (res.statusCode >= 300) {
    throw new Error(`Vorbereitung ${method} ${url}: ${res.statusCode} ${res.body}`);
  }
  return res.body ? (res.json() as Record<string, unknown>) : {};
}

async function buehne() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@matrix0543.test", password: PASSWORT },
  });
  const admin = await anmelden(app, "admin@matrix0543.test");
  for (const [email, role] of [
    ["gast@matrix0543.test", "viewer"],
    ["autorin@matrix0543.test", "experte"],
    ["fremd@matrix0543.test", "experte"],
    ["pruefer@matrix0543.test", "controller"],
  ] as const) {
    await erfolgreich(app, admin, "POST", "/api/users", {
      name: email,
      email,
      password: PASSWORT,
      role,
    });
  }
  const kopf: Record<Akteur, Kopf> = {
    anonym: {},
    gast: await anmelden(app, "gast@matrix0543.test"),
    autorin: await anmelden(app, "autorin@matrix0543.test"),
    fremd: await anmelden(app, "fremd@matrix0543.test"),
    pruefer: await anmelden(app, "pruefer@matrix0543.test"),
    admin,
  };

  // Das vertrauliche Objekt der Autorin — mit einem selbst hochgeladenen, angehängten Bild.
  const bild = (await erfolgreich(app, kopf.autorin, "POST", "/api/objects", {
    name: "typenschild.png",
    mime: "image/png",
    data: PNG_DATA_URL,
    kind: "image",
    purpose: "attachment",
  })) as { id: string };
  const geheim = (await erfolgreich(app, kopf.autorin, "POST", "/api/kos", {
    confidentiality: "intern",
    title: GEHEIMER_TITEL,
    statement: "Kernaussage, die nur Prüfende lesen.",
    type: "best_practice",
    category: "Anlage 1",
  })) as { id: string };
  await erfolgreich(app, kopf.autorin, "PUT", `/api/kos/${geheim.id}`, {
    action: "attach",
    attachment: { name: "typenschild.png", mime: "image/png", objectId: bild.id },
  });
  await erfolgreich(app, kopf.autorin, "PUT", `/api/kos/${geheim.id}`, {
    action: "confidentiality",
    level: "vertraulich",
  });
  await erfolgreich(app, admin, "PUT", `/api/kos/${geheim.id}`, {
    action: "admin-validate",
    duplicateAcknowledged: true,
  });

  // Das interne, freigegebene Objekt.
  const offen = (await erfolgreich(app, kopf.autorin, "POST", "/api/kos", {
    confidentiality: "intern",
    title: "Rollenmatrix Ventilwartung Linie 5",
    statement: "Ventil vor dem Anlauf entlüften.",
    type: "best_practice",
    category: "Anlage 2",
  })) as { id: string };
  await erfolgreich(app, admin, "PUT", `/api/kos/${offen.id}`, {
    action: "admin-validate",
    duplicateAcknowledged: true,
  });

  return { app, kopf, geheimId: geheim.id, offenId: offen.id, bildId: bild.id };
}

const OHNE_LESERECHT: readonly Akteur[] = ["gast", "fremd"];
const MIT_LESERECHT: readonly Akteur[] = ["autorin", "pruefer", "admin"];
const ANGEMELDET: readonly Akteur[] = [...OHNE_LESERECHT, ...MIT_LESERECHT];

/** Die Antwort mit der Kennung durch einen Platzhalter ersetzt — damit vergleichbar mit `UNBEKANNT`. */
const ohne = (text: string, id: string): string => text.split(id).join("<KENNUNG>");

describe("R-0543 · Rollenmatrix der aufgenommenen Ausgabewege mit echtem Bestand", () => {
  it("POST /api/output/generate — sechs Akteure × internes und vertrauliches Objekt", async () => {
    const { app, kopf, geheimId, offenId } = await buehne();
    const erzeugen = (wer: Akteur, id: string) =>
      app.inject({
        method: "POST",
        url: "/api/output/generate",
        headers: kopf[wer],
        payload: { kind: "instruction", koIds: [id] },
      });

    expect((await erzeugen("anonym", offenId)).statusCode).toBe(401);
    expect((await erzeugen("anonym", geheimId)).statusCode).toBe(401);

    for (const wer of ANGEMELDET) {
      const res = await erzeugen(wer, offenId);
      expect(res.statusCode, `${wer} · intern: ${res.body}`).toBe(200);
      expect(res.body, wer).toContain("Rollenmatrix Ventilwartung Linie 5");
    }
    for (const wer of OHNE_LESERECHT) {
      const verborgen = await erzeugen(wer, geheimId);
      const unbekannt = await erzeugen(wer, UNBEKANNT);
      expect(verborgen.statusCode, wer).toBe(unbekannt.statusCode);
      expect(ohne(verborgen.body, geheimId), wer).toBe(ohne(unbekannt.body, UNBEKANNT));
      expect(verborgen.body, wer).not.toContain(GEHEIMER_TITEL);
    }
    for (const wer of MIT_LESERECHT) {
      const res = await erzeugen(wer, geheimId);
      expect((res.json() as { error?: string }).error, `${wer}: ${res.body}`).toBe("CONFIDENTIAL");
    }
    await app.close();
  });

  it("POST /api/media/analyze — sechs Akteure × Anhang des vertraulichen Objekts", async () => {
    const { app, kopf, bildId } = await buehne();
    const analysieren = (wer: Akteur, objectId: string) =>
      app.inject({
        method: "POST",
        url: "/api/media/analyze",
        headers: kopf[wer],
        payload: { objectId },
      });

    expect((await analysieren("anonym", bildId)).statusCode).toBe(401);

    for (const wer of OHNE_LESERECHT) {
      const verborgen = await analysieren(wer, bildId);
      const unbekannt = await analysieren(wer, UNBEKANNT);
      expect(verborgen.statusCode, wer).toBe(404);
      expect(verborgen.body, wer).toBe(unbekannt.body);
    }
    // Mit Leserecht kommt die Fachantwort des Dienstes — für ein Bild „keine Videoanalyse" — und
    // eben NICHT „gibt es nicht". Dieselbe Antwort für alle drei: die Rolle ändert nur, OB sie
    // kommt, nicht WAS kommt.
    const antworten = new Set<string>();
    for (const wer of MIT_LESERECHT) {
      const res = await analysieren(wer, bildId);
      expect(res.statusCode, `${wer}: ${res.body}`).not.toBe(404);
      expect([401, 403, 500], `${wer}: ${res.body}`).not.toContain(res.statusCode);
      antworten.add(`${res.statusCode} ${res.body}`);
    }
    expect(antworten.size).toBe(1);
    await app.close();
  });

  it("POST /api/ask (Sitzungszweig) — sechs Akteure: das interne Objekt ist Quelle, das vertrauliche nie", async () => {
    const { app, kopf, geheimId, offenId } = await buehne();
    const fragen = (wer: Akteur, question: string) =>
      app.inject({ method: "POST", url: "/api/ask", headers: kopf[wer], payload: { question } });

    expect((await fragen("anonym", "Ventil vor dem Anlauf entlüften")).statusCode).toBe(401);

    for (const wer of ANGEMELDET) {
      const offen = await fragen(wer, "Ventil vor dem Anlauf entlüften");
      expect(offen.statusCode, `${wer}: ${offen.body}`).toBe(200);
      const quellen = (offen.json() as { result?: { sources?: string[] } }).result?.sources ?? [];
      expect(quellen, `${wer}: ${offen.body.slice(0, 300)}`).toContain(offenId);

      // Die Frage trifft das vertrauliche Objekt, wiederholt aber nicht seinen Titel — eine
      // entstehende Wissenslücke trägt die FRAGE im Rumpf, und die darf hier nichts verfälschen.
      const geheim = await fragen(wer, "Welche Rezeptur gilt laut Rollenmatrix für Prüfende?");
      expect(geheim.statusCode, wer).toBe(200);
      const geheimQuellen =
        (geheim.json() as { result?: { sources?: string[] } }).result?.sources ?? [];
      // Vertrauliches ist NIE Grundlage einer Antwort (dropConfidential) — für keine Rolle.
      expect(geheimQuellen, wer).not.toContain(geheimId);
      if (OHNE_LESERECHT.includes(wer)) {
        // Wer es nicht sehen darf, erfährt auch über die Torlage („verschlossen") nichts davon.
        expect(geheim.body, wer).not.toContain(geheimId);
        expect(geheim.body, wer).not.toContain(GEHEIMER_TITEL);
      }
    }
    await app.close();
  });
});
