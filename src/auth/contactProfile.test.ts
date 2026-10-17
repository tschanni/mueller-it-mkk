import { contactBody, emptyContact, validUsername, validateContact } from './contactProfile';

test.each(['a', 'MixedCase', 'Älex_1', 'x'.repeat(64)])('accepts contract username %s', name => {
  expect(validUsername(name)).toBe(true);
});
test.each(['', 'two words', ' leading', 'trailing ', '<name>', 'x'.repeat(65), 'a\u0000b'])('rejects invalid registration name', name => {
  expect(validUsername(name)).toBe(false);
});
test('all nine contacts accept empty values; empty strings become null to clear values', () => {
  expect(validateContact(emptyContact())).toEqual({});
  expect(contactBody(emptyContact())).toEqual({ firstName: null, lastName: null, street: null, houseNumber: null, postalCode: null, city: null, countryCode: null, phone: null, contactEmail: null });
});
test('international text and field length limits match the six DTO fields', () => {
  expect(validateContact({ ...emptyContact(), firstName: 'É'.repeat(100), lastName: '名'.repeat(100), street: 'x'.repeat(150), houseNumber: '１２-А/2.', postalCode: '０12-AB', city: 'x'.repeat(100) })).toEqual({});
  expect(Object.keys(validateContact({ ...emptyContact(), firstName: 'x'.repeat(101), lastName: 'x'.repeat(101), street: 'x'.repeat(151), houseNumber: 'x'.repeat(21), postalCode: 'x'.repeat(21), city: 'x'.repeat(101) }))).toHaveLength(6);
});


test('additional documented contacts are optional, validated and retained', () => {
  expect(validateContact({ ...emptyContact(), countryCode: 'DE', phone: '+49 (123) 456-7', contactEmail: 'contact@example.com' })).toEqual({});
  expect(validateContact({ ...emptyContact(), countryCode: 'de', phone: 'abc', contactEmail: 'invalid' })).toEqual(expect.objectContaining({ countryCode: expect.any(String), phone: expect.any(String), contactEmail: expect.any(String) }));
  expect(contactBody({ ...emptyContact(), countryCode: 'DE' })).toMatchObject({ countryCode: 'DE', phone: null, contactEmail: null });
});
