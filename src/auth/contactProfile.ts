/** Optional private fields from backend 03030cce4409eec9a347998feeea71062affd5fb. */
export const contactFields = [
  { key: 'firstName', label: 'Vorname', maxLength: 100, autoComplete: 'given-name' },
  { key: 'lastName', label: 'Nachname', maxLength: 100, autoComplete: 'family-name' },
  { key: 'street', label: 'Straße', maxLength: 150, autoComplete: 'address-line1' },
  { key: 'houseNumber', label: 'Hausnummer', maxLength: 20, autoComplete: 'address-line2' },
  { key: 'postalCode', label: 'Postleitzahl', maxLength: 20, autoComplete: 'postal-code' },
  { key: 'city', label: 'Ort', maxLength: 100, autoComplete: 'address-level2' },
  { key: 'countryCode', label: 'Land (ISO-Code)', maxLength: 2, autoComplete: 'country' },
  { key: 'phone', label: 'Telefon', maxLength: 32, autoComplete: 'tel' },
  { key: 'contactEmail', label: 'Kontakt-E-Mail', maxLength: 254, autoComplete: 'email' },
] as const;
export type ContactField = typeof contactFields[number]['key'];
export type ContactInput = Record<ContactField, string | null>;
export type ContactDraft = Record<ContactField, string>;
export interface ContactProfile extends ContactInput { userId: string; updatedAt: string }
export type ContactErrors = Partial<Record<ContactField, string>>;
export const emptyContact = (): ContactDraft => ({ firstName: '', lastName: '', street: '', houseNumber: '', postalCode: '', city: '', countryCode: '', phone: '', contactEmail: '' });

// Match the DTO regexes, including international letters/numbers in house/ZIP.
// Control characters are deliberately excluded, as in ContactProfileDto.
// eslint-disable-next-line no-control-regex
const freeText = new RegExp('^[^<>\\u0000-\\u001f\\u007f]*$', 'u');
const houseNumber = new RegExp('^[\\p{L}\\p{N} /.-]*$', 'u');
const postalCode = new RegExp('^[\\p{L}\\p{N} -]*$', 'u');
// Same explicit control-character exclusions as the backend registration hook.
// eslint-disable-next-line no-control-regex
const usernamePattern = new RegExp('^[^\\s\\u0000-\\u001f\\u007f<>]{1,64}$', 'u');
export const validUsername = (name: string) => usernamePattern.test(name);
export const usernameHint = 'Der Benutzername muss 1 bis 64 Zeichen lang sein und darf keine Leerzeichen, Steuerzeichen oder spitzen Klammern enthalten.';

export function validateContact(draft: ContactDraft): ContactErrors {
  const errors: ContactErrors = {};
  for (const field of contactFields) {
    const value = draft[field.key];
    if (value === '') continue;
    const pattern = field.key === 'houseNumber' ? houseNumber : field.key === 'postalCode' ? postalCode : freeText;
    if (Array.from(value).length > field.maxLength) errors[field.key] = `${field.label}: höchstens ${field.maxLength} Zeichen.`;
    else if (field.key === 'countryCode' && !/^[A-Z]{2}$/.test(value)) errors[field.key] = 'Land: bitte zwei Grossbuchstaben angeben, zum Beispiel DE.';
    else if (field.key === 'phone' && !/^[+0-9 ()./-]{3,32}$/.test(value)) errors[field.key] = 'Telefon: bitte 3 bis 32 Ziffern oder Telefon-Trennzeichen verwenden.';
    else if (field.key === 'contactEmail' && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(value)) errors[field.key] = 'Bitte geben Sie eine gueltige Kontakt-E-Mail-Adresse ein.';
    else if (!pattern.test(value)) errors[field.key] = field.key === 'houseNumber'
      ? 'Hausnummer: Buchstaben, Ziffern, Leerzeichen, /, Punkt und Bindestrich sind erlaubt.'
      : field.key === 'postalCode' ? 'Postleitzahl: Buchstaben, Ziffern, Leerzeichen und Bindestrich sind erlaubt.'
      : `${field.label}: keine Steuerzeichen oder spitzen Klammern verwenden.`;
  }
  return errors;
}
export function contactBody(draft: ContactDraft): ContactInput {
  const result = {} as ContactInput;
  for (const { key } of contactFields) result[key] = draft[key] === '' ? null : draft[key];
  return result;
}
export function contactDraft(profile: ContactProfile | null): ContactDraft {
  const draft = emptyContact();
  for (const { key } of contactFields) draft[key] = profile?.[key] ?? '';
  return draft;
}
