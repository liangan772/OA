import { Avatar, Dropdown, Layout, Menu } from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  MailOutlined,
  FormOutlined,
  ApartmentOutlined,
  DeploymentUnitOutlined,
  PlusCircleOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

const { Header, Sider, Content } = Layout;

const items = [
  { key: '/', icon: <AppstoreOutlined />, label: '工作台' },
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
  {
    key: 'setting',
    label: '组织与配置',
    type: 'group' as const,
    children: [
      { key: '/org', icon: <ApartmentOutlined />, label: '编制管理' },
      { key: '/design', icon: <SettingOutlined />, label: '流程设计' },
    ],
  },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const selected = location.pathname.startsWith('/flow/instance') ? '/flow/mine' : location.pathname;

  return (
    <Layout style={{ height: '100%' }}>
      <Sider
        width={248}
        theme="light"
        style={{ background: 'transparent', borderRight: 'none', paddingTop: 4 }}
      >
        <div style={{ padding: '20px 22px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div className="brand-mark">C</div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  lineHeight: 1.3,
                }}
              >
                CROA
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 0 }}>协同办公系统</div>
            </div>
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={items}
          onClick={(e) => navigate(e.key)}
          style={{ borderInlineEnd: 'none', paddingTop: 4 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: 0,
          }}
        >
          <div
            style={{
              maxWidth: 1440,
              width: '100%',
              margin: '0 auto',
              padding: '0 36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{user?.primaryOrgName || '未分配部门'}</span>
              {user?.isLeader && (
                <>
                  <span style={{ color: 'var(--border-strong)' }}>·</span>
                  <span style={{ color: 'var(--danger)', fontSize: 12.5 }}>负责人 · 一票否决</span>
                </>
              )}
            </div>

            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'profile',
                    label: (
                      <div style={{ padding: '2px 0' }}>
                        <div style={{ fontWeight: 500 }}>{user?.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{user?.account}</div>
                      </div>
                    ),
                    disabled: true,
                  },
                  { type: 'divider' },
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
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  cursor: 'pointer',
                  padding: '5px 12px 5px 6px',
                  borderRadius: 980,
                  transition: 'background .2s var(--ease)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(128,128,128,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar size={30} style={{ background: 'var(--accent)', fontSize: 13, fontWeight: 500, flex: 'none' }}>
                  {user?.name?.slice(0, 1)}
                </Avatar>
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
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{ overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
