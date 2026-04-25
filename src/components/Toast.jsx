import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore } from '../stores/uiStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  const icons = {
    info: <Info size={15} />,
    success: <CheckCircle size={15} />,
    error: <AlertCircle size={15} />,
  };

  const colors = {
    info: { bg: 'var(--info-muted)', border: 'rgba(56,189,248,0.2)', color: 'var(--info)' },
    success: { bg: 'var(--success-muted)', border: 'rgba(52,211,153,0.2)', color: 'var(--success)' },
    error: { bg: 'var(--danger-muted)', border: 'rgba(248,113,113,0.2)', color: 'var(--danger)' },
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(var(--nowplaying-height) + 16px)',
      right: 16,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {toasts.map(toast => {
          const c = colors[toast.type] || colors.info;
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 400 }}
              style={{
                background: c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                pointerEvents: 'auto',
                maxWidth: 340,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}
            >
              <span style={{ color: c.color, flexShrink: 0 }}>{icons[toast.type]}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', flex: 1, lineHeight: 1.4 }}>
                {toast.message}
              </span>
              <button
                onClick={() => removeToast(toast.id)}
                style={{ flexShrink: 0, color: 'var(--text-dim)', padding: 2 }}
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
