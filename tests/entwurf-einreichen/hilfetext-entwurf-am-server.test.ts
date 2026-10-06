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
//
// Aufnahme entwurf-in-gemeinsamen-pool-geben (R-2099, Kriterium „Hilfetext"): der Pool ist jetzt
// gebaut. Der Satz sagt deshalb BEIDES — standardmäßig privat UND bewusst teilbar — samt der Folge
// (alle mit Schreibrecht sehen ihn mit Namen und können fortsetzen, einreichen und löschen bleibt
// beim Autor). Er steht unter `entwurfspool.saveDraftHelp.body`, weil der alte Wert eingefroren ist
// (`texte/entwurfspool.ts`). Gemessen wird der Schlüssel, den die Fläche WIRKLICH liest
// (`captureHelp("saveDraftHelp").bodyKey`), nicht ein fest verdrahteter Name. Das Verbot eines
// Pool-Satzes ist entfallen; geblieben ist: kein „Niemand", keine Admin-Ausnahme, keine
// Browser-Ablage. Gegenprobe: mit dem bisherigen Wert (ohne „teilen"/„Pool") sind alle drei
// Sprachfälle rot.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { captureHelp } from "../../apps/web/src/lib/captureHelp";

const FALL = {
  de: {
    falsch: [/browser/i, /lokal/i, /oben auf der seite/i, /niemand/i, /administrator/i],
    server: /server/i,
    nurDu: /Nur du siehst ihn, solange du ihn nicht bewusst teilst/,
    privat: /privat auf dem Server/,
    geraete: /auf jedem deiner Geräte/,
    pool: /einzelnen Entwurf bewusst in den gemeinsamen Pool geben/,
    folge: /alle mit Schreibrecht mit deinem Namen und können ihn fortsetzen/,
    nurAutor: /einreichen und löschen kannst ihn weiterhin nur du/,
  },
  en: {
    falsch: [/browser/i, /local/i, /top of (this|the) page/i, /nobody/i, /administrator/i],
    server: /server/i,
    nurDu: /only you can see it unless you deliberately share it/,
    privat: /privately on the server/,
    geraete: /on any of your devices/,
    pool: /deliberately put a single draft into the shared pool/,
    folge: /all users with write access see it with your name and can continue it/,
    nurAutor: /only you can still submit or delete it/,
  },
  nl: {
    falsch: [/browser/i, /lokaal/i, /boven aan de pagina/i, /niemand/i, /beheerder/i],
    server: /server/i,
    nurDu: /alleen jij ziet het, tenzij je het bewust deelt/,
    privat: /privé op de server/,
    geraete: /op elk van je apparaten/,
    pool: /één concept bewust in de gedeelde pool zetten/,
    folge: /alle gebruikers met schrijfrechten het met jouw naam en kunnen ze het voortzetten/,
    nurAutor: /indienen en verwijderen kun alleen jij/,
  },
} as const;

describe("„Entwurf speichern“ — standardmäßig privat am Server, bewusst in den Pool teilbar", () => {
  const schluessel = captureHelp("saveDraftHelp").bodyKey;

  it("die Fläche liest den neuen Schlüssel, nicht den eingefrorenen alten", () => {
    expect(schluessel).toBe("entwurfspool.saveDraftHelp.body");
  });

  for (const [sprache, fall] of Object.entries(FALL)) {
    it(`${sprache}: privat als Standard, Server, alle Geräte, bewusst teilbar mit Folge — kein „niemand“, keine Admin-Ausnahme`, () => {
      const t = i18n.getFixedT(sprache);
      const text = t(schluessel);
      expect(text).not.toBe(schluessel);
      for (const muster of fall.falsch) {
        expect(text, `${sprache}: ${muster}`).not.toMatch(muster);
      }
      expect(text).toMatch(fall.server);
      expect(text).toMatch(fall.nurDu);
      expect(text).toMatch(fall.privat);
      expect(text).toMatch(fall.geraete);
      expect(text).toMatch(fall.pool);
      expect(text).toMatch(fall.folge);
      expect(text).toMatch(fall.nurAutor);
      // Der Ort heisst genau wie der Menüpunkt — aus DEM Schlüssel, nicht abgeschrieben.
      expect(text).toContain(t("mob.drafts"));
    });
  }
});
