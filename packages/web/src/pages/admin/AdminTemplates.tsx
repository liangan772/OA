import { useEffect, useMemo, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import api, { errMsg } from '../../api/client';
import { renderFieldInput } from '../../components/DynamicForm';

const { Text } = Typography;

const FIELD_TYPES = [
  { label: '单行文本', value: 'input' },
  { label: '多行文本', value: 'textarea' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '下拉选择', value: 'select' },
  { label: '附件', value: 'attachment' },
];

const TYPE_LABEL: Record<string, string> = {
  input: '单行文本',
  textarea: '多行文本',
  number: '数字',
  date: '日期',
  select: '下拉选择',
  attachment: '附件',
};

const blankField = (type: string, index: number) => ({
  key: `field_${index}`,
  label: '',
  type,
  required: false,
  span: 24,
  options: type === 'select' ? [{ label: '选项一', value: 'A' }] : undefined,
});

export default function AdminTemplates() {
  const [list, setList] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { message } = AntApp.useApp();

  const load = async () => {
    const { data } = await api.get('/flow/templates');
    const res = await api.get('/flow/definitions');
    const usage = new Map<string, number>();
    res.data.forEach((d: any) => {
      if (d.contentTemplateId) usage.set(d.contentTemplateId, (usage.get(d.contentTemplateId) || 0) + 1);
    });
    setList(data.map((t: any) => ({ ...t, usedBy: usage.get(t.id) || 0 })));
  };

  useEffect(() => {
    load();
  }, []);

  const pick = (t: any) => {
    setEditing({ ...t });
    setFields(
      (t.schema?.fields || []).map((f: any) => ({
        ...f,
        span: f.span ?? 24,
        options: f.options ? [...f.options] : f.type === 'select' ? [] : undefined,
      })),
    );
  };

  const startNew = () => {
    setEditing({ code: '', name: '', category: '' });
    setFields([{ key: 'title', label: '事项标题', type: 'input', required: true, span: 24 }]);
  };

  const patch = (i: number, p: any) => {
    const next = [...fields];
    next[i] = { ...next[i], ...p };
    setFields(next);
  };

  const addField = (type: string) => {
    const f = blankField(type, fields.length + 1);
    setFields([...fields, f]);
  };

  const removeField = (i: number) => setFields(fields.filter((_, idx) => idx !== i));

  const moveField = (i: number, dir: -1 | 1) => {
    const t = i + dir;
    if (t < 0 || t >= fields.length) return;
    const next = [...fields];
    [next[i], next[t]] = [next[t], next[i]];
    setFields(next);
  };

  const save = async () => {
    if (!editing.name?.trim() || !editing.code?.trim()) {
      message.warning('请填写模板名称与编码');
      return;
    }
    if (!fields.length) {
      message.warning('至少需要一个字段');
      return;
    }
    const bad = fields.find((f) => !f.label?.trim() || !f.key?.trim());
    if (bad) {
      message.warning('每个字段都需要标识和名称');
      return;
    }
    const keys = new Set<string>();
    for (const f of fields) {
      if (keys.has(f.key)) {
        message.warning(`字段标识重复：${f.key}`);
        return;
      }
      keys.add(f.key);
    }

    setSaving(true);
    try {
      const { data } = await api.post('/flow/templates', {
        code: editing.code,
        name: editing.name,
        category: editing.category,
        schema: {
          fields: fields.map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: !!f.required,
            span: f.span ?? 24,
            ...(f.type === 'select' ? { options: f.options || [] } : {}),
            ...(f.placeholder ? { placeholder: f.placeholder } : {}),
          })),
        },
        layout: editing.layout || {},
      });
      message.success('模板已保存');
      await load();
      pick(data);
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const usageCount = useMemo(
    () => (editing?.id ? list.find((t) => t.id === editing.id)?.usedBy ?? 0 : 0),
    [editing, list],
  );

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>
            内容模板
          </h2>
          <div className="muted">流程表单的字段由模板定义，节点只引用模板，互不绑定</div>
        </div>
        <Button icon={<PlusOutlined />} onClick={startNew}>
          新建模板
        </Button>
      </div>

      <Row gutter={16}>
        <Col xs={24} md={7} lg={6}>
          <Card size="small" title="模板列表" bodyStyle={{ padding: 10 }}>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {list.map((t) => (
                <div
                  key={t.id}
                  onClick={() => pick(t)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: editing?.id === t.id ? 'var(--accent-soft)' : 'transparent',
                    border: `1px solid ${editing?.id === t.id ? 'var(--accent)' : 'transparent'}`,
                    transition: 'all .2s var(--ease)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{t.name}</span>
                    {t.usedBy > 0 && (
                      <Tag bordered={false} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                        {t.usedBy} 个流程
                      </Tag>
                    )}
                  </div>
                  <div className="muted" style={{ marginTop: 3 }}>
                    {t.code} · {t.schema?.fields?.length || 0} 字段
                  </div>
                </div>
              ))}
              {!list.length && <Empty description="暂无模板" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={17} lg={18}>
          {editing ? (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Card
                size="small"
                title="模板信息"
                extra={
                  <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
                      预览
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      onClick={save}
                    >
                      保存
                    </Button>
                  </Space>
                }
              >
                <Row gutter={14}>
                  <Col xs={24} sm={8}>
                    <div className="form-field-label">模板名称</div>
                    <Input
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="如：通用事项单"
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <div className="form-field-label">模板编码</div>
                    <Input
                      value={editing.code}
                      onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                      placeholder="如：TPL-MATTER"
                      disabled={!!editing.id}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <div className="form-field-label">分类</div>
                    <Input
                      value={editing.category}
                      onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                      placeholder="可选"
                    />
                  </Col>
                </Row>
                {usageCount > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
                    该模板正被 {usageCount} 个流程引用，修改字段不会影响进行中的实例（实例已保存表单快照）
                  </div>
                )}
              </Card>

              <Card
                size="small"
                title={`字段设计（${fields.length}）`}
                extra={
                  <Select
                    size="small"
                    placeholder="添加字段"
                    style={{ width: 140 }}
                    value={null}
                    onChange={(v) => addField(v)}
                    options={FIELD_TYPES}
                  />
                }
              >
                {fields.length === 0 && (
                  <Empty description="还没有字段，从右上角添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}

                {fields.map((f, i) => (
                  <div
                    key={`${f.key}-${i}`}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginBottom: 10,
                      background: 'var(--surface)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Tag color="blue" bordered={false} style={{ marginInlineEnd: 0 }}>
                        {TYPE_LABEL[f.type] || f.type}
                      </Tag>
                      <Input
                        size="small"
                        value={f.label}
                        placeholder="字段名称"
                        onChange={(e) => patch(i, { label: e.target.value })}
                        style={{ width: 160 }}
                      />
                      <Input
                        size="small"
                        value={f.key}
                        placeholder="字段标识"
                        onChange={(e) => patch(i, { key: e.target.value })}
                        style={{ width: 130, fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}
                        variant="filled"
                      />
                      <Space size={4} style={{ marginLeft: 'auto' }}>
                        <Tooltip title="上移">
                          <Button
                            size="small"
                            type="text"
                            icon={<ArrowUpOutlined />}
                            disabled={i === 0}
                            onClick={() => moveField(i, -1)}
                          />
                        </Tooltip>
                        <Tooltip title="下移">
                          <Button
                            size="small"
                            type="text"
                            icon={<ArrowDownOutlined />}
                            disabled={i === fields.length - 1}
                            onClick={() => moveField(i, 1)}
                          />
                        </Tooltip>
                        <Tooltip title="删除">
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeField(i)}
                          />
                        </Tooltip>
                      </Space>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 10, flexWrap: 'wrap' }}>
                      <Space size={6}>
                        <Switch
                          size="small"
                          checked={!!f.required}
                          onChange={(v) => patch(i, { required: v })}
                        />
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>必填</span>
                      </Space>
                      <Space size={6}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>宽度</span>
                        <Select
                          size="small"
                          style={{ width: 90 }}
                          value={f.span ?? 24}
                          onChange={(v) => patch(i, { span: v })}
                          options={[
                            { label: '整行', value: 24 },
                            { label: '半行', value: 12 },
                            { label: '三分之一', value: 8 },
                          ]}
                        />
                      </Space>
                    </div>

                    {f.type === 'select' && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border)' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>选项</div>
                        {(f.options || []).map((o: any, oi: number) => (
                          <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                            <Input
                              size="small"
                              value={o.label}
                              placeholder="显示文字"
                              onChange={(e) => {
                                const opts = [...(f.options || [])];
                                opts[oi] = { ...opts[oi], label: e.target.value };
                                patch(i, { options: opts });
                              }}
                              style={{ flex: 1 }}
                            />
                            <Input
                              size="small"
                              value={o.value}
                              placeholder="值"
                              onChange={(e) => {
                                const opts = [...(f.options || [])];
                                opts[oi] = { ...opts[oi], value: e.target.value };
                                patch(i, { options: opts });
                              }}
                              style={{ width: 100 }}
                            />
                            <Button
                              size="small"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => patch(i, { options: (f.options || []).filter((_: any, x: number) => x !== oi) })}
                            />
                          </div>
                        ))}
                        <Button
                          size="small"
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() =>
                            patch(i, {
                              options: [...(f.options || []), { label: '', value: '' }],
                            })
                          }
                        >
                          添加选项
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                <Divider style={{ margin: '10px 0 12px' }} />
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => addField('input')}>
                  添加字段
                </Button>
              </Card>
            </Space>
          ) : (
            <Card>
              <Empty description="选择左侧模板，或新建一个" />
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title={`表单预览 · ${editing?.name || ''}`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={640}
      >
        <div style={{ marginTop: 16 }}>
          {fields.map((f, i) => (
            <div key={i} style={{ marginBottom: 18 }}>
              <div className="form-field-label">
                {f.label || '未命名字段'}
                {f.required && <span style={{ color: 'var(--danger)' }}> *</span>}
              </div>
              {renderFieldInput({
                key: f.key,
                label: f.label,
                type: f.type,
                required: f.required,
                options: f.options,
              })}
            </div>
          ))}
          {!fields.length && <Text type="secondary">暂无字段</Text>}
        </div>
      </Modal>
    </div>
  );
}
