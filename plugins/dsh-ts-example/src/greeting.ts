/**
 * dsh-ts-example — greeting 纯函数（server 端逻辑）。
 *
 * 独立成模块以演示：TS 模块拆分 + 类型检查（interface / 联合类型 /
 * 可选参数）+ 单元测试直接 import 编译产物。
 */

/** 问候语选项。 */
export interface GreetingOptions {
  /** 问候对象（首尾空白会被去除）。 */
  name: string
  /** 问候语言（默认英文）。 */
  language?: 'zh' | 'en'
}

/** 生成问候语：空名回退默认问候，非空名去除首尾空白后拼接。 */
export function buildGreeting(options: GreetingOptions): string {
  const name = options.name.trim()
  if (name === '') {
    return options.language === 'zh' ? '你好，DSH！' : 'Hello, DSH!'
  }
  return options.language === 'zh' ? `你好，${name}！` : `Hello, ${name}!`
}
