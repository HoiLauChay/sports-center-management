import type { ThemeConfig } from 'antd';

export const BRAND = {
  primary: '#0f4d34',
  primaryDark: '#0b3b28',
  primarySoft: '#e3efe8',
  accent: '#c94a1e',
  lime: '#d6f24b',
  ink: '#14130f',
  ink2: '#3d3b35',
  paper: '#f2efe8',
  surface: '#ffffff',
  muted: '#7a776f',
  border: '#e2ddd2',
  borderSoft: '#ece8df',
} as const;

export const FONT_BODY =
  "'Barlow', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
export const FONT_DISPLAY = "'Barlow Condensed', 'Arial Narrow', sans-serif";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    colorInfo: BRAND.primary,
    colorLink: BRAND.primary,
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorBgLayout: BRAND.paper,
    colorBgContainer: BRAND.surface,
    colorText: BRAND.ink,
    colorTextSecondary: BRAND.muted,
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
  },
};

export const authTheme: ThemeConfig = {
  ...antdTheme,
  token: {
    ...antdTheme.token,
    borderRadius: 6,
    borderRadiusLG: 8,
    controlHeight: 44,
    fontSize: 15,
  },
  components: {
    ...antdTheme.components,
    Form: { labelFontSize: 13.5, labelColor: BRAND.ink2, itemMarginBottom: 16, verticalLabelPadding: '0 0 6px' },
    Checkbox: { fontSize: 14 },
  },
};
