import { useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { KeyOutlined, PlusOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api/client';

const { Text } = Typography;

export default function AdminUsers() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/users');
      setList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setRole = async (id: string, role: string) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      message.success('角色已更新');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const createUser = async () => {
    const v = await createForm.validateFields();
    setSubmitting(true);
    try {
      await api.post('/org/user', v);
      message.success('账号已创建');
      setCreateOpen(false);
      createForm.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    const v = await pwdForm.validateFields();
    setSubmitting(true);
    try {
      await api.patch(`/org/user/${pwdTarget.id}`, { password: v.password });
      message.success(`已重置 ${pwdTarget.name} 的密码`);
      setPwdTarget(null);
      pwdForm.resetFields();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (r: any) => {
    const next = r.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await api.patch(`/org/user/${r.id}`, { status: next });
      message.success(next === 'ACTIVE' ? '已启用' : '已停用');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <div className="page">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 18,
        }}
      >
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            人员与角色
          </h2>
          <div className="muted">账号在这里开通；编制归属在「编制管理」中通过任职维护</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新增账号
        </Button>
      </div>

      <Card bodyStyle={{ padding: 8 }}>
        <Table
          loading={loading}
          rowKey="id"
          dataSource={list}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          scroll={{ x: 960 }}
          columns={[
            {
              title: '姓名',
              dataIndex: 'name',
              width: 110,
              render: (n: string, r: any) => (
                <Space size={6}>
                  <span>{n}</span>
                  {r.role === 'ADMIN' && (
                    <Tag color="blue" bordered={false} style={{ fontSize: 11 }}>
                      管理员
                    </Tag>
                  )}
                </Space>
              ),
            },
            { title: '账号', dataIndex: 'account', width: 110 },
            {
              title: '任职',
              dataIndex: 'posts',
              render: (posts: string[]) =>
                posts?.length ? (
                  <Space size={4} wrap>
                    {posts.map((p, i) => (
                      <Tag key={i} bordered={false}>
                        {p}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">未任职</Text>
                ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 90,
              render: (s: string) =>
                s === 'ACTIVE' ? (
                  <Tag color="green" bordered={false}>
                    正常
                  </Tag>
                ) : (
                  <Tag bordered={false}>停用</Tag>
                ),
            },
            {
              title: '角色',
              width: 130,
              render: (_: any, r: any) => (
                <Select
                  size="small"
                  value={r.role}
                  style={{ width: 104 }}
                  onChange={(v) => setRole(r.id, v)}
                  options={[
                    { label: '普通用户', value: 'USER' },
                    { label: '管理员', value: 'ADMIN' },
                  ]}
                />
              ),
            },
            {
              title: '操作',
              width: 180,
              render: (_: any, r: any) => (
                <Space size={2}>
                  <Button size="small" type="link" icon={<KeyOutlined />} onClick={() => setPwdTarget(r)}>
                    重置密码
                  </Button>
                  <Popconfirm
                    title={r.status === 'ACTIVE' ? '停用后该账号无法登录，确认？' : '恢复该账号登录？'}
                    onConfirm={() => toggleStatus(r)}
                  >
                    <Button
                      size="small"
                      type="link"
                      danger={r.status === 'ACTIVE'}
                      icon={r.status === 'ACTIVE' ? <StopOutlined /> : <CheckCircleOutlined />}
                    />
                  </Popconfirm>
                </Space>
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 110,
              render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
            },
          ]}
        />
      </Card>

      <Modal
        title="新增账号"
        open={createOpen}
        onOk={createUser}
        confirmLoading={submitting}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="account"
            label="登录账号"
            rules={[
              { required: true, message: '请输入账号' },
              { pattern: /^[a-zA-Z0-9_.-]{3,24}$/, message: '3-24 位字母、数字、下划线、点或短横线' },
            ]}
            extra="创建后不可修改，用于登录"
          >
            <Input placeholder="如 zhangsan" autoComplete="off" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="初始密码"
            rules={[{ min: 6, message: '至少 6 位' }]}
            extra="留空则默认为 123456，建议首次登录后修改"
          >
            <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="USER">
            <Select
              options={[
                { label: '普通用户', value: 'USER' },
                { label: '管理员（可进后台）', value: 'ADMIN' },
              ]}
            />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="title" label="职务">
            <Input placeholder="选填，如 科员" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码 · ${pwdTarget?.name || ''}`}
        open={!!pwdTarget}
        onOk={resetPassword}
        confirmLoading={submitting}
        onCancel={() => setPwdTarget(null)}
        okText="重置"
        destroyOnClose
      >
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '至少 6 位' },
            ]}
          >
            <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
          </Form.Item>
          <div className="muted">重置后请通知本人，旧密码立即失效。</div>
        </Form>
      </Modal>
    </div>
  );
}
