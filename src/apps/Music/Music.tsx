import React, { useEffect, useState } from 'react';
import { publicAsset } from '../../utils/publicAsset';
import './music.css';

interface Track {
  title: string;
  artist: string;
  youtube: string; // full URL or id
}

const ytIdFromUrl = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    if (u.searchParams.has('v')) return u.searchParams.get('v') || '';
    // last path segment fallback
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.pop() || '';
  } catch {
    return url; // if an id was provided directly
  }
};

export const Music: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState<Track | null>(null);

  useEffect(() => {
    fetch(publicAsset('music.json'))
      .then((r) => r.json())
      .then(setTracks)
      .catch((e) => console.error('Failed to load music.json', e));
  }, []);

  return (
    <div className="music-app">
      {!current && (
        <div className="music-grid">
          {tracks.map((t, i) => (
            <button key={i} className="music-item" onClick={() => setCurrent(t)}>
              <div className="music-thumb" aria-hidden>
                {/* simple note icon via emoji */}
                <span className="note">🎵</span>
              </div>
              <div className="music-label">{t.artist} - {t.title}.mp3</div>
            </button>
          ))}
        </div>
      )}
      {current && (
        <div className="player">
          <div className="player-header">
            <button onClick={() => setCurrent(null)}>← zurück</button>
            <span>{current.artist} - {current.title}</span>
          </div>
          <div className="player-frame">
            <iframe
              title={`${current.artist} - ${current.title}`}
              width="100%"
              height="360"
              src={`https://www.youtube.com/embed/${ytIdFromUrl(current.youtube)}?autoplay=1&playsinline=1`}
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <a href={`https://www.youtube.com/watch?v=${ytIdFromUrl(current.youtube)}`} target="_blank" rel="noopener noreferrer">
            Auf YouTube öffnen
          </a>
        </div>
      )}
    </div>
  );
}

export default Music;
