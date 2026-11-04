import { Spin } from 'antd';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import MainLayout from './layouts/MainLayout';
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

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route element={<MainLayout />}>
        <Route path="/" element={<Workbench />} />
        <Route path="/flow/start" element={<FlowStart />} />
        <Route path="/flow/instance/:id" element={<FlowDetail />} />
        <Route path="/flow/mine" element={<MyFlows />} />
        <Route path="/org" element={<OrgManage />} />
        <Route path="/design" element={<FlowDesigner />} />
        <Route path="/doc" element={<Documents />} />
        <Route path="/mail" element={<Mails />} />
        <Route path="/collect" element={<Collects />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
