// ================================================================================================
// AUFTRAG-PRO-U2-Suchraum-Nachweis — DER SUCHRAUM DER BIBLIOTHEK, AM DRAHT GEMESSEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Die U2-Oberflaeche sagt seit BASIC-U2 an der Bibliothekssuche einen
// SUCHRAUM zu: durchsucht werde „das Klarwerk-Wissen, das fuer dich freigegeben ist". BENs Bericht
// (`_relay/ben/outbox/BERICHT-ben-basic-u2-suchraum.md`, Abschnitt 5) hat dazu genau eine Luecke
// benannt: die Mengenaussage sei nur gegen GEMOCKTE Suchergebnisse geprueft, nicht gegen die echte
// Route. Ein UI-Text ist kein Beleg fuer Serververhalten — diese Datei liefert den fehlenden Beleg.
//
// WAS HIER ABSICHTLICH *NICHT* STEHT, und warum das kein Loch ist:
//
//   · Die ENTWURFS-Mengen (Admin sieht alle, ein normaler Nutzer nur eigene, ein fremder Entwurf
//     ist nicht direkt lesbar) sind bereits am Draht belegt — `services/app/src/build-app.test.ts`
//     („Draft-Liste zeigt Admin alle Entwuerfe und normalen Nutzern nur eigene"). Ein zweiter Test
//     derselben Menge waere eine zweite Wahrheit ueber dieselbe Regel; die Entscheidungsstelle
//     (`visibleDraftsFor`/`canSeeDraft`, capture-routes.ts:23-31) hat schon ihren Test.
//   · Die VERNEINENDE Richtung an der Suche — ein Betrachter ohne Autorschaft und ohne
//     `ko.validate` findet Vertrauliches nicht, waehrend Internes weiter gefunden wird — ist
//     bereits in `tests/security/mega74-lesepfad-vertraulich.test.ts` belegt.
//
// ES FEHLTE GENAU DIE BEJAHENDE RICHTUNG AN DER SUCHE. `sichtbareFuer` (library-routes.ts:165)
// laesst drei Gruppen durch: jeden bei nicht vertraulichem Wissen, `ko.validate` immer, und den
// AUTOR seines eigenen vertraulichen Wissens (sichtbarkeit.ts:67-77). Bisher war am Suchweg nur
// gemessen, dass ein Unberechtigter nichts sieht. Eine Route, die Vertrauliches AUSNAHMSLOS
// verschweigt — auch vor Autor und Controller — haette den mega74-Test genauso bestanden und die
// U2-Zusage „was fuer dich freigegeben ist" trotzdem gebrochen. Diese Datei misst deshalb beide
// Richtungen an derselben Anfrage: dieselbe Suche, dieselbe Datenlage, verschiedene Menschen.
//
// KEINE PRODUKTAENDERUNG. Der Nachweis lief gegen den vorgefundenen Stand; es wurde keine Zeile
// Produktcode angefasst.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

// Die Titel sind die Messmarken. Bewusst unverwechselbar, damit ein Treffer nicht aus einem
// Nachbarobjekt stammen kann.
const VERTRAULICH_TITEL = "U2 Vertrauliche Ventilkennlinie";
const VERTRAULICH_KERN = "Sensible Kennlinie, die nur Berechtigte lesen duerfen.";
const INTERN_TITEL = "U2 Internes Ventilwissen";
const SUCHWORT = "Ventil";

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

// Dieselbe Vorrichtung wie in mega74: kein Demo-Seed, die Konten entstehen hier. Der erste
// registrierte Mensch wird Admin, danach legt der Admin die uebrigen Rollen direkt an.
async function setup() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@u2suchraum.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@u2suchraum.test", "geheim12345");

  for (const [email, role] of [
    ["viewer@u2suchraum.test", "viewer"],
    ["autor@u2suchraum.test", "experte"],
    ["fremd@u2suchraum.test", "experte"],
    ["controller@u2suchraum.test", "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }

  return {
    app,
    admin,
    viewer: await login(app, "viewer@u2suchraum.test", "geheim12345"),
    autor: await login(app, "autor@u2suchraum.test", "geheim12345"),
    fremd: await login(app, "fremd@u2suchraum.test", "geheim12345"),
    controller: await login(app, "controller@u2suchraum.test", "geheim12345"),
  };
}

// Zwei Objekte, EIN Autor, EIN Suchwort: das vertrauliche und das interne Wissen unterscheiden sich
// nur in der Stufe. Ohne diese Paarung liesse sich ein leeres Ergebnis nicht von einem
// durchgesetzten Schutz unterscheiden.
async function bestand(app: App, autor: Auth): Promise<{ vertraulich: string; intern: string }> {
  const vertraulichAngelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: VERTRAULICH_TITEL,
      statement: VERTRAULICH_KERN,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(vertraulichAngelegt.statusCode, vertraulichAngelegt.body).toBe(201);
  const vertraulich = vertraulichAngelegt.json().id as string;

  // Hochstufen ist fuer `ko.create` frei (SCRUM-509) — der Autor stuft sein eigenes Objekt hoch.
  const hoch = await app.inject({
    method: "PUT",
    url: `/api/kos/${vertraulich}`,
    headers: autor,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(hoch.statusCode, hoch.body).toBe(200);
  expect(hoch.json().confidentiality).toBe("vertraulich");

  const internAngelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: autor,
    payload: {
      title: INTERN_TITEL,
      statement: "Alltagswissen zum Ventil, das jeder sehen darf.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(internAngelegt.statusCode, internAngelegt.body).toBe(201);

  return { vertraulich, intern: internAngelegt.json().id as string };
}

// Die EINE Anfrage, die dieser Test misst: exakt der Weg, den die Bibliotheksseite geht.
async function suche(app: App, headers: Auth): Promise<{ ids: string[]; body: string }> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(SUCHWORT)}`,
    headers,
  });
  expect(res.statusCode, res.body).toBe(200);
  return { ids: (res.json() as { id: string }[]).map((treffer) => treffer.id), body: res.body };
}

describe("U2-Vertrag 3 · die Bibliothekssuche liefert genau den fuer den Menschen freigegebenen Suchraum", () => {
  it("AUTOR — findet sein EIGENES vertrauliches Wissen, obwohl seine Rolle kein ko.validate hat", async () => {
    const { app, autor } = await setup();
    const { vertraulich, intern } = await bestand(app, autor);

    const treffer = await suche(app, autor);

    expect(
      treffer.ids,
      "der Autor muss sein eigenes vertrauliches Wissen in der Suche finden (sichtbarkeit.ts:76)",
    ).toContain(vertraulich);
    // KALIBRIERUNG: die Suche liefert ueberhaupt etwas, und zwar das erwartete Paar.
    expect(treffer.ids).toContain(intern);
    expect(treffer.body).toContain(VERTRAULICH_KERN);

    await app.close();
  });

  it("ko.validate — Controller und Admin finden fremdes vertrauliches Wissen", async () => {
    const { app, admin, autor, controller } = await setup();
    const { vertraulich, intern } = await bestand(app, autor);

    for (const [wer, headers] of [
      ["Controller", controller],
      ["Admin", admin],
    ] as const) {
      const treffer = await suche(app, headers);
      expect(
        treffer.ids,
        `${wer} traegt ko.validate und muss das vertrauliche Wissen finden`,
      ).toContain(vertraulich);
      expect(treffer.ids, `${wer} muss auch das interne Wissen finden`).toContain(intern);
    }

    await app.close();
  });

  it("OHNE Recht und OHNE Autorschaft — Betrachter und fremder Experte finden nur das nicht vertrauliche Wissen", async () => {
    const { app, autor, fremd, viewer } = await setup();
    const { vertraulich, intern } = await bestand(app, autor);

    for (const [wer, headers] of [
      ["Betrachter", viewer],
      ["fremder Experte", fremd],
    ] as const) {
      const treffer = await suche(app, headers);
      expect(
        treffer.ids,
        `${wer} darf das vertrauliche Wissen NICHT in der Suche finden`,
      ).not.toContain(vertraulich);
      // Der Kerntext ist die zweite Probe: die Menge darf nicht nur die Kennung verschweigen.
      expect(treffer.body).not.toContain(VERTRAULICH_KERN);
      // KALIBRIERUNG: der Suchraum ist nicht einfach zu. Ohne diese Zeile bewiese der Test nur,
      // dass die Route nichts mehr herausgibt.
      expect(treffer.ids, `${wer} muss das interne Wissen weiterhin finden`).toContain(intern);
      expect(treffer.body).toContain(INTERN_TITEL);
    }

    await app.close();
  });

  it("DIE MENGE IST PERSONENBEZOGEN — dieselbe Anfrage, verschiedene Ergebnisse", async () => {
    const { app, autor, fremd } = await setup();
    const { vertraulich } = await bestand(app, autor);

    // Der Kern der U2-Zusage in einer Zeile: der Suchraum haengt am Menschen, nicht an der Anfrage.
    // Zwei Konten DERSELBEN Rolle (`experte`) bekommen auf dieselbe Suche verschiedene Mengen —
    // die Trennlinie ist die Autorschaft, nicht die Rolle.
    const desAutors = await suche(app, autor);
    const desFremden = await suche(app, fremd);

    expect(desAutors.ids).toContain(vertraulich);
    expect(desFremden.ids).not.toContain(vertraulich);
    expect(
      desAutors.ids.length,
      "der Autor sieht echt mehr als der fremde Experte derselben Rolle",
    ).toBeGreaterThan(desFremden.ids.length);

    await app.close();
  });
});
