export const GOOGLE_EMAIL_REGEX = /^(?!.*\.\.)[a-z0-9](?:[a-z0-9.]{4,28}[a-z0-9])@(gmail\.com|googlemail\.com)$/i;
export const LOGIN_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function isValidGoogleEmail(email) {
  return GOOGLE_EMAIL_REGEX.test(String(email || '').trim());
}

export function isValidLoginEmail(email) {
  return LOGIN_EMAIL_REGEX.test(String(email || '').trim());
}

export function isStrongPassword(password) {
  return STRONG_PASSWORD_REGEX.test(String(password || ''));
}

export function startsWithCapitalLetter(value) {
  return /^[A-Z]/.test(String(value || '').trim());
}