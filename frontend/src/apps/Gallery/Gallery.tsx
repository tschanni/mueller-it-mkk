import React, { useState, useMemo } from 'react';
import './gallery.css';

// Alle Bilder aus dem Ordner automatisch laden (png/jpg/jpeg/gif)
// require.context ist in CRA/webpack verfügbar
const req = (require as any).context('./images', false, /\.(png|jpe?g|gif)$/i);

type ImageItem = {
  fileName: string;
  thumb: string;
  full: string;
};

export const Gallery: React.FC = () => {
  const images: ImageItem[] = useMemo(() => {
    return req.keys().map((key: string) => {
      const src = req(key) as string;
      const name = key.replace(/^\.\//, '');
      return { fileName: name, thumb: src, full: src };
    });
  }, []);

  const [selected, setSelected] = useState<ImageItem | null>(null);

  return (
    <div className="gallery">
      <div className="grid">
        {images.map((img) => (
          <button key={img.fileName} className="thumb" onClick={() => setSelected(img)}>
            <img src={img.thumb} alt={img.fileName} />
            <span className="name">{img.fileName}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="viewer">
          <div className="viewer-header">
            <span>{selected.fileName}</span>
            <button onClick={() => setSelected(null)} aria-label="Close">Schließen</button>
          </div>
          <div className="viewer-body">
            <img src={selected.full} alt={selected.fileName} />
          </div>
        </div>
      )}
    </div>
  );
};
