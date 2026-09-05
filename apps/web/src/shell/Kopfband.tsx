import { Menu, Search } from "lucide-react";
import { type FormEvent, type Ref, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGuardedNavigate } from "../app/NavGuardContext";
import { KontoMenue } from "./KontoMenue";
import { KopfbandPunkte } from "./KopfbandPunkte";
import { Logo } from "./Logo";
import { ZahnradMenue } from "./ZahnradMenue";

// ================================================================================================
// JOB 3060 · H1 — DAS EINE KOPFBAND (Mockup design/klarwerk/Main.dc.html Z.17-34).
// ================================================================================================
//
// 56 px hoch, Nachtblau, 32 px Seitenpolster, 36 px Abstand: links KLARWERK, dann fünf Punkte,
// rechts das Suchfeld (260 px), das Zahnrad und der Konto-Kreis — sonst nichts. Die Werte stehen
// hier als Klassen (Maße) und in styles/modern.css (Farben, unter dem modernen Thema); gemessen
// werden sie an der gebauten Seite in tests/design/zielbild-h1-huelle.test.ts.
//
// Was NICHT mehr hier steht, hat einen benannten Ort (Auftrag 5a/5b): Mobil, Design, Meldungen und
// Abmelden im Konto-Menü; Hilfe, Status, Rechtliches, Version, Seitenhilfe und Weitere Bereiche im
// Zahnrad-Menü; Sprache auf /profil. Der sichtbare Text dieser Leiste sind genau die Wörter
// KLARWERK, Start, Fragen, Bibliothek, Erfassen, Prüfen und der Platzhalter Suchen
// (tests/design/zielbild-h1-kein-erklaertext.test.ts).
//
// Navigation läuft ausschließlich über den Ungespeichert-Wächter (`useGuardedNavigate`,
// `GuardedLink` in den Bausteinen; mega39 B, shell-links-guarded.test.ts).
export function Kopfband({
  narrow = false,
  onOpenMenu,
  menuButtonRef,
}: {
  narrow?: boolean;
  onOpenMenu?: () => void;
  // E2E-017 (bens Block F/Drawer): Referenz auf den Hamburger, damit der Drawer den Fokus beim
  // Schließen genau hierher zurückgibt.
  menuButtonRef?: Ref<HTMLButtonElement>;
} = {}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useGuardedNavigate();
  const [q, setQ] = useState("");

  // Das Kopfbandinventar gilt in JEDEM Zustand — auch in der Rollen-Vorschau des Admins. Der
  // Rückweg „Zur Admin-Ansicht" wohnt deshalb ausschließlich im Zahnrad-Menü (RollenVorschau.tsx),
  // nicht als Pille hier (Codex, JOB 3060 R5).

  // Enter → /bibliothek?q=… — derselbe Weg wie die Konsole der Startseite (pages/Start.tsx) und
  // gelesen in pages/Library.tsx (`params.get("q")`).
  const submitSearch = (e: FormEvent): void => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/bibliothek?q=${encodeURIComponent(term)}` : "/bibliothek");
  };

  return (
    <header
      data-testid="kopfband"
      className="kw-kopfband flex h-[56px] shrink-0 items-center gap-9 bg-ink px-8 text-white"
    >
      {/* E2E-017: schmaler Kopf bekommt einen Hamburger, der die Punkte als Drawer öffnet. */}
      {narrow ? (
        <button
          type="button"
          ref={menuButtonRef}
          aria-label={t("topbar.openMenu")}
          onClick={() => onOpenMenu?.()}
          className="-ml-3 grid h-9 w-9 shrink-0 place-items-center rounded-btn text-hairline hover:text-white"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      ) : null}
      <Logo />
      {narrow ? null : <KopfbandPunkte />}
      <div className="ml-auto flex min-w-0 shrink items-center gap-4">
        {/* E2E-017: auf schmalen Breiten entfällt das Suchfeld (die Suche bleibt über die
            Bibliothek erreichbar); Zahnrad und Konto bleiben. */}
        {narrow ? null : (
          <form
            onSubmit={submitSearch}
            className="kw-kopfband-suche flex w-[260px] min-w-0 items-center gap-2 rounded-[9px] bg-surface px-3 py-[7px] text-[13px] text-muted-2"
          >
            <button
              type="submit"
              aria-label={t("topbar.search")}
              className="grid shrink-0 place-items-center text-muted-2 hover:text-text"
            >
              <Search size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("kopfband.suchen")}
              aria-label={t("topbar.search")}
              className="w-full min-w-0 bg-transparent text-[13px] leading-normal text-text outline-none placeholder:text-muted-2"
            />
          </form>
        )}
        <ZahnradMenue />
        <KontoMenue />
      </div>
    </header>
  );
}
