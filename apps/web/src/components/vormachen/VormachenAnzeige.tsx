// ================================================================================================
// produkt:20261011:peter-p06 — DIE SICHTBARE LERNANZEIGE MIT SOFORTIGER PAUSE (P06-AC02).
// ================================================================================================
//
// Solange eine Lernsitzung offen ist, steht auf JEDER Seite JEDES Tabs dieses Browsers unten
// links, dass mitgeschrieben wird (oder dass pausiert ist), mit einem Knopf, der sofort pausiert
// bzw. fortsetzt. Der Merker ist je Konto im Browserspeicher (`lib/vormachenAnzeige.ts`) und
// übersteht das Schließen des Starttabs.
//
// SICHTBARKEIT IST DIE BEDINGUNG DES MITSCHREIBENS: die Anzeige meldet beim Laden und danach alle
// `PULS_MS` (`GET /api/me/vormachen?anzeige=klarwerk_web`), dass der Lernzustand HIER sichtbar ist.
// Der Server schreibt nur für genau diese Anmeldesitzung und nur bis kurz nach der letzten Meldung
// mit. Ist die Anzeige fort — Tab zu, anderes Gerät, Word-Panel —, wird nichts gespeichert.
//
// MITSCHREIBEN VON SEITENWECHSELN: nur, wenn die Person beim Start „Klarwerk im Browser" UND den
// Vorgang „Seite öffnen" gewählt hat und die Sitzung lernt — dann geht bei jedem Seitenwechsel der
// Pfad (ohne Suchanfrage und ohne Seiteninhalt) als Beobachtung an den Server. Sonst nichts:
// keine Eingaben, keine Klicks, keine Bildschirminhalte. Der Server weist alles Nicht-Gewählte ab.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { type Lernsitzung, vormachenApi } from "../../api/vormachen";
import { useSession } from "../../app/AuthContext";
import { meldeVormachen, useVormachenStand } from "../../lib/vormachenAnzeige";
import { Button } from "../ui";

/** Abstand der Sichtbarkeitsmeldungen — deutlich unter der Gültigkeit am Server (60 s). */
const PULS_MS = 20_000;

export function VormachenAnzeige(): JSX.Element | null {
  const { t } = useTranslation();
  const { user } = useSession();
  const kontoId = user?.id ?? null;
  const { aktiv, fassung } = useVormachenStand(kontoId);
  const { pathname } = useLocation();
  const [sitzung, setSitzung] = useState<Lernsitzung | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [puls, setPuls] = useState(0);
  const letzterPfad = useRef<string | null>(null);

  // `fassung` und `puls` sind Anlässe, keine gelesenen Werte: jede gemeldete Änderung und jeder
  // Puls liest neu und meldet dabei die Sichtbarkeit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: bewusst auf jede Änderung und jeden Puls neu lesen.
  useEffect(() => {
    if (!aktiv) {
      setSitzung(null);
      return;
    }
    let abgemeldet = false;
    vormachenApi
      .uebersicht("klarwerk_web")
      .then((u) => {
        if (abgemeldet) {
          return;
        }
        const offen = u.sitzungen.find((s) => s.zustand !== "abgebrochen") ?? null;
        setSitzung(offen);
        if (!offen) {
          meldeVormachen(false, kontoId);
        }
      })
      .catch(() => {
        // Nicht erreichbar: die Anzeige bleibt beim zuletzt bestätigten Stand.
      });
    return () => {
      abgemeldet = true;
    };
  }, [aktiv, fassung, puls, kontoId]);

  const offenId = sitzung?.id ?? null;
  useEffect(() => {
    if (offenId === null) {
      return;
    }
    const takt = window.setInterval(() => setPuls((p) => p + 1), PULS_MS);
    return () => window.clearInterval(takt);
  }, [offenId]);

  const id = sitzung?.id ?? null;
  const schreibtSeitenMit =
    sitzung !== null &&
    sitzung.host === "klarwerk_web" &&
    sitzung.zustand === "lernt" &&
    sitzung.vorgaenge.includes("seite_oeffnen");

  useEffect(() => {
    if (id === null || !schreibtSeitenMit) {
      letzterPfad.current = null;
      return;
    }
    // Die Seite, auf der das Mitschreiben beginnt, ist kein vorgemachter Schritt.
    if (letzterPfad.current === null || letzterPfad.current === pathname) {
      letzterPfad.current = pathname;
      return;
    }
    letzterPfad.current = pathname;
    vormachenApi
      .beobachte(id, { host: "klarwerk_web", vorgang: "seite_oeffnen", beschreibung: pathname })
      .then(() =>
        setSitzung((s) => (s && s.id === id ? { ...s, beobachtet: s.beobachtet + 1 } : s)),
      )
      .catch(() => {
        // Abgewiesen (etwa gerade pausiert): es wurde nichts mitgeschrieben.
      });
  }, [id, schreibtSeitenMit, pathname]);

  if (!sitzung) {
    return null;
  }
  const pausiert = sitzung.zustand === "pausiert";
  const umschalten = async (): Promise<void> => {
    setLaeuft(true);
    try {
      const r = await vormachenApi.setzeZustand(sitzung.id, pausiert ? "lernt" : "pausiert");
      setSitzung(r.sitzung);
      meldeVormachen(true, kontoId);
    } catch {
      // Der angezeigte Zustand bleibt der des Servers.
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <section
      aria-label={t("vormachen.anzeige.region")}
      data-testid="vormachen-anzeige"
      data-zustand={sitzung.zustand}
      className="fixed bottom-4 left-4 z-40 flex items-center gap-3 rounded-btn border border-hairline bg-surface px-3 py-2 text-[12.5px] shadow-sm"
    >
      {/* `<output>` trägt implizit role="status" — die Hausform der ruhigen Meldezeile. */}
      <output aria-live="polite">
        {pausiert
          ? t("vormachen.zustand.pausiert")
          : t("vormachen.zustand.lernt", { anzahl: sitzung.beobachtet })}
      </output>
      {/* EQF-06-K01: der zulässige Umfang dieser Lernsitzung, dauerhaft neben dem Zustand. */}
      <span data-testid="vormachen-anzeige-umfang" className="text-muted">
        {t("vormachen.anzeige.umfang", {
          anwendung: t(`vormachen.host.${sitzung.host}`),
          vorgaenge: sitzung.vorgaenge.map((v) => t(`vormachen.vorgang.${v}`)).join(", "),
        })}
      </span>
      <Button
        variant={pausiert ? "primary" : "outline"}
        onClick={() => void umschalten()}
        disabled={laeuft}
        data-testid="vormachen-anzeige-pause"
      >
        {pausiert ? t("vormachen.fortsetzen") : t("vormachen.pause")}
      </Button>
    </section>
  );
}
