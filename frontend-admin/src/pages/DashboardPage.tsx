import { Row, Col, Card, Progress, Typography, Divider, Empty, Spin, Alert, Statistic } from 'antd';
import { UserOutlined, ShoppingOutlined, FileImageOutlined, CheckCircleOutlined, ClockCircleOutlined, DatabaseOutlined, RiseOutlined, ShopOutlined, CreditCardOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useDashboardStats } from '../hooks/queries';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.is_superuser ?? false;
  const { data: stats, isPending: loading } = useDashboardStats();

  // 统计卡片数据 - 根据是否为超级管理员显示不同内容
  const statCards = isSuperAdmin ? [
    {
      title: '商家总数',
      value: stats?.total_merchants || 0,
      icon: <UserOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      suffix: '家',
    },
    {
      title: '活跃商家',
      value: stats?.active_merchants || 0,
      icon: <CheckCircleOutlined />,
      color: '#1677ff',
      bgColor: '#e6f4ff',
      suffix: '家',
    },
    {
      title: '试穿记录',
      value: stats?.total_tryon_records || 0,
      icon: <FileImageOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      suffix: '条',
    },
    {
      title: '服装数量',
      value: stats?.total_clothing || 0,
      icon: <ShoppingOutlined />,
      color: '#fa8c16',
      bgColor: '#fff7e6',
      suffix: '件',
    },
  ] : [
    // 普通管理员（商家）看到的统计 - 只显示业务相关数据
    {
      title: '我的试穿',
      value: stats?.total_tryon_records || 0,
      icon: <FileImageOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      suffix: '条',
    },
    {
      title: '我的服装',
      value: stats?.total_clothing || 0,
      icon: <ShoppingOutlined />,
      color: '#fa8c16',
      bgColor: '#fff7e6',
      suffix: '件',
    },
    {
      title: '配额剩余',
      value: (stats?.quota_total || 0) - (stats?.quota_used || 0),
      icon: <CreditCardOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      suffix: '次',
    },
    {
      title: '配额总量',
      value: stats?.quota_total || 0,
      icon: <DatabaseOutlined />,
      color: '#1677ff',
      bgColor: '#e6f4ff',
      suffix: '次',
    },
  ];

  // 今日统计卡片 - 根据角色显示不同内容
  const todayStats = isSuperAdmin ? [
    {
      title: '今日试穿',
      value: stats?.today_tryon_count || 0,
      icon: <RiseOutlined />,
      color: '#eb2f96',
      bgColor: '#fff0f6',
    },
    {
      title: '成功率',
      value: ((stats?.today_success_rate || 0) * 100).toFixed(1),
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      suffix: '%',
    },
    {
      title: '平均耗时',
      value: (stats?.today_avg_processing_time || 0).toFixed(1),
      icon: <ClockCircleOutlined />,
      color: '#1677ff',
      bgColor: '#e6f4ff',
      suffix: '秒',
    },
    {
      title: '存储占用',
      value: ((stats?.total_storage_bytes || 0) / 1024 / 1024).toFixed(1),
      icon: <DatabaseOutlined />,
      color: '#faad14',
      bgColor: '#fffbe6',
      suffix: 'MB',
    },
  ] : [
    // 商家看到的今日统计 - 不显示存储
    {
      title: '今日试穿',
      value: stats?.today_tryon_count || 0,
      icon: <RiseOutlined />,
      color: '#eb2f96',
      bgColor: '#fff0f6',
    },
    {
      title: '成功率',
      value: ((stats?.today_success_rate || 0) * 100).toFixed(1),
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
      bgColor: '#f6ffed',
      suffix: '%',
    },
    {
      title: '平均耗时',
      value: (stats?.today_avg_processing_time || 0).toFixed(1),
      icon: <ClockCircleOutlined />,
      color: '#1677ff',
      bgColor: '#e6f4ff',
      suffix: '秒',
    },
    {
      title: '配额使用率',
      value: stats?.quota_total ? ((stats.quota_used / stats.quota_total) * 100).toFixed(1) : 0,
      icon: <CreditCardOutlined />,
      color: '#722ed1',
      bgColor: '#f9f0ff',
      suffix: '%',
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
          {isSuperAdmin ? '系统数据概览' : '我的数据概览'}
        </Title>
        <Text type="secondary">
          {isSuperAdmin ? '实时查看系统运营数据' : `查看您的账号运营数据 - ${user?.username || ''}`}
        </Text>
      </div>

      {/* 非超级管理员提示 - 商家额度信息 */}
      {!isSuperAdmin && (
        <>
          <Alert
            message="商家管理面板"
            description="您正在以商家身份查看数据。此处仅显示与您账号相关的统计数据。"
            type="info"
            showIcon
            icon={<ShopOutlined />}
            style={{ marginBottom: 24, borderRadius: 8 }}
          />
          {/* 额度使用卡片 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={24}>
              <Card
                style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
                styles={{ body: { padding: 24 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <CreditCardOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                      <Text strong style={{ fontSize: 16 }}>额度使用情况</Text>
                    </div>
                    <Statistic
                      value={stats?.quota_used || 0}
                      suffix={`/ ${stats?.quota_total || 0} 次`}
                      valueStyle={{ fontSize: 28, color: '#1677ff' }}
                    />
                  </div>
                  <Progress
                    type="circle"
                    percent={stats?.quota_total ? Math.round((stats.quota_used / stats.quota_total) * 100) : 0}
                    strokeColor={{
                      '0%': '#1677ff',
                      '100%': (stats?.quota_used || 0) / (stats?.quota_total || 1) > 0.8 ? '#ff4d4f' : '#52c41a',
                    }}
                    size={80}
                  />
                </div>
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">
                    剩余额度: <Text strong style={{ color: '#52c41a' }}>{(stats?.quota_total || 0) - (stats?.quota_used || 0)}</Text> 次
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* 主要统计卡片 */}
      <Row gutter={[16, 16]}>
        {statCards.map((item, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              style={{
                borderRadius: 12,
                border: '1px solid #f0f0f0',
                overflow: 'hidden',
              }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: item.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.title}</Text>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#333', marginTop: 4 }}>
                    {item.value.toLocaleString()}
                    <span style={{ fontSize: 14, color: '#999', marginLeft: 4 }}>{item.suffix}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Divider style={{ margin: '24px 0' }} />

      {/* 今日统计 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>今日数据</Title>
      </div>
      <Row gutter={[16, 16]}>
        {todayStats.map((item, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card
              style={{
                borderRadius: 12,
                border: '1px solid #f0f0f0',
              }}
              styles={{ body: { padding: 20 } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: item.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 13 }}>{item.title}</Text>
                  <div style={{ fontSize: 22, fontWeight: 600, color: item.color, marginTop: 4 }}>
                    {item.value}
                    <span style={{ fontSize: 13, color: '#999', marginLeft: 2 }}>{item.suffix || ''}</span>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 趋势图表区域 */}
      <Divider style={{ margin: '24px 0' }} />
      <div style={{ marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>试穿趋势</Title>
      </div>
      <Card
        style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
        styles={{ body: { padding: 20 } }}
      >
        {stats?.tryon_trend && stats.tryon_trend.length > 0 ? (
          <div>
            {/* 简单的趋势展示 */}
            <Row gutter={[8, 8]}>
              {stats.tryon_trend.slice(-7).map((item, index) => (
                <Col span={24/7} key={index}>
                  <div style={{ textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {item.date.slice(5)}
                    </Text>
                    <div style={{ 
                      height: 60, 
                      display: 'flex', 
                      alignItems: 'flex-end', 
                      justifyContent: 'center',
                      marginTop: 8,
                    }}>
                      <div style={{
                        width: 24,
                        height: `${Math.min(100, (item.count / Math.max(...stats.tryon_trend.map(t => t.count))) * 100)}%`,
                        minHeight: 8,
                        background: 'linear-gradient(180deg, #1677ff 0%, #69b1ff 100%)',
                        borderRadius: 4,
                      }} />
                    </div>
                    <Text strong style={{ fontSize: 14 }}>{item.count}</Text>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        ) : (
          <Empty description="暂无趋势数据" style={{ margin: '20px 0' }} />
        )}
      </Card>

      {/* 超管专属：AI 引擎统计 */}
      {isSuperAdmin && stats?.engine_stats && stats.engine_stats.length > 0 && (
        <>
          <Divider style={{ margin: '24px 0' }} />
          <div style={{ marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>AI 引擎统计</Title>
          </div>
          <Card
            style={{ borderRadius: 12, border: '1px solid #f0f0f0' }}
            styles={{ body: { padding: 16 } }}
          >
            <div>
              {stats.engine_stats.map((engine, index) => (
                <div key={index} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text>{engine.engine}</Text>
                    <Text strong>{engine.count} 次</Text>
                  </div>
                  <Progress 
                    percent={Math.round((engine.count / (stats?.total_tryon_records || 1)) * 100)} 
                    size="small"
                    strokeColor="#1677ff"
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    平均耗时: {engine.avg_time.toFixed(1)}秒
                  </Text>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
