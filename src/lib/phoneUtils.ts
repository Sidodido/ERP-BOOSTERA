// Clean and normalize Algerian phone number
export function cleanDzPhone(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("213") && digits.length >= 11) {
    digits = "0" + digits.slice(3);
  }
  if (digits.startsWith("00213") && digits.length >= 13) {
    digits = "0" + digits.slice(5);
  }
  // If 9 digits without leading 0, add 0 (e.g. 550123456 -> 0550123456)
  if (
    digits.length === 9 &&
    (digits.startsWith("5") ||
      digits.startsWith("6") ||
      digits.startsWith("7") ||
      digits.startsWith("2") ||
      digits.startsWith("3") ||
      digits.startsWith("4"))
  ) {
    digits = "0" + digits;
  }
  return digits;
}

// Format phone nicely: 0550 12 34 56 or 021 66 12 34
export function formatDzPhoneDisplay(phone: string): string {
  const p = cleanDzPhone(phone);
  if (!p) return phone;
  if (p.length === 10 && (p.startsWith("05") || p.startsWith("06") || p.startsWith("07"))) {
    return `${p.slice(0, 4)} ${p.slice(4, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)}`;
  }
  if (p.length === 9) {
    return `${p.slice(0, 3)} ${p.slice(3, 5)} ${p.slice(5, 7)} ${p.slice(7, 9)}`;
  }
  return p;
}
