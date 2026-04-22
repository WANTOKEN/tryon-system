# pip install transformers sentencepiece torch opencc-python-reimplemented
from transformers import MarianMTModel, MarianTokenizer
from typing import Dict, List, Optional
import opencc
import json
import re
import os


class MultiLangTranslator:
    """多语言翻译工具：简体中文、繁体中文、美式英文"""

    # 前端翻译文件路径
    I18N_FILE_PATH = os.path.join(os.path.dirname(__file__), 
                                   'frontend-react', 'src', 'hooks', 'useI18n.jsx')

    def __init__(self):
        # 加载翻译模型
        self.models = {}
        self.tokenizers = {}

        # 英译中模型
        self._load_model("en-zh", "Helsinki-NLP/opus-mt-en-zh")
        # 中译英模型
        self._load_model("zh-en", "Helsinki-NLP/opus-mt-zh-en")

        # 简繁转换器
        self.s2t = opencc.OpenCC('s2t')  # 简体转繁体
        self.t2s = opencc.OpenCC('t2s')  # 繁体转简体

    def _load_model(self, key: str, model_name: str):
        """加载翻译模型"""
        print(f"正在加载模型: {model_name}")
        self.tokenizers[key] = MarianTokenizer.from_pretrained(model_name)
        self.models[key] = MarianMTModel.from_pretrained(model_name)

    def _translate_with_model(self, text: str, model_key: str) -> str:
        """使用指定模型翻译"""
        tokenizer = self.tokenizers[model_key]
        model = self.models[model_key]

        inputs = tokenizer(text, return_tensors="pt", padding=True, truncation=True)
        outputs = model.generate(**inputs, max_length=512)
        return tokenizer.decode(outputs[0], skip_special_tokens=True)

    def translate(self, text: str, source_lang: str) -> Dict[str, str]:
        """
        翻译文本到其他两种语言

        Args:
            text: 输入文本
            source_lang: 源语言，可选值：
                - "zh-CN" 或 "zh_CN" 或 "简体中文"
                - "zh-TW" 或 "zh_TW" 或 "繁体中文"  
                - "en-US" 或 "en_US" 或 "美式英文"

        Returns:
            Dict: {
                "zh_CN": "简体中文内容",
                "zh_TW": "繁体中文内容",
                "en_US": "美式英文内容"
            }
        """
        # 标准化语言代码
        lang_map = {
            "zh-cn": "zh_CN", "zh_cn": "zh_CN", "简体中文": "zh_CN",
            "zh-tw": "zh_TW", "zh_tw": "zh_TW", "繁体中文": "zh_TW",
            "en-us": "en_US", "en_us": "en_US", "美式英文": "en_US", "en": "en_US"
        }

        source = lang_map.get(source_lang.lower(), source_lang)

        result = {
            "zh_CN": "",
            "zh_TW": "",
            "en_US": ""
        }

        if source == "zh_CN":
            # 输入是简体中文
            result["zh_CN"] = text
            result["zh_TW"] = self.s2t.convert(text)  # 简体转繁体
            result["en_US"] = self._translate_with_model(text, "zh-en")  # 中译英

        elif source == "zh_TW":
            # 输入是繁体中文
            result["zh_TW"] = text
            simplified = self.t2s.convert(text)  # 繁体转简体
            result["zh_CN"] = simplified
            result["en_US"] = self._translate_with_model(simplified, "zh-en")  # 中译英

        elif source == "en_US":
            # 输入是英文
            result["en_US"] = text
            simplified = self._translate_with_model(text, "en-zh")  # 英译中（简体）
            result["zh_CN"] = simplified
            result["zh_TW"] = self.s2t.convert(simplified)  # 简体转繁体

        else:
            raise ValueError(f"不支持的语言: {source_lang}")

        return result

    def translate_batch(self, items: List[Dict], key_field: str, text_field: str, 
                        source_lang: str = "zh-CN") -> Dict[str, Dict[str, str]]:
        """
        批量翻译多个文本项

        Args:
            items: 文本项列表，如 [{"key": "sub_mini", "text": "迷你裙"}, ...]
            key_field: 键名字段名
            text_field: 文本字段名
            source_lang: 源语言

        Returns:
            Dict: {
                "sub_mini": {"zh_CN": "迷你裙", "zh_TW": "迷你裙", "en_US": "Mini skirt"},
                ...
            }
        """
        results = {}
        for item in items:
            key = item[key_field]
            text = item[text_field]
            print(f"正在翻译: {key} -> {text}")
            results[key] = self.translate(text, source_lang)
        return results

    def parse_i18n_file(self) -> Dict[str, Dict[str, str]]:
        """
        解析 useI18n.jsx 文件，提取所有翻译键值对
        
        Returns:
            Dict: {
                "pageTitle": {"zh-CN": "AI虚拟试衣...", "zh-TW": ..., "en-US": ...},
                ...
            }
        """
        with open(self.I18N_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        
        result = {}
        languages = ['zh-CN', 'zh-TW', 'en-US']
        
        for lang in languages:
            # 匹配语言区块内容
            pattern = f"'{lang}':\\s*\\{{([^}}]+(?:\\{{[^}}]*\\}}[^}}]*)*)\\}}"
            match = re.search(pattern, content, re.DOTALL)
            if not match:
                print(f"未找到 {lang} 区块")
                continue
            
            block = match.group(1)
            
            # 提取所有键值对
            # 匹配格式: key: 'value' 或 key: "value"
            kv_pattern = r"(\w+):\s*['\"]([^'\"]*)['\"]"
            for kv_match in re.finditer(kv_pattern, block):
                key = kv_match.group(1)
                value = kv_match.group(2)
                
                if key not in result:
                    result[key] = {}
                result[key][lang] = value
        
        return result
    
    def find_missing_translations(self) -> Dict[str, List[str]]:
        """
        找出缺失的翻译
        
        Returns:
            Dict: {"zh-CN": [...缺失的键], "zh-TW": [...], "en-US": [...]}
        """
        translations = self.parse_i18n_file()
        
        missing = {"zh-CN": [], "zh-TW": [], "en-US": []}
        
        # 收集所有键
        all_keys = set()
        for key, langs in translations.items():
            all_keys.add(key)
        
        # 检查每个键在每种语言中是否存在
        for key in all_keys:
            for lang in ["zh-CN", "zh-TW", "en-US"]:
                if key not in translations or lang not in translations[key] or not translations[key].get(lang):
                    missing[lang].append(key)
        
        return missing
    
    def auto_complete_translations(self) -> bool:
        """
        自动补全所有缺失的翻译
        
        Returns:
            bool: 是否成功
        """
        print("\n" + "=" * 60)
        print("🔍 扫描翻译文件...")
        print("=" * 60)
        
        translations = self.parse_i18n_file()
        
        print(f"📋 共发现 {len(translations)} 个翻译键")
        
        # 找出需要补全的翻译
        to_complete = []  # [(key, source_lang, source_text, target_lang)]
        
        for key, langs in translations.items():
            zh_cn = langs.get('zh-CN', '')
            zh_tw = langs.get('zh-TW', '')
            en_us = langs.get('en-US', '')
            
            # 优先使用简体中文作为源
            if zh_cn and (not zh_tw or not en_us):
                if not zh_tw:
                    to_complete.append((key, 'zh-CN', zh_cn, 'zh-TW'))
                if not en_us:
                    to_complete.append((key, 'zh-CN', zh_cn, 'en-US'))
            # 如果没有简体中文但有繁体中文
            elif zh_tw and (not zh_cn or not en_us):
                if not zh_cn:
                    to_complete.append((key, 'zh-TW', zh_tw, 'zh-CN'))
                if not en_us:
                    to_complete.append((key, 'zh-TW', zh_tw, 'en-US'))
            # 如果只有英文
            elif en_us and (not zh_cn or not zh_tw):
                if not zh_cn:
                    to_complete.append((key, 'en-US', en_us, 'zh-CN'))
                if not zh_tw:
                    to_complete.append((key, 'en-US', en_us, 'zh-TW'))
        
        if not to_complete:
            print("\n✅ 所有翻译已完整，无需补全！")
            return True
        
        print(f"\n📝 需要补全 {len(to_complete)} 个翻译项：")
        for key, src_lang, src_text, tgt_lang in to_complete[:10]:
            print(f"   {key}: {src_lang} -> {tgt_lang}")
        if len(to_complete) > 10:
            print(f"   ... 还有 {len(to_complete) - 10} 项")
        
        # 读取文件内容
        with open(self.I18N_FILE_PATH, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 逐个补全翻译
        completed = 0
        for key, src_lang, src_text, tgt_lang in to_complete:
            try:
                # 获取翻译
                if src_lang == 'zh-CN' and tgt_lang == 'zh-TW':
                    translated = self.s2t.convert(src_text)
                elif src_lang == 'zh-TW' and tgt_lang == 'zh-CN':
                    translated = self.t2s.convert(src_text)
                elif src_lang == 'zh-CN' and tgt_lang == 'en-US':
                    translated = self._translate_with_model(src_text, "zh-en")
                elif src_lang == 'zh-TW' and tgt_lang == 'en-US':
                    translated = self._translate_with_model(self.t2s.convert(src_text), "zh-en")
                elif src_lang == 'en-US' and tgt_lang == 'zh-CN':
                    translated = self._translate_with_model(src_text, "en-zh")
                elif src_lang == 'en-US' and tgt_lang == 'zh-TW':
                    zh_cn = self._translate_with_model(src_text, "en-zh")
                    translated = self.s2t.convert(zh_cn)
                else:
                    continue
                
                # 在目标语言区块中添加翻译
                pattern = f"('{tgt_lang}':\\s*\\{{)"
                match = re.search(pattern, content)
                if not match:
                    continue
                
                # 在对应键后面添加
                # 找到同一区块中该键的位置
                key_pattern = rf"({key}:\s*['\"][^'\"]*['\"])"
                key_match_in_block = re.search(key_pattern, content)
                
                # 实际上需要在目标语言区块中添加该键
                # 简化处理：在文件中找到目标语言区块，插入缺失的键
                lang_block_pattern = f"'{tgt_lang}':\\s*\\{{([^}}]+(?:\\{{[^}}]*\\}}[^}}]*)*)\\}}"
                lang_match = re.search(lang_block_pattern, content, re.DOTALL)
                
                if lang_match:
                    # 检查该键是否已在目标区块中
                    block_content = lang_match.group(1)
                    if f"{key}:" not in block_content:
                        # 找到源语言区块中该键的值作为参考位置
                        # 在目标区块末尾插入
                        insert_pos = lang_match.end() - 1  # 在 } 之前
                        new_line = f"    {key}: '{translated}',\n"
                        content = content[:insert_pos] + new_line + content[insert_pos:]
                        completed += 1
                        print(f"   ✅ {key} ({tgt_lang}): {translated}")
                
            except Exception as e:
                print(f"   ❌ {key} 翻译失败: {e}")
        
        # 写回文件
        if completed > 0:
            with open(self.I18N_FILE_PATH, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"\n✅ 成功补全 {completed} 个翻译项！")
        
        return True

    def sync_to_i18n_file(self, translations: Dict[str, Dict[str, str]], 
                          prefix: str = "sub_") -> bool:
        """
        自动同步翻译到 useI18n.jsx 文件
        
        Args:
            translations: 翻译结果，如 {"mini": {"zh_CN": "迷你裙", ...}}
            prefix: 翻译键前缀
            
        Returns:
            bool: 是否成功
        """
        try:
            # 读取现有文件
            with open(self.I18N_FILE_PATH, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 为每种语言添加翻译
            lang_map = {
                'zh-CN': 'zh_CN',
                'zh-TW': 'zh_TW', 
                'en-US': 'en_US'
            }
            
            for lang, trans_key in lang_map.items():
                # 找到该语言区块
                pattern = f"'{lang}':\\s*\\{{"
                match = re.search(pattern, content)
                if not match:
                    print(f"未找到 {lang} 区块")
                    continue
                
                # 找到子分类区域的位置（在 sub_jewelry 或同类后面）
                insert_marker = f"{prefix}jewelry:"
                if prefix == "cat_":
                    insert_marker = f"{prefix}accessories:"
                    
                marker_match = re.search(rf"({insert_marker}[^,\n]*,?\s*\n)", content)
                
                for key, trans in translations.items():
                    full_key = f"{prefix}{key}"
                    # 检查是否已存在
                    if re.search(rf"{full_key}:", content):
                        print(f"  {lang}: {full_key} 已存在，跳过")
                        continue
                    
                    text = trans[trans_key]
                    new_line = f"    {full_key}: '{text}',\n"
                    
                    # 在 marker 后插入
                    if marker_match:
                        insert_pos = marker_match.end()
                        content = content[:insert_pos] + new_line + content[insert_pos:]
                        print(f"  {lang}: 已添加 {full_key}: '{text}'")
                    else:
                        # 如果没有找到 marker，在语言区块最后添加
                        print(f"  {lang}: 未找到插入点，请手动添加 {full_key}")
            
            # 写回文件
            with open(self.I18N_FILE_PATH, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"\n✅ 翻译已同步到 {self.I18N_FILE_PATH}")
            return True
            
        except Exception as e:
            print(f"❌ 同步失败: {e}")
            return False

    def add_translations(self, items: List[Dict], prefix: str = "sub_", 
                         source_lang: str = "zh-CN") -> bool:
        """
        一键添加新翻译：翻译并同步到文件
        
        Args:
            items: 要翻译的项列表，如 [{"key": "mini", "text": "迷你裙"}, ...]
            prefix: 翻译键前缀
            source_lang: 源语言
            
        Returns:
            bool: 是否成功
        """
        print(f"\n{'='*50}")
        print(f"🚀 开始批量翻译 {len(items)} 个项目...")
        print(f"{'='*50}\n")
        
        # 批量翻译
        translations = self.translate_batch(items, "key", "text", source_lang)
        
        # 同步到文件
        print(f"\n📝 同步到翻译文件...")
        return self.sync_to_i18n_file(translations, prefix)

    def generate_i18n_keys(self, translations: Dict[str, Dict[str, str]], 
                           prefix: str = "sub_") -> str:
        """
        生成 useI18n.jsx 格式的翻译键代码（备用，手动复制用）

        Args:
            translations: translate_batch 的返回结果
            prefix: 翻译键前缀

        Returns:
            str: 可复制到 useI18n.jsx 的代码
        """
        output = []
        
        # 简体中文
        output.append("// 简体中文")
        for key, trans in translations.items():
            output.append(f"    {prefix}{key}: '{trans['zh_CN']}',")
        
        output.append("")
        
        # 繁体中文
        output.append("// 繁体中文")
        for key, trans in translations.items():
            output.append(f"    {prefix}{key}: '{trans['zh_TW']}',")
        
        output.append("")
        
        # 英文
        output.append("// English")
        for key, trans in translations.items():
            output.append(f"    {prefix}{key}: '{trans['en_US']}',")
        
        return "\n".join(output)


# 使用示例
if __name__ == "__main__":
    import sys
    
    # 初始化翻译器（首次运行会下载模型）
    translator = MultiLangTranslator()

    # 如果命令行传入了参数，直接翻译
    if len(sys.argv) > 1 and sys.argv[1] == "--auto":
        # 自动补全所有缺失翻译
        translator.auto_complete_translations()
    elif len(sys.argv) > 1 and sys.argv[1] == "--add":
        # 添加新翻译
        # 用法: python multi_lang_translator.py --add sub_ mini 迷你裙 midi 中长裙
        prefix = sys.argv[2] if len(sys.argv) > 2 else "sub_"
        items = []
        for i in range(3, len(sys.argv), 2):
            if i + 1 < len(sys.argv):
                items.append({"key": sys.argv[i], "text": sys.argv[i+1]})
        if items:
            translator.add_translations(items, prefix=prefix, source_lang="简体中文")
    else:
        # 默认：自动补全缺失翻译
        print("\n" + "🔧 多语言翻译工具")
        print("=" * 60)
        print("用法:")
        print("  python multi_lang_translator.py --auto      # 自动补全缺失翻译")
        print("  python multi_lang_translator.py --add sub_ mini 迷你裙  # 添加新翻译")
        print("=" * 60)
        
        # 自动运行补全
        translator.auto_complete_translations()