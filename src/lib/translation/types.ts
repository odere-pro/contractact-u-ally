// UI translation languages — a deliberate subset of SUPPORTED_LANGUAGES.
// `en` is treated as the source-of-truth (no translation needed when the
// user picks it). `nl` and `sv` are the two jurisdictions the product
// targets, so workers reading their own contract see it in the language
// they speak.
export const UI_LANGUAGES = ["en", "nl", "sv"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const UI_LANGUAGE_LABEL: Record<UiLanguage, string> = {
  en: "English",
  nl: "Nederlands",
  sv: "Svenska",
};

// Two-letter codes the LanguageSwitcher renders inside each button.
export const UI_LANGUAGE_SHORT: Record<UiLanguage, string> = {
  en: "EN",
  nl: "NL",
  sv: "SV",
};

export interface TranslateItem {
  readonly id: string;
  readonly text: string;
}

export interface TranslateRequest {
  readonly targetLang: UiLanguage;
  readonly items: readonly TranslateItem[];
}

export interface TranslateResponse {
  readonly translations: readonly TranslateItem[];
}
