// ================================================================================================
// JOB 3785 · Q9-REST — DER SSO-WEG SAGT SEINEN GRUND IN DER SPRACHE DES NUTZERS.
// ================================================================================================
//
// WAS HIER FEHLTE. `katalog.test.ts` S1 verlangt von jedem der 28 Katalogschlüssel drei
// Sprachfassungen; `katalogschluessel-herkunft.test.ts` H4 sagt dazu, WELCHE davon je an einer
// echten Antwort gemessen werden. Für den ganzen SSO-Weg war die Antwort bisher „keiner": die drei
// Sätze standen im Katalog, kein aktiver Fall hat sie je vom Draht gelesen. Wer sich über einen
// fremden Anmeldedienst anmeldet und dabei scheitert, bekam eine Übersetzung, für die niemand
// bürgte.
//
// DIE DREI AUSGÄNGE, GEGEN DIE DIESE DATEI STEHT (`services/auth/src/routes.ts`):
//   OIDC_DISABLED       :452-457 (`GET /api/auth/oidc/start`) und :476-481 (`POST /api/auth/oidc`),
//                       je 501, wenn `options.oidc` fehlt.
//   OIDC_STATE_INVALID  :490-503, 400, wenn Plätzchen und `body.state` nicht zusammenpassen.
//   OIDC_LOGIN_FAILED   :515-525, 401, wenn Tausch oder Prüfung mit einem Fehler scheitern, der
//                       KEIN `AuthError` ist.
// Alle drei setzen ihren Text über `meldung(<schluessel>, sprache(request))` und lesen damit den
// `accept-language`-Kopf. Gemessen wird deshalb an der HTTP-Antwort — dort entsteht der Text; die
// Weboberfläche reicht ihn nur durch.
//
// GEPRÜFT WIRD DER VOLLE SATZ, UND ZWEI SÄTZE WERDEN AUSGESCHLOSSEN. `meldung()` fällt bei einem
// unbekannten Schlüssel STILL auf den INTERNAL-Satz zurück (`meldungen.ts:159-164`), und bei einer
// unbekannten Sprache auf Deutsch. Ein Fall, der nur „irgendein Text kam zurück" prüfte, bliebe
// bei beiden Rückfällen grün. Jeder Fall hier hält deshalb den vollen Satz mit `toBe` und schliesst
// zusätzlich den deutschen Rückfall und den INTERNAL-Satz DERSELBEN Sprache aus.
//
// DIE SÄTZE STEHEN HIER WÖRTLICH, nicht als `MELDUNGEN.<SCHLUESSEL>[sprache]`. Zwei Gründe: eine
// Abschrift bricht, wenn jemand den Katalog ändert, ohne den Fall anzusehen (genau das soll
// auffallen), und H4 zählt den wörtlichen Satz ohne Zusatzwissen als Deckung.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type OidcConfig,
  type OidcProvider,
  OidcUnreachableError,
} from "../../services/auth/src/oidc";
import { InMemorySessionRepo, InMemoryUserRepo } from "../../services/auth/src/repo";
import { authRoutes } from "../../services/auth/src/routes";
import { AuthService } from "../../services/auth/src/service";
import { AuthError } from "../../services/auth/src/types";

/** Nur so viel Anbieterangaben, wie `/api/auth/oidc/start` braucht; nichts davon wird gerufen. */
const OIDC_CONFIG: OidcConfig = {
  issuer: "https://idp.example.test",
  audience: "klarwerk-client",
  jwksUri: "https://idp.example.test/jwks",
  authorizeUrl: "https://idp.example.test/authorize",
  tokenUrl: "https://idp.example.test/token",
  clientId: "klarwerk-client",
  redirectUri: "https://app.klarwerk.test/sso/callback",
  roles: { roleClaim: "roles", adminGroup: "kw-admin" },
};

/**
 * LIEFERUNG 2 · DIE EINZIGE SSO-BÜHNE DIESES ORDNERS. Ein verdrahteter Anbieter ist die
 * Voraussetzung für die Fälle S3 und S4 — ohne ihn antwortet jede der beiden Türen 501 und man
 * misst wieder nur `OIDC_DISABLED`. Die Bühne steht genau einmal (`grep -n "authRoutes("
 * tests/q9-serverfehlertexte` findet eine Stelle); jeder Fall reicht nur die Abweichung herein,
 * die er braucht.
 *
 * Dass in `tests/q9-oidc-literalquelle/` eine zweite, private Bühne steht, bleibt so: sie liegt
 * ausserhalb der Zielpfade, ist dort nicht exportiert, und ein Import quer zwischen zwei
 * Testsuiten wäre die schlechtere Kopplung als zwei kleine Aufbauten.
 *
 * Die Attrappe hängt am echten `OidcProvider`-Typ — ein Zweig, den die Produktion nicht kennt,
 * scheitert damit schon am Typprüfer und nicht erst an einer Behauptung.
 */
function ssoBuehne(teil: Partial<OidcProvider>) {
  const anbieter: OidcProvider = {
    autoProvision: false,
    config: OIDC_CONFIG,
    authorizeUrl: () => "https://idp.example.test/authorize",
    exchange: () => Promise.reject(new Error("kein Tausch erwartet")),
    verify: () => Promise.reject(new Error("keine Prüfung erwartet")),
    mapRole: () => "viewer",
    ...teil,
  };
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
  });
  const app = Fastify();
  app.register(authRoutes(service, { oidc: anbieter }));
  return app;
}

/**
 * Ein echter SSO-Rücklauf über die Bühne: `/api/auth/oidc/start` setzt die drei Flussplätzchen,
 * `POST /api/auth/oidc` antwortet. `zustand` wählt, ob der zurückgemeldete `state` zum Plätzchen
 * passt — das ist der einzige Unterschied zwischen S2 und S3. Kein Netz, keine Uhr, keine
 * Wartezeit: die Attrappe antwortet in derselben Zeitscheibe.
 */
async function ssoRuecklauf(
  teil: Partial<OidcProvider>,
  sprache: string,
  zustand: "passend" | "fremd",
): Promise<{ statusCode: number; error: string | undefined; message: string | undefined }> {
  const app = ssoBuehne(teil);
  try {
    const start = await app.inject({ method: "GET", url: "/api/auth/oidc/start" });
    const gesetzt = start.headers["set-cookie"];
    const liste = Array.isArray(gesetzt) ? gesetzt : gesetzt ? [gesetzt] : [];
    const paare = liste.map((c) => c.split(";")[0] ?? "");
    const echt = paare.find((p) => p.startsWith("kw_oidc_state="))?.split("=")[1] ?? "";
    const antwort = await app.inject({
      method: "POST",
      url: "/api/auth/oidc",
      headers: { cookie: paare.join("; "), "accept-language": sprache },
      payload: { code: "code-vom-idp", state: zustand === "passend" ? echt : `${echt}-fremd` },
    });
    const rumpf = antwort.json() as { error?: string; message?: string };
    return { statusCode: antwort.statusCode, error: rumpf.error, message: rumpf.message };
  } finally {
    await app.close();
  }
}

/**
 * Derselbe Vertrag wie `sprachvertrag` in `server.test.ts`, um die zwei stillen Rückfälle ergänzt:
 * der VOLLE Satz (kein Teilwort), nicht der deutsche Satz, nicht der INTERNAL-Satz derselben
 * Sprache. `expect.soft`, damit ein Fehlschlag alle drei Aussagen zeigt statt nur der ersten.
 */
function ssoVertrag(
  message: string | undefined,
  satz: string,
  deutsch: string,
  intern: string,
): void {
  expect.soft(message).toBe(satz);
  expect.soft(message).not.toBe(deutsch);
  expect.soft(message).not.toBe(intern);
}

// Die Sprachtabellen stehen INNERHALB der `it.each(`-Klammer, nicht als Modulkonstante daneben.
// Das ist keine Geschmacksfrage: `katalogschluessel-herkunft.test.ts` ordnet einen Tabellenwert
// seiner Spalte und damit dem gebundenen Rückrufparameter zu (`spalteVon`, K4) — steht die Tabelle
// unter einem Namen ausserhalb des Falls, liegt der Satz in keinem Fallbereich und zählt als
// ungemessen. Gemessen, nicht vermutet: mit ausgelagerten Tabellen blieb H4 unverändert grün.
// Je Zeile: Sprache · erwarteter Satz · deutscher Rückfall · INTERNAL-Satz derselben Sprache,
// alle wörtlich aus `services/auth/src/meldungen.ts` (`:79-83`, `:124-138`).

/** Der Fehler, an dem S3 hängt: ein GEWÖHNLICHER Fehler. Siehe S3.0. */
const TAUSCH_FEHLER = new Error("Token-Endpunkt lehnt den Code ab");

describe("Q9 SSO-Sprachfälle am echten Auth-Draht", () => {
  it.each([
    [
      "en",
      "SSO is not configured.",
      "SSO ist nicht konfiguriert.",
      "An unexpected error occurred.",
    ],
    [
      "nl",
      "SSO is niet geconfigureerd.",
      "SSO ist nicht konfiguriert.",
      "Er is een onverwachte fout opgetreden.",
    ],
  ] as const)(
    "S1 OIDC_DISABLED · beide SSO-Türen antworten ohne Anbieter 501 auf %s",
    async (sprache, satz, deutsch, intern) => {
      // `buildApp` verdrahtet den Anbieter über `createOidcProviderFromEnv()`
      // (`services/app/src/build-app.ts:1912-1915`); ohne die sieben OIDC_*-Umgebungsvariablen
      // gibt die Fabrik `undefined` zurück (`oidc.ts:404-415`) — der Zweig dieses Falls.
      const app = buildApp(buildServices());
      try {
        const tueren = [
          { method: "GET" as const, url: "/api/auth/oidc/start" },
          { method: "POST" as const, url: "/api/auth/oidc", payload: { code: "c", state: "s" } },
        ];
        for (const tuer of tueren) {
          const res = await app.inject({ ...tuer, headers: { "accept-language": sprache } });
          expect(res.statusCode, `${tuer.method} ${tuer.url}`).toBe(501);
          expect(res.json().error).toBe("OIDC_DISABLED");
          ssoVertrag(res.json().message, satz, deutsch, intern);
        }
      } finally {
        await app.close();
      }
    },
  );

  it.each([
    ["en", "The SSO state is invalid.", "SSO-Status ungültig.", "An unexpected error occurred."],
    [
      "nl",
      "De SSO-status is ongeldig.",
      "SSO-Status ungültig.",
      "Er is een onverwachte fout opgetreden.",
    ],
  ] as const)(
    "S2 OIDC_STATE_INVALID · ein state, der nicht zum Plätzchen passt, antwortet 400 auf %s",
    async (sprache, satz, deutsch, intern) => {
      const antwort = await ssoRuecklauf({}, sprache, "fremd");
      expect(antwort.statusCode).toBe(400);
      expect(antwort.error).toBe("OIDC_INVALID");
      ssoVertrag(antwort.message, satz, deutsch, intern);
    },
  );

  it("S3.0 die Attrappe von S3 wirft wirklich einen gewöhnlichen Fehler", () => {
    // Ohne diese Zusage könnte S3 in Wahrheit den Zweig von `tests/q9-oidc-literalquelle` E.1
    // messen: ein `OidcUnreachableError` liefe über `sendError` und ergäbe den
    // OIDC_UNREACHABLE-Satz, ein `AuthError` über `routes.ts:517-519` — beide mit anderem Text,
    // aber ebenfalls 401. Nur ein gewöhnlicher Fehler erreicht `routes.ts:521-524`.
    expect(TAUSCH_FEHLER).not.toBeInstanceOf(OidcUnreachableError);
    expect(TAUSCH_FEHLER).not.toBeInstanceOf(AuthError);
  });

  it.each([
    ["en", "SSO sign-in failed.", "SSO-Anmeldung fehlgeschlagen.", "An unexpected error occurred."],
    [
      "nl",
      "Aanmelden via SSO is mislukt.",
      "SSO-Anmeldung fehlgeschlagen.",
      "Er is een onverwachte fout opgetreden.",
    ],
  ] as const)(
    "S3 OIDC_LOGIN_FAILED · ein gescheiterter Token-Tausch antwortet 401 auf %s",
    async (sprache, satz, deutsch, intern) => {
      const antwort = await ssoRuecklauf(
        { exchange: () => Promise.reject(TAUSCH_FEHLER) },
        sprache,
        "passend",
      );
      expect(antwort.statusCode).toBe(401);
      expect(antwort.error).toBe("OIDC_INVALID");
      ssoVertrag(antwort.message, satz, deutsch, intern);
    },
  );

  it("S4 die Bühne selbst trägt: mit passendem state und heilem Anbieter läuft der Rücklauf durch", async () => {
    // Die Kalibrierung gegen ein Dauer-Nein. Antwortete die Bühne IMMER mit einem Fehler — etwa
    // weil `/start` gar keine Plätzchen setzt —, wären S2 und S3 grün, ohne je den gemeinten
    // Zweig erreicht zu haben. Hier läuft derselbe Weg bis zum Ende durch.
    const antwort = await ssoRuecklauf(
      {
        autoProvision: true,
        exchange: () => Promise.resolve("id-token"),
        verify: () =>
          Promise.resolve({
            sub: "sso-subjekt",
            email: "sso@job3785.test",
            name: "SSO-Nutzer",
            roles: [],
            iss: "https://idp.example.test",
            rolesClaimPresent: false,
          }),
      },
      "en",
      "passend",
    );
    expect(antwort.statusCode, antwort.message).toBe(200);
    expect(antwort.error).toBeUndefined();
  });
});
