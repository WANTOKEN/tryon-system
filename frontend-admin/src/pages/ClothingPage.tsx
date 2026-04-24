import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, message, Tag, Image, Switch, Select, Upload, Radio, Space, Tooltip } from 'antd';
import type { UploadFile } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, LinkOutlined, EyeInvisibleOutlined, PictureOutlined } from '@ant-design/icons';
import { useState, useRef } from 'react';
import type { Clothing } from '../types';
import { tryonApi } from '../api';

// 服装分类选项
const CATEGORY_OPTIONS = [
  { value: 'tops', label: '上装' },
  { value: 'bottoms', label: '下装' },
  { value: 'dresses', label: '连衣裙' },
  { value: 'outerwear', label: '外套' },
  { value: 'shoes', label: '鞋' },
  { value: 'accessories', label: '配饰' },
];

// 子分类选项映射
const SUBCATEGORY_OPTIONS: Record<string, { value: string; label: string }[]> = {
  tops: [
    { value: 't-shirt', label: 'T恤' },
    { value: 'shirt', label: '衬衫' },
    { value: 'sweater', label: '毛衣' },
    { value: 'hoodie', label: '卫衣' },
    { value: 'blouse', label: ' blouse' },
  ],
  bottoms: [
    { value: 'jeans', label: '牛仔裤' },
    { value: 'pants', label: '西裤' },
    { value: 'shorts', label: '短裤' },
    { value: 'skirt', label: '裙子' },
  ],
  dresses: [
    { value: 'casual-dress', label: '休闲连衣裙' },
    { value: 'formal-dress', label: '正式连衣裙' },
    { value: 'maxi-dress', label: '长裙' },
  ],
  outerwear: [
    { value: 'jacket', label: '夹克' },
    { value: 'coat', label: '大衣' },
    { value: 'blazer', label: '西装外套' },
    { value: 'windbreaker', label: '风衣' },
  ],
  shoes: [
    { value: 'sneakers', label: '运动鞋' },
    { value: 'boots', label: '靴子' },
    { value: 'heels', label: '高跟鞋' },
    { value: 'flats', label: '平底鞋' },
  ],
  accessories: [
    { value: 'hat', label: '帽子' },
    { value: 'bag', label: '包' },
    { value: 'scarf', label: '围巾' },
    { value: 'belt', label: '腰带' },
    { value: 'watch', label: '手表' },
  ],
};

type ImageSourceType = 'upload' | 'url';

interface ClothingFormData {
  name: string;
  image_url: string;
  category: string;
  subcategory: string;
  color: string;
  is_active: boolean;
}

export default function ClothingPage() {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClothing, setEditingClothing] = useState<Clothing | null>(null);
  const [form] = Form.useForm<ClothingFormData>();
  const actionRef = useRef<ActionType>(null);
  
  // 图片上传相关状态
  const [imageSource, setImageSource] = useState<ImageSourceType>('upload');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // 图片显示开关（默认隐藏，节省流量）
  const [showImages, setShowImages] = useState(false);

  // 图片占位符组件
  const ImagePlaceholder = () => (
    <Tooltip title='预览图（已隐藏，开启"显示图片"查看）'>
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

  const columns: ProColumns<Clothing>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      hideInSearch: true,
    },
    {
      title: '服装名称',
      dataIndex: 'name',
      copyable: true,
    },
    {
      title: '预览图',
      dataIndex: 'image_url',
      hideInSearch: true,
      width: 100,
      render: (_, record) =>
        record.image_url ? (
          showImages ? (
            <Image src={record.image_url} width={60} height={60} style={{ objectFit: 'cover', borderRadius: 4 }} />
          ) : (
            <ImagePlaceholder />
          )
        ) : (
          '-'
        ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      valueType: 'select',
      valueEnum: {
        tops: { text: '上装' },
        bottoms: { text: '下装' },
        dresses: { text: '连衣裙' },
        outerwear: { text: '外套' },
        shoes: { text: '鞋' },
        accessories: { text: '配饰' },
      },
      render: (_, record) => record.category_text || record.category,
    },
    {
      title: '子分类',
      dataIndex: 'subcategory',
      hideInSearch: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      hideInSearch: true,
      render: (_, record) => (
        <Tag color={record.source === 'preset' ? 'blue' : 'green'}>
          {record.source_text || record.source}
        </Tag>
      ),
    },
    {
      title: '启用状态',
      dataIndex: 'is_active',
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>{record.is_active ? '启用' : '禁用'}</Tag>
      ),
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
        <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>,
        <Button key="delete" type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>
          删除
        </Button>,
      ],
    },
  ];

  const handleAdd = () => {
    setEditingClothing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, color: '#000000' });
    setImageSource('upload');
    setFileList([]);
    setModalVisible(true);
  };

  const handleEdit = (clothing: Clothing) => {
    setEditingClothing(clothing);
    form.setFieldsValue({
      name: clothing.name,
      image_url: clothing.image_url,
      category: clothing.category,
      subcategory: clothing.subcategory,
      color: clothing.color || '#000000',
      is_active: clothing.is_active,
    });
    // 编辑模式默认使用 URL 方式
    setImageSource('url');
    setFileList([]);
    setModalVisible(true);
  };

  const handleDelete = (clothing: Clothing) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除服装 "${clothing.name}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await tryonApi.deleteClothing(clothing.id);
          message.success('删除成功');
          actionRef.current?.reload();
        } catch (error) {
          const err = error as { response?: { data?: { message?: string } } };
          message.error(err.response?.data?.message || '删除失败');
        }
      },
    });
  };

  const handleSubmit = async (values: ClothingFormData) => {
    try {
      setUploading(true);
      
      if (!editingClothing && imageSource === 'upload') {
        // 新建模式 + 上传图片
        if (fileList.length === 0 || !fileList[0].originFileObj) {
          message.error('请选择要上传的图片');
          setUploading(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('image', fileList[0].originFileObj);
        formData.append('name', values.name);
        formData.append('category', values.category || 'tops');
        formData.append('subcategory', values.subcategory || 't-shirt');
        formData.append('color', values.color || '#000000');
        
        await tryonApi.uploadClothing(formData);
        message.success('上传成功');
      } else if (editingClothing) {
        // 编辑模式 - 使用 URL
        await tryonApi.updateClothing(editingClothing.id, values);
        message.success('更新成功');
      } else {
        // 新建模式 + URL
        await tryonApi.createClothing(values);
        message.success('创建成功');
      }
      
      setModalVisible(false);
      setFileList([]);
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '操作失败');
    } finally {
      setUploading(false);
    }
  };

  const handleImageSourceChange = (value: ImageSourceType) => {
    setImageSource(value);
    setFileList([]);
    form.setFieldsValue({ image_url: '' });
  };

  // 获取当前选中分类的子分类选项
  const currentCategory = Form.useWatch('category', form) || 'tops';
  const subcategoryOptions = SUBCATEGORY_OPTIONS[currentCategory] || [];

  return (
    <div>
      <ProTable<Clothing>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          try {
            const res = await tryonApi.listClothing({
              page: params.current,
              page_size: params.pageSize,
              name: params.name,
              category: params.category,
            });
            return {
              data: res.items as Clothing[],
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
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建服装
          </Button>,
        ]}
      />

      <Modal
        title={editingClothing ? '编辑服装' : '新建服装'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setFileList([]);
        }}
        onOk={() => form.submit()}
        okText={editingClothing ? '保存' : (imageSource === 'upload' ? '上传' : '创建')}
        cancelText="取消"
        confirmLoading={uploading}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="服装名称" rules={[{ required: true, message: '请输入服装名称' }]}>
            <Input placeholder="请输入服装名称" />
          </Form.Item>
          
          {!editingClothing && (
            <Form.Item label="图片来源">
              <Radio.Group 
                value={imageSource} 
                onChange={(e) => handleImageSourceChange(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="upload">
                  <UploadOutlined /> 上传图片
                </Radio.Button>
                <Radio.Button value="url">
                  <LinkOutlined /> 图片URL
                </Radio.Button>
              </Radio.Group>
            </Form.Item>
          )}
          
          {imageSource === 'upload' && !editingClothing ? (
            <Form.Item label="服装图片" rules={[{ required: true, message: '请上传图片' }]}>
              <Upload
                listType="picture-card"
                fileList={fileList}
                onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                beforeUpload={() => false}
                maxCount={1}
                accept="image/jpeg,image/png,image/webp"
              >
                {fileList.length === 0 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>选择图片</div>
                  </div>
                )}
              </Upload>
              <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                支持 JPG、PNG、WebP 格式，最大 10MB
              </div>
            </Form.Item>
          ) : (
            <Form.Item 
              name="image_url" 
              label="图片URL" 
              rules={[{ required: true, message: '请输入图片URL' }]}
            >
              <Input placeholder="请输入图片URL" />
            </Form.Item>
          )}
          
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]} style={{ width: 200 }}>
              <Select 
                options={CATEGORY_OPTIONS} 
                placeholder="请选择分类"
                onChange={() => {
                  // 切换分类时重置子分类
                  form.setFieldsValue({ subcategory: undefined });
                }}
              />
            </Form.Item>
            <Form.Item name="subcategory" label="子分类" style={{ width: 200 }}>
              <Select 
                options={subcategoryOptions} 
                placeholder="请选择子分类"
                allowClear
              />
            </Form.Item>
          </Space>
          
          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="color" label="颜色" style={{ width: 200 }}>
              <Input type="color" style={{ width: '100%', height: 32 }} />
            </Form.Item>
            <Form.Item name="is_active" label="启用状态" valuePropName="checked" initialValue={true} style={{ width: 200 }}>
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}