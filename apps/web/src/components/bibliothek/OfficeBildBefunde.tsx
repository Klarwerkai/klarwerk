// OCR-02 · Office im Artikel (H06, Lücke L17): die eingebetteten Bilder einer angehängten bzw. als
// neue Fassung übernommenen `.pptx`/`.docx` werden erst auf Klick gelesen.
//
// DER WEG IST DER VORHANDENE: die Bytes kommen aus dem Objektspeicher des Anhangs
// (`/api/objects/<id>/raw`, mit den Rechten des Artikels), gelesen mit denselben Lesern wie der
// Dateiimport (W03 `readPptxRich`, W05 `readDocxRich`), erkannt mit W01, der Bildinhalt über W02 mit
// der Herkunft des Artikels. Es gibt keine Schreibstelle: Anhang und Fassung bleiben unverändert.
//
// Der Befund gehört zu GENAU DIESER Fassung (Objektkennung). Eine neue Fassung ist ein neuer Lauf;
// unveränderte Bilder darin werden wiedererkannt und nicht erneut gelesen.
//
// Excel (`.xlsx`) hat keinen Leser (Q08) — dort wird nichts behauptet.
//
// OCR-03: die Einstellung Setup › Klara wirkt auch hier (aus → nichts neu auswerten, Profil lädt →
// warten); die Analyse gehört zum Konto; unter dem Befund fragt man Klara zu Text UND Bildern der
// Datei, mit Folie/Bild als Fundstelle.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageDescribeWennVorhanden } from "../../app/ImageDescribeContext";
import {
  BILD_LADEFRIST_MS,
  type BildQuelleEingang,
  type QuellenBefund,
  bildBeschreiberAus,
  docxBildEingang,
  einstellungUnbekannt,
  mitFrist,
  pptxBildEingang,
} from "../../lib/bildAutomatik";
import { useBildAutomatikLage } from "../../lib/bildAutomatikEinstellung";
import { useBildAnalyse } from "../../lib/bildAutomatikLauf";
import { originalAusEingang } from "../../lib/bildFundstelle";
import { objectRawHref } from "../../lib/bodyFileLink";
import { readDocxRich, readPptxRich } from "../../lib/files";
import { BildBefundListe } from "../BildBefundListe";
import { KlaraBereichsfrage } from "../KlaraBereichsfrage";
import { KlaraBildKontextFrage } from "../KlaraBildKontextFrage";
import { usePowerPointBildmeldung } from "./PowerPointBildquellen";

export interface OfficeBildAnhang {
  id: string;
  name: string;
  objectId: string;
}

type Art = "pptx" | "docx";

/** Welche Office-Anhänge einen Leser haben. */
export function officeBildArt(name: string): Art | null {
  const endung = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return endung === "pptx" ? "pptx" : endung === "docx" ? "docx" : null;
}

/**
 * Den Anhang über den vorhandenen Objektspeicherweg holen und mit dem passenden Leser lesen.
 * Nacharbeit 5 (Bens Befund 2): der Abruf einschließlich Antwortkörper ist auf `ladefristMs`
 * begrenzt; danach wird er abgebrochen und das Ergebnis heißt `"frist"`.
 */
export async function officeBildEingang(
  anhang: OfficeBildAnhang,
  art: Art,
  laden: (href: string, signal?: AbortSignal) => Promise<Blob | null>,
  ladefristMs: number = BILD_LADEFRIST_MS,
  signal?: AbortSignal,
): Promise<BildQuelleEingang | null | "frist"> {
  const q = await officeBildQuelle(anhang, art, laden, ladefristMs, signal);
  return q && q !== "frist" ? q.eingang : q;
}

/**
 * OCR-03: derselbe Lesevorgang wie `officeBildEingang`, dazu der Text der Datei (Folien- bzw.
 * Dokumenttext) — Klara bekommt ihn neben den Bildbefunden. Gelesen wird nur.
 */
export async function officeBildQuelle(
  anhang: OfficeBildAnhang,
  art: Art,
  laden: (href: string, signal?: AbortSignal) => Promise<Blob | null>,
  ladefristMs: number = BILD_LADEFRIST_MS,
  signal?: AbortSignal,
): Promise<{ eingang: BildQuelleEingang; text: string } | null | "frist"> {
  const href = objectRawHref(anhang.objectId);
  if (!href) {
    return null;
  }
  signal?.throwIfAborted();
  const abbruch = new AbortController();
  const weitergeben = () => abbruch.abort(signal?.reason);
  signal?.addEventListener("abort", weitergeben, { once: true });
  let abgebrochen: () => void = () => {};
  const abbruchAntwort = new Promise<never>((_resolve, reject) => {
    abgebrochen = () => reject(abbruch.signal.reason);
    abbruch.signal.addEventListener("abort", abgebrochen, { once: true });
  });
  try {
    const blob = await mitFrist(
      Promise.race([laden(href, abbruch.signal), abbruchAntwort]),
      ladefristMs,
    );
    if (blob === "frist") {
      abbruch.abort();
      return "frist";
    }
    abbruch.signal.throwIfAborted();
    if (!blob) return null;
    const datei = new File([blob], anhang.name, { type: blob.type });
    if (art === "pptx") {
      const pptx = await readPptxRich(datei, "");
      abbruch.signal.throwIfAborted();
      return { eingang: pptxBildEingang(anhang.name, pptx.html, pptx), text: pptx.text };
    }
    const docx = await readDocxRich(datei, "");
    abbruch.signal.throwIfAborted();
    return {
      eingang: docxBildEingang(anhang.name, docx.html, docx.droppedImages),
      text: docx.text,
    };
  } finally {
    signal?.removeEventListener("abort", weitergeben);
    abbruch.signal.removeEventListener("abort", abgebrochen);
    abbruch.abort();
  }
}

/** Abruf und Antwortkörper hängen am selben Abbruchsignal (die Frist setzt `officeBildEingang`). */
async function ladeAnhang(href: string, signal?: AbortSignal): Promise<Blob | null> {
  const antwort = await fetch(href, { credentials: "same-origin", ...(signal ? { signal } : {}) });
  return antwort.ok ? antwort.blob() : null;
}

/** Ohne Zugriff auf den Anhang ist nichts gelesen — und das steht da, samt Ladefrist. */
export function ohneZugriff(name: string, art: Art, frist = false): QuellenBefund {
  return {
    quelle: name,
    art,
    status: "fehlgeschlagen",
    befunde: [],
    nichtGelesen: [],
    hinweise: frist ? ["ladefrist"] : [],
  };
}

/** Vor dem Laden: sichtbar „wird geladen“, nicht leer und nicht fertig. */
export function wirdGeladen(name: string, art: Art): QuellenBefund {
  return { quelle: name, art, status: "laeuft", befunde: [], nichtGelesen: [], hinweise: [] };
}

interface OfficeStand {
  befund: QuellenBefund;
  /** OCR-03: der gelesene Eingang und der Text der Datei — für Klaras Kontext. */
  eingang?: BildQuelleEingang;
  text?: string;
}

export function OfficeBildBefunde({
  anhaenge,
}: {
  anhaenge: OfficeBildAnhang[];
}): JSX.Element | null {
  const weg = useImageDescribeWennVorhanden();
  const meldeBildquelle = usePowerPointBildmeldung();
  const analyse = useBildAnalyse();
  const lage = useBildAutomatikLage();
  const beschreibe = useMemo(() => (weg ? bildBeschreiberAus(weg) : undefined), [weg]);
  const lesbar = anhaenge.filter((a) => officeBildArt(a.name) !== null);
  if (lesbar.length === 0) return null;
  return (
    <div data-testid="office-bild-befunde" className="space-y-2">
      {lesbar.map((anhang) => {
        const art = officeBildArt(anhang.name);
        return art ? (
          <OfficeAnhangBildBefund
            key={`${anhang.id}:${anhang.objectId}`}
            anhang={anhang}
            art={art}
            analyse={analyse}
            lage={lage}
            beschreibe={beschreibe}
            meldeBildquelle={meldeBildquelle}
          />
        ) : null;
      })}
    </div>
  );
}

function OfficeAnhangBildBefund({
  anhang,
  art,
  analyse,
  lage,
  beschreibe,
  meldeBildquelle,
}: {
  anhang: OfficeBildAnhang;
  art: Art;
  analyse: ReturnType<typeof useBildAnalyse>;
  lage: ReturnType<typeof useBildAutomatikLage>;
  beschreibe: ReturnType<typeof bildBeschreiberAus> | undefined;
  meldeBildquelle: ReturnType<typeof usePowerPointBildmeldung>;
}): JSX.Element {
  const { t } = useTranslation();
  const { id, name, objectId } = anhang;
  const schluessel = `${id}:${objectId}:${name}`;
  const [anfrage, setAnfrage] = useState<{
    schluessel: string;
    analyse: typeof analyse;
    lage: typeof lage;
    beschreibe: typeof beschreibe;
  } | null>(null);
  const [ergebnis, setErgebnis] = useState<{
    anfrage: NonNullable<typeof anfrage>;
    stand: OfficeStand;
  } | null>(null);
  const gueltig =
    anfrage !== null &&
    anfrage.schluessel === schluessel &&
    anfrage.analyse === analyse &&
    anfrage.lage === lage &&
    anfrage.beschreibe === beschreibe;

  useEffect(() => {
    if (!anfrage) return;
    if (
      anfrage.schluessel !== schluessel ||
      anfrage.analyse !== analyse ||
      anfrage.lage !== lage ||
      anfrage.beschreibe !== beschreibe ||
      lage === "laedt"
    ) {
      setAnfrage(null);
      setErgebnis(null);
      return;
    }
    const auftrag = anfrage;
    const abbruch = new AbortController();
    let aktiv = true;
    const setzeStand = (stand: OfficeStand) => {
      if (!aktiv) return;
      setErgebnis({ anfrage: auftrag, stand });
      if (art === "pptx") meldeBildquelle({ id, objectId }, stand.befund);
    };
    setzeStand({ befund: wirdGeladen(name, art) });
    void (async () => {
      try {
        const quelle = await officeBildQuelle(
          { id, name, objectId },
          art,
          ladeAnhang,
          BILD_LADEFRIST_MS,
          abbruch.signal,
        );
        if (!aktiv) return;
        if (!quelle || quelle === "frist") {
          setzeStand({ befund: ohneZugriff(name, art, quelle === "frist") });
          return;
        }
        const { eingang, text } = quelle;
        if (lage === "unbekannt") {
          setzeStand({ befund: einstellungUnbekannt(eingang), eingang, text });
          return;
        }
        const befund = await analyse.analysiereQuelle(eingang, {
          automatik: lage === "an",
          beschreibe,
          abbrechen: () => !aktiv || abbruch.signal.aborted,
          onFortschritt: (stand) => setzeStand({ befund: stand, eingang, text }),
        });
        setzeStand({ befund, eingang, text });
      } catch {
        if (aktiv) setzeStand({ befund: ohneZugriff(name, art) });
      }
    })();
    return () => {
      aktiv = false;
      abbruch.abort();
    };
  }, [anfrage, schluessel, id, name, objectId, art, analyse, lage, beschreibe, meldeBildquelle]);

  const stand = gueltig && ergebnis?.anfrage === anfrage ? ergebnis.stand : undefined;
  const beschaeftigt = stand?.befund.status === "laeuft";
  return (
    <div data-office-bild-befund={id}>
      <button
        type="button"
        data-office-bild-lesen={id}
        aria-label={`${t("officeartikel.bilderLesen")}: ${name}`}
        disabled={beschaeftigt || lage === "laedt"}
        onClick={() => setAnfrage({ schluessel, analyse, lage, beschreibe })}
        className="rounded-btn border border-hairline px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-text"
      >
        {beschaeftigt ? t("officeartikel.bilderLaden") : t("officeartikel.bilderLesen")}: {name}
      </button>
      {stand ? (
        <>
          <BildBefundListe
            befund={stand.befund}
            originalVon={(b) => originalAusEingang(stand.eingang, b.fundstelle)}
            korrekturQuelle={`office:${id}`}
          />
          {stand.eingang ? (
            <>
              <KlaraBildKontextFrage
                kontextSchluessel={`office:${id}:${objectId}`}
                dokumentTextVon={() => stand.text ?? ""}
                quellen={[stand.befund]}
                aktuell={[stand.eingang]}
                korrekturQuelle={`office:${id}`}
              />
              <KlaraBereichsfrage
                analyse={analyse}
                kontextSchluessel={`office:${id}:${objectId}`}
                quellen={[stand.befund]}
                aktuell={[stand.eingang]}
                korrekturQuelle={`office:${id}`}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
