import { Avatar, Dropdown, Layout, Menu, Tag } from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  MailOutlined,
  FormOutlined,
  ApartmentOutlined,
  DeploymentUnitOutlined,
  PlusCircleOutlined,
  LogoutOutlined,
  UserOutlined,
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
      { key: '/design', icon: <DeploymentUnitOutlined />, label: '流程设计' },
    ],
  },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const selected = location.pathname.startsWith('/flow/instance')
    ? '/flow/mine'
    : location.pathname;

  return (
    <Layout style={{ height: '100%' }}>
      <Sider width={216} theme="light" style={{ borderRight: '1px solid #eceff3' }}>
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px',
            borderBottom: '1px solid #f2f4f7',
          }}
        >
          <div className="brand-mark" style={{ width: 28, height: 28, fontSize: 13 }}>
            协
          </div>
          <span style={{ fontWeight: 500, fontSize: 15 }}>协同办公</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selected]}
          items={items}
          onClick={(e) => navigate(e.key)}
          style={{ borderInlineEnd: 'none', paddingTop: 8 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            height: 56,
            lineHeight: '56px',
            background: '#fff',
            borderBottom: '1px solid #eceff3',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 13, color: '#8a9099' }}>
            {user?.primaryOrgName || '未分配部门'}
            {user?.isLeader && (
              <Tag color="red" style={{ marginLeft: 8 }}>
                负责人 · 一票否决权
              </Tag>
            )}
          </div>

          <Dropdown
            menu={{
              items: [
                { key: 'profile', icon: <UserOutlined />, label: `${user?.name}（${user?.account}）`, disabled: true },
                { type: 'divider' },
                { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); navigate('/login'); } },
              ],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar size={28} style={{ background: '#185fa5' }}>
                {user?.name?.slice(0, 1)}
              </Avatar>
              <span style={{ fontSize: 13 }}>{user?.name}</span>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
