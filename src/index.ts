import type { Metrics } from "puppeteer"
import {
  matcherHint,
  printExpected,
  printReceived,
  stringify,
} from "jest-matcher-utils"

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchAverageMetrics(b: Partial<Metrics>): R
    }
  }
}

// Increase Jest test timeout because of the heavy performance testings
jest.setTimeout(60000)

interface MatcherParams {
  testFn: TMatcherFunction
  resetFn: TMatcherFunction | undefined
  options: MatcherOptions
}
type TMatcherFunction = () => void
interface MatcherOptions {
  repeats: number
}
type TMatcherTuple = [TMatcherFunction, TMatcherFunction?, MatcherOptions?]
export type MetricsMatcher = TMatcherTuple | TMatcherFunction

const METRICS = [
  "Timestamp", // <number> The timestamp when the metrics sample was taken.
  "Documents", // <number> Number of documents in the page.
  "Frames", // <number> Number of frames in the page.
  "JSEventListeners", // <number> Number of events in the page.
  "Nodes", // <number> Number of DOM nodes in the page.
  "LayoutCount", // <number> Total number of full or partial page layout.
  "RecalcStyleCount", // <number> Total number of page style recalculations.
  "LayoutDuration", // <number> Combined durations of all page layouts.
  "RecalcStyleDuration", // <number> Combined duration of all page style recalculations.
  "ScriptDuration", // <number> Combined duration of JavaScript execution.
  "TaskDuration", // <number> Combined duration of all tasks performed by the browser.
  "JSHeapUsedSize", // <number> Used JavaScript heap size.
  "JSHeapTotalSize", // <number> Total JavaScript heap size.
] as const

class Metric {
  private metrics = new Map<keyof Metrics, Set<number>>()
  constructor() {
    METRICS.forEach((metricName) => {
      this.metrics.set(metricName, new Set())
    })
  }
  add([startMetrics, endMetrics]: [Metrics, Metrics]): void {
    METRICS.forEach((metricName) => {
      this.metrics
        .get(metricName)!
        .add(endMetrics[metricName] - startMetrics[metricName])
    })
  }
  getAverageMetrics(): Metrics {
    const result = {} as Metrics
    this.metrics.forEach((value, key) => {
      result[key] = Metric.getAvgNumber(value)
    })
    return result
  }
  static getAvgNumber(set: Set<number>): number {
    let avgNum = 0
    set.forEach((n) => (avgNum += n))
    return avgNum / set.size
  }
}

const DEFAULT_OPTIONS: MatcherOptions = {
  repeats: 1,
}

function getMatcherParameters(arg: MetricsMatcher): MatcherParams {
  if (typeof arg === "function") {
    return {
      testFn: arg,
      resetFn: undefined,
      options: DEFAULT_OPTIONS,
    }
  }
  if (Array.isArray(arg)) {
    const [testFn, resetFn, options] = arg
    if (typeof resetFn === "function") {
      return {
        testFn,
        resetFn,
        options: {
          ...DEFAULT_OPTIONS,
          ...options,
        },
      }
    } else if (typeof resetFn === "object") {
      return {
        testFn,
        resetFn: undefined,
        options: {
          ...DEFAULT_OPTIONS,
          ...options,
        },
      }
    }
  }
  throw `Invalid parameters: expect([fn, fn, opts]) got expect(${stringify(
    arg
  )})`
}

function analyzeResults(
  actual: Metrics,
  expected: Partial<Metrics>
): { pass: boolean; message: () => string } {
  let pass = 1
  const message = METRICS.filter(
    (metricName) => expected[metricName] !== undefined
  ).reduce((msg, metricName) => {
    if (expected[metricName]! < actual[metricName]) {
      msg += `   Expected ${printExpected(
        `${metricName} < ${expected[metricName]}`
      )}:\n`
      msg += `   Received ${printReceived(actual[metricName])}\n\n`
      pass = pass & 0
    }
    return msg
  }, matcherHint(".toMatchAverageMetrics") + "\n\n")
  return {
    pass: Boolean(pass),
    message: (): string => message,
  }
}

expect.extend({
  async toMatchAverageMetrics(
    testObject: MetricsMatcher,
    expected: Partial<Metrics>
  ) {
    const { testFn, resetFn, options } = getMatcherParameters(testObject)
    const metric = new Metric()
    for (let iter = 0; iter < options.repeats; iter++) {
      try {
        const startMetrics = await page.metrics()
        await testFn()
        const endMetrics = await page.metrics()
        metric.add([startMetrics, endMetrics])
        if (resetFn) {
          await resetFn()
        }
      } catch (err) {
        return {
          pass: false,
          message: (): string => err,
        }
      }
    }

    const actual = metric.getAverageMetrics()
    return analyzeResults(actual, expected)
  },
})
