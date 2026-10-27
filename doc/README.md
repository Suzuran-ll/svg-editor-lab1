# Lab1 Phase 1：SVG CLI 编辑器

## 架构方案

采用 TypeScript 面向对象设计，分为 domain、commands、application、cli、infrastructure 五个模块。使用 Command、Composite 和 Memento；具体规则随实现验证更新。

## 过程记录

- 2026-10-27：用户确认 TypeScript 初学者、无额外依赖限制，SVG 仅支持基础六类与规定属性，复杂 SVG 明确拒绝。
- 2026-10-27：确认工作目录为空，PATH 中没有 Node/npm。开始准备项目内运行环境、严格类型检查、CLI 与测试骨架。

## 一致性自查

尚在实现中，最终验收时据实填写。

## 质量保证手段

采用 Node 内置测试运行器，按阶段增加领域、命令、SVG 与会话测试。
