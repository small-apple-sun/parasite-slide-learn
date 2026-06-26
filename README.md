# 形态学识图（静态幻灯片学习站）

纯静态页面：大图 + 题号与名称（测验模式可隐藏）、题干、院标与底栏标语。适合 GitHub Pages、内网 Nginx 或 zip 离线分发。

工程习惯与常见静态识图站一致：`file://` 下用内嵌题库兜底、相对路径、复习本与快捷键。

## 访问门禁（多账号登录）

打开页面前可要求**账号 + 密码**，适合把公网链接发给约十人、每人不同口令（配置在 `auth-config.js`）。

1. 编辑 [`auth-config.js`](auth-config.js)，在 `users` 数组里为每人加一行，**只写用户名和密码的 SHA-256 哈希（小写十六进制），不要写明文密码**。
2. 在本目录生成哈希（把引号里的内容换成真实密码，可重复执行多次对应多个账号）：

   ```bash
   node tools/hash_password.js "你的密码"
   ```

3. 将输出的 64 位十六进制填入对应账号的 `passwordSha256Hex`。
4. **`users` 留空数组 `[]` 表示不启用登录**（本地开发或与旧版一致）。
5. 部署到 GitHub Pages 时须**一并提交** `auth-config.js`、`auth.js`；登录状态记在浏览器 **`sessionStorage`**（关标签页后需重登）。顶栏 **「退出登录」** 可清除本会话。
6. **复习本、统计、音效、搜索关键词、连对计数**等本地数据会带上当前登录账号（如 `parasiteSlideLearn_stats__a`），**同一浏览器内不同账号进度互不干扰**。切换账号重新登录后会刷新页面以加载对应进度。

当前默认配置了 **10 个账号** `a`～`j`，密码均为 `123`（与显微识图站一致，可按需修改）。

参考模板：[`auth-config.example.js`](auth-config.example.js)。

## 本地预览（推荐）

```bash
cd parasite-slide-learn
./serve.sh
```

浏览器打开终端里提示的地址（默认端口 `8766`，避免与显微识图默认端口冲突）。

## 离线 / 双击打开

浏览器直接打开 `index.html` 时，`fetch('data/slides.json')` 常被拦截。请先在同一目录执行：

```bash
python3 tools/embed_slides.py
```

会由 `data/slides.json` 生成 `data/slides.embed.js`。该文件已列入 `.gitignore`；**部署到 GitHub Pages（HTTPS）时只需提交 `slides.json`**，可不提交 embed 文件。

## 题库格式 `data/slides.json`

每条至少包含：`id`、`title`、`image`。可选：`prompt`、`scientific`、`notes`。

站点级文案（顶栏机构名、图内水印、底栏标语）在 `app.js` 顶部常量 `SITE` 中修改。

## 关于「按天收费 / 每天几毛钱才能用」

当前站点是**纯静态前端**（HTML/CSS/JS + JSON 题库），**无法在页面里真实实现**「每天自动扣 0.9 元才能使用」：

- 支付必须由**微信/支付宝等服务器**确认，需要**你自己的后端**（或云函数）接收支付结果，再签发「当日有效」的登录态或令牌。
- 若只在浏览器里用 `localStorage`、弹窗点「我已付款」等方式拦截，用户改本地数据或禁用脚本即可绕过，**不能当作收费依据**。

若你确实要做按日订阅，需要另建最小后端 + 官方支付接口；本仓库不包含支付逻辑。

## 从 PDF 批量抽图（图文分离）

依赖：`PyMuPDF`（`fitz`）。

本工具会智能识别 PDF 里的核心显微图片，**仅裁剪配图部分**（排除外围边框），并自动分析版面，提取图片上方的文字作为「题号与名称」、下方文字作为「题干/提示」，真正实现**文字与图片分离**。

```bash
# 智能提取（自动处理整页或多图拼版，自动分离文字与图）
python3 tools/extract_slides.py extract 你的文件.pdf --clear
```

常用参数：`--margin` 裁切外扩像素（默认 2）、`--scale` 渲染倍率（默认 2）、`--jpg-quality`（默认 82）、`--out` 指定项目根目录。

抽取结束会自动重写 `data/slides.json` 并生成 `data/slides.embed.js`。

## 分享 zip

可去掉原始 `pdfs/`、`tools/`（若接收方不需要再抽题），保留 `index.html`、`styles.css`、`app.js`、`auth.js`、`auth-config.js`、`data/`（含 `slides.json`，若需离线双击再加 `slides.embed.js`）、`assets/`。

## 部署到 GitHub Pages

本站资源均为**相对路径**，适合作为仓库根目录站点或 `username.github.io/repo名/` 子路径访问。

### 1. 在 GitHub 新建仓库

在 [github.com/new](https://github.com/new) 创建空仓库（不要勾选「添加 README」，避免推送冲突），例如名称为 `parasite-slide-learn`。

### 2. 本地推送（在本项目根目录执行）

```bash
cd parasite-slide-learn
git init
git add .
git commit -m "Initial commit: morphology study site"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

若本机 `git commit -m "..."` 报错，可改用：`printf 'Initial commit\n' | git commit -F -`

将 `<你的用户名>`、`<仓库名>` 换成实际值。若使用 SSH，把 `remote` 地址改为 `git@github.com:用户名/仓库名.git`。

### 3. 打开 GitHub Pages

打开仓库 **Settings → Pages**：

- **Build and deployment**：Source 选 **Deploy from a branch**
- **Branch**：选 `main`，文件夹选 **`/ (root)`**
- 保存后等待 1～2 分钟构建

访问地址一般为：

- 仓库名 **`parasite-slide-learn`**：`https://<用户名>.github.io/parasite-slide-learn/`
- 若仓库名为 **`<用户名>.github.io`** 且内容为站点根目录：`https://<用户名>.github.io/`

### 说明

- 已包含根目录 `.nojekyll`，避免 Jekyll 忽略部分静态文件。
- `data/slides.embed.js` 在 `.gitignore` 中，**不必提交**；线上走 HTTPS 时会直接加载 `data/slides.json`。
- 题库图片在 `assets/images/`，体积较大时首次克隆会稍慢，属正常现象。
