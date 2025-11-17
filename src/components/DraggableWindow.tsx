'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

interface DraggableWindowProps {
  title: string;
  icon?: string;
  children: ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultSize?: { width: number; height: number };
  onClose?: () => void;
  menuItems?: Array<{ label: string; id?: string; href?: string; onClick?: (e: React.MouseEvent) => void }>;
  showFlag?: boolean;
}

export default function DraggableWindow({
  title,
  icon = '📬',
  children,
  defaultPosition = { x: 100, y: 50 },
  defaultSize = { width: 900, height: 700 },
  onClose,
  menuItems = [],
  showFlag = false,
}: DraggableWindowProps) {
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [restoreSize, setRestoreSize] = useState(defaultSize);
  const [restorePosition, setRestorePosition] = useState(defaultPosition);
  const windowRef = useRef<HTMLDivElement>(null);
  const titleBarRef = useRef<HTMLDivElement>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const [titleBarHeight, setTitleBarHeight] = useState(0);
  const [menuBarHeight, setMenuBarHeight] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking on title bar (not buttons)
    if ((e.target as HTMLElement).closest('.win98-title-bar-controls')) {
      return;
    }

    // Don't drag if maximized
    if (isMaximized) {
      return;
    }

    setIsDragging(true);
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleTitleBarDoubleClick = (e: React.MouseEvent) => {
    // Restore window if minimized (double-click restore behavior)
    if (isMinimized && (e.target as HTMLElement).closest('.win98-title-bar-text')) {
      setIsMinimized(false);
    }
  };

  const handleMaximize = () => {
    if (isMaximized) {
      // Restore to previous size and position
      setIsMaximized(false);
      setPosition(restorePosition);
    } else {
      // Save current size and position, then maximize
      const currentWidth = windowRef.current?.offsetWidth || restoreSize.width;
      const currentHeight = windowRef.current?.offsetHeight || restoreSize.height;
      setRestoreSize({ width: currentWidth, height: currentHeight });
      setRestorePosition({ x: position.x, y: position.y });
      setIsMaximized(true);
      setPosition({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && windowRef.current && !isMaximized) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Keep window within viewport bounds
        const currentWidth = windowRef.current.offsetWidth || restoreSize.width;
        const currentHeight = windowRef.current.offsetHeight || restoreSize.height;
        const maxX = window.innerWidth - currentWidth;
        const maxY = window.innerHeight - currentHeight;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, isMaximized, restoreSize]);

  // Handle window resize when maximized
  useEffect(() => {
    if (!isMaximized) return;

    const handleResize = () => {
      // Force re-render to update size
      setPosition((prev) => ({ ...prev }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMaximized]);

  // Measure title bar and menu bar heights
  useEffect(() => {
    const measureHeights = () => {
      if (titleBarRef.current) {
        setTitleBarHeight(titleBarRef.current.offsetHeight);
      }
      if (menuBarRef.current) {
        setMenuBarHeight(menuBarRef.current.offsetHeight);
      }
    };

    measureHeights();
    // Re-measure when window size changes or menu items change
    window.addEventListener('resize', measureHeights);
    return () => window.removeEventListener('resize', measureHeights);
  }, [menuItems.length]);

  // Calculate current size based on maximized state
  const currentSize = isMaximized
    ? { width: typeof window !== 'undefined' ? window.innerWidth : restoreSize.width, height: typeof window !== 'undefined' ? window.innerHeight : restoreSize.height }
    : restoreSize;

  // Calculate current height - if minimized, only show title bar
  const currentHeight = isMinimized ? 30 : currentSize.height;

  // Calculate maxHeight for window body based on actual element heights
  // Padding is 16px on all sides, so vertical padding = 16px (top) + 16px (bottom) = 32px
  const bodyPadding = 16;
  const verticalPadding = bodyPadding * 2; // top + bottom
  const hasMenuBar = !isMinimized && menuItems.length > 0;
  const maxBodyHeight = currentSize.height - titleBarHeight - (hasMenuBar ? menuBarHeight : 0) - verticalPadding;

  return (
    <div
      ref={windowRef}
      className="win98-window"
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${currentSize.width}px`,
        height: `${currentHeight}px`,
        cursor: isDragging ? 'grabbing' : 'default',
        zIndex: 1000,
      }}
    >
      {/* WUTT Flag - Attached to the window (boat) */}
      {showFlag && (
        <>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '-80px',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <svg width="120" height="90" viewBox="0 0 120 90">
              {/* Vertical Pole/Mast */}
              <rect
                x="8"
                y="0"
                width="4"
                height="90"
                fill="#333"
                stroke="#000"
                strokeWidth="1"
              />

              {/* Triangular Flag Pointing Left */}
              <path
                d="M 12 10 L 110 35 L 12 60 Z"
                fill="#9E1B32"
                stroke="#000"
                strokeWidth="2"
              />

              {/* WUTT Text on Flag */}
              <text
                x="50"
                y="40"
                fontFamily="'W95FA', 'MS Sans Serif', 'Impact', sans-serif"
                fontSize="18"
                fontWeight="bold"
                fill="#FFFFFF"
                stroke="#000"
                strokeWidth="1.5"
                textAnchor="middle"
                paintOrder="stroke"
              >
                WUTT
              </text>
            </svg>
          </div>

          {/* Simple Hand-Drawn Wave Lines at Bottom of Boat */}
          <div
            style={{
              position: 'absolute',
              left: '-50px',
              right: '-50px',
              bottom: '-15px',
              height: '30px',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            <svg width="100%" height="30" viewBox="0 0 1000 30" preserveAspectRatio="none">
              {/* Hand-drawn wavy line */}
              <path
                d="M 0,15 Q 50,8 100,15 T 200,15 T 300,15 T 400,15 T 500,15 T 600,15 T 700,15 T 800,15 T 900,15 T 1000,15"
                fill="none"
                stroke="#2b5266"
                strokeWidth="2"
                opacity="0.6"
              />
              <path
                d="M 0,20 Q 45,13 90,20 T 180,20 T 270,20 T 360,20 T 450,20 T 540,20 T 630,20 T 720,20 T 810,20 T 900,20 T 990,20"
                fill="none"
                stroke="#4a7b8f"
                strokeWidth="1.5"
                opacity="0.4"
              />
            </svg>
          </div>
        </>
      )}

      {/* Title Bar */}
      <div
        ref={titleBarRef}
        className="win98-title-bar"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleTitleBarDoubleClick}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="win98-title-bar-text">
          <span>{icon}</span>
          {title}
        </div>
        <div className="win98-title-bar-controls">
          <button
            className="win98-title-bar-button"
            aria-label="Minimize"
            onClick={handleMinimize}
          >
            _
          </button>
          <button
            className="win98-title-bar-button"
            aria-label={isMaximized ? 'Restore' : 'Maximize'}
            onClick={handleMaximize}
          >
            {isMaximized ? '❐' : '□'}
          </button>
          <button
            className="win98-title-bar-button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      {/* Menu Bar */}
      {!isMinimized && menuItems.length > 0 && (
        <div ref={menuBarRef} className="win98-menu-bar">
          {menuItems.map((item) => {
            const key = item.id || item.label;
            const hasOnClick = !!item.onClick;

            // If onClick is provided, prevent default navigation
            const handleClick = (e: React.MouseEvent) => {
              if (item.onClick) {
                e.preventDefault();
                item.onClick(e);
              }
            };

            // If onClick is provided but no href, use button for semantic correctness
            // Otherwise use anchor with safe fallback
            if (hasOnClick && !item.href) {
              return (
                <button
                  key={key}
                  onClick={handleClick}
                  className="win98-menu-item"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {item.label}
                </button>
              );
            }

            return (
              <a
                key={key}
                href={item.href || '#'}
                onClick={(e) => {
                  if (!item.href) {
                    e.preventDefault();
                  }
                  handleClick(e);
                }}
                className="win98-menu-item"
              >
                {item.label}
              </a>
            );
          })}
        </div>
      )}

      {/* Window Body */}
      {!isMinimized && (
        <div
          className="win98-window-body"
          style={{
            maxHeight: `${maxBodyHeight}px`,
            overflowY: 'auto',
            padding: '16px',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
