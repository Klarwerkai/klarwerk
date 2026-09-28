// ================================================================================================
// AUFNAHME 20260922 · DIE REGEL FÜR JEDEN ALTFALL — FESTGELEGT, BEVOR EINE DATENBANK GEFRAGT WIRD.
// ================================================================================================
//
// Diese Datei läuft im schnellen Tor und braucht keine Datenbank. Sie prüft, dass die im Saatplan
// (`suchsichtbarkeit-altbestand-fixture.ts`) von Hand festgehaltene Regel je Altfall genau die
// BESTEHENDE ist: `darfSehen` und die Referenzform des Trims (`trifftZu`) sagen für jeden Fall,
// jede Rolle und jeden Betrachter dasselbe wie das Feld `regel`. Ändert jemand die Auslegung einer
// Altstufe oder eines Altautors, wird es hier rot — nicht erst im Integrationslauf.
//
// Die Gegenseite (PostgreSQL) prüft `suchsichtbarkeit-altbestand-paritaet.integration.test.ts`.
import { describe, expect, it } from "vitest";
import type { SessionUser } from "../../services/app/src/http";
import { darfSehen, sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import type { Role } from "../../services/auth";
import {
  type KnowledgeObject,
  isConfidential,
  normalizeConfidentiality,
} from "../../services/knowledge-object";
import { can } from "../../services/rbac";
import {
  ABWEICHUNGSHYPOTHESEN,
  BESTAND,
  BETRACHTER,
  OHNE_KENNUNG,
  ZAHLKENNUNG,
  mitAltform,
  siehtNachRegel,
} from "./suchsichtbarkeit-altbestand-fixture";

const ROLLEN: readonly Role[] = ["viewer", "experte", "controller", "admin"];

/** Die Fakten eines Saatlings nach Anlage und Altform — so, wie sie die Ablage danach trägt. */
function fakten(marke: string): KnowledgeObject {
  const saat = BESTAND.find((s) => s.marke === marke);
  if (!saat) {
    throw new Error(`unbekannte Marke ${marke}`);
  }
  const angelegt = {
    id: saat.marke,
    author: saat.autor,
    confidentiality: saat.stufe,
  } as KnowledgeObject;
  return saat.altform ? mitAltform(angelegt, saat.altform) : angelegt;
}

describe("Aufnahme 20260922 · Suchsichtbarkeit bei Altdaten — die bestehende Regel je Fall", () => {
  it("der Saatplan deckt jeden Altfall aus BEN 4359 ab und ist nach Trust geordnet", () => {
    const felder = new Set(BESTAND.flatMap((s) => (s.altform ? [s.altform.feld] : [])));
    expect([...felder].sort()).toEqual(["author", "confidentiality", "deletedAt"]);
    const trust = BESTAND.map((s) => s.trust);
    expect(trust).toEqual([...trust].sort((a, b) => b - a));
    expect(new Set(BESTAND.map((s) => s.marke)).size).toBe(BESTAND.length);
    // Jede Hypothese zeigt auf einen Saatling mit Altform und ist als ungemessen gekennzeichnet.
    for (const hypothese of ABWEICHUNGSHYPOTHESEN) {
      expect(
        BESTAND.find((s) => s.marke === hypothese.marke)?.altform,
        hypothese.kennung,
      ).toBeDefined();
      expect(hypothese.stand, hypothese.kennung).toBe("abgeleitet, ungemessen");
    }
  });

  it("darfSehen und trifftZu entsprechen für jeden Fall, jede Rolle und jeden Betrachter der festgelegten Regel", () => {
    let geprueft = 0;
    for (const saat of BESTAND) {
      const ko = fakten(saat.marke);
      for (const role of ROLLEN) {
        for (const id of BETRACHTER) {
          const user: SessionUser = { id, role };
          const soll = siehtNachRegel(saat.regel, id, can(role, "ko.validate"));
          const lage = `${saat.marke} (${saat.quelle}) · ${role}/${id || "(leer)"}`;
          expect(darfSehen(user, ko), `darfSehen ${lage}`).toBe(soll);
          // Die Referenzform des SQL-Trims: Papierkorb davor. Kein Altfall mit `deletedAt` hier
          // ist nach der Referenz getrasht — '' und null sind falsy.
          expect(sqlSichtbarkeitFuer(user).trifftZu(ko), `trifftZu ${lage}`).toBe(soll);
          geprueft += 1;
        }
      }
    }
    expect(geprueft).toBe(BESTAND.length * ROLLEN.length * BETRACHTER.length);
  });

  it("jede Altstufe ist nach bestehender Regel 'intern' — die benannte Grenze aus sichtbarkeit.ts:39-43", () => {
    const altstufen = BESTAND.filter((s) => s.altform?.feld === "confidentiality");
    expect(altstufen.length).toBeGreaterThanOrEqual(6);
    for (const saat of altstufen) {
      const ko = fakten(saat.marke);
      expect(isConfidential(ko.confidentiality), saat.marke).toBe(false);
      expect(normalizeConfidentiality(ko.confidentiality), saat.marke).toBe("intern");
      expect(saat.regel, `${saat.marke}: Regel und Auslegung laufen auseinander`).toBe("jeder");
    }
  });

  it("ein unbrauchbarer Autor ist keine Autorschaft — auch nicht für einen Betrachter ohne Kennung", () => {
    for (const marke of ["autorLeer", "autorFehlt", "autorNull"]) {
      for (const role of ["viewer", "experte"] as const) {
        expect(darfSehen({ id: OHNE_KENNUNG, role }, fakten(marke)), marke).toBe(false);
      }
    }
    // Der Zahlenautor ist nach der Referenz keine Autorschaft — auch für die gleichlautende Kennung.
    expect(darfSehen({ id: ZAHLKENNUNG, role: "experte" }, fakten("befundAutorZahl"))).toBe(false);
  });
});
