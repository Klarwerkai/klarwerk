// SCRUM-405: „Aus Dokument ergänzen" — im Wissensseiten-Schritt (Capture) und im KO-Detail-
// Editor. Nutzt den VORHANDENEN extract-Task (SCRUM-390, G-2-Belegstellen-Gate): Dokument
// hochladen, optional sagen wonach gesucht wird, Punkteliste mit Checkboxen prüfen —
// AUSGEWÄHLTE Punkte gehen über onAppend an den Aufrufer, der sie an den bestehenden Artikel
// ANHÄNGT (nichts ersetzen) und die Quelle je Punkt am KO vermerkt (add-source bzw.
// SCRUM-408-Warteliste). Kein Auto-Speichern, keine stille Übernahme.
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, FileText, Paperclip, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ExtractedPoint } from "../api/types";
import { BODY_EXTRACT_TEXT } from "../lib/bodyExtract";
import {
  CAPTURE_FILE_TEXT,
  type SelectableExtractPoint,
  selectablePoints,
  selectedCount,
  togglePoint,
} from "../lib/captureFromFile";
import {
  isImage,
  isPdfDocument,
  isTextDocument,
  isWordDocument,
  readDocxFile,
  readFileAsDataUrl,
  readPdfFile,
  readTextFile,
  runImageOcr,
} from "../lib/files";
import { toReasonerLocale } from "../lib/reasonerLocale";
import { HelpTip } from "./HelpTip";
import { Button, SectionLabel, TextInput } from "./ui";

export function BodyExtractPanel({
  onAppend,
}: {
  // Ausgewählte Punkte + Dateiname — der Aufrufer hängt an und vermerkt die Quellen.
  onAppend: (points: ExtractedPoint[], fileName: string) => void;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null); // OCR-Kandidat (nur auf Klick)
  const [busy, setBusy] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState<SelectableExtractPoint[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [appendedNote, setAppendedNote] = useState<string | null>(null);

  const locale = toReasonerLocale(i18n.language);

  // Gleicher extract-Task wie der Erzähl-Modus „Aus Datei" (PMO-FEA-0006/SCRUM-390);
  // ohne Modell kommt eine ehrliche note vom Server — KEINE Fake-Punkte.
  const extract = useMutation({
    mutationFn: () => endpoints.reasoner.extract(fileText, locale, query),
    onSuccess: (r) => {
      setErr(null);
      setAppendedNote(null);
      setPoints(selectablePoints(r.points));
      setNote(r.note);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : t("state.error")),
  });

  // Dokument lesen — nutzt die VORHANDENEN Extraktoren (Text/Word/PDF; Bild als OCR-Kandidat).
  const onFile = async (e: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) {
      return;
    }
    setPoints(null);
    setNote(null);
    setImageUrl(null);
    setFileText("");
    setErr(null);
    setAppendedNote(null);
    setFileName(f.name);
    setBusy(true);
    setStatus(t(CAPTURE_FILE_TEXT.extracting, { name: f.name }));
    try {
      if (isImage(f)) {
        setImageUrl(await readFileAsDataUrl(f));
        setStatus(null);
        return;
      }
      let text = "";
      if (isTextDocument(f) || isWordDocument(f)) {
        text = isWordDocument(f) ? await readDocxFile(f) : await readTextFile(f);
      } else if (isPdfDocument(f)) {
        text = await readPdfFile(f);
      } else {
        setFileName(null);
        setStatus(null);
        setErr(t(CAPTURE_FILE_TEXT.unsupported, { name: f.name }));
        return;
      }
      if (text.trim().length === 0) {
        setStatus(null);
        setErr(t(CAPTURE_FILE_TEXT.empty, { name: f.name }));
        return;
      }
      setFileText(text);
      setStatus(t(CAPTURE_FILE_TEXT.loaded, { name: f.name }));
    } catch {
      setFileName(null);
      setStatus(null);
      setErr(t(CAPTURE_FILE_TEXT.parseError, { name: f.name }));
    } finally {
      setBusy(false);
    }
  };

  // Bild-OCR NUR auf Klick, ehrlicher Status (SCRUM-123-Muster).
  const onOcr = async (): Promise<void> => {
    if (!imageUrl || !fileName) {
      return;
    }
    setErr(null);
    setOcrBusy(true);
    setStatus(t("capture.ocrRunning", { name: fileName }));
    try {
      const res = await runImageOcr(imageUrl);
      if (res.status === "success" && res.text.length > 0) {
        setFileText(res.text);
        setStatus(t(CAPTURE_FILE_TEXT.loaded, { name: fileName }));
      } else if (res.status === "unavailable") {
        setStatus(null);
        setErr(t("capture.ocrUnavailable"));
      } else {
        setStatus(null);
        setErr(t("capture.ocrEmpty", { name: fileName }));
      }
    } finally {
      setOcrBusy(false);
    }
  };

  // Übernahme: NUR die angekreuzten Punkte gehen an den Aufrufer; die Liste wird danach
  // geleert (sichtbare Quittung statt Doppel-Anfügen bei erneutem Klick).
  const apply = (): void => {
    if (!points || !fileName) {
      return;
    }
    const chosen = points
      .filter((p) => p.selected)
      .map(({ title, summary, sourceExcerpt }) => ({ title, summary, sourceExcerpt }));
    if (chosen.length === 0) {
      return;
    }
    onAppend(chosen, fileName);
    setPoints(null);
    setAppendedNote(t(BODY_EXTRACT_TEXT.appended, { count: chosen.length, name: fileName }));
  };

  return (
    <div className="rounded-card border border-hairline">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
        >
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text">
            <Sparkles size={14} className="text-ai" />
            {t(BODY_EXTRACT_TEXT.title)}
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 text-muted-2 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        <HelpTip title={t(BODY_EXTRACT_TEXT.helpTitle)} body={t(BODY_EXTRACT_TEXT.helpBody)} />
      </div>
      {open ? (
        <div className="space-y-3 border-t border-hairline p-3">
          <p className="text-[11.5px] leading-relaxed text-muted-2">{t(BODY_EXTRACT_TEXT.hint)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-btn border border-hairline px-3 py-1.5 text-[12.5px] font-semibold text-muted hover:text-text">
              <Paperclip size={14} />
              {fileName ? t(CAPTURE_FILE_TEXT.replace) : t(CAPTURE_FILE_TEXT.upload)}
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,.log,.json,.docx,.pdf,application/pdf,image/*"
                className="hidden"
                onChange={(e) => void onFile(e)}
              />
            </label>
            {fileName ? (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-text">
                <FileText size={13} className="text-muted-2" />
                {fileName}
              </span>
            ) : null}
          </div>
          {imageUrl && !fileText ? (
            <Button variant="ghost" disabled={ocrBusy} onClick={() => void onOcr()}>
              {ocrBusy ? t(CAPTURE_FILE_TEXT.ocrBusy) : t(CAPTURE_FILE_TEXT.ocrCta)}
            </Button>
          ) : null}
          {fileText ? (
            <div>
              <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">
                {t(CAPTURE_FILE_TEXT.queryLabel)}
              </span>
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(CAPTURE_FILE_TEXT.queryPlaceholder)}
              />
              <Button
                variant="primary"
                className="mt-3"
                disabled={extract.isPending || busy}
                onClick={() => extract.mutate()}
              >
                <Sparkles size={15} />
                {extract.isPending
                  ? t(CAPTURE_FILE_TEXT.searching)
                  : t(CAPTURE_FILE_TEXT.searchCta)}
              </Button>
            </div>
          ) : null}
          {note ? (
            <p className="rounded-btn bg-trust-warn-bg px-3 py-2 text-[12.5px] text-trust-warn-text">
              {note}
            </p>
          ) : null}
          {points && points.length > 0 ? (
            <div className="space-y-2 border-t border-hairline pt-3">
              <SectionLabel>{t(CAPTURE_FILE_TEXT.pointsTitle)}</SectionLabel>
              <p className="text-[11.5px] leading-relaxed text-muted-2">
                {t(CAPTURE_FILE_TEXT.pointsHint)}
              </p>
              <ul className="space-y-2">
                {points.map((p) => (
                  <li
                    key={p.id}
                    className={`rounded-card border p-3 ${
                      p.selected ? "border-ink/25 bg-surface" : "border-hairline bg-page opacity-70"
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={p.selected}
                        onChange={() => setPoints((pts) => (pts ? togglePoint(pts, p.id) : pts))}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-ink"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-text">
                          {p.title}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted">
                          {p.summary}
                        </span>
                        <span className="mt-1.5 block rounded-input bg-page px-2.5 py-1.5 text-[11.5px] leading-relaxed text-muted-2">
                          <span className="font-mono text-[9.5px] font-semibold uppercase tracking-wider">
                            {t(CAPTURE_FILE_TEXT.excerptLabel)}
                            {fileName ? ` · ${fileName}` : ""}
                          </span>
                          <span className="mt-0.5 block italic">„{p.sourceExcerpt}“</span>
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-3">
                <span className="text-[11.5px] text-muted-2">
                  {t(CAPTURE_FILE_TEXT.pointCount, {
                    selected: selectedCount(points),
                    total: points.length,
                  })}
                </span>
                <Button
                  variant="primary"
                  className="ml-auto"
                  disabled={selectedCount(points) === 0}
                  onClick={apply}
                >
                  {t(BODY_EXTRACT_TEXT.applyCta)} ({selectedCount(points)}) →
                </Button>
              </div>
            </div>
          ) : null}
          {appendedNote ? (
            <p className="rounded-btn bg-trust-pos-bg px-2.5 py-1.5 text-[11.5px] text-trust-pos-text">
              {appendedNote}
            </p>
          ) : null}
          {status ? <p className="text-[11.5px] text-muted-2">{status}</p> : null}
          {err ? (
            <p className="rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text">
              {err}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
