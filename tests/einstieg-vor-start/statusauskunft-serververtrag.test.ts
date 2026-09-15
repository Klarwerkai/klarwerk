// ================================================================================================
// JOB 4105 · V7 — DER SERVERVERTRAG: DIE AUSKUNFT UND DER WEG SAGEN DASSELBE.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DEM KOMPONENTENTEST STEHT (Promptverbesserung JOB 4075 R3: „zwischen
// Komponententest und vollständiger Aufruferintegration unterscheiden"). Der DOM-Test daneben misst
// die Maske gegen eine GESTELLTE Antwort — er kann nicht wissen, ob der echte Server dieses Feld
// überhaupt sendet und ob es dasselbe bedeutet wie sein Verhalten. Genau das misst diese Datei: an
// der echten App, in DERSELBEN Schalterstellung, werden BEIDE Signale nebeneinander abgefragt —
// `GET /api/auth/status` und das tatsächliche Verhalten von `POST /api/auth/register`. Laufen sie
// auseinander, wäre die Maske ehrlich falsch: Sie berichtete einen Zustand, den der Server nicht
// hat.
//
// DIESELBE APP FÜR BEIDE STELLUNGEN — das ist kein Zufall, sondern die zweite Zusage: Der Schalter
// wird zur LAUFZEIT ausgewertet. Eine beim Aufbau eingefrorene Modulkonstante bestünde den ersten
// Durchgang und fiele im zweiten durch.
//
// `withEnv` ist das Muster aus `tests/security/vip2-gate.test.ts:42-56` (dort nur gelesen — die
// Suite setzt `KLARWERK_SELF_REGISTRATION=1` global in `tests/setup-env.ts`, Tests des
// AUS-Verhaltens löschen die Variable LOKAL und stellen sie danach wieder her).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

function withEnv(key: string, value: string | undefined, run: () => Promise<void>): Promise<void> {
  const saved = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
  return run().finally(() => {
    if (saved === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved;
    }
  });
}

describe("JOB 4105 · V7 · GET /api/auth/status meldet die Selbstregistrierung so, wie sie wirkt", () => {
  it("beide Schalterstellungen an DERSELBEN App: Auskunft und Registrierweg stimmen überein", async () => {
    const app = buildApp(buildServices());
    const gemessen: { stellung: string; gemeldet: unknown; registerCode: number }[] = [];

    for (const [stellung, wert] of [
      ["aus", undefined],
      ["an", "1"],
    ] as const) {
      await withEnv("KLARWERK_SELF_REGISTRATION", wert, async () => {
        const status = await app.inject({ method: "GET", url: "/api/auth/status" });
        expect(status.statusCode).toBe(200);
        const koerper = status.json() as {
          needsSetup: boolean;
          oidcEnabled: boolean;
          selfRegistrationEnabled?: boolean;
        };
        // Additiv: die Bestandsfelder bleiben, was sie waren.
        expect(typeof koerper.needsSetup, "needsSetup ist abhandengekommen").toBe("boolean");
        expect(typeof koerper.oidcEnabled, "oidcEnabled ist abhandengekommen").toBe("boolean");

        const register = await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: {
            name: "Neue Person",
            email: `v7-${stellung}@example.org`,
            password: "geheim12345",
          },
        });
        gemessen.push({
          stellung,
          gemeldet: koerper.selfRegistrationEnabled,
          registerCode: register.statusCode,
        });
      });
    }

    // Erst die rohen Messwerte festhalten, dann urteilen — so steht bei Rot da, was wirklich kam.
    expect(gemessen).toEqual([
      { stellung: "aus", gemeldet: false, registerCode: 403 },
      { stellung: "an", gemeldet: true, registerCode: 201 },
    ]);

    // Und dieselbe Aussage noch einmal als Beziehung statt als Zahl: Was der Status meldet, ist
    // genau das, was der Registrierweg tut. Diese Zeile bliebe auch dann richtig, wenn sich der
    // Erfolgscode einmal änderte — sie prüft die Übereinstimmung, nicht die Zahl.
    for (const fall of gemessen) {
      expect(fall.gemeldet, `Status und Verhalten laufen bei „${fall.stellung}" auseinander`).toBe(
        fall.registerCode !== 403,
      );
    }
  });

  it("die Auskunft ist unauthentifiziert erreichbar und verrät nichts über den Kontenbestand", async () => {
    // Der Schalter ist bereits heute für jeden Unangemeldeten messbar: `POST /api/auth/register`
    // antwortet mit 403 `REGISTRATION_DISABLED`. Das Feld verrät also nichts Neues — diese Zeile
    // hält fest, dass es auch nichts DARÜBER HINAUS verrät.
    await withEnv("KLARWERK_SELF_REGISTRATION", undefined, async () => {
      const app = buildApp(buildServices());
      const status = await app.inject({ method: "GET", url: "/api/auth/status" });
      expect(status.statusCode).toBe(200);
      expect(Object.keys(status.json() as Record<string, unknown>).sort()).toEqual([
        "needsSetup",
        "oidcEnabled",
        "selfRegistrationEnabled",
      ]);
    });
  });
});
