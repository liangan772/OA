import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Input,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import { ArrowLeftOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import api, { errMsg } from '../api/client';
import { statusTag } from './Workbench';
import { FieldValue } from '../components/DynamicForm';

const { Text } = Typography;

const NODE_STATUS: Record<string, { text: string; cls: string }> = {
  PENDING: { text: '待进入', cls: '' },
  ACTIVE: { text: '处理中', cls: 'active' },
  WAITING: { text: '等待中', cls: 'waiting' },
  DONE: { text: '已完成', cls: 'done' },
  RETURNED: { text: '被退回', cls: 'terminated' },
  TERMINATED: { text: '已终止', cls: 'terminated' },
};

const ACTION_TEXT: Record<string, string> = {
  AGREE: '同意',
  DISAGREE: '不同意',
  ABSTAIN: '弃权',
  PASS: '通过',
  REJECT: '不通过',
  CONFIRM: '确认执行',
  RESUBMIT: '重新上报',
  ACCEPT: '接受',
  TRANSFER: '转派',
};

const ACTION_COLOR: Record<string, string> = {
  AGREE: 'green',
  PASS: 'green',
  CONFIRM: 'green',
  ACCEPT: 'blue',
  RESUBMIT: 'blue',
  DISAGREE: 'red',
  REJECT: 'red',
  ABSTAIN: 'default',
  TRANSFER: 'cyan',
};

export default function FlowDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [opinion, setOpinion] = useState('');
  const { message } = AntApp.useApp();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await api.get(`/flow/instances/${id}`);
      setData(res.data);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [id, message]);

  useEffect(() => {
    load();
  }, [load]);

  const myTask = data?.myTasks?.[0];
  const nodeInstances: any[] = data?.nodeInstances || [];

  const vetoed = useMemo(() => {
    for (const ni of nodeInstances) {
      const t = ni.tasks?.find((x: any) => x.isVeto);
      if (t) return t;
    }
    return null;
  }, [nodeInstances]);

  const submit = async (action: string) => {
    if (!myTask) return;
    setSubmitting(true);
    try {
      await api.post(`/flow/tasks/${myTask.taskId}/complete`, { action, opinion });
      message.success('已提交');
      setOpinion('');
      await load();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin />
      </div>
    );
  }
  if (!data) return null;

  const inst = data.instance;
  const fields = data.definition.contentTemplate?.schema?.fields || [];
  const formData = inst.formData || {};

  const actions = () => {
    if (!myTask) return null;
    const t = myTask.nodeType;
    if (t === 'VOTE') {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Button type="primary" block loading={submitting} onClick={() => submit('AGREE')}>
            同意
          </Button>
          <Button danger block loading={submitting} onClick={() => submit('DISAGREE')}>
            不同意
          </Button>
          <Button block loading={submitting} onClick={() => submit('ABSTAIN')}>
            弃权
          </Button>
        </Space>
      );
    }
    if (t === 'SUMMARIZE') {
      return (
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Button type="primary" block loading={submitting} onClick={() => submit('PASS')}>
            通过
          </Button>
          <Button danger block loading={submitting} onClick={() => submit('REJECT')}>
            不通过（退回下级）
          </Button>
        </Space>
      );
    }
    if (t === 'EXECUTE') {
      return (
        <Button type="primary" block loading={submitting} onClick={() => submit('CONFIRM')}>
          确认执行
        </Button>
      );
    }
    if (t === 'ASSIGN') {
      return (
        <Button type="primary" block loading={submitting} onClick={() => submit('ACCEPT')}>
          接受任务
        </Button>
      );
    }
    if (t === 'REPORT') {
      return (
        <Button type="primary" block loading={submitting} onClick={() => submit('RESUBMIT')}>
          补正后重新上报
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="page">
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 10 }}>
        返回
      </Button>

      <Card bodyStyle={{ padding: '18px 22px' }}>
        <Space size={10} wrap style={{ marginBottom: 8 }}>
          <span
            style={{
              fontSize: 'clamp(17px, 5vw, 21px)',
              fontWeight: 600,
              letterSpacing: '-0.022em',
              lineHeight: 1.3,
            }}
          >
            {inst.title}
          </span>
          {statusTag(inst.status)}
          {inst.round > 1 && (
            <Tag color="orange" bordered={false}>
              第 {inst.round} 轮
            </Tag>
          )}
        </Space>
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginTop: 6 }}>
          <Descriptions.Item label="流程">{data.definition.name}</Descriptions.Item>
          <Descriptions.Item label="发起部门">{inst.orgName}</Descriptions.Item>
          <Descriptions.Item label="发起人">{inst.initiatorName}</Descriptions.Item>
          <Descriptions.Item label="发起时间">{dayjs(inst.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
          <Descriptions.Item label="结束时间">
            {inst.closedAt ? dayjs(inst.closedAt).format('YYYY-MM-DD HH:mm') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="流程编号">{inst.id.slice(-8).toUpperCase()}</Descriptions.Item>
        </Descriptions>
      </Card>

      {vetoed && (
        <div className="vote-banner" style={{ marginTop: 14 }}>
          <WarningOutlined />
          <span>
            该流程已触发 <b>一票否决</b>：{vetoed.assigneeName}（{vetoed.assigneeOrgName}）投了不同意
            {vetoed.opinion ? `，意见：${vetoed.opinion}` : ''}
          </span>
        </div>
      )}

      <Row gutter={[16, 14]} style={{ marginTop: 14 }}>
        <Col xs={24} lg={15}>
          <Card title="事项内容" size="small" style={{ marginBottom: 14 }}>
            {fields.length ? (
              fields
                .filter((f: any) => f.key !== 'title')
                .map((f: any) => <FieldValue key={f.key} field={f} value={formData[f.key]} />)
            ) : (
              <pre style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{JSON.stringify(formData, null, 2)}</pre>
            )}
          </Card>

          <Card title="流转记录" size="small">
            {nodeInstances.length === 0 && <Empty description="暂无记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            {nodeInstances.map((ni) => {
              const st = NODE_STATUS[ni.status] || { text: ni.status, cls: '' };
              const stats = ni.tasks?.length
                ? {
                    agree: ni.tasks.filter((t: any) => t.action === 'AGREE').length,
                    disagree: ni.tasks.filter((t: any) => t.action === 'DISAGREE').length,
                    abstain: ni.tasks.filter((t: any) => t.action === 'ABSTAIN').length,
                  }
                : null;

              return (
                <div className="node-row" key={ni.id}>
                  <div className={`node-dot ${st.cls}`} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space size={8}>
                      <Text strong style={{ fontSize: 14 }}>
                        {ni.nodeName}
                      </Text>
                      <Tag>{st.text}</Tag>
                      {ni.round > 1 && <Tag color="orange">第 {ni.round} 轮</Tag>}
                      {ni.status === 'WAITING' && ni.result?.targetOrgName && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          已上报至 {ni.result.targetOrgName}
                        </Text>
                      )}
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(ni.startedAt).format('MM-DD HH:mm')}
                      {ni.finishedAt ? ` → ${dayjs(ni.finishedAt).format('MM-DD HH:mm')}` : ''}
                    </Text>
                  </div>

                  {stats && (
                    <Space size={6} style={{ marginTop: 6 }}>
                      <Tag color="green">同意 {stats.agree}</Tag>
                      <Tag color="red">不同意 {stats.disagree}</Tag>
                      <Tag>弃权 {stats.abstain}</Tag>
                    </Space>
                  )}

                  {ni.tasks?.length > 0 && (
                    <Table
                      size="small"
                      style={{ marginTop: 8 }}
                      scroll={{ x: 520 }}
                      pagination={false}
                      rowKey="id"
                      dataSource={ni.tasks}
                      columns={[
                        { title: '人员', dataIndex: 'assigneeName', width: 90 },
                        { title: '部门', dataIndex: 'assigneeOrgName', width: 120 },
                        {
                          title: '处理',
                          dataIndex: 'action',
                          width: 100,
                          render: (a: string, r: any) =>
                            a ? (
                              <Tag color={ACTION_COLOR[a] || 'default'}>
                                {ACTION_TEXT[a] || a}
                                {r.isVeto ? ' · 否决' : ''}
                              </Tag>
                            ) : (
                              <Text type="secondary">待处理</Text>
                            ),
                        },
                        { title: '意见', dataIndex: 'opinion', render: (o: string) => o || '—' },
                      ]}
                    />
                  )}
                </div>
              );
            })}
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          {myTask ? (
            <Card
              size="small"
              title="我的处理"
              style={{ marginBottom: 14, borderColor: 'var(--accent)' }}
              bodyStyle={{ padding: 16 }}
            >
              <div style={{ marginBottom: 10, fontSize: 13, color: 'var(--text-2)' }}>
                当前节点：<b>{myTask.nodeKey}</b>
                {myTask.nodeType === 'VOTE' && (
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--danger)' }}>
                    部门负责人投「不同意」将直接否决本节点
                  </div>
                )}
              </div>
              <Input.TextArea
                rows={3}
                placeholder="填写处理意见（可选，执行节点必填）"
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              {actions()}
            </Card>
          ) : (
            <Card size="small" style={{ marginBottom: 14 }} bodyStyle={{ padding: '20px 18px' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                你当前没有待处理事项
              </div>
            </Card>
          )}

          {data.parent && (
            <Card size="small" title="来源流程" style={{ marginBottom: 14 }}>
              <a onClick={() => navigate(`/flow/instance/${data.parent.id}`)}>{data.parent.flowName}</a>
              <div style={{ marginTop: 4 }}>{statusTag(data.parent.status)}</div>
            </Card>
          )}

          {data.children?.length > 0 && (
            <Card size="small" title="上报生成的上级流程">
              {data.children.map((c: any) => (
                <div key={c.id} style={{ marginBottom: 10 }}>
                  <a onClick={() => navigate(`/flow/instance/${c.id}`)}>{c.flowName}</a>
                  <Space size={6} style={{ marginLeft: 8 }}>
                    {statusTag(c.status)}
                  </Space>
                  <div className="muted">{dayjs(c.createdAt).format('YYYY-MM-DD HH:mm')}</div>
                </div>
              ))}
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
