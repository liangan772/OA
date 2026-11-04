import { useEffect, useState } from 'react';
import { Button, Card, Empty, List, Space, Spin, Tabs, Tag } from 'antd';
import { ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../store/auth';

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  RUNNING: { text: '进行中', color: 'processing' },
  WAITING: { text: '待上级处理', color: 'gold' },
  APPROVED: { text: '已通过', color: 'green' },
  REJECTED: { text: '已否决', color: 'red' },
  VETOED: { text: '被一票否决', color: 'red' },
  RETURNED: { text: '已退回', color: 'orange' },
  TERMINATED: { text: '已终止', color: 'default' },
};

export const statusTag = (s: string) => {
  const m = STATUS_MAP[s] || { text: s, color: 'default' };
  return <Tag color={m.color}>{m.text}</Tag>;
};

const FLOW_TYPE: Record<string, string> = {
  DELIBERATE: '审议',
  APPROVE: '审批',
  EXECUTE: '执行',
  PUBLICITY: '公示',
};

const meter = (label: string, value: number, color: string) => (
  <div className="stat-card">
    <div style={{ fontSize: 12.5, color: 'var(--text-3)', letterSpacing: 0 }}>{label}</div>
    <div className="stat-num" style={{ color }}>
      {value}
    </div>
  </div>
);

export default function Workbench() {
  const [todo, setTodo] = useState<any[]>([]);
  const [done, setDone] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    Promise.all([api.get('/flow/todo'), api.get('/flow/done'), api.get('/flow/mine')])
      .then(([t, d, m]) => {
        setTodo(t.data);
        setDone(d.data);
        setMine(m.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const runningMine = mine.filter((i) => !['APPROVED', 'REJECTED', 'VETOED', 'TERMINATED'].includes(i.status));

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 140 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ marginBottom: 26 }}>
        <h2 className="page-title" style={{ marginBottom: 6 }}>
          {user?.name}，你好
        </h2>
        <div className="muted">
          {dayjs().format('YYYY 年 M 月 D 日 dddd')}
          {todo.length > 0 ? ` · 有 ${todo.length} 项待你处理` : ' · 暂无待办'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 22 }}>
        {meter('待我处理', todo.length, 'var(--accent)')}
        {meter('我发起 · 进行中', runningMine.length, 'var(--warning)')}
        {meter('我已处理', done.length, 'var(--success)')}
      </div>

      <Card bodyStyle={{ padding: '6px 22px 8px' }}>
        <Tabs
          defaultActiveKey="todo"
          items={[
            {
              key: 'todo',
              label: `待办 ${todo.length}`,
              children: (
                <List
                  dataSource={todo}
                  locale={{ emptyText: <Empty description="暂无待办" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(item) => (
                    <List.Item
                      style={{ padding: '15px 0', borderBlockEnd: '1px solid var(--border)' }}
                      actions={[
                        <Button
                          type="primary"
                          size="small"
                          shape="round"
                          onClick={() => navigate(`/flow/instance/${item.instanceId}`)}
                        >
                          去处理 <RightOutlined style={{ fontSize: 10 }} />
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8}>
                            <span
                              style={{ cursor: 'pointer', fontWeight: 500, fontSize: 14.5 }}
                              onClick={() => navigate(`/flow/instance/${item.instanceId}`)}
                            >
                              {item.title}
                            </span>
                            <Tag color="blue" bordered={false}>
                              {FLOW_TYPE[item.flowType] || item.flowType}
                            </Tag>
                            {item.round > 1 && (
                              <Tag color="orange" bordered={false}>
                                第 {item.round} 轮
                              </Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space size={14} style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                            <span>{item.flowName}</span>
                            <span>当前：{item.nodeName}</span>
                            <span>发起人 {item.initiatorName}</span>
                            {item.deadline && (
                              <span
                                style={{
                                  color: dayjs(item.deadline).isBefore(dayjs()) ? 'var(--danger)' : undefined,
                                }}
                              >
                                <ClockCircleOutlined /> {dayjs(item.deadline).format('MM-DD HH:mm')}
                              </span>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'done',
              label: `已办 ${done.length}`,
              children: (
                <List
                  dataSource={done}
                  locale={{ emptyText: <Empty description="暂无记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '15px 0', borderBlockEnd: '1px solid var(--border)' }}>
                      <List.Item.Meta
                        title={
                          <Space size={8}>
                            <span
                              style={{ cursor: 'pointer', fontSize: 14.5 }}
                              onClick={() => navigate(`/flow/instance/${item.instanceId}`)}
                            >
                              {item.title}
                            </span>
                            {statusTag(item.instanceStatus)}
                          </Space>
                        }
                        description={
                          <Space size={14} style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                            <span>{item.flowName}</span>
                            <span>{item.finishedAt ? dayjs(item.finishedAt).format('YYYY-MM-DD HH:mm') : ''}</span>
                            {item.opinion && <span>意见：{item.opinion}</span>}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ),
            },
            {
              key: 'mine',
              label: `我发起的 ${mine.length}`,
              children: (
                <List
                  dataSource={mine}
                  locale={{ emptyText: <Empty description="暂无记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(item) => (
                    <List.Item
                      style={{ padding: '15px 0', borderBlockEnd: '1px solid var(--border)' }}
                      actions={[
                        <Button size="small" shape="round" onClick={() => navigate(`/flow/instance/${item.id}`)}>
                          查看
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8}>
                            <span style={{ fontSize: 14.5 }}>{item.title}</span>
                            {statusTag(item.status)}
                            <Tag color="blue" bordered={false}>
                              {FLOW_TYPE[item.flowType] || item.flowType}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space size={14} style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>
                            <span>{item.flowName}</span>
                            <span>{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                            {item.round > 1 && <span>第 {item.round} 轮</span>}
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
    </div>
  );
}
