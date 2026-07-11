import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, message, Tag, Progress, Space, InputNumber, Popconfirm, Drawer, Descriptions, List, Typography, Switch, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined, HistoryOutlined, StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useState, useRef } from 'react';
import type { Merchant, QuotaHistoryItem } from '../types';
import { merchantApi } from '../api';

const { Text } = Typography;

type MerchantFormData = {
  store_name: string;
  username: string;
  phone?: string;
}

interface QuotaFormData {
  quota_total: number;
  reason?: string;
}

export default function MerchantsPage() {
  const [modalVisible, setModalVisible] = useState(false);
  const [quotaModalVisible, setQuotaModalVisible] = useState(false);
  const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [quotaMerchant, setQuotaMerchant] = useState<Merchant | null>(null);
  const [quotaHistory, setQuotaHistory] = useState<QuotaHistoryItem[]>([]);
  const [form] = Form.useForm<MerchantFormData>();
  const [quotaForm] = Form.useForm<QuotaFormData>();
  const actionRef = useRef<ActionType>(null);

  const statusOptions = [
    { value: 0, label: '禁用', color: 'default' },
    { value: 1, label: '正常', color: 'success' },
    { value: 2, label: '过期', color: 'warning' },
  ];

  const columns: ProColumns<Merchant>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      copyable: true,
      hideInSearch: true,
    },
    {
      title: '商家名称',
      dataIndex: 'store_name',
      copyable: true,
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      hideInSearch: true,
    },
    {
      title: '配额',
      dataIndex: 'quota',
      hideInSearch: true,
      width: 200,
      render: (_, record) => {
        const percent = record.quota_total > 0 ? (record.quota_used / record.quota_total) * 100 : 0;
        const status = percent >= 90 ? 'exception' : percent >= 70 ? 'normal' : 'success';
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Text style={{ fontSize: 12 }}>
              {record.quota_used} / {record.quota_total} (剩余: {record.quota_remaining})
            </Text>
            <Progress percent={percent} size="small" status={status} showInfo={false} />
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        0: { text: '禁用', status: 'Default' },
        1: { text: '正常', status: 'Success' },
        2: { text: '过期', status: 'Warning' },
      },
      width: 100,
      render: (_, record) => {
        const option = statusOptions.find(o => o.value === record.status);
        return <Tag color={option?.color || 'default'}>{option?.label || record.status}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 350,
      render: (_, record) => [
        <Tooltip key="status" title={record.status === 1 ? '点击禁用' : '点击启用'}>
          <Switch
            checked={record.status === 1}
            onChange={() => handleToggleStatus(record)}
            checkedChildren={<CheckCircleOutlined />}
            unCheckedChildren={<StopOutlined />}
          />
        </Tooltip>,
        <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>,
        <Button key="quota" type="link" icon={<SettingOutlined />} onClick={() => handleQuota(record)}>
          配额
        </Button>,
        <Button key="history" type="link" icon={<HistoryOutlined />} onClick={() => handleHistory(record)}>
          历史
        </Button>,
        <Popconfirm
          key="delete"
          title="确定要删除此商家吗？"
          onConfirm={() => handleDelete(record)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>,
      ],
    },
  ];

  const handleAdd = () => {
    setEditingMerchant(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    form.setFieldsValue({ 
      store_name: merchant.store_name, 
      username: merchant.username, 
      phone: merchant.phone 
    });
    setModalVisible(true);
  };

  const handleQuota = (merchant: Merchant) => {
    setQuotaMerchant(merchant);
    quotaForm.setFieldsValue({ quota_total: merchant.quota_total, reason: '' });
    setQuotaModalVisible(true);
  };

  const handleHistory = async (merchant: Merchant) => {
    setQuotaMerchant(merchant);
    setHistoryDrawerVisible(true);
    try {
      const history = await merchantApi.getQuotaHistory(merchant.id, 30);
      setQuotaHistory(history);
    } catch {
      message.error('获取历史记录失败');
    }
  };

  const handleDelete = async (merchant: Merchant) => {
    try {
      await merchantApi.delete(merchant.id);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleSubmit = async (values: MerchantFormData) => {
    try {
      if (editingMerchant) {
        await merchantApi.update(editingMerchant.id, values);
        message.success('更新成功');
      } else {
        await merchantApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || (editingMerchant ? '更新失败' : '创建失败'));
    }
  };

  const handleQuotaSubmit = async (values: QuotaFormData) => {
    if (!quotaMerchant) return;
    try {
      await merchantApi.adjustQuota(quotaMerchant.id, values.quota_total, values.reason);
      message.success('配额调整成功');
      setQuotaModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '配额调整失败');
    }
  };

  const handleResetQuota = async () => {
    if (!quotaMerchant) return;
    try {
      await merchantApi.resetQuota(quotaMerchant.id, '管理员手动重置');
      message.success('配额重置成功');
      setQuotaModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '配额重置失败');
    }
  };

  const handleToggleStatus = async (merchant: Merchant) => {
    const newStatus = merchant.status === 1 ? 0 : 1;
    const statusText = newStatus === 1 ? '启用' : '禁用';
    try {
      await merchantApi.update(merchant.id, { status: newStatus });
      message.success(`已${statusText}商家`);
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || `${statusText}失败`);
    }
  };

  return (
    <div>
      <ProTable<Merchant>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          try {
            const res = await merchantApi.list({
              page: params.current,
              page_size: params.pageSize,
              search: params.store_name,
              status: params.status,
            });
            return {
              data: res.items as Merchant[],
              total: res.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        search={{ labelWidth: 'auto' }}
        options={{ reload: true, density: true, setting: true }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建商家
          </Button>,
        ]}
      />

      {/* 编辑商家弹窗 */}
      <Modal
        title={editingMerchant ? '编辑商家' : '新建商家'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input placeholder="请输入用户名" disabled={!!editingMerchant} />
          </Form.Item>
          <Form.Item name="store_name" label="商家名称" rules={[{ required: true }]}>
            <Input placeholder="请输入商家名称" />
          </Form.Item>
          <Form.Item name="phone" label="联系电话" rules={[{ required: true, pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }]}>
            <Input placeholder="请输入联系电话" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 配额管理弹窗 */}
      <Modal
        title={`配额管理 - ${quotaMerchant?.store_name || quotaMerchant?.username || ''}`}
        open={quotaModalVisible}
        onCancel={() => setQuotaModalVisible(false)}
        onOk={() => quotaForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        {quotaMerchant && (
          <Descriptions column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="当前总配额">{quotaMerchant.quota_total}</Descriptions.Item>
            <Descriptions.Item label="已使用">{quotaMerchant.quota_used}</Descriptions.Item>
            <Descriptions.Item label="剩余">{quotaMerchant.quota_remaining}</Descriptions.Item>
            <Descriptions.Item label="重置日期">
              {quotaMerchant.quota_reset_at || '未设置'}
            </Descriptions.Item>
          </Descriptions>
        )}
        <Form form={quotaForm} layout="vertical" onFinish={handleQuotaSubmit}>
          <Form.Item name="quota_total" label="新总配额" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入新的总配额" />
          </Form.Item>
          <Form.Item name="reason" label="调整原因">
            <Input.TextArea rows={2} placeholder="请输入调整原因（可选）" />
          </Form.Item>
        </Form>
        <Space style={{ marginTop: 16 }}>
          <Popconfirm
            title="确定要重置配额吗？这将清零已使用配额。"
            onConfirm={handleResetQuota}
            okText="确定"
            cancelText="取消"
          >
            <Button danger>重置配额</Button>
          </Popconfirm>
        </Space>
      </Modal>

      {/* 配额历史抽屉 */}
      <Drawer
        title={`配额变更历史 - ${quotaMerchant?.store_name || quotaMerchant?.username || ''}`}
        open={historyDrawerVisible}
        onClose={() => setHistoryDrawerVisible(false)}
        width={500}
      >
        <List
          dataSource={quotaHistory}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag color={item.change_type === 'reset' ? 'purple' : 'orange'}>
                      {item.change_type === 'reset' ? '重置' : '调整'}
                    </Tag>
                    <Text>
                      {item.old_total} → {item.new_total} (已用: {item.old_used} → {item.new_used})
                    </Text>
                  </Space>
                }
                description={
                  <Space direction="vertical" size={0}>
                    <Text type="secondary">原因: {item.reason || '-'}</Text>
                    <Text type="secondary">
                      操作人: {item.operator_name || '系统'} | 
                      时间: {new Date(item.created_at).toLocaleString()}
                    </Text>
                  </Space>
                }
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无历史记录' }}
        />
      </Drawer>
    </div>
  );
}