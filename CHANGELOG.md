# Changelog

All notable changes to [camunda-worker-node](https://github.com/nikku/camunda-worker-node) are documented here. We use [semantic versioning](http://semver.org/) for releases.

## Unreleased

___Note:__ Yet to be released changes appear here._

## 5.0.0

### Breaking Changes

* `FEAT`: replace `pollingDelay` option with `autoPoll=(true|false)` ([`3e444c00`](https://github.com/nikku/camunda-worker-node/commit/3e444c00444c7f40074fb9fff1384a872650cdab))
* `FEAT`: rename `lockTime` option to `lockDuration` to match Camunda wording ([`9f4765ca`])(https://github.com/nikku/camunda-worker-node/commit/9f4765ca9b352719e339eda59a307b721915bcf2))


## 4.0.1

* `FIX`: properly serialize boolean variables ([#12](https://github.com/nikku/camunda-worker-node/issues/12))

## 4.0.0

### Breaking Changes

* `FEAT`: don't wait for task completion between polls (use the [`Backoff`](./lib/backoff.js) extension to temporarily suspend polling if a specified number of `maxActiveTasks` is active) ([#11](https://github.com/nikku/camunda-worker-node/issues/11))

### Other Improvements

* `FEAT`: add [`Auth`](./lib/auth.js) and [`BasicAuth`](./lib/basic-auth.js) middlewares
* `FEAT`: expose active tasks via metrics
* `FEAT`: add `Workers#configure` API for dynamic options tuning
* `DOCS`: considerable documentation improvements

## 3.0.0

* `FEAT`: move `pollingInterval` update to [Backoff](./lib/backoff.js) extension ([`ffae85c6`](https://github.com/nikku/camunda-worker-node/commit/ffae85c6aa95e0f3fe9bfcd48146e03a8e2b1d5b))
* `CHORE`: add default log output to workers

## 2.1.0

* `FEAT`: add metrics plug-in
* `FEAT`: add greedy re-schedule on maxTasks fetch
* `FIX`: consistently pass timings to `poll:done`
* `FIX`: start tracing poll time on poll start

## 2.0.0

This is a major rewrite of camunda-worker-node ([`a5d1f275`](https://github.com/nikku/camunda-worker-node/commit/a5d1f27510b79751bb77751216c145a7cd2bc942)).

### Breaking Changes

* `CHORE`: unify event names and parameters
* `CHORE`: rename numerous API methods and make a few async
* `CHORE`: rewrite to ES6 / require `async/await` support; stick to version `v1.1.0` if you are locked in onto ES5

### Other Improvements

* `FEAT`: collect and log timings
* `FEAT`: control poll re-scheduling via `pollInterval` config
* `CHORE`: detect and report invalid life-cycle transitions
* `CHORE`: use fetch for Camunda REST api calls
* `FIX`: make task execution fail-safe


## 1.1.0

* `FEAT`: add ability to extend task locks ([`56e42e6a`](https://github.com/nikku/camunda-worker-node/commit/56e42e6ac6bc5db6178866f7d39e0f09cf4edb7a))

## 1.0.1

* `DOCS`: improve example

## 1.0.0

* `FEAT`: support promises returned from workers and async functions
* `CHORE`: handle synchronously thrown errors

## 0.7.0

* `FEAT`: allow task completion with [BPMN error](https://docs.camunda.org/manual/7.8/reference/rest/external-task/post-bpmn-error/) ([`9a7fff9a`](https://github.com/nikku/camunda-worker-node/commit/9a7fff9a801454890726fa94c8e9f70210bcae17))
* `DOCS`: add various documentation improvements

## 0.6.0

* `FEAT`: change date serialization to match Camunda 7.8+ format ([`ecbc53e9`](https://github.com/nikku/camunda-worker-node/commit/ecbc53e94e689c1ca75a6bfc3ee280bd90b6e28a))
* `CHORE`: add `LICENSE` file

## 0.5.0

* `FEAT`: fetch all variables per default

## 0.4.0

* `FIX`: correct failure callback url
* `CHORE`: treat response codes `>= 400` as errors

## ...

Check `git log` for earlier history.
