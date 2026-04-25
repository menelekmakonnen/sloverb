import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Filter, Play, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Right-side filter drawer for Library / Artists / Albums views.
 * Props:
 *  - songs: full song array to derive filter options from
 *  - onFilter: (filteredSongs) => void — called whenever filters change
 *  - onPlayAll: (filteredSongs) => void — plays the filtered set
 */
export default function FilterDrawer({ songs = [], onFilter, onPlayAll }) {
  const [open, setOpen] = useState(false);
  const [deepSearch, setDeepSearch] = useState('');
  const [selectedFolders, setSelectedFolders] = useState(new Set());
  const [selectedArtists, setSelectedArtists] = useState(new Set());
  const [selectedAlbums, setSelectedAlbums] = useState(new Set());
  const [durationRange, setDurationRange] = useState('all');
  const [bpmRange, setBpmRange] = useState('all'); // all, slow, medium, fast, vfast
  const [selectedFormats, setSelectedFormats] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState({ folder: false, artist: false, album: false, format: false });

  // Derive filter options with counts from songs
  const folderCounts = useMemo(() => {
    const counts = {};
    songs.forEach(s => {
      if (s.path) {
        const parts = s.path.replace(/\\/g, '/').split('/');
        parts.pop();
        const folder = parts.join('/');
        counts[folder] = (counts[folder] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [songs]);

  const artistCounts = useMemo(() => {
    const counts = {};
    songs.forEach(s => { const a = s.artist || 'Unknown'; counts[a] = (counts[a] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [songs]);

  const albumCounts = useMemo(() => {
    const counts = {};
    songs.forEach(s => { const a = s.album || 'Unknown'; counts[a] = (counts[a] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [songs]);

  const formatCounts = useMemo(() => {
    const counts = {};
    songs.forEach(s => {
      const ext = (s.path || s.name || '').split('.').pop()?.toLowerCase();
      if (ext) counts[ext] = (counts[ext] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [songs]);

  // Apply filters
  const filtered = useMemo(() => {
    let result = [...songs];

    // Deep search
    if (deepSearch) {
      const terms = deepSearch.toLowerCase().split(/\s+/);
      result = result.filter(s => {
        const haystack = `${s.name || ''} ${s.artist || ''} ${s.album || ''} ${s.path || ''}`.toLowerCase();
        return terms.every(t => haystack.includes(t));
      });
    }

    // Folder
    if (selectedFolders.size > 0) {
      result = result.filter(s => {
        if (!s.path) return false;
        const folder = s.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
        return selectedFolders.has(folder);
      });
    }

    // Artist
    if (selectedArtists.size > 0) {
      result = result.filter(s => selectedArtists.has(s.artist || 'Unknown'));
    }

    // Album
    if (selectedAlbums.size > 0) {
      result = result.filter(s => selectedAlbums.has(s.album || 'Unknown'));
    }

    // Format
    if (selectedFormats.size > 0) {
      result = result.filter(s => {
        const ext = (s.path || s.name || '').split('.').pop()?.toLowerCase();
        return selectedFormats.has(ext);
      });
    }

    // Duration
    if (durationRange !== 'all') {
      result = result.filter(s => {
        const d = s.duration || 0;
        if (durationRange === 'short') return d < 60;
        if (durationRange === 'medium') return d >= 60 && d < 180;
        if (durationRange === 'long') return d >= 180 && d < 300;
        if (durationRange === 'vlong') return d >= 300;
        return true;
      });
    }

    // BPM
    if (bpmRange !== 'all') {
      result = result.filter(s => {
        const b = s.bpm || 0;
        if (!b) return false;
        if (bpmRange === 'slow') return b < 90;
        if (bpmRange === 'medium') return b >= 90 && b < 120;
        if (bpmRange === 'fast') return b >= 120 && b < 150;
        if (bpmRange === 'vfast') return b >= 150;
        return true;
      });
    }

    return result;
  }, [songs, deepSearch, selectedFolders, selectedArtists, selectedAlbums, selectedFormats, durationRange, bpmRange]);

  // Notify parent
  useMemo(() => { if (onFilter) onFilter(filtered); }, [filtered]);

  const activeCount = (deepSearch ? 1 : 0) + (selectedFolders.size > 0 ? 1 : 0) + (selectedArtists.size > 0 ? 1 : 0)
    + (selectedAlbums.size > 0 ? 1 : 0) + (selectedFormats.size > 0 ? 1 : 0) + (durationRange !== 'all' ? 1 : 0) + (bpmRange !== 'all' ? 1 : 0);

  const clearAll = () => {
    setDeepSearch(''); setSelectedFolders(new Set()); setSelectedArtists(new Set());
    setSelectedAlbums(new Set()); setSelectedFormats(new Set()); setDurationRange('all'); setBpmRange('all');
  };

  const toggleSet = (set, setFn, value) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    setFn(next);
  };

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const sectionStyle = { marginBottom: 12 };
  const headerStyle = { display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '6px 0', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const chipStyle = (active) => ({
    padding: '3px 8px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
    background: active ? 'var(--accent-muted)' : 'var(--bg-elevated)',
    color: active ? 'var(--accent)' : 'var(--text-dim)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--glass-border)'}`,
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  });

  return (
    <>
      {/* ── Handle tab (always visible on right edge) ── */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', right: 0, top: 80, zIndex: 46,
          width: 28, height: 70, borderRadius: '8px 0 0 8px',
          background: activeCount > 0 ? 'var(--accent)' : 'var(--bg-surface)',
          border: '1px solid var(--glass-border)', borderRight: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
          cursor: 'pointer', transition: 'background 0.2s',
          color: activeCount > 0 ? '#fff' : 'var(--text-dim)',
        }}
      >
        <Filter size={12} />
        {activeCount > 0 && <span style={{ fontSize: 8, fontWeight: 700 }}>{activeCount}</span>}
      </div>

      {/* ── Drawer panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, width: 260, zIndex: 45,
              background: 'var(--bg-surface)', borderLeft: '1px solid var(--glass-border)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 14px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Filters</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {activeCount > 0 && (
                  <button onClick={clearAll} style={{ fontSize: 10, color: 'var(--accent)', padding: '2px 8px', borderRadius: 8, background: 'var(--accent-muted)' }}>Clear</button>
                )}
                <button onClick={() => setOpen(false)} style={{ color: 'var(--text-dim)', padding: 2 }}><X size={14} /></button>
              </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
              {/* Deep Search */}
              <div style={sectionStyle}>
                <div style={{ position: 'relative' }}>
                  <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                  <input
                    value={deepSearch} onChange={e => setDeepSearch(e.target.value)}
                    placeholder="Deep search..."
                    style={{
                      width: '100%', padding: '7px 8px 7px 26px', borderRadius: 8, fontSize: 11,
                      background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)',
                      color: 'var(--text)', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Duration */}
              <div style={sectionStyle}>
                <div style={headerStyle}>Duration</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {[['all', 'All'], ['short', '<1m'], ['medium', '1-3m'], ['long', '3-5m'], ['vlong', '5m+']].map(([val, label]) => (
                    <span key={val} onClick={() => setDurationRange(val)} style={chipStyle(durationRange === val)}>{label}</span>
                  ))}
                </div>
              </div>

              {/* BPM */}
              <div style={sectionStyle}>
                <div style={headerStyle}>BPM Range</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {[['all', 'All'], ['slow', '<90'], ['medium', '90-120'], ['fast', '120-150'], ['vfast', '150+']].map(([val, label]) => (
                    <span key={val} onClick={() => setBpmRange(val)} style={chipStyle(bpmRange === val)}>{label}</span>
                  ))}
                </div>
              </div>

              {/* Format */}
              {formatCounts.length > 0 && (
                <div style={sectionStyle}>
                  <div onClick={() => toggleSection('format')} style={headerStyle}>
                    {expandedSections.format ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Format ({formatCounts.length})
                  </div>
                  {expandedSections.format && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {formatCounts.map(([f, count]) => (
                        <span key={f} onClick={() => toggleSet(selectedFormats, setSelectedFormats, f)} style={chipStyle(selectedFormats.has(f))}>{f.toUpperCase()} <span style={{ opacity: 0.5, fontSize: 9 }}>({count})</span></span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Folder */}
              {folderCounts.length > 0 && (
                <div style={sectionStyle}>
                  <div onClick={() => toggleSection('folder')} style={headerStyle}>
                    {expandedSections.folder ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Folder ({folderCounts.length})
                  </div>
                  {expandedSections.folder && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 180, overflow: 'auto' }}>
                      {folderCounts.map(([f, count]) => {
                        const shortName = f.split('/').filter(Boolean).slice(-2).join(' / ') || f;
                        return (
                          <div key={f} onClick={() => toggleSet(selectedFolders, setSelectedFolders, f)}
                            style={{
                              padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                              background: selectedFolders.has(f) ? 'var(--accent-muted)' : 'var(--bg-elevated)',
                              color: selectedFolders.has(f) ? 'var(--accent)' : 'var(--text)',
                              border: `1px solid ${selectedFolders.has(f) ? 'var(--accent)' : 'var(--glass-border)'}`,
                              transition: 'all 0.15s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            }}
                            title={f}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortName}</span>
                            <span style={{ fontSize: 9, opacity: 0.5, flexShrink: 0, marginLeft: 6 }}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Artist */}
              {artistCounts.length > 0 && (
                <div style={sectionStyle}>
                  <div onClick={() => toggleSection('artist')} style={headerStyle}>
                    {expandedSections.artist ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Artist ({artistCounts.length})
                  </div>
                  {expandedSections.artist && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflow: 'auto' }}>
                      {artistCounts.map(([a, count]) => (
                        <span key={a} onClick={() => toggleSet(selectedArtists, setSelectedArtists, a)} style={chipStyle(selectedArtists.has(a))}>{a} <span style={{ opacity: 0.5, fontSize: 9 }}>({count})</span></span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Album */}
              {albumCounts.length > 0 && (
                <div style={sectionStyle}>
                  <div onClick={() => toggleSection('album')} style={headerStyle}>
                    {expandedSections.album ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Album ({albumCounts.length})
                  </div>
                  {expandedSections.album && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 140, overflow: 'auto' }}>
                      {albumCounts.map(([a, count]) => (
                        <span key={a} onClick={() => toggleSet(selectedAlbums, setSelectedAlbums, a)} style={chipStyle(selectedAlbums.has(a))}>{a} <span style={{ opacity: 0.5, fontSize: 9 }}>({count})</span></span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer — Play All + Start Mix + Count */}
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{filtered.length} tracks</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => {
                    if (!onPlayAll) return;
                    const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, 25);
                    onPlayAll(shuffled);
                  }}
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: 11, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent)', border: '1px solid var(--accent-secondary)' }}
                >
                  Start Mix
                </button>
                <button
                  onClick={() => onPlayAll && onPlayAll(filtered)}
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontSize: 11, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <Play size={12} /> Play All
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
