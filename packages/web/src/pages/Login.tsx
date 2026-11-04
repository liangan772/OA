import { useState } from 'react';
import { Button, Form, Input, App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { errMsg } from '../api/client';

const DEMO = [
  { account: 'admin', label: '市局办公室' },
  { account: 'wang', label: '区局业务科' },
  { account: 'zhao', label: '区局科员' },
  { account: 'zhang', label: '市局监督处' },
];

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
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-text" style={{ letterSpacing: '0.04em' }}>
              CROA
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1, letterSpacing: 0 }}>
              协同办公系统
            </div>
          </div>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} initialValues={{ account: 'admin', password: '123456' }}>
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
            style={{ marginBottom: 22 }}
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

        <div style={{ marginTop: 30, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 10, letterSpacing: 0 }}>
            演示账号（密码均为 123456）
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {DEMO.map((d) => (
              <button
                key={d.account}
                type="button"
                onClick={() => {
                  form.setFieldsValue({ account: d.account, password: '123456' });
                  form.submit();
                }}
                style={{
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  fontSize: 11.5,
                  padding: '7px 0',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all .2s var(--ease)',
                  letterSpacing: 0,
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-soft)';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-2)';
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
