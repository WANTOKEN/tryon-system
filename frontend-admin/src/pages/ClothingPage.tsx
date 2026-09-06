import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, Modal, Form, Input, InputNumber, App, Tag, Image, Switch, Select, Upload, Radio, Space, Tooltip, Progress } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, LinkOutlined, EyeInvisibleOutlined, PictureOutlined, CloudUploadOutlined, CheckCircleOutlined, CloseCircleOutlined, FileImageOutlined } from '@ant-design/icons';
import { useState, useRef, useEffect } from 'react';
import type { Clothing } from '../types';
import { clothingApi } from '../api';
import api from '../api';

/** 图片来源类型：本地上传 或 URL 输入 */
type ImageSourceType = 'upload' | 'url';

/** 服装表单数据（字段与后端 ClothingCreate/ClothingUpdate 严格对齐） */
interface ClothingFormData {
  name: string;
  image_url: string;
  category: string;
  color: string;
  price: number;
  size: string;
  is_active: boolean;
}

// 文件上传限制常量
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 最大 30MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif'];
const MAX_NAME_LENGTH = 30; // 文件名最大显示长度

/** 截断过长的文件名，保留扩展名 */
function truncateFileName(fileName: string, maxLength: number = MAX_NAME_LENGTH): string {
  if (!fileName || fileName.length <= maxLength) {
    return fileName;
  }
  const extIndex = fileName.lastIndexOf('.');
  if (extIndex === -1 || extIndex === 0) {
    return `${fileName.substring(0, maxLength - 3)}...`;
  }
  const extension = fileName.substring(extIndex);
  const nameWithoutExt = fileName.substring(0, extIndex);
  const truncatedName = `${nameWithoutExt.substring(0, maxLength - extension.length - 3)}...`;
  return truncatedName + extension;
}

/** 校验文件大小和格式 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `文件大小超过限制（最大 30MB），当前 ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB` };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return { valid: false, error: `不支持的文件格式：${ext || '未知'}，仅支持 JPG、PNG、WebP、GIF、HEIC、HEIF` };
    }
  }
  
  return { valid: true };
}

/**
 * 提取图片主色调
 * 通过 Canvas 缩小采样后统计像素颜色分布，返回主色调十六进制值
 * 超时后返回默认黑色 #000000
 */
const extractDominantColor = (file: File, timeout: number = 500): Promise<string> =>
  new Promise(resolve => {
    const timer = setTimeout(() => resolve('#000000'), timeout);

    const reader = new FileReader();
    reader.onload = e => {
      const img = document.createElement('img') as HTMLImageElement;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const size = 20;
          canvas.width = size;
          canvas.height = size;
          if (!ctx) {
            clearTimeout(timer);
            resolve('#000000');
            return;
          }
          ctx.drawImage(img, 0, 0, size, size);

          const data = ctx.getImageData(0, 0, size, size).data;
          const colorCounts: Record<number, number> = {};
          let maxCount = 0;
          let dominantColor = '#000000';

          for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 200) continue;

            const brightness = (r + g + b) / 3;
            if (brightness > 245 || brightness < 10) continue;

            const key = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5);
            colorCounts[key] = (colorCounts[key] || 0) + 1;

            if (colorCounts[key] > maxCount) {
              maxCount = colorCounts[key];
              const rHex = Math.min(255, r).toString(16).padStart(2, '0');
              const gHex = Math.min(255, g).toString(16).padStart(2, '0');
              const bHex = Math.min(255, b).toString(16).padStart(2, '0');
              dominantColor = `#${rHex}${gHex}${bHex}`;
            }
          }

          clearTimeout(timer);
          resolve(dominantColor);
        } catch {
          clearTimeout(timer);
          resolve('#000000');
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve('#000000');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      clearTimeout(timer);
      resolve('#000000');
    };
    reader.readAsDataURL(file);
  });

// 缩略 ID 显示（过长时保留首尾8位）
const truncateId = (id: string | undefined) => {
  if (!id) return '-';
  return id.length > 16 ? `${id.substring(0, 8)}...${id.substring(id.length - 8)}` : id;
};

// 系统颜色名兜底表（与后端 COLOR_TAGS / react 端 FALLBACK_COLOR_TAGS 一致）
const FALLBACK_COLOR_TAGS: Array<{ name: string; hex: string }> = [
  { name: '黑色', hex: '#111827' },
  { name: '白色', hex: '#F9FAFB' },
  { name: '灰色', hex: '#9CA3AF' },
  { name: '米色', hex: '#E7DCC9' },
  { name: '卡其色', hex: '#C3B091' },
  { name: '棕色', hex: '#92400E' },
  { name: '红色', hex: '#DC2626' },
  { name: '粉色', hex: '#EC4899' },
  { name: '橙色', hex: '#EA580C' },
  { name: '黄色', hex: '#FACC15' },
  { name: '绿色', hex: '#16A34A' },
  { name: '蓝色', hex: '#2563EB' },
  { name: '牛仔蓝', hex: '#1E3A8A' },
  { name: '紫色', hex: '#7C3AED' },
];

// 颜色名缓存（name+hex 对照表），首次从后端 /common/colors/ 拉取，失败回落本地兜底
let COLOR_TAGS_CACHE: Array<{ name: string; hex: string }> | null = null;

const loadColorTags = async () => {
  if (COLOR_TAGS_CACHE) return COLOR_TAGS_CACHE;
  try {
    const { data } = await api.get('/common/colors/');
    const items = data?.items || data?.data?.items || data;
    if (Array.isArray(items) && items.length) {
      COLOR_TAGS_CACHE = items;
      return COLOR_TAGS_CACHE;
    }
  } catch {
    /* 忽略，回落兜底表 */
  }
  COLOR_TAGS_CACHE = FALLBACK_COLOR_TAGS;
  return COLOR_TAGS_CACHE;
};

const hexToRgb = (hex: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * 将十六进制主色调转换为系统颜色名（最近邻匹配）。
 * 匹配不到时返回 null，调用方据此「不传 color 字段」，绝不直接传 hex。
 */
const hexToColorName = async (hex: string): Promise<string | null> => {
  const tags = await loadColorTags();
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const tag of tags) {
    const t = hexToRgb(tag.hex);
    if (!t) continue;
    const dist = (rgb[0] - t[0]) ** 2 + (rgb[1] - t[1]) ** 2 + (rgb[2] - t[2]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = tag.name;
    }
  }
  return best;
};

export default function ClothingPage() {
  const { message, modal } = App.useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingClothing, setEditingClothing] = useState<Clothing | null>(null);
  const [form] = Form.useForm<ClothingFormData>();
  const actionRef = useRef<ActionType>(null);
  
  const [imageSource, setImageSource] = useState<ImageSourceType>('upload');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [showImages, setShowImages] = useState(false);

  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [batchFiles, setBatchFiles] = useState<UploadFile[]>([]);
  const [batchCategory, setBatchCategory] = useState<string>('tops');
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<Array<{ name: string; status: 'success' | 'error'; message?: string }>>([]);

  // 分类数据（从后端获取）
  const [categories, setCategories] = useState<Array<{
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string }>;
  }>>([]);

  // 动态获取分类选项
  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name,
  }));

  // 加载分类数据（接口异常或返回结构异常时保持空数组，绝不把非数组塞进 state）
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await clothingApi.getCategories();
        setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('加载分类失败:', error);
        setCategories([]);
      }
    };
    loadCategories();
  }, []);

  // 图片占位符组件
  const ImagePlaceholder = ({ color }: { color?: string }) => (
    <Tooltip title={showImages ? '暂无图片' : '预览图（已隐藏，开启"显示图片"查看）'}>
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: 6,
          background: color || '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#999',
          fontSize: 18,
          border: '1px solid #e8e8e8',
        }}
      >
        {showImages ? <FileImageOutlined /> : <EyeInvisibleOutlined />}
      </div>
    </Tooltip>
  );

  const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
    tops: '上装',
    bottoms: '下装',
    dresses: '连衣裙',
    outerwear: '外套',
    shoes: '鞋',
    accessories: '配饰',
  };

  const getCategoryName = (categoryId: string) => {
    if (categories.length > 0) {
      const category = categories.find(cat => cat.id === categoryId);
      return category?.name || DEFAULT_CATEGORY_NAMES[categoryId] || categoryId;
    }
    return DEFAULT_CATEGORY_NAMES[categoryId] || categoryId;
  };

  const columns: ProColumns<Clothing>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 120,
      hideInSearch: true,
      ellipsis: true,
      render: (text) => <span title={(text as string) || ''}>{truncateId(text as string)}</span>,
    },
    {
      title: '服装名称',
      dataIndex: 'name',
      copyable: true,
      width: 150,
      ellipsis: true,
    },
    {
      title: '预览图',
      dataIndex: 'image_url',
      hideInSearch: true,
      width: 80,
      align: 'center',
      fixed: 'left',
      render: (_, record) => {
        const imageUrl = record.thumb_url || record.image_url;
        const hasImage = !!imageUrl;
        return hasImage && showImages ? (
          <Image
            src={imageUrl}
            width={56}
            height={56}
            style={{ objectFit: 'cover', borderRadius: 6, border: '1px solid #e8e8e8' }}
            fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'%3E%3Crect fill='%23f0f0f0' width='56' height='56' rx='6'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='14' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3E?%3C/text%3E%3C/svg%3E"
          />
        ) : (
          <ImagePlaceholder color={record.color} />
        );
      }
    },
    {
      title: '分类',
      dataIndex: 'category',
      valueType: 'select',
      valueEnum: Object.fromEntries(
        categories.map(cat => [cat.id, { text: cat.name, status: 'Success' }])
      ),
      width: 90,
      align: 'center',
      render: (_, record) => (
        <Tag color="blue">
          {getCategoryName(record.category)}
        </Tag>
      ),
    },
    {
      title: '颜色',
      dataIndex: 'color',
      hideInSearch: true,
      width: 80,
      align: 'center',
      render: (text) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              backgroundColor: (text as string) || '#000000',
              border: '1px solid #e8e8e8',
            }}
          />
          <span style={{ fontSize: 12, color: '#666' }}>{(text as string) || '-'}</span>
        </div>
      ),
    },
    {
      title: '价格',
      dataIndex: 'price',
      hideInSearch: true,
      width: 100,
      align: 'right',
      render: (_, record) => {
        const price = record.price || 0;
        return price > 0 ? (
          <span style={{ fontWeight: 500 }}>¥{Number(price).toFixed(2)}</span>
        ) : (
          <span style={{ color: '#999' }}>未定价</span>
        );
      },
    },
    {
      title: '来源',
      dataIndex: 'source',
      hideInSearch: true,
      width: 90,
      align: 'center',
      render: (_, record) => (
        <Tag color={record.source === 'preset' ? 'purple' : 'green'}>
          {record.source === 'preset' ? '预设' : '衣橱'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      valueType: 'select',
      valueEnum: {
        true: { text: '启用', status: 'Success' },
        false: { text: '禁用', status: 'Default' },
      },
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '启用' : '禁用'}
        </Tag>
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
      width: 120,
      fixed: 'right',
      render: (_, record) => [
        <Button 
          key="edit" 
          type="link" 
          icon={<EditOutlined />} 
          onClick={() => handleEdit(record)}
          style={{ padding: 0, marginRight: 8 }}
        >
          编辑
        </Button>,
        <Button 
          key="delete" 
          type="link" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => handleDelete(record)}
          style={{ padding: 0 }}
        >
          删除
        </Button>,
      ],
    },
  ];

  // 表单初始值：由 Modal 内的 Form 通过 initialValues + key 重挂载消费，
  // 避免在 Form 尚未挂载时调用 form.setFieldsValue（会触发 useForm 未连接告警）
  const initialFormValues: Partial<ClothingFormData> = editingClothing
    ? {
        name: editingClothing.name,
        image_url: editingClothing.image_url,
        category: editingClothing.category,
        color: editingClothing.color || '#000000',
        price: editingClothing.price || 0,
        is_active: editingClothing.is_active,
      }
    : {
        is_active: true,
        color: '#000000',
        price: 0,
      };

  const handleAdd = () => {
    setEditingClothing(null);
    setImageSource('upload');
    setFileList([]);
    setModalVisible(true);
  };

  const handleEdit = (clothing: Clothing) => {
    setEditingClothing(clothing);
    // 编辑模式下默认使用URL方式，但允许用户切换到上传
    setImageSource(clothing.image_url ? 'url' : 'upload');
    setFileList([]);
    setModalVisible(true);
  };

  const handleDelete = (clothing: Clothing) => {
    modal.confirm({
      title: '确认删除',
      content: `确定要删除服装 "${clothing.name}" 吗？此操作不可恢复。`,
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await clothingApi.deleteClothing(clothing.id);
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
      
      if (imageSource === 'upload') {
        // 上传图片模式（新建和编辑都支持）
        if (fileList.length === 0 || !fileList[0].originFileObj) {
          message.error('请选择要上传的图片');
          setUploading(false);
          return;
        }
        
        const file = fileList[0].originFileObj;
        const validation = validateFile(file);
        if (!validation.valid) {
          message.error(validation.error);
          setUploading(false);
          return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', values.name);
        formData.append('category', values.category || 'tops');

        // 颜色：取表单值或主色调，统一转为系统颜色名；匹配不到则不传（绝不直接传 hex）
        const dominantColor = await extractDominantColor(file);
        const colorName = await hexToColorName(values.color || dominantColor);
        if (colorName) {
          formData.append('color', colorName);
        }

        if (values.price && values.price > 0) {
          formData.append('price', values.price.toString());
        }

        if (editingClothing) {
          // 编辑模式：两步 —— 先上传新图（创建带图记录），再把图与字段同步到原记录
          const created = await clothingApi.uploadClothing(formData);
          await clothingApi.updateClothing(editingClothing.id, {
            ...values,
            image_url: created.image_url,
            thumb_url: created.thumb_url,
          });
          message.success('更新成功');
        } else {
          // 新建模式上传图片
          await clothingApi.uploadClothing(formData);
          message.success('上传成功');
        }
      } else {
        // URL模式
        if (editingClothing) {
          await clothingApi.updateClothing(editingClothing.id, {
            ...values,
          });
          message.success('更新成功');
        } else {
          await clothingApi.createClothing({
            ...values,
          });
          message.success('创建成功');
        }
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

  const handleBatchUpload = () => {
    setBatchModalVisible(true);
    setBatchFiles([]);
    setBatchCategory('tops');
    setBatchResults([]);
  };

  /**
   * 批量上传服装图片
   * 使用并发控制（最多3个同时上传），提高上传效率同时避免服务器过载
   */
  const handleBatchSubmit = async () => {
    if (batchFiles.length === 0) {
      message.error('请选择要上传的图片');
      return;
    }

    // 验证所有文件
    const invalidFiles = batchFiles.filter(f => {
      if (!f.originFileObj) return true;
      const validation = validateFile(f.originFileObj);
      return !validation.valid;
    });
    
    if (invalidFiles.length > 0) {
      const firstInvalid = invalidFiles[0];
      if (firstInvalid.originFileObj) {
        const validation = validateFile(firstInvalid.originFileObj);
        message.error(`${firstInvalid.name}: ${validation.error}`);
      } else {
        message.error(`${firstInvalid.name}: 文件无效`);
      }
      return;
    }

    setBatchUploading(true);
    setBatchProgress({ current: 0, total: batchFiles.length });
    setBatchResults([]);

    const results: Array<{ name: string; status: 'success' | 'error'; message?: string }> = [];
    const BATCH_CONCURRENCY = 3; // 并发上传数量限制

    /**
     * 上传单个文件的异步任务
     */
    const uploadSingleFile = async (file: UploadFile) => {
      if (!file.originFileObj) {
        return { name: file.name, status: 'error' as const, message: '文件无效' };
      }

      try {
        const formData = new FormData();
        formData.append('file', file.originFileObj);
        const name = truncateFileName(file.name.replace(/\.[^.]+$/, ''));
        formData.append('name', name);
        formData.append('category', batchCategory);

        const dominantColor = await extractDominantColor(file.originFileObj);
        const colorName = await hexToColorName(dominantColor);
        if (colorName) {
          formData.append('color', colorName);
        }

        await clothingApi.uploadClothing(formData);
        return { name: file.name, status: 'success' as const };
      } catch (error) {
        const err = error as { response?: { data?: { message?: string } } };
        return { name: file.name, status: 'error' as const, message: err.response?.data?.message || '上传失败' };
      }
    };

    // 使用并发控制进行批量上传
    let completedCount = 0;
    for (let i = 0; i < batchFiles.length; i += BATCH_CONCURRENCY) {
      const batch = batchFiles.slice(i, i + BATCH_CONCURRENCY);
      const batchResults = await Promise.all(batch.map(file => uploadSingleFile(file)));
      results.push(...batchResults);
      completedCount += batch.length;
      setBatchProgress({ current: completedCount, total: batchFiles.length });
    }

    setBatchResults(results);
    setBatchUploading(false);
    actionRef.current?.reload();

    const successCount = results.filter(r => r.status === 'success').length;
    if (successCount === batchFiles.length) {
      message.success(`全部上传成功 (${successCount}/${batchFiles.length})`);
      setBatchFiles([]);
      setBatchResults([]);
      setBatchModalVisible(false);
    } else {
      message.warning(`上传完成：成功 ${successCount}，失败 ${batchFiles.length - successCount}`);
      setBatchFiles([]);
    }
  };

  const handleBatchModalClose = () => {
    if (!batchUploading) {
      setBatchModalVisible(false);
      setBatchFiles([]);
      setBatchResults([]);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <ProTable<Clothing>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          try {
            const res = await clothingApi.list({
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
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        search={{ 
          labelWidth: 'auto',
          collapsed: false,
        }}
        options={{ 
          reload: true, 
          density: true, 
          setting: true,
        }}
        toolBarRender={() => [
          <Space key="image-toggle" size="middle">
            <PictureOutlined style={{ color: '#666' }} />
            <span style={{ color: '#666', fontSize: 14 }}>显示图片</span>
            <Switch
              checked={showImages}
              onChange={setShowImages}
              checkedChildren="开"
              unCheckedChildren="关"
            />
          </Space>,
          <Button key="batch" icon={<CloudUploadOutlined />} onClick={handleBatchUpload}>
            批量上传
          </Button>,
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建服装
          </Button>,
        ]}
        scroll={{ x: 'max-content' }}
        bordered
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
          width={620}
          destroyOnHidden
        >
          <Form
            key={editingClothing?.id ?? 'create'}
            form={form}
            layout="vertical"
            initialValues={initialFormValues}
            onFinish={handleSubmit}
          >
            <Form.Item 
              name="name" 
              label="服装名称" 
              rules={[{ required: true, message: '请输入服装名称' }]}
              style={{ marginBottom: 16 }}
            >
              <Input placeholder="请输入服装名称" maxLength={50} />
            </Form.Item>
            
            <Form.Item label="图片来源" style={{ marginBottom: 16 }}>
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
            
            {imageSource === 'upload' ? (
              <Form.Item 
                label="服装图片" 
                rules={[{ required: true, message: '请上传图片' }]}
                style={{ marginBottom: 16 }}
              >
                <Upload
                  listType="picture-card"
                  fileList={fileList}
                  onChange={({ fileList: newFileList }) => setFileList(newFileList)}
                  beforeUpload={() => false}
                  maxCount={1}
                  accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                >
                  {fileList.length === 0 && (
                    <div>
                      <UploadOutlined style={{ fontSize: 24, color: '#999' }} />
                      <div style={{ marginTop: 8, color: '#999' }}>选择图片</div>
                    </div>
                  )}
                </Upload>
                <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
                  支持 JPG、PNG、WebP 格式，最大 30MB
                </div>
                {editingClothing && editingClothing.image_url && (
                  <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fffbe6', borderRadius: 4 }}>
                    <div style={{ color: '#d48806', fontSize: 12 }}>
                      当前图片预览：
                      <Image 
                        src={editingClothing.image_url} 
                        width={60} 
                        height={60} 
                        style={{ marginLeft: 8, objectFit: 'cover', borderRadius: 4, verticalAlign: 'middle' }}
                      />
                    </div>
                  </div>
                )}
              </Form.Item>
            ) : (
              <Form.Item 
                name="image_url" 
                label="图片URL" 
                rules={[{ required: true, message: '请输入图片URL' }]}
                style={{ marginBottom: 16 }}
              >
                <Input placeholder="请输入图片URL" />
                {editingClothing && editingClothing.image_url && (
                  <div style={{ marginTop: 8 }}>
                    <span style={{ color: '#666', fontSize: 12 }}>当前图片预览：</span>
                    <Image 
                      src={editingClothing.image_url} 
                      width={60} 
                      height={60} 
                      style={{ marginLeft: 8, objectFit: 'cover', borderRadius: 4 }}
                    />
                  </div>
                )}
              </Form.Item>
            )}
            
            <Space style={{ width: '100%' }} size="large">
              <Form.Item 
                name="category" 
                label="分类" 
                rules={[{ required: true, message: '请选择分类' }]} 
                style={{ flex: 1 }}
              >
                <Select 
                  options={categoryOptions} 
                  placeholder="请选择分类"
                />
              </Form.Item>
            </Space>
            
            <Space style={{ width: '100%' }} size="large">
              <Form.Item name="price" label="价格" style={{ flex: 1 }}>
                <Space.Compact style={{ width: '100%' }}>
                  <span style={{ paddingLeft: 8 }}>¥</span>
                  <InputNumber
                    min={0}
                    precision={2}
                    placeholder="请输入价格"
                    style={{ width: '100%' }}
                  />
                </Space.Compact>
              </Form.Item>
            </Space>
            
            <Space style={{ width: '100%', alignItems: 'center' }} size="large">
              <Form.Item name="color" label="颜色" style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Input 
                    type="color" 
                    style={{ width: 60, height: 32 }}
                  />
                  <Input 
                    style={{ flex: 1 }}
                    placeholder="颜色值"
                  />
                </div>
              </Form.Item>
              <Form.Item label="启用状态" style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Switch 必须直接作为 Form.Item 的子节点才能被 value/onChange 接管 */}
                  <Form.Item name="is_active" valuePropName="checked" noStyle>
                    <Switch />
                  </Form.Item>
                  {/* 用 shouldUpdate 读取值，避免在 Form 未挂载时页面级读取 form 实例触发 antd 告警 */}
                  <Form.Item shouldUpdate noStyle>
                    {({ getFieldValue }) => (
                      <span>{getFieldValue('is_active') ? '启用' : '禁用'}</span>
                    )}
                  </Form.Item>
                </div>
              </Form.Item>
            </Space>
          </Form>
        </Modal>

        <Modal
          title="批量上传服装"
          open={batchModalVisible}
          onCancel={handleBatchModalClose}
          onOk={handleBatchSubmit}
          okText="开始上传"
          cancelText="取消"
          confirmLoading={batchUploading}
          width={800}
          okButtonProps={{ disabled: batchFiles.length === 0 || batchUploading }}
          destroyOnHidden
        >
          <div style={{ marginBottom: 16 }}>
            <Space size="large">
              <div>
                <span style={{ marginRight: 8, fontSize: 14, color: '#666' }}>统一分类：</span>
                <Select
                  value={batchCategory}
                  onChange={(val) => {
                    setBatchCategory(val);
                  }}
                  options={categoryOptions}
                  style={{ width: 120 }}
                  disabled={batchUploading}
                />
              </div>
            </Space>
          </div>

          <Upload
            multiple
            listType="picture"
            fileList={batchFiles}
            onChange={({ fileList: newFileList }) => setBatchFiles(newFileList)}
            beforeUpload={() => false}
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            disabled={batchUploading}
          >
            <Button icon={<UploadOutlined />} disabled={batchUploading}>
              选择图片（支持多选）
            </Button>
          </Upload>
          <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            支持 JPG、PNG、WebP、GIF、HEIC、HEIF 格式，文件名将作为服装名称
          </div>

          {batchUploading && (
            <div style={{ marginTop: 16 }}>
              <Progress 
                percent={Math.round((batchProgress.current / batchProgress.total) * 100)} 
                status="active"
              />
              <div style={{ textAlign: 'center', color: '#666', marginTop: 8 }}>
                正在上传 {batchProgress.current} / {batchProgress.total}
              </div>
            </div>
          )}

          {batchResults.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>上传结果：</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {batchResults.map((result, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '8px 12px', 
                      borderBottom: '1px solid #f0f0f0',
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.name}
                    </div>
                    {result.status === 'success' ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">成功</Tag>
                    ) : (
                      <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>
                    )}
                    {result.message && (
                      <span style={{ color: '#ff4d4f', fontSize: 12 }}>{result.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      </div>
  );
}
