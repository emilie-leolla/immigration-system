/**
 * Audit log entries need to render in whichever language the viewer is
 * using, but the actor who triggered them (agent, admin, client) could be
 * in a different language entirely. So instead of building the English
 * sentence at write time and saving it, we save a translation key + the
 * raw values, and build the sentence at read time in the viewer's locale.
 *
 * `AuditLog.details` stays a plain `String?` column — no schema change —
 * it just now holds a small JSON envelope instead of literal English text:
 *   { "key": "agentCreated", "params": { "name": "...", "email": "..." } }
 *
 * Older rows created before this change still hold a plain English
 * sentence in `details`. Those aren't JSON, so the reader (see
 * `resolveAuditDetails` used by ActivityItem and the logs table) falls
 * back to displaying them as-is — they stay in English forever, which is
 * a known, accepted trade-off (there's no way to retroactively translate
 * free text that was already written).
 */
export function auditDetails(key: string, params: Record<string, string | number | null | undefined> = {}): string {
    const safeParams: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params)) {
        safeParams[k] = v === null || v === undefined ? "N/A" : v;
    }
    return JSON.stringify({ key, params: safeParams });
}