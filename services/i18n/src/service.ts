export type Resources = Record<string, string>;

export interface I18nServiceDeps {
  fallbackLocale?: string;
}

// FR-I18N-01/02: ressourcenbasierte Übersetzung; neue Sprachen ohne Code-Umbau ergänzbar.
export class I18nService {
  private readonly catalog = new Map<string, Resources>();
  private readonly fallbackLocale: string;

  constructor(deps: I18nServiceDeps = {}) {
    this.fallbackLocale = deps.fallbackLocale ?? "de";
  }

  // FR-I18N-02: Sprache zur Laufzeit registrieren (kein Code-Umbau nötig).
  register(locale: string, resources: Resources): void {
    const existing = this.catalog.get(locale) ?? {};
    this.catalog.set(locale, { ...existing, ...resources });
  }

  locales(): string[] {
    return [...this.catalog.keys()];
  }

  has(locale: string): boolean {
    return this.catalog.has(locale);
  }

  // FR-I18N-01: Übersetzung mit Fallback; unbekannter Key liefert den Key selbst.
  translate(key: string, locale: string): string {
    const direct = this.catalog.get(locale)?.[key];
    if (direct !== undefined) {
      return direct;
    }
    const fallback = this.catalog.get(this.fallbackLocale)?.[key];
    return fallback ?? key;
  }
}
