import { Spin } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Workbench from './pages/Workbench';
import FlowStart from './pages/FlowStart';
import FlowDetail from './pages/FlowDetail';
import MyFlows from './pages/MyFlows';
import OrgManage from './pages/OrgManage';
import FlowDesigner from './pages/FlowDesigner';
import Documents from './pages/Documents';
import Mails from './pages/Mails';
import Collects from './pages/Collects';
import Profile from './pages/Profile';
import AdminOverview from './pages/admin/AdminOverview';
import AdminTemplates from './pages/admin/AdminTemplates';
import AdminGrants from './pages/admin/AdminGrants';
import AdminUsers from './pages/admin/AdminUsers';
import AdminSettings from './pages/admin/AdminSettings';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />

      {/* 业务前台：只放日常办理，配置类入口一律收进后台 */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Workbench />} />
        <Route path="/flow/start" element={<FlowStart />} />
        <Route path="/flow/instance/:id" element={<FlowDetail />} />
        <Route path="/flow/mine" element={<MyFlows />} />
        <Route path="/doc" element={<Documents />} />
        <Route path="/mail" element={<Mails />} />
        <Route path="/collect" element={<Collects />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* 后台：不出现在任何菜单，只能通过 /admin 直接进入 */}
      <Route path="/admin" element={isAdmin ? <AdminLayout /> : <Navigate to="/" replace />}>
        <Route index element={<AdminOverview />} />
        <Route path="org" element={<OrgManage />} />
        <Route path="flow" element={<FlowDesigner />} />
        <Route path="templates" element={<AdminTemplates />} />
        <Route path="grants" element={<AdminGrants />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
