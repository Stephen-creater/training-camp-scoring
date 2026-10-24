# 训练营打分系统 · 交接给 WorkBuddy（2026-10-24）

从现在起，训练营打分系统第二期（广州站）的后续工作全部由你接手，之前负责的 AI 不再参与。先完整读一遍本文件，再读仓库里的 `第二期交接文档.md`（第八节是最新做法，和前面几节冲突时以第八节为准）和 `README.md`。

## 一、项目在哪

- 本地仓库：`/Users/a1-6/Downloads/训练营打分系统`，GitHub：https://github.com/Stephen-creater/training-camp-scoring （公开仓库）
- 分支：`main` 是最新源码（`guangzhou` 分支和它一样，可不管）；`gh-pages` 分支是 GitHub Pages 的发布产物，由脚本生成，不要手改。
- 工作区目前是干净的，所有改动都已提交并推送。

## 二、现在的架构（已上线、已验证）

- **网页**：GitHub Pages，https://stephen-creater.github.io/training-camp-scoring/ （首页；后台 `admin.html`，抽签 `draw.html`，现场大屏 `rank.html`，颁奖 `final.html`，打分页 `score.html?token=…`）。Stephen 已用自己手机在微信里扫码确认能直接打开。
- **数据库**：你这边的应用「训练营打分-广州站」`wbapp_06KE60P5cB0lhTrGCKcONG` 的数据库（participants / scores / settings 三张表）。连接配置在 `cloud.js` 顶部。
- **WorkBuddy 托管的网页已弃用**：WorkBuddy 平台会挡掉所有来自微信的访问（返回「当前应用不支持在微信内打开」），新应用还只认带 `?sharecode=` 的链接，所以网页改放别处。camp-scoring-gz.app.workbuddy.host 现在只当数据库用。本地 `/Users/a1-6/Downloads/训练营打分-广州站发布` 是那次发布用的目录，已不用。

### 关键原理：为什么页面要套一层「沙盒外壳」

WorkBuddy 数据库**拒绝别的网址发来的请求**（请求头 Origin 不是它自己的域名就返回 403），但**接受 Origin 为 null 的请求**。所以：

- 原来的 6 个页面原样放在发布目录的 `app/` 下；
- 外层同名的 6 个 html 只是外壳（`pages/shell.js`），把 `app/` 里的页面装进 `sandbox` 的 iframe，框里发出的请求 Origin 是 null，数据库才肯收；
- 框里不能用浏览器存储，`cloud.js` 开头的代码改由外壳代存（后台登录、打分页记住是谁都正常）；地址栏和标题会跟着框里的页面变。

**只要数据库还在 WorkBuddy，网页放在任何别的域名（包括公司服务器）都必须用这套外壳**，不能直接把 6 个原始 html 放上去，否则所有读写都会 403。

### 怎么生成发布文件

```bash
cd /Users/a1-6/Downloads/训练营打分系统
bash pages/build.sh <输出目录>
```

输出目录里就是要上线的全部内容（6 个外壳 html、shell.js、.nojekyll、app/）。发 GitHub Pages：`git worktree add <目录> gh-pages`，在该目录里运行上面的脚本，然后提交、`git push`，一两分钟生效。

## 三、当前状态

- 名单 18 人（id 1–15 学员，16–18 工作人员 C哥、Stephen、李哲；`settings.staff=16,17,18`），后台口令 `baiyan2026`（只存了 SHA-256 指纹）。
- 18 张二维码在 `训练营评委二维码-广州站/`，指向 GitHub Pages 地址，已逐张识别核对。
- 首页日期固定为 2026.10.25；颁奖页背景音乐是 `assets/bgm-gz.m4a`（音量 0.2，冠军时 0.3）；颁奖页配色维持原来的绿 / 蓝 / 红（Stephen 明确说不改）。
- 数据库里现在的分数和状态以实际为准，活动可能已经开始或结束。**动任何数据之前先问 Stephen。**

## 四、接下来的任务：部署到公司服务器

C 哥（老板）担心 GitHub 在国内不稳定，要求把网页部署到公司服务器上（公司域名已备案）。数据库仍用你这边的 WorkBuddy 数据库。

1. **SSH 公钥**：Stephen 电脑上已经有 `~/.ssh/id_rsa.pub`。把这个 .pub 文件的内容原文给 Stephen，让他转给 C 哥。**只发 .pub 公钥，私钥 `~/.ssh/id_rsa` 绝不能发给任何人、不能贴进聊天。** 没有必要就不要新建密钥。
2. **向 C 哥要（通过 Stephen）**：服务器地址、登录用户名、网页放在哪个目录、对外访问网址（必须 https，后台口令校验只能在 https 下用）。C 哥说的「发一段信息」也会经 Stephen 转给你。
3. **部署**：用 `pages/build.sh` 生成发布文件，整个目录传到服务器（rsync / scp）。要包含 `app/vendor/`、`app/fonts/`、`app/assets/`。不要上传 README、交接文档、需求文档、`docs/`、`训练营评委二维码*/`、`.git/`。
4. **检查**：
   - 逐个比对线上文件和本地生成的文件（curl 下载后算 md5）；
   - 浏览器打开新网址，用 `?demo=1`（彩排模式，不读写真实分数）把六个页面走一遍：首页人数、名单、工作人员不在大屏 / 颁奖 / 打分名单里；
   - 字体文件要能跨域加载（框里是 null 源，服务器给 `fonts/` 加 `Access-Control-Allow-Origin: *`，否则数字字体会退回系统字体）；
   - 真实写分要测的话，只用 Stephen 自己的码（token `99680e4d6e`）打一分，确认写进数据库后马上删掉这一条，别动别人的分。
5. **微信实测只能请 Stephen 自己用手机做。绝对不要操作他的微信（会被封控，这是红线）。**
6. **重新生成二维码**：在**新网址**的后台（不是 localhost）登录，展开「评委二维码」，下载全部，放进新文件夹，例如 `训练营评委二维码-广州站-公司/`，文件名用人名。抽查几张，扫出来要是对应那个人的打分页。身份码不变，只是网址换成公司域名。
7. **GitHub Pages 保留当备用**：两个网址连同一个数据库，旧二维码照样能用，分数进同一个地方。

## 五、规矩（必须遵守）

- 全程中文，用大白话。Stephen 是产品经理不是工程师：先说结论，再说原因，再说需要他做什么。需要他判断的事讲清楚再问，不要让他自己去翻文件。
- **不要动第一期**：应用 `wbapp_n323oWBG80JJz3OztvKoXA`（camp-scoring.app.workbuddy.host）的代码和数据库一律不碰。
- 不改功能、不改界面、不改计分规则；任何「顺手优化」先问。
- 每做完一步就 git 提交，写清楚改了什么，推送到 GitHub。
- 改了 `cloud.js` / `theme.css` / `deco.js`，要把 6 个 html 里的 `?v=` 统一加 1（现在是 12）。
- 先上线代码，再改数据；测试一律用 `?demo=1`。
- 不要用 opencli，不要访问 BOSS 直聘。
