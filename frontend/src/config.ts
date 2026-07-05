/** Cyberpunk neon theme constants matching UI mockups */
export const Theme = {
  bg: 0x0a0a0f,
  bgPanel: 0x12121a,
  bgCell: 0x1a1a28,
  bgCellHover: 0x222235,

  cyan: 0x00e5ff,
  cyanGlow: 0x00a8cc,
  green: 0x00ff88,
  greenActive: 0x2ecc71,
  orange: 0xffaa00,
  purple: 0xb44aff,
  red: 0xff4466,
  white: 0xffffff,
  gray: 0x888899,
  grayDark: 0x444455,
  grayLight: 0xccccdd,

  playerColors: ['#00f0ff', '#ffaa00', '#00ff88', '#b44aff'] as const,

  fontFamily: '"Segoe UI", system-ui, sans-serif',
  fontTitle: '28px',
  fontSubtitle: '14px',
  fontBody: '16px',
  fontSmall: '12px',
  fontScore: '32px',

  borderRadius: 12,
  glowAlpha: 0.6,
} as const;

export const GameConfig = {
  width: 430,
  height: 780,
  defaultGridSize: 6,
  turnTimerSeconds: 60,
} as const;

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7071/telegram-bot-buddy';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
export const LOGGER_URL = import.meta.env.VITE_LOGGER_URL || 'http://localhost:7071/telegram-bot-buddy/logs/print';
