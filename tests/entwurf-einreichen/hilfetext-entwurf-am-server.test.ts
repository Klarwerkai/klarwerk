// ==================================================================================================
// AUFNAHME gesamt-entwurf-einreichen · Ben Runde 1 — DER ERKLÄRSATZ ZU „ENTWURF SPEICHERN" SAGT DIE
// WAHRHEIT ÜBER DEN ORT.
// ==================================================================================================
//
// `chelp.saveDraftHelp.body` ist die U1-Erklärung (R-0004/R-1811) — im Arbeitsraum sichtbar an den
// Knöpfen, auf dem Blatt unter „?". Bis Lauf :2 sagte sie in allen drei Sprachen „lokal in deinem
// Browser" und „oben auf der Seite". Beides stimmt nicht: der Entwurf geht an `POST /api/drafts`
// und ist deshalb an einem anderen Gerät fortsetzbar (R-0026, R-1689), und sein Ort ist der
// Menüpunkt „Meine Entwürfe" (`mob.drafts`, JOB 3503). Wer der Erklärung glaubt, sucht seinen
// Entwurf am Rechner nicht, den er am Telefon begonnen hat.
//
// Gegenprobe: am Basisstand `1eb17b73` ist jede der drei Sprachen hier rot („lokal"/„locally"/
// „lokaal" und kein Server-Wort).
//
// Ben Runde 2 (F3): auch „Niemand sieht ihn" stimmte nicht — Administratoren sehen jeden lebenden
// Entwurf (`visibleDraftsFor`). Der Satz nennt jetzt genau diese Rechte. Der zweite Block prüft
// die RECHTE SELBST am Server (Autorin, Admin, andere Schreibende), damit Text und Wirklichkeit
// nicht wieder auseinanderlaufen: kippt die Sichtbarkeit, wird er rot, und der Satz ist neu zu
// schreiben. Gegenprobe: mit dem Satz aus Runde 1 sind die drei Sprachfälle rot („Niemand").
//
// Lauf :3 — Entscheidung Pedi (debbb8e8, „Beides"): der Standardfall ist der PRIVATE Entwurf am
// Server, fortsetzbar auf ALLEN eigenen Geräten. Der Satz nennt beides ausdrücklich (`privat`,
// `geraete`); ein Pool-Satz („für alle sichtbar", R-2099) gehört einem eigenen Auftrag und ist hier
// verboten. Gegenprobe: mit dem Satz aus Lauf :2 („an einem anderen Gerät", ohne „privat") sind
// die drei Sprachfälle rot.
//
// Lauf :3 Runde 2 — Ben B1: der Satz aus Runde 1 nannte „Außer dir sehen ihn nur Administratoren"
// und schrieb damit genau die Ausnahme fest, die `debbb8e8` ausschliesst. Der Server gibt fremde
// Entwürfe jetzt auch Administratoren nicht mehr heraus (`canSeeDraft`), der Satz sagt „Nur du
// siehst ihn". Die Rechteprobe dazu steht in `entwurf-ist-privat.test.ts`. Gegenprobe: mit dem
// Satz aus Runde 1 sind die drei Sprachfälle rot („administrator"/„beheerder").
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

const FALL = {
  de: {
    falsch: [
      /browser/i,
      /lokal/i,
      /oben auf der seite/i,
      /niemand/i,
      /alle[nm]? (kolleg|schreib)/i,
      /administrator/i,
    ],
    server: /server/i,
    nurDu: /Nur du siehst ihn/,
    privat: /privat auf dem Server/,
    geraete: /auf jedem deiner Geräte/,
  },
  en: {
    falsch: [
      /browser/i,
      /local/i,
      /top of (this|the) page/i,
      /nobody/i,
      /everyone|all colleagues/i,
      /administrator/i,
    ],
    server: /server/i,
    nurDu: /only you can see it/,
    privat: /privately on the server/,
    geraete: /on any of your devices/,
  },
  nl: {
    falsch: [
      /browser/i,
      /lokaal/i,
      /boven aan de pagina/i,
      /niemand/i,
      /iedereen|alle collega/i,
      /beheerder/i,
    ],
    server: /server/i,
    nurDu: /alleen jij ziet het/,
    privat: /privé op de server/,
    geraete: /op elk van je apparaten/,
  },
} as const;

describe("chelp.saveDraftHelp.body — Entwürfe liegen am Server und unter „Meine Entwürfe“", () => {
  for (const [sprache, fall] of Object.entries(FALL)) {
    it(`${sprache}: kein „im Browser“, kein „niemand“, keine Admin-Ausnahme — dafür privat, Server, alle Geräte, „nur du“ und der Menüname`, () => {
      const t = i18n.getFixedT(sprache);
      const text = t("chelp.saveDraftHelp.body");
      expect(text).not.toBe("chelp.saveDraftHelp.body");
      for (const muster of fall.falsch) {
        expect(text, `${sprache}: ${muster}`).not.toMatch(muster);
      }
      expect(text).toMatch(fall.server);
      expect(text).toMatch(fall.nurDu);
      expect(text).toMatch(fall.privat);
      expect(text).toMatch(fall.geraete);
      // Der Ort heisst genau wie der Menüpunkt — aus DEM Schlüssel, nicht abgeschrieben.
      expect(text).toContain(t("mob.drafts"));
    });
  }
});
