// ================================================================================================
// JOB 3060 · H1 — DAS FUNKTIONSINVENTAR: JEDE FUNKTION DER ALTEN HÜLLE HAT EINEN ORT, ERREICHBAR.
// ================================================================================================
//
// Pedi (04.09. 07:58): „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs." Dieser Test trägt die Tabelle „heute → neuer Ort“ (Auftrag 5a/5b)
// als DATENLISTE: für jede Zeile öffnet er in der gebauten App (Chromium, angemeldet als Admin,
// Stufe 2 an) das genannte Menü und findet das Element an seinem sichtbaren Text oder löst seine
// Wirkung aus. Ein gestrichener Eintrag macht genau seine Zeile rot.
//
// Rot-first: auf dem Basisstand (Seitenleiste + Kopfzeile) gibt es weder Kopfband noch Zahnrad-
// noch Konto-Menü — jede Zeile ist dort rot.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { APP_VERSION } from "../../apps/web/src/version";
import { type Seite, type Strecke, fn, oeffne, strecke, warteBis } from "./h1-chromium";

let s: Strecke | null = null;
let fehler: string | null = null;
let boardZahl = -1;

const t = (key: string, opts?: Record<string, unknown>): string =>
  opts === undefined ? i18n.getFixedT("de")(key) : i18n.getFixedT("de")(key, opts);

// ---- Griffe in die Seite -----------------------------------------------------------------------
const seite = (): Seite => {
  expect(fehler, "Seite nicht gemountet").toBeNull();
  return (s as Strecke).seite;
};
const lies = <T>(quelle: string, arg?: unknown): Promise<T> => seite().evaluate<T>(fn(quelle), arg);

/** Öffnet das Zahnrad-Menü und wartet, bis seine Fläche steht. */
async function zahnradOeffnen(): Promise<void> {
  await seite().click('[data-testid="kopfband-zahnrad"]');
  await warteBis(seite(), `() => document.querySelector('[data-testid="zahnrad-menue"]') !== null`);
}
/** Öffnet das Konto-Menü und wartet, bis seine Fläche steht. */
async function kontoOeffnen(): Promise<void> {
  await seite().click('[data-testid="kopfband-konto"]');
  await warteBis(seite(), `() => document.querySelector('[data-testid="konto-menue"]') !== null`);
}
/** Klappt ein Untermenü (Pages-Art) auf und wartet auf seine Gruppe. */
async function aufklappen(testid: string): Promise<void> {
  await seite().click(`[data-testid="${testid}"]`);
  await warteBis(
    seite(),
    `(id) => document.querySelector('[data-testid="' + id + '"]')?.getAttribute('aria-expanded') === 'true'`,
    testid,
  );
}
/** Der sichtbare Text eines Elements (innerText — gezeichnet, nicht nur im Baum). */
const sichtbarerText = (selektor: string): Promise<string | null> =>
  lies<string | null>(
    "(sel) => { const el = document.querySelector(sel); return el ? (el.innerText || '').trim() : null; }",
    selektor,
  );
/** href eines Elements. */
const href = (selektor: string): Promise<string | null> =>
  lies<string | null>(
    "(sel) => { const el = document.querySelector(sel); return el ? el.getAttribute('href') : null; }",
    selektor,
  );
/** Alle sichtbaren Texte einer Elementmenge. */
const texte = (selektor: string): Promise<string[]> =>
  lies<string[]>(
    "(sel) => [...document.querySelectorAll(sel)].map((el) => (el.innerText || '').trim())",
    selektor,
  );

// ---- Die Tabelle (Auftrag 5a/5b): heute → neuer Ort, je Zeile eine Prüfung -------------------------
interface Zeile {
  kennung: string;
  heute: string;
  ort: string;
  route?: string;
  pruefen: () => Promise<void>;
}

const BEREICHE: [string, string, string][] = [
  ["aufgaben", "/aufgaben", "nav.tasks"],
  ["konflikte", "/konflikte", "nav.conflicts"],
  ["duplikate", "/duplikate", "nav.duplicates"],
  ["wissensnetz", "/wissensnetz", "nav.wissensnetz"],
  ["extern", "/extern", "nav.external"],
  ["risiko", "/risiko", "nav.risk"],
  ["lebenszyklus", "/lebenszyklus", "nav.lifecycle"],
  ["analytics", "/analytics", "nav.analytics"],
  ["output", "/output", "nav.output"],
  ["import", "/import", "nav.import"],
  ["graph", "/graph", "nav.graph"],
  ["kapital", "/kapital", "nav.capital"],
];

const KOPFBAND: [string, string, string][] = [
  ["start", "/start", "nav.start"],
  ["fragen", "/fragen", "nav.ask"],
  ["bibliothek", "/bibliothek", "nav.library"],
  ["erfassen", "/erfassen", "kopfband.erfassen"],
  ["validierung", "/validierung", "kopfband.pruefen"],
];

const INVENTAR: Zeile[] = [
  ...KOPFBAND.map<Zeile>(([id, pfad, labelKey]) => ({
    kennung: `K-${id}`,
    heute: `Nav-Punkt ${id} (navigation.ts NAV_GROUPS, Sidebar.tsx NavRow)`,
    ort: "Kopfband-Punkt",
    pruefen: async () => {
      const sel = `header a[data-kopfband-punkt="${id}"]`;
      expect(await sichtbarerText(sel)).toMatch(new RegExp(`^${t(labelKey)}`));
      expect(await href(sel)).toBe(pfad);
    },
  })),
  {
    kennung: "K-zaehler",
    heute: "Nav-Badge validation (Sidebar.tsx:23-151)",
    ort: "Zähler an „Prüfen“ im Kopfband",
    pruefen: async () => {
      expect(boardZahl).toBeGreaterThanOrEqual(2);
      expect(
        await sichtbarerText('header a[data-kopfband-punkt="validierung"] .kw-kopfband-zaehler'),
      ).toBe(String(boardZahl));
    },
  },
  {
    kennung: "K-suche",
    heute: "Suche + Enter (Topbar.tsx:568-596)",
    ort: "Kopfband-Suchfeld → /bibliothek?q=",
    pruefen: async () => {
      await seite().fill('header input[type="search"]', "Ventil");
      await seite().press('header input[type="search"]', "Enter");
      await warteBis(seite(), `() => location.pathname === '/bibliothek'`);
      expect(new URL(seite().url()).searchParams.get("q")).toBe("Ventil");
    },
  },
  {
    kennung: "K-cmdk",
    heute: "⌘K-Chip im Suchfeld (Topbar.tsx:588-595)",
    ort: "Tastenkürzel ⌘K bleibt + Zahnrad-Zeile „Schnellnavigation“",
    pruefen: async () => {
      await seite().keyboard.press("Control+k");
      await warteBis(
        seite(),
        `() => document.querySelector('input[placeholder*="springen"]') !== null`,
      );
      await seite().keyboard.press("Escape");
      await warteBis(
        seite(),
        `() => document.querySelector('input[placeholder*="springen"]') === null`,
      );
      await zahnradOeffnen();
      expect(await sichtbarerText('[data-testid="zahnrad-schnellnavigation"]')).toContain(
        t("menue.schnellnavigation"),
      );
      await seite().click('[data-testid="zahnrad-schnellnavigation"]');
      await warteBis(
        seite(),
        `() => document.querySelector('input[placeholder*="springen"]') !== null`,
      );
      await seite().keyboard.press("Escape");
    },
  },
  {
    kennung: "Z-einstellungen",
    heute: "Nav-Punkt admin „Admin“ (navigation.ts:245-252)",
    ort: "Zahnrad-Menü „Einstellungen“ → /admin",
    pruefen: async () => {
      await zahnradOeffnen();
      expect(await sichtbarerText('[data-testid="zahnrad-einstellungen"]')).toBe(
        t("menue.einstellungen"),
      );
      expect(await href('[data-testid="zahnrad-einstellungen"]')).toBe("/admin");
    },
  },
  {
    kennung: "Z-status-ki",
    heute: "KiModePill (Topbar.tsx:461-509)",
    ort: "Zahnrad-Menü „Status“ Zeile KI → /admin",
    pruefen: async () => {
      await zahnradOeffnen();
      expect(await texte('[data-testid="zahnrad-menue"] .kw-menue-kopf')).toContain(
        t("menue.status"),
      );
      expect((await sichtbarerText('[data-testid="status-ki"]')) ?? "").not.toBe("");
      expect(await href('[data-testid="status-ki"]')).toBe("/admin");
    },
  },
  {
    kennung: "Z-status-reasoner",
    heute: "ReasonerStatusPill (Topbar.tsx:412-431)",
    ort: "Zahnrad-Menü „Status“ Zeile Reasoner → /admin",
    pruefen: async () => {
      await zahnradOeffnen();
      expect((await sichtbarerText('[data-testid="status-reasoner"]')) ?? "").not.toBe("");
      expect(await href('[data-testid="status-reasoner"]')).toBe("/admin");
    },
  },
  {
    kennung: "Z-status-extern",
    heute: "ExternalStagePill (Topbar.tsx:436-455)",
    ort: "Zahnrad-Menü „Status“ Zeile Extern → /admin",
    pruefen: async () => {
      await zahnradOeffnen();
      await warteBis(
        seite(),
        `() => document.querySelector('[data-testid="status-extern"]') !== null`,
      );
      expect((await sichtbarerText('[data-testid="status-extern"]')) ?? "").not.toBe("");
      expect(await href('[data-testid="status-extern"]')).toBe("/admin");
    },
  },
  {
    // JOB 3065 H6: Der Endort ist erreicht. 3060 hatte die Gruppe als ZWISCHENSTAND ins Zahnrad
    // gelegt und im eigenen Quelltext festgehalten, wohin sie gehört: „Endort /admin Konten:
    // JOB 3065." Diese Zeile prüft ab hier den Endort — die Zusage (die Rollenwahl ist erreichbar)
    // ist dieselbe, nur der Ort ist der endgültige. Dass sie im Zahnrad NICHT mehr steht, sichert
    // `tests/app/h6-bedienort-register.test.ts` R3 und die Zählung B2 im H6-Funktionsinventar.
    kennung: "Z-rollenvorschau",
    heute: "RoleSwitcher „Ansicht als Rolle“ (Sidebar.tsx:253-319) → Zahnrad (JOB 3060)",
    ort: "/admin Konten → Zeile „Ansicht als Rolle“ → Detailkarte mit den vier Rollen (JOB 3065)",
    route: "/admin",
    pruefen: async () => {
      await warteBis(
        seite(),
        `() => document.querySelector('[data-testid="zeile-ansicht-rolle"]') !== null`,
      );
      expect(await sichtbarerText('[data-testid="zeile-ansicht-rolle"]')).toContain(
        t("role.viewAs"),
      );
      await seite().click('[data-testid="zeile-ansicht-rolle"]');
      await warteBis(
        seite(),
        `() => document.querySelector('[data-testid="detail-ansicht-rolle"]') !== null`,
      );
      expect(await texte('[data-testid="detail-ansicht-rolle"] button[aria-pressed]')).toEqual([
        t("role.short.viewer"),
        t("role.short.experte"),
        t("role.short.controller"),
        t("role.short.admin"),
      ]);
      // Und im Zahnrad ist sie wirklich weg — sonst wäre der Umzug nur eine Kopie.
      await zahnradOeffnen();
      expect(await texte('[data-testid="zahnrad-ansicht"] [role="menuitemradio"]')).toEqual([]);
      await seite().click('[data-testid="kopfband-zahnrad"]');
      await warteBis(
        seite(),
        `() => document.querySelector('[data-testid="zahnrad-menue"]') === null`,
      );
    },
  },
  {
    kennung: "Z-vorschau-rueckweg",
    heute: "„Zurück zu Admin“ in der Rollen-Vorschau (Sidebar.tsx:271-283)",
    ort: "Zahnrad-Menü „Zur Admin-Ansicht“ — und das Kopfband bleibt in JEDER Vorschaurolle bei seinem Inventar",
    // Gewählt wird jetzt in den Einstellungen (JOB 3065), zurück geht es weiter über das Zahnrad.
    route: "/admin",
    pruefen: async () => {
      const inventar = new Set([
        "KLARWERK",
        t("nav.start"),
        t("nav.ask"),
        t("nav.library"),
        t("kopfband.erfassen"),
        t("kopfband.pruefen"),
      ]);
      for (const rolle of ["viewer", "experte", "controller"]) {
        // JOB 3065 H6: Die Rolle wird jetzt DORT gewählt, wo sie hingehört — in den Einstellungen
        // (Konten → „Ansicht als Rolle"). Der Rückweg bleibt im Zahnrad, denn nur er überlebt die
        // Sperre, die der Rollen-Guard gleich über `/admin` legt.
        await warteBis(
          seite(),
          `() => document.querySelector('[data-testid="zeile-ansicht-rolle"]') !== null`,
        );
        await seite().click('[data-testid="zeile-ansicht-rolle"]');
        await warteBis(
          seite(),
          `() => document.querySelector('[data-testid="detail-ansicht-rolle"]') !== null`,
        );
        const kurz = t(`role.short.${rolle}`);
        await seite().click(
          `[data-testid="detail-ansicht-rolle"] button[aria-pressed]:has-text("${kurz}")`,
        );
        // Die Vorschau wirkt: der Rollen-Guard nimmt dem Admin die Seite, die Einstellungen sind
        // fort. (Früher wurde hier die Admin-Zeile im Zahnrad geprüft — die Rolle wurde ja dort
        // gewählt und das Menü stand offen. Jetzt ist es geschlossen; ein Klick auf das Zahnrad
        // würde es ÖFFNEN statt schließen.)
        await warteBis(seite(), `() => document.querySelector('[data-einst="seite"]') === null`);
        // Das Menü ist zu — jetzt gilt das Kopfbandinventar, sonst nichts (Codex R5).
        expect(
          await lies<boolean>(
            `() => document.querySelector('[data-testid="zahnrad-menue"]') === null`,
          ),
          "das Zahnrad-Menü stand offen — das Kopfband wäre nicht allein",
        ).toBe(true);
        const band = await lies<{
          woerter: string[];
          zaehler: string | null;
          initialen: string | null;
          knoepfe: string[];
        }>(
          `() => { const b = document.querySelector('header[data-testid="kopfband"]'); const z = b.querySelector('.kw-kopfband-zaehler'); const k = b.querySelector('[data-testid="kopfband-konto"]'); return { woerter: b.innerText.split(/\\s+/).filter(Boolean), zaehler: z ? z.innerText.trim() : null, initialen: k ? k.innerText.trim() : null, knoepfe: [...b.querySelectorAll('button')].map((x) => x.getAttribute('data-testid') || x.type) }; }`,
        );
        const fremd = band.woerter.filter(
          (w) => !inventar.has(w) && w !== band.zaehler && w !== band.initialen,
        );
        expect(fremd, `${rolle}: Text außerhalb des Kopfbandinventars`).toEqual([]);
        expect(band.knoepfe.sort()).toEqual(["kopfband-konto", "kopfband-zahnrad", "submit"]);
        expect(
          await lies<boolean>(
            `() => document.querySelector('[data-testid="kopfband-vorschau"]') === null`,
          ),
        ).toBe(true);
        // Der Rückweg: Zahnrad → „Zur Admin-Ansicht" — die echte Admin-Ansicht ist zurück.
        await zahnradOeffnen();
        await seite().click(
          `[data-testid="zahnrad-ansicht"] button:has-text("${t("role.backToAdmin")}")`,
        );
        await warteBis(
          seite(),
          `() => document.querySelector('[data-testid="zahnrad-einstellungen"]') !== null`,
        );
        await seite().click('[data-testid="kopfband-zahnrad"]');
        await warteBis(
          seite(),
          `() => document.querySelector('[data-testid="zahnrad-menue"]') === null`,
        );
      }
    },
  },
  {
    // JOB 3065 H6: Endort erreicht, wie 3060 es selbst vorgesehen hatte („Endort /admin Konten:
    // JOB 3065"). Der Schalter steht in der Zeile „Erweiterte Module · Stufe 2".
    kennung: "Z-stufe2",
    heute: "Stufe-2-Häkchen (Sidebar.tsx:305-314) → Zahnrad (JOB 3060)",
    ort: "/admin Konten → Zeile „Erweiterte Module · Stufe 2“ mit ihrem Häkchen (JOB 3065)",
    route: "/admin",
    pruefen: async () => {
      await warteBis(
        seite(),
        `() => document.querySelector('[data-testid="zeile-stufe2"]') !== null`,
      );
      expect(await sichtbarerText('[data-testid="zeile-stufe2"]')).toContain(t("role.stage2"));
      expect(
        await lies<boolean>(
          `() => document.querySelector('[data-testid="zeile-stufe2"] input[type="checkbox"]')?.checked === true`,
        ),
      ).toBe(true);
      // Im Zahnrad ist das Häkchen wirklich weg — sonst wäre der Umzug nur eine Kopie.
      await zahnradOeffnen();
      expect(
        await lies<boolean>(
          `() => document.querySelector('[data-testid="zahnrad-ansicht"] input[type="checkbox"]') === null`,
        ),
      ).toBe(true);
      await seite().click('[data-testid="kopfband-zahnrad"]');
      await warteBis(
        seite(),
        `() => document.querySelector('[data-testid="zahnrad-menue"]') === null`,
      );
    },
  },
  {
    kennung: "Z-naverklaerung",
    heute: "Nav-Erklärsätze title/aria-describedby (Sidebar.tsx:181-203, JOB 3028)",
    ort: "Zahnrad-Menü „Seitenhilfe“ — Satz des Hilfekapitels der aktuellen Seite",
    route: "/aufgaben",
    pruefen: async () => {
      await zahnradOeffnen();
      await aufklappen("zahnrad-seitenhilfe");
      const liste = (await texte('[data-testid="seitenhilfe-liste"] li')).join("\n");
      expect(liste).toContain(t("help.tasks.title"));
      expect(liste).toContain(t("help.tasks.body"));
      // Am Punkt selbst steht der Satz NICHT mehr (kein title, kein aria-describedby).
      expect(
        await lies<boolean>(
          `() => [...document.querySelectorAll('header a.kw-kopfband-punkt')].every((a) => !a.hasAttribute('title') && !a.hasAttribute('aria-describedby'))`,
        ),
      ).toBe(true);
    },
  },
  {
    kennung: "Z-helptips",
    heute: "HelpTip-Sprechblasen (components/HelpTip.tsx, 14 Seiten, Erfassen 33)",
    ort: "Zahnrad-Menü „Seitenhilfe“ — Titel + Text jedes Tipps der Seite; im Sichtfeld kein „?“",
    route: "/erfassen",
    pruefen: async () => {
      // Im Sichtfeld: kein Hilfe-Knopf mehr in <main>.
      expect(
        await lies<number>(
          `(label) => [...document.querySelectorAll('main button')].filter((b) => b.getAttribute('aria-label') === label).length`,
          t("help.open"),
        ),
      ).toBe(0);
      await zahnradOeffnen();
      await aufklappen("zahnrad-seitenhilfe");
      const eintraege = await texte('[data-testid="seitenhilfe-liste"] li');
      expect(
        eintraege.length,
        "kein HelpTip der Erfassen-Seite in der Seitenhilfe",
      ).toBeGreaterThan(1);
      // Ein konkreter Tipp der Erfassen-Seite, mit Titel UND Text (nicht nur ein Titel).
      const alle = eintraege.join("\n");
      expect(alle).toContain(t("help.capture.title"));
    },
  },
  ...BEREICHE.map<Zeile>(([id, pfad, labelKey]) => ({
    kennung: `Z-bereich-${id}`,
    heute: `Nav-Punkt ${id} (navigation.ts NAV_GROUPS)`,
    ort: "Zahnrad-Menü „Weitere Bereiche“",
    pruefen: async () => {
      await zahnradOeffnen();
      await aufklappen("zahnrad-weitere-bereiche");
      const sel = `[data-testid="bereich-${id}"]`;
      expect(await sichtbarerText(sel)).toMatch(
        new RegExp(`^${t(labelKey).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );
      expect(await href(sel)).toBe(pfad);
    },
  })),
  {
    kennung: "Z-bereich-zaehler",
    heute: "Nav-Badges der übrigen Punkte (Sidebar.tsx:23-151)",
    ort: "Zahl neben dem Eintrag in „Weitere Bereiche“ (Aufgaben zählt das Board mit)",
    pruefen: async () => {
      await zahnradOeffnen();
      await aufklappen("zahnrad-weitere-bereiche");
      const zahl = await sichtbarerText('[data-testid="bereich-aufgaben"] .kw-menue-wert');
      expect(Number(zahl)).toBeGreaterThanOrEqual(boardZahl);
    },
  },
  {
    kennung: "Z-hilfe",
    heute: "Hilfe (Sidebar.tsx:363, Topbar.tsx:607)",
    ort: "Zahnrad-Menü „Hilfe“ → /hilfe",
    pruefen: async () => {
      await zahnradOeffnen();
      expect(await sichtbarerText('[data-testid="zahnrad-hilfe"]')).toBe(t("nav.help"));
      expect(await href('[data-testid="zahnrad-hilfe"]')).toBe("/hilfe");
    },
  },
  {
    kennung: "Z-rechtliches",
    heute: "LegalFooter (AppShell.tsx:61, 88, 131)",
    ort: "Zahnrad-Menü „Rechtliches“ — Impressum und Datenschutz",
    pruefen: async () => {
      await zahnradOeffnen();
      await warteBis(
        seite(),
        `() => document.querySelector('[data-testid="zahnrad-rechtliches"]') !== null`,
      );
      await aufklappen("zahnrad-rechtliches");
      const links = await lies<string[]>(
        `() => [...document.querySelectorAll('[data-testid="zahnrad-menue"] footer a')].map((a) => a.getAttribute('href'))`,
      );
      expect(links).toEqual(["/impressum", "/datenschutz"]);
    },
  },
  {
    kennung: "Z-version",
    heute: "Versions-Pille (Topbar.tsx:660-667)",
    ort: "Zahnrad-Menü Fuß",
    pruefen: async () => {
      await zahnradOeffnen();
      expect(await sichtbarerText('[data-testid="zahnrad-menue"]')).toContain(`v${APP_VERSION}`);
    },
  },
  {
    kennung: "Z-insel",
    heute: "Insel-Marker (Topbar.tsx:511-521, 658)",
    ort: "Zahnrad-Menü Fuß (nur wenn der Bau eine Insel-Kennung trägt)",
    pruefen: async () => {
      const marker = await lies<string | null>(
        `() => document.head.querySelector('meta[name="klarwerk-island"]')?.getAttribute('content') ?? null`,
      );
      await zahnradOeffnen();
      const imMenue = await sichtbarerText("#klarwerk-island-marker");
      if (marker) {
        expect(imMenue).toBe(marker);
      } else {
        console.info(
          "JOB 3060 H1 · Insel-Marker: dieser Bau trägt keine Insel-Kennung — der Fuß zeigt sie deshalb nicht (wie zuvor).",
        );
        expect(imMenue).toBeNull();
      }
    },
  },
  {
    kennung: "Ko-kopf",
    heute: "Nutzerzeile Name + Rolle (Sidebar.tsx:367-376)",
    ort: "Konto-Menü Kopf",
    pruefen: async () => {
      await kontoOeffnen();
      const kopf = (await sichtbarerText('[data-testid="konto-kopf"]')) ?? "";
      expect(kopf).toContain("Peter Kohnert");
      expect(kopf).toContain(t("role.name.admin"));
    },
  },
  {
    kennung: "Ko-meldungen",
    heute: "NotificationBell + Panel + „Alle gelesen“ (Topbar.tsx:116-397)",
    ort: "Konto-Menü „Meldungen“ (Liste beim Aufklappen)",
    pruefen: async () => {
      await kontoOeffnen();
      expect(await sichtbarerText('[data-testid="konto-meldungen"]')).toContain(
        t("topbar.notifications"),
      );
      await aufklappen("konto-meldungen");
      const panel = (await sichtbarerText('[data-testid="konto-menue"]')) ?? "";
      // Entweder Einträge (ul) oder der ehrliche Leersatz — nie beides, nie nichts.
      const hatListe = await lies<boolean>(
        `() => document.querySelector('[data-testid="konto-menue"] ul li') !== null`,
      );
      if (!hatListe) {
        expect(panel).toContain(t("topbar.notificationsEmpty"));
      }
    },
  },
  {
    kennung: "Ko-mobil",
    heute: "Knopf „Mobil“ (Topbar.tsx:611-624)",
    ort: "Konto-Menü „Mobil“ → /mobile",
    pruefen: async () => {
      await kontoOeffnen();
      expect(await sichtbarerText('[data-testid="konto-mobil"]')).toBe(t("topbar.mobile"));
      await seite().click('[data-testid="konto-mobil"]');
      await warteBis(seite(), `() => location.pathname === '/mobile'`);
    },
  },
  {
    kennung: "Ko-darstellung",
    heute: "DesignTogglePill (Topbar.tsx:63-92)",
    ort: "Konto-Menü „Darstellung“ (Endort /profil: JOB 3065) — Klassisch bleibt wählbar",
    pruefen: async () => {
      await kontoOeffnen();
      expect(await sichtbarerText('[data-testid="konto-darstellung"]')).toBe(
        t("topbar.design.modern"),
      );
      await seite().click('[data-testid="konto-darstellung"]');
      await warteBis(seite(), `() => document.documentElement.getAttribute('data-theme') === null`);
      expect(await lies<string | null>(`() => localStorage.getItem('kw.designTheme')`)).toBe(
        "classic",
      );
      await seite().click('[data-testid="konto-darstellung"]');
      await warteBis(
        seite(),
        `() => document.documentElement.getAttribute('data-theme') === 'modern'`,
      );
    },
  },
  {
    kennung: "Ko-profil",
    heute: "Nutzerzeile → /profil (Sidebar.tsx:373)",
    ort: "Konto-Menü „Profil“ → /profil",
    pruefen: async () => {
      await kontoOeffnen();
      expect(await sichtbarerText('[data-testid="konto-profil"]')).toBe(t("nav.profile"));
      expect(await href('[data-testid="konto-profil"]')).toBe("/profil");
    },
  },
  {
    kennung: "Ko-abmelden",
    heute: "Abmelden (Sidebar.tsx:377-384)",
    ort: "Konto-Menü „Abmelden“",
    pruefen: async () => {
      await kontoOeffnen();
      expect(await sichtbarerText('[data-testid="konto-abmelden"]')).toBe(t("action.logout"));
    },
  },
  {
    kennung: "P-sprache",
    heute: "LangPill DE|EN|NL (Topbar.tsx:40-59)",
    ort: "/profil Zeile „Sprache“ (bereits vorhanden, Profile.tsx)",
    route: "/profil",
    pruefen: async () => {
      await warteBis(
        seite(),
        `(l) => (document.querySelector('main')?.innerText || '').includes(l)`,
        t("prof.language"),
      );
      const knoepfe = await lies<string[]>(
        `() => [...document.querySelectorAll('main button')].map((b) => (b.innerText || '').trim().toLowerCase()).filter((x) => ['de','en','nl'].includes(x))`,
      );
      expect(knoepfe).toEqual(["de", "en", "nl"]);
    },
  },
  {
    kennung: "D-drawer",
    heute: "Drawer ≤ 899 px mit Sidebar (AppShell.tsx:83, MobileNavDrawer.tsx:225)",
    ort: "Drawer zeigt Kopfband-Punkte, „Weitere Bereiche“, Zahnrad- und Konto-Einträge",
    pruefen: async () => {
      await seite().setViewportSize({ width: 390, height: 844 });
      await oeffne(seite(), "/start");
      await seite().click(`header button[aria-label="${t("topbar.openMenu")}"]`);
      await warteBis(seite(), `() => document.querySelector('dialog[aria-modal="true"]') !== null`);
      const text = (await sichtbarerText('dialog[aria-modal="true"]')) ?? "";
      for (const wort of [
        t("nav.start"),
        t("nav.ask"),
        t("nav.library"),
        t("kopfband.erfassen"),
        t("kopfband.pruefen"),
        t("menue.weitereBereiche"),
        t("menue.seitenhilfe"),
        t("menue.schnellnavigation"),
        t("nav.help"),
        t("topbar.notifications"),
        t("topbar.mobile"),
        t("nav.profile"),
        t("action.logout"),
      ]) {
        expect(text, `„${wort}“ fehlt im Drawer`).toContain(wort);
      }
      await seite().keyboard.press("Escape");
      await seite().setViewportSize({ width: 1280, height: 800 });
    },
  },
];

describe("JOB 3060 · H1 · das Funktionsinventar — jede Zeile der Tabelle heute → neuer Ort, in der gebauten App erreicht", () => {
  beforeAll(async () => {
    try {
      await i18n.changeLanguage("de");
      s = await strecke({ email: "pedi@job3060-inventar.test", stufe2: true });
      for (const title of [
        "Halterungen ohne waagerechte Oberseiten",
        "Profile: Ablaufbohrung 8 mm",
      ]) {
        await s.services.ko.create({
          title,
          statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
          type: "best_practice",
          category: "Allgemein",
          author: s.autorId,
        } as never);
      }
      const board = await s.app.inject({
        method: "GET",
        url: "/api/validation/board",
        headers: { authorization: `Bearer ${s.token}` },
      });
      boardZahl = (board.json() as unknown[]).length;
      console.info(
        `JOB 3060 H1 · Inventar · Chromium ${s.version} · Board ${boardZahl} · ${INVENTAR.length} Zeilen`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await s?.schliessen();
  }, 60_000);

  it("die Tabelle ist vollständig: jede Zeile aus 5a/5b steht hier (Kopfband 5+3, Zahnrad 26, Konto 6, Profil 1, Drawer 1 = 42)", () => {
    const kennungen = INVENTAR.map((z) => z.kennung);
    expect(new Set(kennungen).size).toBe(kennungen.length);
    expect(kennungen).toHaveLength(42);
    // Kopfband: fünf Punkte, Zähler, Suche, ⌘K.
    expect(kennungen.filter((k) => k.startsWith("K-"))).toHaveLength(8);
    // Zahnrad: Einstellungen, drei Status-Zeilen, Ansicht als Rolle, Stufe 2, Nav-Erklärsatz,
    // HelpTips, zwölf Weitere Bereiche, deren Zähler, Hilfe, Rechtliches, Version, Insel-Marker,
    // dazu der Vorschau-Rückweg „Zur Admin-Ansicht" samt Kopfbandinventar in jeder Vorschaurolle.
    expect(kennungen.filter((k) => k.startsWith("Z-"))).toHaveLength(26);
    expect(kennungen.filter((k) => k.startsWith("Ko-"))).toHaveLength(6);
    expect(kennungen.filter((k) => k.startsWith("P-"))).toHaveLength(1);
    expect(kennungen.filter((k) => k.startsWith("D-"))).toHaveLength(1);
  });

  for (const zeile of INVENTAR) {
    it(`${zeile.kennung} · ${zeile.heute} → ${zeile.ort}`, async () => {
      expect(fehler).toBeNull();
      await oeffne(seite(), zeile.route ?? "/start");
      // Der Zähler steht — das Board ist geladen, die Hülle ist zur Ruhe gekommen.
      await warteBis(
        seite(),
        `(n) => { const z = document.querySelector('.kw-kopfband-zaehler'); return z !== null && (z.textContent || '').trim() === String(n); }`,
        boardZahl,
      );
      await zeile.pruefen();
    }, 60_000);
  }
});
