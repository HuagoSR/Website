# Website Guide

这份文档是给未来的你看的。

它会尽量把这个网站从 0 开始是怎么做起来的、现在的结构是什么、以后怎么维护，全部讲清楚。

如果你过一段时间再回来，发现很多东西已经忘了，就先看这份文档。

---

## 1. 这个网站现在是什么

这是一个用 `Astro` 做的静态个人网站，域名是：

- `https://huago.cloud`

它目前主要有这些页面：

- 首页：`/`
- 博客列表页：`/blog`
- 文章详情页：`/blog/harchimedes-ue5`
- 关于页：`/about`

这个网站的特点是：

- 不需要数据库
- 不需要后端服务常驻运行
- 构建后会生成静态文件
- 服务器只需要用 `Nginx` 直接托管这些静态文件

这也是为什么它很适合你现在这个阶段：

- 结构清楚
- 成本低
- 部署省心
- 不容易出一堆后端环境问题

---

## 2. 我们为什么选 Astro

这次没有选 Next.js、Vue 全家桶或者自己写纯 HTML，而是选了 `Astro`。

原因很简单：

1. 你现在做的是个人主页 + 博客。
2. 博客最核心的是“内容”和“展示”，不是复杂交互。
3. Astro 非常适合做静态内容站。
4. 构建出来直接就是静态文件，部署到 Linux 服务器特别方便。

一句话理解：

`Astro` 适合现在这个站，因为它更像“认真做网站”，而不是“先搭一个复杂前端框架再说”。

---

## 3. 本地开发环境当时是怎么处理的

一开始本地环境大概经历了这些步骤：

1. 确认电脑里已经有 `Node.js`
2. 确认电脑里已经有 `git`
3. 安装 `pnpm`
4. 初始化 Git 仓库
5. 用 Astro 官方模板创建站点

后来我们发现：

- 旧版 Node 不够新
- 新版 `pnpm` 对 Node 版本有要求

所以最后把本地 Node 升到了较新的版本，然后再把 `pnpm` 装好，整个环境才稳定下来。

这类问题很常见，不是你操作有问题。

前端项目里最常见的问题之一就是：

- Node 版本不合适
- 包管理器版本不合适
- PowerShell 权限/路径有问题

以后如果你再开新项目，先检查这几个就对了。

---

## 4. 这个网站的代码结构

项目根目录现在大概长这样：

- `src/`
- `public/`
- `dist/`
- `astro.config.mjs`
- `package.json`
- `deploy.ps1`
- `WEBSITE_GUIDE.md`

下面分别说一下。

### 4.1 `src/`

`src` 是网站源码最核心的目录。

里面最重要的是：

- `src/pages/`
- `src/content/`
- `src/components/`
- `src/layouts/`
- `src/styles/`
- `src/assets/`

#### `src/pages/`

这里放页面。

现在主要有：

- `src/pages/index.astro`
  首页
- `src/pages/about.astro`
  关于页
- `src/pages/blog/index.astro`
  博客列表页
- `src/pages/blog/[...slug].astro`
  博客详情页路由

你以后想改首页，就看：

- `src/pages/index.astro`

你以后想改博客列表页，就看：

- `src/pages/blog/index.astro`

#### `src/content/blog/`

这里放博客文章。

你现在的文章在：

- `src/content/blog/harchimedes-ue5.md`

以后你要写新文章，通常就是：

1. 在这里新建一个 `.md` 文件
2. 写文章标题、描述、日期
3. 写正文

#### `src/components/`

这里放可复用组件。

目前常用的有：

- `BaseHead.astro`
  处理网页标题、描述、SEO 等头部信息
- `Footer.astro`
  页脚
- `Header.astro`
  通用导航（虽然首页现在用的是自定义顶部导航）

#### `src/layouts/`

这里放页面布局。

目前最重要的是：

- `BlogPost.astro`

它控制文章详情页的整体结构。

如果你以后想统一改所有文章页样式，大概率就改这个文件。

#### `src/styles/`

这里放全局样式。

现在主要是：

- `src/styles/global.css`

它控制全站一些基础字体、字号、颜色、正文样式。

#### `src/assets/`

这里放 Astro 会参与打包处理的资源。

比如文章封面图会出现在这里。

当前项目里，文章页用到过：

- `src/assets/bambucup-key-art.png`

---

## 5. `public/` 是干什么的

`public/` 放的是“原样公开”的静态资源。

意思是：

- 它不会像 `src/assets` 那样被 Astro 特殊处理
- 会直接被复制到最终网站里

这次我们放了：

- `public/media/bambucup/`
- `public/media/home/`

比如：

- `public/media/home/hero.png`
  首页大背景图
- `public/media/bambucup/demo-main.mp4`
  项目展示视频
- `public/media/bambucup/battle-shot-2.png`
  项目截图

如果你以后还有很多图片、视频、PDF、下载文件，这类资源通常都可以放在 `public/` 下面。

---

## 6. `dist/` 是什么

`dist/` 是构建结果目录。

一句话：

`src` 是源码，`dist` 是最后能部署的成品。

当你运行：

```bash
pnpm build
```

Astro 就会把网站构建成一堆静态文件放进 `dist/`。

服务器上真正部署的就是这里面的内容。

所以以后你要记住：

- 不直接上传 `src`
- 上传的是 `dist`

---

## 7. 这个网站一开始是怎么一步步做出来的

这里按时间顺序回顾一次。

### 第一步：确认项目状态

最开始这个目录几乎是空的。

我们先确认了：

- 没有现成工程
- 不是 Git 仓库
- 没有前端脚手架

所以整个项目是从空目录开始搭的。

### 第二步：初始化 Git

先做了：

```bash
git init
```

这样项目从第一天开始就进入版本管理。

### 第三步：准备前端环境

检查并处理了：

- Node.js
- npm
- pnpm

因为 Windows + PowerShell + Node + pnpm 这套组合，常见的小坑比较多，所以我们当时也顺手处理了兼容和权限问题。

### 第四步：创建 Astro 项目

用 Astro 模板初始化了站点。

这一步帮我们快速得到：

- 页面目录
- 博客目录
- 路由结构
- 构建配置

### 第五步：修正依赖问题

项目初始化后，还处理了这些问题：

- `pnpm` 的构建脚本审批
- `sharp` / `esbuild` 构建放行
- `@astrojs/check` 安装
- 项目健康检查

最后确认：

- `astro check` 通过
- `pnpm build` 正常

### 第六步：把模板改成你的站

然后开始去掉官方模板痕迹，换成你的内容：

- 站点标题
- 站点简介
- GitHub 链接
- 首页内容
- 关于页内容

### 第七步：做第一篇文章

你原本不想写技术复盘，所以文章最终被做成了：

- 项目展示风格
- 成果介绍风格
- 带图片和视频

而且你给了额外素材：

- `BambuCup/ForDisplay` 的图片和视频
- `README.pdf`
- 展示用 PPT

这些材料帮助我们把文章写得更像一个作品展示页，而不是技术总结。

### 第八步：重新做首页

首页后来改了很多轮。

最后定下来的方向是：

- 首屏几乎只保留背景图和标题
- 背景图铺满屏幕
- 下滚时动态虚化/淡出
- 下面自然衔接到最近文章

这比一开始那种“首页解释自己是谁”的做法更适合你想要的感觉。

### 第九步：部署到服务器

最后确认服务器情况：

- 宿主机没有直接安装 Nginx
- 旧站跑在 Docker 容器 `secure-nginx` 里
- 站点配置来自：
  `/home/huagosr/my_website/conf/default.conf`
- 静态文件目录来自：
  `/home/huagosr/my_website/html`

因此最后的部署方法不是装新 Nginx，而是：

1. 本地构建 `dist`
2. 备份服务器旧站目录
3. 上传新的静态文件到 `/home/huagosr/my_website/html`
4. 重载 `secure-nginx`

---

## 8. 当前服务器的真实部署结构

这是非常重要的一节。

你以后如果忘了站是怎么挂起来的，就看这里。

### 服务器信息

- 域名：`huago.cloud`
- SSH 地址：`123.56.132.139`
- SSH 端口：`54322`
- 用户：`huagosr`

### Docker 容器

当前真正对外提供网页的是：

- 容器名：`secure-nginx`

它占用了：

- `80`
- `443`

### 挂载关系

容器里有三个关键挂载：

1. 证书目录
- 宿主机：`/etc/letsencrypt`
- 容器内：`/etc/letsencrypt`

2. Nginx 配置
- 宿主机：`/home/huagosr/my_website/conf/default.conf`
- 容器内：`/etc/nginx/conf.d/default.conf`

3. 网页目录
- 宿主机：`/home/huagosr/my_website/html`
- 容器内：`/usr/share/nginx/html`

也就是说：

- 你网站真正对外显示的文件，就在宿主机的  
  `/home/huagosr/my_website/html`

---

## 9. 现在的服务器配置大概是什么

Nginx 配置的核心逻辑非常简单：

1. `80` 端口统一跳转到 `https`
2. `443` 端口加载证书
3. 从 `/usr/share/nginx/html` 读取静态网页

这意味着：

- 你现在的网站本质上是一个纯静态站
- 不依赖服务器上跑 Node
- 不依赖数据库
- 不依赖 PM2

这是非常适合个人站的

---

## 10. 以后怎么更新网站

这是你以后最常用的部分。

### 最简单的流程

以后每次更新网站，一共做两件事：

1. 改本地代码
2. 运行部署脚本

就是这么简单。

### 第一步：改本地内容

例如你可能会改：

- 首页：`src/pages/index.astro`
- 文章：`src/content/blog/*.md`
- 图片：`public/media/...`

### 第二步：本地先看效果

运行：

```bash
pnpm dev
```

然后打开：

```text
http://localhost:4321
```

如果你只是想看改动，这一步最重要。

### 第三步：部署到服务器

在项目根目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

或者如果你的 PowerShell 允许直接执行脚本，也可以试：

```powershell
.\deploy.ps1
```

这个脚本会自动做 4 件事：

1. 本地运行 `pnpm build`
2. 备份服务器旧站
3. 上传新的 `dist`
4. 重载服务器里的 `secure-nginx`

也就是说，以后你基本不用再手敲一长串 `scp` 和 `ssh`。

---

## 11. `deploy.ps1` 脚本到底做了什么

脚本位置：

- `deploy.ps1`

它的默认参数已经写死成你现在这台服务器的配置：

- Host: `123.56.132.139`
- Port: `54322`
- User: `huagosr`
- 站点目录：`/home/huagosr/my_website/html`
- 备份目录：`/home/huagosr/my_website/html_backup`
- 容器名：`secure-nginx`

脚本内部做的事是：

### 1. 找到 pnpm

脚本会优先尝试找：

- `pnpm.cmd`
- `pnpm`

如果找不到，再去：

- `%APPDATA%\npm\pnpm.cmd`

这样做是因为 Windows 上 `pnpm` 常常装了但 PATH 不一定稳定。

### 2. 本地构建

执行：

```bash
pnpm build
```

生成新的 `dist`

### 3. 备份服务器旧站

脚本会把服务器上的：

- `/home/huagosr/my_website/html`

复制一份到：

- `/home/huagosr/my_website/html_backup`

所以如果新站有问题，你还能回滚。

### 4. 清空旧目录

它会清掉目标目录里的旧文件，避免新旧文件混在一起。

### 5. 上传新站

把本地 `dist` 内容上传到服务器的 `html` 目录。

### 6. 重载 Nginx

最后执行：

```bash
docker exec secure-nginx nginx -s reload
```

这样新站就会立即生效。

---

## 12. 如果部署后发现网站坏了怎么办

先别慌。

你有两个非常重要的退路：

### 1. 服务器有旧站备份

旧站备份目录是：

```bash
/home/huagosr/my_website/html_backup
```

如果你想手动回滚，可以这样做：

```bash
rm -rf /home/huagosr/my_website/html/*
cp -r /home/huagosr/my_website/html_backup/. /home/huagosr/my_website/html/
docker exec secure-nginx nginx -s reload
```

### 2. 本地可以重新 build

如果只是某次改动有问题：

- 回到本地修正代码
- 再执行 `deploy.ps1`

就能重新覆盖上去。

---

## 13. 以后最常见的维护任务

这里列一下你以后大概率最常做的事。

### 场景 A：新增一篇博客

做法：

1. 在 `src/content/blog/` 新建一个 `.md`
2. 写 frontmatter
3. 写正文
4. 本地 `pnpm dev` 看效果
5. 满意后运行 `deploy.ps1`

### 场景 B：改首页

重点看：

- `src/pages/index.astro`

如果你想改：

- 首屏背景
- 标题
- 最近文章区
- 滚动动画

基本都是这个文件。

### 场景 C：换图片 / 视频

如果是公开静态资源，通常放在：

- `public/media/...`

然后页面里直接引用对应路径。

### 场景 D：改文章页统一样式

重点看：

- `src/layouts/BlogPost.astro`

### 场景 E：改全局字体 / 正文字号 / 基础颜色

重点看：

- `src/styles/global.css`

---

## 14. 以后如果你想继续升级这个网站，可以做什么

下面这些都是很自然的下一步：

1. 增加更多文章
2. 把关于页认真写出来
3. 给博客加标签页
4. 做一个项目页而不只是博客页
5. 增加“归档”页面
6. 增加友链或联系方式
7. 给首页加更细腻的动效
8. 给网站增加一个受保护的 Minecraft 存档管理台

但我建议节奏是：

- 先持续写内容
- 再慢慢增加功能

因为个人站最怕的不是功能少，而是没有内容。

---

## 15. 以后如果你忘了从哪里开始，最短路径是什么

如果你将来又忘了很多东西，就按这个顺序重新上手：

1. 打开这个项目根目录
2. 先看这份 `WEBSITE_GUIDE.md`
3. 运行：

```bash
pnpm dev
```

4. 打开本地站
5. 改你要改的内容
6. 运行：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

就够了。

---

## 16. 当前最重要的文件总表

最后把关键文件集中列一遍，方便你以后快速找。

### 本地项目

- `astro.config.mjs`
  站点域名和 Astro 配置
- `package.json`
  项目脚本和依赖
- `deploy.ps1`
  一键部署脚本
- `WEBSITE_GUIDE.md`
  当前这份说明文档
- `MINECRAFT_SAVE_CONSOLE_PLAN.md`
  Minecraft 存档控制台的规划文档
- `src/pages/index.astro`
  首页
- `src/pages/blog/index.astro`
  博客列表页
- `src/layouts/BlogPost.astro`
  文章页布局
- `src/content/blog/harchimedes-ue5.md`
  现在这篇主文章
- `public/media/home/hero.png`
  首页背景图
- `public/media/bambucup/`
  项目图像、视频资源

### 服务器

- `/home/huagosr/my_website/conf/default.conf`
  当前网站 Nginx 配置
- `/home/huagosr/my_website/html`
  当前上线网站文件
- `/home/huagosr/my_website/html_backup`
  上一次站点备份
- `/home/huagosr/mc-cloud`
  Minecraft 存档版本目录，不应和网站静态文件混放

---

## 17. Minecraft 存档控制台规划入口

如果你后面准备把这个网站扩展成“受保护的 Minecraft 存档管理台”，先看：

- `MINECRAFT_SAVE_CONSOLE_PLAN.md`
- `MINECRAFT_SAVE_CONSOLE_API.md`
- `MINECRAFT_SAVE_CONSOLE_DATA_MODEL.md`
- `MINECRAFT_SAVE_CONSOLE_PHASE1_TASKS.md`

这份规划文档主要回答这些问题：

- 为什么这个功能不能只靠静态页面完成
- 为什么它应该是博客旁边的小型受保护应用
- 多世界、权限、上传、下载应该怎么拆
- 浏览器选本地存档文件夹这件事有哪些现实限制
- 最合适的分期实现顺序是什么

如果准备正式开工，推荐阅读顺序是：

1. `MINECRAFT_SAVE_CONSOLE_PLAN.md`
2. `MINECRAFT_SAVE_CONSOLE_API.md`
3. `MINECRAFT_SAVE_CONSOLE_DATA_MODEL.md`
4. `MINECRAFT_SAVE_CONSOLE_PHASE1_TASKS.md`

---

## 18. 最后一句

这个网站现在已经不是“模板站”了，而是一个真正上线、可以继续写、可以继续改、也可以继续成长的个人站。

以后你不需要记住所有技术细节。

你只需要记住三件事：

1. 内容主要在 `src`
2. 上线的是 `dist`
3. 部署用 `deploy.ps1`

剩下的，回来看这份文档就行。
