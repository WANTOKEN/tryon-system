// 子分类配置
export const subcategoryMap = {
  tops: [
    { id: 't-shirt', i18nKey: 'sub_tshirt' },
    { id: 'shirt', i18nKey: 'sub_shirt' },
    { id: 'sweater', i18nKey: 'sub_sweater' },
    { id: 'tank', i18nKey: 'sub_tank' },
    { id: 'hoodie', i18nKey: 'sub_hoodie' },
  ],
  bottoms: [
    { id: 'jeans', i18nKey: 'sub_jeans' },
    { id: 'trousers', i18nKey: 'sub_trousers' },
    { id: 'shorts', i18nKey: 'sub_shorts' },
    { id: 'skirt', i18nKey: 'sub_skirt' },
  ],
  dresses: [
    { id: 'casual', i18nKey: 'sub_casual' },
    { id: 'formal', i18nKey: 'sub_formal' },
    { id: 'knit', i18nKey: 'sub_knit' },
  ],
  outerwear: [
    { id: 'jacket', i18nKey: 'sub_jacket' },
    { id: 'coat', i18nKey: 'sub_coat' },
    { id: 'blazer', i18nKey: 'sub_blazer' },
  ],
  shoes: [
    { id: 'sneakers', i18nKey: 'sub_sneakers' },
    { id: 'heels', i18nKey: 'sub_heels' },
    { id: 'boots', i18nKey: 'sub_boots' },
    { id: 'flat', i18nKey: 'sub_flat' },
  ],
  accessories: [
    { id: 'bag', i18nKey: 'sub_bag' },
    { id: 'hat', i18nKey: 'sub_hat' },
    { id: 'scarf', i18nKey: 'sub_scarf' },
    { id: 'jewelry', i18nKey: 'sub_jewelry' },
  ],
}

// 分类图标 SVG path - 服装专用图标
export const categoryIcons = {
  // 上衣 - T恤图标
  tops: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6l4-2h8l4 2M4 6v12a2 2 0 002 2h12a2 2 0 002-2V6M8 4v4m8-4v4M8 8c0 2 2 4 4 4s4-2 4-4"/>',
  // 下装 - 裤子图标
  bottoms:
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 4h12v2H6V4zM6 6v14a2 2 0 002 2h2V10m4 12h2a2 2 0 002-2V6M10 22V10m0 0h4"/>',
  // 连衣裙 - 裙子图标
  dresses:
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 2a3 3 0 100 6 3 3 0 000-6zM8 8l-3 14h14l-3-14H8z"/>',
  // 外套 - 开衫/夹克图标
  outerwear:
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6l3-2h10l3 2M4 6v12a2 2 0 002 2h12a2 2 0 002-2V6M7 4v6m10-6v6M4 6l3 3m13-3l-3 3M12 9v11"/>',
  // 鞋子 - 运动鞋
  shoes:
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16h18M3 16l2-4h14l2 4M8 12V7h8v5M12 7v5"/>',
  // 配饰 - 配饰图标（包/帽子）
  accessories:
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2zM8 8V6a4 4 0 018 0v2"/>',
  // 自定义上传
  custom_upload:
    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
}

// 分类列表
export const categories = [
  { id: 'tops', i18nKey: 'cat_tops' },
  { id: 'bottoms', i18nKey: 'cat_bottoms' },
  { id: 'dresses', i18nKey: 'cat_dresses' },
  { id: 'outerwear', i18nKey: 'cat_outerwear' },
  { id: 'shoes', i18nKey: 'cat_shoes' },
  { id: 'accessories', i18nKey: 'cat_accessories' },
]
