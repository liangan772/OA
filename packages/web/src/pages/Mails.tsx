import { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  Badge,
} from 'antd';
import { EditOutlined, MailOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { errMsg } from '../api/client';

const { Text } = Typography;

export default function Mails() {
  const [box, setBox] = useState('inbox');
  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<any>(null);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = useCallback(async () => {
    const [i, s, u] = await Promise.all([
      api.get('/biz/mails?box=inbox'),
      api.get('/biz/mails?box=sent'),
      api.get('/biz/users'),
    ]);
    setInbox(i.data);
    setSent(s.data);
    setUsers(u.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const v = await form.validateFields();
    try {
      await api.post('/biz/mails', v);
      message.success('已发送');
      setOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const openMail = async (m: any) => {
    setCurrent(m);
    if (!m.read) {
      await api.post(`/biz/mails/${m.mailId}/read`);
      load();
    }
  };

  const unread = inbox.filter((m) => !m.read).length;

  return (
    <div className="page">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          邮件管理
        </h2>
        <Button type="primary" icon={<EditOutlined />} onClick={() => setOpen(true)}>
          写邮件
        </Button>
      </Space>

      <Card bodyStyle={{ padding: '4px 20px 12px' }}>
        <Tabs
          activeKey={box}
          onChange={setBox}
          items={[
            {
              key: 'inbox',
              label: (
                <Space size={6}>
                  收件箱
                  {unread > 0 && <Badge count={unread} size="small" />}
                </Space>
              ),
              children: (
                <List
                  dataSource={inbox}
                  renderItem={(m) => (
                    <List.Item
                      style={{ cursor: 'pointer', padding: '12px 0' }}
                      onClick={() => openMail(m)}
                      extra={<Text type="secondary" style={{ fontSize: 12 }}>{dayjs(m.createdAt).format('MM-DD HH:mm')}</Text>}
                    >
                      <List.Item.Meta
                        avatar={<MailOutlined style={{ color: m.read ? '#c9ced6' : '#185fa5', fontSize: 16 }} />}
                        title={
                          <Space size={8}>
                            <span style={{ fontWeight: m.read ? 400 : 500 }}>{m.subject}</span>
                            {!m.read && <Tag color="red">未读</Tag>}
                            {m.type === 'CC' && <Tag>抄送</Tag>}
                          </Space>
                        }
                        description={<span style={{ fontSize: 12 }}>{m.senderName} · {m.body?.slice(0, 60)}</span>}
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'sent',
              label: '已发送',
              children: (
                <List
                  dataSource={sent}
                  renderItem={(m) => (
                    <List.Item
                      style={{ cursor: 'pointer', padding: '12px 0' }}
                      onClick={() => setCurrent(m)}
                      extra={<Text type="secondary" style={{ fontSize: 12 }}>{dayjs(m.createdAt).format('MM-DD HH:mm')}</Text>}
                    >
                      <List.Item.Meta
                        title={m.subject}
                        description={
                          <Space size={6} style={{ fontSize: 12 }}>
                            <span>收件人：{m.recipients.map((r: any) => r.name).join('、')}</span>
                            {m.recipients.map((r: any, i: number) => (
                              <Tag key={i} color={r.read ? 'green' : 'default'}>
                                {r.read ? '已读' : '未读'}
                              </Tag>
                            ))}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal title="写邮件" open={open} onOk={send} onCancel={() => setOpen(false)} okText="发送" destroyOnClose width={620}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="to" label="收件人" rules={[{ required: true, message: '请选择收件人' }]}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="选择收件人"
              options={users.map((u) => ({ label: `${u.name}（${u.account}）`, value: u.id }))}
            />
          </Form.Item>
          <Form.Item name="cc" label="抄送">
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              placeholder="可选"
              options={users.map((u) => ({ label: `${u.name}（${u.account}）`, value: u.id }))}
            />
          </Form.Item>
          <Form.Item name="subject" label="主题" rules={[{ required: true, message: '请输入主题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="body" label="正文">
            <Input.TextArea rows={8} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer open={!!current} onClose={() => setCurrent(null)} width={560} title={current?.subject}>
        {current && (
          <>
            <div className="muted" style={{ marginBottom: 14 }}>
              {current.senderName ? `${current.senderName} · ` : ''}
              {dayjs(current.createdAt).format('YYYY-MM-DD HH:mm')}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9 }}>{current.body}</div>
          </>
        )}
      </Drawer>
    </div>
  );
}
