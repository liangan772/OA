import { DatePicker, Form, Input, InputNumber, Select, Upload, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export interface FieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  span?: number;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

/** 编辑态：由内容模板的字段定义动态渲染 */
export function renderFieldInput(f: FieldDef) {
  switch (f.type) {
    case 'textarea':
      return <Input.TextArea rows={3} placeholder={f.placeholder || `请输入${f.label}`} />;
    case 'number':
      return <InputNumber style={{ width: '100%' }} placeholder={f.placeholder} />;
    case 'date':
      return <DatePicker style={{ width: '100%' }} />;
    case 'select':
      return (
        <Select
          placeholder={`请选择${f.label}`}
          options={f.options || []}
          allowClear
        />
      );
    case 'attachment':
      return (
        <Upload beforeUpload={() => false} multiple>
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      );
    default:
      return <Input placeholder={f.placeholder || `请输入${f.label}`} />;
  }
}

/** 展示态：把表单数据渲染成只读字段 */
export function FieldValue({ field, value }: { field: FieldDef; value: any }) {
  let display: any = value;
  if (value === undefined || value === null || value === '') display = '—';
  else if (field.type === 'select') {
    display = field.options?.find((o) => o.value === value)?.label ?? value;
  } else if (field.type === 'date') {
    display = dayjs(value).format('YYYY-MM-DD');
  } else if (field.type === 'attachment') {
    const arr = Array.isArray(value) ? value : [];
    display = arr.length ? arr.map((a: any) => a.name || a).join('、') : '—';
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="form-field-label">{field.label}</div>
      <div className="form-field-value">{String(display)}</div>
    </div>
  );
}

export function DynamicFormFields({ fields }: { fields: FieldDef[] }) {
  const [form] = Form.useForm();
  return (
    <>
      {fields.map((f) => (
        <Form.Item
          key={f.key}
          name={f.key}
          label={f.label}
          rules={f.required ? [{ required: true, message: `请填写${f.label}` }] : []}
          valuePropName={f.type === 'attachment' ? 'fileList' : 'value'}
          getValueFromEvent={f.type === 'attachment' ? (e) => e?.fileList : undefined}
        >
          {renderFieldInput(f)}
        </Form.Item>
      ))}
    </>
  );
}
