# 存储方案技术文档

> **版本**: v1.0  
> **更新日期**: 2026-04-22  
> **适用场景**: 阿里云服务器 + 火山引擎方舟模型

---

## 目录

1. [背景与架构](#1-背景与架构)
2. [存储服务对比](#2-存储服务对比)
3. [费用分析](#3-费用分析)
4. [方案推荐](#4-方案推荐)
5. [实现指南](#5-实现指南)
6. [项目设计方案](#6-项目设计方案)

---

## 1. 背景与架构

### 1.1 当前架构

```
┌──────────────┐                    ┌──────────────┐
│  阿里云 ECS   │                    │  火山引擎     │
│  (业务服务器)  │ ─── API 调用 ───→ │  方舟模型     │
└──────────────┘                    │  (SeedDream) │
       │                            └──────────────┘
       │                                   │
       ▼                                   ▼
┌──────────────┐                    ┌──────────────┐
│  阿里云 OSS   │                    │  火山引擎 TOS │
│  (当前存储)   │                    │  (官方存储)   │
└──────────────┘                    └──────────────┘
```

### 1.2 数据流转

```
1. 用户上传图片 → 阿里 ECS
2. ECS 存储图片 → 阿里 OSS / 火山 TOS
3. ECS 调用方舟模型 → 火山方舟
4. 方舟读取图片 → 从存储读取
5. 方舟生成结果 → 临时 URL（24h 有效）
6. ECS 下载结果 → 存储到 OSS/TOS
7. 返回永久 URL → 用户
```

---

## 2. 存储服务对比

### 2.1 基础费用对比

| 项目 | 阿里云 OSS | 火山引擎 TOS | 说明 |
|------|-----------|-------------|------|
| **标准存储** | 0.12 元/GB/月 | 0.12 元/GB/月 | 相同 |
| **低频存储** | 0.08 元/GB/月 | 0.08 元/GB/月 | 相同 |
| **归档存储** | 0.033 元/GB/月 | 0.033 元/GB/月 | 相同 |
| **公网流出** | 0.50 元/GB | 0.50 元/GB | 相同 |
| **PUT 请求** | 0.01 元/万次 | 0.01 元/万次 | 相同 |
| **GET 请求** | 0.01 元/万次 | 0.01 元/万次 | 相同 |

### 2.2 图片处理对比

| 项目 | 阿里云 OSS | 火山引擎 TOS |
|------|-----------|-------------|
| **图片处理** | 0.025 元/GB | 0.025 元/GB |
| **免费额度** | 无 | **10 TiB/月** ✅ |
| **视频截帧** | 0.028 元/千帧 | 0.1 元/千次 |

### 2.3 内网传输规则

| 传输场景 | 阿里云 | 火山引擎 |
|----------|--------|----------|
| 同账号同地域 ECS ↔ OSS/TOS | 免费 | 免费 |
| 跨产品（如方舟 ↔ OSS） | 收费 | 收费 |
| 同产品全家桶 | - | 方舟 ↔ TOS 免费 ✅ |

---

## 3. 费用分析

### 3.1 网络传输类型

```
┌─────────────────────────────────────────────────────────────────┐
│  公网传输                                         │
│  ─────────────────────────────────────────────────────────────  │
│  • 用户访问、下载图片                                            │
│  • 跨云厂商传输（阿里 ↔ 火山）                                    │
│  • 费用：约 0.5 元/GB                                            │
├─────────────────────────────────────────────────────────────────┤
│  内网传输                                         │
│  ─────────────────────────────────────────────────────────────  │
│  • 同厂商同账号同地域内通信                                       │
│  • 阿里 ECS ↔ 阿里 OSS：免费                                     │
│  • 火山方舟 ↔ 火山 TOS：免费                                     │
│  • 费用：免费                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 方案 A：纯阿里云 OSS

```
阿里 ECS ──内网免费──→ 阿里 OSS ──公网收费──→ 火山方舟
                                            │
                                            ▼
                                        生成临时URL
                                            │
阿里 ECS ←──内网免费──→ 阿里 OSS ←──公网收费──┘
```

| 步骤 | 操作 | 流量类型 | 费用 |
|------|------|----------|------|
| 1 | ECS 上传图片到 OSS | 阿里内网 | 免费 |
| 2 | 方舟读取 OSS 图片 | 公网 | 0.5 元/GB |
| 3 | ECS 下载方舟结果 | 公网 | 0.5 元/GB |
| 4 | ECS 上传结果到 OSS | 阿里内网 | 免费 |
| **合计** | - | - | **1.0 元/GB** |

### 3.3 方案 B：纯火山引擎 TOS

```
阿里 ECS ──公网收费──→ 火山 TOS ──内网免费──→ 火山方舟
                                            │
                                            ▼
                                        生成临时URL
                                            │
阿里 ECS ←──公网收费──→ 火山 TOS ←──内网免费──┘
```

| 步骤 | 操作 | 流量类型 | 费用 |
|------|------|----------|------|
| 1 | ECS 上传图片到 TOS | 公网 | 0.5 元/GB |
| 2 | 方舟读取 TOS 图片 | 火山内网 | 免费 ✅ |
| 3 | 方舟保存结果到 TOS | 火山内网 | 免费 ✅ |
| 4 | ECS 下载结果 | 公网 | 0.5 元/GB |
| **合计** | - | - | **1.0 元/GB** |

### 3.4 方案 C：混合架构（推荐）

```
阿里 ECS ──内网免费──→ 阿里 OSS ──公网收费──→ 火山方舟
                                            │
                                            ▼
                                        火山 TOS（内网保存免费）
                                            │
阿里 ECS ←───────────── 公网收费 ────────────┘
```

| 步骤 | 操作 | 流量类型 | 费用 |
|------|------|----------|------|
| 1 | ECS 上传图片到 OSS | 阿里内网 | 免费 ✅ |
| 2 | 方舟读取 OSS 图片 | 公网 | 0.5 元/GB |
| 3 | 方舟保存结果到 TOS | 火山内网 | 免费 ✅ |
| 4 | ECS 下载结果 | 公网 | 0.5 元/GB |
| **合计** | - | - | **0.5 元/GB** |

**节省 50% 流量费！**

---

## 4. 方案推荐

### 4.1 决策矩阵

| 业务量 | 推荐方案 | 理由 |
|--------|----------|------|
| < 100 GB/月 | 方案 A（纯 OSS） | 简单，费用差异小 |
| 100-1000 GB/月 | 方案 C（混合） | 节省 50% 费用 |
| > 1000 GB/月 | 方案 D（全火山） | 全内网，最优成本 |

### 4.2 方案 D：全火山引擎架构

适用于大业务量场景，在火山引擎部署中转服务：

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  阿里云 ECS   │     │  火山引擎 ECS │     │  火山方舟    │
│  (前端业务)   │ ──→ │  (中转服务)   │ ──→ │  (AI 模型)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │ 公网               │ 内网               │ 内网
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐
│  阿里云 OSS   │     │  火山引擎 TOS │
│  (静态资源)   │     │  (AI 数据)    │
└──────────────┘     └──────────────┘
```

| 步骤 | 费用 |
|------|------|
| 阿里 ECS → 火山 ECS | 公网收费 |
| 火山 ECS → 火山 TOS | 内网免费 |
| 火山方舟 → 火山 TOS | 内网免费 |
| **合计** | **仅 1 次公网传输** |

---

## 5. 实现指南

### 5.1 方案 C 混合架构实现

#### 配置文件

```python
# settings.py 或 config.py

# 阿里云 OSS（存储输入图片）
ALI_OSS_CONFIG = {
    'access_key_id': 'your_ali_access_key',
    'access_key_secret': 'your_ali_secret',
    'endpoint': 'oss-cn-hangzhou-internal.aliyuncs.com',  # 内网 Endpoint
    'bucket_name': 'your-input-bucket',
}

# 火山引擎 TOS（存储结果图片）
VOLC_TOS_CONFIG = {
    'access_key': 'your_volc_access_key',
    'secret_key': 'your_volc_secret',
    'endpoint': 'tos-cn-beijing.ivolces.com',  # 内网 Endpoint
    'region': 'cn-beijing',
    'bucket_name': 'your-result-bucket',
}

# 火山引擎方舟
ARK_CONFIG = {
    'api_key': 'your_ark_api_key',
    'base_url': 'https://ark.cn-beijing.volces.com/api/v3',
    'model': 'ep-xxxxx',  # SeedDream 接入点
}
```

#### 核心代码

```python
import oss2
import tos
from volcenginesdkarkruntime import Ark
import requests

class HybridStorageService:
    """混合存储服务：阿里 OSS（输入）+ 火山 TOS（输出）"""
    
    def __init__(self):
        # 阿里云 OSS 客户端（内网）
        self.oss_auth = oss2.Auth(
            ALI_OSS_CONFIG['access_key_id'],
            ALI_OSS_CONFIG['access_key_secret']
        )
        self.oss_bucket = oss2.Bucket(
            self.oss_auth,
            ALI_OSS_CONFIG['endpoint'],
            ALI_OSS_CONFIG['bucket_name']
        )
        
        # 火山引擎 TOS 客户端（内网）
        self.tos_client = tos.TosClientV2(
            VOLC_TOS_CONFIG['access_key'],
            VOLC_TOS_CONFIG['secret_key'],
            VOLC_TOS_CONFIG['endpoint'],
            VOLC_TOS_CONFIG['region']
        )
        
        # 方舟客户端
        self.ark_client = Ark(
            api_key=ARK_CONFIG['api_key'],
            base_url=ARK_CONFIG['base_url']
        )
    
    def upload_input_image(self, image_data: bytes, object_key: str) -> str:
        """
        上传输入图片到阿里 OSS（ECS 内网免费）
        
        Returns:
            OSS URL 供方舟读取
        """
        self.oss_bucket.put_object(object_key, image_data)
        
        # 返回公网 URL（方舟需要公网访问）
        return f"https://{ALI_OSS_CONFIG['bucket_name']}.oss-cn-hangzhou.aliyuncs.com/{object_key}"
    
    def call_ark_model(self, image_url: str, prompt: str = "") -> dict:
        """
        调用方舟模型（公网传输，收费）
        
        注意：方舟读取阿里 OSS 图片是公网传输
        """
        result = self.ark_client.content_generation.tasks.create(
            model=ARK_CONFIG['model'],
            content=[
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": image_url}},
            ]
        )
        return result
    
    def save_result_to_tos(self, result_url: str, object_key: str) -> str:
        """
        保存方舟结果到火山 TOS
        
        方案 1：让方舟直接保存到 TOS（内网免费）
        方案 2：ECS 下载后上传到 TOS（公网收费）
        
        这里使用方案 2，因为当前方舟返回临时 URL
        """
        # 下载结果图片
        response = requests.get(result_url)
        image_data = response.content
        
        # 上传到 TOS
        self.tos_client.put_object(
            VOLC_TOS_CONFIG['bucket_name'],
            object_key,
            content=image_data
        )
        
        # 返回 TOS URL
        return f"https://{VOLC_TOS_CONFIG['bucket_name']}.tos-cn-beijing.volces.com/{object_key}"
    
    def process(self, image_data: bytes, prompt: str = "") -> dict:
        """
        完整处理流程
        """
        # 1. 上传输入图片到阿里 OSS（内网免费）
        input_key = f"inputs/{uuid.uuid4()}.jpg"
        input_url = self.upload_input_image(image_data, input_key)
        
        # 2. 调用方舟模型（公网收费）
        result = self.call_ark_model(input_url, prompt)
        
        # 3. 保存结果到火山 TOS（公网收费）
        result_key = f"results/{uuid.uuid4()}.png"
        result_url = self.save_result_to_tos(result['url'], result_key)
        
        return {
            'input_url': input_url,
            'result_url': result_url,
            'task_id': result['id'],
        }
```

### 5.2 TOS 内网 Endpoint 配置

| 地域 | 公网 Endpoint | 内网 Endpoint |
|------|---------------|---------------|
| 华北2（北京） | `tos-cn-beijing.volces.com` | `tos-cn-beijing.ivolces.com` |
| 华东1（上海） | `tos-cn-shanghai.volces.com` | `tos-cn-shanghai.ivolces.com` |
| 华南1（广州） | `tos-cn-guangzhou.volces.com` | `tos-cn-guangzhou.ivolces.com` |

**关键**：内网 Endpoint 使用 `ivolces.com` 后缀。

### 5.3 费用监控

```python
# 建议添加费用监控
class CostMonitor:
    """流量费用监控"""
    
    # 价格配置
    PUBLIC_TRAFFIC_PRICE = 0.5  # 元/GB
    
    def calculate_cost(self, traffic_gb: float) -> float:
        """计算公网流量费用"""
        return traffic_gb * self.PUBLIC_TRAFFIC_PRICE
    
    def log_traffic(self, operation: str, size_bytes: int, is_public: bool):
        """记录流量"""
        size_gb = size_bytes / (1024 ** 3)
        
        if is_public:
            cost = self.calculate_cost(size_gb)
            logger.info(
                f"[流量] {operation}: {size_gb:.4f} GB, "
                f"费用: {cost:.4f} 元"
            )
        else:
            logger.info(f"[流量] {operation}: {size_gb:.4f} GB (内网免费)")
```

---

## 附录

### A. 火山引擎 TOS 图片处理能力

| 能力 | 参数示例 | 说明 |
|------|----------|------|
| 格式转换 | `image/format,png` | 转换为 PNG |
| 图片缩放 | `image/resize,w_200,h_200` | 缩放到 200x200 |
| 质量压缩 | `image/quality,q_60` | 压缩到 60% 质量 |
| 添加水印 | `image/watermark,text_xxx` | 添加文字水印 |
| 视频截帧 | `video/snapshot,t_2000` | 截取 2 秒处帧 |

### B. TOS 数据处理费用详情

> **重要规则**：仅处理成功计费，失败不计费。

#### B.1 图片处理费用

| 计费项 | 免费额度 | 超额单价 | 计费依据 | 计费周期 |
|--------|----------|----------|----------|----------|
| **图片处理**（缩放、水印等） | **10 TiB/月** ✅ | 0.025 元/GiB | 原图大小 | 按小时结算 |

**计费公式**：
```
图片处理费用 = max(处理量 - 10 TiB, 0) × 0.025 元/GiB
```

**注意**：
- 图片处理计费仅与原图大小有关，与操作数量无关
- 例如：同时对图片进行缩放+水印，只收一次图片处理费

#### B.2 图片高级压缩费用

| 规格 | 定义 | 单价 |
|------|------|------|
| **低规格** | 800×600 像素以下 | 0.025 元/千次 |
| **中规格** | 800×600 ~ 4096×4096 像素 | 0.025 元/千次 |
| **高规格** | 4096×4096 像素以上 | 0.1 元/千次 |

**计费公式**：
```
图片高级压缩费用 = 处理次数 × 单价 ÷ 1000
```

**注意**：高级压缩与图片处理分开计费。例如同时缩放+高级压缩，需支付两项费用。

#### B.3 其他数据处理费用

| 计费项 | 单价 | 计费依据 | 说明 |
|--------|------|----------|------|
| **视频截帧** | 0.1 元/千次 | 截帧次数 | 查看视频信息也计费 |
| **异常图片检测** | 0.1 元/千次 | 检测次数 | 仅成功调用计费，结果无关 |
| **文件解压** | 0.05 元/GiB | 解压后大小 | - |
| **多文件压缩打包** | 0.05 元/GiB | 压缩前大小 | - |
| **智能分层对象监控** | 0.175 元/万对象/月 | 对象个数 | < 64KiB 对象不计费 |
| **视频转码** | 暂不收费 | 输出时长 | 后续收费另行通知 |
| **音频转码** | 暂不收费 | 输出时长 | 后续收费另行通知 |
| **音视频 AIGC 元信息提取** | 暂不收费 | 提取次数 | 后续收费另行通知 |

#### B.4 图片处理的附加费用

使用图片处理服务时，除图片处理费外，还会产生：

| 费用类型 | 说明 |
|----------|------|
| **请求费用** | 处理时产生 1 次 GetObject 请求，按 GET 请求单价计费 |
| **流量费用** | 根据处理后的图片大小收取公网流出流量费 |

**示例**：处理一张 1MB 图片，缩放后 500KB
```
图片处理费 = 0（在 10TiB 免费额度内）
请求费 = 0.01 元/万次 ≈ 0.000001 元
流量费 = 0.5 元/GB × 0.0005 GB = 0.00025 元（如果公网访问）
合计 ≈ 0.00025 元
```

#### B.5 费用优化建议

1. **利用 10 TiB 免费额度**：图片处理每月前 10 TiB 免费，大部分场景无需付费
2. **使用内网访问**：处理后的图片通过内网下载，避免公网流量费
3. **合理选择规格**：高级压缩时，控制输出分辨率以降低规格费用
4. **批量处理**：减少请求次数，降低请求费用

### C. 相关文档

- [火山引擎 TOS 文档](https://www.volcengine.com/docs/6349)
- [火山方舟模型列表](https://www.volcengine.com/docs/82379/1330310)
- [TOS + 方舟组合方案](https://www.volcengine.com/docs/6349/127695)
- [阿里云 OSS 文档](https://help.aliyun.com/product/31815.html)

### D. 更新记录

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-04-22 | v1.0 | 初始版本 |
| 2026-04-22 | v1.1 | 新增项目设计方案章节 |

---

## 6. 项目设计方案

> 基于当前项目架构和费用分析，给出针对本项目的存储优化方案。

### 6.1 内网传输条件（关键）

> ⚠️ **重要**：内网传输免费有严格条件，跨云厂商无法享受内网优惠。

#### 6.1.1 阿里云内网条件

| 条件 | 说明 |
|------|------|
| **同账号** | ECS 和 OSS 必须属于同一个阿里云账号 |
| **同地域** | ECS 和 OSS 必须在同一个地域（如都在华东1-杭州） |
| **内网 Endpoint** | 使用 `-internal` 后缀的 Endpoint |

```bash
# 公网 Endpoint（收费）
oss-cn-hangzhou.aliyuncs.com

# 内网 Endpoint（免费）
oss-cn-hangzhou-internal.aliyuncs.com
```

#### 6.1.2 火山引擎内网条件

| 条件 | 说明 |
|------|------|
| **同账号** | TOS 和方舟模型必须属于同一个火山引擎账号 |
| **同地域** | TOS 和方舟模型必须在同一个地域（如都在华北2-北京） |
| **内网 Endpoint** | 使用 `ivolces.com` 后缀的 Endpoint |

```bash
# 公网 Endpoint（收费）
tos-cn-beijing.volces.com

# 内网 Endpoint（免费）
tos-cn-beijing.ivolces.com
```

#### 6.1.3 跨云厂商传输

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ 关键结论：阿里 ECS 和火山 TOS 不属于同一云厂商                 │
│  → 无论用什么 Endpoint，都是公网传输，都要收费！                   │
└─────────────────────────────────────────────────────────────────┘
```

| 传输路径 | 是否同厂商 | 是否内网 | 费用 |
|----------|------------|----------|------|
| 阿里 ECS → 阿里 OSS | ✅ 同厂商 | ✅ 内网 | **免费** |
| 阿里 ECS → 火山 TOS | ❌ 跨厂商 | ❌ 公网 | **收费** |
| 火山方舟 → 火山 TOS | ✅ 同厂商 | ✅ 内网 | **免费** |
| 火山方舟 → 阿里 OSS | ❌ 跨厂商 | ❌ 公网 | **收费** |

### 6.2 当前架构分析

#### 现有组件

| 组件 | 文件 | 功能 |
|------|------|------|
| **统一存储服务** | `storage_service.py` | 支持 OSS/本地存储切换，MD5 去重 |
| **OSS 服务** | `oss_service.py` | 阿里云 OSS 上传、签名 URL |
| **TryOn 服务** | `tryon_service.py` | 整合存储上传和 AI 引擎调用 |
| **SeedDance 引擎** | `seeddance.py` | 火山引擎 ARK API 调用，结果下载存储 |

#### 当前数据流

```
用户上传 → 阿里 ECS ──内网免费──→ 阿里 OSS
                                     ↓
                           火山方舟读取 (公网收费 0.5元/GB)
                                     ↓
                           生成临时 TOS URL (24h 有效)
                                     ↓
                           ECS 下载结果 (公网收费 0.5元/GB)
                                     ↓
                           存储到阿里 OSS (内网免费)
```

**当前流量费用**：公网读取 + 公网下载 = **1.0 元/GB**

### 6.3 方案对比分析

#### 方案 A：当前方案（纯阿里 OSS）

```
阿里 ECS ──内网免费──→ 阿里 OSS
                        ↓ 公网收费 (0.5元/GB)
                   火山方舟读取
                        ↓ 内网免费
                   方舟保存到临时 TOS
                        ↓ 公网收费 (0.5元/GB)
                   ECS 下载结果
                        ↓ 内网免费
                   存储到阿里 OSS
```

**费用**：0.5 + 0.5 = **1.0 元/GB**

#### 方案 B：混合存储（输入 OSS + 结果 TOS）

```
阿里 ECS ──内网免费──→ 阿里 OSS
                        ↓ 公网收费 (0.5元/GB)
                   火山方舟读取
                        ↓ 内网免费
                   方舟保存到火山 TOS
                        ↓ 公网收费 (0.5元/GB) ← 跨厂商访问
                   用户访问 TOS
```

**费用**：0.5 + 0.5 = **1.0 元/GB**

> ⚠️ **结论**：方案 A 和方案 B 费用相同！混合存储没有优势，因为阿里 ECS 访问火山 TOS 仍然是公网。

#### 方案 C：全火山引擎架构（真正省钱）

**前提**：在火山引擎部署一台 ECS 作为中转服务

```
┌─────────────┐     公网收费      ┌─────────────┐
│  阿里 ECS   │ ──────────────→ │  火山 ECS   │
│  (前端业务)  │   (0.5元/GB)    │  (中转服务)  │
└─────────────┘                 └──────┬──────┘
                                       │
                                       │ 内网免费 ✅
                                       ▼
                                ┌─────────────┐
                                │  火山 TOS   │
                                └─────────────┘
                                       ↑
                                       │ 内网免费 ✅
                                ┌─────────────┐
                                │  火山方舟   │
                                └─────────────┘
```

**费用**：仅 1 次公网传输（阿里→火山）= **0.5 元/GB**

**节省 50%！**

### 6.4 方案推荐

| 方案 | 费用 | 改动量 | 适用场景 |
|------|------|--------|----------|
| **A. 纯阿里 OSS** | 1.0 元/GB | 无 | 小业务量，简单可靠 |
| **B. 混合存储** | 1.0 元/GB | 中 | ❌ 无优势，不推荐 |
| **C. 全火山引擎** | 0.5 元/GB | 大 | 大业务量，真正省钱 |

#### 推荐决策

```
业务量 < 500 GB/月  →  方案 A（保持现状）
业务量 > 1000 GB/月 →  方案 C（全火山引擎）
```

### 6.5 方案 C 实现指南

#### 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         全火山引擎架构（方案 C）                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │  用户请求   │                                                            │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────┐      公网转发       ┌─────────────┐                        │
│  │  阿里 ECS   │ ─────────────────→ │  火山 ECS   │                        │
│  │  (前端 API) │     仅转发请求      │  (业务服务)  │                        │
│  └─────────────┘                    └──────┬──────┘                        │
│                                            │                               │
│                                            │ 内网免费 ✅                    │
│                                            ▼                               │
│                                     ┌─────────────┐                        │
│                                     │  火山 TOS   │ ← 输入+结果存储         │
│                                     └──────┬──────┘                        │
│                                            ↑                               │
│                                            │ 内网免费 ✅                    │
│                                     ┌─────────────┐                        │
│                                     │  火山方舟   │                        │
│                                     └─────────────┘                        │
│                                                                             │
│  流量费用: 0.5 元/GB (节省 50%)                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 实现步骤

**阶段 1：火山引擎环境准备**

- [ ] 开通火山引擎 ECS（或使用云函数）
- [ ] 开通火山引擎 TOS
- [ ] 配置 TOS 内网 Endpoint
- [ ] 测试内网连通性

**阶段 2：部署中转服务**

```python
# 火山 ECS 上的中转服务 (proxy_service.py)

from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

@app.route('/api/v1/tryon/generate/', methods=['POST'])
def proxy_tryon():
    """转发试穿请求到阿里 ECS"""
    # 获取请求数据
    data = request.json
    
    # 调用阿里 ECS 的试穿 API
    response = requests.post(
        'https://ali-ecs.example.com/api/v1/tryon/generate/',
        json=data,
        headers={'Authorization': request.headers.get('Authorization')}
    )
    
    return jsonify(response.json())

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
```

**阶段 3：修改存储逻辑**

```python
# apps/tryon/ai_engines/seeddance.py

def _download_and_store_result(self, result_url, task_id, trace_id):
    """
    方案 C：结果直接留在火山 TOS，不下载到 ECS
    
    火山方舟返回的临时 TOS URL 已经在火山内网，
    只需要复制到永久 TOS Bucket 即可。
    """
    import tos
    
    # 初始化 TOS 客户端（内网 Endpoint）
    client = tos.TosClientV2(
        TOS_ACCESS_KEY,
        TOS_SECRET_KEY,
        'tos-cn-beijing.ivolces.com',  # 内网 Endpoint
        'cn-beijing'
    )
    
    # 从临时 URL 复制到永久存储
    source_key = self._parse_tos_key(result_url)
    dest_key = f"tryon_results/{task_id}.png"
    
    client.copy_object(
        TOS_BUCKET,
        dest_key,
        src_bucket=TEMP_BUCKET,
        src_key=source_key
    )
    
    # 返回公网访问 URL
    return f"https://{TOS_BUCKET}.tos-cn-beijing.volces.com/{dest_key}"
```

**阶段 4：配置环境变量**

```bash
# 火山 ECS 环境变量

# 火山引擎 TOS（内网）
TOS_ACCESS_KEY=your_tos_access_key
TOS_SECRET_KEY=your_tos_secret_key
TOS_ENDPOINT=tos-cn-beijing.ivolces.com  # 内网 Endpoint
TOS_BUCKET_NAME=your-bucket

# 火山引擎方舟
ARK_API_KEY=your_ark_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
```

### 6.6 费用对比总结

#### 月度费用估算

| 业务量 | 方案 A (纯OSS) | 方案 C (全火山) | 月节省 |
|--------|----------------|-----------------|--------|
| 100 GB | 100 元 | 50 元 | **50 元** |
| 500 GB | 500 元 | 250 元 | **250 元** |
| 1000 GB | 1000 元 | 500 元 | **500 元** |
| 5000 GB | 5000 元 | 2500 元 | **2500 元** |

### 6.7 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 火山 ECS 不稳定 | 服务中断 | 保留阿里 ECS 作为降级 |
| 跨云延迟增加 | 用户体验下降 | 使用火山云函数就近处理 |
| 双云运维复杂 | 运维成本增加 | 统一监控告警平台 |
| 数据一致性 | 同步问题 | 使用消息队列异步处理 |

### 6.8 最终决策

> ✅ **已确认：采用方案 A（纯阿里 OSS）**

| 项目 | 决策 |
|------|------|
| **选定方案** | 方案 A：纯阿里 OSS |
| **流量费用** | 1.0 元/GB |
| **改动范围** | 无需改动，保持现状 |
| **优势** | 简单可靠，运维成本低 |
| **后续优化** | 业务量 > 1000 GB/月 时可考虑方案 C |

#### 当前架构确认

```
用户上传 → 阿里 ECS ──内网免费──→ 阿里 OSS
                                     ↓
                           火山方舟读取 (公网 0.5元/GB)
                                     ↓
                           生成临时 TOS URL (24h 有效)
                                     ↓
                           ECS 下载结果 (公网 0.5元/GB)
                                     ↓
                           存储到阿里 OSS (内网免费)

流量费用合计: 1.0 元/GB
```

#### 配置确认

```bash
# .env 配置（当前已配置）

# 阿里云 OSS（内网 Endpoint）
OSS_ACCESS_KEY_ID=your_oss_key
OSS_ACCESS_KEY_SECRET=your_oss_secret
OSS_BUCKET_NAME=your-bucket
OSS_ENDPOINT=oss-cn-shanghai-internal.aliyuncs.com  # 内网，上传免费

# 火山引擎方舟
ARK_API_KEY=your_ark_api_key
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
ARK_MODEL_ID=doubao-seedream-4-0-250828
```

#### 费用预估

| 月业务量 | 流量费用 |
|----------|----------|
| 100 GB | 100 元 |
| 500 GB | 500 元 |
| 1000 GB | 1000 元 |

### 6.9 监控指标

```python
# 建议添加的监控指标

class StorageMetrics:
    """存储监控指标"""
    
    # 流量统计
    oss_upload_bytes = 0       # OSS 上传量
    tos_upload_bytes = 0       # TOS 上传量
    public_download_bytes = 0  # 公网下载量
    cross_cloud_bytes = 0      # 跨云传输量
    
    # 费用估算
    def estimate_cost(self):
        return {
            'oss_traffic': self.oss_upload_bytes * 0,  # 内网免费
            'tos_traffic': self.tos_upload_bytes * 0,  # 内网免费
            'public_traffic': self.public_download_bytes * 0.5 / (1024**3),
            'cross_cloud': self.cross_cloud_bytes * 0.5 / (1024**3),
        }
    
    # 告警阈值
    ALERT_THRESHOLD = 100 * 1024**3  # 100 GB
    
    def check_alert(self):
        if self.public_download_bytes > self.ALERT_THRESHOLD:
            logger.warning(f"公网流量超过阈值: {self.public_download_bytes / (1024**3):.2f} GB")
```
