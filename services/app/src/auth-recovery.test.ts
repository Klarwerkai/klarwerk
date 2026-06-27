import { describe, expect, it } from "vitest";
import { ConsoleMailer } from "../../notifications";
import { buildApp, buildServices } from "./build-app";

// SCRUM-221: Forgot/Reset-Recovery über die ECHTEN HTTP-Routen verifizieren. Der Reset-Token wird
// nur per (Test-)Mailer zugestellt — NICHT über die Produkt-API. Kein echter SMTP, kein Secret.
describe("SCRUM-221: Passwort-Recovery (Forgot → Reset → Login)", () => {
  function setup() {
    const services = buildServices();
    // Sammelnden Test-Mailer einsetzen, um den Reset-Link (Token) abzugreifen.
    const mailer = new ConsoleMailer();
    services.mailer = mailer;
    const app = buildApp(services);
    return { app, mailer };
  }

  async function register(app: ReturnType<typeof buildApp>, email: string, password: string) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "User", email, password },
    });
  }

  function tokenFromMail(text: string): string {
    const m = text.match(/[?&]token=([^\s&]+)/);
    if (!m) {
      throw new Error("Kein Reset-Token in der Mail gefunden.");
    }
    return m[1] as string;
  }

  it("voller Flow: forgot → reset → altes PW scheitert, neues PW klappt, Token einmalig", async () => {
    const { app, mailer } = setup();
    const email = "recover@x.de";
    await register(app, email, "altpass123");

    // 1) Forgot: immer 204, Token NICHT in der Antwort — nur per Mailer.
    const forgot = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email },
    });
    expect(forgot.statusCode).toBe(204);
    expect(forgot.body).not.toContain("token");
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe(email);

    // 2) Token aus der zugestellten Mail (nicht aus der API) ziehen.
    const token = tokenFromMail(mailer.sent[0]?.text ?? "");
    expect(token.length).toBeGreaterThan(0);

    // 3) Reset einlösen.
    const reset = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, newPassword: "neupass456" },
    });
    expect(reset.statusCode).toBe(204);

    // 4) Altes Passwort funktioniert nicht mehr.
    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "altpass123" },
    });
    expect(oldLogin.statusCode).toBeGreaterThanOrEqual(400);

    // 5) Neues Passwort funktioniert.
    const newLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "neupass456" },
    });
    expect(newLogin.statusCode).toBe(200);
    expect(newLogin.json().token).toBeTruthy();

    // 6) Token ist einmalig — zweite Einlösung scheitert.
    const reuse = await app.inject({
      method: "POST",
      url: "/api/auth/reset",
      payload: { token, newPassword: "drittespass789" },
    });
    expect(reuse.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("forgot für unbekannte E-Mail: 204, aber keine Mail (keine Existenz-Preisgabe)", async () => {
    const { app, mailer } = setup();
    await register(app, "known@x.de", "altpass123");

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "unbekannt@x.de" },
    });
    expect(res.statusCode).toBe(204);
    // Es wurde nur für bekannte Adressen eine Mail erzeugt — hier also keine.
    expect(mailer.sent).toHaveLength(0);
  });
});
