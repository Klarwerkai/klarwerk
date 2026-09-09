import { useTranslation } from "react-i18next";
import { useNavGuardOptional } from "../app/NavGuardContext";
import { STALE_BUNDLE_KEY } from "../lib/staleChunk";
import { useNeueVersionVerfuegbar } from "../lib/versionswaechter";

// ================================================================================================
// JOB 3268 · D1-R — DIE EINE ZEILE, DIE DEM ALTEN TAB SAGT, DASS ER ALT IST.
// ================================================================================================
//
// EINE STELLE, RUHIG, OHNE MODAL (§5.2): eine schmale Zeile am oberen Rand mit höchstens 60 Zeichen
// und EINEM Knopf. Kein Dialog, der die Arbeit unterbricht, und ausdrücklich KEIN automatisches
// Neuladen — das wäre genau der stille Verlust, gegen den dieser Auftrag steht.
//
// WARUM SIE ALS ÜBERLAGERUNG HÄNGT UND NICHT IM KOPFBAND: die Zielpfade dieses Auftrags enthalten
// `App.tsx`, nicht `shell/Kopfband.tsx` — und das Kopfband ist bis auf den Pixel vermessen
// (`tests/design/zielbild-h1-huelle.test.ts`, 56 px, feste Punkteliste). Eine Zeile IM Fluss
// darüber verschöbe die ganze Hülle nach unten und machte diese Messungen rot. Die Überlagerung
// sitzt deshalb direkt UNTER dem Kopfband am rechten Rand: sichtbar, ohne ein Bedienelement zu
// verdecken, und sie verschwindet mit dem Neuladen von selbst. Sie liegt unter der Modalebene
// (z-40 wie Klara, Modal ist z-50), damit ein offener Dialog immer obenauf bleibt.
//
// DER KLICK GEHT DURCH DEN VORHANDENEN ENTWURFSSCHUTZ (§5.3). `guard()` aus dem Navigationswächter
// ist genau die Frage „darf die aktuelle Fläche jetzt verlassen werden?": ohne ungesicherte Eingabe
// führt es sofort weiter, mit ungesicherter Eingabe stellt es die sichtbare Rückfrage mit
// „Entwurf speichern" (`erfassen/Blatt.tsx:1234-1252` meldet den Schutz an). Hier entsteht also
// KEINE zweite Rückfrage neben der bestehenden — die eine wird benutzt.
//
// ------------------------------------------------------------------------------------------------
// JOB 3390 · LADEFEHLER-ALTER-TAB — DIESELBE KARTE, ZWEITE FUNDSTELLE.
// ------------------------------------------------------------------------------------------------
//
// Pedis Befund vom 09.09.: der alte Tab klickt auf „Verwaltung", die Seite wird ERST DANN nachgeladen
// und ihre Chunk-Adresse gibt es nicht mehr. Der Versionswächter oben kann das nicht auffangen — er
// fragt `/health` alle fünf Minuten, und Pedi klickte in der Lücke. Die Fehlergrenze fängt den
// Ladefehler (`components/ErrorBoundary.tsx`) und braucht genau dieselbe Aussage und denselben
// Knopf wie diese Zeile hier.
//
// ZWEI ORTE, EIN BAUTEIL: `NeueVersionAngebot` unten trägt den Satz, den Knopf und den geschützten
// Klick EINMAL. Der zweite Ort schreibt sie nicht ab — eine zweite Karte mit abgeschriebenem Text
// wäre die Halbheit, die dieser Auftrag ausschliesst. Was sich unterscheidet, ist allein die FORM:
// hier die Überlagerung, dort die Karte im Seitenfluss. Beide Formen stehen deshalb als je EIGENER
// Zweig mit fester Klassenkette da (Klassenbindungs-Wächter mega47/JOB 1181) und tragen je eigene
// Testmarken — fallen Versionswächter und Ladefehler zusammen, stehen nie zwei gleiche Marken im
// Baum.

/** Wo das Angebot steht. Zwei Orte, zwei Formen, ein Satz und ein Knopf. */
type Ort = "ueberlagerung" | "ladefehler";

export function NeueVersionAngebot({ ort }: { ort: Ort }): JSX.Element {
  const { t } = useTranslation();
  // JOB 3390: NICHT `useNavGuard()` — die Fehlergrenze rendert dieses Bauteil als letzte
  // Auffanglinie, und ein Wurf von hier hätte keine Grenze mehr über sich (Begründung an
  // `useNavGuardOptional` in `app/NavGuardContext.tsx`). Ohne Anbieter kann kein Entwurfsschutz
  // angemeldet sein, also wird direkt geladen.
  const navGuard = useNavGuardOptional();
  const neuLaden = (): void => {
    if (navGuard) {
      navGuard.guard(() => window.location.reload());
      return;
    }
    window.location.reload();
  };

  if (ort === "ladefehler") {
    return (
      // Im SEITENFLUSS, nicht als Überlagerung: an dieser Stelle ist die Seite darunter gar nicht
      // erschienen — es gibt nichts zu überlagern, und die Karte ist das Einzige, was dasteht.
      // Rahmen und Masse wie `ErrorCard` (`ErrorBoundary.tsx:39-40`), aber im ruhigen Ton der Zeile
      // oben statt im Kritisch-Rot: das hier ist keine Störung, sondern eine Auslieferung.
      <div data-testid="ladefehler-neue-version" className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-card border border-hairline bg-surface p-5">
          <h2 className="text-[15px] font-semibold text-text">{t("version.neu.hinweis")}</h2>
          {/* Der vorhandene, dreisprachige Satz aus `lib/staleChunk.ts` — KEIN neuer Text, und
              ausdrücklich KEIN roher Fehlertext: die Chunk-Adresse bleibt in der Konsole. */}
          <p className="mt-1.5 text-[13px] leading-relaxed text-text">{t(STALE_BUNDLE_KEY)}</p>
          <button
            type="button"
            data-testid="ladefehler-neue-version-neu-laden"
            onClick={neuLaden}
            className="mt-3 rounded-btn bg-ink px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90"
          >
            {t("version.neu.neuLaden")}
          </button>
        </div>
      </div>
    );
  }

  return (
    // `<output aria-live="polite">` ist die Hausform der ruhigen Meldezeile (vgl.
    // `components/bibliothek/AuffrischungHinweis.tsx:34`): sie meldet sich höflich, ohne den Fokus
    // zu stehlen — ein `role="status"` an einem `<div>` wäre dieselbe Aussage mit weniger Semantik.
    <output
      data-testid="versions-hinweis"
      aria-live="polite"
      className="fixed right-4 top-[64px] z-40 flex items-center gap-3 rounded-card border border-hairline bg-surface px-3 py-2 text-[13px] text-text shadow-popover"
    >
      <span>{t("version.neu.hinweis")}</span>
      <button
        type="button"
        data-testid="versions-hinweis-neu-laden"
        onClick={neuLaden}
        className="shrink-0 rounded-btn bg-ink px-2.5 py-1 text-[12.5px] font-semibold text-page hover:opacity-85"
      >
        {t("version.neu.neuLaden")}
      </button>
    </output>
  );
}

export function VersionsHinweis(): JSX.Element | null {
  const neueVersion = useNeueVersionVerfuegbar();

  if (!neueVersion) {
    return null;
  }

  return <NeueVersionAngebot ort="ueberlagerung" />;
}
