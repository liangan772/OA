import { useState } from 'react';
import { Button, Form, Input, App as AntApp } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { errMsg } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: { account: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.account, values.password);
      navigate('/', { replace: true });
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark">协</div>
          <div>
            <div className="brand-text">协同办公系统</div>
            <div className="muted">节点化流程 · 统一编制</div>
          </div>
        </div>

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ account: 'admin', password: '123456' }}>
          <Form.Item name="account" rules={[{ required: true, message: '请输入账号' }]}>
            <Input size="large" prefix={<UserOutlined style={{ color: '#b0b7c0' }} />} placeholder="账号" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" prefix={<LockOutlined style={{ color: '#b0b7c0' }} />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block loading={loading} style={{ marginTop: 4 }}>
            登 录
          </Button>
        </Form>

        <div style={{ marginTop: 18, fontSize: 12, color: '#98a0a9', lineHeight: 1.9 }}>
          演示账号：admin / zhang / li / chen / sun / qian / wang / zhao
          <br />
          统一密码 123456
        </div>
      </div>
    </div>
  );
}
