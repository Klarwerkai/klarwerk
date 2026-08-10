// ================================================================================================
// G27 — DIE BIBLIOTHEK FINDET DEN GANZEN GESPEICHERTEN INHALT (und nur den erlaubten)
// ================================================================================================
//
// Gemessen am ECHTEN HTTP-Weg (GET /api/library/search), nicht am Dienst darunter: die Zusage
// gilt dem Menschen an der Oberfläche, und die Autorisierung fällt an der Route.
//
// Der Prüfbegriff steht bewusst ERST NACH ZEICHEN 500 des Dokumenttexts — genau dort, wo er vor
// G27 unauffindbar war (die Suche kannte nur Titel, Kurzfeld, Schlagwörter und Fußnoten).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const ZIELWORT = "Nachspannmoment";
const FUELLER = "Fuelltext ohne Aussagekraft zur Anlage. ";

// Ein Body, dessen Zielwort garantiert hinter Zeichen 500 steht.
function langerBody(zielwort: string): string {
  const fueller = FUELLER.repeat(30); // > 1.000 Zeichen
  return `<p>${fueller}</p><p>Das ${zielwort} betraegt 42 Nm.</p>`;
}

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

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@g27.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@g27.test", "geheim12345");
  for (const [email, role] of [
    ["autor@g27.test", "experte"],
    ["fremd@g27.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    services,
    admin,
    autor: await login(app, "autor@g27.test", "geheim12345"),
    fremd: await login(app, "fremd@g27.test", "geheim12345"),
  };
}

async function anlegen(app: App, headers: Auth, payload: Record<string, unknown>): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload });
  if (res.statusCode !== 201) {
    throw new Error(`Anlage fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return res.json().id as string;
}

async function suche(app: App, headers: Auth, q: string): Promise<{ ids: string[]; body: string }> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return { ids: (res.json() as { id: string }[]).map((t) => t.id), body: res.body };
}

describe("G27 · Bibliothek: der volle Dokumenttext ist auffindbar", () => {
  it("ein Begriff NUR im Dokumenttext (weit hinter Zeichen 500) wird gefunden", async () => {
    const { app, autor } = await setup();
    const id = await anlegen(app, autor, {
      title: "Flanschmontage",
      statement: "Kurzfassung ohne das Zielwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: langerBody(ZIELWORT),
    });
    // Kalibrierung: das Zielwort steht wirklich erst weit hinter der alten Kurzfeldgrenze.
    expect(langerBody(ZIELWORT).indexOf(ZIELWORT)).toBeGreaterThan(500);

    const treffer = await suche(app, autor, ZIELWORT);
    expect(treffer.ids).toEqual([id]);
    // Die Trefferliste transportiert weiterhin KEIN bodyHtml (WP-BILD-1f bleibt gültig).
    expect(treffer.body).not.toContain(FUELLER.trim());
  });

  it("Schlagwort und Bildunterschrift bleiben Teil desselben Suchvertrags", async () => {
    const { app, autor } = await setup();
    const mitTag = await anlegen(app, autor, {
      title: "Ohne Zielwort im Titel",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      tags: ["Sonderschlagwort"],
    });
    const mitFussnote = await anlegen(app, autor, {
      title: "Bildbeitrag",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml:
        '<figure><img src="/api/objects/x/raw"><figcaption>Sonderverschraubung am Pumpenkopf</figcaption></figure>',
    });
    expect((await suche(app, autor, "Sonderschlagwort")).ids).toEqual([mitTag]);
    expect((await suche(app, autor, "Sonderverschraubung")).ids).toEqual([mitFussnote]);
  });

  it("eine historische Fassung ist in der Standardsuche unsichtbar", async () => {
    const { app, autor } = await setup();
    const id = await anlegen(app, autor, {
      title: "Fassungswechsel",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: langerBody("Altfassungswort"),
    });
    expect((await suche(app, autor, "Altfassungswort")).ids).toEqual([id]);

    const revidiert = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "revise", changes: { bodyHtml: langerBody("Neufassungswort") } },
    });
    expect(revidiert.statusCode, revidiert.body).toBe(200);

    expect((await suche(app, autor, "Altfassungswort")).ids).toEqual([]);
    expect((await suche(app, autor, "Neufassungswort")).ids).toEqual([id]);
  });

  it("Script-/Style-Inhalt aus dem Body ist nicht suchbar", async () => {
    const { app, autor } = await setup();
    await anlegen(app, autor, {
      title: "Mit Beiwerk",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml:
        "<p>Sichtbarer Absatz</p><script>var x='Skriptgeheimwort';</script><style>.a{color:Stylegeheimwort}</style>",
    });
    expect((await suche(app, autor, "Skriptgeheimwort")).ids).toEqual([]);
    expect((await suche(app, autor, "Stylegeheimwort")).ids).toEqual([]);
    expect((await suche(app, autor, "Sichtbarer Absatz")).ids.length).toBe(1);
  });
});

describe("G27 · Bibliothek: der Volltext leakt nichts", () => {
  it("ein FREMDES vertrauliches Objekt erreicht über den Dokumenttext weder Treffer noch Zählwert", async () => {
    const { app, autor, fremd, admin } = await setup();
    const vertraulich = await anlegen(app, autor, {
      title: "Vertrauliche Kennlinie",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: langerBody(ZIELWORT),
    });
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${vertraulich}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    // Kalibrierung: der Autor selbst findet sein Objekt über den Dokumenttext …
    expect((await suche(app, autor, ZIELWORT)).ids).toContain(vertraulich);
    // … ein FREMDER Experte bekommt nichts: keinen Treffer, keinen Zählwert, keinen Textschnipsel.
    const fremdTreffer = await suche(app, fremd, ZIELWORT);
    expect(fremdTreffer.ids).toEqual([]);
    expect(fremdTreffer.body).not.toContain("Vertrauliche Kennlinie");
    expect(fremdTreffer.body).not.toContain(ZIELWORT);
    // … und `ko.validate` (hier: Admin) sieht es weiterhin — die Regel ist keine Totalsperre.
    expect((await suche(app, admin, ZIELWORT)).ids).toContain(vertraulich);
  });
});

describe("G27 · die Filter bleiben unangetastet", () => {
  it("Kategorie-Filter und Volltextsuche greifen gemeinsam (kein Filter wird umgangen)", async () => {
    const { app, autor } = await setup();
    const inWartung = await anlegen(app, autor, {
      title: "In Wartung",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: langerBody("Filterwort"),
    });
    await anlegen(app, autor, {
      title: "In Montage",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Montage",
      bodyHtml: langerBody("Filterwort"),
    });
    const alle = await suche(app, autor, "Filterwort");
    expect(alle.ids.length).toBe(2);

    const gefiltert = await app.inject({
      method: "GET",
      url: "/api/library/search?q=Filterwort&category=Wartung",
      headers: autor,
    });
    expect(gefiltert.statusCode, gefiltert.body).toBe(200);
    expect((gefiltert.json() as { id: string }[]).map((t) => t.id)).toEqual([inWartung]);
  });
});
