// Custom pages are edited as one HTML document, but stored as sanitized HTML plus page-scoped
// CSS (the public site wraps the CSS in `@scope`). `<style>` blocks carry the CSS in between.

const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;

/** One editable document: the page CSS as a leading `<style>` block, then the HTML. */
export function joinPageSource(html: string, css: string | null | undefined): string {
  const style = css?.trim() ? `<style>\n${css.trim()}\n</style>\n\n` : "";
  return `${style}${html}`;
}

/** Splits an edited document back into HTML and CSS; every `<style>` block becomes CSS. */
export function splitPageSource(source: string): { contentHtml: string; customCss: string | null } {
  const css: string[] = [];
  const html = source.replace(STYLE_BLOCK, (_, body: string) => {
    if (body.trim()) css.push(body.trim());
    return "";
  });
  return { contentHtml: html.trim(), customCss: css.length ? css.join("\n\n") : null };
}
