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
// Der Hinweis nennt die laufende Vorschau ohnehin beim Namen („Vorschau als Betrachter — du bleibst
// Admin"), und die zweite Beschriftung hätte die Zählung B2 auf zwei Orte gebracht, ohne dass es
// einen zweiten Bedienort gäbe — ein falsches Rot ist so schlecht wie ein falsches Grün.
//
// ================================================================================================
// JOB 3124 · UX-12 — DERSELBE HINWEIS STEHT JETZT AUCH DORT, WO ER GEBRAUCHT WIRD.
// ================================================================================================
//
// Pedis Befund: Ein Admin stellt die Ansicht auf „Betrachter" und landet auf `/admin` sofort auf der
// Sperrkarte. Dort las er bis hierher nur, dass der Bereich einer anderen Rolle gehört — als hätte
// er seine Rechte verloren. Der Satz „du bleibst Admin" und der Rückweg standen im Zahnrad-Menü,
// also erst nach einem zusätzlichen Öffnen.
//
// WARUM EIN BAUTEIL UND NICHT EINE ZWEITE FLÄCHE: Text und Zustandsführung dürfen genau EINMAL
// existieren („Was ersetzt wird, wird gelöscht, nicht danebengestellt"). `VorschauHinweis` ist
// deshalb dieselbe Zusicherung in zwei Kleidern; `components/Stage2Notice.tsx` (`RoleNotice`)
// RENDERT es, ruft aber selbst kein `setRole` — der Aufruf bleibt in dieser Datei und damit bleibt
// R4 des Bedienort-Registers (`tests/app/h6-bedienort-register.test.ts`) wörtlich erfüllt: der
// EINE Rückweg wohnt in der Hülle, es entsteht kein neuer Bedienort in einer neuen Datei.
//
// WARUM DER RÜCKWEG TROTZDEM IN DER HÜLLE BLEIBEN MUSS: die Sperrkarte ist nur EINER der Orte, an
// denen die Vorschau auffällt. Wer während der Vorschau auf einer erlaubten Seite steht (`/start`),
// sieht keine Sperrkarte — für ihn ist das Zahnrad weiterhin der Ausweg. Die Sperrkarte kommt
// hinzu, sie ersetzt nichts.

/** Wo derselbe Hinweis steht: im Zahnrad-Menü oder auf der Sperrkarte des Rollen-Tors. */
export type VorschauFlaeche = "zahnrad" | "sperrkarte";

/**
 * Der Vorschauhinweis samt Rückweg — EINE Aussage, zwei Flächen.
 *
 * EHRLICHKEIT VOR OPTIK: „du bleibst Admin" ist eine Tatsachenaussage über die laufende Sitzung.
 * Sie hängt allein an `previewActive`, und das ist `isAdminSession && role !== "admin"`
 * (`app/RoleContext.tsx`) — eine BESTÄTIGTE Adminsitzung. Solange `/auth/me` lädt oder scheitert,
 * ist `user` null, `previewActive` false, und hier steht nichts. Aus einem unbekannten Zustand
 * entsteht nie eine positive Aussage.
 */
export function VorschauHinweis({ flaeche }: { flaeche: VorschauFlaeche }): JSX.Element | null {
  const { t } = useTranslation();
  const { role, setRole, previewActive } = useRole();
  // Ohne laufende Vorschau gibt es nichts zu sagen und nichts, wovon man zurückkehren könnte.
  if (!previewActive) {
    return null;
  }
  const aufKarte = flaeche === "sperrkarte";
  return (
    <div
      data-testid={aufKarte ? "sperrkarte-vorschau" : "zahnrad-vorschau"}
      className={
        aufKarte
          ? // Auf der Karte: volle Breite, mittig wie der Rest des Rahmens, und bei schmaler
            // Fläche bricht die Zeile um, statt den Knopf hinauszudrängen.
            "mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-2 rounded-card bg-trust-warn-bg px-3 py-2"
          : "mx-2.5 mb-1.5 flex items-center justify-between gap-2 rounded-btn bg-trust-warn-bg px-2 py-1.5"
      }
    >
      <span
        className={
          aufKarte
            ? "text-[12.5px] leading-relaxed text-trust-warn-text"
            : "text-[11px] leading-tight text-trust-warn-text"
        }
      >
        {t("role.previewNote", { role: t(`role.name.${role}`) })}
      </span>
      {/* Ein echtes <button>: der Browser löst es mit Enter UND Leertaste aus, es steht von selbst
          in der Tabreihenfolge, und den sichtbaren Fokusring bringt die globale
          `*:focus-visible`-Regel mit (index.css, Scheibe D-024). Kein `outline-none`, kein
          `tabIndex`, kein `<div onClick>` — genau das wäre die Halbheit „nur mit der Maus". */}
      <button
        type="button"
        onClick={() => setRole("admin")}
        className={
          aufKarte
            ? "shrink-0 rounded-pill bg-surface px-3 py-1 text-[12.5px] font-semibold text-text hover:opacity-80"
            : "shrink-0 rounded-pill bg-surface px-2 py-0.5 text-[11px] font-semibold text-text hover:opacity-80"
        }
      >
        {t("role.backToAdmin")}
      </button>
    </div>
  );
}

export function RollenVorschau(): JSX.Element | null {
  const { previewActive } = useRole();
  // Ohne laufende Vorschau bleibt die Gruppe im Zahnrad baulich abwesend — `HUELLE_DA` in
  // `tests/design/h6-funktionsinventar.test.ts` (B0) verlangt genau das.
  if (!previewActive) {
    return null;
  }
  return (
    <div data-testid="zahnrad-ansicht">
      <VorschauHinweis flaeche="zahnrad" />
    </div>
  );
}
