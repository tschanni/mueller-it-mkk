import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { AuthUser } from './client';
import { ProfileImage } from './ProfileImage';

export function ProfileImageEditor({ user }: { user: AuthUser }) {
  const { busy, imageUploadAvailable, uploadProfileImage } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <fieldset aria-busy={busy}><legend>Profilbild</legend>
    {preview ? <img src={preview} width={64} height={64} alt="Vorschau des neuen Profilbilds" /> : <ProfileImage image={user.image} name={user.name} size={64} />}
    <label className="auth-image-input">Bild auswählen (PNG, JPEG oder WebP, maximal 5 MB)
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || !imageUploadAvailable} onChange={event => {
        const selected = event.target.files?.[0]; setFile(null); setError('');
        if (!selected) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type) || selected.size > 5 * 1024 * 1024 || !selected.size) {
          setError('Bitte wählen Sie eine PNG-, JPEG- oder WebP-Datei mit maximal 5 MB.'); event.target.value = ''; return;
        }
        setFile(selected);
      }} />
    </label>
    {!imageUploadAvailable && <p role="status">Der Profilbild-Upload ist auf dem Server noch nicht eingerichtet.</p>}
    {error && <p role="alert">{error}</p>}
    <button disabled={busy || !file || !imageUploadAvailable} onClick={async () => {
      if (file && await uploadProfileImage(file)) { setFile(null); if (input.current) input.current.value = ''; }
    }}>{busy ? <><span className="auth-spinner" aria-hidden="true" />Bild wird gespeichert …</> : 'Profilbild speichern'}</button>
  </fieldset>;
}
