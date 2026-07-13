function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/** Validate browser mutation origins without trusting client-supplied proxy headers. */
export function isTrustedMutationOrigin(
  requestOrigin: string | null,
  requestUrlOrigin: string,
  configuredOrigins?: string,
): boolean {
  if (!requestOrigin) return true;
  const normalizedRequest = normalizeOrigin(requestOrigin);
  if (!normalizedRequest || normalizedRequest !== requestOrigin) return false;

  const configured = configuredOrigins
    ?.split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));
  const trusted = configured?.length ? configured : [normalizeOrigin(requestUrlOrigin)].filter(Boolean);
  return trusted.includes(normalizedRequest);
}
