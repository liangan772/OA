import { useEffect, useState } from 'react';
import { Button, Card, Empty, List, Space, Spin, Tabs, Tag, Typography } from 'antd';
import { ClockCircleOutlined, RightOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../store/auth';

const { Text } = Typography;

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
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin />
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="stat-card">
          <Text type="secondary" style={{ fontSize: 13 }}>待我处理</Text>
          <div className="stat-num" style={{ color: '#185fa5' }}>{todo.length}</div>
        </div>
        <div className="stat-card">
          <Text type="secondary" style={{ fontSize: 13 }}>我发起 · 进行中</Text>
          <div className="stat-num" style={{ color: '#ba7517' }}>{runningMine.length}</div>
        </div>
        <div className="stat-card">
          <Text type="secondary" style={{ fontSize: 13 }}>我已处理</Text>
          <div className="stat-num" style={{ color: '#1d9e75' }}>{done.length}</div>
        </div>
      </div>

      <Card bodyStyle={{ padding: '4px 0 0' }}>
        <Tabs
          defaultActiveKey="todo"
          style={{ padding: '0 20px' }}
          items={[
            {
              key: 'todo',
              label: `待办（${todo.length}）`,
              children: (
                <List
                  dataSource={todo}
                  locale={{ emptyText: <Empty description="暂无待办" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button type="primary" size="small" onClick={() => navigate(`/flow/instance/${item.instanceId}`)}>
                          去处理 <RightOutlined />
                        </Button>,
                      ]}
                      style={{ padding: '14px 0' }}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8}>
                            <span
                              style={{ cursor: 'pointer', fontWeight: 500 }}
                              onClick={() => navigate(`/flow/instance/${item.instanceId}`)}
                            >
                              {item.title}
                            </span>
                            <Tag color="blue">{FLOW_TYPE[item.flowType] || item.flowType}</Tag>
                            {item.round > 1 && <Tag color="orange">第 {item.round} 轮</Tag>}
                          </Space>
                        }
                        description={
                          <Space size={16} style={{ fontSize: 12 }}>
                            <span>{item.flowName}</span>
                            <span>当前节点：{item.nodeName}</span>
                            <span>发起人：{item.initiatorName}</span>
                            {item.deadline && (
                              <span style={{ color: dayjs(item.deadline).isBefore(dayjs()) ? '#a32d2d' : undefined }}>
                                <ClockCircleOutlined /> 限 {dayjs(item.deadline).format('MM-DD HH:mm')}
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
              label: `已办（${done.length}）`,
              children: (
                <List
                  dataSource={done}
                  locale={{ emptyText: <Empty description="暂无记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(item) => (
                    <List.Item style={{ padding: '14px 0' }}>
                      <List.Item.Meta
                        title={
                          <Space size={8}>
                            <span
                              style={{ cursor: 'pointer' }}
                              onClick={() => navigate(`/flow/instance/${item.instanceId}`)}
                            >
                              {item.title}
                            </span>
                            {statusTag(item.instanceStatus)}
                            <Tag>我：{item.action || '已处理'}</Tag>
                          </Space>
                        }
                        description={
                          <Space size={16} style={{ fontSize: 12 }}>
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
              label: `我发起的（${mine.length}）`,
              children: (
                <List
                  dataSource={mine}
                  locale={{ emptyText: <Empty description="暂无记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                  renderItem={(item) => (
                    <List.Item
                      actions={[
                        <Button size="small" onClick={() => navigate(`/flow/instance/${item.id}`)}>
                          查看
                        </Button>,
                      ]}
                      style={{ padding: '14px 0' }}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={8}>
                            <span>{item.title}</span>
                            {statusTag(item.status)}
                            <Tag color="blue">{FLOW_TYPE[item.flowType] || item.flowType}</Tag>
                          </Space>
                        }
                        description={
                          <Space size={16} style={{ fontSize: 12 }}>
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

      <div style={{ marginTop: 16, fontSize: 12, color: '#98a0a9' }}>
        <ThunderboltOutlined /> 你好，{user?.name}。你的表态会被记录在流程时间线中，负责人投否决将直接终止该节点。
      </div>
    </div>
  );
}
