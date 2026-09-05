import { useTranslation } from "react-i18next";
import { useRole } from "../app/RoleContext";

// ================================================================================================
// JOB 3065 · H6 — HIER STEHT NUR NOCH DER RÜCKWEG. DIE WAHL SELBST WOHNT IN DEN EINSTELLUNGEN.
// ================================================================================================
//
// Bug (Pedi 04.07.): Ein Admin darf die ANSICHT als jede Rolle prüfen (Beta-Test); die echte
// Session bleibt Admin. JOB 3060 hat diese Gruppe aus der Seitenleiste ins Zahnrad-Menü gezogen —
// VOLLSTÄNDIG, mit Rollenraster und Stufe-2-Häkchen, ausdrücklich als Zwischenstand: „Der Auftrag
// nennt /admin Konten als Endort. Diese Seite baut JOB 3065." Diese Seite steht jetzt.
//
// WAS BLEIBT UND WARUM GENAU DAS: Der Rückweg „Zur Admin-Ansicht" MUSS in der Hülle hängen. Sobald
// eine Fremdrolle aktiv ist, nimmt der Rollen-Guard dem Admin die Seite `/admin` weg (routes.tsx:
// `Guarded` rendert `RoleNotice` statt der Seite) — ein Rückweg, der IN den Einstellungen läge,
// wäre in genau dem Moment unerreichbar, in dem man ihn braucht. Das war BENs Befund an Runde 6.
//
// WAS GEHT UND WARUM: Rollenraster und Stufe-2-Häkchen. Sie standen ab jetzt doppelt — hier und in
// den Einstellungen (Konten → „Ansicht als Rolle", „Erweiterte Module") — und eine Sache mit zwei
// Bedienorten ist genau das, was der Auftrag unter ABLÖSUNG ausschliesst: „Was ersetzt wird, wird
// GELÖSCHT, nicht versteckt." Gehütet von `tests/app/h6-bedienort-register.test.ts` (R3: kein
// Auswahlort in `shell/**`, R4: der Rückweg bleibt) und von der Chromium-Zählung in
// `tests/design/h6-funktionsinventar.test.ts` (B2: je genau ein Ort in der ganzen Anwendung).
//
// KEINE ÜBERSCHRIFT „Ansicht als Rolle" MEHR: Ohne Raster wäre sie eine Überschrift über nichts.
// Der Hinweis nennt die laufende Vorschau ohnehin beim Namen („Vorschau als Viewer — du bleibst
// Admin"), und die zweite Beschriftung hätte die Zählung B2 auf zwei Orte gebracht, ohne dass es
// einen zweiten Bedienort gäbe — ein falsches Rot ist so schlecht wie ein falsches Grün.
export function RollenVorschau(): JSX.Element | null {
  const { t } = useTranslation();
  const { role, setRole, previewActive } = useRole();
  // Ohne laufende Vorschau gibt es nichts, wovon man zurückkehren könnte.
  if (!previewActive) {
    return null;
  }
  return (
    <div data-testid="zahnrad-ansicht">
      {/* Sichtbarer Hinweis, dass die echte Rolle Admin bleibt — plus 1-Klick zurück. */}
      <div className="mx-2.5 mb-1.5 flex items-center justify-between gap-2 rounded-btn bg-trust-warn-bg px-2 py-1.5">
        <span className="text-[11px] leading-tight text-trust-warn-text">
          {t("role.previewNote", { role: t(`role.short.${role}`) })}
        </span>
        <button
          type="button"
          onClick={() => setRole("admin")}
          className="shrink-0 rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-text hover:opacity-80"
        >
          {t("role.backToAdmin")}
        </button>
      </div>
    </div>
  );
}
