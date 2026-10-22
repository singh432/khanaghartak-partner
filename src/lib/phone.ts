/**
 * Phone number utilities for KhanaGharTak.
 *
 * Ensures all dialer links use the Indian international country code (+91).
 * This prevents Android dialers (Samsung Phone, Google Phone) from interpreting
 * 10-digit Indian phone numbers starting with 9 (e.g. 972, 956, 940, 915, 903, 832)
 * as North American (NANP) Texas area codes (+1 9xx).
 */

export function formatIndiaTel(phone: string | null | undefined): string {
  if (!phone) return "";
  const cleaned = phone.trim();

  // If already prefixed with +, clean and ensure valid format
  if (cleaned.startsWith("+")) {
    const digits = cleaned.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) {
      return `+${digits}`;
    }
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    return `+${digits}`;
  }

  const digits = cleaned.replace(/\D/g, "");
  if (!digits) return "";

  // 12 digits starting with 91 -> +91XXXXXXXXXX
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // 11 digits starting with 0 -> +91XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  // 10 digits or more -> take last 10 digits and prefix +91
  if (digits.length >= 10) {
    return `+91${digits.slice(-10)}`;
  }

  return `+91${digits}`;
}
