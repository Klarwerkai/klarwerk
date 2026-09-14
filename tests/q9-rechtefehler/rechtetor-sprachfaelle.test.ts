// ================================================================================================
// JOB 3792 · Q9-RECHTEFEHLER — DER 403-SATZ DES RECHTETORS AM ECHTEN DRAHT, IN DREI SPRACHEN.
// ================================================================================================
//
// DIE LAGE, DIE DIESE DATEI BEENDET. `services/app/src/http.ts` trug den einen Satz, den jeder
// bekommt, dem ein Recht fehlt, als deutsches Literal im Code: `Recht fehlt: ${permission}`. Die
// beiden Nachbarn derselben Datei (500 INTERNAL, 401 NOT_SIGNED_IN) sind seit JOB 3568 übersetzt;
// diese eine Stelle blieb liegen, weil der Satz einen dynamischen Rechtenamen trägt und der
// Meldungskatalog keine Einsetzstelle kannte. Wer die Oberfläche auf Englisch stellt und irgendwo
// im Produkt an ein Rechtetor läuft, las bis hierher einen deutschen Satz.
//
// GEPRÜFT WIRD AM DRAHT, NICHT AM DIFF (Bauart: `tests/q9-serverfehlertexte/server.test.ts`): eine
// echte App aus `buildApp(buildServices())`, echte Konten über die echten Routen angelegt, echte
// Anmeldung, `app.inject` mit echtem `accept-language`-Kopf — und die Antwort so gelesen, wie der
// Browser sie bekommt. Dass `meldung(...)` im Quelltext steht, ist kein Nutzen; dass drei Sprachen
// aus einer echten 403 kommen, ist einer.
//
// DREI ZUSAGEN, DIE KEINE DIE ANDERE ERSETZT:
//   Q1/Q2  EN und NL: der Satz steht in der Sprache des Kopfes da — WÖRTLICH gepinnt (ein falsch
//          übersetztes Katalogfeld fällt auf) UND gegen den Katalog gehalten (ein zweites Literal
//          im Code fällt auf). Beide Vergleiche in einem Fall, weil sie zwei verschiedene Fehler
//          fangen.
//   Q3     DE: zeichengleich zu vor diesem Auftrag, samt Fehlercode und Status. Das ist der
//          Wächter gegen die eigene Ablösung — fünf Bestandstests pinnen denselben Satz.
//   Q4     Der Rechtename wird wirklich EINGESETZT und steht nicht fest im Satz: dasselbe Tor,
//          ein anderes Recht (`ko.create` statt `users.manage`), in allen drei Sprachen.
//
// WARUM ZWEI VERSCHIEDENE RECHTE UND ZWEI VERSCHIEDENE ROUTEN. Ein einziges Recht liesse die
// naheliegendste Halbheit durch: einen Katalogsatz, der `users.manage` fest eingebacken hat. Erst
// der zweite Rechtename an einer zweiten Route belegt die Einsetzstelle am echten Draht.
//
// DIE RECHTEMATRIX, GELESEN statt angenommen (`services/rbac/src/policy.ts:13-18`):
//     viewer  -> ["ko.read"]                 ohne ko.create, ohne users.manage
//     experte -> ["ko.read", "ko.create"]    ohne users.manage
//     admin   -> alles
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MELDUNGEN, meldung } from "../../services/auth/src/meldungen";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };
type Koerper = { error?: unknown; message?: unknown };

const PASSWORT = "geheim12345";

/**
 * Die Einsetzung, ein zweites Mal und bewusst NICHT aus dem Produkt geholt. Würde der Fall die
 * Einsetzstelle von `meldung()` benutzen, um seine Erwartung zu bauen, wäre er gegen jeden Fehler
 * IN dieser Einsetzstelle blind: beide Seiten des Vergleichs kämen aus derselben Quelle.
 */
function einsetzen(vorlage: string, wert: string): string {
  return vorlage.split("%s").join(wert);
}

let app: App;
let ohneVerwaltung: Kopf;
let nurLesen: Kopf;

async function anmelden(email: string): Promise<Kopf> {
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

beforeAll(async () => {
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@q9recht.test", password: PASSWORT },
  });
  const admin = await anmelden("admin@q9recht.test");
  for (const [email, role] of [
    ["experte@q9recht.test", "experte"],
    ["viewer@q9recht.test", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: PASSWORT, role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} (${role}) nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  ohneVerwaltung = await anmelden("experte@q9recht.test");
  nurLesen = await anmelden("viewer@q9recht.test");
});

afterAll(async () => {
  await app?.close();
});

/**
 * `PUT /api/external/policy` verlangt `users.manage` (`external-routes.ts:42`). Die Expertin hat es
 * nicht — das Rechtetor aus `http.ts` antwortet, bevor der Handler irgendetwas tut.
 */
async function verwaltungsversuch(sprache?: string): Promise<{ status: number; koerper: Koerper }> {
  const res = await app.inject({
    method: "PUT",
    url: "/api/external/policy",
    headers: { ...ohneVerwaltung, ...(sprache ? { "accept-language": sprache } : {}) },
    payload: { stage: "internal_only" },
  });
  return { status: res.statusCode, koerper: res.json() as Koerper };
}

/** `GET /api/drafts` verlangt `ko.create` (`capture-routes.ts:838`). Die Betrachterin hat es nicht. */
async function entwurfsversuch(sprache?: string): Promise<{ status: number; koerper: Koerper }> {
  const res = await app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { ...nurLesen, ...(sprache ? { "accept-language": sprache } : {}) },
  });
  return { status: res.statusCode, koerper: res.json() as Koerper };
}

describe("Q1 · das Rechtetor antwortet in der Sprache des Kopfes", () => {
  it("Q1 EN · 403 FORBIDDEN mit englischem Satz und dem fehlenden Recht", async () => {
    const antwort = await verwaltungsversuch("en");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    // WÖRTLICH: ein deutscher oder schiefer Satz im `en`-Feld des Katalogs fällt hier auf.
    expect(antwort.koerper.message).toBe("Missing permission: users.manage");
    // AUS DEM KATALOG: derselbe Satz, aus der Quelle geholt statt abgeschrieben — ein zweites
    // Literal im Code oder eine übergangene Einsetzstelle fällt hier auf.
    expect(antwort.koerper.message).toBe(
      einsetzen(MELDUNGEN.PERMISSION_MISSING.en, "users.manage"),
    );
    // Kein deutsches Erkennungswort ist übrig geblieben.
    expect(String(antwort.koerper.message)).not.toMatch(/Recht fehlt|Berechtigung/);
  });

  it("Q2 NL · 403 FORBIDDEN mit niederländischem Satz und dem fehlenden Recht", async () => {
    const antwort = await verwaltungsversuch("nl");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    expect(antwort.koerper.message).toBe("Ontbrekend recht: users.manage");
    expect(antwort.koerper.message).toBe(
      einsetzen(MELDUNGEN.PERMISSION_MISSING.nl, "users.manage"),
    );
    expect(String(antwort.koerper.message)).not.toMatch(/Recht fehlt|Berechtigung/);
  });

  it("Q1b EN · der zusammengesetzte Sprachkopf wird beachtet", async () => {
    for (const kopf of ["en-GB,en;q=0.9", "de;q=0.2,en;q=0.9", "nl;q=0,en;q=0.5"]) {
      const antwort = await verwaltungsversuch(kopf);
      expect(antwort.status, kopf).toBe(403);
      expect(antwort.koerper.message, kopf).toBe("Missing permission: users.manage");
    }
  });
});

describe("Q3 · für deutsche Nutzer und für die Maschine hat sich nichts geändert", () => {
  // DER WÄCHTER GEGEN DIE EIGENE ABLÖSUNG. Fünf Bestandstests pinnen genau diesen Satz
  // (`tests/app/i-834-ab-r1-r5-guardvertrag.test.ts:170`, `confluence-import-rechtetor.test.ts:140`,
  // `ka8-naechster-schritt-bestandsroute.test.ts:199`, `w2a-import-run-routes-148.test.ts:235`,
  // `tests/security/import-guard-kausal-403.test.ts:158`). Wird er hier rot, sind sie es auch.
  it.each([undefined, "de", "fr"])(
    "Q3 Rückfall DE bei %s · zeichengleicher Wortlaut, Fehlercode und Status",
    async (sprache) => {
      const antwort = await verwaltungsversuch(sprache);
      expect(antwort.status).toBe(403);
      // `toEqual` und nicht `toMatchObject`: kein Feld darf dazukommen oder wegfallen.
      expect(antwort.koerper).toEqual({
        error: "FORBIDDEN",
        message: "Recht fehlt: users.manage",
      });
    },
  );

  it("Q3b der deutsche Satz steht so im Katalog, wie er auf dem Draht ankommt", () => {
    expect(einsetzen(MELDUNGEN.PERMISSION_MISSING.de, "users.manage")).toBe(
      "Recht fehlt: users.manage",
    );
  });
});

describe("Q4 · der Rechtename wird eingesetzt und steht nicht fest im Satz", () => {
  it("Q4 EN · dasselbe Tor an einer anderen Route nennt ko.create", async () => {
    const antwort = await entwurfsversuch("en");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    expect(antwort.koerper.message).toBe("Missing permission: ko.create");
    expect(antwort.koerper.message).toBe(einsetzen(MELDUNGEN.PERMISSION_MISSING.en, "ko.create"));
  });

  it("Q4b NL · dasselbe Tor an einer anderen Route nennt ko.create", async () => {
    const antwort = await entwurfsversuch("nl");
    expect(antwort.status).toBe(403);
    expect(antwort.koerper.error).toBe("FORBIDDEN");
    expect(antwort.koerper.message).toBe("Ontbrekend recht: ko.create");
    expect(antwort.koerper.message).toBe(einsetzen(MELDUNGEN.PERMISSION_MISSING.nl, "ko.create"));
  });

  it("Q4c DE · dasselbe Tor an einer anderen Route nennt ko.create", async () => {
    const antwort = await entwurfsversuch();
    expect(antwort.status).toBe(403);
    expect(antwort.koerper).toEqual({ error: "FORBIDDEN", message: "Recht fehlt: ko.create" });
  });
});

// ------------------------------------------------------------------------------------------------
// Q5 · DIE EINSETZSTELLE SELBST — die vier Regeln, jede einzeln gemessen
// ------------------------------------------------------------------------------------------------
//
// Am Draht ist immer genau ein Wert im Spiel. Die Regeln für alles andere gehören trotzdem geprüft:
// `meldung()` ist ab jetzt das Werkzeug für JEDEN künftigen Satz mit Einsetzstelle, und eine stille
// Leerung („%s" verschwindet, wenn niemand einen Wert mitgibt) wäre der Fehler, den man erst am
// Nutzer bemerkt.
describe("Q5 · meldung() setzt ein, ohne je still zu leeren", () => {
  it("Q5a ohne Werte bleibt %s stehen — in allen drei Sprachen", () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      expect(meldung("PERMISSION_MISSING", sprache)).toBe(MELDUNGEN.PERMISSION_MISSING[sprache]);
      expect(meldung("PERMISSION_MISSING", sprache)).toContain("%s");
      // Auch die ausdrücklich leere Liste leert nicht still.
      expect(meldung("PERMISSION_MISSING", sprache, [])).toContain("%s");
    }
  });

  // WAS HIER NICHT GEMESSEN WIRD, und warum es so dasteht: die Regel „`%s` wird von links nach
  // rechts ersetzt" zeigt sich an einem Satz mit ZWEI Einsetzstellen. `PERMISSION_MISSING` ist der
  // einzige Katalogeintrag mit Platzhalter und hat genau einen; ein zweiter wäre ein zweiter
  // Katalogschlüssel und damit ausserhalb dieses Auftrags. Gemessen ist deshalb der Teil, der sich
  // an einer Einsetzstelle wirklich zeigt: der ERSTE Wert füllt sie, ein zweiter erscheint nie.
  it("Q5b der erste Wert füllt die Einsetzstelle, überzählige werden ignoriert", () => {
    expect(meldung("PERMISSION_MISSING", "en", ["a", "b"])).toBe("Missing permission: a");
    expect(meldung("PERMISSION_MISSING", "en", ["a", "b"])).not.toContain("b");
  });

  it("Q5c der Rechtename kommt aus dem Wert, nicht aus dem Satz", () => {
    expect(meldung("PERMISSION_MISSING", "en", ["ko.create"])).toBe(
      "Missing permission: ko.create",
    );
    expect(meldung("PERMISSION_MISSING", "de", ["ko.create"])).toBe("Recht fehlt: ko.create");
  });

  it("Q5d ein eingesetzter Wert wird nicht erneut durchsucht", () => {
    // Sonst frässe ein Wert, der selbst „%s" enthält, den nächsten Wert — oder liefe im Kreis.
    expect(meldung("PERMISSION_MISSING", "en", ["%s"])).toBe("Missing permission: %s");
    expect(meldung("PERMISSION_MISSING", "en", ["%s", "zweiter"])).not.toContain("zweiter");
    // `$&` ist in `String.replace` ein Sonderzeichen. Der Wert wird eingesetzt, nicht gedeutet.
    expect(meldung("PERMISSION_MISSING", "en", ["$&"])).toBe("Missing permission: $&");
  });

  it("Q5e die bestehenden Schlüssel und Aufrufer bleiben unverändert", () => {
    // Der Parameter ist optional: jeder heutige Aufruf liefert weiter denselben Satz.
    expect(meldung("NOT_SIGNED_IN", "en")).toBe("You are not signed in.");
    expect(meldung("INTERNAL", "nl")).toBe("Er is een onverwachte fout opgetreden.");
    // Und ein Wert an einem Satz OHNE Einsetzstelle ändert nichts (kein Anhängen, kein Abschneiden).
    expect(meldung("NOT_SIGNED_IN", "en", ["users.manage"])).toBe("You are not signed in.");
    // Kein Bestandstext trägt heute eine Einsetzstelle — Prüfpunkt 6 (d) des Auftrags, gemessen.
    const mitPlatzhalter = Object.entries(MELDUNGEN)
      .filter(([schluessel]) => schluessel !== "PERMISSION_MISSING")
      .flatMap(([schluessel, texte]) =>
        Object.entries(texte)
          .filter(([, text]) => text.includes("%s"))
          .map(([sprache]) => `${schluessel}.${sprache}`),
      );
    expect(mitPlatzhalter).toEqual([]);
  });

  it("Q5f ein unbekannter Schlüssel fällt weiter auf INTERNAL zurück, auch mit Werten", () => {
    expect(meldung("GIBT_ES_NICHT", "en", ["users.manage"])).toBe(MELDUNGEN.INTERNAL.en);
    expect(meldung("GIBT_ES_NICHT", "en", ["users.manage"])).not.toContain("users.manage");
  });
});
