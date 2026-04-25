import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';
import { Palette, Monitor, Info, FolderOpen, Download } from 'lucide-react';
import { useState, useEffect } from 'react';

const THEMES = [
  { id: 'violet', label: 'Violet', color: '#a78bfa' },
  { id: 'neon', label: 'Neon Pink', color: '#f472b6' },
  { id: 'ocean', label: 'Ocean Blue', color: '#38bdf8' },
  { id: 'emerald', label: 'Emerald', color: '#34d399' },
  { id: 'sunset', label: 'Sunset', color: '#fb923c' },
];

export default function SettingsView() {
  const { theme, setTheme, mode, toggleMode, addToast } = useUIStore();
  const [downloadDir, setDownloadDir] = useState('');

  useEffect(() => {
    if (window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then(s => {
        setDownloadDir(s.downloadDir || '');
      });
    }
  }, []);

  const handlePickDir = async () => {
    if (!window.electronAPI?.selectDownloadDir) return;
    const dir = await window.electronAPI.selectDownloadDir();
    if (dir) {
      setDownloadDir(dir);
      await window.electronAPI.saveSettings({ downloadDir: dir });
      addToast(`Download folder set: ${dir}`, 'success');
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 32px' }}>Personalize your Sloverb experience</p>

        {/* Appearance */}
        <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Palette size={16} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Appearance</span>
          </div>

          {/* Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--glass-border)' }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Dark Mode</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>Toggle between dark and light mode</p>
            </div>
            <button onClick={toggleMode} className="btn" style={{
              padding: '6px 16px', borderRadius: 20,
              background: mode === 'dark' ? 'var(--accent-muted)' : 'var(--bg-elevated)',
              border: '1px solid var(--border-accent)',
              color: 'var(--accent)', fontSize: 12, fontWeight: 600,
            }}>
              <Monitor size={14} /> {mode === 'dark' ? 'Dark' : 'Light'}
            </button>
          </div>

          {/* Theme Selection */}
          <p style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px', fontWeight: 600 }}>Accent Theme</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
            {THEMES.map(t => {
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    padding: '12px 8px',
                    borderRadius: 12,
                    background: isActive ? 'var(--accent-muted)' : 'var(--bg-surface)',
                    border: `1.5px solid ${isActive ? t.color : 'var(--glass-border)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: t.color,
                    boxShadow: isActive ? `0 0 16px ${t.color}40` : 'none',
                  }} />
                  <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--text)' : 'var(--text-secondary)' }}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Downloads */}
        {window.electronAPI && (
          <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Download size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Downloads</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--glass-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Download Folder</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {downloadDir || 'Default: Windows Music folder'}
                </p>
              </div>
              <button onClick={handlePickDir} className="btn" style={{
                padding: '6px 16px', borderRadius: 20,
                background: 'var(--accent-muted)',
                border: '1px solid var(--border-accent)',
                color: 'var(--accent)', fontSize: 12, fontWeight: 600,
                flexShrink: 0,
              }}>
                <FolderOpen size={14} /> Browse
              </button>
            </div>
          </div>
        )}

        {/* About */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Info size={16} color="var(--accent)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>About</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 4px' }}><strong>Sloverb Studio</strong> v2.0.0</p>
            <p style={{ margin: '0 0 4px' }}>By Menelek Makonnen • ICUNI Labs</p>
            <p style={{ margin: 0, color: 'var(--text-dim)' }}>
              Premium audio processing & media player.<br />
              All processing runs locally — no uploads to any server.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
