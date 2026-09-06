import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, Modal, Image, Tag, Space, App, Switch, Tooltip } from 'antd';
import { EyeOutlined, DeleteOutlined, EyeInvisibleOutlined, PictureOutlined } from '@ant-design/icons';
import { useState, useRef } from 'react';
import type { TryOnRecord } from '../types';
import { tryonApi } from '../api';

export default function TryOnRecordsPage() {
  const { message, modal } = App.useApp();
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<TryOnRecord | null>(null);
  const [showImages, setShowImages] = useState(false); // 默认隐藏图片
  const actionRef = useRef<ActionType>(null);

  // 图片占位符组件
  const ImagePlaceholder = ({ title }: { title: string }) => (
    <Tooltip title={`${title}（已隐藏，开启"显示图片"查看）`}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 4,
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 20,
        }}
      >
        <EyeInvisibleOutlined />
      </div>
    </Tooltip>
  );

  const columns: ProColumns<TryOnRecord>[] = [
    {
      title: '商户名称',
      dataIndex: 'merchant_name',
      hideInSearch: true,
      width: 150,
      render: (_, record) => record.merchant_name || `商户${record.merchant_id}`,
    },
    {
      title: '原图',
      dataIndex: 'avatar_url',
      hideInSearch: true,
      width: 100,
      render: (_, record) =>
        record.avatar_url ? (
          showImages ? (
            <Image src={record.avatar_url} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} />
          ) : (
            <ImagePlaceholder title="原图" />
          )
        ) : (
          '-'
        ),
    },
    {
      title: '结果图',
      dataIndex: 'result_url',
      hideInSearch: true,
      width: 100,
      render: (_, record) =>
        record.result_url ? (
          showImages ? (
            <Image src={record.result_url} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} />
          ) : (
            <ImagePlaceholder title="结果图" />
          )
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {
        pending: { text: '等待中', status: 'Default' },
        processing: { text: '处理中', status: 'Processing' },
        completed: { text: '已完成', status: 'Success' },
        failed: { text: '失败', status: 'Error' },
      },
      render: (_, record) => {
        const colorMap: Record<string, string> = {
          pending: 'default',
          processing: 'processing',
          completed: 'success',
          failed: 'error',
        };
        const textMap: Record<string, string> = {
          pending: '等待中',
          processing: '处理中',
          completed: '已完成',
          failed: '生成失败',
        };
        // 后端 status 为语义字符串，status_text 为中文文案，两者都兜底避免显示原始枚举值
        return (
          <Tag color={colorMap[record.status] || 'default'}>
            {textMap[record.status] || record.status_text || record.status}
          </Tag>
        );
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
      width: 150,
      render: (_, record) => [
        <Button key="view" type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
          详情
        </Button>,
        <Button key="delete" type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
          删除
        </Button>,
      ],
    },
  ];

  const handleViewDetail = (record: TryOnRecord) => {
    setCurrentRecord(record);
    setDetailVisible(true);
  };

  const handleDelete = (record: TryOnRecord) => {
    modal.confirm({
      title: '确认删除',
      content: '确定要删除该试穿记录吗？',
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await tryonApi.deleteRecord(record.id);
          message.success('删除成功');
          actionRef.current?.reload();
        } catch (error) {
          const err = error as { response?: { data?: { message?: string } } };
          message.error(err.response?.data?.message || '删除失败');
        }
      },
    });
  };

  return (
    <div>
      <ProTable<TryOnRecord>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          try {
            const res = await tryonApi.listRecords({
              page: params.current,
              page_size: params.pageSize,
              status: params.status,
            });
            return {
              data: res.items as TryOnRecord[],
              total: res.total,
              success: true,
            };
          } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err.response?.data?.message || '获取试穿记录失败');
            return { data: [], total: 0, success: false };
          }
        }}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        search={{ labelWidth: 'auto' }}
        options={{ reload: true, density: true, setting: true }}
        toolBarRender={() => [
          <Space key="image-toggle">
            <PictureOutlined style={{ color: '#666' }} />
            <span style={{ color: '#666', fontSize: 14 }}>显示图片</span>
            <Switch
              checked={showImages}
              onChange={setShowImages}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>,
        ]}
      />

      <Modal
        title="试穿记录详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {currentRecord && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <strong>商户名称：</strong>
              {currentRecord.merchant_name || `商户${currentRecord.merchant_id}`}
            </div>
            <div>
              <strong>状态：</strong>
              <Tag color={currentRecord.status === 'completed' ? 'success' : 'default'}>{currentRecord.status}</Tag>
            </div>
            <div>
              <strong>原图：</strong>
              {currentRecord.avatar_url ? (
                showImages ? (
                  <Image src={currentRecord.avatar_url} width={200} style={{ borderRadius: 8 }} />
                ) : (
                  <Tooltip title="点击开启图片显示">
                    <div
                      onClick={() => setShowImages(true)}
                      style={{
                        width: 200,
                        height: 150,
                        borderRadius: 8,
                        background: '#f5f5f5',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                        cursor: 'pointer',
                        border: '1px dashed #d9d9d9',
                      }}
                    >
                      <Space direction="vertical" align="center">
                        <EyeInvisibleOutlined style={{ fontSize: 32 }} />
                        <span>点击显示图片</span>
                      </Space>
                    </div>
                  </Tooltip>
                )
              ) : (
                '无'
              )}
            </div>
            <div>
              <strong>结果图：</strong>
              {currentRecord.result_url ? (
                showImages ? (
                  <Image src={currentRecord.result_url} width={200} style={{ borderRadius: 8 }} />
                ) : (
                  <Tooltip title="点击开启图片显示">
                    <div
                      onClick={() => setShowImages(true)}
                      style={{
                        width: 200,
                        height: 150,
                        borderRadius: 8,
                        background: '#f5f5f5',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#999',
                        cursor: 'pointer',
                        border: '1px dashed #d9d9d9',
                      }}
                    >
                      <Space direction="vertical" align="center">
                        <EyeInvisibleOutlined style={{ fontSize: 32 }} />
                        <span>点击显示图片</span>
                      </Space>
                    </div>
                  </Tooltip>
                )
              ) : (
                '无'
              )}
            </div>
            <div>
              <strong>创建时间：</strong>
              {currentRecord.created_at}
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}