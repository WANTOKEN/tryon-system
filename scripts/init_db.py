"""
数据库初始化脚本
"""
import os
import sys
import django

# 将项目根目录添加到 Python 路径
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

# 设置 Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command


def init_database():
    """初始化数据库"""
    print("=" * 50)
    print("开始初始化数据库...")
    print("=" * 50)

    # 1. 先创建迁移（指定应用顺序）
    print("\n[1/4] 创建迁移文件...")
    
    # accounts 必须最先迁移（因为其他模型依赖 Merchant）
    call_command('makemigrations', 'accounts', verbosity=1)
    call_command('makemigrations', 'wardrobe', verbosity=1)
    call_command('makemigrations', 'tryon', verbosity=1)
    call_command('makemigrations', 'media', verbosity=1)

    # 2. 执行迁移
    print("\n[2/4] 执行数据库迁移...")
    call_command('migrate', verbosity=1)

    # 3. 创建测试用户
    print("\n[3/4] 创建测试用户...")
    from apps.accounts.models import Merchant
    from apps.wardrobe.models import PresetClothing

    if not Merchant.objects.filter(username='admin').exists():
        user = Merchant.objects.create_user(
            username='admin',
            phone='13800138000',
            password='admin123',
            store_name='演示门店',
            quota_total=100
        )
        print(f"✓ 创建管理员: admin / admin123")
    else:
        print("✓ 测试用户已存在")

    # 4. 初始化预设数据
    print("\n[4/4] 初始化预设数据...")
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

    created_count = 0
    for i, preset in enumerate(presets):
        _, created = PresetClothing.objects.get_or_create(
            category=preset['category'],
            subcategory=preset['subcategory'],
            defaults={
                'name_i18n': preset['name_i18n'],
                'sort_order': i,
            }
        )
        if created:
            created_count += 1

    print(f"✓ 创建了 {created_count} 个预设服装模板")

    print("\n" + "=" * 50)
    print("数据库初始化完成！")
    print("=" * 50)
    print("\n测试账号:")
    print("  用户名: admin")
    print("  密码: admin123")
    print("\n启动服务器:")
    print("  python manage.py runserver")


if __name__ == '__main__':
    try:
        init_database()
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
