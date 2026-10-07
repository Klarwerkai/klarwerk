import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useImageDescribe } from "../app/ImageDescribeContext";
import { fileToThumbDataUrl } from "../lib/files";
import {
  FOTO_MAX_KANTE_PX,
  type FotoAnker,
  MAX_FOTO_BEFUND,
  fotoStartbereit,
  normalizeFotoBefund,
} from "../lib/fotoInterview";
import { AiModelInfo } from "./AiModelInfo";
import { Button } from "./ui";

// R-1624 · FOTO-ZU-WISSEN — der Einstieg ins geführte Interview über ein Foto.
//
// DER WEG: Foto wählen (nichts wird gesendet) → „Bild auswerten" (EIN describe-Aufruf über den
// einen Weg `useImageDescribe`, mit der Provenienz des umgebenden Entwurfs — vertraulich heißt:
// keine Cloud) → Befund prüfen/korrigieren → „Foto-Interview starten". Ohne nutzbares Bildmodell
// oder bei Fehlschlag schreibt der Mensch den Befund selbst; es gibt keinen erfundenen Befund.
//
// Die Komponente bietet KEINE Bildbeschreibung als Fußnoten-Vorschlag an (das bleibt Sache des
// Editors); sie nutzt den Weg nur, um aus dem Bild Kontext für die Rückfragen zu gewinnen.

type Auswertung = "offen" | "laeuft" | "ki" | "ohneKi" | "fehler";

const textareaCls =
  "w-full resize-y rounded-input border border-hairline bg-surface p-2.5 text-sm text-text outline-none placeholder:text-muted-2 focus:border-ink/30";

export function FotoInterviewStart({
  onStart,
  disabled = false,
}: {
  onStart: (foto: FotoAnker) => void;
  disabled?: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const { available, describe } = useImageDescribe();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [befund, setBefund] = useState("");
  const [auswertung, setAuswertung] = useState<Auswertung>("offen");
  const [bildFehler, setBildFehler] = useState(false);
  // Laufnummer wie beim Interview (mega6 Block C): eine späte Auswertung eines inzwischen
  // ersetzten Fotos schreibt ihren Befund nicht über das neue Foto.
  const laufRef = useRef(0);

  const waehle = async (file: File | undefined): Promise<void> => {
    if (!file) {
      return;
    }
    laufRef.current += 1;
    setBildFehler(false);
    setBefund("");
    setAuswertung("offen");
    try {
      setDataUrl(await fileToThumbDataUrl(file, FOTO_MAX_KANTE_PX, 0.75));
    } catch {
      setDataUrl(null);
      setBildFehler(true);
    }
  };

  const auswerten = async (): Promise<void> => {
    if (!dataUrl) {
      return;
    }
    laufRef.current += 1;
    const lauf = laufRef.current;
    setAuswertung("laeuft");
    try {
      const res = await describe(dataUrl);
      if (lauf !== laufRef.current) {
        return;
      }
      const text = normalizeFotoBefund(res.text ?? "");
      if (text.length > 0 && !res.demo) {
        setBefund(text);
        setAuswertung("ki");
      } else {
        setAuswertung("ohneKi");
      }
    } catch {
      if (lauf !== laufRef.current) {
        return;
      }
      setAuswertung("fehler");
    }
  };

  // Ohne nutzbares Bildmodell entfällt der Auswertungsschritt: der Befund wird direkt erfragt.
  const befundSichtbar =
    dataUrl !== null && (!available || (auswertung !== "offen" && auswertung !== "laeuft"));
  const foto: FotoAnker | null = dataUrl ? { dataUrl, befund } : null;

  return (
    <div data-foto-interview="" className="space-y-3 border-t border-hairline pt-3">
      <p className="text-[13px] font-medium text-text">{t("fotowissen.titel")}</p>
      <p className="text-[13px] text-muted">{t("fotowissen.lead")}</p>
      <label className="flex flex-wrap items-center gap-2 text-[13px] text-text">
        <Camera size={15} aria-hidden="true" />
        <span>{dataUrl ? t("fotowissen.anderes") : t("fotowissen.waehlen")}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
          disabled={disabled}
          onChange={(e) => {
            void waehle(e.target.files?.[0]);
            e.target.value = "";
          }}
          className="text-[12px]"
        />
      </label>
      {bildFehler ? (
        <p role="alert" className="text-[12px] text-trust-crit-text">
          {t("fotowissen.bildFehler")}
        </p>
      ) : null}
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={t("fotowissen.vorschau")}
          className="max-h-48 rounded-card border border-hairline"
        />
      ) : null}
      {dataUrl && available && (auswertung === "offen" || auswertung === "laeuft") ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            disabled={disabled || auswertung === "laeuft"}
            onClick={() => void auswerten()}
          >
            {auswertung === "laeuft" ? t("fotowissen.auswertenLaeuft") : t("fotowissen.auswerten")}
          </Button>
          <AiModelInfo task="describe" />
        </div>
      ) : null}
      {befundSichtbar ? (
        <div className="space-y-2">
          {auswertung === "ki" ? (
            <p className="flex items-center gap-2 text-[12px] text-muted">
              <span className="rounded-pill bg-ai-surface-1 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ai">
                {t("fotowissen.befundKi")}
              </span>
              {t("fotowissen.befund")}
            </p>
          ) : (
            <p className="text-[12px] text-muted">
              {auswertung === "fehler"
                ? t("fotowissen.befundFehler")
                : t("fotowissen.befundOhneKi")}
            </p>
          )}
          <textarea
            aria-label={t("fotowissen.befund")}
            value={befund}
            onChange={(e) => setBefund(e.target.value)}
            rows={2}
            maxLength={MAX_FOTO_BEFUND}
            className={textareaCls}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              disabled={disabled || !fotoStartbereit(foto)}
              onClick={() => {
                if (fotoStartbereit(foto)) {
                  onStart({ dataUrl: foto.dataUrl, befund: normalizeFotoBefund(foto.befund) });
                }
              }}
            >
              {t("fotowissen.starten")}
            </Button>
            <AiModelInfo task="interview" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
