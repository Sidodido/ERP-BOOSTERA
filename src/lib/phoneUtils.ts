// Clean and normalize Algerian phone number
export function cleanDzPhone(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("002130") && digits.length >= 14) {
    digits = "0" + digits.slice(6);
  } else if (digits.startsWith("00213") && digits.length >= 13) {
    digits = "0" + digits.slice(5);
  } else if (digits.startsWith("2130") && digits.length >= 12) {
    digits = "0" + digits.slice(4);
  } else if (digits.startsWith("213") && digits.length >= 11) {
    digits = "0" + digits.slice(3);
  }

  // If 9 digits without leading 0 (e.g. 550123456 -> 0550123456)
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
  // If 8 digits landline without leading 0 (e.g. 23383536 or 21606262)
  if (
    digits.length === 8 &&
    (digits.startsWith("2") || digits.startsWith("3") || digits.startsWith("4"))
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

// Universal Algerian phone regex matching landlines (021, 023, 025, 031, etc.) and mobiles (05, 06, 07)
export const DZ_PHONE_REGEX = /(?:(?:\+|00)213\s*(?:\(?0\)?\s*)?|0)\s*[2-79](?:[\s.-]*\d){7,8}/g;

export function extractBestDzPhone(text: string): string {
  if (!text) return "";
  const patterns = [
    // Mobile: 05, 06, 07 followed by 8 digits (supports spaces, dots, dashes, slashes)
    /(?:(?:\+|00)213\s*(?:\(?0\)?\s*)?|0)\s*[5-7](?:[\s./-]*\d){8}/g,
    // Landline: 02, 03, 04, 09 followed by 7 digits
    /(?:(?:\+|00)213\s*(?:\(?0\)?\s*)?|0)\s*[2-49](?:[\s./-]*\d){7}/g,
    // Standard catch-all: 7 to 8 digits
    /(?:(?:\+|00)213\s*(?:\(?0\)?\s*)?|0)\s*[2-79](?:[\s./-]*\d){7,8}/g,
  ];
  for (const regex of patterns) {
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      for (const m of matches) {
        const cleaned = cleanDzPhone(m);
        if (cleaned.length >= 8 && cleaned.length <= 10) return cleaned;
      }
    }
  }
  return "";
}
