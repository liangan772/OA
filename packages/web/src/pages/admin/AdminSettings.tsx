import { useEffect, useState } from 'react';
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Row,
  Segmented,
  Space,
  Tag,
  Typography,
} from 'antd';
import { CheckCircleFilled, CloseCircleFilled, LockOutlined } from '@ant-design/icons';
import api, { errMsg } from '../../api/client';
import { useTheme, ThemeMode } from '../../store/theme';

const { Text } = Typography;

export default function AdminSettings() {
  const { mode, resolved, setMode } = useTheme();
  const [health, setHealth] = useState<any>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const { message } = AntApp.useApp();

  useEffect(() => {
    api.get('/health').then((r) => setHealth(r.data)).catch(() => setHealth(null));
  }, []);

  const changePassword = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await api.post('/auth/change-password', v);
      message.success('密码已修改');
      form.resetFields();
    } catch (e) {
      message.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const dot = (ok: boolean) =>
    ok ? (
      <Tag color="green" bordered={false} icon={<CheckCircleFilled />}>
        正常
      </Tag>
    ) : (
      <Tag color="red" bordered={false} icon={<CloseCircleFilled />}>
        不可用
      </Tag>
    );

  return (
    <div className="page">
      <h2 className="page-title">系统设置</h2>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="外观">
            <div className="form-field-label" style={{ marginBottom: 8 }}>
              主题
            </div>
            <Segmented
              block
              value={mode}
              onChange={(v) => setMode(v as ThemeMode)}
              options={[
                { label: '跟随系统', value: 'system' },
                { label: '浅色', value: 'light' },
                { label: '深色', value: 'dark' },
              ]}
            />
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
              当前实际显示为{resolved === 'dark' ? '深色' : '浅色'}。
              {mode === 'system' ? '系统外观变化时会自动跟随。' : '已固定，不再跟随系统。'}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="运行状态">
            <Descriptions size="small" column={1} colon={false}>
              <Descriptions.Item label="服务">CROA 0.1.0</Descriptions.Item>
              <Descriptions.Item label="数据库">{health ? dot(health.db) : <Text type="secondary">检查中</Text>}</Descriptions.Item>
              <Descriptions.Item label="Redis">
                {health ? dot(health.redis) : <Text type="secondary">检查中</Text>}
                {health && !health.redis && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    已降级，仅失去并发锁与缓存
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="检查时间">
                {health ? new Date(health.time).toLocaleString('zh-CN') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="修改密码">
            <Form form={form} layout="vertical">
              <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="当前密码" />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[
                  { required: true, message: '请输入' },
                  { min: 6, message: '至少 6 位' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="至少 6 位" />
              </Form.Item>
              <Button type="primary" loading={saving} onClick={changePassword}>
                保存
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="后台入口">
            <Space direction="vertical" size={8}>
              <Text>
                后台不显示在任何菜单中，直接访问 <Text code>/admin</Text> 进入。
              </Text>
              <Text type="secondary" style={{ fontSize: 12.5 }}>
                仅管理员角色可访问；普通用户即使知道地址也会被跳回工作台，接口层同样返回 403。
              </Text>
              <Text type="secondary" style={{ fontSize: 12.5 }}>
                在「人员与角色」中可以把其他账号提升为管理员。
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
