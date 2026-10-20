// PP-04: nur die bereits laufende Office-Analyse teilen. Kein eigener OCR-Lauf oder Dauerspeicher.
import { type ReactNode, createContext, useCallback, useContext, useState } from "react";
import type {
  Erfassungsauftrag,
  FolienDatenLage,
  FolienElement,
} from "../../api/praesentationDaten";
import { useAssistenzStand } from "../../lib/assistenzProfil";
import type { BildBefund, QuellenBefund } from "../../lib/bildAutomatik";
import { befundMitKorrektur, findeKorrektur } from "../../lib/bildKorrektur";
import { korrekturStandBestaetigt, useBildKorrekturen } from "../../lib/bildKorrekturenStand";

interface Stand {
  objectId: string;
  befund: QuellenBefund;
}
interface Bildquellen {
  staende: Readonly<Record<string, Stand>>;
  melde: (anhang: { id: string; objectId: string }, befund: QuellenBefund) => void;
}
const Kontext = createContext<Bildquellen>({ staende: {}, melde: () => {} });

function Kontostand({ children }: { children?: ReactNode }): JSX.Element {
  const [staende, setStaende] = useState<Record<string, Stand>>({});
  const melde = useCallback<Bildquellen["melde"]>((a, befund) => {
    setStaende((alt) => ({ ...alt, [a.id]: { objectId: a.objectId, befund } }));
  }, []);
  return <Kontext.Provider value={{ staende, melde }}>{children}</Kontext.Provider>;
}

/** Konto- und Artikelwechsel verwerfen auch verspätete Ergebnisse der bisherigen Fläche. */
export function PowerPointBildquellen({ children }: { children?: ReactNode }): JSX.Element {
  const konto = useAssistenzStand().kontoId;
  return <Kontostand key={konto ?? "ohne-konto"}>{children}</Kontostand>;
}

export function usePowerPointBildmeldung(): Bildquellen["melde"] {
  return useContext(Kontext).melde;
}

export function bildbefundAmElement(
  stand: Stand | undefined,
  objectId: string,
  folie: number,
  element: FolienElement,
): BildBefund | undefined {
  if (!stand || stand.objectId !== objectId || !element.bild) return undefined;
  return stand.befund.befunde.find(
    (b) =>
      b.fundstelle.art === "pptx" &&
      !b.fundstelle.folienansicht &&
      b.fundstelle.folie === folie &&
      b.inhaltskennung === element.bild?.kennung &&
      b.fundstelle.bildAufFolie === element.bild?.bildAufFolie,
  );
}

/** Automatik und ausdrückliches Lesen verwenden denselben bestätigten E02-Stand. */
export function usePowerPointBildtext(
  lage: Pick<FolienDatenLage, "anhangId" | "objectId">,
  folie: number,
  element: FolienElement,
  ausdruecklich: BildBefund | null,
): { ocr: Erfassungsauftrag["ocr"] | null; wartet: boolean } {
  const stand = useContext(Kontext).staende[lage.anhangId];
  const gemeinsam = bildbefundAmElement(stand, lage.objectId, folie, element);
  const roh = ausdruecklich ?? gemeinsam;
  const korrekturen = useBildKorrekturen(element.art === "bild");
  const bestaetigt = korrekturStandBestaetigt(korrekturen);
  const k = findeKorrektur(
    korrekturen.korrekturen,
    `office:${lage.anhangId}`,
    roh?.inhaltskennung ?? null,
  );
  const wirksam = roh ? befundMitKorrektur(roh, k) : undefined;
  const ocr =
    bestaetigt && wirksam?.status === "gelesen" && wirksam.inhaltskennung === element.bild?.kennung
      ? {
          text: wirksam.text,
          bildKennung: wirksam.inhaltskennung,
          unsicher: wirksam.unsicher.length > 0,
          wiederverwendung: { rohText: roh?.text ?? "", korrekturAm: k?.geaendertAm ?? null },
        }
      : null;
  return {
    ocr,
    wartet:
      !bestaetigt ||
      (stand?.objectId === lage.objectId && stand.befund.status === "laeuft" && !ocr),
  };
}
