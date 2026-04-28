import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Space, Table, Tag, Upload, message, Popconfirm, Modal, Form, InputNumber, Switch, Checkbox, Image, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, UploadOutlined, ArrowUpOutlined, ArrowDownOutlined, EyeOutlined } from '@ant-design/icons';

import type { UploadProps } from 'antd/es/upload/interface';
import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { modelPhotoApi } from '../api';
import type { ModelPhoto } from '../types';
import { PERMISSIONS } from '../types';
import { usePermission } from '../hooks/usePermission';

const ModelPhotosPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ModelPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [form] = Form.useForm();
  const [editingRecord, setEditingRecord] = useState<ModelPhoto | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<{ file: File; url: string } | null>(null);
  const [showImages, setShowImages] = useState(true);
  const actionRef = useRef<ActionType>();

  const { hasPermission } = usePermission();
  const canManage = hasPermission(PERMISSIONS.SUPER_ADMIN) || hasPermission(PERMISSIONS.CLOTHING_MANAGE);

  const fetchData = useCallback(async (params?: { current?: number; pageSize?: number }) => {
    setLoading(true);
    try {
      const result = await modelPhotoApi.list({
        page: params?.current || page,
        page_size: params?.pageSize || pageSize,
        is_active: isActive,
      });
      setData(result.items);
      setTotal(result.total);
      return {
        data: result.items,
        total: result.total,
        success: true,
      };
    } catch (error) {
      message.error('获取模特照片失败');
      console.error('Failed to fetch model photos:', error);
      return { data: [], total: 0, success: false };
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, isActive]);

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

  const handleDelete = async (id: number) => {
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

  const handleBulkActivate = async (activate: boolean) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要操作的模特');
      return;
    }

    try {
      for (const id of selectedRowKeys) {
        await modelPhotoApi.update(id, { is_active: activate });
      }
      message.success(`成功${activate ? '启用' : '禁用'} ${selectedRowKeys.length} 个模特`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (error) {
      message.error('批量操作失败');
      console.error('Failed to update model photos:', error);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);

      const formData = new FormData();
      formData.append('sort_order', values.sort_order?.toString() || '0');
      formData.append('is_active', values.is_active ? 'true' : 'false');

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

  const uploadProps: UploadProps = {
    name: 'image',
    multiple: false,
    showUploadList: false,
    beforeUpload: (file) => {
      const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
      if (!isJpgOrPng) {
        message.error('只能上传 JPG 或 PNG 格式的图片!');
        return false;
      }
      const isLt5M = file.size / 1024 / 1024 < 5;
      if (!isLt5M) {
        message.error('图片大小不能超过 5MB!');
        return false;
      }
      return true;
    },
    onChange: async (info) => {
      if (info.file.status === 'uploading') {
        setUploading(true);
        return;
      }
      if (info.file.status === 'done') {
        const formData = new FormData();
        formData.append('image', info.file.originFileObj!);
        
        try {
          const response = await modelPhotoApi.upload(formData);
          message.success('上传成功');
          actionRef.current?.reload();
        } catch (error) {
          message.error('上传失败');
          console.error('Failed to upload model photo:', error);
        } finally {
          setUploading(false);
        }
      }
    },
  };

  const handleSortOrder = async (id: number, direction: 'up' | 'down') => {
    try {
      const record = data.find(item => item.id === id);
      if (!record) return;

      const currentIndex = data.findIndex(item => item.id === id);
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === data.length - 1) return;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetRecord = data[targetIndex];

      if (targetRecord) {
        // Swap sort orders
        const tempSortOrder = record.sort_order;
        await modelPhotoApi.update(id, { sort_order: targetRecord.sort_order });
        await modelPhotoApi.update(targetRecord.id, { sort_order: tempSortOrder });
        message.success('排序更新成功');
        actionRef.current?.reload();
      }
    } catch (error) {
      message.error('排序更新失败');
      console.error('Failed to update sort order:', error);
    }
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
      render: (_: any, record: ModelPhoto) => (
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
      render: (imageUrl: string) => (
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
              border: '1px solid #d9d9d9', 
              borderRadius: 8, 
              backgroundColor: '#f5f5f5',
            }}>
              <span style={{ color: '#999', fontSize: 12 }}>图片已隐藏</span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 150,
      hideInSearch: true,
      render: (_: any, record: ModelPhoto) => (
        <Space>
          <Tooltip title="上移">
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              onClick={() => handleSortOrder(record.id, 'up')}
              disabled={data.findIndex(item => item.id === record.id) === 0}
            />
          </Tooltip>
          <span style={{ fontWeight: 500 }}>{record.sort_order}</span>
          <Tooltip title="下移">
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={() => handleSortOrder(record.id, 'down')}
              disabled={data.findIndex(item => item.id === record.id) === data.length - 1}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'green' : 'red'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
      ),
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
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
        tableAlertRender={({ selectedRowKeys }) => (
          <span>
            已选择 <a style={{ fontWeight: 600 }}>{selectedRowKeys.length}</a> 项
          </span>
        )}
        tableAlertOptionRender={() => (
          <Space size="middle">
            <Button 
              size="small" 
              onClick={() => handleBulkActivate(true)}
              disabled={!canManage}
            >
              批量启用
            </Button>
            <Button 
              size="small" 
              onClick={() => handleBulkActivate(false)}
              disabled={!canManage}
            >
              批量禁用
            </Button>
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
          initialValues={{
            is_active: true,
            sort_order: 0,
          }}
        >
          <Form.Item
            name="sort_order"
            label="排序"
            rules={[{ required: true, message: '请输入排序' }]}
          >
            <InputNumber placeholder="请输入排序" min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="is_active"
            label="状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
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
                accept="image/jpeg,image/png"
                showUploadList={false}
                beforeUpload={(file) => {
                  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                  if (!isJpgOrPng) {
                    message.error('只能上传 JPG 或 PNG 格式的图片!');
                    return false;
                  }
                  const isLt5M = file.size / 1024 / 1024 < 5;
                  if (!isLt5M) {
                    message.error('图片大小不能超过 5MB!');
                    return false;
                  }
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
                <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
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
