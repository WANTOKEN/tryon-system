import { useAuthStore } from '../stores/authStore';
import { Card, Row, Col, Statistic, Progress, Empty, Typography, Divider, Spin, theme as antdTheme } from 'antd';
import {
  DatabaseOutlined,
  CloudServerOutlined,
  ApiOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useDashboardStats } from '../hooks/queries';

const { Title, Text } = Typography;

export default function SystemMonitorPage() {
  const { isSuperAdmin } = useAuthStore();
  const { data: stats, isPending: loading } = useDashboardStats();
  const { token } = antdTheme.useToken();

  // 非超管无法访问此页面
  if (!isSuperAdmin()) {
    return (
      <Card>
        <Empty description="无权访问此页面" />
      </Card>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        系统监控
      </Title>

      {/* 系统资源统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, border: '1px solid var(--ant-color-border)' }}
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title="总存储占用"
              value={((stats?.total_storage_bytes || 0) / 1024 / 1024).toFixed(1)}
              suffix="MB"
              prefix={<DatabaseOutlined style={{ color: token.colorPrimary }} />}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, border: '1px solid var(--ant-color-border)' }}
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title="文件总数"
              value={stats?.total_files || 0}
              suffix="个"
              prefix={<CloudServerOutlined style={{ color: token.colorSuccess }} />}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, border: '1px solid var(--ant-color-border)' }}
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title="总试穿次数"
              value={stats?.total_tryon_records || 0}
              suffix="次"
              prefix={<ApiOutlined style={{ color: token.colorInfo }} />}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{ borderRadius: 12, border: '1px solid var(--ant-color-border)' }}
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title="活跃商家"
              value={stats?.active_merchants || 0}
              suffix="个"
              prefix={<ThunderboltOutlined style={{ color: token.colorWarning }} />}
              valueStyle={{ fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* AI 引擎统计 */}
      <Divider style={{ margin: '24px 0' }} />
      <Title level={5} style={{ marginBottom: 16 }}>AI 引擎统计</Title>
      <Row gutter={[16, 16]}>
        {stats?.engine_stats && stats.engine_stats.length > 0 ? (
          stats.engine_stats.map((engine, index) => (
            <Col xs={24} md={12} lg={8} key={index}>
              <Card
                style={{ borderRadius: 12, border: '1px solid var(--ant-color-border)' }}
                styles={{ body: { padding: 20 } }}
              >
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 16 }}>{engine.engine}</Text>
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <Statistic
                      title="调用次数"
                      value={engine.count}
                      suffix="次"
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Col>
                  <Col span={12}>
                    <Statistic
                      title="平均耗时"
                      value={engine.avg_time.toFixed(1)}
                      suffix="秒"
                      prefix={<ClockCircleOutlined />}
                      valueStyle={{ fontSize: 20 }}
                    />
                  </Col>
                </Row>
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>使用占比</Text>
                  <Progress 
                    percent={Math.round((engine.count / (stats?.total_tryon_records || 1)) * 100)} 
                    strokeColor={token.colorPrimary}
                  />
                </div>
              </Card>
            </Col>
          ))
        ) : (
          <Col span={24}>
            <Card>
              <Empty description="暂无引擎数据" />
            </Card>
          </Col>
        )}
      </Row>

      {/* 性能指标 */}
      <Divider style={{ margin: '24px 0' }} />
      <Title level={5} style={{ marginBottom: 16 }}>性能指标</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card
            style={{ borderRadius: 12, border: '1px solid var(--ant-color-border)' }}
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title="今日成功率"
              value={((stats?.today_success_rate || 0) * 100).toFixed(1)}
              suffix="%"
              prefix={<CheckCircleOutlined style={{ color: token.colorSuccess }} />}
              valueStyle={{ fontSize: 28 }}
            />
            <Progress 
              percent={((stats?.today_success_rate || 0) * 100)} 
              strokeColor={token.colorSuccess}
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            style={{ borderRadius: 12, border: '1px solid var(--ant-color-border)' }}
            styles={{ body: { padding: 20 } }}
          >
            <Statistic
              title="今日平均耗时"
              value={(stats?.today_avg_processing_time || 0).toFixed(1)}
              suffix="秒"
              prefix={<ClockCircleOutlined style={{ color: token.colorPrimary }} />}
              valueStyle={{ fontSize: 28 }}
            />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                目标: &lt; 5秒
              </Text>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
