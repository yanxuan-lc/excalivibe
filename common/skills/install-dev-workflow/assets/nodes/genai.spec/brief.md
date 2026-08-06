# 写出下游各自独立构建所依据的四份契约

组合 **`dev-toolkit:spec-guideline`**——它定义四份契约、各自落在哪、每段多少算够，以及验收场景的稳定 ID 规则。不要在这里重新推导。

数据模型找 `dev-toolkit:dba-guideline`，模块结构找 `dev-toolkit:coding-guideline`，服务集成面找 `dev-toolkit:middleware-guideline`。

**不适用的段落要写出「不适用」**，不能省略——省略和遗漏在读者眼里一模一样。

门控会跑完整性检查，它只判断「写没写」，不判断「写得对不对」。绿色不等于设计是对的。
