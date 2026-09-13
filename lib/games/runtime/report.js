// Tells the app whether the game is healthy. The preview runs in an iframe,
// and the app polls it with { type: "game-ping" }; this answers
// { type: "game-status", error }, where error is the first error the page hit,
// or null while it has none. Load it as the first classic script in <head>,
// before any module, so it also catches syntax and loading errors in the
// game's own scripts:
//
//   <script src="./report.js"></script>
//
// engine/errors.js forwards the errors the engine catches itself through
// window.recordGameError, since those never reach the window listeners here.
;(function () {
  if (window.recordGameError) return

  var firstError = null

  function record(error, source) {
    if (firstError) return
    var message =
      (error && (error.stack || error.message)) || String(error || "Unknown error")
    if (source) message += "\n    at " + source
    firstError = String(message).slice(0, 4000)
  }

  window.recordGameError = record

  // Capture phase also catches <script>/<img> loading failures, which don't bubble.
  window.addEventListener(
    "error",
    function (event) {
      var target = event.target
      if (target && target !== window && target.tagName) {
        var url = target.src || target.href
        // A string, not an Error, so the stack doesn't point here.
        record(
          url
            ? "Failed to load " + url
            : "A <" + target.tagName.toLowerCase() + "> failed to load; check its import paths"
        )
        return
      }
      record(
        event.error || event.message,
        event.filename ? event.filename + ":" + event.lineno : ""
      )
    },
    true
  )
  window.addEventListener("unhandledrejection", function (event) {
    record(event.reason)
  })

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return
    if (!event.data || event.data.type !== "game-ping") return
    event.source.postMessage({ type: "game-status", error: firstError }, event.origin)
  })
})()
