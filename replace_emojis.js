import fs from 'fs';

let content = fs.readFileSync('src/SlowedReverbTool.jsx', 'utf8');

if (!content.includes('lucide-react')) {
  content = content.replace("import '@fontsource/space-mono';", "import { Sun, Moon, Music, Repeat, Pause, Play, Square, VolumeX, Volume1, Volume2, Check, Download, Settings, Disc, Video, HardDrive } from 'lucide-react';\nimport '@fontsource/space-mono';");
}

content = content.replace('{isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}', '{isDark ? <span style={{display:"flex", alignItems:"center", gap: 6}}><Sun size={14}/> Light Mode</span> : <span style={{display:"flex", alignItems:"center", gap: 6}}><Moon size={14}/> Dark Mode</span>}');
content = content.replace('<div style={{ fontSize: 36, marginBottom: 12 }}>🎵</div>', '<div style={{ marginBottom: 16, display: "flex", justifyContent: "center", color: "rgba(167,139,250,0.8)" }}><Music size={42} /></div>');
content = content.replace('<div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎵</div>', '<div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}><Music size={20} color="#a78bfa" /></div>');
content = content.replace('🔁 {isRepeat ? "Repeat: ON" : "Repeat: OFF"}', '<span style={{display:"flex", alignItems:"center", gap: 6}}><Repeat size={14}/> {isRepeat ? "ON" : "OFF"}</span>');
content = content.replace('{isPlaying ? "⏸ Pause" : "▶ Play"}', '{isPlaying ? <span style={{display:"flex", alignItems:"center", gap: 6}}><Pause size={16}/> Pause</span> : <span style={{display:"flex", alignItems:"center", gap: 6}}><Play size={16}/> Play</span>}');
content = content.replace('⏹ Stop', '<span style={{display:"flex", alignItems:"center", gap: 6}}><Square size={16}/> Stop</span>');
content = content.replace('{masterVolume === 0 ? "🔇" : masterVolume < 0.5 ? "🔉" : "🔊"}', '{masterVolume === 0 ? <VolumeX size={20} color={masterVolume === 0 ? "#6b7280" : "#a78bfa"} /> : masterVolume < 0.5 ? <Volume1 size={20} color="#a78bfa" /> : <Volume2 size={20} color="#a78bfa" />}');
content = content.replace('exportDone ? "✓ Downloaded!" : "⬇ Export WAV"', 'exportDone ? <span style={{display:"flex", alignItems:"center", justifyContent:"center", gap: 8}}><Check size={18}/> Downloaded!</span> : <span style={{display:"flex", alignItems:"center", justifyContent:"center", gap: 8}}><Download size={18}/> Export WAV</span>');
content = content.replace('⚙', '<Settings size={22} />');
content = content.replace('<span style={{ fontSize: 18 }}>💿</span>', '<Disc size={20} color="#a78bfa" />');
content = content.replace('▶ Play All', '<span style={{display:"flex", alignItems:"center", gap: 6}}><Play size={14}/> Play All</span>');
content = content.replace('<div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🎵</div>', '<div style={{ marginBottom: 20, display: "flex", justifyContent: "center", color: "rgba(167,139,250,0.5)" }}><Music size={56} /></div>');
content = content.replace('{item.type === "raw" ? "🎵" : item.type === "video" ? "🎥" : "💿"}', '{item.type === "raw" ? <Music size={20} color="#fff" /> : item.type === "video" ? <Video size={20} color="#fff" /> : <Disc size={20} color="#fff" />}');
content = content.replaceAll('▶ Play</button>', '<span style={{display:"flex", alignItems:"center", gap:4}}><Play size={12}/> Play</span></button>');
content = content.replace('<div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>💽</div>', '<div style={{ marginBottom: 20, display: "flex", justifyContent: "center", color: "rgba(167,139,250,0.5)" }}><HardDrive size={56} /></div>');
content = content.replace('<span style={{ fontSize: 40, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>💽</span>', '<HardDrive size={40} color="#fff" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }} />');
content = content.replace('flexShrink: 0 }}>💽</div>', 'flexShrink: 0 }}><HardDrive size={56} color="#fff" /></div>');
content = content.replace('▶ Play Playlist', '<span style={{display:"flex", alignItems:"center", justifyContent:"center", gap:8}}><Play size={16}/> Play Playlist</span>');

fs.writeFileSync('src/SlowedReverbTool.jsx', content, 'utf8');
console.log('Replaced symbols');
