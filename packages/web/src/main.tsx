import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './store/auth';
import { ThemeProvider, useTheme } from './store/theme';
import './styles.css';

dayjs.locale('zh-cn');

const FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', sans-serif";

function buildTheme(dark: boolean) {
  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: '#0071e3',
      colorInfo: '#0071e3',
      colorSuccess: '#1d9e75',
      colorWarning: '#b25000',
      colorError: '#d70015',
      colorTextBase: dark ? '#f5f5f7' : '#1d1d1f',
      borderRadius: 12,
      borderRadiusLG: 18,
      borderRadiusSM: 8,
      fontSize: 14,
      fontFamily: FONT,
      controlHeight: 38,
      wireframe: false,
      boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 4px 24px rgba(0,0,0,0.06)',
      boxShadowSecondary: dark
        ? '0 8px 32px rgba(0,0,0,0.5)'
        : '0 2px 8px rgba(0,0,0,0.05), 0 12px 40px rgba(0,0,0,0.07)',
    },
    components: {
      Layout: {
        headerBg: 'transparent',
        bodyBg: 'transparent',
        siderBg: 'transparent',
        headerPadding: '0 28px',
        headerHeight: 64,
      },
      Menu: {
        itemBorderRadius: 10,
        itemHeight: 40,
        itemMarginInline: 10,
        itemMarginBlock: 2,
        itemColor: dark ? '#a1a1a6' : '#6e6e73',
        itemHoverBg: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        itemSelectedBg: dark ? 'rgba(255,255,255,0.12)' : '#ffffff',
        itemSelectedColor: dark ? '#f5f5f7' : '#1d1d1f',
        subMenuItemBg: 'transparent',
        groupTitleFontSize: 11,
        activeBarWidth: 0,
      },
      Card: {
        borderRadiusLG: 18,
        paddingLG: 24,
        headerFontSize: 15,
        headerHeight: 52,
      },
      Button: {
        borderRadius: 10,
        controlHeight: 38,
        fontWeight: 500,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
      Table: {
        headerBg: 'transparent',
        headerSplitColor: 'transparent',
        rowHoverBg: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,113,227,0.035)',
        cellPaddingBlock: 13,
        headerColor: dark ? '#a1a1a6' : '#86868b',
        headerBorderRadius: 0,
      },
      Tabs: {
        inkBarColor: '#0071e3',
        itemColor: dark ? '#a1a1a6' : '#86868b',
        itemSelectedColor: dark ? '#f5f5f7' : '#1d1d1f',
        titleFontSize: 14,
        horizontalItemGutter: 28,
      },
      Input: { controlHeight: 40, borderRadius: 10, activeShadow: '0 0 0 4px rgba(0,113,227,0.12)' },
      InputNumber: { controlHeight: 40, borderRadius: 10 },
      Select: { controlHeight: 40, borderRadius: 10 },
      Modal: { borderRadiusLG: 20, paddingContentHorizontalLG: 24 },
      Tag: { borderRadiusSM: 6, defaultBg: dark ? 'rgba(255,255,255,0.08)' : '#f5f5f7' },
      Descriptions: { labelBg: 'transparent', titleMarginBottom: 12 },
      Tree: {
        nodeSelectedBg: dark ? 'rgba(0,113,227,0.24)' : 'rgba(0,113,227,0.1)',
        nodeHoverBg: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.035)',
        titleHeight: 34,
      },
      Drawer: { paddingLG: 28 },
      Form: { labelColor: dark ? '#a1a1a6' : '#6e6e73', verticalLabelPadding: '0 0 6px' },
      Alert: { borderRadiusLG: 14 },
      List: { itemPadding: '16px 0' },
    },
  } as const;
}

function ThemedProviders({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme();
  return (
    <ConfigProvider locale={zhCN} theme={buildTheme(resolved === 'dark')}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ThemedProviders>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemedProviders>
    </ThemeProvider>
  </React.StrictMode>,
);
