# TNT AI Sheet 需求文档

## 1. 项目概述

TNT AI Sheet 是一个 Web First、Touch First、AI Native 的轻量级电子表格项目。

项目灵感来源于 Smartisan TNT 的 “Touch and Talk” 交互理念，利用现代大语言模型、实时语音识别和触屏设备，实现自然语言驱动的电子表格交互。

核心交互理念：

**Touch 决定操作对象。**

**Talk 描述操作意图。**

**LLM 理解并执行操作。**

项目不以完整复刻 Microsoft Excel 为目标，但必须具备一个现代电子表格工具所需的基础能力，并原生支持 XLSX 工作簿。

---

# 2. 核心定位

项目核心特征：

- Web First
- Touch First
- AI Native
- XLSX 原生支持
- 实时语音识别
- LLM 全面接入
- Cursor 类 AI 侧边栏
- Skill 扩展机制
- 模块化、可替换架构
- 跨平台可移植

用户既可以使用传统鼠标、键盘和触摸操作，也可以直接通过自然语言控制表格。

AI 是表格本身的操作能力，而不是独立附加的聊天机器人。

---

# 3. 核心使用体验

典型操作：

用户打开一个 XLSX 文件。

选择 B2:B20。

长按当前选区。

说：

“把这些改成百分比，并把超过 80% 的标出来。”

系统实时显示语音识别结果。

用户松手。

LLM 自动结合当前选区、数据和格式理解指令并完成操作。

用户可以立即 Undo。

完成编辑后可以直接保存或导出 XLSX。

---

# 4. 核心产品原则

## 4.1 Touch and Talk

Touch and Talk 是核心交互方式。

Touch 用于明确操作对象。

Talk 用于表达操作意图。

系统需要自动获取：

- 当前 Workbook
- 当前 Sheet
- 当前 Selection
- 当前 Active Cell
- 选区数据
- 选区公式
- 选区格式
- 必要的附近上下文

用户不需要重复描述已经通过触摸或选择明确的信息。

---

## 4.2 AI Native

LLM 应直接参与表格操作。

AI 能够：

- 理解自然语言
- 理解表格上下文
- 读取表格
- 修改表格
- 使用公式
- 修改格式
- 排序和筛选
- 分析数据
- 执行多步操作

简单操作优先通过 Touch and Talk 完成。

复杂任务通过 AI Side Panel 完成。

---

## 4.3 保留传统表格操作

必须保留正常电子表格操作方式，包括：

- 鼠标
- 键盘
- 触摸
- 单元格编辑
- 拖选
- 复制粘贴
- 公式输入
- 工具栏
- Undo / Redo

AI 是新增输入和操作方式，而不是传统交互的替代品。

---

# 5. XLSX 文件支持

XLSX 是项目的核心文件格式。

必须支持：

- 打开 XLSX
- 读取 XLSX
- 编辑 XLSX
- 保存 XLSX
- 导出 XLSX
- 多 Sheet 工作簿

正常工作流必须能够实现：

打开 XLSX

↓

正常编辑

↓

AI 操作

↓

继续编辑

↓

保存 / 导出 XLSX

---

## 5.1 基础 XLSX 内容

需要支持常见工作簿内容，包括：

- 单元格文本
- 数值
- 日期
- 公式
- 多 Sheet
- 字体
- 字号
- 粗体
- 斜体
- 文字颜色
- 背景颜色
- 对齐
- 边框
- 数字格式
- 百分比
- 货币
- 日期格式
- 合并单元格
- 行高
- 列宽

无需以完整兼容 Excel 所有高级特性为目标。

---

# 6. 核心模块架构

系统主要划分为以下相互解耦的模块：

## 6.1 Sheet Component

负责电子表格本身。

包括：

- Workbook
- Sheet
- Cell
- Range
- Selection
- Formula
- Format
- Row / Column
- Undo / Redo
- XLSX 表格呈现与操作

Sheet 组件不负责自然语言理解。

---

## 6.2 Input Access Layer

负责统一接入各种用户输入。

包括：

- Touch
- Mouse
- Keyboard
- Voice
- Text
- Shortcut

未来可以扩展：

- Stylus
- 原生设备输入
- 外部控制方式

所有输入最终转换为统一的用户 Intent。

---

## 6.3 LLM Engine

负责调用具体大语言模型。

需要支持不同模型 Provider。

模型能力与业务逻辑解耦。

可接入：

- OpenAI
- Gemini
- Claude
- Qwen
- DeepSeek
- OpenAI Compatible API
- 本地模型
- 其他第三方模型

---

## 6.4 LLM Operation Engine

负责 AI 操作逻辑，是系统核心协调层。

主要负责：

- 接收 User Intent
- 获取 Context
- 调用 LLM
- 加载 Skill
- 调用 Tool
- 执行操作
- 处理多步骤任务
- 管理操作结果
- 协调 Undo / Transaction

---

## 6.5 Tool System

Tool 表示 AI 可以调用的基础能力。

例如：

- Read Cell
- Read Range
- Write Cell
- Write Range
- Clear Range
- Set Formula
- Set Format
- Sort
- Filter
- Insert Row
- Delete Row
- Insert Column
- Delete Column
- Create Sheet
- Rename Sheet
- Delete Sheet
- Merge Cells
- Undo
- Redo

LLM 不应直接执行任意代码。

表格修改应主要通过受控 Tool 完成。

---

## 6.6 Context System

负责向 AI 提供任务所需上下文。

包括：

- Workbook 信息
- 当前 Sheet
- 当前 Selection
- 当前 Active Cell
- 单元格内容
- 公式
- 格式
- 附近数据
- Workbook 结构
- 当前用户输入
- 当前 Skill

Context 按需提供。

避免无必要地将整个 Workbook 发送给模型。

---

# 7. Touch and Talk

基本流程：

1. 用户选择单元格或区域
2. 用户长按
3. 系统锁定当前操作目标
4. 开始实时语音识别
5. 显示实时识别文本
6. 用户讲话
7. 用户松手
8. 完成语音输入
9. LLM 理解指令
10. 执行操作
11. 显示执行结果
12. 支持 Undo

---

## 7.1 Target Lock

开始语音操作后需要锁定当前 Selection。

例如当前选择：

B2:D20

开始 Talk 后，即使手指轻微移动，也不改变本次操作目标。

---

## 7.2 实时状态

界面需要反馈：

- 正在聆听
- 实时识别文本
- 正在理解
- 正在执行
- 已完成
- 操作失败

语音识别文字需要支持 Partial Result 实时更新。

---

# 8. Speech Recognition

语音识别作为独立能力接入。

上层业务不依赖具体 ASR 实现。

可以使用：

- Web Speech
- iOS / iPadOS 系统语音能力
- Android 系统语音能力
- Windows 系统语音能力
- macOS 系统语音能力
- 在线 Streaming ASR
- 本地 ASR

---

## 8.1 语音体验目标

重点关注：

- 低延迟
- 实时 Partial Result
- 快速 Final Result
- 中文
- 英文
- 中英文混合
- 表格相关术语
- 短指令识别

LLM 可以结合当前表格 Context 对 ASR 结果进行语义纠错。

---

# 9. AI Side Panel

需要提供类似 Cursor 的 AI 侧边栏。

Side Panel 与 Touch and Talk 共用同一套：

- LLM Operation Engine
- LLM Engine
- Context System
- Tool System
- Skill System

Side Panel 不单独实现另一套 AI 逻辑。

---

## 9.1 Ask

用于咨询和分析。

例如：

“这个公式是什么意思？”

“为什么这里的结果异常？”

默认不主动修改数据。

---

## 9.2 Edit

针对当前 Workbook 或 Selection 执行修改。

例如：

“整理一下当前选区的数据格式。”

---

## 9.3 Agent

用于多步骤任务。

例如：

“按照部门汇总这些数据，并创建一个新的 Sheet 放汇总结果。”

Agent 可以连续调用多个 Tool 完成任务。

---

# 10. Skill System

系统支持添加和管理 Skill。

Skill 用于给 AI 增加特定领域或任务能力。

Tool 表示：

**AI 可以做什么。**

Skill 表示：

**AI 应该如何完成某类任务。**

---

## 10.1 Skill 可以包含

- Skill 描述
- 专用 Prompt
- 可用 Tools
- 所需 Context
- 使用规则
- Trigger
- Slash Command
- 可选快捷入口

---

## 10.2 Skill 示例

- Data Cleaning
- Formula Assistant
- Financial Analysis
- Translation
- Data Summary
- Sales Report
- Project Management
- 用户自定义 Skill

---

## 10.3 Skill 管理

支持：

- 添加 Skill
- 删除 Skill
- 启用 Skill
- 禁用 Skill
- 查看已安装 Skill

支持从本地导入 Skill。

架构上允许未来扩展：

- ZIP
- Folder
- GitHub Repository
- Online Repository
- Skill Marketplace

---

# 11. Sheet 基础功能

基础电子表格功能包括：

- 单元格编辑
- 文本
- 数值
- 日期
- 公式
- 复制
- 粘贴
- 剪切
- 删除
- Selection
- 多区域操作
- 新建 Sheet
- 删除 Sheet
- 重命名 Sheet
- 行列新增
- 行列删除
- 行高
- 列宽
- 字体
- 字号
- 粗体
- 斜体
- 颜色
- 背景
- 边框
- 对齐
- 数字格式
- 百分比
- 货币
- 基础排序
- 基础筛选
- Undo
- Redo

---

# 12. AI 典型操作

用户选择一列：

“这些加起来。”

---

用户选择一块数据：

“算一下平均值。”

---

用户选择一列：

“从大到小排。”

---

用户选择数字：

“改成百分比。”

---

用户选择区域：

“超过一万的标出来。”

---

用户选择公式：

“这个公式什么意思？”

---

用户选择数据：

“这里有没有异常？”

---

用户通过 Side Panel：

“按照部门统计总金额，再生成一个新的 Sheet。”

---

# 13. AI 操作与 Undo

AI 操作必须尽可能可撤销。

一个自然语言 Intent 即使内部执行多个 Tool，也应尽量作为一次完整用户操作处理。

例如：

“改成百分比，把超过 80% 的标红，然后降序排列。”

内部可能执行多个步骤，但用户应能够通过一次 Undo 撤销整个 AI 操作。

---

# 14. 操作安全

低风险操作可以直接执行。

例如：

- 格式调整
- 排序
- 普通公式
- 小范围写入

高风险操作可以要求确认。

例如：

- 删除整个 Sheet
- 清空大范围数据
- 覆盖大量已有内容
- 大范围结构修改

---

# 15. 本地存储

需要保存：

- 用户设置
- LLM 设置
- ASR 设置
- Skill 设置
- 最近工作状态
- 自动保存信息

API Key 等敏感信息应由独立安全存储能力管理。

---

# 16. 平台解耦

以下平台相关能力必须保持独立：

- Speech Recognition
- Microphone
- File System
- Storage
- Secret Storage
- Clipboard
- Share
- Haptics
- System Permission

核心 Sheet、LLM 和 Operation Engine 不应依赖具体操作系统。

---

# 17. Web 与跨平台

## Web

Web 是核心运行平台。

用户应可以直接通过现代浏览器访问和使用完整核心功能。

支持 PWA。

---

## Desktop

未来可封装：

- Windows
- macOS
- Linux

---

## Mobile

未来可封装：

- Android
- iOS
- iPadOS

移动端重点保持 Touch and Talk 体验。

---

# 18. Responsive / Touch UI

界面必须适配：

- Desktop
- Mobile
- Tablet
- Touchscreen PC

关键操作不能依赖 Hover。

需要考虑：

- Touch Target
- 长按
- Selection Handle
- 虚拟键盘
- Safe Area
- 屏幕方向
- Side Panel / Drawer
- 底部语音状态栏

---

# 19. 第一阶段不要求完整实现的功能

暂不要求：

- VBA
- Excel Macro
- Power Query
- 完整 Pivot Table
- 完整图表体系
- 外部数据库连接
- 企业账号系统
- 云盘
- 多人实时协作
- 企业权限系统
- Word
- PowerPoint
- 完整 Microsoft Office 插件体系
- 100% Excel 高级格式兼容

---

# 20. MVP 核心能力

MVP 必须具备：

- Web 运行
- XLSX 打开
- XLSX 编辑
- XLSX 保存 / 导出
- 基础 Sheet 编辑
- Selection
- Touch 操作
- 长按 Touch and Talk
- 实时语音识别
- Partial Transcript
- Final Transcript
- LLM 接入
- Context 获取
- Tool 调用
- AI 修改 Sheet
- Undo / Redo
- AI Side Panel
- 基础 Skill 支持
- 移动端浏览器基本可用

---

# 21. 核心验收场景

## 场景一：XLSX

用户打开一个普通 XLSX 工作簿。

Workbook 正常显示多个 Sheet、数据、基础公式和格式。

用户编辑后能够重新保存为 XLSX。

---

## 场景二：Touch and Talk

用户选择 B2:B20。

长按并说：

“从大到小排序。”

语音实时显示。

松手后系统自动完成排序。

Undo 可以完整撤销。

---

## 场景三：格式修改

用户选择一列数值。

长按并说：

“改成百分比。”

系统自动修改格式。

---

## 场景四：AI 问答

用户选择一个公式单元格。

说：

“这个怎么算出来的？”

AI 根据真实公式解释结果。

---

## 场景五：Side Panel

用户打开 AI Side Panel。

输入：

“分析当前 Sheet，找出明显异常数据。”

AI 根据 Workbook Context 返回分析结果。

---

## 场景六：多步骤操作

用户输入：

“按照部门统计金额，并创建新的 Sheet 放汇总结果。”

AI 使用多个 Tool 完成任务。

整个任务作为一个完整操作管理。

---

## 场景七：Skill

用户安装并启用一个 Data Cleaning Skill。

随后要求：

“清洗当前选区。”

AI 根据 Skill 规则、Context 和 Tools 完成任务。

---

# 22. 项目核心框架

整体逻辑：

Input Access Layer

↓

LLM Operation Engine

↓

Context System  
Skill System  
Tool System  
LLM Engine

↓

Sheet Component

外围能力包括：

AI Side Panel

Speech Recognition

File System

Storage

Platform Adapter

---

# 23. 项目目标体验

TNT AI Sheet 的核心目标不是证明：

“AI 可以重新做一个 Excel。”

而是实现：

**一个真正能够打开、编辑和保存 XLSX 的现代电子表格，同时让 Touch and Talk 成为与鼠标、键盘并列的一种自然输入方式。**

最终体验：

**Spreadsheet + XLSX + Touch and Talk + LLM + AI Side Panel + Skills**

用户指着内容说一句话，系统理解用户指的是哪里、想做什么，并直接完成操作。