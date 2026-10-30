# 実測結果

2026-10-30、GitHub Actionsの独立したLinux VMで実行。チャット内コンテナでの実行ではない。

## 証拠の版

- シナリオ先行commit: `a3d37e454ca4a5f6ab67c246f125ebaf6ae4e285`
- 実行したコード: `2e2250f691f2341ef373d6cbae416aad16cc23f0`
- [Run 41061416265](https://github.com/roccho-dev/proofs/actions/runs/41061416265)
- [Node job 124081823730](https://github.com/roccho-dev/proofs/actions/runs/41061416265/job/124081823730)
- [Bun job 124081824058](https://github.com/roccho-dev/proofs/actions/runs/41061416265/job/124081824058)

| 検証群 | 各環境の条件数 | Node | Bun |
|---|---:|---:|---:|
| モデル正常・違反、義務生成、TLAPM不在 | 4 | 4/4 | 4/4 |
| 4方式 × 正常・依存不在・偽の主張・最小構成 | 16 | 16/16 | 16/16 |
| Z3・Isabelle・LS4を選んだままZenonを除去 | 3 | 3/3 | 3/3 |
| LS4変換器・Isabelle理論を除去 | 2 | 2/2 | 2/2 |
| **合計** | **25** | **25/25** | **25/25** |

両環境のartifactを取得し、配布ZIPのSHA256、全50行の入力hash・生ログhashを再照合した。対応する25条件の入力、除去依存、引数、終了コード、判定はNode/Bunで一致した。全50条件に時間切れはない。

## 観測した事実

モデル検査は全外部証明ツールを除去した状態で4状態を探索した。正常な上限は終了コード0、誤った上限はx=3の反例と終了コード12。実行履歴にはその環境のNodeまたはBunだけがあり、Java・TLAPM・外部証明器は起動していない。

証明義務の生成だけも全外部証明ツールなしで成功した。ただし、これは定理を証明したという意味ではない。実際に証明する経路はTLAPM不在で終了コード1になった。

4方式の正常ケースと最小構成ケースは、各々 `All 2 obligations proved`。内訳は選択した証明器による主張1件と、TLAPMの自明な義務1件。8件の独立した実用定理を証明したとは数えない。

各方式で証明器を除去すると失敗し、他の証明器を除去した最小構成では成功した。4つの最終的な偽の主張は、選択した証明器の `status:failed` / `reason:false` と終了コード10を記録した。これは入力した偽の主張を証明済みにしなかったという検査であり、任意の偽命題を判別できる証明ではない。

Z3・Isabelle・LS4を選んだ場合でもZenon不在で終了コード3。実行履歴ではZenonの呼び出しは `zenon -v` のみであり、エラーのスタックは `Params.check_zenon_ver` → `Tlapm_args.init`。この固定版の起動時依存であり、他の証明器による代行ではない。

LS4は `ptl_to_trp`、IsabelleはPoly/MLと構築済み理論に依存する。どちらも実物を外して失敗を確認した。Isabelleの理論欠落でもTLAPMの表示は `reason:false` だったので、この表示だけを数学的な偽の証拠にしてはならない。

## 失敗履歴と限定

[Run 1](https://github.com/roccho-dev/proofs/actions/runs/41060093177)ではIsabelle理論欠落の診断文を検査器が狭く想定していた。また、初期の時間切れ判定は `reason:timeout` を拾えていなかった。いずれも修正し、初回の成功数を最終証拠には使っていない。

[Run 2](https://github.com/roccho-dev/proofs/actions/runs/41060668864)ではNodeの25条件中24条件が通過し、Z3への偽の算術命題 `1 > 2` は3秒の時間切れになった。これを反証成功には数えていない。最終の非受理対照は算術を含まない `FALSE` に絞り、実際に `reason:false` を確認した。**偽の算術命題の即時判別は未実証のまま。**

示したのは固定版・固定経路・小さい仕様での依存境界。TLC完全互換、証明器の健全性全体、任意の入力での正しさ、Windows/macOS対応、特定証明器の数学的な唯一性は対象外。

## 固定した構成

| 要素 | 版 |
|---|---|
| Node.js | 22.16.0 |
| Bun | 1.3.0（b0a6feca5） |
| tla-ts | 0.0.3、npm lockfileのintegrityで固定 |
| TLAPM | 941f894、1.6.0-pre配布物をSHA256で固定 |
| Z3 | 4.8.9 |
| Zenon | 0.8.4 [a268] |
| Isabelle | 2025、同梱Poly/ML・Pure/TLA+/Options理論 |
| LS4 | 版表示はunknown。同一TLAPS配布物のhashで固定 |

TLAPS配布物SHA256: `d1f0c863d3e64a4cf731f953367e5055f39fab7417c2c7097fd53a0ef288a50a`。

## 生ログ

[Node artifact 12979216828](https://github.com/roccho-dev/proofs/actions/runs/41061416265/artifacts/12979216828): ZIP SHA256 `892280e57d11b0ace3aef10cfa459e19f24580b24df84cb73150f5fe58a0b087`。

[Bun artifact 12979202053](https://github.com/roccho-dev/proofs/actions/runs/41061416265/artifacts/12979202053): ZIP SHA256 `9f406d7ee9241fb35d5f0cb4176d05bb609abfb21d56007b7f7fa74b34740bb1`。

各artifactには結果JSONL、環境、TLA+/CFG、stdout/stderr、execve履歴、証明器の作業記録を含む。保持期限は2026-11-29。期限後も固定版で再実行できるが、元のartifactが恒久保存されるとは主張しない。
