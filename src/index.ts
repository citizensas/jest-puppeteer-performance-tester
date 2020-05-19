import type { Metrics } from "puppeteer"
import {
  matcherHint,
  printExpected,
  printReceived,
  stringify,
  RECEIVED_COLOR,
  EXPECTED_COLOR,
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
type TMatcherTuple =
  | [TMatcherFunction, TMatcherFunction?, MatcherOptions?]
  | [TMatcherFunction, MatcherOptions?]
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
  private metrics = new Map<keyof Metrics, number[]>()
  private metricSize = 0
  constructor() {
    METRICS.forEach((metricName) => {
      this.metrics.set(metricName, [])
    })
  }
  add([startMetrics, endMetrics]: [Metrics, Metrics]): void {
    METRICS.forEach((metricName) => {
      this.metrics
        .get(metricName)!
        .push(endMetrics[metricName] - startMetrics[metricName])
    })
    this.metricSize++
  }
  getMetricSize() {
    return this.metricSize
  }
  getAverageMetrics(): Metrics {
    const result = {} as Metrics
    this.metrics.forEach((value, key) => {
      result[key] = Metric.getAvgNumber(value)
    })
    return result
  }
  getMetrics(): Record<keyof Metrics, number[]>
  getMetrics(metricName: keyof Metrics): number[]
  getMetrics(metricName?: keyof Metrics) {
    if (metricName) {
      return this.metrics.get(metricName)
    }
    const returnValue = {} as Record<keyof Metrics, number[]>
    this.metrics.forEach((metricValues, metricName) => {
      returnValue[metricName] = metricValues
    })
    return returnValue
  }
  static getAvgNumber(set: number[]): number {
    let avgNum = 0
    set.forEach((n) => (avgNum += n))
    return avgNum / set.length
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
  metric: Metric,
  expected: Partial<Metrics>
): { pass: boolean; message: () => string } {
  let pass = 1
  const avgMetrics = metric.getAverageMetrics()
  const message = METRICS.filter(
    (metricName) => expected[metricName] !== undefined
  ).reduce((msg, metricName) => {
    if (expected[metricName]! < avgMetrics[metricName]) {
      msg += `   Expected ${printExpected(
        `${metricName} < ${expected[metricName]}`
      )}:\n`
      msg += `   Received ${printReceived(avgMetrics[metricName].toFixed(5))}\n`
      if (metric.getMetricSize() > 1) {
        msg += `   All Metrics: `
        msg +=
          metric
            .getMetrics(metricName)
            .map((metricValue) => {
              if (expected[metricName]! < metricValue) {
                return RECEIVED_COLOR(metricValue.toFixed(3))
              }
              return EXPECTED_COLOR(metricValue.toFixed(3))
            })
            .join(" ") + `\n\n`
      } else {
        msg += `\n`
      }
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

    return analyzeResults(metric, expected)
  },
})
