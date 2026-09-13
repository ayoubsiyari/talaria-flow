/** HTML-escape untrusted text before it is inserted into markup (pages and emails). */
export function escapeHtml(value: unknown): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Replace {{key}} placeholders with escaped values; unknown keys become empty strings. */
export function fillTemplate(html: string, data: Record<string, unknown> = {}): string {
  return String(html ?? '').replace(/\{\{([\s\S]*?)\}\}/g, (_, inner: string) => {
    const key = String(inner).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, '').replace(/\s+/g, '');
    if (!/^[a-zA-Z0-9_]+$/.test(key)) return '';
    return escapeHtml(data[key]);
  });
}
