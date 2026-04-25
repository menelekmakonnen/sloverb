import { useState, useEffect } from 'react';
import MusicPlaceholder from './MusicPlaceholder';

/**
 * Lazy-loading album art thumbnail with animated SVG fallback.
 * Loads art via electronAPI.getAlbumArt, shows MusicPlaceholder while loading or if none found.
 */
export default function ArtThumb({ path, seed, size = 40, type = 'track', style = {}, children }) {
  const [art, setArt] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setArt(null);
    setLoaded(false);
    if (window.electronAPI && path) {
      window.electronAPI.getAlbumArt(path).then(r => {
        if (r) setArt(r);
        setLoaded(true);
      }).catch(() => setLoaded(true));
    } else {
      setLoaded(true);
    }
  }, [path]);

  const borderRadius = type === 'artist' ? '50%' : size * 0.18;

  if (art) {
    return (
      <div style={{
        width: size, height: size, borderRadius, flexShrink: 0,
        background: `url(${art}) center/cover`,
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        position: 'relative',
        ...style,
      }}>
        {children}
      </div>
    );
  }

  // Animated placeholder
  return (
    <div style={{ position: 'relative', ...style }}>
      <MusicPlaceholder seed={seed || path || ''} size={size} type={type} />
      {children}
    </div>
  );
}
