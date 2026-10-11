// ================================================================================================
// AKTIVE BEGLEITUNG (produkt:20261011:assistenz-aktive-beobachtung · BPA-05) — DIE OBERFLÄCHE.
// ================================================================================================
//
// Eine kompakte Statusleiste, die NICHT am Gespräch der Assistenz hängt: sie steht in der Hülle
// neben der Figur und bleibt sichtbar und bedienbar, wenn das Gespräch geschlossen ist (K3).
//
//   aus       → nur auf Seiten mit eingerichtetem Vorgang: ein Angebot mit EINEM Satzfeld
//               („Produktrecherche, 30 Minuten") und „Begleitung starten" (K1)
//   aktiv     → „Begleiten · Bereich · bis HH:MM", Zweck, Mikrofon/Video aus, Pause, Stopp
//   pausiert  → derselbe Platz mit Grund und „Fortsetzen" — Fortsetzen prüft Konto, Rechte, Ablauf
//   beendet   → ein Satz, dass der beobachtete Kontext verworfen ist
//
// Tastatur: Alt+Umschalt+P Pause/Fortsetzen, Alt+Umschalt+S Stopp — über `event.code`, damit die
// Wahltaste auf dem Mac (die aus „p" ein „π" macht) die Kürzel nicht verschluckt.
//
// Dauerhaft liegt nur die FREIGABE (Zweck, Bereich, Endpunkt) im Sitzungsspeicher dieses Tabs —
// damit ein Neuladen sie nicht verlängert, sondern pausiert wiederfindet (K7). Bewusst übernommene
// Notizen liegen getrennt daneben und überleben den Stopp; gelesene Feldwerte liegen nirgends (K8).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "../../app/AuthContext";
import { useAssistenzT } from "../../lib/assistenzProfil";
import {
  KONTEXT_EREIGNIS,
  SYSTEM_EREIGNIS,
  eingerichteteBereiche,
  istSystemereignis,
  liesVorgang,
} from "./adapter";
import {
  AUS,
  type Begleitung,
  type Bereich,
  type Freigabe,
  type KontextEreignis,
  type Notiz,
  auskunft,
  beschaeftigt,
  fortsetzen,
  leseAuftrag,
  naechsterHinweis,
  nimmKontext,
  pausiere,
  pruefeAblauf,
  sicherung,
  starte,
  stoppe,
  systemereignis,
  verwirf,
  wiederherstellen,
} from "./kern";

const FREIGABE_SCHLUESSEL = "klarwerk.begleitung.freigabe";
const NOTIZ_PRAEFIX = "klarwerk.begleitung.notizen.";
/** Solange nach einer Eingabe gewartet wird, bevor gelesen und geprüft wird. */
const TIPPPAUSE_MS = 1500;
/** Takt für Ablauf und Seitenwechsel, auch ohne Eingabe. */
const TAKT_MS = 5000;
const RAHMEN =
  "fixed bottom-4 left-4 z-40 max-w-sm rounded-lg border border-[var(--kw-line,#d0d5dd)] bg-[var(--kw-surface,#fff)] p-3 text-sm shadow-lg";

/** Verborgener Tab: der Nutzer ist nirgends im Bereich — es wird nichts gelesen. */
function nirgends(konto: string): KontextEreignis {
  return { quelle: { art: "vorgang", kennung: "" }, konto, felder: [] };
}

function lies<T>(schluessel: string): T | null {
  try {
    const roh = window.sessionStorage.getItem(schluessel);
    return roh ? (JSON.parse(roh) as T) : null;
  } catch {
    return null;
  }
}

function schreib(schluessel: string, wert: unknown): void {
  try {
    if (wert === null) {
      window.sessionStorage.removeItem(schluessel);
    } else {
      window.sessionStorage.setItem(schluessel, JSON.stringify(wert));
    }
  } catch {
    // ohne Sitzungsspeicher gilt die Freigabe nur bis zum Neuladen — kürzer, nie länger
  }
}

function ladeNotizen(konto: string | null): Notiz[] {
  return konto ? (lies<Notiz[]>(`${NOTIZ_PRAEFIX}${konto}`) ?? []) : [];
}

function neueId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return typeof c?.randomUUID === "function"
    ? c.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export interface KlaraBegleitungProps {
  /** Das angemeldete Konto; `null` heißt abgemeldet. */
  readonly konto: string | null;
  /** Ergebnis der aktuellen Rechteprüfung. Ohne Anmeldung nie erlaubt. */
  readonly darfBegleiten: boolean;
  readonly jetzt?: () => number;
}

/** Die Begleitung in der Hülle — Konto und Rechte aus der echten Sitzung. */
export function KlaraBegleitungImProdukt(): JSX.Element | null {
  const { user } = useSession();
  return <KlaraBegleitung konto={user?.id ?? null} darfBegleiten={user !== null} />;
}

export function KlaraBegleitung({
  konto,
  darfBegleiten,
  jetzt = Date.now,
}: KlaraBegleitungProps): JSX.Element | null {
  const { t, i18n } = useAssistenzT();
  const [b, setB] = useState<Begleitung>(() => {
    const gesichert = lies<Freigabe>(FREIGABE_SCHLUESSEL);
    return gesichert && gesichert.konto === konto ? wiederherstellen(gesichert, jetzt()) : AUS;
  });
  // Notizen gehören einem Konto: wechselt es, wird die Liste des neuen Kontos geladen — die alte
  // wird nie unter dem neuen Konto geschrieben.
  const [notizStand, setNotizStand] = useState(() => ({ konto, liste: ladeNotizen(konto) }));
  if (notizStand.konto !== konto) {
    setNotizStand({ konto, liste: ladeNotizen(konto) });
  }
  const notizen = notizStand.konto === konto ? notizStand.liste : [];
  const setNotizen = (aendern: (alt: Notiz[]) => Notiz[]): void =>
    setNotizStand((s) => ({ konto: s.konto, liste: aendern(s.liste) }));
  const [bereiche, setBereiche] = useState<Bereich[]>(() => eingerichteteBereiche(document));
  const [satz, setSatz] = useState("");
  const [meldung, setMeldung] = useState<string | null>(null);
  const lage = useRef({ konto: konto ?? "", darfBegleiten });
  lage.current = { konto: konto ?? "", darfBegleiten };
  const aktuell = useRef(b);
  aktuell.current = b;
  const zeitgeber = useRef<number | null>(null);

  // Nur die Freigabe wird gesichert — nie Kontext, Hinweis oder Feldwerte.
  const freigabe = sicherung(b);
  useEffect(() => {
    schreib(FREIGABE_SCHLUESSEL, freigabe);
  }, [freigabe]);

  useEffect(() => {
    if (notizStand.konto) {
      const liste = notizStand.liste;
      schreib(`${NOTIZ_PRAEFIX}${notizStand.konto}`, liste.length > 0 ? liste : null);
    }
  }, [notizStand]);

  /** Liest den Vorgang (falls aktiv) und prüft danach, ob ein Hinweis fällig ist. */
  const abtasten = useCallback(
    (ereignis?: KontextEreignis) => {
      setB((alt) => {
        const zeit = jetzt();
        const lageJetzt = { ...lage.current, jetzt: zeit };
        let neu = pruefeAblauf(alt, zeit);
        if (neu.phase === "aktiv" && neu.freigabe) {
          const e =
            ereignis ??
            (document.hidden
              ? nirgends(lageJetzt.konto)
              : liesVorgang(document, neu.freigabe.bereich.kennung, lageJetzt.konto));
          neu = nimmKontext(neu, e, lageJetzt).begleitung;
        }
        return naechsterHinweis(neu, zeit);
      });
    },
    [jetzt],
  );

  // Konto- und Rechtewechsel pausieren sofort — nicht erst beim nächsten Lesen.
  useEffect(() => {
    setB((alt) => {
      if (!alt.freigabe || (alt.phase !== "aktiv" && alt.phase !== "pausiert")) {
        return alt;
      }
      if ((konto ?? "") !== alt.freigabe.konto) {
        return alt.grund === "kontowechsel" ? alt : systemereignis(alt, "kontowechsel");
      }
      if (!darfBegleiten && alt.phase === "aktiv") {
        return systemereignis(alt, "rechteentzug");
      }
      return alt;
    });
  }, [konto, darfBegleiten]);

  const aktiv = b.phase === "aktiv";

  // Eingaben im Bereich: erst nach der Tipppause lesen, damit kein Hinweis mitten ins Tippen fällt.
  // Beim Einschalten und nach jedem Fortsetzen wird sofort frischer Kontext gelesen.
  useEffect(() => {
    if (!aktiv) {
      return;
    }
    const beiEingabe = (): void => {
      setB((alt) => beschaeftigt(alt, jetzt() + TIPPPAUSE_MS));
      if (zeitgeber.current !== null) {
        window.clearTimeout(zeitgeber.current);
      }
      zeitgeber.current = window.setTimeout(() => abtasten(), TIPPPAUSE_MS + 50);
    };
    const takt = window.setInterval(() => abtasten(), TAKT_MS);
    const sicht = (): void => abtasten();
    document.addEventListener("input", beiEingabe, true);
    document.addEventListener("change", beiEingabe, true);
    document.addEventListener("visibilitychange", sicht);
    abtasten();
    return () => {
      document.removeEventListener("input", beiEingabe, true);
      document.removeEventListener("change", beiEingabe, true);
      document.removeEventListener("visibilitychange", sicht);
      window.clearInterval(takt);
      if (zeitgeber.current !== null) {
        window.clearTimeout(zeitgeber.current);
        zeitgeber.current = null;
      }
    };
  }, [aktiv, abtasten, jetzt]);

  // Host-Adapter (Browser, Nativanwendung) und Systemereignisse.
  useEffect(() => {
    const kontext = (e: Event): void => {
      const detail = (e as CustomEvent<KontextEreignis>).detail;
      if (detail && typeof detail === "object" && detail.quelle && Array.isArray(detail.felder)) {
        abtasten(detail);
      }
    };
    const system = (e: Event): void => {
      const art = (e as CustomEvent<{ ereignis?: unknown }>).detail?.ereignis;
      if (istSystemereignis(art)) {
        setB((alt) => systemereignis(alt, art));
      }
    };
    window.addEventListener(KONTEXT_EREIGNIS, kontext);
    window.addEventListener(SYSTEM_EREIGNIS, system);
    return () => {
      window.removeEventListener(KONTEXT_EREIGNIS, kontext);
      window.removeEventListener(SYSTEM_EREIGNIS, system);
    };
  }, [abtasten]);

  // Solange nichts läuft: eingerichtete Vorgänge auf der Seite finden (Seitenwechsel, Nachladen).
  useEffect(() => {
    if (b.phase !== "aus") {
      return;
    }
    const neu = (): void => {
      setBereiche((alt) => {
        const da = eingerichteteBereiche(document);
        return JSON.stringify(da) === JSON.stringify(alt) ? alt : da;
      });
    };
    neu();
    const beobachter = new MutationObserver(neu);
    beobachter.observe(document.body, { childList: true, subtree: true });
    return () => beobachter.disconnect();
  }, [b.phase]);

  const pauseOderFortsetzen = useCallback(() => {
    const alt = aktuell.current;
    if (alt.phase === "aktiv") {
      setMeldung(null);
      setB(pausiere(alt, "nutzer"));
      return;
    }
    if (alt.phase !== "pausiert") {
      return;
    }
    const r = fortsetzen(alt, { ...lage.current, jetzt: jetzt() });
    setMeldung(r.ok ? null : t(`begleitung.fehler.${r.fehler}`));
    setB(r.begleitung);
  }, [jetzt, t]);

  const stopp = useCallback(() => {
    setMeldung(null);
    setB((alt) => stoppe(alt));
  }, []);

  useEffect(() => {
    if (b.phase !== "aktiv" && b.phase !== "pausiert") {
      return;
    }
    const taste = (e: KeyboardEvent): void => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) {
        return;
      }
      if (e.code === "KeyP") {
        e.preventDefault();
        pauseOderFortsetzen();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        stopp();
      }
    };
    window.addEventListener("keydown", taste, true);
    return () => window.removeEventListener("keydown", taste, true);
  }, [b.phase, pauseOderFortsetzen, stopp]);

  const ende = useMemo(
    () =>
      b.freigabe
        ? new Date(b.freigabe.endetAm).toLocaleTimeString(i18n.language, {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    [b.freigabe, i18n.language],
  );

  const bereich = bereiche[0];
  const starten = (): void => {
    if (!bereich || !konto || !darfBegleiten) {
      return;
    }
    const r = starte(leseAuftrag(satz), bereich, { konto, jetzt: jetzt(), id: neueId() });
    if (!r.ok) {
      setMeldung(t(`begleitung.fehler.${r.fehler}`));
      return;
    }
    setMeldung(null);
    setSatz("");
    setB(r.begleitung);
  };

  const notizUebernehmen = (): void => {
    const h = b.hinweis;
    if (!h || !b.freigabe) {
      return;
    }
    const text = t("begleitung.notiz.text", {
      bereich: b.freigabe.bereich.bezeichnung,
      feld: h.bezeichnung,
      wert: h.wert,
    });
    setNotizen((alt) => [...alt, { id: neueId(), text, uebernommenAm: jetzt() }]);
    setB((alt) => verwirf(alt));
  };

  // Abgemeldet oder ein anderes Konto: die pausierte Begleitung gehört nicht diesem Konto — es sieht
  // weder Zweck noch Bereich, und es kann sie nicht fortsetzen.
  if (!konto || (b.freigabe !== null && b.phase !== "aus" && b.freigabe.konto !== konto)) {
    return null;
  }

  const notizListe =
    notizen.length > 0 ? (
      <div data-testid="begleitung-notizen" className="mt-2">
        <p className="text-xs font-semibold">{t("begleitung.notiz.titel")}</p>
        <ul className="text-xs">
          {notizen.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2">
              <span>{n.text}</span>
              <button
                type="button"
                className="underline"
                onClick={() => setNotizen((alt) => alt.filter((x) => x.id !== n.id))}
              >
                {t("begleitung.notiz.loeschen")}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  if (b.phase === "aus") {
    if (!bereich || !darfBegleiten) {
      return null;
    }
    return (
      <section
        aria-label={t("begleitung.region")}
        className={RAHMEN}
        data-testid="begleitung-angebot"
      >
        <p className="font-semibold">{t("begleitung.angebot.titel")}</p>
        <p className="text-xs">
          {t("begleitung.angebot.bereich", { bereich: bereich.bezeichnung })}
        </p>
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            starten();
          }}
        >
          <label className="text-xs" htmlFor="begleitung-auftrag">
            {t("begleitung.angebot.feld")}
          </label>
          <input
            id="begleitung-auftrag"
            data-testid="begleitung-auftrag"
            className="rounded border px-2 py-1"
            value={satz}
            placeholder={t("begleitung.angebot.platzhalter")}
            onChange={(e) => setSatz(e.target.value)}
          />
          <p className="text-xs">{t("begleitung.angebot.erklaerung")}</p>
          <button type="submit" className="rounded border px-2 py-1 font-semibold">
            {t("begleitung.angebot.starten")}
          </button>
        </form>
        {meldung ? (
          <p role="alert" className="mt-1 text-xs">
            {meldung}
          </p>
        ) : null}
        {notizListe}
      </section>
    );
  }

  if (b.phase === "beendet") {
    const satzEnde =
      b.grund === "abgelaufen" ? "begleitung.beendet.abgelaufen" : "begleitung.beendet.stopp";
    return (
      <section
        aria-label={t("begleitung.region")}
        className={RAHMEN}
        data-testid="begleitung-beendet"
      >
        {/* `<output>` trägt die Statusrolle selbst — dieselbe Ansage wie `role="status"`. */}
        <output className="block">{t(satzEnde)}</output>
        {notizListe}
        <button type="button" className="mt-2 rounded border px-2 py-1" onClick={() => setB(AUS)}>
          {t("begleitung.knopf.schliessen")}
        </button>
      </section>
    );
  }

  const f = b.freigabe as Freigabe;
  const info = auskunft(b, notizen);
  return (
    <section aria-label={t("begleitung.region")} className={RAHMEN} data-testid="begleitung-status">
      <output aria-live="polite" className="block font-semibold" data-testid="begleitung-zustand">
        {t(aktiv ? "begleitung.status.aktiv" : "begleitung.status.pausiert", {
          bereich: f.bereich.bezeichnung,
          ende,
        })}
      </output>
      <p className="text-xs">{t("begleitung.status.zweck", { zweck: f.zweck })}</p>
      <p className="text-xs" data-testid="begleitung-medien">
        {t("begleitung.status.medien")}
      </p>
      {b.phase === "pausiert" && b.grund ? (
        <p className="text-xs" data-testid="begleitung-grund">
          {t(`begleitung.grund.${b.grund}`)}
        </p>
      ) : null}
      {aktiv && b.ausserhalb ? (
        <p className="text-xs" data-testid="begleitung-ausserhalb">
          {t("begleitung.status.ausserhalb")}
        </p>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          className="rounded border px-2 py-1"
          aria-keyshortcuts="Alt+Shift+P"
          onClick={pauseOderFortsetzen}
        >
          {t(aktiv ? "begleitung.knopf.pause" : "begleitung.knopf.fortsetzen")}
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1"
          aria-keyshortcuts="Alt+Shift+S"
          onClick={stopp}
        >
          {t("begleitung.knopf.stopp")}
        </button>
      </div>
      <p className="mt-1 text-xs">{t("begleitung.tastatur")}</p>
      {meldung ? (
        <p role="alert" className="mt-1 text-xs">
          {meldung}
        </p>
      ) : null}
      {aktiv && b.hinweis ? (
        <div className="mt-2 rounded border p-2" data-testid="begleitung-hinweis">
          <p>
            {b.hinweis.einheiten.length > 0
              ? t("begleitung.hinweis.einheit", {
                  feld: b.hinweis.bezeichnung,
                  wert: b.hinweis.wert,
                  einheiten: b.hinweis.einheiten.join(", "),
                })
              : t("begleitung.hinweis.einheitOhneVorgabe", {
                  feld: b.hinweis.bezeichnung,
                  wert: b.hinweis.wert,
                })}
          </p>
          <p className="text-xs">{t("begleitung.hinweis.selbst")}</p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className="rounded border px-2 py-1"
              onClick={() => setB((alt) => verwirf(alt))}
            >
              {t("begleitung.hinweis.verwerfen")}
            </button>
            <button type="button" className="rounded border px-2 py-1" onClick={notizUebernehmen}>
              {t("begleitung.hinweis.notiz")}
            </button>
          </div>
        </div>
      ) : null}
      {notizListe}
      <details className="mt-2 text-xs" data-testid="begleitung-auskunft">
        <summary>{t("begleitung.auskunft.titel")}</summary>
        <p>
          {t("begleitung.auskunft.freigabe", {
            wert: t(info.gespeichert.freigabe ? "begleitung.ja" : "begleitung.nein"),
          })}
        </p>
        <p>{t("begleitung.auskunft.notizen", { anzahl: info.gespeichert.notizen })}</p>
        <p>{t("begleitung.auskunft.fluechtig", { anzahl: info.fluechtig.felder })}</p>
        <p>{t("begleitung.auskunft.keinVerlauf")}</p>
      </details>
    </section>
  );
}
