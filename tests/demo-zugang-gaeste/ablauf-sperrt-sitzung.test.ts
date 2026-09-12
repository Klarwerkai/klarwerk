// ================================================================================================
// JOB 3665 T1 · B — DIE SCHON AUSGESTELLTE SITZUNG, UND DER SSO-EINGANG
// ================================================================================================
//
// DIE HALBHEIT, GEGEN DIE DIESE DATEI STEHT, ist die naheliegendste dieses Auftrags: das Feld
// anlegen, `login` schließen, fertig. Eine Sitzung lebt 14 Tage (`SESSION_TTL_MS` in
// `services/auth/src/service.ts`), und `authenticate` prüfte bis zu diesem Job ausschließlich die
// Frist der SITZUNG, nie den Zustand des KONTOS. Ein Gast, dessen Zugang heute abliefe, wäre damit
// bis zu zwei Wochen weiter drin — er müsste sich nur nicht neu anmelden. Genau deshalb sitzt die
// Prüfung an DREI Stellen und nicht an einer.
//
// UND SIE SOLL KEINE LEBENDE SITZUNG ZURÜCKLASSEN. „`authenticate` gibt `undefined` zurück" allein
// wäre die zweite Halbheit: die Sitzungszeile bliebe in der Datenhaltung liegen, und jede andere
// Stelle, die sie je anders läse, hätte wieder einen offenen Weg. B2 misst deshalb die Ablage
// selbst, nicht die Antwort des Dienstes.
import { describe, expect, it } from "vitest";
import { hashTokenAtRest } from "../../services/auth";
import {
  GAST_PASSWORT,
  STUNDE,
  StoerendeSitzungsablage,
  adminUndGast,
  baueKreis,
  befriste,
  gastClaims,
  vorgaenge,
} from "./aufbau";

describe("JOB 3665 B · die Befristung beendet die laufende Sitzung", () => {
  it("B1 — die ausgestellte Sitzung trägt nach dem Ablauf nicht mehr", async () => {
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt() + STUNDE).toISOString());
    const { token } = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });
    expect(await k.service.authenticate(token)).toBeDefined();

    k.vorstellen(2 * STUNDE);

    // Zwei Stunden, nicht zwei Wochen: die SITZUNG ist hier noch lange gültig. Liefe der Test mit
    // einem größeren Sprung, bewiese er nur den vorhandenen Sitzungsablauf und nichts Neues.
    expect(await k.service.authenticate(token)).toBeUndefined();
  });

  it("B2 — und die Sitzung ist danach wirklich aus der Ablage verschwunden", async () => {
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt() + STUNDE).toISOString());
    const { token } = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });

    k.vorstellen(2 * STUNDE);
    await k.service.authenticate(token);

    expect(await k.sessions.find(hashTokenAtRest(token))).toBeUndefined();
    expect(await vorgaenge(k, "user.access-expired", gast.id)).toBe(1);
  });

  it("B3 — der SSO-Eingang ist ebenso zu, und er räumt die alte Sitzung mit weg", async () => {
    const k = baueKreis();
    // Erst ein Admin, damit das SSO-Konto nicht als Bootstrap-Admin der leeren Instanz entsteht —
    // sonst prüfte B3 den Aussperrschutz statt den Ablauf.
    await k.service.register({ name: "Admin", email: "admin@x.de", password: GAST_PASSWORT });
    const ersteAnmeldung = await k.service.loginWithOidc(gastClaims(), true, "viewer");
    const gastId = ersteAnmeldung.user.id;
    await befriste(k, gastId, new Date(k.jetzt() + STUNDE).toISOString());

    k.vorstellen(2 * STUNDE);

    // JOB 3756: derselbe Meldungsschlüssel wie am Passwort-Eingang — dieselbe Lage darf nicht je
    // nach Anmeldeart etwas anderes sagen. Der Fehlercode bleibt `NOT_APPROVED` (403).
    await expect(k.service.loginWithOidc(gastClaims(), true, "viewer")).rejects.toMatchObject({
      code: "NOT_APPROVED",
      message: "ACCESS_EXPIRED",
    });
    expect(await k.sessions.find(hashTokenAtRest(ersteAnmeldung.token))).toBeUndefined();
    expect(await k.service.authenticate(ersteAnmeldung.token)).toBeUndefined();
  });

  it("B4 — ein unbefristetes Konto behält seine Sitzung", async () => {
    // Ohne diesen Fall wäre jede Aussage oben auch von einem Dienst erfüllt, der einfach JEDE
    // Sitzung wegwirft.
    const k = baueKreis();
    await adminUndGast(k);
    const { token } = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });

    k.vorstellen(2 * STUNDE);

    expect(await k.service.authenticate(token)).toBeDefined();
    expect(await k.sessions.find(hashTokenAtRest(token))).toBeDefined();
  });

  it("B5 — der Prüfpfad hält den Übergang fest, nicht jeden Klopfversuch", async () => {
    // Drei abgewiesene Anmeldeversuche desselben abgelaufenen Kontos ergeben EINEN Eintrag. Sonst
    // wäre der Prüfpfad nach einem Wochenende mit einem hartnäckigen Browser-Tab unlesbar.
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    const ablauf = new Date(k.jetzt() + STUNDE).toISOString();
    await befriste(k, gast.id, ablauf);
    await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });

    k.vorstellen(2 * STUNDE);
    for (let i = 0; i < 3; i += 1) {
      await expect(
        k.service.login({ email: "gast@x.de", password: GAST_PASSWORT }),
      ).rejects.toMatchObject({ code: "NOT_APPROVED" });
    }

    const eintraege = await k.audit.list({ action: "user.access-expired", target: gast.id });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.payload).toMatchObject({ expiresAt: ablauf });
    // Die Nutzlast trägt den Ablaufzeitpunkt und sonst nichts über die Person — dieselbe Grenze,
    // die `services/auth/src/types.ts` für den Hinweis-Vermerk zieht.
    expect(Object.keys(eintraege[0]?.payload ?? {})).toEqual(["expiresAt"]);
  });

  it("B7 — scheitert das Löschen der Sitzungen, entsteht keine halbe Abmeldung", async () => {
    // RUNDE 1 HAT DIESES VERHALTEN BEHAUPTET UND NICHT GEMESSEN. Zugesagt war: der Vorgang schlägt
    // ganz fehl statt halb, und der nächste Versuch holt das Löschen nach, ohne einen zweiten
    // Eintrag ins Prüfprotokoll zu schreiben. Genau das wird hier erzwungen — die Ablage wirft beim
    // ersten Löschversuch.
    const ablage = new StoerendeSitzungsablage(1);
    const k = baueKreis({ sessions: ablage });
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt() + STUNDE).toISOString());
    const { token } = await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });

    k.vorstellen(2 * STUNDE);

    // Erster Versuch: der Fehler der Ablage schlägt durch, statt still verschluckt zu werden.
    await expect(k.service.authenticate(token)).rejects.toThrow("Sitzungsablage nicht erreichbar.");
    expect(ablage.loeschversuche).toBe(1);

    // Zweiter Versuch: das Löschen wird nachgeholt, und es entsteht KEINE zweite Protokollzeile —
    // der Übergang ist derselbe, er wurde nur nicht zu Ende gebracht.
    expect(await k.service.authenticate(token)).toBeUndefined();
    expect(ablage.loeschversuche).toBe(2);
    expect(await k.sessions.find(hashTokenAtRest(token))).toBeUndefined();
    expect(await vorgaenge(k, "user.access-expired", gast.id)).toBe(1);
  });

  it("B6 — eine neue Befristung ist ein neuer Übergang und bekommt eine eigene Zeile", async () => {
    // Die Gegenrichtung zu B5: „einmal" darf nicht heißen „nie wieder". Verlängert der Admin den
    // Zugang und läuft er erneut ab, ist das ein zweiter, echter Übergang.
    const k = baueKreis();
    const { admin, gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt() + STUNDE).toISOString());

    k.vorstellen(2 * STUNDE);
    await expect(
      k.service.login({ email: "gast@x.de", password: GAST_PASSWORT }),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });

    await k.service.setAccessExpiry(gast.id, new Date(k.jetzt() + STUNDE).toISOString(), admin.id);
    await k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });
    k.vorstellen(2 * STUNDE);
    await expect(
      k.service.login({ email: "gast@x.de", password: GAST_PASSWORT }),
    ).rejects.toMatchObject({ code: "NOT_APPROVED" });

    expect(await vorgaenge(k, "user.access-expired", gast.id)).toBe(2);
  });
});
