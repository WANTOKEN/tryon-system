"""
自定义 JSON 日志格式化器
支持字段排序、颜色输出和更灵活的配置
"""
import json
import os
import sys
from pathlib import Path
from pythonjsonlogger import jsonlogger
from collections import OrderedDict


# ANSI 颜色代码
class LogColors:
    """日志颜色配置"""
    RESET = '\033[0m'
    BOLD = '\033[1m'

    # 日志级别颜色
    DEBUG = '\033[36m'      # 青色
    INFO = '\033[32m'       # 绿色
    WARNING = '\033[33m'    # 黄色
    ERROR = '\033[31m'      # 红色
    CRITICAL = '\033[35m'   # 紫色

    # 字段颜色
    TIMESTAMP = '\033[90m'  # 暗灰色
    LEVEL = '\033[1m'       # 粗体
    LOCATION = '\033[36m'   # 青色
    MESSAGE = '\033[0m'     # 默认
    KEY = '\033[34m'        # 蓝色（JSON 键）
    STRING = '\033[32m'     # 绿色（字符串值）
    NUMBER = '\033[33m'     # 黄色（数字值）


def should_use_color():
    """检测是否应该使用颜色输出"""
    # 检查环境变量
    if os.getenv('NO_COLOR'):
        return False
    if os.getenv('FORCE_COLOR'):
        return True
    # 检查是否是 TTY
    return sys.stdout.isatty()


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """
    自定义 JSON Formatter,支持字段排序和路径简化
    
    默认字段顺序:
    1. timestamp - 时间戳
    2. level - 日志级别
    3. location - 代码位置(相对路径:行号)
    4. message - 日志消息
    5. 其他字段...
    """
    
    def __init__(self, *args, **kwargs):
        # 定义字段顺序 (精简版)
        self.field_order = [
            'timestamp',
            'level', 
            'location',
            'message',
        ]
        # 需要移除的冗余字段
        self.exclude_fields = [
            'file',       # 已合并到 location
            'line',       # 已合并到 location
            'filepath',   # 已合并到 location
            'logger',     # 通常不重要
            'function',   # 通常不重要
            'app',        # static_fields 可以去掉
            'taskName',   # Celery 特有,非 Celery 日志不需要
        ]
        # 获取项目根目录
        self.project_root = self._get_project_root()
        super().__init__(*args, **kwargs)
    
    def _get_project_root(self):
        """获取项目根目录"""
        # 从当前文件向上查找,找到包含 manage.py 的目录
        current_path = Path(__file__).resolve()
        for parent in current_path.parents:
            if (parent / 'manage.py').exists():
                return parent
        # 如果找不到,返回当前工作目录
        return Path.cwd()
    
    def add_fields(self, log_record, record, message_dict):
        """
        重写 add_fields 方法,添加自定义的 location 字段
        """
        super().add_fields(log_record, record, message_dict)
        
        # 构建相对路径
        if hasattr(record, 'pathname'):
            full_path = record.pathname
            try:
                # 转换为相对路径
                rel_path = os.path.relpath(full_path, self.project_root)
                # 替换反斜杠为正斜杠(Windows 兼容)
                rel_path = rel_path.replace('\\', '/')
            except ValueError:
                # 如果在不同驱动器,使用文件名
                rel_path = record.filename
            
            # 组合成 "相对路径:行号" 格式
            line_number = getattr(record, 'lineno', 0)
            log_record['location'] = f"{rel_path}:{line_number}"
    
    def jsonify_log_record(self, log_record):
        """
        重写 JSON 序列化方法,实现字段排序和过滤
        """
        # 创建有序字典
        ordered_record = OrderedDict()

        # 1. 首先添加预定义顺序的字段
        for field in self.field_order:
            if field in log_record:
                ordered_record[field] = log_record[field]

        # 2. 添加其他字段(排除不需要的字段)
        for key, value in log_record.items():
            if key not in self.field_order and key not in self.exclude_fields:
                ordered_record[key] = value

        # 检查是否使用颜色
        if not should_use_color():
            return json.dumps(ordered_record, ensure_ascii=False, default=str)

        # 带颜色的格式化输出
        return self._format_with_colors(ordered_record)

    def _format_with_colors(self, record):
        """带颜色的格式化输出"""
        level = record.get('level', 'INFO')
        level_color = getattr(LogColors, level, LogColors.INFO)

        parts = []

        for key, value in record.items():
            if key == 'timestamp':
                # 时间戳：暗灰色
                parts.append(f'{LogColors.TIMESTAMP}"timestamp": "{value}"{LogColors.RESET}')
            elif key == 'level':
                # 日志级别：带级别颜色
                parts.append(f'{LogColors.LEVEL}{level_color}"level": "{value}"{LogColors.RESET}')
            elif key == 'location':
                # 位置：青色
                parts.append(f'{LogColors.LOCATION}"location": "{value}"{LogColors.RESET}')
            elif key == 'message':
                # 消息：带级别颜色
                msg_value = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else f'"{value}"'
                parts.append(f'{level_color}"message": {msg_value}{LogColors.RESET}')
            else:
                # 其他字段：键蓝色，值根据类型着色
                value_str = self._colorize_value(value)
                parts.append(f'{LogColors.KEY}"{key}"{LogColors.RESET}: {value_str}')

        return '{' + ', '.join(parts) + '}'

    def _colorize_value(self, value):
        """根据值类型着色"""
        if isinstance(value, str):
            return f'{LogColors.STRING}"{value}"{LogColors.RESET}'
        elif isinstance(value, (int, float)):
            return f'{LogColors.NUMBER}{value}{LogColors.RESET}'
        elif isinstance(value, bool):
            return f'{LogColors.NUMBER}{str(value).lower()}{LogColors.RESET}'
        elif value is None:
            return f'{LogColors.NUMBER}null{LogColors.RESET}'
        elif isinstance(value, (list, dict)):
            return f'{LogColors.STRING}{json.dumps(value, ensure_ascii=False)}{LogColors.RESET}'
        else:
            return f'{LogColors.STRING}"{str(value)}"{LogColors.RESET}'
