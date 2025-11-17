'use client';

export default function WUTTFlag() {
  return (
    <div
      style={{
        position: 'fixed',
        top: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <svg
        width="200"
        height="120"
        viewBox="0 0 200 120"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
        }}
      >
        {/* Flag Pole */}
        <rect
          x="10"
          y="0"
          width="4"
          height="120"
          fill="#333"
          stroke="#000"
          strokeWidth="1"
        />

        {/* Wavy Flag Shape - Hand-drawn style */}
        <path
          d="M 14 15 Q 50 10, 90 15 Q 130 20, 170 15 L 170 65 Q 130 70, 90 65 Q 50 60, 14 65 Z"
          fill="#9E1B32"
          stroke="#000"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* WUTT Text */}
        <text
          x="92"
          y="48"
          fontFamily="'W95FA', 'MS Sans Serif', 'Impact', sans-serif"
          fontSize="28"
          fontWeight="bold"
          fill="#FFFFFF"
          stroke="#000"
          strokeWidth="2"
          textAnchor="middle"
          paintOrder="stroke"
          style={{
            WebkitFontSmoothing: 'none',
            MozOsxFontSmoothing: 'grayscale',
          }}
        >
          WUTT
        </text>
      </svg>
    </div>
  );
}
