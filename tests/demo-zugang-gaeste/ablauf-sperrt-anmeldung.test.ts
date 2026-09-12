// ================================================================================================
// JOB 3665 T1 · A — NACH ABLAUF KOMMT NIEMAND MEHR HEREIN, SCHON GAR NICHT ÜBER DIE ANMELDUNG
// ================================================================================================
//
// Pedis vierte Zusage zum Demo-Zugang lautet: „sein Zugang laeuft ab". Drei der vier Zusagen trug
// die vorhandene Anmeldung schon (persönliches Konto, keine Freigabe ohne Abnahme, begrenzte
// Rechte). Diese hier trug sie NICHT: ein einmal freigegebenes Konto blieb für immer freigegeben.
//
// WAS DIESE DATEI PRÜFT, ist der erste der drei Eingänge — `AuthService.login`. Die anderen beiden
// (SSO-Anmeldung, laufende Sitzung) stehen in `ablauf-sperrt-sitzung.test.ts`; sie brauchen einen
// eigenen Beleg, weil eine geschlossene Anmeldung allein einen Gast noch bis zu 14 Tage im Haus
// ließe (`SESSION_TTL_MS`).
//
// WARUM DER FEHLERCODE `NOT_APPROVED` BLEIBT, DER MELDUNGSSCHLÜSSEL ABER NICHT: Der Code trägt den
// HTTP-Status 403 und den Vertrag der Clients — daran hat sich nichts geändert. Der SATZ dagegen
// war falsch: JOB 3665 musste sich hier noch `NOT_APPROVED` leihen (der Katalog gehörte damals
// einem anderen Job), und ein abgelaufener Gast las „Konto ist noch nicht freigegeben.", obwohl
// sein Konto freigegeben WAR. Seit JOB 3756 trägt der Wurf `ACCESS_EXPIRED` („Ihr Zugang ist
// abgelaufen."); der Weg zurück ist ein anderer als bei fehlender Freigabe, nämlich das Nehmen oder
// Verlängern der Befristung. Der Satz an der echten Route steht in
// `tests/demo-zugang-gaeste-meldung/ablauf-meldung.test.ts`.
import { describe, expect, it } from "vitest";
import {
  GAST_PASSWORT,
  type Kreis,
  STUNDE,
  adminUndGast,
  baueKreis,
  befriste,
  vorgaenge,
} from "./aufbau";

function gastAnmelden(k: Kreis) {
  return k.service.login({ email: "gast@x.de", password: GAST_PASSWORT });
}

describe("JOB 3665 A · die Befristung sperrt die Anmeldung", () => {
  it("A1 — vor dem Ablauf meldet sich der Gast ganz normal an", async () => {
    // Die Kalibrierung gegen ein Dauer-Nein: Wäre A1 nicht da, könnte eine Sperre, die IMMER
    // zuschlägt, A2 erfüllen und sähe genauso grün aus.
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt() + STUNDE).toISOString());

    const angemeldet = await gastAnmelden(k);
    expect(angemeldet.token).toBeTruthy();
    expect(angemeldet.user.id).toBe(gast.id);
  });

  it("A2 — nach dem Ablauf wird die Anmeldung abgewiesen", async () => {
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt() + STUNDE).toISOString());

    k.vorstellen(2 * STUNDE);

    // JOB 3756: der Code bleibt `NOT_APPROVED` (403), der Meldungsschlüssel ist der eigene.
    await expect(gastAnmelden(k)).rejects.toMatchObject({
      code: "NOT_APPROVED",
      message: "ACCESS_EXPIRED",
    });
  });

  it("A3 — ein Konto OHNE Befristung bleibt offen, auch nach einem großen Zeitsprung", async () => {
    // Der Normalfall darf nicht mitgefangen werden: „keine Befristung" ist der gültige Zustand
    // jedes regulären Kontos, kein Datenloch. Ein Vorgabewert oder eine Prüfung, die `undefined`
    // wie „abgelaufen" behandelt, sperrte mit einem Schlag die ganze Instanz aus.
    const k = baueKreis();
    await adminUndGast(k);

    k.vorstellen(365 * 24 * STUNDE);

    const angemeldet = await gastAnmelden(k);
    expect(angemeldet.token).toBeTruthy();
  });

  it("A4 — der Ablaufzeitpunkt selbst gilt schon als abgelaufen", async () => {
    // Die Grenze wird hier festgenagelt, damit sie niemand später still von `<=` auf `<` dreht.
    // Dieselbe Richtung, die der Sitzungsablauf im Bestand schon fährt
    // (`service.ts`: `session.expiresAt <= this.now()`), sonst hätte das Produkt zwei
    // Ablaufbegriffe mit unterschiedlicher Grenze.
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, new Date(k.jetzt()).toISOString());

    await expect(gastAnmelden(k)).rejects.toMatchObject({ code: "NOT_APPROVED" });
  });

  it("A5 — ein unlesbares Datum sperrt niemanden aus, verschwindet aber auch nicht", async () => {
    // Ehrlichkeit vor Strenge: ein kaputter Wert ist ein Fehler der Datenhaltung, keine Aussage
    // über den Menschen davor. Er darf niemanden auf Verdacht aussperren — und er darf nicht
    // schweigend durchgehen, sonst sucht ihn nie jemand.
    const k = baueKreis();
    const { gast } = await adminUndGast(k);
    await befriste(k, gast.id, "morgen");

    const angemeldet = await gastAnmelden(k);
    expect(angemeldet.token).toBeTruthy();

    const vermerke = await k.audit.list({
      action: "user.access-expiry-unreadable",
      target: gast.id,
    });
    expect(vermerke).toHaveLength(1);
    expect(vermerke[0]?.payload).toMatchObject({ accessExpiresAt: "morgen" });
  });

  it("A5b — dieselbe Regel gilt lesend wie schreibend", async () => {
    // JOB 3665 R2: Der Setzer weist mehrdeutige Schreibweisen ab (C7). Träfe die Ablaufprüfung eine
    // ANDERE Entscheidung, könnte ein Wert, den der Setzer nie durchgelassen hätte — von Hand in
    // die Datenbank geschrieben, aus einer älteren Fassung übrig —, trotzdem jemanden aussperren,
    // und zwar an einem Tag, den niemand so gemeint hat. Es gibt deshalb EINEN Begriff von
    // „lesbarer Ablaufwert", und diese Werte gehören nicht dazu.
    for (const unlesbar of ["09/12/2026", "2026-09-11", "2026-09-11T12:00:00", ""]) {
      const k = baueKreis();
      const { gast } = await adminUndGast(k);
      await befriste(k, gast.id, unlesbar);
      k.vorstellen(365 * 24 * STUNDE);

      const angemeldet = await gastAnmelden(k);
      expect(angemeldet.token, `„${unlesbar}" hat ausgesperrt`).toBeTruthy();
      expect(await vorgaenge(k, "user.access-expiry-unreadable", gast.id)).toBe(1);
      expect(await vorgaenge(k, "user.access-expired", gast.id)).toBe(0);
    }
  });

  it("A6 — der reguläre Bestand schreibt keinen Ablauf-Vermerk", async () => {
    // Gegenrichtung zu A5 und zum Vorgang aus B5: Ein Protokoll, das bei JEDER Anmeldung eine
    // Zeile über den Ablauf schriebe, wäre als Prüfpfad wertlos.
    const k = baueKreis();
    const { gast } = await adminUndGast(k);

    await gastAnmelden(k);

    expect(await vorgaenge(k, "user.access-expired", gast.id)).toBe(0);
    expect(await vorgaenge(k, "user.access-expiry-unreadable", gast.id)).toBe(0);
  });
});
