export interface CategoryStyle {
  color: string; // strong tint, used for stub numerals and cover gradients
  soft: string; // background for chips
  ink: string; // text on soft background (>= 4.5:1)
  pattern: "dots" | "waves" | "diamonds" | "rings" | "lines" | "grid" | "arches" | "stars";
  /** Flat poster palette: field, large shape, accent shape. `dark` = field is dark, so text on it is light. */
  poster: { bg: string; a: string; b: string; dark: boolean };
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  "ثقافة": { color: "#5d7be6", soft: "#e8edfc", ink: "#2c44a8", pattern: "lines", poster: { bg: "#72abfe", a: "#2b3fc4", b: "#fff1cf", dark: false } },
  "فن": { color: "#d6559a", soft: "#fbe6f1", ink: "#9c2a69", pattern: "waves", poster: { bg: "#fd84b4", a: "#7c1b57", b: "#ffe4a6", dark: false } },
  "تراث": { color: "#c68a2b", soft: "#fbefd6", ink: "#7a4d0a", pattern: "diamonds", poster: { bg: "#feb96c", a: "#6b3208", b: "#fff7e6", dark: false } },
  "عائلي": { color: "#e0803a", soft: "#fdebdb", ink: "#8f4510", pattern: "dots", poster: { bg: "#ff8f5a", a: "#fff0d4", b: "#5a2a96", dark: false } },
  "رياضة": { color: "#1f8f6e", soft: "#dff4ec", ink: "#146248", pattern: "rings", poster: { bg: "#63cc9c", a: "#0c4a37", b: "#fff6c9", dark: false } },
  "ورش": { color: "#8a54d6", soft: "#eee6fb", ink: "#5c2fa5", pattern: "grid", poster: { bg: "#ab88fc", a: "#35177f", b: "#ffd1e5", dark: false } },
  "طعام وقهوة": { color: "#b0653a", soft: "#f8e9df", ink: "#7a3d1c", pattern: "arches", poster: { bg: "#5b2a6e", a: "#feb96c", b: "#fd84b4", dark: true } },
  "تقنية": { color: "#2d86b8", soft: "#ddeff8", ink: "#176088", pattern: "stars", poster: { bg: "#25122f", a: "#72abfe", b: "#63cc9c", dark: true } }
};

const FALLBACK: CategoryStyle = { color: "#8963eb", soft: "#efe9fc", ink: "#5a33b8", pattern: "dots", poster: { bg: "#ab88fc", a: "#35177f", b: "#ffd1e5", dark: false } };

export const categoryStyle = (category: string): CategoryStyle => CATEGORY_STYLES[category] ?? FALLBACK;
