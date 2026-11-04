import { useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { PlusOutlined, StopOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api/client';

export default function AdminGrants() {
  const [list, setList] = useState<any[]>([]);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = async () => {
    const [g, o] = await Promise.all([api.get('/admin/grants'), api.get('/org/list')]);
    setList(g.data);
    setOrgs(o.data);
  };

  useEffect(() => {
    load();
  }, []);

  const orgOptions = orgs.map((o) => ({
    label: `${o.name}${o.type === 'UNIT' ? '（单位）' : ''}`,
    value: o.id,
  }));

  const create = async () => {
    const v = await form.validateFields();
    try {
      await api.post('/admin/grants', {
        ...v,
        expireAt: v.expireAt ? v.expireAt.toISOString() : undefined,
      });
      message.success('授权已添加');
      setOpen(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const revoke = async (id: string) => {
    await api.post(`/admin/grants/${id}/revoke`);
    message.success('已撤销');
    load();
  };

  const remove = async (id: string) => {
    await api.delete(`/admin/grants/${id}`);
    message.success('已删除');
    load();
  };

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            跨单位授权
          </h2>
          <div className="muted">下级单位向上级单位上报，必须有对应方向的授权，否则上报会被拒绝</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          新增授权
        </Button>
      </div>

      <Card bodyStyle={{ padding: 8 }}>
        <Table
          rowKey="id"
          dataSource={list}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            { title: '授权方', dataIndex: 'grantorName', width: 180 },
            {
              title: '',
              width: 60,
              render: () => <Tag bordered={false}>→</Tag>,
            },
            { title: '受权方', dataIndex: 'granteeName', width: 180 },
            {
              title: '范围',
              dataIndex: 'scope',
              width: 110,
              render: (s: string) => <Tag bordered={false}>{s === 'FLOW' ? '流程上报' : s}</Tag>,
            },
            {
              title: '到期',
              dataIndex: 'expireAt',
              width: 130,
              render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD') : '长期'),
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 100,
              render: (s: string) =>
                s === 'ACTIVE' ? (
                  <Tag color="green" bordered={false}>
                    生效中
                  </Tag>
                ) : (
                  <Tag bordered={false}>已撤销</Tag>
                ),
            },
            {
              title: '操作',
              width: 150,
              render: (_: any, r: any) => (
                <Space size={4}>
                  {r.status === 'ACTIVE' && (
                    <Popconfirm title="撤销后该方向的上报将被拒绝" onConfirm={() => revoke(r.id)}>
                      <Button size="small" type="link" icon={<StopOutlined />}>
                        撤销
                      </Button>
                    </Popconfirm>
                  )}
                  <Popconfirm title="彻底删除这条记录？" onConfirm={() => remove(r.id)}>
                    <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="新增跨单位授权" open={open} onOk={create} onCancel={() => setOpen(false)} okText="添加" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="grantorOrgId" label="授权方（发起上报的单位）" rules={[{ required: true, message: '请选择' }]}>
            <Select showSearch optionFilterProp="label" options={orgOptions} placeholder="通常选下级单位" />
          </Form.Item>
          <Form.Item name="granteeOrgId" label="受权方（接收上报的单位）" rules={[{ required: true, message: '请选择' }]}>
            <Select showSearch optionFilterProp="label" options={orgOptions} placeholder="通常选上级单位" />
          </Form.Item>
          <Form.Item name="scope" label="授权范围" initialValue="FLOW">
            <Select
              options={[
                { label: '流程上报', value: 'FLOW' },
                { label: '文档协同', value: 'DOC' },
                { label: '收集表', value: 'COLLECT' },
                { label: '全部', value: 'ALL' },
              ]}
            />
          </Form.Item>
          <Form.Item name="expireAt" label="到期时间">
            <DatePicker style={{ width: '100%' }} placeholder="留空表示长期有效" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
