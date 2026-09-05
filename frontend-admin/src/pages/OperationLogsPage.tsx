import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { Tag, Select, Space, Button } from 'antd';
import { useRef, useState } from 'react';
import type { OperationLog } from '../types';
import { operationLogApi } from '../api';

const actionColors: Record<string, string> = {
  create: 'success',
  update: 'processing',
  delete: 'error',
  login: 'cyan',
  logout: 'default',
  quota_adjust: 'orange',
  quota_reset: 'purple',
  status_change: 'gold',
};

export default function OperationLogsPage() {
  const actionRef = useRef<ActionType>(null);
  const [filterDays, setFilterDays] = useState(7);

  const columns: ProColumns<OperationLog>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '操作人',
      dataIndex: 'operator_username',
      hideInSearch: true,
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      valueType: 'select',
      valueEnum: {
        create: { text: '创建', status: 'Success' },
        update: { text: '更新', status: 'Processing' },
        delete: { text: '删除', status: 'Error' },
        login: { text: '登录', status: 'Default' },
        logout: { text: '登出', status: 'Default' },
        quota_adjust: { text: '配额调整', status: 'Warning' },
        quota_reset: { text: '配额重置', status: 'Success' },
        status_change: { text: '状态变更', status: 'Processing' },
      },
      width: 120,
      render: (_, record) => (
        <Tag color={actionColors[record.action] || 'default'}>
          {record.action_text}
        </Tag>
      ),
    },
    {
      title: '目标类型',
      dataIndex: 'target_type',
      hideInSearch: true,
      width: 120,
    },
    {
      title: '目标ID',
      dataIndex: 'target_id',
      hideInSearch: true,
      width: 100,
    },
    {
      title: '目标名称',
      dataIndex: 'target_name',
      hideInSearch: true,
      ellipsis: true,
    },
    {
      title: '详情',
      dataIndex: 'detail',
      hideInSearch: true,
      width: 200,
      render: (_, record) => {
        const detail = record.detail;
        if (!detail || Object.keys(detail).length === 0) return '-';
        return (
          <span style={{ fontSize: 12, color: '#666' }}>
            {JSON.stringify(detail).slice(0, 50)}...
          </span>
        );
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      hideInSearch: true,
      width: 140,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
      sorter: true,
    },
  ];



  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <span>时间范围：</span>
        <Select
          value={filterDays}
          onChange={(value) => {
            setFilterDays(value);
            actionRef.current?.reload();
          }}
          style={{ width: 120 }}
          options={[
            { value: 1, label: '最近1天' },
            { value: 3, label: '最近3天' },
            { value: 7, label: '最近7天' },
            { value: 30, label: '最近30天' },
            { value: 90, label: '最近90天' },
          ]}
        />
        <Button onClick={() => actionRef.current?.reload()}>刷新</Button>
      </Space>

      <ProTable<OperationLog>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          try {
            const res = await operationLogApi.list({
              page: params.current,
              page_size: params.pageSize,
              action: params.action,
              days: filterDays,
            });
            return {
              data: res.items,
              total: res.total,
              success: true,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        search={{ labelWidth: 'auto' }}
        options={{ reload: true, density: true, setting: true }}
      />
    </div>
  );
}
