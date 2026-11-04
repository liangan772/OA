import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tree,
  TreeSelect,
  Typography,
} from 'antd';
import { PlusOutlined, ApartmentOutlined, TeamOutlined } from '@ant-design/icons';
import api, { errMsg } from '../api/client';

const { Text } = Typography;

function findNode(nodes: any[], id: string): any {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children || [], id);
    if (hit) return hit;
  }
  return null;
}

const TYPE_LABEL: Record<string, string> = { UNIT: '单位', DEPARTMENT: '部门', SECTION: '科室' };
const TYPE_COLOR: Record<string, string> = { UNIT: 'purple', DEPARTMENT: 'blue', SECTION: 'default' };

export default function OrgManage() {
  const [tree, setTree] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [ledger, setLedger] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orgModal, setOrgModal] = useState(false);
  const [posModal, setPosModal] = useState(false);
  const [postModal, setPostModal] = useState<any>(null);
  const [form] = Form.useForm();
  const [posForm] = Form.useForm();
  const { message } = AntApp.useApp();

  const load = useCallback(async () => {
    const [t, l, u] = await Promise.all([api.get('/org/tree'), api.get('/org/ledger'), api.get('/org/users')]);
    setTree(t.data);
    setLedger(l.data);
    setUsers(u.data);
    if (!selectedId && t.data.length) setSelectedId(t.data[0].id);
  }, [selectedId]);

  useEffect(() => {
    load();
  }, []);

  const selected = useMemo(() => (selectedId ? findNode(tree, selectedId) : null), [tree, selectedId]);

  const treeSelectData = useMemo(() => {
    const map = (nodes: any[]): any[] =>
      nodes.map((n) => ({
        value: n.id,
        title: `${n.name}（${TYPE_LABEL[n.type] || n.type}）`,
        children: map(n.children || []),
      }));
    return map(tree);
  }, [tree]);

  const toTreeData = (nodes: any[]): any[] =>
    nodes.map((n) => ({
      key: n.id,
      title: (
        <Space size={6}>
          <span>{n.name}</span>
          <Tag color={TYPE_COLOR[n.type]}>{TYPE_LABEL[n.type] || n.type}</Tag>
          {n.leaderName && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {n.leaderName}
            </Text>
          )}
        </Space>
      ),
      children: toTreeData(n.children || []),
    }));

  const createOrg = async () => {
    const v = await form.validateFields();
    try {
      await api.post('/org', v);
      message.success('已创建');
      setOrgModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const createPosition = async () => {
    const v = await posForm.validateFields();
    try {
      await api.post('/org/position', { ...v, orgId: selectedId });
      message.success('已创建编制位');
      setPosModal(false);
      posForm.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const assignPost = async (userId: string) => {
    try {
      const { data } = await api.post('/org/post', { userId, positionId: postModal.id, isPrimary: true });
      if (data.warning) message.warning(data.warning);
      else message.success('任职成功');
      setPostModal(null);
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const removePost = async (postId: string) => {
    try {
      await api.delete(`/org/post/${postId}`);
      message.success('已免职');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const removePosition = async (id: string) => {
    try {
      await api.delete(`/org/position/${id}`);
      message.success('已删除');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">编制管理</h2>

      <Row gutter={16}>
        <Col span={7}>
          <Card
            size="small"
            title={
              <Space>
                <ApartmentOutlined /> 组织架构
              </Space>
            }
            extra={
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setOrgModal(true)}>
                新增
              </Button>
            }
            bodyStyle={{ padding: 12, maxHeight: 'calc(100vh - 210px)', overflow: 'auto' }}
          >
            {tree.length ? (
              <Tree
                blockNode
                defaultExpandAll
                selectedKeys={[selectedId]}
                onSelect={(keys) => setSelectedId(String(keys[0] || ''))}
                treeData={toTreeData(tree)}
              />
            ) : (
              <Empty description="暂无组织" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>

        <Col span={17}>
          {selected ? (
            <Card
              size="small"
              title={
                <Space>
                  <span>{selected.name}</span>
                  <Tag color={TYPE_COLOR[selected.type]}>{TYPE_LABEL[selected.type]}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    定编 {selected.positionCount} 人 · 在编 {selected.memberCount} 人
                  </Text>
                </Space>
              }
              extra={
                <Space>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setOrgModal(true)}>
                    新增下级
                  </Button>
                  <Button size="small" type="primary" icon={<TeamOutlined />} onClick={() => setPosModal(true)}>
                    新增编制位
                  </Button>
                </Space>
              }
              bodyStyle={{ padding: 12 }}
            >
              <Tabs
                size="small"
                items={[
                  {
                    key: 'pos',
                    label: `编制位（${selected.positions.length}）`,
                    children: (
                      <Table
                        size="small"
                        rowKey="id"
                        pagination={false}
                        dataSource={selected.positions}
                        columns={[
                          { title: '编制名称', dataIndex: 'name' },
                          { title: '编码', dataIndex: 'code', width: 150 },
                          {
                            title: '性质',
                            dataIndex: 'isLeader',
                            width: 100,
                            render: (v: boolean, r: any) =>
                              v ? <Tag color="red">负责人</Tag> : r.isDeputy ? <Tag color="orange">副职</Tag> : <Tag>普通</Tag>,
                          },
                          { title: '定编', dataIndex: 'headcount', width: 70 },
                          {
                            title: '在任人员',
                            dataIndex: 'members',
                            render: (members: any[]) =>
                              members?.length ? (
                                <Space size={4} wrap>
                                  {members.map((m) => (
                                    <Tag key={m.postId} closable onClose={() => removePost(m.postId)}>
                                      {m.name}
                                    </Tag>
                                  ))}
                                </Space>
                              ) : (
                                <Text type="secondary">空缺</Text>
                              ),
                          },
                          {
                            title: '操作',
                            width: 140,
                            render: (_: any, r: any) => (
                              <Space size={4}>
                                <Button size="small" type="link" onClick={() => setPostModal(r)}>
                                  任职
                                </Button>
                                <Button size="small" type="link" danger onClick={() => removePosition(r.id)}>
                                  删除
                                </Button>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    ),
                  },
                  {
                    key: 'ledger',
                    label: '编制台账',
                    children: (
                      <Table
                        size="small"
                        rowKey="orgId"
                        pagination={{ pageSize: 10 }}
                        dataSource={ledger}
                        columns={[
                          { title: '组织', dataIndex: 'orgName' },
                          {
                            title: '类型',
                            dataIndex: 'orgType',
                            width: 90,
                            render: (t: string) => <Tag color={TYPE_COLOR[t]}>{TYPE_LABEL[t]}</Tag>,
                          },
                          { title: '层级', dataIndex: 'level', width: 70 },
                          { title: '定编', dataIndex: 'headcount', width: 80 },
                          { title: '实配', dataIndex: 'actual', width: 80 },
                          {
                            title: '空缺',
                            dataIndex: 'vacancy',
                            width: 80,
                            render: (v: number, r: any) =>
                              r.over ? <Tag color="red">超编 {Math.abs(v)}</Tag> : v > 0 ? <Tag color="orange">{v}</Tag> : <Tag color="green">满编</Tag>,
                          },
                        ]}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          ) : (
            <Card>
              <Empty description="请选择左侧组织节点" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal title="新增组织" open={orgModal} onOk={createOrg} onCancel={() => setOrgModal(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="parentId" label="上级组织" initialValue={selectedId}>
            <TreeSelect treeData={treeSelectData} allowClear placeholder="留空则创建顶级单位" treeDefaultExpandAll />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：办公室" />
          </Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true, message: '请输入唯一编码' }]}>
            <Input placeholder="如：D-OFFICE-01" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]} initialValue="DEPARTMENT">
            <Select
              options={[
                { label: '单位', value: 'UNIT' },
                { label: '部门', value: 'DEPARTMENT' },
                { label: '科室', value: 'SECTION' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="新增编制位" open={posModal} onOk={createPosition} onCancel={() => setPosModal(false)} destroyOnClose>
        <Form form={posForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="编制名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：办公室主任" />
          </Form.Item>
          <Form.Item name="code" label="编制编码" rules={[{ required: true, message: '请输入唯一编码' }]}>
            <Input placeholder="如：P-OFFICE-01" />
          </Form.Item>
          <Space size={24}>
            <Form.Item name="isLeader" label="正职负责人" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
            <Form.Item name="isDeputy" label="副职" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
            <Form.Item name="headcount" label="定编人数" initialValue={1}>
              <InputNumber min={1} max={99} />
            </Form.Item>
          </Space>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: -8, marginBottom: 8 }}>
            正职负责人编制位享有一票否决权，同一组织只能有一个。
          </div>
          <Form.Item name="duty" label="岗位职责">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`任职：${postModal?.name || ''}`}
        open={!!postModal}
        footer={null}
        onCancel={() => setPostModal(null)}
        destroyOnClose
      >
        <div style={{ marginTop: 12 }}>
          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder="搜索人员姓名或账号"
            optionFilterProp="label"
            onChange={(v) => assignPost(v)}
            options={users.map((u) => ({ label: `${u.name}（${u.account}）`, value: u.id }))}
          />
        </div>
      </Modal>
    </div>
  );
}
