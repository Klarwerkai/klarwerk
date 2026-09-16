// ================================================================================================
// JOB 4223 · B — DER ABLAUF TRIFFT DIE LAUFENDE SITZUNG, NICHT NUR DIE NÄCHSTE ANMELDUNG.
// ================================================================================================
//
// DIE NAHELIEGENDE HALBHEIT, gegen die diese Datei steht, ist die des Auftrags §8.4: nur den
// EINGANG zu schliessen. Eine Sitzung lebt 14 Tage (`SESSION_TTL_MS`, `services/auth/src/service.ts:16`);
// wäre allein `login` gesperrt, bliebe ein Gast, dessen Zugang heute endet, bis zu zwei Wochen im
// Haus — er müsste sich nur nicht neu anmelden.
//
// GEMESSEN WIRD DAS AN DER KETTE UND NICHT AM DIENST. `tests/demo-zugang-gaeste/ablauf-sperrt-sitzung.test.ts`
// (B1–B7) misst dieselbe Zusage am `AuthService`, mit gestellter Uhr und Speicherablagen; was
// zwischen `service.authenticate` und dem, was ein Gast im Browser bekommt, liegt — Route, Wache,
// Keksverarbeitung, Antwortrumpf —, ist dort nicht im Bild. Hier ist es das: echter Socket, echte
// Kekse, zwei getrennte Profile.
//
// WIE DER ZEITPUNKT KONTROLLIERT WIRD, OHNE UHR UND OHNE WARTEN. Der Admin setzt über die ECHTE
// Route einen Zeitpunkt in der VERGANGENHEIT — genau der Handgriff, mit dem ein Admin am Bildschirm
// einen Zugang sofort beendet (`AdminKontenDetails.tsx`: „Befristung verlängern" nimmt jeden Tag
// entgegen, auch einen vergangenen). `setAccessExpiry` prüft die FORM des Wertes, nicht seine Lage
// in der Zeit (`service.ts:459-476`) — und das ist richtig so, denn „sofort beenden" muss möglich
// sein. Also braucht dieser Lauf weder ein `sleep` noch eine verstellte Uhr noch ein verkürztes
// `SESSION_TTL_MS`; die Ablaufregel wird an keiner Stelle abgeschwächt.
//
// DIE FÄLLE:
//   B1  Gast angemeldet und arbeitend → Admin setzt die Frist in die Vergangenheit → der nächste
//       Schritt des Gastes (erneuter Abruf, „Neuladen") ist gesperrt, und der Rumpf trägt keinen
//       geschützten Inhalt.
//   B2  Dieselbe Kette mit GÜLTIGER Frist bleibt grün. Ohne diesen Fall misst B1 nur ein
//       Dauer-Nein.
//   B3  Der Entzug wirkt genauso: nimmt der Admin das Konto ganz weg, endet die laufende Sitzung.
//   B4  VERLÄNGERN FÜHRT WIRKLICH ZURÜCK HEREIN — nach dem Ablauf eine neue Frist, neue Anmeldung,
//       weiterarbeiten. Ohne ihn wäre B1 auch von einer Sperre erfüllt, die immer zuschlägt.
//   B5  Der Sitzungskeks des Gastes ist nach dem Ablauf wirklich tot: auch ein Abruf mit genau
//       diesem Keks bringt nichts zurück, und die Anmeldung des ADMINS bleibt davon unberührt.
import { afterEach, describe, expect, it } from "vitest";
import type { PublicUser } from "../../services/auth/src/types";
import {
  PASSWORT,
  type Sitzung,
  type Strecke,
  arbeitsweg,
  ausDerListe,
  befristen,
  ersteinrichtung,
  gastAnlegen,
  kuenftig,
  mussGelingen,
  starteStrecke,
  vergangen,
  wissensobjektAnlegen,
} from "./strecke";

const TITEL = "Geheime Wartungsanweisung 4223";
const GAST = "gast@ablauf-4223.test";

let offen: Strecke | undefined;

afterEach(async () => {
  await offen?.schliessen();
  offen = undefined;
});

/** Admin, Inhalt, Gast mit Frist — und der Gast ist bereits angemeldet und hat gearbeitet. */
async function laufendeSitzung(bis: string): Promise<{
  strecke: Strecke;
  admin: Sitzung;
  gast: Sitzung;
  gastId: string;
}> {
  const strecke = await starteStrecke();
  offen = strecke;
  const { sitzung: admin } = await ersteinrichtung(strecke);
  await wissensobjektAnlegen(admin, TITEL);
  const gastId = (
    mussGelingen(
      "POST /api/users",
      await gastAnlegen(admin, {
        name: "Gast im Haus",
        email: GAST,
        role: "viewer",
        accessExpiresAt: bis,
      }),
      201,
    ).json as PublicUser
  ).id;
  const gast = strecke.profil("gast");
  mussGelingen(
    "Anmeldung des Gastes",
    await gast.sende("POST", "/api/auth/login", { email: GAST, password: PASSWORT }),
  );
  // Er ARBEITET bereits — sonst wäre „die laufende Sitzung" eine Behauptung.
  const vorher = await arbeitsweg(gast);
  expect(vorher.status, vorher.text).toBe(200);
  expect(vorher.text).toContain(TITEL);
  return { strecke, admin, gast, gastId };
}

describe("JOB 4223 B · Ablauf und Entzug wirken auf die laufende Sitzung", () => {
  it("B1 — Frist in die Vergangenheit: der nächste Schritt ist zu, der Rumpf trägt nichts Geschütztes", async () => {
    const { admin, gast, gastId } = await laufendeSitzung(kuenftig());

    const gesetzt = await befristen(admin, gastId, vergangen());
    expect(gesetzt.status, gesetzt.text).toBe(200);

    // „Neuladen" ist für den Server genau das: derselbe Abruf noch einmal, mit demselben Keks.
    const danach = await arbeitsweg(gast);
    expect([401, 403], `Status war ${danach.status}: ${danach.text}`).toContain(danach.status);
    expect(danach.text, "kein geschützter Inhalt im Rumpf").not.toContain(TITEL);
    // Auch nicht über einen anderen geschützten Weg — „wer bin ich" ist ebenso zu.
    const ich = await gast.sende("GET", "/api/auth/me");
    expect([401, 403]).toContain(ich.status);
    expect(ich.text).not.toContain(GAST);
  });

  it("B2 — Gegenprobe: dieselbe Kette mit gültiger Frist bleibt offen", async () => {
    // Ohne diesen Fall bewiese B1 nur, dass dieser Weg IMMER Nein sagt.
    const { admin, gast, gastId } = await laufendeSitzung(kuenftig());

    const gesetzt = await befristen(admin, gastId, kuenftig(14));
    expect(gesetzt.status, gesetzt.text).toBe(200);

    const danach = await arbeitsweg(gast);
    expect(danach.status, danach.text).toBe(200);
    expect(danach.text).toContain(TITEL);
  });

  it("B3 — der Entzug wirkt ebenso: ein gelöschtes Konto beendet die laufende Sitzung", async () => {
    const { admin, gast, gastId } = await laufendeSitzung(kuenftig());

    const entzogen = await admin.sende("DELETE", `/api/users/${gastId}`);
    expect([200, 204], entzogen.text).toContain(entzogen.status);

    const danach = await arbeitsweg(gast);
    expect([401, 403], `Status war ${danach.status}: ${danach.text}`).toContain(danach.status);
    expect(danach.text).not.toContain(TITEL);
    expect(await ausDerListe(admin, gastId)).toBeUndefined();
  });

  it("B4 — Verlängern führt wirklich zurück herein", async () => {
    const { strecke, admin, gast, gastId } = await laufendeSitzung(kuenftig());

    // 1. Ablauf.
    mussGelingen("Frist in die Vergangenheit", await befristen(admin, gastId, vergangen()));
    expect([401, 403]).toContain((await arbeitsweg(gast)).status);
    // Und auch der Eingang ist zu — sonst wäre die Verlängerung darunter kein Beleg.
    const zu = strecke.profil("gast-versuch");
    expect(
      (await zu.sende("POST", "/api/auth/login", { email: GAST, password: PASSWORT })).status,
    ).toBe(403);

    // 2. Der Admin verlängert.
    const neu = kuenftig(30);
    mussGelingen("Verlängerung", await befristen(admin, gastId, neu));
    expect((await ausDerListe(admin, gastId))?.accessExpiresAt).toBe(neu);

    // 3. Der Gast meldet sich erneut an — frisches Profil, wie nach einem Neustart des Browsers —
    //    und arbeitet weiter.
    const wieder = strecke.profil("gast-wieder");
    mussGelingen(
      "erneute Anmeldung",
      await wieder.sende("POST", "/api/auth/login", { email: GAST, password: PASSWORT }),
    );
    const arbeit = await arbeitsweg(wieder);
    expect(arbeit.status, arbeit.text).toBe(200);
    expect(arbeit.text).toContain(TITEL);
  });

  it("B5 — der Keks des Gastes ist tot, die Anmeldung des Admins bleibt unberührt", async () => {
    // Die Halbheit „authenticate sagt Nein, die Sitzungszeile lebt weiter" (JOB 3665 B2) — hier
    // von aussen gemessen: derselbe Keks bringt auch beim zweiten und dritten Versuch nichts
    // zurück. Und der Ablauf des einen Kontos darf nicht die Sitzungen aller beenden.
    const { admin, gast, gastId } = await laufendeSitzung(kuenftig());

    mussGelingen("Frist in die Vergangenheit", await befristen(admin, gastId, vergangen()));

    for (let versuch = 0; versuch < 3; versuch += 1) {
      const antwort = await arbeitsweg(gast);
      expect([401, 403], `Versuch ${versuch + 1}: ${antwort.text}`).toContain(antwort.status);
      expect(antwort.text).not.toContain(TITEL);
    }

    const adminArbeit = await arbeitsweg(admin);
    expect(adminArbeit.status, adminArbeit.text).toBe(200);
    expect(adminArbeit.text).toContain(TITEL);
  });
});
