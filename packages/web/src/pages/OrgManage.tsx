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
  Popconfirm,
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
import { PlusOutlined, ApartmentOutlined, TeamOutlined, DeleteOutlined } from '@ant-design/icons';
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


export default function OrgManage() {
  const [tree, setTree] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [ledger, setLedger] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [orgModal, setOrgModal] = useState(false);
  const [posModal, setPosModal] = useState(false);
  const [postModal, setPostModal] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);
  const [editingPos, setEditingPos] = useState<any>(null);
  const [orgEditOpen, setOrgEditOpen] = useState(false);
  const [orgEditForm] = Form.useForm();
  const [typeModal, setTypeModal] = useState(false);
  const [typeForm] = Form.useForm();
  const [form] = Form.useForm();
  const [posForm] = Form.useForm();
  const { message } = AntApp.useApp();

  const typeDef = useCallback(
    (code: string) => types.find((t) => t.code === code),
    [types],
  );
  const typeLabel = useCallback(
    (code: string) => typeDef(code)?.name || code,
    [typeDef],
  );
  const typeColor = useCallback(
    (code: string) => (typeDef(code)?.isUnit ? 'purple' : code === 'DEPARTMENT' ? 'blue' : 'default'),
    [typeDef],
  );

  const load = useCallback(async () => {
    const [t, l, u, ty] = await Promise.all([
      api.get('/org/tree'),
      api.get('/org/ledger'),
      api.get('/org/users'),
      api.get('/org/types'),
    ]);
    setTree(t.data);
    setLedger(l.data);
    setUsers(u.data);
    setTypes(ty.data);
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
        title: `${n.name}（${typeLabel(n.type)}）`,
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
          <Tag color={typeColor(n.type)}>{typeLabel(n.type)}</Tag>
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
      // TreeSelect 清空时可能给空串，统一转成 undefined，避免后端写入非法的 parentId
      await api.post('/org', { ...v, parentId: v.parentId || undefined });
      message.success('已创建');
      setOrgModal(false);
      form.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const openPosModal = (pos?: any) => {
    setEditingPos(pos || null);
    posForm.resetFields();
    if (pos) posForm.setFieldsValue(pos);
    setPosModal(true);
  };

  const savePosition = async () => {
    const v = await posForm.validateFields();
    try {
      if (editingPos) {
        await api.patch(`/org/position/${editingPos.id}`, v);
        message.success('编制位已更新');
      } else {
        await api.post('/org/position', { ...v, orgId: selectedId });
        message.success('已创建编制位');
      }
      setPosModal(false);
      posForm.resetFields();
      setEditingPos(null);
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const openOrgEdit = () => {
    if (!selected) return;
    orgEditForm.setFieldsValue({ name: selected.name, sort: selected.sort ?? 0 });
    setOrgEditOpen(true);
  };

  const saveOrgEdit = async () => {
    const v = await orgEditForm.validateFields();
    try {
      await api.patch(`/org/${selectedId}`, v);
      message.success('已保存');
      setOrgEditOpen(false);
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
      await api.delete(`/org/position/${id}?force=true`);
      message.success('已删除');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const removeOrg = async (id: string) => {
    try {
      await api.delete(`/org/${id}?force=true`);
      message.success('组织已删除');
      setSelectedId('');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const createType = async () => {
    const v = await typeForm.validateFields();
    try {
      await api.post('/org/types', v);
      message.success('类型已添加');
      typeForm.resetFields();
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  const removeType = async (id: string) => {
    try {
      await api.delete(`/org/types/${id}`);
      message.success('类型已删除');
      load();
    } catch (e) {
      message.error(errMsg(e));
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">编制管理</h2>

      <Row gutter={16}>
        <Col xs={24} lg={7}>
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

        <Col xs={24} lg={17}>
          {selected ? (
            <Card
              size="small"
              title={
                <Space>
                  <span>{selected.name}</span>
                  <Tag color={typeColor(selected.type)}>{typeLabel(selected.type)}</Tag>
                  <Button size="small" type="link" onClick={openOrgEdit} style={{ padding: 0 }}>
                    编辑
                  </Button>
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
                  <Button size="small" type="primary" icon={<TeamOutlined />} onClick={() => openPosModal()}>
                    新增编制位
                  </Button>
                  <Popconfirm
                    title={`删除「${selected.name}」`}
                    description="会连同下级组织、编制位与任职一并删除，且不可恢复"
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => removeOrg(selected.id)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
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
                        scroll={{ x: 680 }}
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
                                <Button size="small" type="link" onClick={() => openPosModal(r)}>
                                  编辑
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
                            render: (t: string) => <Tag color={typeColor(t)}>{typeLabel(t)}</Tag>,
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

      <Modal
        title={`编辑组织 · ${selected?.name || ''}`}
        open={orgEditOpen}
        onOk={saveOrgEdit}
        onCancel={() => setOrgEditOpen(false)}
        okText="保存"
        destroyOnClose
      >
        <Form form={orgEditForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sort" label="排序" extra="数字越小越靠前">
            <InputNumber min={0} max={999} style={{ width: '100%' }} />
          </Form.Item>
          <div className="muted">编码与类型创建后不可修改，如需调整层级请使用移动功能。</div>
        </Form>
      </Modal>

      <Modal
        title="组织类型"
        open={typeModal}
        onCancel={() => setTypeModal(false)}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={types}
          style={{ marginBottom: 16 }}
          columns={[
            { title: '名称', dataIndex: 'name' },
            {
              title: '编码',
              dataIndex: 'code',
              width: 130,
              render: (c: string) => (
                <Text code style={{ fontSize: 12 }}>
                  {c}
                </Text>
              ),
            },
            {
              title: '层级语义',
              dataIndex: 'isUnit',
              width: 110,
              render: (v: boolean) =>
                v ? <Tag color="purple">单位</Tag> : <Tag>部门</Tag>,
            },
            {
              title: '操作',
              width: 90,
              render: (_: any, r: any) =>
                r.builtin ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    内置
                  </Text>
                ) : (
                  <Popconfirm title="删除该类型？" onConfirm={() => removeType(r.id)}>
                    <Button size="small" type="link" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
            },
          ]}
        />

        <Form form={typeForm} layout="vertical">
          <Row gutter={10}>
            <Col span={8}>
              <Form.Item name="code" label="编码" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="如 GROUP" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '必填' }]}>
                <Input placeholder="如 集团" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isUnit" label="视为单位" valuePropName="checked" initialValue={false}>
                <Switch />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" icon={<PlusOutlined />} onClick={createType} block>
            添加类型
          </Button>
          <div className="muted" style={{ marginTop: 8 }}>
            勾选「视为单位」的类型可自成根节点、作为跨单位上报的边界；编码创建后不可修改。
          </div>
        </Form>
      </Modal>

      <Modal title="新增组织" open={orgModal} onOk={createOrg} onCancel={() => setOrgModal(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="parentId" label="上级组织" initialValue={selectedId || undefined}>
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
              placeholder="选择类型"
              options={types
                .filter((t) => t.status === 'ACTIVE')
                .map((t) => ({
                  label: `${t.name}${t.isUnit ? '（单位）' : ''}`,
                  value: t.code,
                }))}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                    <Button type="text" size="small" block icon={<PlusOutlined />} onClick={() => setTypeModal(true)}>
                      管理组织类型
                    </Button>
                  </div>
                </>
              )}
            />
            <div className="muted" style={{ marginTop: 4 }}>
              类型决定层级语义：「单位」类可自成根节点，其余必须挂在上级下
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingPos ? `编辑编制位 · ${editingPos.name}` : '新增编制位'}
        open={posModal}
        onOk={savePosition}
        onCancel={() => {
          setPosModal(false);
          setEditingPos(null);
        }}
        destroyOnClose
      >
        <Form form={posForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="编制名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="如：办公室主任" />
          </Form.Item>
          <Form.Item name="code" label="编制编码" rules={[{ required: true, message: '请输入唯一编码' }]}>
            <Input placeholder="如：P-OFFICE-01" disabled={!!editingPos} />
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
