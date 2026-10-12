// OCR-02 · Office im Artikel (H06, Lücke L17): die eingebetteten Bilder einer angehängten bzw. als
// neue Fassung übernommenen `.pptx`/`.docx` werden ohne Klick gelesen.
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
import { objectRawHref } from "../../lib/bodyFileLink";
import { readDocxRich, readPptxRich } from "../../lib/files";
import { BildBefundListe } from "../BildBefundListe";
import { KlaraBildKontextFrage } from "../KlaraBildKontextFrage";

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
): Promise<BildQuelleEingang | null | "frist"> {
  const q = await officeBildQuelle(anhang, art, laden, ladefristMs);
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
): Promise<{ eingang: BildQuelleEingang; text: string } | null | "frist"> {
  const href = objectRawHref(anhang.objectId);
  if (!href) {
    return null;
  }
  const abbruch = new AbortController();
  const blob = await mitFrist(laden(href, abbruch.signal), ladefristMs);
  if (blob === "frist") {
    abbruch.abort();
    return "frist";
  }
  if (!blob) {
    return null;
  }
  const datei = new File([blob], anhang.name, { type: blob.type });
  if (art === "pptx") {
    const pptx = await readPptxRich(datei, "");
    return { eingang: pptxBildEingang(anhang.name, pptx.html, pptx), text: pptx.text };
  }
  const docx = await readDocxRich(datei, "");
  return {
    eingang: docxBildEingang(anhang.name, docx.html, docx.droppedImages),
    text: docx.text,
  };
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
  // OCR-03: eine Analyse je Fläche UND Konto; dazu die Einstellung Setup › Klara.
  const analyse = useBildAnalyse();
  const lage = useBildAutomatikLage();
  const [befunde, setBefunde] = useState<Record<string, OfficeStand>>({});
  const beschreibe = useMemo(() => (weg ? bildBeschreiberAus(weg) : undefined), [weg]);
  const lesbar = anhaenge.filter((a) => officeBildArt(a.name) !== null);
  // Der Schlüssel ist die FASSUNG (Objektkennung): eine neue Fassung startet einen neuen Lauf.
  const schluessel = lesbar.map((a) => `${a.id}:${a.objectId}`).join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `schluessel` bündelt Anhang und Fassung.
  useEffect(() => {
    if (lage === "laedt") {
      return; // Die Einstellung des Kontos kommt gleich — bis dahin wird nichts gestartet.
    }
    let aktiv = true;
    for (const anhang of lesbar) {
      const art = officeBildArt(anhang.name);
      if (!art) {
        continue;
      }
      // Sofort sichtbar: der Anhang wird geladen — schon vor dem ersten Byte.
      setBefunde((b) => ({ ...b, [anhang.objectId]: { befund: wirdGeladen(anhang.name, art) } }));
      void (async () => {
        let quelle: { eingang: BildQuelleEingang; text: string } | null | "frist" = null;
        try {
          quelle = await officeBildQuelle(anhang, art, ladeAnhang);
        } catch {
          quelle = null;
        }
        if (!aktiv) {
          return;
        }
        if (!quelle || quelle === "frist") {
          const befund = ohneZugriff(anhang.name, art, quelle === "frist");
          setBefunde((b) => ({ ...b, [anhang.objectId]: { befund } }));
          return;
        }
        const { eingang, text } = quelle;
        if (lage === "unbekannt") {
          const befund = einstellungUnbekannt(eingang);
          setBefunde((b) => ({ ...b, [anhang.objectId]: { befund, eingang, text } }));
          return;
        }
        await analyse.analysiereQuelle(eingang, {
          automatik: lage === "an",
          beschreibe,
          abbrechen: () => !aktiv,
          onFortschritt: (stand) => {
            if (aktiv) {
              setBefunde((b) => ({ ...b, [anhang.objectId]: { befund: stand, eingang, text } }));
            }
          },
        });
      })();
    }
    return () => {
      aktiv = false;
    };
  }, [schluessel, analyse, beschreibe, lage]);

  const sichtbar = lesbar.flatMap((a) => {
    const stand = befunde[a.objectId];
    return stand ? [{ a, stand }] : [];
  });
  if (sichtbar.length === 0) {
    return null;
  }
  return (
    <div data-testid="office-bild-befunde" className="space-y-2">
      {sichtbar.map(({ a, stand }) => (
        <div key={`${a.id}-${a.objectId}`} data-office-bild-befund={a.id}>
          <BildBefundListe befund={stand.befund} />
          {stand.eingang ? (
            <KlaraBildKontextFrage
              dokumentTextVon={() => stand.text ?? ""}
              quellen={[stand.befund]}
              aktuell={[stand.eingang]}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
