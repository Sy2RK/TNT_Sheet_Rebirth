# 千问模型发现与 ASR 评估

评测日期：2026-10-04。针对 TNT Sheet 的“按住说话、边说边显示、松手提交一次表格指令”。

## 选择结论

建议接入专用流式 ASR，优先使用当前目录中更新的 `qwen-audio-3.1-asr-flash-message`，保留 `qwen-audio-3.1-asr-flash-streaming` 做对照。用户指定的 `qwen-audio-3.1-asr-flash-filetrans` 调用成功，但它面向整段录音文件，适合后续录音导入与长音频转写，不宜作为实时语音按钮的主模型。

这是基于接口契合度和一次合成音频实测的选择，尚不是准确率排名。最新 Message 在实际目录中的发布时间为 2026-09-21，Streaming 与 Filetrans 为 2026-09-10；时间取自服务返回的 `published_time`。本次没有接入应用语音按钮，没有录制用户真实声音。

## 模型列表与文本模型

两个服务的 Key 已写入忽略的 `config.local.json`，开发页面可自动恢复与切换；默认 DeepSeek 仍为 `deepseek-flash`，千问默认 `qwen3.8-flash`。客户端只在匹配配置中的完整 API 地址时自动使用对应 Key。生产包、PWA 资源和浏览器持久化存储均不包含这两个 Key。

千问官方 Harness 文档仍称兼容 `/models` 不可用，但本次实测返回 HTTP 200、262 个条目，混有图片与音频模型。因此改用[百炼模型目录](https://help.aliyun.com/zh/model-studio/list-models)，按 `TG`、文本输入及文本输出筛选，分页合计得到 154 个文本候选。目录随平台更新，不能把数字写死或当作完整授权证明。

[权限查询接口](https://help.aliyun.com/zh/model-studio/list-model-permissions)本次返回 0 条已授权记录，但同一 Key 的实际推理成功。因此没有用这份结果把所有模型都隐藏，也没有声称 154 个均能调用。已实测 `qwen3.8-flash` 的短回复；浏览器中 `qwen3.8-max` 在约 2.365 秒内返回合法的空操作 JSON，Flash 的真实加粗和整组撤销均通过。没有逐个推理测试整个目录。

兼容模型列表和对话接口允许跨域预检；原生目录接口预检返回 403 且无跨域许可。开发环境增加了限定本机、同源、官方目录地址与参数的中转。生产静态页面不包含开发中转；发布时需要同类后端或手动模型配置。API Key 没有写入 `VITE_*` 环境变量或源码常量。

## 同一音频的实测

输入为 Windows Huihui 合成的普通话：“请把选中的单元格加粗，然后按销售金额降序排列。”长度 6.215 秒，16 kHz、单声道、PCM16。实时测试按 100 ms 分片发送，四个模型使用 500 ms 静音阈值；Qwen 使用近场 VAD，Message 显式启用中间结果并关闭润色，未注入热词或答案上下文。

| 模型                              | 首个非空临时文字（音频发送后） | 发送结束后最后一句最终文字 | 完整转写           | 结果 |
| --------------------------------- | -----------------------------: | -------------------------: | ------------------ | ---- |
| Qwen 3.1 ASR Flash Message        |                       0.884 秒 |                   0.097 秒 | 两句合并后内容一致 | 成功 |
| Qwen 3.1 ASR Flash Streaming      |                       0.937 秒 |                   0.239 秒 | 两句合并后内容一致 | 成功 |
| Fun-ASR-Realtime-2026-02-28       |                       0.932 秒 |                   0.014 秒 | 两句合并后内容一致 | 成功 |
| Paraformer-Realtime-V2            |                       1.198 秒 |                   0.226 秒 | 两句合并后内容一致 | 成功 |
| Qwen 3.1 ASR Flash（短录音 HTTP） |                 整段提交后返回 |        请求完成约 7.704 秒 | 与输入文字一致     | 成功 |
| Qwen 3.1 ASR Flash Filetrans      |           异步任务，无实时出字 | 上传与轮询合计约 11.914 秒 | 与输入文字一致     | 成功 |

冷启动的实时服务就绪时间约 1.70–1.99 秒，未计入表中“首字”时间。发送定时器和网络有抖动，不能将表中结果当作持续性能指标，也不能用一次正确转写推出 100% 准确率。临时文字会被修正，例如 Message 最初曾返回“其”，随后改为“请把”；应用应按句更新临时文字，最终结果确认前不执行。

Filetrans 使用官方模型绑定、私有、48 小时有效的临时存储上传同一段合成音频；上传约 8.032 秒，提交任务至轮询取得结果约 3.883 秒。任务和子任务均为 `SUCCEEDED`，已读取最终 JSON。音频不含用户声音或表格内容；没有创建长期公开存储。临时上传规则见[官方说明](https://help.aliyun.com/zh/model-studio/get-temporary-file-url/)。

结构化结果保存在 `ASR_TEST_RESULTS.json`，不含 Key、上传凭证、任务标识或临时下载链接。六个调用均返回计量信息；这只是接口可用性和短指令可行性验证，没有测试真实手机、噪声、断网、长文件或多人会议。

## 横向契合度

| 方案                    | 对本项目的适用性                         | 主要取舍                                                                     |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| Qwen 3.1 Message        | 首选语音输入候选；增量文字、热词、上下文 | 中间结果默认关闭，需显式开启；先关闭原生润色，避免指令中的数字和限定词被改写 |
| Qwen 3.1 Streaming      | 实时通用候选；边说边出字、词级时间戳     | 新模型不等于已证明更准确；需要真实输入与 Message 对照                        |
| Fun-ASR-Realtime        | 已识别成功，可作中文实时对照或备选       | 按时长计费、接口成熟；最新快照与稳定别名不同，需明确固定版本                 |
| Paraformer-Realtime-V2  | 已识别成功，可作传统流式基线             | 适合评估普通话指令的成本与延迟，不能由本次单句推断整体优劣                   |
| Qwen 3.1 Flash 短录音   | 接入较简单，可作松手后的整段重试         | 上传 Base64 或 URL，无真正连续音频输入，实时交互体验较弱                     |
| Qwen 3.1 Filetrans      | 长录音、会议、文件导入最契合             | 文件 URL、异步任务、轮询，适合批处理；对短指令增加上传与任务管理成本         |
| 浏览器 Web Speech       | 保留作快速试用或可选入口                 | 不需 ASR Key，但服务可达性、浏览器实现和故障诊断受限                         |
| 本地 Qwen3-ASR / FunASR | 离线或音频需留在自有设备时优先考虑       | 需要模型、推理服务、硬件和运维，不能把 Python 模型直接放进现有浏览器适配器   |
| 豆包等其他云端 ASR      | 可作为跨厂商候选                         | 需另一套凭证与协议适配；本次没有 Key，未做接口、准确率或延迟实测             |

Message 的增量识别、上下文、热词和可选润色依据[模型说明](https://help.aliyun.com/en/model-studio/qwen-audio-3-1-asr-flash-message)与[客户端事件](https://help.aliyun.com/en/model-studio/qwen-asr-message-client-events)。Filetrans 官方规格为最长 12 小时/2 GB，并支持说话人区分；短录音 Flash 为最长 5 分钟。实时与离线能力区分见[模型总览](https://help.aliyun.com/en/model-studio/asr-model)。

Filetrans 必须带 `X-DashScope-Async: enable`，提交 `parameters`（没有选项也传 `{}`），等待任务完成后读取转写结果。短录音 HTTP 也支持响应 SSE，但这是对已提交文件的输出流，不是麦克风连续输入；短于一分钟通常只返回最终结果。参见[Filetrans 接口](https://help.aliyun.com/en/model-studio/fun-asr-recorded-speech-recognition-http-api)和[短录音接口](https://help.aliyun.com/en/model-studio/fun-asr-flash-recorded-speech-recognition-http-api)。

本地方案中，[Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR)开放 0.6B/1.7B 模型，并提供 vLLM 流式推理；[FunASR](https://github.com/modelscope/FunASR)提供流式识别、VAD、标点及部署工具。未安装或下载本地模型，未评估当前机器的实际推理性能。这些开源模型与云端 Qwen-Audio-3.1 是不同服务，不能混用型号与 API。

## 成本与接入建议

按本次北京目录的原价：Message/Streaming 输入 6 元、输出 4.5 元/百万 tokens；Flash/Filetrans 输入 0.8 元、输出 2.7 元/百万 tokens；Fun 实时快照 0.00033 元/秒；Paraformer 实时 V2 0.00024 元/秒。费用取决于地域、计量和优惠，结算以账单为准，不能仅看音频秒数横向比较 token 与时长计费。

按本次返回的计量作原价估算，Message/Streaming 各约 0.00154 元、短录音约 0.000149 元、Filetrans 约 0.000153 元、Fun 约 0.00198 元、Paraformer 约 0.00144 元。未查询账单，这些不是实际扣款声明，也不是长音频价格预测。

建议保持架构：浏览器采集 → 16 kHz 单声道音频 → 本地/服务端 ASR 中转 → 临时与最终文字 → 现有 OperationEngine → DeepSeek 或千问 → Univer。浏览器 WebSocket 不能任意设置鉴权请求头，云端 WS 需要中转或官方支持的临时授权方案；现有开发目录中转只支持模型列表，不承担 ASR 流式连接。

下一阶段应实现独立 ASR 适配器，复用当前目标锁定和一次提交机制。松手后等待最终文字，取消时释放音轨并忽略迟到结果。用真实普通话、中英混合、A1/G2、金额、百分比、否定和纠正指令对照 Message/Streaming；评估首字、松手后耗时、字符错误、关键数字错误和错误执行率，再决定默认模型。Filetrans 留给文件导入，不作为实时失败时的自动长流程。

Chrome 已授予麦克风但没有文字的最终根因仍未证实：已修复的启动/停止时序、空结果静默和错误提示会帮助定位；云端测试成功不证明 Chrome 自带的识别服务正常，也不证明用户设备的实际声音输入正常。详细判别见 `SPEECH_ASSESSMENT.md`。
