# Mac 降级 Node.js 到版本 18 的方法

## 当前状态
- 当前 Node.js 版本：v22.2.0
- 当前 npm 版本：10.7.0
- 目标版本：Node.js 18.x

---

## 方法一：直接下载安装（推荐，最简单）

### 步骤：

1. **下载 Node.js 18**
   - 访问：https://nodejs.org/dist/v18.20.2/
   - 下载 macOS 安装包：`node-v18.20.2.pkg`
   - 文件大小约 30MB

2. **安装**
   - 双击下载的 `.pkg` 文件
   - 按照安装向导完成安装
   - 会自动覆盖旧版本

3. **验证安装**
   ```bash
   node --version  # 应该显示 v18.20.2
   npm --version   # 应该显示 9.x 或 10.x
   ```

---

## 方法二：使用 nvm（Node Version Manager）

### 1. 安装 nvm

**方式 A：使用安装脚本**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

**方式 B：使用 Homebrew（如果有权限）**
```bash
brew install nvm
```

### 2. 配置 nvm

在 `~/.zshrc` 或 `~/.bash_profile` 中添加：
```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. 安装 Node.js 18
```bash
# 重新加载配置
source ~/.zshrc

# 安装 Node.js 18
nvm install 18

# 切换到 Node.js 18
nvm use 18

# 设置为默认版本
nvm alias default 18

# 验证
node --version
```

---

## 方法三：使用 n (Node version manager)

### 1. 安装 n
```bash
# 如果有权限问题，使用 sudo
sudo npm install -g n
```

### 2. 安装 Node.js 18
```bash
# 安装 Node.js 18
sudo n 18

# 验证
node --version
```

---

## 推荐方案

### ✅ 最简单：方法一（直接下载安装）
- 无需处理权限问题
- 图形界面安装，简单直观
- 自动覆盖旧版本

### ✅ 最灵活：方法二（使用 nvm）
- 可以在多个 Node.js 版本之间切换
- 不需要 sudo 权限
- 每个项目可以使用不同的 Node.js 版本

---

## 常见问题

### 1. 权限问题
如果遇到权限问题，可以：
- 使用 `sudo` 命令
- 修复 Homebrew 权限：
  ```bash
  sudo chown -R $(whoami) /usr/local/*
  ```

### 2. 版本切换
使用 nvm 可以轻松切换版本：
```bash
nvm list          # 查看已安装的版本
nvm use 18        # 切换到 Node.js 18
nvm use 22        # 切换到 Node.js 22
nvm alias default 18  # 设置默认版本
```

### 3. 项目特定版本
在项目根目录创建 `.nvmrc` 文件：
```
18
```

然后使用：
```bash
nvm use
```

---

## 验证安装

安装完成后，运行以下命令验证：

```bash
# 检查 Node.js 版本
node --version
# 应该显示：v18.20.2

# 检查 npm 版本
npm --version
# 应该显示：9.x 或 10.x

# 检查 Node.js 路径
which node
# 应该显示：/usr/local/bin/node 或 ~/.nvm/versions/node/v18.20.2/bin/node
```

---

## 项目兼容性

Node.js 18 是 LTS（长期支持）版本，适合大多数项目：

- ✅ React 18+
- ✅ Vue 3+
- ✅ Next.js 12+
- ✅ Vite 4+
- ✅ 大多数现代前端项目

---

## 下载链接

- Node.js 18 LTS: https://nodejs.org/dist/v18.20.2/
- nvm GitHub: https://github.com/nvm-sh/nvm
- n GitHub: https://github.com/tj/n

---

## 建议

对于你的项目（AI Virtual Try-On），建议：

1. **开发环境**：使用 Node.js 18 LTS
2. **生产环境**：使用 Node.js 18 LTS 或 20 LTS
3. **版本管理**：推荐使用 nvm，方便切换版本

---

**最后更新：** 2026-04-24
