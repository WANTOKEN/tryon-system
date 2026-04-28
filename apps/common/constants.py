"""
通用常量定义

统一管理系统中使用的常量，避免硬编码
所有模块都应该从这里导入常量，确保一致性
"""

# ============================================
# 存储相关常量
# ============================================

class StorageType:
    """存储类型"""
    LOCAL = 'local'
    OSS = 'oss'
    
    ALL = (LOCAL, OSS)
    
    @classmethod
    def is_valid(cls, storage_type: str) -> bool:
        """验证存储类型是否有效"""
        return storage_type in cls.ALL
    
    @classmethod
    def get_current(cls) -> str:
        """获取当前存储类型（从环境变量）"""
        import os
        return os.getenv('STORAGE_TYPE', cls.LOCAL).lower()


class StorageFolder:
    """
    存储文件夹
    
    命名规范：小写，下划线分隔
    路径格式：{folder}/{md5}{ext}
    """
    AVATARS = 'avatars'           # 人物照片
    CLOTHING = 'clothing'         # 服装图片
    WARDROBE = 'wardrobe'         # 衣橱
    RESULTS = 'results'           # 试穿结果
    THUMBNAILS = 'thumbnails'     # 缩略图
    TEMP = 'temp'                 # 临时文件


class FileCategory:
    """文件用途分类"""
    AVATAR = 'avatar'             # 人物头像
    CLOTHING = 'clothing'         # 服装图片
    RESULT = 'result'             # 试穿结果
    THUMBNAIL = 'thumbnail'       # 缩略图
    OTHER = 'other'               # 其他


# ============================================
# 内容 Key 相关常量
# ============================================

class ContentKeyPrefix:
    """
    内容 Key 前缀
    
    Key 格式: "{prefix}:{md5}"
    示例: "local:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
    """
    LOCAL = 'local'               # 本地存储
    OSS = 'oss'                   # OSS 存储
    
    ALL = (LOCAL, OSS)
    SEPARATOR = ':'
    
    @classmethod
    def is_valid(cls, prefix: str) -> bool:
        """验证前缀是否有效"""
        return prefix in cls.ALL


class ContentKeyFormat:
    """
    内容 Key 格式定义
    
    Key 格式: "{prefix}:{md5}"
    - prefix: 存储类型（local/oss）
    - md5: 文件内容的 MD5 哈希（32位十六进制）
    """
    MD5_LENGTH = 32
    
    @classmethod
    def is_valid_md5(cls, md5: str) -> bool:
        """验证 MD5 格式是否有效"""
        if not md5 or len(md5) != cls.MD5_LENGTH:
            return False
        return all(c in '0123456789abcdefABCDEF' for c in md5)


# ============================================
# 记录 UUID 前缀
# ============================================

class RecordPrefix:
    """
    记录 UUID 前缀
    
    用于区分不同类型的记录
    UUID 格式: "{prefix}{uuid4}"
    """
    TRYON = 'tryon_'              # 试穿记录
    CLOTHING = 'cloth_'           # 服装记录
    WARDROBE = 'ward_'            # 衣橱记录
    
    # UUID 总长度（前缀 + 32位 UUID）
    TRYON_UUID_LENGTH = 42
    
    @classmethod
    def is_tryon_uuid(cls, uuid: str) -> bool:
        """是否是试穿记录 UUID"""
        return uuid.startswith(cls.TRYON) and len(uuid) == cls.TRYON_UUID_LENGTH


# ============================================
# 文件类型常量
# ============================================

class FileType:
    """
    文件类型（MIME Type）
    
    支持的图片格式
    """
    JPEG = 'image/jpeg'
    PNG = 'image/png'
    WEBP = 'image/webp'
    GIF = 'image/gif'
    HEIC = 'image/heic'           # iPhone 拍照格式
    HEIF = 'image/heif'           # iPhone 拍照格式
    
    ALL = (JPEG, PNG, WEBP, GIF, HEIC, HEIF)
    
    # MIME Type -> 扩展名映射
    EXTENSIONS = {
        JPEG: '.jpg',
        PNG: '.png',
        WEBP: '.webp',
        GIF: '.gif',
        HEIC: '.heic',
        HEIF: '.heif',
    }
    
    @classmethod
    def get_extension(cls, content_type: str) -> str:
        """获取扩展名"""
        return cls.EXTENSIONS.get(content_type, '.jpg')
    
    @classmethod
    def is_supported(cls, content_type: str) -> bool:
        """是否支持的文件类型"""
        return content_type in cls.EXTENSIONS


class FileExtension:
    """文件扩展名"""
    JPG = '.jpg'
    JPEG = '.jpeg'
    PNG = '.png'
    WEBP = '.webp'
    GIF = '.gif'
    HEIC = '.heic'
    HEIF = '.heif'
    
    ALL = (JPG, JPEG, PNG, WEBP, GIF, HEIC, HEIF)
    
    @classmethod
    def is_supported(cls, ext: str) -> bool:
        """是否支持的扩展名"""
        return ext.lower() in cls.ALL


# ============================================
# 文件大小限制
# ============================================

class FileSizeLimit:
    """
    文件大小限制（字节）
    
    设计考虑：
    - 支持高清拍照（iPhone ProRAW 等）
    - 支持大尺寸服装图片
    """
    # 最大文件大小：30MB
    MAX_FILE_SIZE = 30 * 1024 * 1024
    
    # 分类限制
    MAX_IMAGE_SIZE = 30 * 1024 * 1024      # 30MB - 普通图片
    MAX_AVATAR_SIZE = 30 * 1024 * 1024     # 30MB - 头像
    MAX_CLOTHING_SIZE = 30 * 1024 * 1024   # 30MB - 服装
    
    # 预签名 URL 有效期
    PRESIGNED_URL_EXPIRES = 86400          # 24小时
    PRESIGNED_URL_SHORT_EXPIRES = 3600     # 1小时


 # ============================================
# 错误消息
# ============================================

class ErrorMessage:
    """
    错误消息
    
    统一管理错误消息，便于国际化和维护
    """
    # Key 相关
    KEY_NOT_FOUND = '资源未找到，请重新上传'
    KEY_INVALID_FORMAT = 'Key 格式无效'
    MD5_NOT_FOUND = 'MD5 记录未找到，请重新上传'
    
    # 文件相关
    FILE_TOO_LARGE = '文件大小超出限制'
    FILE_TYPE_NOT_SUPPORTED = '不支持的文件类型'
    FILE_EMPTY = '文件内容为空'
    FILE_UPLOAD_FAILED = '文件上传失败'
    
    # 资源相关
    RESOURCE_NOT_FOUND = '资源不存在'
    AVATAR_NOT_FOUND = '头像记录未找到'
    CLOTHING_NOT_FOUND = '服装记录未找到'
    HISTORY_NOT_FOUND = '历史记录未找到'
    TRYON_RECORD_NOT_FOUND = '试穿记录未找到'
    
    # 配额相关
    QUOTA_EXCEEDED = '配额已用完'
    
    # 存储相关
    STORAGE_ERROR = '存储服务错误'
    OSS_ERROR = 'OSS 服务错误'


# ============================================
# 缓存 Key 前缀
# ============================================

class CacheKeyPrefix:
    """
    缓存 Key 前缀
    
    Redis 缓存 Key 命名规范：{prefix}:{tenant_id}:{suffix}
    """
    QUOTA = 'quota'               # 配额缓存
    MD5 = 'md5'                   # MD5 缓存
    USER = 'user'                 # 用户缓存
    SESSION = 'session'           # 会话缓存
    FILE = 'file'                 # 文件缓存
    
    SEPARATOR = ':'
    
    @classmethod
    def build_key(cls, prefix: str, *parts: str) -> str:
        """构建缓存 Key"""
        return cls.SEPARATOR.join([prefix] + list(parts))


# ============================================
# 默认值
# ============================================

class DefaultValue:
    """
    默认值
    
    系统默认配置
    """
    # 存储类型
    STORAGE_TYPE = StorageType.LOCAL
    
    # AI 引擎
    AI_ENGINE = 'seeddance'
    
    # 分页
    PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100
    
    # 试穿
    MAX_HISTORY_PER_SESSION = 20   # 每个会话最大历史记录数
    ESTIMATED_PROCESSING_TIME = 30  # 预估处理时间（秒）


# ============================================
# HTTP 状态码
# ============================================

class HttpStatus:
    """HTTP 状态码"""
    OK = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    FORBIDDEN = 403
    NOT_FOUND = 404
    INTERNAL_ERROR = 500


# ============================================
# 任务状态
# ============================================

class TaskStatus:
    """任务状态"""
    PENDING = 'pending'
    PROCESSING = 'processing'
    COMPLETED = 'completed'
    FAILED = 'failed'
    
    ALL = (PENDING, PROCESSING, COMPLETED, FAILED)
