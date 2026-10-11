/**
 * UUID Validation Utility
 * Validates RFC4122-compliant UUID string format
 */
export function isValidUuid(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());
}
