/**
 * Null-safe full name from firstName + lastName.
 *   both present  → "John Doe"
 *   first only    → "John"
 *   last only     → "Doe"
 *   neither       → null
 */
export function fullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const first = firstName?.trim() || null;
  const last = lastName?.trim() || null;
  if (first && last) return `${first} ${last}`;
  return first ?? last ?? null;
}
