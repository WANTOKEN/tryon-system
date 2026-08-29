"""
业务常量：服装分类、颜色标签
前端与后端统一引用，保证分类顺序/中文名、颜色标签一致。
"""

# 服装分类（固定顺序）：上装 -> 下装 -> 连衣裙 -> 外套 -> 鞋 -> 配饰
CLOTHING_CATEGORIES = [
    {
        "id": "tops",
        "name": "上装",
        "subcategories": [
            {"id": "t-shirt", "name": "T恤"},
            {"id": "shirt", "name": "衬衫"},
            {"id": "sweater", "name": "毛衣"},
            {"id": "hoodie", "name": "卫衣"},
            {"id": "polo", "name": "Polo衫"},
        ],
    },
    {
        "id": "bottoms",
        "name": "下装",
        "subcategories": [
            {"id": "pants", "name": "长裤"},
            {"id": "jeans", "name": "牛仔裤"},
            {"id": "shorts", "name": "短裤"},
            {"id": "skirt", "name": "半身裙"},
        ],
    },
    {
        "id": "dresses",
        "name": "连衣裙",
        "subcategories": [
            {"id": "mini", "name": "短裙"},
            {"id": "midi", "name": "中长裙"},
            {"id": "maxi", "name": "长裙"},
        ],
    },
    {
        "id": "outerwear",
        "name": "外套",
        "subcategories": [
            {"id": "jacket", "name": "夹克"},
            {"id": "coat", "name": "大衣"},
            {"id": "down", "name": "羽绒服"},
            {"id": "blazer", "name": "西装"},
        ],
    },
    {
        "id": "shoes",
        "name": "鞋",
        "subcategories": [
            {"id": "sneakers", "name": "运动鞋"},
            {"id": "boots", "name": "靴子"},
            {"id": "heels", "name": "高跟鞋"},
            {"id": "flats", "name": "平底鞋"},
        ],
    },
    {
        "id": "accessories",
        "name": "配饰",
        "subcategories": [
            {"id": "hat", "name": "帽子"},
            {"id": "bag", "name": "包袋"},
            {"id": "scarf", "name": "围巾"},
            {"id": "glasses", "name": "眼镜"},
        ],
    },
]

# 颜色标签：name 为存入数据库的值，hex 用于前端色块展示
COLOR_TAGS = [
    {"name": "黑色", "hex": "#111827"},
    {"name": "白色", "hex": "#F9FAFB"},
    {"name": "灰色", "hex": "#9CA3AF"},
    {"name": "米色", "hex": "#E7DCC9"},
    {"name": "卡其色", "hex": "#C3B091"},
    {"name": "棕色", "hex": "#92400E"},
    {"name": "红色", "hex": "#DC2626"},
    {"name": "粉色", "hex": "#EC4899"},
    {"name": "橙色", "hex": "#EA580C"},
    {"name": "黄色", "hex": "#FACC15"},
    {"name": "绿色", "hex": "#16A34A"},
    {"name": "蓝色", "hex": "#2563EB"},
    {"name": "牛仔蓝", "hex": "#1E3A8A"},
    {"name": "紫色", "hex": "#7C3AED"},
]

COLOR_NAME_SET = {c["name"] for c in COLOR_TAGS}
CATEGORY_ID_SET = {c["id"] for c in CLOTHING_CATEGORIES}
