# Changelog

All notable changes to [camunda-worker-node](https://github.com/nikku/camunda-worker-node) are documented here. We use [semantic versioning](http://semver.org/) for releases.

## Unreleased

___Note:__ Yet to be released changes appear here._

## 0.8.0

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
