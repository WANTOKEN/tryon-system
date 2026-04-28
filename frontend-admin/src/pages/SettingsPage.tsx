import { Card, Form, Input, Button, message, Switch, Divider, Spin, Tabs, InputNumber, Select, Space } from 'antd';
import { useEffect, useState } from 'react';
import { configApi } from '../api';
import type { GroupedConfig, SystemConfigItem } from '../types';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupedConfig, setGroupedConfig] = useState<GroupedConfig | null>(null);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const data = await configApi.getGrouped();
      setGroupedConfig(data);
    } catch (error) {
      console.error('Failed to load config:', error);
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (_group: string, configs: SystemConfigItem[]) => {
    setSaving(true);
    try {
      const configMap: Record<string, string> = {};
      const valueTypes: Record<string, string> = {};
      
      configs.forEach((config) => {
        if (config.value !== undefined) {
          configMap[config.key] = config.value;
          valueTypes[config.key] = config.value_type;
        }
      });

      await configApi.batchUpdate(configMap, { value_types: valueTypes });
      message.success('配置保存成功');
    } catch (error) {
      console.error('Failed to save config:', error);
      message.error('配置保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!groupedConfig) {
    return <div>加载配置失败</div>;
  }

  return (
    <div>
      <Tabs
        items={[
          {
            key: 'basic',
            label: '基础设置',
            children: <BasicConfigPanel configs={groupedConfig.basic} onSave={handleSave} loading={saving} onRefresh={loadConfig} />,
          },
          {
            key: 'ai',
            label: 'AI引擎配置',
            children: <AIConfigPanel configs={groupedConfig.ai} onSave={handleSave} loading={saving} onRefresh={loadConfig} />,
          },
          {
            key: 'oss',
            label: 'OSS存储配置',
            children: <OSSConfigPanel configs={groupedConfig.oss} onSave={handleSave} loading={saving} onRefresh={loadConfig} />,
          },
          {
            key: 'storage',
            label: '存储设置',
            children: <StorageConfigPanel configs={groupedConfig.storage} onSave={handleSave} loading={saving} onRefresh={loadConfig} />,
          },
          {
            key: 'quota',
            label: '配额设置',
            children: <QuotaConfigPanel configs={groupedConfig.quota} onSave={handleSave} loading={saving} onRefresh={loadConfig} />,
          },
          {
            key: 'contact',
            label: '联系方式',
            children: <ContactConfigPanel configs={groupedConfig.contact} onSave={handleSave} loading={saving} onRefresh={loadConfig} />,
          },
        ]}
      />
    </div>
  );
}

// 配置面板组件
function BasicConfigPanel({ configs, onSave, loading, onRefresh }: { 
  configs: SystemConfigItem[]; 
  onSave: (group: string, configs: SystemConfigItem[]) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [localConfigs, setLocalConfigs] = useState(configs);

  useEffect(() => { setLocalConfigs(configs); }, [configs]);

  const handleChange = (key: string, value: string) => {
    setLocalConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  return (
    <Card>
      {localConfigs.map((config) => (
        <Form.Item key={config.key} label={config.description || config.key}>
          <Input
            value={config.value}
            onChange={(e) => handleChange(config.key, e.target.value)}
            placeholder={`请输入${config.description || config.key}`}
          />
        </Form.Item>
      ))}
      <Divider />
      <Space>
        <Button type="primary" loading={loading} onClick={() => onSave('basic', localConfigs)}>保存配置</Button>
        <Button onClick={onRefresh}>重置</Button>
      </Space>
    </Card>
  );
}

function AIConfigPanel({ configs, onSave, loading, onRefresh }: { 
  configs: SystemConfigItem[]; 
  onSave: (group: string, configs: SystemConfigItem[]) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [localConfigs, setLocalConfigs] = useState(configs);

  useEffect(() => { setLocalConfigs(configs); }, [configs]);

  const handleChange = (key: string, value: string) => {
    setLocalConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const getConfig = (key: string) => localConfigs.find((c) => c.key === key);

  return (
    <Card>
      <Form.Item label="AI引擎">
        <Select
          value={getConfig('ai_engine')?.value || 'seeddance'}
          onChange={(v) => handleChange('ai_engine', v)}
          options={[{ value: 'seeddance', label: 'SeedDance (字节跳动)' }]}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item label="超时时间(秒)">
        <InputNumber
          value={parseInt(getConfig('ai_timeout')?.value || '60')}
          onChange={(v) => handleChange('ai_timeout', String(v ?? 60))}
          min={10}
          max={300}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item label="重试次数">
        <InputNumber
          value={parseInt(getConfig('ai_retry_count')?.value || '3')}
          onChange={(v) => handleChange('ai_retry_count', String(v ?? 3))}
          min={0}
          max={10}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item label="API密钥">
        <Input.Password
          value={getConfig('ai_api_key')?.value || ''}
          onChange={(e) => handleChange('ai_api_key', e.target.value)}
          placeholder="请输入API密钥"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Divider />
      <Space>
        <Button type="primary" loading={loading} onClick={() => onSave('ai', localConfigs)}>保存配置</Button>
        <Button onClick={onRefresh}>重置</Button>
      </Space>
    </Card>
  );
}

function OSSConfigPanel({ configs, onSave, loading, onRefresh }: { 
  configs: SystemConfigItem[]; 
  onSave: (group: string, configs: SystemConfigItem[]) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [localConfigs, setLocalConfigs] = useState(configs);

  useEffect(() => { setLocalConfigs(configs); }, [configs]);

  const handleChange = (key: string, value: string) => {
    setLocalConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const getConfig = (key: string) => localConfigs.find((c) => c.key === key);

  return (
    <Card>
      <Form.Item label="启用OSS存储" valuePropName="checked">
        <Switch
          checked={getConfig('oss_enabled')?.value === 'true'}
          onChange={(v) => handleChange('oss_enabled', v ? 'true' : 'false')}
        />
      </Form.Item>
      <Form.Item label="OSS类型">
        <Select
          value={getConfig('oss_type')?.value || 'aliyun'}
          onChange={(v) => handleChange('oss_type', v)}
          options={[
            { value: 'aliyun', label: '阿里云 OSS' },
            { value: 'volcengine', label: '火山引擎 TOS' },
          ]}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item label="Bucket名称">
        <Input
          value={getConfig('oss_bucket')?.value || ''}
          onChange={(e) => handleChange('oss_bucket', e.target.value)}
          placeholder="请输入Bucket名称"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Form.Item label="Endpoint">
        <Input
          value={getConfig('oss_endpoint')?.value || ''}
          onChange={(e) => handleChange('oss_endpoint', e.target.value)}
          placeholder="请输入Endpoint"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Form.Item label="Access Key">
        <Input.Password
          value={getConfig('oss_access_key')?.value || ''}
          onChange={(e) => handleChange('oss_access_key', e.target.value)}
          placeholder="请输入Access Key"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Form.Item label="Secret Key">
        <Input.Password
          value={getConfig('oss_secret_key')?.value || ''}
          onChange={(e) => handleChange('oss_secret_key', e.target.value)}
          placeholder="请输入Secret Key"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Divider />
      <Space>
        <Button type="primary" loading={loading} onClick={() => onSave('oss', localConfigs)}>保存配置</Button>
        <Button onClick={onRefresh}>重置</Button>
      </Space>
    </Card>
  );
}

function StorageConfigPanel({ configs, onSave, loading, onRefresh }: { 
  configs: SystemConfigItem[]; 
  onSave: (group: string, configs: SystemConfigItem[]) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [localConfigs, setLocalConfigs] = useState(configs);

  useEffect(() => { setLocalConfigs(configs); }, [configs]);

  const handleChange = (key: string, value: string) => {
    setLocalConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const getConfig = (key: string) => localConfigs.find((c) => c.key === key);

  return (
    <Card>
      <Form.Item label="存储类型">
        <Select
          value={getConfig('storage_type')?.value || 'local'}
          onChange={(v) => handleChange('storage_type', v)}
          options={[
            { value: 'local', label: '本地存储' },
            { value: 'oss', label: 'OSS存储' },
          ]}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item label="最大存储空间(MB)">
        <InputNumber
          value={parseInt(getConfig('storage_max_size_mb')?.value || '1024')}
          onChange={(v) => handleChange('storage_max_size_mb', String(v ?? 1024))}
          min={100}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item label="自动清理天数">
        <InputNumber
          value={parseInt(getConfig('storage_cleanup_days')?.value || '30')}
          onChange={(v) => handleChange('storage_cleanup_days', String(v ?? 30))}
          min={7}
          max={365}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Divider />
      <Space>
        <Button type="primary" loading={loading} onClick={() => onSave('storage', localConfigs)}>保存配置</Button>
        <Button onClick={onRefresh}>重置</Button>
      </Space>
    </Card>
  );
}

function QuotaConfigPanel({ configs, onSave, loading, onRefresh }: { 
  configs: SystemConfigItem[]; 
  onSave: (group: string, configs: SystemConfigItem[]) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [localConfigs, setLocalConfigs] = useState(configs);

  useEffect(() => { setLocalConfigs(configs); }, [configs]);

  const handleChange = (key: string, value: string) => {
    setLocalConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const getConfig = (key: string) => localConfigs.find((c) => c.key === key);

  return (
    <Card>
      <Form.Item label="默认配额">
        <InputNumber
          value={parseInt(getConfig('default_quota')?.value || '100')}
          onChange={(v) => handleChange('default_quota', String(v ?? 100))}
          min={0}
          style={{ width: 200 }}
        />
      </Form.Item>
      <Form.Item label="配额重置日(每月)">
        <InputNumber
          value={parseInt(getConfig('quota_reset_day')?.value || '1')}
          onChange={(v) => handleChange('quota_reset_day', String(v ?? 1))}
          min={1}
          max={28}
          style={{ width: 200 }}
        />
        <span style={{ marginLeft: 8, color: '#999' }}>每月几号重置配额</span>
      </Form.Item>
      <Divider />
      <Space>
        <Button type="primary" loading={loading} onClick={() => onSave('quota', localConfigs)}>保存配置</Button>
        <Button onClick={onRefresh}>重置</Button>
      </Space>
    </Card>
  );
}

function ContactConfigPanel({ configs, onSave, loading, onRefresh }: { 
  configs: SystemConfigItem[]; 
  onSave: (group: string, configs: SystemConfigItem[]) => void;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [localConfigs, setLocalConfigs] = useState(configs);

  useEffect(() => { setLocalConfigs(configs); }, [configs]);

  const handleChange = (key: string, value: string) => {
    setLocalConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const getConfig = (key: string) => localConfigs.find((c) => c.key === key);

  return (
    <Card>
      <Form.Item label="管理员名称">
        <Input
          value={getConfig('admin_contact_name')?.value || ''}
          onChange={(e) => handleChange('admin_contact_name', e.target.value)}
          placeholder="请输入管理员名称"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Form.Item label="联系电话">
        <Input
          value={getConfig('admin_contact_phone')?.value || ''}
          onChange={(e) => handleChange('admin_contact_phone', e.target.value)}
          placeholder="请输入联系电话"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Form.Item label="微信号">
        <Input
          value={getConfig('admin_contact_wechat')?.value || ''}
          onChange={(e) => handleChange('admin_contact_wechat', e.target.value)}
          placeholder="请输入微信号"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Form.Item label="邮箱">
        <Input
          value={getConfig('admin_contact_email')?.value || ''}
          onChange={(e) => handleChange('admin_contact_email', e.target.value)}
          placeholder="请输入邮箱"
          style={{ width: 400 }}
        />
      </Form.Item>
      <Divider />
      <Space>
        <Button type="primary" loading={loading} onClick={() => onSave('contact', localConfigs)}>保存配置</Button>
        <Button onClick={onRefresh}>重置</Button>
      </Space>
    </Card>
  );
}
