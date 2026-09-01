# dsh-shared

DSH 插件共享工具包：多插件共用的 server 端工具，消除复制粘贴（issue #45）。

## 功能

- **信任围栏** `isTrustedApiRequest(request, trustedHosts)` / `header(headers, name)` — Host-header 信任围栏（与 /api 网关一致的契约）：host 必须为 loopback 或受信权威，且 sec-fetch-site 不得为 cross-site、origin（若存在）必须与 host 同源。
- **HTTP JSON 工具** `readJsonBody(request)` / `writeJson(response, status, value)` / `writeError(response, error)` — 有界 JSON 请求体读取与 JSON 响应写入。
- **配置持久化** `currentProfile()` / `profileDirOf(profile)` / `patchFileOf(profile)` / `extractConfig(text, rowId)` / `writePatchConfig(file, rowId, config)` — cordis.patch.yml 的 YAML 子集读写（设置页保存配置，原子写 tmp+rename）。
- **项目根解析** `findProjectRoot(cwd)` — 最近 `.git` 祖先目录（项目级配置/记忆的根）。
- **异步与消息** `withTimeout(promise, ms)` / `userMessage(text)` — 超时包装（不 reject）与 user 角色消息构造。
- **原子写** `atomicWriteJson(file, value, logger, prefix)` — JSON 快照原子写（tmp+rename，自动建目录，失败仅告警）。

## 安装

`dsh-shared` 是纯工具库（`dsh.kind=library`，非 DSH 插件，无 `cordis.patch.yml`），**无需单独安装**——依赖方在 `dependencies` 声明后由 npm 自动安装（issue #72：依赖随插件安装自动安装，用户无需手动处理）。

## 使用

```js
import { isTrustedApiRequest, readJsonBody, writeJson } from 'dsh-shared'

// 路由注册时用信任围栏过滤非可信来源
const fence = (request) => isTrustedApiRequest(request, ctx.webRuntime.trustedHosts)

// 处理请求体与响应
const body = await readJsonBody(request)
writeJson(response, 200, { ok: true })
```

## 依赖方

依赖本包的插件须在 `dependencies` 声明 `dsh-shared`（issue #72：dsh-shared 是自家工具库而非宿主提供的运行时，用 dependencies 语义——npm 随插件安装自动安装，用户无需手动装；依赖先发版，见 `scripts/release.mjs` 跨插件依赖校验）：

```json
{
  "dependencies": {
    "dsh-shared": "^0.1.0"
  }
}
```

## 开发

```bash
cd plugins/dsh-shared && npm test
```
