module Counter {
  var x: int
  action init = x' = 0
  action step = x' = if (x < 3) x + 1 else x
  val safe = x <= 3
  val bad = x < 3

  run passingTest = init.then(3.reps(_ => all {
    assert(x <= 3),
    step,
  }))
  run failingTest = init.then(all {
    assert(x < 0),
    step,
  })
}
