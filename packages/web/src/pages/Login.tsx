import { useState } from 'react';
import { Button, Form, Input, App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { errMsg } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const { message } = AntApp.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
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
          <img src="/logo.png" alt="CROA" className="brand-logo" style={{ width: 46, height: 46 }} />
          <div>
            <div className="brand-text" style={{ letterSpacing: '0.04em' }}>
              CROA
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1, letterSpacing: 0 }}>
              协同办公系统
            </div>
          </div>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="account"
            rules={[{ required: true, message: '请输入账号' }]}
            style={{ marginBottom: 14 }}
          >
            <Input size="large" placeholder="账号" variant="filled" autoComplete="username" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
            style={{ marginBottom: 26 }}
          >
            <Input.Password size="large" placeholder="密码" variant="filled" autoComplete="current-password" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            block
            loading={loading}
            style={{ height: 46, borderRadius: 980, fontSize: 15, fontWeight: 500 }}
          >
            登录
          </Button>
        </Form>
      </div>
    </div>
  );
}
