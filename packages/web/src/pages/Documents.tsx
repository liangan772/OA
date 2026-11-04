import { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Drawer,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  List,
} from 'antd';
import { FileTextOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { errMsg } from '../api/client';

const { Text } = Typography;

export default function Documents() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/biz/docs');
      setList(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDoc = async (id: string) => {
    const { data } = await api.get(`/biz/docs/${id}`);
    setDetail(data);
    setTitle(data.title);
    setContent(data.content || '');
  };

  const create = async () => {
    const v = await form.validateFields();
    try {
      await api.post('/biz/docs', v);
      message.success('已创建');
      setCreateOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/biz/docs/${detail.id}`, { title, content });
      message.success('已保存并生成新版本');
      await openDoc(detail.id);
      load();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="page-title" style={{ margin: 0 }}>
          协调文档
        </h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建文档
        </Button>
      </Space>

      <Card bodyStyle={{ padding: 8 }}>
        <Table
          loading={loading}
          rowKey="id"
          dataSource={list}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          onRow={(r) => ({ onClick: () => openDoc(r.id), style: { cursor: 'pointer' } })}
          columns={[
            {
              title: '标题',
              dataIndex: 'title',
              render: (t: string) => (
                <Space size={6}>
                  <FileTextOutlined style={{ color: 'var(--text-3)' }} />
                  {t}
                </Space>
              ),
            },
            { title: '所属部门', dataIndex: 'ownerOrgName', width: 160 },
            {
              title: '状态',
              dataIndex: 'status',
              width: 110,
              render: (s: string) => {
                const m: any = { DRAFT: '草稿', REVIEWING: '审签中', PUBLISHED: '已发布', ARCHIVED: '已归档' };
                const c: any = { DRAFT: 'default', REVIEWING: 'gold', PUBLISHED: 'green', ARCHIVED: 'default' };
                return <Tag color={c[s]}>{m[s] || s}</Tag>;
              },
            },
            {
              title: '更新时间',
              dataIndex: 'updatedAt',
              width: 160,
              render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
            },
          ]}
        />
      </Card>

      <Modal title="新建文档" open={createOpen} onOk={create} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="文档标题" />
          </Form.Item>
          <Form.Item name="content" label="正文">
            <Input.TextArea rows={8} placeholder="支持 Markdown 文本" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        width={720}
        title={
          <Space>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: 360 }}
              bordered={false}
            />
          </Space>
        }
        extra={
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>
            保存
          </Button>
        }
      >
        {detail && (
          <>
            <div className="muted" style={{ marginBottom: 10 }}>
              {detail.ownerOrgName} · 共 {detail.versions?.length || 0} 个版本
            </div>
            <Input.TextArea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoSize={{ minRows: 18, maxRows: 40 }}
              style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 13 }}
            />
            <div style={{ marginTop: 20 }}>
              <Text strong style={{ fontSize: 13 }}>
                版本历史
              </Text>
              <List
                size="small"
                style={{ marginTop: 8 }}
                dataSource={detail.versions || []}
                renderItem={(v: any) => (
                  <List.Item>
                    <Space>
                      <Tag>v{v.version}</Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(v.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {v.remark}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}
