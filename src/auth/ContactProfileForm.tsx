import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { contactBody, contactDraft, contactFields, ContactErrors, emptyContact, validateContact } from './contactProfile';
import { safeAuthMessage } from './client';

/** Only mounted within the authenticated user's keyed account view. No persistent cache. */
export function ContactProfileForm() {
  const { getProfile, saveProfile, busy } = useAuth();
  const [draft, setDraft] = useState(emptyContact);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [retry, setRetry] = useState(0);
  const saveAbort = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; saveAbort.current?.abort(); };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    let active = true;
    const timer = setTimeout(() => abort.abort(), 10000);
    setLoading(true); setLoadError('');
    void getProfile(abort.signal).then(profile => {
      if (active && !abort.signal.aborted) setDraft(contactDraft(profile));
    }).catch(error => {
      if (active) setLoadError(safeAuthMessage(error));
    }).finally(() => {
      clearTimeout(timer);
      if (active) setLoading(false);
    });
    return () => { active = false; abort.abort(); clearTimeout(timer); };
  }, [getProfile, retry]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading || loadError || busy || saveAbort.current) return;
    setSaved(false); setSaveError('');
    const invalid = validateContact(draft);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    const abort = new AbortController();
    saveAbort.current = abort;
    setSaving(true);
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const profile = await saveProfile(contactBody(draft), abort.signal);
      if (mounted.current && !abort.signal.aborted) { setDraft(contactDraft(profile)); setSaved(true); }
    } catch (error) {
      // Preserve the draft on validation, timeout, network or server failure.
      if (mounted.current) setSaveError(safeAuthMessage(error));
    } finally {
      clearTimeout(timer);
      if (saveAbort.current === abort) saveAbort.current = null;
      if (mounted.current) setSaving(false);
    }
  }
  return <form aria-label="Kontaktdaten" noValidate onSubmit={submit} aria-busy={loading || saving}>
    <fieldset><legend>Kontaktdaten (optional)</legend>
      <p>Alle Felder können leer bleiben. Leeren Sie ein Feld, um den gespeicherten Wert zu löschen.</p>
      {loading && <p role="status">Kontaktdaten werden geladen…</p>}
      {loadError && <div className="auth-errors" role="alert"><p>{loadError}</p><button type="button" disabled={busy || loading} onClick={() => setRetry(value => value + 1)}>Kontaktdaten erneut laden</button></div>}
      {saveError && <p className="auth-errors" role="alert">{saveError} Ihre Eingaben bleiben erhalten.</p>}
      {saved && <p className="auth-feedback auth-feedback-success" role="status">Ihre Kontaktdaten wurden gespeichert.</p>}
      <div className="auth-fields">
        {contactFields.map(field => <React.Fragment key={field.key}>
          <label htmlFor={`contact-${field.key}`}>{field.label}:</label>
          <div className="auth-contact-input">
            <input id={`contact-${field.key}`} autoComplete={field.autoComplete} type={field.key === 'contactEmail' ? 'email' : field.key === 'phone' ? 'tel' : 'text'}
              disabled={loading || !!loadError || saving || busy} value={draft[field.key]}
              aria-invalid={!!errors[field.key]} aria-describedby={errors[field.key] ? `contact-${field.key}-error` : undefined}
              onChange={event => { setDraft(value => ({ ...value, [field.key]: event.target.value })); setErrors(value => ({ ...value, [field.key]: undefined })); setSaved(false); setSaveError(''); }} />
            {errors[field.key] && <span id={`contact-${field.key}-error`} className="auth-field-error" role="alert">{errors[field.key]}</span>}
          </div>
        </React.Fragment>)}
      </div>
      <div className="auth-actions"><button disabled={loading || !!loadError || saving || busy}>{saving ? 'Bitte warten…' : 'Kontaktdaten speichern'}</button></div>
    </fieldset>
  </form>;
}
