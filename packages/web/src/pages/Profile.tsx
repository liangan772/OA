import { useEffect, useState } from 'react';
import {
  App as AntApp,
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Space,
  Tag,
  Typography,
} from 'antd';
import { LockOutlined, SaveOutlined, UserOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api/client';
import { useAuth } from '../store/auth';

const { Text } = Typography;

export default function Profile() {
  const { user, refresh } = useAuth();
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const { message } = AntApp.useApp();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({ name: user.name, phone: user.phone, title: user.title });
    }
  }, [user, form]);

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api.patch('/auth/profile', v);
      await refresh();
      message.success('资料已更新');
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    const v = await pwdForm.validateFields();
    setChanging(true);
    try {
      await api.post('/auth/change-password', v);
      message.success('密码已修改');
      pwdForm.resetFields();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setChanging(false);
    }
  };

  if (!user) return null;

  const posts = (user as any).posts || [];

  return (
    <div className="page">
      <h2 className="page-title">个人资料</h2>

      <Card bodyStyle={{ padding: 24 }} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Avatar
            size={64}
            style={{ background: 'var(--accent)', fontSize: 26, fontWeight: 500, flex: 'none' }}
          >
            {user.name?.slice(0, 1)}
          </Avatar>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Space size={8} align="center">
              <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{user.name}</span>
              {user.role === 'ADMIN' && (
                <Tag color="blue" bordered={false}>
                  管理员
                </Tag>
              )}
            </Space>
            <div className="muted" style={{ marginTop: 4 }}>
              {user.account}
              {user.title ? ` · ${user.title}` : ''}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div className="form-field-label" style={{ marginBottom: 10 }}>
            我的编制
          </div>
          {posts.length === 0 && <Text type="secondary">尚未任职，请联系管理员在编制管理中安排</Text>}
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {posts.map((p: any) => (
              <div
                key={p.postId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: 'var(--surface-muted)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 13.5 }}>
                  {p.orgName} · {p.positionName}
                </span>
                {p.isPrimary && (
                  <Tag color="blue" bordered={false} style={{ marginInlineEnd: 0 }}>
                    主岗
                  </Tag>
                )}
                {p.isLeader && (
                  <Tag color="red" bordered={false} style={{ marginInlineEnd: 0 }}>
                    负责人
                  </Tag>
                )}
                {p.isDeputy && (
                  <Tag bordered={false} style={{ marginInlineEnd: 0 }}>
                    副职
                  </Tag>
                )}
              </div>
            ))}
          </Space>
        </div>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="基本资料">
            <Form form={form} layout="vertical">
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input prefix={<UserOutlined />} maxLength={32} placeholder="真实姓名" />
              </Form.Item>
              <Form.Item name="phone" label="手机号" rules={[{ pattern: /^[0-9+\-\s()]{5,20}$/, message: '格式不正确' }]}>
                <Input placeholder="选填" maxLength={20} />
              </Form.Item>
              <Form.Item name="title" label="职务">
                <Input placeholder="如：办公室主任" maxLength={32} />
              </Form.Item>
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
                保存
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="修改密码">
            <Form form={pwdForm} layout="vertical">
              <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="当前密码" />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入新密码' },
                  { min: 6, message: '至少 6 位' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="至少 6 位" />
              </Form.Item>
              <Button loading={changing} onClick={changePassword}>
                更新密码
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <div className="muted" style={{ marginTop: 16 }}>
        账号、角色与编制归属由管理员维护，如需调整请联系管理员。
      </div>
    </div>
  );
}
