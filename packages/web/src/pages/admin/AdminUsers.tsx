import { useEffect, useState } from 'react';
import { App as AntApp, Card, Select, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import api, { errMsg } from '../../api/client';

const { Text } = Typography;

export default function AdminUsers() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  return (
    <div className="page">
      <h2 className="page-title">人员与角色</h2>
      <div className="muted" style={{ marginBottom: 18 }}>
        管理员可通过 /admin 进入后台；业务人员的编制归属在「编制管理」中维护
      </div>

      <Card bodyStyle={{ padding: 8 }}>
        <Table
          loading={loading}
          rowKey="id"
          dataSource={list}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          scroll={{ x: 820 }}
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
            { title: '账号', dataIndex: 'account', width: 120 },
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
              width: 140,
              render: (_: any, r: any) => (
                <Select
                  size="small"
                  value={r.role}
                  style={{ width: 110 }}
                  onChange={(v) => setRole(r.id, v)}
                  options={[
                    { label: '普通用户', value: 'USER' },
                    { label: '管理员', value: 'ADMIN' },
                  ]}
                />
              ),
            },
            {
              title: '创建时间',
              dataIndex: 'createdAt',
              width: 130,
              render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
