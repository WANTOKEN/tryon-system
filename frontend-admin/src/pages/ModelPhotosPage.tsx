import React, { useState, useCallback, useRef } from 'react';
import { Button, Space, Upload, Popconfirm, Modal, Form, Input, Switch, Checkbox, Image, Tooltip, App, theme } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, EyeOutlined } from '@ant-design/icons';

import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { modelPhotoApi } from '../api';
import type { ModelPhoto } from '../types';
import { PERMISSIONS } from '../types';
import { usePermission } from '../hooks/usePermission';

const ModelPhotosPage: React.FC = () => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState<ModelPhoto | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ file: File; url: string } | null>(null);
  const [showImages, setShowImages] = useState(true);
  const [data, setData] = useState<ModelPhoto[]>([]);
  const [page] = useState(1);
  const [pageSize] = useState(10);
  const actionRef = useRef<ActionType>();

  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSIONS.SUPER_ADMIN) || hasPermission(PERMISSIONS.CLOTHING_MANAGE);

  // 后端已按 created_at 倒序返回，前端不再做排序
  const fetchData = useCallback(async (params?: { current?: number; pageSize?: number }) => {
    try {
      const result = await modelPhotoApi.list({
        page: params?.current || page,
        page_size: params?.pageSize || pageSize,
      });
      setData(result.items);
      return {
        data: result.items,
        total: result.total,
        success: true,
      };
    } catch (error) {
      message.error('获取模特照片失败');
      console.error('Failed to fetch model photos:', error);
      return { data: [], total: 0, success: false };
    }
  }, [page, pageSize]);

  const handleAdd = () => {
    form.resetFields();
    setEditingRecord(null);
    setUploadedImage(null);
    setModalVisible(true);
  };

  const handleEdit = (record: ModelPhoto) => {
    form.setFieldsValue(record);
    setEditingRecord(record);
    setUploadedImage(null);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await modelPhotoApi.delete(id);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      message.error('删除失败');
      console.error('Failed to delete model photo:', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的模特');
      return;
    }

    try {
      for (const id of selectedRowKeys) {
        await modelPhotoApi.delete(id);
      }
      message.success(`成功删除 ${selectedRowKeys.length} 个模特`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error) {
      message.error('批量删除失败');
      console.error('Failed to delete model photos:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);

      const formData = new FormData();
      if (values.name !== undefined && values.name !== null) {
        formData.append('name', values.name);
      }
      if (values.description !== undefined && values.description !== null) {
        formData.append('description', values.description);
      }

      if (uploadedImage?.file) {
        formData.append('image', uploadedImage.file);
      }

      if (editingRecord) {
        await modelPhotoApi.update(editingRecord.id, formData, true);
        message.success('更新成功');
      } else {
        if (!uploadedImage?.file) {
          message.error('请上传模特照片');
          setConfirmLoading(false);
          return;
        }
        await modelPhotoApi.create(formData, true);
        message.success('创建成功');
      }

      setModalVisible(false);
      setUploadedImage(null);
      form.resetFields();
      actionRef.current?.reload();
    } catch (error) {
      console.error('Failed to save model photo:', error);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleImagePreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
    setPreviewVisible(true);
  };

  const columns: ProColumns<ModelPhoto>[] = [
    {
      title: (
        <Checkbox
          indeterminate={selectedRowKeys.length > 0 && selectedRowKeys.length < data.length}
          checked={selectedRowKeys.length === data.length && data.length > 0}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRowKeys(data.map(item => item.id));
            } else {
              setSelectedRowKeys([]);
            }
          }}
        />
      ),
      dataIndex: 'checkbox',
      key: 'checkbox',
      width: 60,
      hideInSearch: true,
      render: (_: unknown, record: ModelPhoto) => (
        <Checkbox
          checked={selectedRowKeys.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRowKeys([...selectedRowKeys, record.id]);
            } else {
              setSelectedRowKeys(selectedRowKeys.filter(id => id !== record.id));
            }
          }}
        />
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '照片',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 120,
      hideInSearch: true,
      render: (_, record: ModelPhoto) => {
        const imageUrl = record.image_url;
        return (
          <div>
            {showImages ? (
              <img 
                src={imageUrl} 
                alt="Model" 
                style={{ 
                  width: 80, 
                  height: 100, 
                  objectFit: 'cover', 
                  borderRadius: 8, 
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
                onClick={() => handleImagePreview(imageUrl)}
              />
            ) : (
              <div style={{ 
                width: 80, 
                height: 100, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                border: `1px solid ${token.colorBorderSecondary}`,
                borderRadius: 8, 
                backgroundColor: token.colorFillQuaternary,
              }}>
                <span style={{ color: token.colorTextTertiary, fontSize: 12 }}>图片已隐藏</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      valueType: 'option',
      width: 180,
      render: (_, record) => [
        <Tooltip key="preview" title="预览">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleImagePreview(record.image_url)}
          />
        </Tooltip>,
        canManage && (
          <Tooltip key="edit" title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
        ),
        canManage && (
          <Popconfirm
            key="delete"
            title="确定要删除吗？"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        ),
      ],
    },
  ];

  return (
    <div>
      <ProTable<ModelPhoto>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          return fetchData({
            current: params.current,
            pageSize: params.pageSize,
          });
        }}
        rowKey="id"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
        }}
        search={{
          labelWidth: 'auto',
          defaultCollapsed: false,
        }}
        options={{
          reload: true,
          density: true,
          setting: true,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        tableAlertRender={({ selectedRowKeys }) => (
          <span>
            已选择 <a style={{ fontWeight: 600 }}>{selectedRowKeys.length}</a> 项
          </span>
        )}
        tableAlertOptionRender={() => (
          <Space size="middle">
            <Popconfirm
              title="确定要删除选中的模特吗？"
              onConfirm={handleBulkDelete}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              disabled={!canManage}
            >
              <Button 
                size="small" 
                danger
                disabled={!canManage}
              >
                批量删除
              </Button>
            </Popconfirm>
            <Button 
              size="small" 
              onClick={() => setSelectedRowKeys([])}
            >
              取消选择
            </Button>
          </Space>
        )}
        toolBarRender={() => [
          canManage && (
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增模特
            </Button>
          ),
          <Space key="show-images" style={{ marginLeft: 'auto' }}>
            <span>显示图片：</span>
            <Switch 
              checked={showImages} 
              onChange={setShowImages} 
              checkedChildren="显示" 
              unCheckedChildren="隐藏" 
            />
          </Space>
        ]}
      />

      <Modal
        title={editingRecord ? '编辑模特' : '新增模特'}
        open={modalVisible}
        onOk={handleSubmit}
        confirmLoading={confirmLoading}
        onCancel={() => {
          setModalVisible(false);
          setUploadedImage(null);
          form.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="name"
            label="模特名称"
          >
            <Input placeholder="请输入模特名称" maxLength={128} allowClear />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入描述" rows={3} maxLength={512} showCount />
          </Form.Item>
          <Form.Item
            label="模特照片"
            required
            validateStatus={!editingRecord && !uploadedImage ? 'error' : 'success'}
            help={!editingRecord && !uploadedImage ? '请上传模特照片' : ''}
          >
            {uploadedImage ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={uploadedImage.url}
                  alt="Uploaded"
                  style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 4 }}
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  onClick={() => setUploadedImage(null)}
                  style={{ position: 'absolute', top: 4, right: 4 }}
                >
                  删除
                </Button>
              </div>
            ) : editingRecord?.image_url ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  src={editingRecord.image_url}
                  alt="Current"
                  style={{ width: 120, height: 160, objectFit: 'cover', borderRadius: 4 }}
                  onClick={() => handleImagePreview(editingRecord.image_url)}
                />
              </div>
            ) : null}
            <div style={{ marginTop: 8 }}>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  setUploadedImage({
                    file,
                    url: URL.createObjectURL(file),
                  });
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>
                  {uploadedImage ? '重新上传' : editingRecord ? '更换照片' : '上传照片'}
                </Button>
              </Upload>
              {editingRecord && (
                <span style={{ marginLeft: 8, color: token.colorTextTertiary, fontSize: 12 }}>
                  （点击图片可预览）
                </span>
              )}
            </div>
          </Form.Item>

        </Form>
      </Modal>

      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => setPreviewVisible(false)}
        width={800}
        centered
        destroyOnHidden
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Image
            src={previewImage || ''}
            alt="Preview"
            style={{ 
              maxWidth: '100%',
              borderRadius: 8,
            }}
            preview={false}
          />
        </div>
      </Modal>
    </div>
  );
};

export default ModelPhotosPage;
