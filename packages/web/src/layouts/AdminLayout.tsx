import { useEffect, useState } from 'react';
import { Avatar, Drawer, Dropdown, Layout, Menu, Tag } from 'antd';
import {
  DashboardOutlined,
  ApartmentOutlined,
  DeploymentUnitOutlined,
  FormOutlined,
  SwapOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuOutlined,
  ArrowLeftOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useTheme } from '../store/theme';
import { useIsMobile } from '../hooks/useMediaQuery';

const { Header, Sider, Content } = Layout;

const items = [
  { key: '/admin', icon: <DashboardOutlined />, label: '概览' },
  { key: '/admin/org', icon: <ApartmentOutlined />, label: '编制管理' },
  { key: '/admin/flow', icon: <DeploymentUnitOutlined />, label: '流程设计' },
  { key: '/admin/templates', icon: <FormOutlined />, label: '内容模板' },
  { key: '/admin/grants', icon: <SwapOutlined />, label: '跨单位授权' },
  { key: '/admin/users', icon: <TeamOutlined />, label: '人员与角色' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: '系统设置' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { resolved, setMode } = useTheme();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={(e) => navigate(e.key)}
      style={{ borderInlineEnd: 'none', paddingTop: 4 }}
    />
  );

  const brand = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img src="/logo.png" alt="CROA" className="brand-logo" style={{ width: 30, height: 30 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.3 }}>
          CROA
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 0 }}>管理后台</div>
      </div>
    </div>
  );

  return (
    <Layout style={{ height: '100%' }}>
      {!isMobile && (
        <Sider
          width={236}
          theme="light"
          style={{ background: 'transparent', borderRight: 'none', paddingTop: 4 }}
        >
          <div style={{ padding: '20px 22px 6px' }}>{brand}</div>
          {menu}
          <div style={{ padding: '18px 22px' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-3)',
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              <ArrowLeftOutlined style={{ fontSize: 11 }} /> 返回业务前台
            </button>
          </div>
        </Sider>
      )}

      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={260}
          closable={false}
          styles={{ body: { padding: '20px 0 12px' }, header: { display: 'none' } }}
        >
          <div style={{ padding: '0 22px 12px' }}>{brand}</div>
          {menu}
          <div style={{ padding: '18px 22px' }}>
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-3)',
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                fontFamily: 'inherit',
              }}
            >
              <ArrowLeftOutlined style={{ fontSize: 11 }} /> 返回业务前台
            </button>
          </div>
        </Drawer>
      )}

      <Layout>
        <Header style={{ display: 'flex', alignItems: 'center', padding: 0 }}>
          <div
            style={{
              maxWidth: 1440,
              width: '100%',
              margin: '0 auto',
              padding: isMobile ? '0 10px' : '0 36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="打开菜单"
                  style={{
                    width: 44,
                    height: 44,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-1)',
                    fontSize: 18,
                    cursor: 'pointer',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                  }}
                >
                  <MenuOutlined />
                </button>
              )}
              <Tag color="blue" bordered={false} style={{ marginInlineEnd: 0 }}>
                管理员
              </Tag>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <button
                type="button"
                aria-label="切换明暗"
                onClick={() => setMode(resolved === 'dark' ? 'light' : 'dark')}
                style={{
                  width: 44,
                  height: 44,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                }}
              >
                {resolved === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              </button>

              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'p',
                      disabled: true,
                      label: (
                        <div style={{ padding: '2px 0' }}>
                          <div style={{ fontWeight: 500 }}>{user?.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user?.account}</div>
                        </div>
                      ),
                    },
                    { type: 'divider' },
                    {
                      key: 'out',
                      icon: <LogoutOutlined />,
                      label: '退出登录',
                      onClick: () => {
                        logout();
                        navigate('/login');
                      },
                    },
                  ],
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px 4px 4px' }}>
                  <Avatar size={30} style={{ background: 'var(--accent)', fontSize: 13 }}>
                    {user?.name?.slice(0, 1)}
                  </Avatar>
                  {!isMobile && <span style={{ fontSize: 13.5 }}>{user?.name}</span>}
                </div>
              </Dropdown>
            </div>
          </div>
        </Header>

        <Content style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
