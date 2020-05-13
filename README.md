# jest-puppeteer performance tester

It is just an extension on jest matchers that you can test your project's performance using [Jest](https://jestjs.io/) and [Puppeteer](https://pptr.dev/).
It also allows you to assert metrics for specific tasks. If they don't meet your expectations your test suite will fail.

### Prerequisites

Make sure you have installed all the following dependencies in your project:

```
yarn add --dev jest puppeteer jest-puppeteer
```

### Installing

All you need to do is to install `jest-puppeteer-performance-tester`.

```
yarn add --dev jest-puppeteer-performance-tester
```

Then add it to your `jest.config.js` file.

```json
{
  "setupFilesAfterEnv": ["jest-puppeteer-performance-tester"]
}
```

NOTE: You'll also need to set the preset to `jest-puppeteer` in order to write tests for Puppeteer in Jest environment.

```json
{
  "preset": "jest-puppeteer"
}
```

### Usage

Jest's `expect` is extended with the method `.toMatchAverageMetrics` which accept a [Metrics](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#pagemetrics) typed key/value object as a parameter.
The `expect` method itself accepts an Array or a Function of type `MetricsMatcher`. The Array is actually a Tuple of up to three items, where the first one is always the test body you want to run your assertions agains.
The second item in the Array is the "reset" function or if you want to omit that then it's the options configuration.  
The options is a key/value object where you can pass your desired configuration. Currently we only have the `repeats` property which indicated how many time to repeat the test function before calculating the average results. By default `repeats` is 1.  
See the [exmaples](#examples) for better view.

### Object definitions

#### Metrics

`Metrics` also found in the [Puppeteer API doc](https://github.com/puppeteer/puppeteer/blob/master/docs/api.md#pagemetrics) is just this:

- Timestamp <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> The timestamp when the metrics sample was taken.
- Documents <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Number of documents in the page.
- Frames <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Number of frames in the page.
- JSEventListeners <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Number of events in the page.
- Nodes <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Number of DOM nodes in the page.
- LayoutCount <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Total number of full or partial page layout.
- RecalcStyleCount <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Total number of page style recalculations.
- LayoutDuration <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Combined durations of all page layouts.
- RecalcStyleDuration <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Combined duration of all page style recalculations.
- ScriptDuration <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Combined duration of JavaScript execution.
- TaskDuration <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Combined duration of all tasks performed by the browser.
- JSHeapUsedSize <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Used JavaScript heap size.
- JSHeapTotalSize <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Total JavaScript heap size.

#### MetricsMatcher

`MetricsMatcher` is a Function or a Tuple Array with the length of 1-3 which is passed to the Jest's `expect` function.
There are three types of properties that the `.toMatchAverageMetrics` needs.

1. <[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function)> The actual portion of the test, you want to run the performance against.
2. `optional` <[function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function)> A function where you can write a set of actions to reach the state of the page to be ready for the test to be repeated.
3. `optional` <[object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Objects)> A set of options you may want to change.
   - `repeats` <[number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type)> Indicated how many times you want your Test function to run. Defaults to 1.

Or you can just pass a function which will be considered as the first item of `MetricsMatcher` and the rest will work with their default behaviours.

### <a name="examples"></a>Example

Let's test the performance of the Google search bar typing speed

```typescript
import { MetricsMatcher } from "jest-puppeteer-performance-tester"

describe("Google Performance", () => {
  test("Types into the search bar", async () => {
    await page.goto("https://google.com", { waitUntil: "networkidle0" })
    await expect<MetricsMatcher>(async () => {
      await page.type(`input[name="q"]`, `Hello World!`)
    }).toMatchAverageMetrics({
      TaskDuration: 0.06,
    })
  })

  test("Types into the search bar and repeat the proccess 10 times", async () => {
    await page.goto("https://google.com", { waitUntil: "networkidle0" })
    await expect<MetricsMatcher>([
      async () => {
        await page.type(`input[name="q"]`, `Hello World!`)
      },
      async () => {
        await page.click(`[aria-label~="clear" i]`)
      },
      {
        repeats: 10,
      },
    ]).toMatchAverageMetrics({
      TaskDuration: 0.06,
    })
  })
})
```
