import { useCallback, useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { FormOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { errMsg } from '../api/client';
import { renderFieldInput } from '../components/DynamicForm';

const { Text } = Typography;

export default function Collects() {
  const [list, setList] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [filling, setFilling] = useState<any>(null);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = useCallback(async () => {
    const { data } = await api.get('/biz/collects');
    setList(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    const { data } = await api.get(`/biz/collects/${id}`);
    setDetail(data);
  };

  const submit = async () => {
    const values = await form.validateFields();
    try {
      await api.post(`/biz/collects/${filling.id}/response`, { data: values });
      message.success('已提交');
      setFilling(null);
      form.resetFields();
      load();
      if (detail?.id === filling.id) openDetail(filling.id);
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const fields = detail?.schema?.fields || [];

  return (
    <div className="page">
      <h2 className="page-title">收集表</h2>

      <Card bodyStyle={{ padding: 8 }}>
        <List
          dataSource={list}
          locale={{ emptyText: '暂无收集表' }}
          renderItem={(f) => (
            <List.Item
              style={{ padding: '16px 12px' }}
              actions={[
                <Button size="small" onClick={() => openDetail(f.id)}>
                  查看汇总
                </Button>,
                f.status === 'PUBLISHED' ? (
                  <Button size="small" type="primary" icon={<FormOutlined />} onClick={() => setFilling(f)}>
                    {f.responded ? '修改填报' : '去填报'}
                  </Button>
                ) : (
                  <Tag>已关闭</Tag>
                ),
              ]}
            >
              <List.Item.Meta
                title={
                  <Space size={8}>
                    <span style={{ fontWeight: 500 }}>{f.title}</span>
                    {f.responded && <Tag color="green">已填报</Tag>}
                    {f.status === 'CLOSED' && <Tag>已关闭</Tag>}
                  </Space>
                }
                description={
                  <Space size={16} style={{ fontSize: 12 }}>
                    <span>{f.description}</span>
                    <span>已收 {f.total} 份</span>
                    {f.deadline && <span>截止 {dayjs(f.deadline).format('YYYY-MM-DD')}</span>}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      <Modal
        title={filling?.title}
        open={!!filling}
        onOk={submit}
        onCancel={() => setFilling(null)}
        okText="提交"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {(filling?.schema?.fields || []).map((f: any) => (
            <Form.Item
              key={f.key}
              name={f.key}
              label={f.label}
              rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : []}
            >
              {renderFieldInput(f)}
            </Form.Item>
          ))}
        </Form>
      </Modal>

      <Drawer open={!!detail} onClose={() => setDetail(null)} width={760} title={detail?.title}>
        {detail && (
          <>
            <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="回收份数">{detail.responses.length}</Descriptions.Item>
              <Descriptions.Item label="截止时间">
                {detail.deadline ? dayjs(detail.deadline).format('YYYY-MM-DD') : '不限'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {detail.status === 'PUBLISHED' ? <Tag color="green">进行中</Tag> : <Tag>已关闭</Tag>}
              </Descriptions.Item>
            </Descriptions>

            {detail.mine && (
              <Card size="small" title="我的填报" style={{ marginBottom: 16 }}>
                {fields.map((f: any) => (
                  <div key={f.key} style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {f.label}
                    </Text>
                    <div>{String(detail.mine.data?.[f.key] ?? '—')}</div>
                  </div>
                ))}
              </Card>
            )}

            <Table
              size="small"
              rowKey="id"
              scroll={{ x: 600 }}
              pagination={{ pageSize: 10 }}
              dataSource={detail.responses}
              columns={[
                { title: '填报人', dataIndex: 'userName', width: 100 },
                ...fields.map((f: any) => ({
                  title: f.label,
                  dataIndex: ['data', f.key],
                  render: (v: any) => (v === undefined || v === null || v === '' ? '—' : String(v)),
                })),
                {
                  title: '提交时间',
                  dataIndex: 'submittedAt',
                  width: 150,
                  render: (v: string) => dayjs(v).format('MM-DD HH:mm'),
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
