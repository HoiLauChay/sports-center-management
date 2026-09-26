import type { Role } from '@sports-center/shared';
import type { ThemeConfig } from 'antd';

export const BRAND = {
  primary: '#0f4d34',
  primaryDark: '#0b3b28',
  primarySoft: '#e3efe8',
  accent: '#c94a1e',
  accentLight: '#e07a4f',
  accentSoft: '#f9e6dd',
  lime: '#d6f24b',
  ink: '#14130f',
  ink2: '#3d3b35',
  paper: '#f2efe8',
  paper2: '#e9e5dc',
  surface: '#ffffff',
  muted: '#7a776f',
  muted2: '#9a968c',
  border: '#e2ddd2',
  borderSoft: '#ece8df',
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
} as const;

export const ROLE_COLOR: Record<Role, string> = {
  MANAGER: '#c94a1e',
  COACH: '#0f4d34',
  MEMBER: '#0891b2',
  RECEPTIONIST: '#d9a400',
};

export const ROLE_COLOR_ON_DARK: Record<Role, string> = {
  MANAGER: BRAND.accentLight,
  COACH: '#5cbf8a',
  MEMBER: '#38bdf8',
  RECEPTIONIST: '#eab308',
};

export const FONT_BODY =
  "'Barlow', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const FONT_DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    colorInfo: BRAND.primary,
    colorLink: BRAND.primary,
    colorSuccess: BRAND.success,
    colorWarning: BRAND.warning,
    colorError: BRAND.error,
    colorBgLayout: BRAND.paper,
    colorBgContainer: BRAND.surface,
    colorText: BRAND.ink,
    colorTextSecondary: BRAND.muted,
    colorTextTertiary: BRAND.muted2,
    colorTextPlaceholder: BRAND.muted2,
    colorBorder: BRAND.border,
    colorBorderSecondary: BRAND.borderSoft,
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: FONT_BODY,
    fontSize: 14,
    controlHeight: 38,
    boxShadow: '0 1px 2px rgba(20,19,15,.04), 0 4px 16px rgba(20,19,15,.06)',
    boxShadowSecondary: '0 6px 24px rgba(20,19,15,.10)',
  },
  components: {
    Button: { primaryShadow: 'none', fontWeight: 600 },
    Input: { activeShadow: '0 0 0 3px rgba(15,77,52,.12)' },
    Layout: {
      siderBg: BRAND.ink,
      headerBg: BRAND.surface,
      headerHeight: 64,
      headerPadding: '0 24px',
      bodyBg: BRAND.paper,
    },
    Menu: {
      darkItemBg: BRAND.ink,
      darkSubMenuItemBg: BRAND.ink,
      darkItemColor: 'rgba(242,239,232,.72)',
      darkItemHoverColor: BRAND.paper,
      darkItemHoverBg: 'rgba(242,239,232,.08)',
      darkItemSelectedBg: BRAND.lime,
      darkItemSelectedColor: BRAND.ink,
      darkGroupTitleColor: BRAND.muted2,
      itemBorderRadius: 8,
      itemHeight: 42,
      iconSize: 17,
    },
  },
};

export const authTheme: ThemeConfig = {
  ...antdTheme,
  token: {
    ...antdTheme.token,
    borderRadius: 6,
    borderRadiusLG: 8,
    controlHeight: 44,
    controlHeightSM: 24,
    fontSize: 15,
  },
  components: {
    ...antdTheme.components,
    Form: {
      labelFontSize: 14,
      labelHeight: 22,
      labelColor: BRAND.ink2,
      itemMarginBottom: 14,
      verticalLabelPadding: '0 0 6px',
    },
    Checkbox: { fontSize: 14 },
  },
};
