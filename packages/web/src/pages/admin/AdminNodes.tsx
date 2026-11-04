import { useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import api, { errMsg } from '../../api/client';

const { Text } = Typography;
const { TextArea } = Input;

const COLORS = [
  'blue',
  'purple',
  'gold',
  'red',
  'cyan',
  'green',
  'orange',
  'magenta',
  'geekblue',
  'default',
];

export default function AdminNodes() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/flow/nodes');
      setList(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const open = (row: any) => {
    form.setFieldsValue({
      name: row.name,
      description: row.description,
      color: row.color,
      sort: row.sort,
      enabled: row.enabled,
      schemaText: JSON.stringify(row.configSchema || { fields: [] }, null, 2),
      defaultText: JSON.stringify(row.defaultConfig || {}, null, 2),
    });
    setEditing(row);
  };

  const save = async () => {
    const v = await form.validateFields();

    let configSchema: any;
    let defaultConfig: any;
    try {
      configSchema = JSON.parse(v.schemaText);
    } catch {
      message.error('配置项定义不是合法的 JSON');
      return;
    }
    try {
      defaultConfig = JSON.parse(v.defaultText);
    } catch {
      message.error('默认配置不是合法的 JSON');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/flow/nodes/${editing.type}`, {
        name: v.name,
        description: v.description,
        color: v.color,
        sort: v.sort,
        enabled: v.enabled,
        configSchema,
        defaultConfig,
      });
      message.success('节点已更新');
      setEditing(null);
      load();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 18 }}>
        <h2 className="page-title" style={{ marginBottom: 4 }}>
          节点设置
        </h2>
        <div className="muted">
          节点类型由代码定义，不可新增或删除；这里可以调整显示名称、标签颜色、排序、启用状态与配置项
        </div>
      </div>

      <Card bodyStyle={{ padding: 8 }}>
        <Table
          loading={loading}
          rowKey="type"
          dataSource={list}
          pagination={false}
          scroll={{ x: 880 }}
          columns={[
            { title: '排序', dataIndex: 'sort', width: 70 },
            {
              title: '节点',
              dataIndex: 'name',
              width: 150,
              render: (name: string, r: any) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{name}</span>
                  <Tag
                    color={r.color}
                    bordered={false}
                    style={{ width: 'fit-content', marginInlineEnd: 0, fontSize: 11 }}
                  >
                    {r.type}
                  </Tag>
                </div>
              ),
            },
            {
              title: '说明',
              dataIndex: 'description',
              render: (d: string) => d || <Text type="secondary">—</Text>,
            },
            {
              title: '配置项',
              dataIndex: 'configSchema',
              width: 90,
              render: (s: any) => <span>{s?.fields?.length || 0}</span>,
            },
            {
              title: '版本',
              dataIndex: 'version',
              width: 70,
              render: (v: number) => <Text type="secondary">v{v}</Text>,
            },
            {
              title: '状态',
              dataIndex: 'enabled',
              width: 90,
              render: (e: boolean) =>
                e ? (
                  <Tag color="green" bordered={false}>
                    启用
                  </Tag>
                ) : (
                  <Tag bordered={false}>已停用</Tag>
                ),
            },
            {
              title: '操作',
              width: 90,
              render: (_: any, r: any) => (
                <Button size="small" type="link" icon={<EditOutlined />} onClick={() => open(r)}>
                  配置
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`配置节点 · ${editing?.type || ''}`}
        open={!!editing}
        onOk={save}
        confirmLoading={saving}
        onCancel={() => setEditing(null)}
        okText="保存"
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Space size={14} style={{ display: 'flex' }}>
            <Form.Item name="name" label="显示名称" rules={[{ required: true, message: '请输入' }]} style={{ width: 200 }}>
              <Input maxLength={24} />
            </Form.Item>
            <Form.Item name="color" label="标签颜色" style={{ width: 150 }}>
              <Input />
            </Form.Item>
            <Form.Item name="sort" label="排序" style={{ width: 110 }}>
              <InputNumber min={0} max={99} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <div style={{ marginTop: -8, marginBottom: 12, fontSize: 12, color: 'var(--text-3)' }}>
            常用颜色：{COLORS.join(' / ')}
          </div>

          <Form.Item name="description" label="说明">
            <Input placeholder="在流程设计器里给使用者看的一句话" />
          </Form.Item>

          <Form.Item
            name="schemaText"
            label="配置项定义（JSON）"
            extra='结构为 { "fields": [{ "key": "...", "label": "...", "type": "select|number|boolean|text|userPicker|orgPicker|positionPicker|branches" }] }'
            rules={[{ required: true, message: '请填写配置项定义' }]}
          >
            <TextArea rows={8} style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }} />
          </Form.Item>

          <Form.Item
            name="defaultText"
            label="默认配置（JSON）"
            extra="新建该类型节点时预填的值"
            rules={[{ required: true, message: '请填写默认配置' }]}
          >
            <TextArea rows={5} style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }} />
          </Form.Item>

          <div className="muted">
            修改配置项定义只影响之后新建的节点，已存在的节点实例保存的是当时的配置快照。
          </div>
        </Form>
      </Modal>
    </div>
  );
}
