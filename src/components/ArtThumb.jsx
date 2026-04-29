import { useState, useEffect, useRef, useCallback } from 'react';
import MusicPlaceholder from './MusicPlaceholder';

/* ── LRU cache for album art data-URIs ── */
const ART_CACHE_MAX = 300;
const artCache = new Map();
function getCached(key) {
  if (!artCache.has(key)) return undefined;
  const val = artCache.get(key);
  // Move to end (most-recently-used)
  artCache.delete(key);
  artCache.set(key, val);
  return val;
}
function setCached(key, val) {
  if (artCache.size >= ART_CACHE_MAX) {
    // Evict oldest (first key)
    const oldest = artCache.keys().next().value;
    artCache.delete(oldest);
  }
  artCache.set(key, val);
}

/**
 * Lazy-loading album art thumbnail with animated SVG fallback.
 * Uses IntersectionObserver so album art is only fetched when visible.
 * Results are stored in an in-memory LRU cache (300 entries).
 */
export default function ArtThumb({ path, seed, size = 40, type = 'track', style = {}, children }) {
  const [art, setArt] = useState(() => getCached(path) || null);
  const [loaded, setLoaded] = useState(() => getCached(path) !== undefined);
  const containerRef = useRef(null);
  const fetchedRef = useRef(false); // prevent double-fetch

  const fetchArt = useCallback(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Check cache first
    const cached = getCached(path);
    if (cached !== undefined) {
      setArt(cached);
      setLoaded(true);
      return;
    }

    if (window.electronAPI && path) {
      window.electronAPI.getAlbumArt(path).then(r => {
        const value = r || null;
        setCached(path, value);
        setArt(value);
        setLoaded(true);
      }).catch(() => {
        setCached(path, null);
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }
  }, [path]);

  // Reset when path changes
  useEffect(() => {
    const cached = getCached(path);
    if (cached !== undefined) {
      setArt(cached);
      setLoaded(true);
      fetchedRef.current = true;
    } else {
      setArt(null);
      setLoaded(false);
      fetchedRef.current = false;
    }
  }, [path]);

  // IntersectionObserver — lazy-load when visible
  useEffect(() => {
    if (loaded || fetchedRef.current) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchArt();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // start loading 200px before entering viewport
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loaded, fetchArt]);

  const borderRadius = type === 'artist' ? '50%' : size * 0.18;

  return (
    <div ref={containerRef} style={{ width: size, height: size, flexShrink: 0, position: 'relative', overflow: 'hidden', ...style }}>
      {/* Always render placeholder as base layer */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <MusicPlaceholder seed={seed || path || ''} size={size} type={type} style={{ width: '100%', height: '100%', borderRadius: 0 }} />
      </div>
      {/* Overlay actual art when available */}
      {art && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          borderRadius: type === 'artist' ? '50%' : Math.min(size * 0.18, 14),
          background: `url(${art}) center/cover`,
          boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        }} />
      )}
      {/* Children overlay */}
      {children && <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%' }}>{children}</div>}
    </div>
  );
}
