// src/theme/index.js
// Complete theme system for AI Chat — dark & light variants

export const colors = {
  // Primary palette
  primary: '#7C3AED',
  primaryLight: '#9D5FF5',
  primaryDark: '#5B21B6',
  secondary: '#DB2777',
  secondaryLight: '#EC4899',
  secondaryDark: '#BE185D',

  // Gradient stops
  gradientStart: '#7C3AED',
  gradientEnd: '#DB2777',
  gradientMid: '#A855F7',

  // Dark theme surfaces
  dark: {
    background: '#0F0F1A',
    surface: '#1A1A2E',
    surfaceElevated: '#1E1E2E',
    surfaceHigh: '#252540',
    border: '#2A2A45',
    borderLight: '#333360',
  },

  // Light theme surfaces
  light: {
    background: '#F8F9FF',
    surface: '#FFFFFF',
    surfaceElevated: '#F0F0FF',
    surfaceHigh: '#E8E8F8',
    border: '#E0E0F0',
    borderLight: '#D0D0E8',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#A0A0C0',
    tertiary: '#606080',
    inverse: '#0F0F1A',
    placeholder: '#505070',
    hint: '#404060',
  },

  textLight: {
    primary: '#0F0F1A',
    secondary: '#404060',
    tertiary: '#707090',
    inverse: '#FFFFFF',
    placeholder: '#A0A0C0',
    hint: '#C0C0D8',
  },

  // Semantic
  success: '#22C55E',
  successLight: '#4ADE80',
  warning: '#F59E0B',
  warningLight: '#FCD34D',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',

  // Chat specific
  sentBubble: '#7C3AED',
  receivedBubble: '#1E1E2E',
  sentBubbleLight: '#7C3AED',
  receivedBubbleLight: '#E8E8F8',

  // Online status
  online: '#22C55E',
  offline: '#6B7280',

  // Unread badge
  badge: '#DB2777',

  // Read receipts
  sent: '#A0A0C0',
  delivered: '#A0A0C0',
  read: '#60A5FA',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',

  // Transparent shades
  primaryAlpha10: 'rgba(124, 58, 237, 0.10)',
  primaryAlpha20: 'rgba(124, 58, 237, 0.20)',
  primaryAlpha30: 'rgba(124, 58, 237, 0.30)',
  secondaryAlpha10: 'rgba(219, 39, 119, 0.10)',
  whiteAlpha10: 'rgba(255, 255, 255, 0.10)',
  whiteAlpha05: 'rgba(255, 255, 255, 0.05)',
  blackAlpha10: 'rgba(0, 0, 0, 0.10)',

  // Blocked message
  blocked: '#2A1A1A',
  blockedBorder: '#5A2020',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
};

export const typography = {
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    xxxl: 34,
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
};

export const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 999,
};

export const shadows = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 10,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 16,
  },
  primary: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
};

export const darkTheme = {
  dark: true,
  colors: {
    background: colors.dark.background,
    surface: colors.dark.surface,
    surfaceElevated: colors.dark.surfaceElevated,
    surfaceHigh: colors.dark.surfaceHigh,
    border: colors.dark.border,
    borderLight: colors.dark.borderLight,
    text: colors.text.primary,
    textSecondary: colors.text.secondary,
    textTertiary: colors.text.tertiary,
    textPlaceholder: colors.text.placeholder,
    primary: colors.primary,
    primaryLight: colors.primaryLight,
    secondary: colors.secondary,
    gradientStart: colors.gradientStart,
    gradientEnd: colors.gradientEnd,
    gradientMid: colors.gradientMid,
    sentBubble: colors.sentBubble,
    receivedBubble: colors.receivedBubble,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    online: colors.online,
    offline: colors.offline,
    badge: colors.badge,
    overlay: colors.overlay,
    card: colors.dark.surfaceElevated,
    inputBackground: colors.dark.surfaceElevated,
    chipBackground: colors.dark.surfaceElevated,
    chipBorder: colors.primaryAlpha20,
    blocked: colors.blocked,
    blockedBorder: colors.blockedBorder,
    headerBackground: colors.dark.surface,
    tabBarBackground: colors.dark.surface,
    statusBar: 'light',
  },
  spacing,
  typography,
  borderRadius,
  shadows,
};

export const lightTheme = {
  dark: false,
  colors: {
    background: colors.light.background,
    surface: colors.light.surface,
    surfaceElevated: colors.light.surfaceElevated,
    surfaceHigh: colors.light.surfaceHigh,
    border: colors.light.border,
    borderLight: colors.light.borderLight,
    text: colors.textLight.primary,
    textSecondary: colors.textLight.secondary,
    textTertiary: colors.textLight.tertiary,
    textPlaceholder: colors.textLight.placeholder,
    primary: colors.primary,
    primaryLight: colors.primaryLight,
    secondary: colors.secondary,
    gradientStart: colors.gradientStart,
    gradientEnd: colors.gradientEnd,
    gradientMid: colors.gradientMid,
    sentBubble: colors.sentBubbleLight,
    receivedBubble: colors.receivedBubbleLight,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    online: colors.online,
    offline: colors.offline,
    badge: colors.badge,
    overlay: colors.overlay,
    card: colors.light.surface,
    inputBackground: colors.light.surfaceElevated,
    chipBackground: colors.light.surfaceElevated,
    chipBorder: colors.primaryAlpha20,
    blocked: '#FFE8E8',
    blockedBorder: '#FFAAAA',
    headerBackground: colors.light.surface,
    tabBarBackground: colors.light.surface,
    statusBar: 'dark',
  },
  spacing,
  typography,
  borderRadius,
  shadows,
};

export default darkTheme;
