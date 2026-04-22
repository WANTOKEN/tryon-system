"""
完整重置并初始化数据库
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# 环境检测
env_file = os.path.join(BASE_DIR, '.env')
if not os.path.exists(env_file):
    print("错误: .env 文件不存在")
    sys.exit(1)

print("=" * 60)
print("AI 虚拟试衣系统 - 数据库完整重置")
print("=" * 60)

# 读取数据库配置
from dotenv import load_dotenv
load_dotenv()

DB_NAME = os.getenv('DB_NAME', 'tryon_system')
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '3306')

print(f"\n数据库配置:")
print(f"  主机: {DB_HOST}:{DB_PORT}")
print(f"  数据库: {DB_NAME}")
print(f"  用户: {DB_USER}")

try:
    import MySQLdb
    conn = MySQLdb.connect(
        host=DB_HOST,
        port=int(DB_PORT),
        user=DB_USER,
        passwd=DB_PASSWORD,
        charset='utf8mb4'
    )
    cursor = conn.cursor()
    
    # 删除并重建数据库
    print(f"\n[1/5] 重置数据库 {DB_NAME}...")
    cursor.execute(f"DROP DATABASE IF EXISTS {DB_NAME}")
    cursor.execute(f"CREATE DATABASE {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
    print("  ✓ 数据库已重置")
    
    cursor.close()
    conn.close()
    
except ImportError:
    print("\n[!] MySQLdb 未安装，跳过数据库重置")
    print("    请手动执行以下 SQL:")
    print(f"    DROP DATABASE IF EXISTS {DB_NAME};")
    print(f"    CREATE DATABASE {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
except Exception as e:
    print(f"\n[!] 数据库连接失败: {e}")
    print("    请确保 MySQL 服务正在运行")
    print("    如果数据库已存在，可以跳过此步骤")
    
# 删除旧的迁移文件（除了 __init__.py）
print("\n[2/5] 清理旧迁移文件...")
apps_to_clean = ['accounts', 'wardrobe', 'tryon', 'media']
for app in apps_to_clean:
    migrations_dir = os.path.join(BASE_DIR, 'apps', app, 'migrations')
    if os.path.exists(migrations_dir):
        for f in os.listdir(migrations_dir):
            if f.endswith('.py') and f != '__init__.py':
                os.remove(os.path.join(migrations_dir, f))
                print(f"  删除: apps/{app}/migrations/{f}")
print("  ✓ 迁移文件已清理")

# 设置 Django
print("\n[3/5] 执行数据库迁移...")
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
import django
django.setup()

from django.core.management import call_command

# 按顺序创建迁移
call_command('makemigrations', 'accounts', verbosity=0)
call_command('makemigrations', 'wardrobe', verbosity=0)
call_command('makemigrations', 'tryon', verbosity=0)
call_command('makemigrations', 'media', verbosity=0)
call_command('migrate', verbosity=1)

# 创建测试用户
print("\n[4/5] 创建测试用户...")
from apps.accounts.models import Merchant

if not Merchant.objects.filter(username='admin').exists():
    user = Merchant.objects.create_user(
        username='admin',
        phone='13800138000',
        password='admin123',
        store_name='演示门店',
        quota_total=100
    )
    print("  ✓ 创建管理员: admin / admin123")
else:
    print("  ✓ 测试用户已存在")

# 初始化预设数据
print("\n[5/5] 初始化预设数据...")
from apps.wardrobe.models import PresetClothing

presets = [
    {'category': 'tops', 'subcategory': 't-shirt', 'name_i18n': {'zh-CN': 'T恤', 'zh-TW': 'T恤', 'en': 'T-Shirt'}},
    {'category': 'tops', 'subcategory': 'shirt', 'name_i18n': {'zh-CN': '衬衫', 'zh-TW': '襯衫', 'en': 'Shirt'}},
    {'category': 'tops', 'subcategory': 'blouse', 'name_i18n': {'zh-CN': '女士衬衫', 'zh-TW': '女士襯衫', 'en': 'Blouse'}},
    {'category': 'tops', 'subcategory': 'sweater', 'name_i18n': {'zh-CN': '毛衣', 'zh-TW': '毛衣', 'en': 'Sweater'}},
    {'category': 'bottoms', 'subcategory': 'jeans', 'name_i18n': {'zh-CN': '牛仔裤', 'zh-TW': '牛仔褲', 'en': 'Jeans'}},
    {'category': 'bottoms', 'subcategory': 'pants', 'name_i18n': {'zh-CN': '休闲裤', 'zh-TW': '休閒褲', 'en': 'Pants'}},
    {'category': 'bottoms', 'subcategory': 'shorts', 'name_i18n': {'zh-CN': '短裤', 'zh-TW': '短褲', 'en': 'Shorts'}},
    {'category': 'dresses', 'subcategory': 'casual', 'name_i18n': {'zh-CN': '休闲连衣裙', 'zh-TW': '休閒連衣裙', 'en': 'Casual Dress'}},
    {'category': 'outerwear', 'subcategory': 'jacket', 'name_i18n': {'zh-CN': '夹克', 'zh-TW': '夾克', 'en': 'Jacket'}},
    {'category': 'outerwear', 'subcategory': 'coat', 'name_i18n': {'zh-CN': '大衣', 'zh-TW': '大衣', 'en': 'Coat'}},
    {'category': 'shoes', 'subcategory': 'sneakers', 'name_i18n': {'zh-CN': '运动鞋', 'zh-TW': '運動鞋', 'en': 'Sneakers'}},
    {'category': 'shoes', 'subcategory': 'heels', 'name_i18n': {'zh-CN': '高跟鞋', 'zh-TW': '高跟鞋', 'en': 'Heels'}},
    {'category': 'accessories', 'subcategory': 'hat', 'name_i18n': {'zh-CN': '帽子', 'zh-TW': '帽子', 'en': 'Hat'}},
    {'category': 'accessories', 'subcategory': 'bag', 'name_i18n': {'zh-CN': '包', 'zh-TW': '包', 'en': 'Bag'}},
]

created = 0
for i, p in enumerate(presets):
    _, is_new = PresetClothing.objects.get_or_create(
        category=p['category'],
        subcategory=p['subcategory'],
        defaults={'name_i18n': p['name_i18n'], 'sort_order': i}
    )
    if is_new:
        created += 1

print(f"  ✓ 创建了 {created} 个预设服装模板")

print("\n" + "=" * 60)
print("初始化完成！")
print("=" * 60)
print("\n启动后端: python manage.py runserver")
print("\n测试账号:")
print("  用户名: admin")
print("  密码: admin123")
