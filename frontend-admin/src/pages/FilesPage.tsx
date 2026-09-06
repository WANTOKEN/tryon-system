import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, Tag, Space, Popconfirm, Statistic, Card, Row, Col, Dropdown, App, theme } from 'antd';
import { DeleteOutlined, UndoOutlined, ReloadOutlined, MoreOutlined } from '@ant-design/icons';
import { useRef, useState, useEffect } from 'react';
import type { FileRecord } from '../types';
import { fileApi } from '../api';
import type { MenuProps } from 'antd';

export default function FilesPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [stats, setStats] = useState<{
    total_files: number;
    total_size: number;
    deleted_files: number;
    deleted_size: number;
    by_category: Array<{ file_category: string; count: number; size: number }>;
  } | null>(null);

  // 加载统计信息
  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await fileApi.stats();
        setStats(data);
      } catch {
        // ignore
      }
    };
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await fileApi.stats();
      setStats(data);
    } catch {
      // ignore
    }
  };

  // 格式化文件大小
  const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
    return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const columns: ProColumns<FileRecord>[] = [
    {
      title: '文件UUID',
      dataIndex: 'uuid',
      width: 280,
      copyable: true,
      ellipsis: true,
      hideInSearch: true,
      tooltip: '对外暴露的业务标识，对应 image_key / FileRecord.uuid',
    },
    {
      title: '文件名',
      dataIndex: 'original_name',
      copyable: true,
      ellipsis: true,
      width: 200,
    },
    {
      title: '访问地址',
      dataIndex: 'access_url',
      width: 240,
      copyable: true,
      ellipsis: true,
      hideInSearch: true,
      render: (_, record) => (
        <a href={record.access_url} target="_blank" rel="noreferrer">
          {record.access_url}
        </a>
      ),
    },
    {
      title: '搜索',
      dataIndex: 'search',
      hideInTable: true,
      fieldProps: { placeholder: '搜索文件名/MD5/租户ID' },
    },
    {
      title: '文件类型',
      dataIndex: 'file_category',
      valueType: 'select',
      valueEnum: {
        avatar: { text: '人物照片', status: 'Processing' },
        clothing: { text: '服装图片', status: 'Success' },
        result: { text: '试穿结果', status: 'Warning' },
        other: { text: '其他', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={
          record.file_category === 'avatar' ? 'blue' :
          record.file_category === 'clothing' ? 'green' :
          record.file_category === 'result' ? 'orange' : 'default'
        }>
          {record.file_category_text || record.file_category}
        </Tag>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      hideInSearch: true,
      width: 100,
      render: (_, record) => formatSize(record.file_size || 0),
    },

    {
      title: '租户ID',
      dataIndex: 'tenant_id',
      width: 100,
      ellipsis: true,
      copyable: true,
    },
    {
      title: '文件夹',
      dataIndex: 'folder',
      valueType: 'select',
      width: 100,
      hideInSearch: true,
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 160,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, record) => {
        const items: MenuProps['items'] = record.is_deleted
          ? [
              { key: 'restore', label: '恢复', icon: <UndoOutlined />, onClick: () => handleBatchAction([record.id], 'restore') },
              { key: 'hard_delete', label: '永久删除', icon: <DeleteOutlined />, danger: true, onClick: () => handleBatchAction([record.id], 'hard_delete') },
            ]
          : [
              { key: 'soft_delete', label: '软删除', icon: <DeleteOutlined />, onClick: () => handleBatchAction([record.id], 'soft_delete') },
            ];

        return [
          <Dropdown key="more" menu={{ items }} trigger={['click']}>
            <Button type="link" icon={<MoreOutlined />}>操作</Button>
          </Dropdown>,
        ];
      },
    },
  ];

  // 批量操作
  const handleBatchAction = (ids: string[], action: 'soft_delete' | 'restore' | 'hard_delete') => {
    const actionText = {
      soft_delete: '软删除',
      restore: '恢复',
      hard_delete: '永久删除',
    };

    const confirmContent = {
      soft_delete: `确定要软删除 ${ids.length} 个文件吗？软删除后可以恢复。`,
      restore: `确定要恢复 ${ids.length} 个文件吗？`,
      hard_delete: `确定要永久删除 ${ids.length} 个文件吗？此操作不可恢复，将同时删除存储文件！`,
    };

    modal.confirm({
      title: `确认${actionText[action]}`,
      content: confirmContent[action],
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: action === 'hard_delete' },
      onOk: async () => {
        try {
          const result = await fileApi.batchAction(ids, action);
          message.success(result.message);
          setSelectedRowKeys([]);
          actionRef.current?.reload();
          loadStats();
        } catch (error) {
          const err = error as { response?: { data?: { message?: string } } };
          message.error(err.response?.data?.message || '操作失败');
        }
      },
    });
  };

  // 清理软删除文件
  const handleCleanup = () => {
    modal.confirm({
      title: '清理软删除文件',
      content: '确定要清理所有 7 天前软删除的文件吗？此操作将永久删除这些文件和存储数据。',
      okText: '确定清理',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await fileApi.cleanupDeleted(7);
          message.success(result.message);
          actionRef.current?.reload();
          loadStats();
        } catch (error) {
          const err = error as { response?: { data?: { message?: string } } };
          message.error(err.response?.data?.message || '清理失败');
        }
      },
    });
  };

  // 批量操作菜单
  const batchMenuItems: MenuProps['items'] = [
    { key: 'soft_delete', label: '软删除', icon: <DeleteOutlined /> },
    { key: 'restore', label: '恢复', icon: <UndoOutlined /> },
    { key: 'hard_delete', label: '永久删除', icon: <DeleteOutlined />, danger: true },
  ];

  const handleBatchMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的文件');
      return;
    }
    handleBatchAction(selectedRowKeys as string[], key as 'soft_delete' | 'restore' | 'hard_delete');
  };

  return (
    <div>
      {/* 统计卡片 */}
      {stats && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col span={4}>
              <Statistic title="总文件数" value={stats.total_files} />
            </Col>
            <Col span={4}>
              <Statistic title="总存储大小" value={formatSize(stats.total_size)} />
            </Col>
            <Col span={4}>
              <Statistic title="已删除文件" value={stats.deleted_files} valueStyle={{ color: token.colorError }} />
            </Col>
            <Col span={4}>
              <Statistic title="已删除大小" value={formatSize(stats.deleted_size)} valueStyle={{ color: token.colorError }} />
            </Col>
            <Col span={8}>
              <Space direction="vertical" size="small">
                <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  存储类型：本地磁盘（/static/uploads）
                </div>
              </Space>
            </Col>
          </Row>
        </Card>
      )}

      <ProTable<FileRecord>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          try {
            const res = await fileApi.list({
              page: params.current,
              page_size: params.pageSize,
              file_category: params.file_category,
              is_deleted: params.is_deleted,
              search: params.search,
            });
            return {
              data: res.items as FileRecord[],
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
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        tableAlertRender={({ selectedRowKeys }) => (
          <Space size="middle">
            <span>已选择 {selectedRowKeys.length} 项</span>
            <Dropdown menu={{ items: batchMenuItems, onClick: handleBatchMenuClick }} trigger={['click']}>
              <Button size="small">批量操作</Button>
            </Dropdown>
          </Space>
        )}
        toolBarRender={() => [
          <Button key="reload" icon={<ReloadOutlined />} onClick={() => { actionRef.current?.reload(); loadStats(); }}>
            刷新
          </Button>,
          <Popconfirm
            key="cleanup"
            title="清理软删除文件"
            description="确定要清理 7 天前软删除的文件吗？"
            onConfirm={handleCleanup}
          >
            <Button danger icon={<DeleteOutlined />}>清理已删除</Button>
          </Popconfirm>,
        ]}
      />
    </div>
  );
}
