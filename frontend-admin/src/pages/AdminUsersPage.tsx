import { ProTable } from '@ant-design/pro-components';
import type { ProColumns, ActionType } from '@ant-design/pro-components';
import { Button, App, Modal, Form, Input, Tag, Switch, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState, useRef } from 'react';
import type { AdminUserItem } from '../types';
import { adminUserApi } from '../api';

interface AdminUserFormData {
  username: string;
  phone: string;
  password?: string;
  is_superuser?: boolean;
  store_name?: string;
}

export default function AdminUsersPage() {
  const { message } = App.useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [form] = Form.useForm<AdminUserFormData>();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<AdminUserItem>[] = [
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
      title: '搜索',
      dataIndex: 'search',
      hideInTable: true,
      fieldProps: { placeholder: '搜索用户名' },
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      hideInSearch: true,
    },
    {
      title: '显示名称',
      dataIndex: 'store_name',
      hideInSearch: true,
    },
    {
      title: '超级管理员',
      dataIndex: 'is_superuser',
      hideInSearch: true,
      width: 100,
      render: (_, record) => (
        <Tag color={record.is_superuser ? 'red' : 'blue'}>
          {record.is_superuser ? '是' : '否'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      hideInSearch: true,
      width: 80,
      render: (_, record) => (
        <Tag color={record.is_active ? 'success' : 'default'}>
          {record.is_active ? '正常' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      valueType: 'dateTime',
      hideInSearch: true,
      width: 180,
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
        <Popconfirm
          key="delete"
          title="确定要删除此管理员吗？"
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
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (user: AdminUserItem) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      phone: user.phone,
      store_name: user.store_name,
      is_superuser: user.is_superuser,
    });
    setModalVisible(true);
  };

  const handleDelete = async (user: AdminUserItem) => {
    try {
      await adminUserApi.delete(user.id);
      message.success('删除成功');
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const handleSubmit = async (values: AdminUserFormData) => {
    try {
      if (editingUser) {
        const updateData: Partial<AdminUserItem> & { password?: string } = {
          phone: values.phone,
          store_name: values.store_name,
          is_superuser: values.is_superuser,
        };
        if (values.password) {
          updateData.password = values.password;
        }
        await adminUserApi.update(editingUser.id, updateData);
        message.success('更新成功');
      } else {
        if (!values.password) {
          message.error('创建管理员必须设置密码');
          return;
        }
        await adminUserApi.create({
          username: values.username,
          phone: values.phone,
          password: values.password,
          is_superuser: values.is_superuser,
          store_name: values.store_name,
        });
        message.success('创建成功');
      }
      setModalVisible(false);
      actionRef.current?.reload();
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || (editingUser ? '更新失败' : '创建失败'));
    }
  };

  return (
    <div>
      <ProTable<AdminUserItem>
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          try {
            const res = await adminUserApi.list({
              page: params.current,
              page_size: params.pageSize,
              search: params.search,
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
        pagination={{ pageSize: 10 }}
        search={{ labelWidth: 'auto' }}
        options={{ reload: true, density: true, setting: true }}
        toolBarRender={() => [
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新建管理员
          </Button>,
        ]}
      />

      <Modal
        title={editingUser ? '编辑管理员' : '新建管理员'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[{ required: true }]}
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder={editingUser ? '留空则不修改密码' : '请输入密码'} />
          </Form.Item>
          <Form.Item name="store_name" label="显示名称">
            <Input placeholder="请输入显示名称" />
          </Form.Item>
          <Form.Item name="is_superuser" label="超级管理员" valuePropName="checked">
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
