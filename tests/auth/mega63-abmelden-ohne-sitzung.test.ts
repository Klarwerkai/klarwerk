// ================================================================================================
// AUFTRAG-mega63 BLOCK A — DER AUSWEG AUS DER SPERRE LÄSST SICH NICHT VERRIEGELN.
// ================================================================================================
//
// Block A macht die Sperre nach einem gescheiterten strengen Abmelden reload-fest. Damit entsteht
// eine neue Möglichkeit, die es vorher nicht gab: Der Merker kann liegenbleiben, während die
// Sitzung inzwischen von selbst verschwunden ist (anderswo abgemeldet, abgelaufen, Cookie weg).
// Der einzige Weg heraus ist dann der Knopf auf der Sperrfläche — und der ruft `/auth/logout`.
//
// WÜRDE DIESE ROUTE OHNE GÜLTIGEN TOKEN MIT 401 ANTWORTEN, WÄRE DIE SPERRE EINE FALLE: Der strenge
// Zweig löscht den Merker nur nach BESTÄTIGTER Beendigung, ein 401 wäre keine Bestätigung, und die
// Betroffene käme nie wieder an die Anmeldemaske. Das wäre schlimmer als der Fehler, den Block A
// behebt.
//
// Die Oberflächen-Gegenprobe dazu (A4) steht in
// apps/web/src/legal/mega63-sperre-ueberlebt-neuladen.test.tsx und setzt genau diese Antwort in
// ihrer Attrappe voraus. Hier wird sie an der ECHTEN Route gemessen, damit die Attrappe dort keine
// Behauptung ist.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

describe("mega63 A · Abmelden ohne gültige Sitzung", () => {
  it("die Route antwortet OHNE Token mit 204 — der Ausweg bleibt offen", async () => {
    const app = buildApp(buildServices());

    const ohneToken = await app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(ohneToken.statusCode).toBe(204);

    // Und auch ein UNGÜLTIGER Token verriegelt nicht: genau der Zustand nach einer abgelaufenen
    // oder anderswo beendeten Sitzung.
    const mitMuellToken = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: "Bearer kein-gueltiger-token" },
    });
    expect(mitMuellToken.statusCode).toBe(204);

    // KALIBRIERUNG: eine geschützte Route weist denselben Zustand sehr wohl ab — die 204 oben ist
    // also eine Eigenschaft dieser Route und nicht eine fehlende Absicherung insgesamt.
    const geschuetzt = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(geschuetzt.statusCode).toBe(401);

    await app.close();
  });
});
