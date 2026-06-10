# JLyric - 日语歌词学习工具 实现计划

## 项目概述

轻量级 Electron 桌面应用，为日语歌曲学习者提供桌面歌词悬浮窗。同时显示原文、翻译、罗马音，支持快捷键切换歌词行。

**目标用户**：掌握五十音但词汇量少、语法差的日语歌曲爱好者

## 技术栈

| 层面 | 选择 | 理由 |
|------|------|------|
| 框架 | Electron | 已有 Node.js，全局快捷键/透明窗口支持成熟 |
| 数据库 | better-sqlite3 | 本地轻量存储，同步 API 简单可靠 |
| UI | 原生 HTML/CSS | 无框架依赖，悬浮窗极简不需要 React/Vue |
| API 调用 | Node.js fetch (原生) | 直接调用网易云 API，无需引入 NeteaseCloudMusicApi 全量包 |

## 项目结构

```
D:/jlyric/
├── package.json              # Electron + better-sqlite3 依赖
├── electron-builder.json     # 打包配置
├── main.js                   # Electron 主进程
├── preload.js                # 预加载脚本 (IPC 安全桥接)
├── data/                     # 本地数据目录
│   ├── jlyric.db             # SQLite 数据库
│   └── images/               # 封面缓存(未来扩展)
├── renderer/                 # 渲染进程 (UI)
│   ├── main.html             # 主窗口 - 歌曲管理/导入/编辑
│   ├── main.css              # 主窗口样式
│   ├── main.js               # 主窗口逻辑
│   ├── overlay.html          # 悬浮窗 - 歌词显示
│   ├── overlay.css           # 悬浮窗样式 (透明/发光)
│   └── overlay.js            # 悬浮窗逻辑
├── src/
│   ├── api.js                # 网易云 API 封装
│   ├── db.js                 # 数据库操作
│   ├── parser.js             # 歌词解析器 (LRC/JSON/YAML)
│   └── romaji.js             # 罗马音辅助工具 (kuroshiro 备选)
├── scripts/
│   └── lrc-converter.js      # LRC 转自定义格式脚本
├── assets/                   # 静态资源
│   ├── icon.ico              # 应用图标
│   └── font/                 # 可选字体
└── README.md                 # 项目文档
```

## 数据库设计

### songs 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| title | TEXT NOT NULL | 歌曲名 |
| artist | TEXT | 歌手名 |
| netease_id | TEXT | 网易云歌曲ID(用于重新拉取) |
| cover_url | TEXT | 封面图URL |
| source | TEXT | 来源: "netease" / "lrc" / "custom" |
| created_at | INTEGER | 创建时间戳 |
| updated_at | INTEGER | 更新时间戳 |

### lyrics 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| song_id | INTEGER FK | 关联 songs.id |
| line_index | INTEGER | 行号(从0开始) |
| text | TEXT | 原文(日文) |
| reading | TEXT | 罗马音 |
| translation | TEXT | 翻译(中文) |
| timestamp | INTEGER | 时间戳(毫秒)，用于自动滚动(可选) |

```sql
CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    artist TEXT,
    netease_id TEXT,
    cover_url TEXT,
    source TEXT DEFAULT 'manual',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS lyrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL,
    line_index INTEGER NOT NULL,
    text TEXT DEFAULT '',
    reading TEXT DEFAULT '',
    translation TEXT DEFAULT '',
    timestamp INTEGER,
    FOREIGN KEY(song_id) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE(song_id, line_index)
);
```

## API 设计

### 网易云 API 接口

```javascript
// 1. 搜索歌曲
// GET https://music.163.com/api/search/get
// 参数: s=歌名, type=1, limit=10, offset=0
// 返回: { result: { songs: [{ id, name, artists: [{ name }] }] } }

// 2. 获取歌词
// GET https://music.163.com/api/song/lyric
// 参数: id=歌曲ID, os=pc, lv=-1, tv=-1, rv=-1
// 返回:
//   lrc.lyric: 原文 LRC
//   tlyric.lyric: 翻译 LRC
//   romalrc.lyric: 罗马音 LRC (部分歌曲可能为空)
```

### IPC 接口 (主进程 ↔ 渲染进程)

```javascript
// 主进程暴露的 IPC channels:
'songs:list'           // 获取所有歌曲列表
'songs:get'            // 获取单首歌曲详情(含歌词)
'songs:delete'         // 删除歌曲
'songs:search'         // 搜索网易云歌曲 { query }
'songs:import-netease' // 从网易云导入 { songId }
'songs:import-file'    // 从文件导入 { filePath, format }
'songs:update-lyric'   // 更新歌词行 { songId, lineIndex, field, value }
'overlay:show'         // 打开悬浮窗显示指定歌曲 { songId }
'overlay:close'        // 关闭悬浮窗
'overlay:navigate'     // 悬浮窗内切换行 { direction: 'up' | 'down' }
'overlay:state'        // 获取悬浮窗当前状态 { songId, currentIndex }
```

## 功能模块详细设计

### 1. 网易云歌词搜索导入

**流程**：
1. 用户在主窗口搜索框输入歌名 → 点击搜索
2. 调用网易云搜索 API → 显示歌曲列表
3. 用户选择目标歌曲 → 调用歌词 API
4. 解析三段 LRC (原文/翻译/罗马音) 按时间戳对齐
5. 存入数据库 → 显示成功提示

**LRC 解析逻辑** (`src/parser.js`)：
```
[mm:ss.xx]歌词行 → { timestamp: ms, text: "歌词内容" }
```
- 原文、翻译、罗马音按时间戳匹配（±500ms 容差）
- 如果某行缺翻译/罗马音，留空字符串，用户可后续补全

### 2. 本地文件导入

**支持格式**：

**(a) 标准 LRC 文件** (仅原文)：
```
[00:12.00]夕陽が沈む
[00:15.50]遠く君を呼ぶ
```
→ 导入后 reading 和 translation 为空，用户手动补

**(b) 自定义 JSON 格式** (完整三字段)：
```json
{
  "title": "歌曲名",
  "artist": "歌手名",
  "lyrics": [
    {
      "text": "夕陽が沈む",
      "reading": "yuuhi ga shizumu",
      "translation": "夕阳西下"
    },
    {
      "text": "遠く君を呼ぶ",
      "reading": "tooku kimi o yobu",
      "translation": "在远方呼唤你"
    }
  ]
}
```

**(c) 自定义 YAML 格式** (同上，YAML 语法)

### 3. 歌词编辑/补全

主窗口提供编辑面板：
- 表格形式展示所有歌词行 (line_index, text, reading, translation)
- 每个单元格可点击编辑
- 支持批量操作：全选复制、导出为 JSON
- 自动保存（输入框 blur 时写入数据库）

### 4. 桌面歌词悬浮窗

**窗口特性**：
- `frameless: true` - 无边框
- `transparent: true` - 透明背景
- `alwaysOnTop: true` - 始终置顶
- `clickThrough: true` - 鼠标穿透（可配置）
- `skipTaskbar: true` - 不显示在任务栏

**显示布局**：
```
┌─────────────────────────────────────┐
│  [当前行] 夕陽が沈む                 │  ← 原文 (大字)
│  yuuhi ga shizumu                   │  ← 罗马音 (中字)
│  夕阳西下                           │  ← 翻译 (中字)
├─────────────────────────────────────┤
│  [下一行] 遠く君を呼ぶ              │  ← 下一行原文 (小字)
└─────────────────────────────────────┘
```

**快捷键**：
- `Ctrl+Right` → 下一行
- `Ctrl+Left` → 上一行
- `Ctrl+Up/Down` 也可以
- `Esc` → 关闭悬浮窗
- `Ctrl+E` → 鼠标穿透切换

### 5. 全局快捷键

通过 `globalShortcut` 模块注册：
```javascript
globalShortcut.register('CommandOrControl+Right', () => {
  mainWindow.webContents.send('overlay:navigate', { direction: 'down' });
});
```

## 实现步骤

### Phase 1: 项目初始化 (约 30 min)
- [ ] `npm init` 创建 package.json
- [ ] 安装依赖: electron, better-sqlite3
- [ ] 创建 main.js 基础 Electron 窗口
- [ ] 创建 preload.js IPC 桥接
- [ ] 创建空的 SQLite 数据库初始化脚本

### Phase 2: 数据库层 (约 20 min)
- [ ] 实现 src/db.js (CRUD 操作)
- [ ] 实现 src/parser.js (LRC/JSON/YAML 解析)
- [ ] 编写基础测试验证解析正确性

### Phase 3: 网易云 API 层 (约 30 min)
- [ ] 实现 src/api.js (搜索 + 歌词获取)
- [ ] 处理 CORS / 网络请求 (使用 Node.js fetch)
- [ ] LRC 三段对齐逻辑
- [ ] 处理无罗马音的降级情况

### Phase 4: 主窗口 UI (约 1 小时)
- [ ] renderer/main.html 布局: 搜索栏 + 歌曲列表 + 编辑面板
- [ ] renderer/main.js 交互逻辑
- [ ] 搜索 → 列表展示 → 选择 → 导入 完整流程
- [ ] 文件导入功能 (LRC + JSON)
- [ ] 歌词编辑面板

### Phase 5: 悬浮窗 (约 45 min)
- [ ] renderer/overlay.html 歌词显示布局
- [ ] renderer/overlay.css 透明/发光样式
- [ ] renderer/overlay.js 行切换逻辑
- [ ] 主进程管理悬浮窗生命周期
- [ ] 全局快捷键注册

### Phase 6: 集成测试与优化 (约 30 min)
- [ ] 端到端测试: 搜索 → 导入 → 显示 → 切换
- [ ] 悬浮窗样式调优
- [ ] 错误处理: 网络失败、API 限流、数据库异常
- [ ] README.md 文档

## 关键风险与应对

| 风险 | 应对 |
|------|------|
| 网易云 API 变动 | 预留手动导入/编辑作为降级方案 |
| 部分歌曲无罗马音 | 悬浮窗隐藏罗马音行，编辑界面提示补全 |
| better-sqlite3 编译问题 | 使用 prebuild 或 electron-rebuild |
| 悬浮窗性能 | 仅渲染当前两行，不渲染全部歌词 |

## 后续扩展方向

- 自动播放同步（对接本地音乐播放器）
- 生词本功能（标记不认识的单词）
- 歌词导出（导出为 Anki 卡片格式）
- 主题/字体自定义
- 打包为 exe 安装包
