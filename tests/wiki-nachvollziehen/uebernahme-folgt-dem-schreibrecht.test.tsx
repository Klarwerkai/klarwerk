// @vitest-environment jsdom
// ================================================================================================
// JOB 4213 R3 · DER ÜBERNAHMEKNOPF STEHT NUR, WO DIE ROUTE IHN AUCH ANNIMMT.
// ================================================================================================
//
// DER BEFUND, GEMESSEN VON BEN AN RUNDE 2: `BEN Rechte {"rolle":"experte","http":403,
// "error":"PROPOSAL_REQUIRED"}` — und gleichzeitig zeichnete die Oberfläche den Übernahmeknopf. Ein
// Knopf, der nur zu einer Absage führen kann, ist eine Sackgasse.
//
// DIE REGEL DER ROUTE (`services/app/src/routes/ko-routes.ts`, `case "revise"`):
//     `bestand?.status === "validiert" && !can(user.role, "users.manage")` → 403 PROPOSAL_REQUIRED
//
// WIE DIESE DATEI SIE FESTHÄLT, und warum das keine Abschrift ist: sie mountet die ECHTE Fläche für
// JEDE Rolle und hält das Ergebnis gegen `can(rolle, "users.manage")` aus dem ECHTEN rbac-Modul.
// Eine Liste im Client (`darfFreigegebenesDirektAendern` in `MehrAbschnitte.tsx`) ist unvermeidlich
// — `can()` liegt hinter einer Modulgrenze, die `apps/web` nicht überschreitet, dieselbe Lage wie
// bei `RW_FREIGABE_ROLLEN` in `BibliothekLesen.tsx`. Aber sie ist hier GEMESSEN und nicht behauptet:
// wer die Rechtematrix ändert, wird an dieser Datei rot.
//
// UND DIE ANDERE HÄLFTE: am NICHT freigegebenen Objekt darf sich nichts geändert haben. Sonst hätte
// die Korrektur den Weg für alle zugemacht, statt ihn für die falsche Rolle zuzumachen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import type { Role } from "../../services/auth";
import { ROLE_PERMISSIONS, can } from "../../services/rbac/src/policy";
import {
  abbauen,
  ausloesen,
  fassungsInhalt,
  fassungsKnopf,
  flaecheMit,
  i18n,
  text,
  uebernahmeKnopfOderNull,
} from "./flaeche";
import { dreiFassungen, netz, zuruecksetzen } from "./netz";

/**
 * ALLE Rollen dieses Systems — AUS der Rechtematrix gelesen, nicht danebengeschrieben.
 *
 * RUNDE 4: hier stand eine Literalliste. Sie war nicht falsch, aber sie war eine zweite Wahrheit
 * über dieselbe Menge — und genau gegen solche Abschriften tritt diese Datei an. Wer künftig eine
 * Rolle hinzufügt, bekommt sie hier von allein, und der Fall unten misst sie mit.
 */
const ROLLEN = Object.keys(ROLE_PERMISSIONS) as Role[];

beforeEach(() => {
  zuruecksetzen();
  netz.fassungen = dreiFassungen();
});

afterEach(() => {
  abbauen();
  zuruecksetzen();
});

describe("JOB 4213 · A — am FREIGEGEBENEN Eintrag folgt der Knopf dem echten Schreibrecht", () => {
  for (const rolle of ROLLEN) {
    const darf = can(rolle, "users.manage");
    it(`${rolle}: Knopf ${darf ? "steht" : "steht NICHT"} — wie can(rolle, users.manage) es sagt`, async () => {
      netz.rolle = rolle;
      await flaecheMit(undefined, { status: "validiert" });
      await ausloesen(fassungsKnopf(1));

      const knopf = uebernahmeKnopfOderNull(1);
      expect(
        knopf !== null,
        darf
          ? `${rolle} darf einen freigegebenen Stand direkt ersetzen, bekommt aber keinen Knopf`
          : `${rolle} bekommt einen Knopf, den die Route mit 403 PROPOSAL_REQUIRED abweist`,
      ).toBe(darf);
    });
  }

  it("wer nicht darf, bekommt den GRUND und den Weg — keine verschlossene Tür", async () => {
    netz.rolle = "experte";
    await flaecheMit(undefined, { status: "validiert" });
    await ausloesen(fassungsKnopf(1));
    expect(text(fassungsInhalt(1)), "die Tür ist zu und niemand sagt warum").toContain(
      i18n.t("ko.snapshotRestoreNeedsRelease"),
    );
  });

  it("der `viewer` behält seinen eigenen, engeren Satz — er darf gar nicht bearbeiten", async () => {
    // Zwei verschiedene Gründe, zwei verschiedene Sätze: „du darfst hier nichts ändern" ist etwas
    // anderes als „du darfst ändern, aber einen freigegebenen Stand nicht direkt ersetzen".
    netz.rolle = "viewer";
    await flaecheMit(undefined, { status: "validiert" });
    await ausloesen(fassungsKnopf(1));
    expect(text(fassungsInhalt(1))).toContain(i18n.t("ko.snapshotRestoreNoRight"));
    expect(text(fassungsInhalt(1))).not.toContain(i18n.t("ko.snapshotRestoreNeedsRelease"));
  });
});

describe("JOB 4213 · B — KALIBRIERUNG: am OFFENEN Eintrag ändert sich nichts", () => {
  for (const rolle of ROLLEN) {
    const darfBearbeiten = rolle !== "viewer";
    it(`${rolle}: Knopf ${darfBearbeiten ? "steht" : "steht NICHT"} wie bisher`, async () => {
      netz.rolle = rolle;
      await flaecheMit(undefined, { status: "offen" });
      await ausloesen(fassungsKnopf(1));
      expect(
        uebernahmeKnopfOderNull(1) !== null,
        `${rolle} am offenen Eintrag: der Weg hat sich verändert`,
      ).toBe(darfBearbeiten);
    });
  }
});
