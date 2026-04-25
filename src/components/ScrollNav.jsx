import { useState, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

/**
 * Floating scroll-to-top / scroll-to-bottom buttons.
 * Space-themed, positioned bottom-right, avoids clashing with FilterDrawer.
 */
export default function ScrollNav() {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  const checkScroll = useCallback(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const el = main.querySelector('div[style*="overflow"]') || main;
    const scrollable = el.scrollHeight > el.clientHeight + 20;
    if (!scrollable) { setShowTop(false); setShowBottom(false); return; }
    setShowTop(el.scrollTop > 200);
    setShowBottom(el.scrollTop < el.scrollHeight - el.clientHeight - 200);
  }, []);

  useEffect(() => {
    const interval = setInterval(checkScroll, 500);
    return () => clearInterval(interval);
  }, [checkScroll]);

  const scrollTo = (dir) => {
    const main = document.querySelector('main');
    if (!main) return;
    const el = main.querySelector('div[style*="overflow"]') || main;
    el.scrollTo({ top: dir === 'top' ? 0 : el.scrollHeight, behavior: 'smooth' });
  };

  const btnStyle = {
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s',
  };

  if (!showTop && !showBottom) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 40, zIndex: 42,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {showTop && (
        <button style={btnStyle} onClick={() => scrollTo('top')}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          title="Scroll to top"
        ><ArrowUp size={14} /></button>
      )}
      {showBottom && (
        <button style={btnStyle} onClick={() => scrollTo('bottom')}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
          title="Scroll to bottom"
        ><ArrowDown size={14} /></button>
      )}
    </div>
  );
}
