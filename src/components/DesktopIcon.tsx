'use client';

interface DesktopIconProps {
  icon: string;
  label: string;
  onClick: () => void;
}

export default function DesktopIcon({ icon, label, onClick }: DesktopIconProps) {
  return (
    <button
      className="desktop-icon"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '8px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        width: '80px',
        color: '#ffffff',
        textShadow: '1px 1px 2px #000000',
      }}
      onDoubleClick={onClick}
    >
      <div
        style={{
          fontSize: '48px',
          lineHeight: 1,
          filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.5))',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: '11px',
          textAlign: 'center',
          fontFamily: 'W95FA, MS Sans Serif, sans-serif',
          WebkitFontSmoothing: 'none',
          MozOsxFontSmoothing: 'grayscale',
          wordWrap: 'break-word',
        }}
      >
        {label}
      </div>
    </button>
  );
}
