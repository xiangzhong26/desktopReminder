# MochiMinder

一款温柔提醒你休息、喝水和活动身体的跨平台桌面宠物。每个提醒任务都会变成一只不同颜色的史莱姆，在工作期间安静陪伴，到点时活跃地在屏幕上跑动。

![MochiMinder](assets/icon.png)

## 功能

- 一个提醒任务对应一只可拖拽、置顶显示的史莱姆桌宠
- 自定义提醒内容、间隔、颜色和启用状态
- 到点后桌宠在屏幕上活跃约 5 秒，未完成提醒会累积显示
- 点击桌宠或提示气泡完成当前动作
- 支持一天多次开始/结束工作，并按本地自然日统计有效时间
- 今日、本周、本月与累计专注时长统计
- 系统托盘常驻与可选开机启动
- 所有数据只存储在本机
- macOS DMG 与 Windows EXE 安装包构建配置

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

## 构建安装包

```bash
# 当前平台
npm run build

# macOS（生成 DMG）
npm run build:mac

# Windows（生成 NSIS EXE）
npm run build:win
```

产物位于 `release/`。macOS 和 Windows 的正式发行包建议分别在对应系统上构建并进行代码签名。推送 `v*` 标签后，GitHub Actions 会在两个系统上构建并将安装包附加到 GitHub Release。

## 数据位置

数据保存在 Electron 的应用数据目录下，文件名为 `mochiminder-data.json`：

- macOS: `~/Library/Application Support/mochiminder/`
- Windows: `%APPDATA%/mochiminder/`

## 技术栈

Electron · React · TypeScript · Vite · electron-builder

## License

[MIT](LICENSE)
