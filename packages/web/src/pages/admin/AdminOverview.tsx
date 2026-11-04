import { useEffect, useState } from 'react';
import { Card, Empty, Space, Spin, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import api from '../../api/client';

const { Text } = Typography;

const STATUS_LABEL: Record<string, string> = {
  RUNNING: '进行中',
  WAITING: '待上级处理',
  APPROVED: '已通过',
  REJECTED: '已否决',
  VETOED: '被一票否决',
  RETURNED: '已退回',
  TERMINATED: '已终止',
};

const STATUS_COLOR: Record<string, string> = {
  RUNNING: 'processing',
  WAITING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  VETOED: 'red',
  RETURNED: 'orange',
  TERMINATED: 'default',
};

export default function AdminOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/admin/overview')
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
        <Spin />
      </div>
    );
  }
  if (!data) return null;

  const c = data.counts;
  const maxTrend = Math.max(1, ...data.trend.map((t: any) => t.count));

  const stats = [
    { label: '在编人员', value: c.users, hint: `${c.positions} 个编制位` },
    { label: '组织节点', value: c.orgs, hint: '单位与部门' },
    { label: '流程实例', value: c.instances, hint: `${c.pendingTasks} 项待办` },
    { label: '流程模板', value: c.definitions, hint: `${c.templates} 个内容模板` },
  ];

  return (
    <div className="page">
      <h2 className="page-title">概览</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{s.label}</div>
            <div className="stat-num">{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{s.hint}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <Card size="small" title="近 7 天发起量">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140, padding: '8px 0' }}>
            {data.trend.map((t: any) => (
              <div key={t.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.count || ''}</div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: 34,
                    height: `${Math.max(4, (t.count / maxTrend) * 88)}px`,
                    borderRadius: 6,
                    background: t.count ? 'var(--accent)' : 'var(--border)',
                    transition: 'height .4s var(--ease)',
                  }}
                />
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{dayjs(t.date).format('MM/DD')}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" title="实例状态分布">
          {data.byStatus.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
          ) : (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {data.byStatus.map((s: any) => (
                <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag color={STATUS_COLOR[s.status] || 'default'} bordered={false}>
                    {STATUS_LABEL[s.status] || s.status}
                  </Tag>
                  <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {s.count}
                  </Text>
                </div>
              ))}
            </Space>
          )}
        </Card>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
          gap: 14,
          marginTop: 14,
        }}
      >
        {[
          { label: '协调文档', value: c.documents },
          { label: '邮件', value: c.mails },
          { label: '收集表', value: c.collects },
        ].map((b) => (
          <div className="stat-card" key={b.label}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{b.label}</div>
            <div className="stat-num" style={{ fontSize: 24 }}>
              {b.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
