# proofs

**主張を反証可能にし、その成立範囲と限界を再利用可能な資産として残す。**

## Purpose

契約・設計・実装・実行環境の主張を、再現可能な検証と証拠へ結びつける。
成立・反例・未検証を区別し、次の変更でも使える検証方法を育てる。

## Assets

| 型 | 残すもの |
|---|---|
| **Boundary** | 実行環境・依存関係・条件を外した対照実験 |
| **Semantics** | 性質・前提・不変条件・禁止状態・反例 |
| **Evidence** | 検査対象と検査器の固定版・実行結果・適用範囲・限界 |

## Principles

- 正常例と破壊例を対にし、検査器自身の見逃しも調べる。
- 結果を入力・前提・scope・実装版・検査器版に結び付ける。
- 未実行・未証明・期限切れ・範囲外を成功にしない。
- 既存の証拠の型を再利用し、必要性が実証されたときだけ型を増やす。
- proofsは採否・merge・作用の権限も、他リポジトリの意味の正本も持たない。

## Growth

1つのPRで1つの検証課題を閉じる。対象を増やすときは既存の型を使い、表現できない性質が見つかったときだけ新しい型と反例を追加する。

**Goal:** 検証を蓄積するほど、次の主張をより少ない費用で確かめられる状態。

## Experiments

- [TLA+ dependency scenarios](docs/tla-dependency-scenarios.md) — 旧root READMEの実行前計画（検証済みとは主張しない）
- [TLA+ measured experiment](https://github.com/roccho-dev/proofs/pull/1) — Draft PR
- [Quint measured experiment](https://github.com/roccho-dev/proofs/pull/2) — Draft PR
