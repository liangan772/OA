import { useEffect, useState } from 'react';
import { Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { statusTag } from './Workbench';

const FLOW_TYPE: Record<string, string> = {
  DELIBERATE: '审议',
  APPROVE: '审批',
  EXECUTE: '执行',
  PUBLICITY: '公示',
};

export default function MyFlows() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get('/flow/mine')
      .then((r) => setList(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h2 className="page-title">我发起的</h2>
      <Card bodyStyle={{ padding: 8 }}>
        <Table
          loading={loading}
          rowKey="id"
          dataSource={list}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          columns={[
            {
              title: '标题',
              dataIndex: 'title',
              render: (t: string, r: any) => (
                <a onClick={() => navigate(`/flow/instance/${r.id}`)}>{t}</a>
              ),
            },
            { title: '流程', dataIndex: 'flowName', width: 140 },
            {
              title: '类型',
              dataIndex: 'flowType',
              width: 90,
              render: (v: string) => <Tag color="blue">{FLOW_TYPE[v] || v}</Tag>,
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 130,
              render: (s: string) => statusTag(s),
            },
            {
              title: '轮次',
              dataIndex: 'round',
              width: 70,
              render: (r: number) => (r > 1 ? <Tag color="orange">{r}</Tag> : '—'),
            },
            {
              title: '发起时间',
              dataIndex: 'createdAt',
              width: 160,
              render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
