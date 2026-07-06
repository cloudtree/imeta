const COLUMN_BLOCK = `░░░░░░░░░░░|':''''|::|░░░░░░░░░░░░░░░░░░░|':''''|::|░░░░░░░░
░░░░░░░░░░░|'''':'|::|░░░░░░░░░░░░░░░░░░░|'''':'|::|░░░░░░░░
░░░░░░░░░░░|':''''|::|░░░░░░░░░░░░░░░░░░░|':''''|::|░░░░░░░░
░░░░░░░░░░░|'''':'|::|░░░░░░░░░░░░░░░░░░░|'''':'|::|░░░░░░░░
░░░░░░░░░░░|':''''|::|░░░░░░░░░░░░░░░░░░░|':''''|::|░░░░░░░░
░░░░░░░░░░░|'''':'|::|░░░░░░░░░░░░░░░░░░░|'''':'|::|░░░░░░░░
░░░░░░░░░░/'':'''''\\  \\░░░░░░░░░░░░░░░░/'':'''''\\  \\░░░░░░░
░░░░░░░░░|''':''''''|::|░░░░░░░░░░░░░░░|''':''''''|::|░░░░░░`

const TRACK_BLOCK = `|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=|=
""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""""
.__'''':''''':''''':''''': __..__'''':''''':''''':''''': __.
'░░'-._''':''''':''''':_.-:--''░░'-._''':''''':''''':_.-:--'`

const TRAIN_BLOCK = `░░░░.-----.░░░░░░░░░░░░_.......--------------..............------------
|___7_\\X\\7..____░░░░_.'o)░░░░░|   metadata management portal   |
|L__  J\\_\\L__...====.--''''''''--------------..............------------
░░░'-=7'---'░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░`

function repeatBlock(block, count) {
  return Array.from({ length: count }, () => block).join('\n')
}

const LAYER_SLOW = repeatBlock(COLUMN_BLOCK, 18)
const LAYER_FAST = repeatBlock(TRACK_BLOCK, 12)
const LAYER_TRAIN = repeatBlock(TRAIN_BLOCK, 4)

export default function LoginAsciiBackground() {
  return (
    <div className="login-ascii-bg" aria-hidden="true">
      <pre className="login-ascii-bg__layer login-ascii-bg__layer--slow">{LAYER_SLOW}</pre>
      <pre className="login-ascii-bg__layer login-ascii-bg__layer--fast">{LAYER_FAST}</pre>
      <pre className="login-ascii-bg__layer login-ascii-bg__layer--train">{LAYER_TRAIN}</pre>
      <div className="login-ascii-bg__scanlines" />
      <div className="login-ascii-bg__vignette" />
    </div>
  )
}
