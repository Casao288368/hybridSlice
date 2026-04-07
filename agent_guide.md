## Hybrid SliceImport 产物与评估说明

本文件只说明当前可交付版本 `/root/hybrid-sliceImport` 的产物位置、评估结果位置，以及“下载/切片/评估”三个步骤对应入口。

---

## 一、目录与产物位置（当前真实路径）
- 项目根：`/root/hybrid-sliceImport`
- 缓存仓库：`/root/hybrid-sliceImport/cache-repos/repos/<repo>`
- 候选仓库：`/root/hybrid-sliceImport/hybrid-candidates-repos/<repo>`
- Webpack 中间产物：`/root/hybrid-sliceImport/output/<repo>/*.bundle.cjs`
- 切片产物：`/root/hybrid-sliceImport/dist/<repo>/<dep>/index.cjs`
- 评估日志：
  - `coverage/<repo>-pre.json`
  - `coverage/<repo>-post.json`
  - `coverage/results/pre-failed.txt`
  - `coverage/results/slicing-failed.txt`
  - `coverage/results/failed.txt`
  - `coverage/results/success.txt`
---

## 二、三个步骤的入口与完整流程入口

### 1) 下载待测仓库（准备阶段）

入口：
- `src_dataset/index.mjs`（核心下载与筛选）
- `aigenerate/prepare-candidates.sh`（准备脚本，适合批量）

职责：
- 从 npm 元数据构建仓库列表；
- 克隆到 `cache-repos/repos`；
- 将候选仓库放入 `hybrid-candidates-repos` 并做安装检查。

---

### 2) 切片（能力阶段）

入口：
- `src/index.mjs`

职责：
- 静态分析目标仓库；
- 生成 `output/` 和 `dist/` 产物；
- 不负责 pre/post 评估结果汇总。

---

### 3) 评估（验证阶段）

入口：
- `script-placer.sh`

职责：
- pre-test：记录 `coverage/<repo>-pre.json`
- slice：调用 `src/index.mjs`
- post-test：记录 `coverage/<repo>-post.json`
- 汇总：写 `coverage/results/*`

---

### 4) 完整流程入口（推荐）

入口：
- 单仓库：`script-placer.sh`
- 批量续跑：`aigenerate/hybrid-batch-script-placer-resume.sh`

说明：
- 单仓库交付验收时优先用 `script-placer.sh`；
- 批量实验扩展时用 `hybrid-batch-script-placer-resume.sh`。

---

## 三、三者在使用上的区别

- 下载（准备）
  - 关注“仓库是否可获取、可安装”
  - 主要输出：`cache-repos/`、`hybrid-candidates-repos/`

- 切片（生成）
  - 关注“能否产出切片代码”
  - 主要输出：`output/`、`dist/`

- 评估（验证）
  - 关注“切片前后测试是否通过”
  - 主要输出：`coverage/*` 与 `coverage/results/*`

---

## 四、最小执行示例

### 1) 下载/准备

```bash
cd /root/hybrid-sliceImport
node src_dataset/index.mjs
```

### 2) 单仓库完整评估（同时完成切片）

```bash
cd /root/hybrid-sliceImport
./script-placer.sh "./hybrid-candidates-repos/levn"
```

### 3) 查看结果

```bash
cd /root/hybrid-sliceImport
cat coverage/results/success.txt
```

---

## 五、`/root/joern-integration` 与 `hybrid-sliceImport` 的关系

本项目的“混合切片”在切片时会调用 Joern 做静态可达性增强。
- 切片代码入口：`hybrid-sliceImport/src/joernSlice.mjs`
- Joern 接口依赖：代码中当前直接导入 `/root/joern-integration/index.mjs`（绝对路径）

使用位置：
./script-placer.sh "./hybrid-candidates-repos/levn" 会调用 node src/index.mjs
而 src/index.mjs 里有 import { getSliceWithJoern } from './joernSlice.mjs';
后续切片流程调用 getSliceWithJoern(...)

---

## 六、为什么没有使用 `script.sh`，以及如何替代

`script.sh` 是早期“单体批处理”脚本，核心能力是：
- 从 `minableRepositories2.csv` 读取仓库列表；
- 从 `cache-repos/repos` 复制到 `hybrid-candidates-repos`；
- 在候选仓库执行 `npm install`；
- 直接调用 `node src/index.mjs` 做切片，并用 `.done` 做处理标记。

当前交付文档不再把它作为主入口，原因是：
- `script.sh` 主要面向“批量处理与切片”，不直接产出规范化的 pre/post 评估汇总；
- 交付验收更关心 `coverage/<repo>-pre.json`、`coverage/<repo>-post.json` 与 `coverage/results/*`；
- 现有流程已拆分为“准备”和“评估”两个更清晰的入口，便于单仓库复现与批量续跑。

替代关系（推荐）：
- **准备阶段**：使用 `aigenerate/prepare-candidates.sh`（承接原 `script.sh` 的仓库准备逻辑）；
- **单仓库完整评估**：使用 `script-placer.sh <repo_path>`（包含 pre-test -> slice -> post-test -> 结果汇总）；
- **批量续跑评估**：使用 `aigenerate/hybrid-batch-script-placer-resume.sh`（循环调用 `script-placer.sh`，并支持已处理跳过）。

---

## 七、`aigenerate` 中辅助脚本说明（`run-slicer.mjs` / `batch.mjs` / `cache.mjs`）

这三个脚本属于“辅助能力”，主要服务于实验脚本与手动调试，不是交付验收主链路的必经入口。

### 1) `aigenerate/run-slicer.mjs`

功能：
- 对单个项目路径直接执行切片流程（收集调用 -> 生成切片），本质是一个“轻量 CLI 入口”。

使用场景：
- 你只想验证某个仓库能否切片；
- 不需要 pre/post 测试与 `coverage/results/*` 汇总。

最小用法：
```bash
cd /root/hybrid-sliceImport
node aigenerate/run-slicer.mjs "/root/hybrid-sliceImport/hybrid-candidates-repos/levn"
```

说明：
- 该脚本会调用 `src/index.mjs` 的切片核心能力；
- 但不会替代 `script-placer.sh` 的完整评估职责。

### 2) `aigenerate/batch.mjs`

功能：
- 提供通用批处理函数 `processPromisesBatch(items, limit, asyncCallback)`；
- 将大任务按批次并发执行，避免一次性并发过高；
- 可选写入批次进度日志（`cache-repos/progress.txt`）。

使用场景：
- 给分析脚本（如 `aigenerate/analysis/rq*.mjs`）复用；
- 控制并发、提升稳定性。

说明：
- `batch.mjs` 是“工具模块”，通常不会直接命令行单独执行。

### 3) `aigenerate/cache.mjs`

功能：
- 提供缓存函数 `cacheFunctionOutput(fileName, asyncCallback, silent, passthrough)`；
- 将计算结果存到 `cache-repos/<fileName>`，下次命中可直接复用。

使用场景：
- 实验分析反复运行时减少重复计算（例如 cloc 统计、批量分析结果）；
- 缩短重复实验时间。

说明：
- `cache.mjs` 同样是“工具模块”，一般由分析脚本导入调用，不作为主入口直接运行。

### 与主交付流程的关系

- 主交付与验收仍以 `script-placer.sh`（单仓库）和 `aigenerate/hybrid-batch-script-placer-resume.sh`（批量续跑）为准；
- `run-slicer.mjs`/`batch.mjs`/`cache.mjs` 是辅助层，保留用于调试与分析即可。
