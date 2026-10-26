/** USA launch: adults-only 18+ (ADR-004 D-01). No additional geo restrictions invented here. */

export function parseBirthDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isAtLeast18UsaLaunch(birthDate: Date, asOf: Date = new Date()): boolean {
  const asOfUtc = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const eighteenth = new Date(
    Date.UTC(birthDate.getUTCFullYear() + 18, birthDate.getUTCMonth(), birthDate.getUTCDate()),
  );
  return asOfUtc >= eighteenth.getTime();
}
