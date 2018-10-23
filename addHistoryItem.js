if (window.scriptURL !== window.location.href) {
  window.scriptURL = window.location.href

  var beenVisible = false

  var getText = getText || function () {
    var n
        , text = document.title + " "
        , walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);

    while (n = walk.nextNode()) {
        var ignore = { "STYLE": 0, "CODE": 0, "SCRIPT": 0, "NOSCRIPT": 0, "IFRAME": 0, "OBJECT": 0 }
        if (n.parentNode.tagName in ignore || n.parentNode instanceof HTMLUnknownElement) {
            continue;
        }
        text += n.textContent + " "
    }

    text = text.replace(new RegExp("[ \\f\\n\\r\\t\\v\\u00A0\\u2028\\u2029\"_\\-\']+", "gm"), " ") || ""

    console.time("tags")
    var tags = []
    var topics = nlp(text).topics().slice(0, 50).out('frequency')
    topics.forEach(function(t) {
      if (t.count > 1 && $.inArray(t.normal, tags) === -1) tags.push(t.normal)
    })
    console.timeEnd("tags")

    return {text: text, tags: tags}
  }

  var visible = visible || function () {

    if (beenVisible) {
      return
    }

    var content = getText()

    chrome.runtime.sendMessage({
        from: "content",
        action: "store",
        title: document.title,
        text: content.text,
        tags: content.tags
    }, function (r) {
        if (r) {
            beenVisible = true;
            document.removeEventListener('visibilitychange', visible, false)
        }
    })
  }

  $(document).ready(function() {
    console.log('EXT: doc ready')
    var t = setTimeout(function() {
      if (document.visibilityState === "visible") {
        console.log('EXT: invoke visible()')
        visible()
      } else {
        document.addEventListener("visibilitychange", visible, false)
      }
    }, 3500)
  })
}
