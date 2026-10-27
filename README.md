# SVG 命令行编辑器 · 高级软件 Lab 1

这是一个用 TypeScript 编写的 SVG 编辑器。在终端输入命令，可以创建图形、分组、移动、缩放、撤销和保存 SVG。程序使用 Node.js 运行，保存的 SVG 可以用浏览器查看。

课程截止日期：**2026 年 10 月 31 日**，具体截止时刻尚未提供。架构、设计模式、真实开发记录和验收说明见 [doc/README.md](doc/README.md)。

## 1. 准备环境并运行

本项目的工作目录是 `/Users/suzuran/GSQ_mac/高级软件lab`。运行环境、依赖、缓存、编译结果和测试临时文件都保存在这个目录内，不需要全局安装 Node 或 TypeScript。

当前目录已经准备了 Node.js **24.22.1**。打开终端，运行：

```sh
cd '/Users/suzuran/GSQ_mac/高级软件lab'
source scripts/env.sh
npm run cli
```

看到 `svg>` 后，输入 `help` 查看命令。结束时，在空白输入行按 **Ctrl-D**，也就是发送 EOF；脚本输入读完后也会自动结束。`quit`、`exit` 不是本作业定义的编辑器命令。

如果刚从 GitHub 克隆项目，`.tools` 和 `node_modules` 不会随 Git 下载。先在克隆后的项目目录运行：

```sh
bash scripts/setup.sh
source scripts/env.sh
npm run cli
```

`setup.sh` 根据锁定版本准备项目内 Node 环境并执行 `npm ci`；需要联网下载。`source scripts/env.sh` 让当前终端使用项目内的 `node`、`npm`，并把 npm 缓存及临时目录指向本项目。**每次新开终端都需要重新 source**。如果仅需按锁文件重装 npm 依赖，执行 `npm ci` 即可。

几个常用入口：

| 命令 | 用途 |
|---|---|
| `npm run cli` | 编译后启动编辑器 |
| `npm run build` | 将 `src/` 和 `tests/` 的 TypeScript 编译到 `dist/` |
| `npm test` | 编译并运行 Node 内置测试 |
| `npm run check:architecture` | 检查模块依赖、循环引用和类文件命名 |

TypeScript 的 `.ts` 文件是源代码；Node 运行的是编译后的 `.js` 文件。开发时修改 `src/`，不要直接修改 `dist/`。

## 2. 从一个小图开始

在 `svg>` 中逐行输入以下命令。代码块里的内容不需要加提示符。

```text
init 800 600
create g demo
create rect card 40 40 240 120 lightblue in demo
create text title 60 90 "你好 SVG" in demo
move demo 20 10
undo
redo
tree
save .tmp/first.svg
```

`demo` 是容器，矩形和文字是它的子图形。`move demo` 会同时移动两个子图形；`undo` 撤销整次移动，`redo` 恢复。最终文件位于项目内 `.tmp/first.svg`，可以用浏览器打开。

**文件路径始终相对于项目根目录解析**，带空格的路径使用双引号。保存时父目录必须已经存在；`read`、`save` 不允许越过项目边界，指向外部的符号链接也会被拒绝。

### 创建图形

尖括号表示必须替换的参数，方括号表示可选参数；输入时不写括号。

| 图形 | 命令 |
|---|---|
| 矩形 | `create rect <id> <x> <y> <w> <h> [fill]` |
| 圆 | `create circle <id> <cx> <cy> <r> [fill]` |
| 椭圆 | `create ellipse <id> <cx> <cy> <rx> <ry> [fill]` |
| 线段 | `create line <id> <x1> <y1> <x2> <y2> [stroke]` |
| 文字 | `create text <id> <x> <y> "content"` |
| 容器 | `create g <id>` |

每一种创建命令都可以在末尾追加 `in <containerId>`。例如 `create circle dot 100 100 20 #ff0000 in demo`。

ID 区分大小写、不能为空、不能含空白，且整个文档中不能重复。坐标可以为负；宽高、半径和描边宽度不能为负；画布尺寸与缩放因子必须大于零。所有数值必须有限。

### 编辑与查看

| 命令 | 含义 |
|---|---|
| `init [w] [h]` | 新建文档，缺省为 800 × 600 |
| `read <file.svg>` | 读取项目内的 SVG，成功后替换当前文档 |
| `save [file.svg]` | 保存；省略路径时使用最近成功读取或保存的路径 |
| `canvas [w h]` | 无参数时查看画布；两个参数时修改画布尺寸 |
| `move <id> <dx> <dy>` | 按偏移量移动图形或整组 |
| `scale <id> <factor>` | 以画布原点 `(0,0)` 为基准，缩放坐标与尺寸 |
| `set <id> <attr> <value>` | 修改允许的属性 |
| `delete <id>` | 删除图形；删除容器会一并删除整个子树 |
| `group <newGid> <id1> <id2>...` | 把至少两个节点合并进一个新容器 |
| `ungroup <gid>` | 解散嵌套容器，把子节点提升到原位置 |
| `addto <gid> <id>` | 把已有节点移入目标容器末尾 |
| `front <id>` / `back <id>` | 将节点移到同层最前景／最后景 |
| `tree [id]` | 查看全树或指定节点子树 |
| `show <id>` | 查看节点属性及父容器 |
| `undo` / `redo` | 撤销／重做一次编辑 |
| `help` | 查看帮助，无文档时也可使用 |

SVG 按兄弟节点顺序绘制：`front` 移到列表末尾，`back` 移到开头。分组按操作前的树遍历顺序收编成员，与参数先后无关；跨父容器分组时，新组放到最近公共祖先下、最早受影响分支的位置。禁止同时选中祖先与后代、重复选择节点，或把容器移入自身及其后代。按照题面约定，**根级容器不能直接 `ungroup`**。

`set` 的属性白名单如下；其中 `width`、`height` 必须写全，不能使用 `w`、`h`：

| 对象 | 可修改属性 |
|---|---|
| 全部六类 | `fill`、`stroke`、`stroke-width` |
| `rect` | 另有 `x`、`y`、`width`、`height` |
| `circle` | 另有 `cx`、`cy`、`r` |
| `ellipse` | 另有 `cx`、`cy`、`rx`、`ry` |
| `line` | 另有 `x1`、`y1`、`x2`、`y2` |
| `text` | 另有 `x`、`y`、`text` |
| `g` | 只有三个公共样式属性 |

`set demo fill blue` 设置容器自身的样式，子图形通过 SVG 的继承机制使用它；子图形显式指定的颜色保持优先。`scale` 递归修改几何属性，不缩放描边宽度；字体属性不在本阶段白名单中。

文字与路径用双引号包围以保留空格；`""` 表示空文字。双引号内使用 `\"` 表示引号，`\\` 表示反斜杠。例如：

```text
set title text "他说：\"你好\""
set card fill #ffffff
save ".tmp/my drawing.svg"
```

只有去除行首空白后以 `#` 开头的**整行**才是注释；`#ffffff` 这样的颜色不会被截断。不要在命令末尾追加注释。

### 撤销边界与错误

每次成功编辑对应一个撤销单元。成功执行新的编辑会清空 redo；失败的命令保留原文档和历史。`tree`、`show`、`help` 和无参数 `canvas` 不改变历史。

成功执行 **`init`、`read`、`save`、`canvas w h`** 会清空并锁定历史，直到下一次成功编辑后重新解锁。因此，在刚刚 `save` 后执行 `undo` 会报告 `undo not allowed after io command`，这是本作业要求的行为。`init` 也会清除默认保存路径。

报错以 `error:` 开头，输出到标准错误，每条错误保持一行；编辑器随后继续接收命令。交互终端显示 `svg>`，脚本输入不显示提示符。

## 3. 回放样例与理解限制

运行随项目提供的两个完整命令脚本：

```sh
npm run cli < examples/flowchart.commands
npm run cli < examples/demo.commands
```

第一个生成 `.tmp/flowchart.svg`，包含两个流程节点、文字和连接线。第二个生成 `.tmp/demo.svg` 并读取 `examples/other.svg`；其中两次错误是有意保留的验收场景：祖先与后代不能一起分组，以及保存后不能立即撤销。

编辑器支持的 SVG 子集是 `rect`、`circle`、`ellipse`、`line`、`text`、`g` 及上述属性。根节点允许 `width`、`height`、`viewBox` 和 SVG 命名空间；画布尺寸可写数值或 `px`，图形几何属性使用无单位数值。`viewBox` 可以省略，或者必须与 `0 0 width height` 一致。

缺少 ID 的节点会被补为 `rect1`、`g1` 等，并输出警告；编号会避让整个文件中的显式 ID。显式 ID 重复会使导入失败。中文和 XML 特殊字符会通过 XML 库处理。

`path`、`transform`、`style`、`font-size`、`font-family`、`tspan`、嵌套 `svg` 等超出范围的内容会明确报错，原文档保留。插件机制与 `box` 图形尚未实现。这是本次选定的基础 SVG 实现范围；若课程要求导入任意绘图软件导出的 SVG，需要先向教师确认并扩展支持范围。

验证代码时运行：

```sh
npm run build
npm test
npm run check:architecture
```

测试覆盖图形与树结构、命令历史、SVG 往返读写、路径边界和真实 CLI 会话。2026-10-27 验收时 **67 项测试全部通过**，架构检查通过；流程图经离线 SVG 渲染器检查，中文、颜色、节点位置和连接线正常。后续修改后的结果以重新运行 `npm test` 为准。

## 4. 文件位置与 GitHub 提交

| 位置 | 内容 |
|---|---|
| `src/` | 五个模块和程序入口 |
| `tests/` | 自动测试 |
| `examples/` | 可回放命令和输入 SVG |
| `doc/README.md` | 课程要求的四部分文档 |
| `doc/architecture.puml` | PlantUML 组件图源文件 |
| `scripts/` | 环境准备与架构检查 |
| `.tools/`、`.cache/`、`.tmp/` | 项目内工具、缓存、临时产物，均不提交 Git |
| `node_modules/`、`dist/` | 安装依赖与编译结果，均不提交 Git |

要建立 GitHub 仓库，登录 GitHub 后选择 **New repository**，填写仓库名，例如 `svg-editor-lab1`，按课程要求选择公开或私有。因为本地项目已经有 Git 历史，创建远程仓库时不要勾选自动生成 README、`.gitignore` 或 License。创建完成后，复制仓库的 HTTPS 或 SSH 地址。

本项目的交付仓库为 [Suzuran-ll/svg-editor-lab1](https://github.com/Suzuran-ll/svg-editor-lab1)。当前本地仓库已将它配置为 `origin`。后续修改提交后可执行：

```sh
git remote -v
git push -u origin main
```

如果 `origin` 已存在，先运行 `git remote -v` 确认它的用途，再决定是否修改，不要重复添加。GitHub 会按当前终端配置要求登录；不要把账号密码或访问令牌写进项目文件。

最终验收通过后，以本地 `final` 标签标记交付版本，并推送它：

```sh
git log --oneline --decorate -8
git show final --stat
git push origin final
```

`git show final` 可用于确认标签是否已创建且指向正确提交。尚无标签时，先确认最终提交已完成，再执行 `git tag -a final -m "Lab 1 final submission"`；已有标签不要重复创建。分支推送和标签推送是两件事，截止前需要确认 GitHub 上两者都可见。
