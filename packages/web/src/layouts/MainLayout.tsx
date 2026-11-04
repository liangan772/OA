import { useEffect, useState } from 'react';
import { Avatar, Drawer, Dropdown, Layout, Menu } from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  MailOutlined,
  FormOutlined,
  DeploymentUnitOutlined,
  PlusCircleOutlined,
  LogoutOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useTheme } from '../store/theme';
import { useIsMobile } from '../hooks/useMediaQuery';
import api from '../api/client';

const { Header, Sider, Content } = Layout;

const buildItems = (todoCount: number) => [
  {
    key: '/',
    icon: <AppstoreOutlined />,
    label: (
      <span style={{ display: 'flex', alignItems: 'center' }}>
        工作台
        {todoCount > 0 && <span className="menu-badge">{todoCount > 99 ? '99+' : todoCount}</span>}
      </span>
    ),
  },
  { key: '/flow/start', icon: <PlusCircleOutlined />, label: '发起流程' },
  { key: '/flow/mine', icon: <DeploymentUnitOutlined />, label: '我发起的' },
  {
    key: 'biz',
    label: '业务应用',
    type: 'group' as const,
    children: [
      { key: '/doc', icon: <FileTextOutlined />, label: '协调文档' },
      { key: '/mail', icon: <MailOutlined />, label: '邮件管理' },
      { key: '/collect', icon: <FormOutlined />, label: '收集表' },
    ],
  },
];

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: compact ? 0 : '20px 22px 6px',
      }}
    >
      <img src="/logo.png" alt="CROA" className="brand-logo" style={{ width: 32, height: 32 }} />
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.04em', lineHeight: 1.3 }}>CROA</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 0 }}>协同办公系统</div>
      </div>
    </div>
  );
}

function SideFoot() {
  return (
    <div style={{ padding: '14px 22px 18px' }}>
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: 12,
          fontSize: 11,
          color: 'var(--text-3)',
          letterSpacing: 0,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>v0.1.0</span>
        <span>CROA</span>
      </div>
    </div>
  );
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { resolved, setMode } = useTheme();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [todoCount, setTodoCount] = useState(0);

  const selected = location.pathname.startsWith('/flow/instance') ? '/flow/mine' : location.pathname;

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    api
      .get('/flow/todo')
      .then((r) => setTodoCount(r.data.length))
      .catch(() => setTodoCount(0));
  }, [location.pathname]);

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selected]}
      items={buildItems(todoCount)}
      onClick={(e) => navigate(e.key)}
      style={{ borderInlineEnd: 'none', paddingTop: 4 }}
    />
  );

  const userMenu = {
    items: [
      {
        key: 'profile-card',
        label: (
          <div style={{ padding: '2px 0' }}>
            <div style={{ fontWeight: 500 }}>{user?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user?.account}</div>
          </div>
        ),
        disabled: true,
      },
      { type: 'divider' as const },
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: '个人资料',
        onClick: () => navigate('/profile'),
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: () => {
          logout();
          navigate('/login');
        },
      },
    ],
  };

  return (
    <Layout style={{ height: '100%' }}>
      {!isMobile && (
        <Sider
          width={248}
          theme="light"
          style={{
            background: 'transparent',
            borderRight: 'none',
            paddingTop: 4,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Brand />
          <div style={{ flex: 1 }}>{menu}</div>
          <SideFoot />
        </Sider>
      )}

      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          width={260}
          closable={false}
          styles={{
            body: { padding: '20px 0 12px', display: 'flex', flexDirection: 'column' },
            header: { display: 'none' },
          }}
        >
          <div style={{ padding: '0 22px 12px' }}>
            <Brand compact />
          </div>
          <div style={{ flex: 1 }}>{menu}</div>
          <SideFoot />
        </Drawer>
      )}

      <div className="content-shell">
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
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.primaryOrgName || '未分配部门'}
                </span>
                {user?.isLeader && !isMobile && (
                  <>
                    <span style={{ color: 'var(--border-strong)' }}>·</span>
                    <span style={{ color: 'var(--danger)', fontSize: 12.5 }}>负责人 · 一票否决</span>
                  </>
                )}
              </div>
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

              <Dropdown trigger={['click']} menu={userMenu}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    cursor: 'pointer',
                    padding: '4px 8px 4px 4px',
                    borderRadius: 980,
                    transition: 'background .2s var(--ease)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(128,128,128,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar
                    size={30}
                    style={{ background: 'var(--accent)', fontSize: 13, fontWeight: 500, flex: 'none' }}
                  >
                    {user?.name?.slice(0, 1)}
                  </Avatar>
                  {!isMobile && (
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        maxWidth: 96,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {user?.name}
                    </span>
                  )}
                </div>
              </Dropdown>
            </div>
          </div>
        </Header>

        <Content style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Outlet />
        </Content>
      </div>
    </Layout>
  );
}
