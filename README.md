# JLyric - 日语歌词学习工具

轻量级桌面应用，为日语歌曲学习者提供桌面歌词悬浮窗。同时显示原文、罗马音、翻译。

## 功能

- **网易云歌词搜索导入**：搜索歌曲名，自动拉取原文 + 翻译 + 罗马音
- **本地文件导入**：支持 `.lrc`（标准歌词）、`.json`（自定义格式）、`.yaml`（自定义格式）
- **歌词编辑/补全**：编辑面板手动补全缺失的 romaji 或翻译
- **桌面歌词悬浮窗**：始终置顶、透明背景、快捷键切换歌词行

## 快速开始

```bash
cd D:/jlyric
npm install
npm start
```

开发模式（打开 DevTools）：
```bash
npm run dev
```

## 使用方式

### 导入歌词

1. **从网易云导入**：在搜索栏输入歌曲名 → 搜索 → 点击"导入"按钮
2. **从本地文件导入**：点击"导入文件"按钮，选择 `.lrc` / `.json` / `.yaml` 文件

### 显示歌词

1. 在左侧歌曲列表点击选择歌曲
2. 点击"显示歌词"按钮打开悬浮窗
3. 使用快捷键控制悬浮窗：
   - `Ctrl + Right` → 下一行
   - `Ctrl + Left` → 上一行
   - `Esc` → 关闭悬浮窗

### 编辑歌词

选择歌曲后在右侧编辑面板修改原文、罗马音、翻译。修改会在失去焦点时自动保存。

### 导出歌词

编辑面板点击"导出 JSON"可将歌词导出为标准格式。

## 自定义歌词文件格式

### JSON 格式

```json
{
  "title": "歌曲名",
  "artist": "歌手名",
  "lyrics": [
    {
      "text": "夕陽が沈む",
      "reading": "yuuhi ga shizumu",
      "translation": "夕阳西下"
    }
  ]
}
```

### YAML 格式

```yaml
title: 歌曲名
artist: 歌手名
lyrics:
  - text: 夕陽が沈む
    reading: yuuhi ga shizumu
    translation: 夕阳西下
```

## 项目结构

```
D:/jlyric/
├── main.js                # Electron 主进程
├── preload.js             # IPC 安全桥接
├── src/
│   ├── db.js              # SQLite 数据库操作
│   ├── parser.js          # LRC/JSON/YAML 解析器
│   └── api.js             # 网易云 API 封装
├── renderer/
│   ├── main.html/.css/.js # 主窗口 UI
│   └── overlay.html/.css/.js # 悬浮窗 UI
├── data/
│   └── jlyric.db          # 本地数据库
└── package.json
```

## 技术栈

- Electron 33
- sql.js（纯 JS SQLite）
- 原生 HTML/CSS/JS（无框架）

## 注意事项

- 网易云 API 为非官方接口，部分日语歌曲可能没有罗马音
- 数据存储在本地的 `data/jlyric.db`，请妥善备份
