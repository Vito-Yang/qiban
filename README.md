# 栖伴 Qiban · Personal Agent

参考 [Today](https://today.ai/) 的个人助理体验，使用 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 官方 TypeScript SDK。中文界面，适配手机和桌面。

## 启动

需要 Node.js 24.9+。

```powershell
npm install
Copy-Item .env.example .env
# 在 .env 填入 DEEPSEEK_API_KEY
npm start
```

打开 http://127.0.0.1:3000 ，在左侧「设置」中输入 API Key 和模型名称，保存后直接生效，也可保留原有的 .env 配置方式。页面保存的配置优先于 .env。没有密钥时进入演示模式。

页面保存的密钥以明文保存在已忽略的 `.data/settings.json`，不会通过 API 回传，也不存入浏览器 localStorage；设置页可更新或清除密钥。已配置仅表示保存成功，不表示已验证模型连接。

## 已实现

- 今日概览：根据当前未完成任务提供本地行动提示。
- 任务：添加、完成，刷新后保留。
- 个人记忆：添加和删除偏好、目标；每次对话附带这些上下文。
- 对话：官方 Harness SDK 驱动真实 agent，保留会话和历史。
- 能力页：展示真实配置状态和未接入能力。

数据保存在 `.data/state.json`，Harness 运行数据在 `.data/harness`；密钥只读取服务端 `.env`，不传给浏览器。数据以本机明文保存，对话时任务和记忆会发送给配置的模型服务。服务仅监听本机地址，适合单人本地使用，不应直接暴露到公网。

## 结构

`server.mjs` 是 Node HTTP 服务及 Harness 适配层，`public/` 是无构建依赖的前端。SDK 固定版本，避免开发预览阶段默认标签与最新 API 不一致。Harness 启动可能需要 pnpm 进行运行时插件准备。

本版不包含邮箱/日历连接、后台定时执行、跨设备控制、自动提取记忆或 agent 直接修改任务。本版尚未提供原生审批和提问的 Web 交互桥接，涉及这些交互的工具可能失败；不会自动授予额外权限。

## 验证

```powershell
node --check server.mjs
node --check public/app.js
npm test
```

真实模型端到端测试需要有效的 DeepSeek API key。


依赖审计：2026-11-03 检测到 197 项传递依赖告警（187 high、10 moderate），主要涉及 MCP client、fflate、undici、zod 的依赖链；详见 dependency-audit.json。部署前需升级兼容的 Harness 版本并重新审计。


## 自定义模型接口

「设置」支持接口 URL、模型名称、获取模型列表和测试连接。支持兼容 OpenAI Chat Completions 的服务。URL 去掉末尾 `/` 和 `/chat/completions` 后，分别追加 `/models` 和 `/chat/completions`；保留 `/v1` 等自定义路径。

获取列表与测试使用表单草稿，不会保存设置。密钥留空使用已保存密钥；接口域名发生变化时需重新填写密钥。测试会发送一条简短消息，可能产生少量费用；不发送任务、记忆或历史。20 秒超时，拒绝重定向，错误信息不包含服务商响应原文。

实际对话仍由 Harness SDK 执行，通过 `dsh-llm-pi-ai` 的 `qiban-api` 路由接入，协议为 `openai-completions`。生成的 `.data/provider.patch.json` 不包含密钥，使用环境变量引用。修改配置后重建 Harness 运行时，会话文本保留，下一次对话以新配置开启运行时会话并带入最近历史。测试连接验证模型接口，不验证 Harness 工具执行能力。

对话会自动保存在本机，侧栏可重新打开。页面会记住所选对话，首次进入且已有历史时打开最近一段对话；只有点击「开启新对话」才会清空当前选择。发送失败后重试沿用已保存的对话。

