// 簡單版試算:5 個數字 + 報酬率滑桿 → 答案區與報酬率交叉圖(共用 shared.js)。
import { simpleInputs, breakEvenReturn } from '../lib/fire.js';
import {
  END_AGE, loadState, saveState, num, $, knobSet, writeKnobs, tradeoffChart, widthOf,
  renderAnswer, onResize, watchMiniBar,
} from './shared.js';

let last = null;
function draw() {
  if (!last) { $('chart-trade').innerHTML = ''; return; }
  $('chart-trade').innerHTML = tradeoffChart(last.inp, last.r, last.be, widthOf('chart-trade'));
}

function render(stored) {
  const inp = simpleInputs(stored);
  const r = Math.max(0, stored.assumedReturn);
  const a = renderAnswer(inp, r);
  last = a ? { inp, r, be: breakEvenReturn(inp, END_AGE) } : null;
  draw();
}

export function mount() {
  const s = loadState();
  let timer = 0;
  const refresh = () => { writeKnobs(s.inputs); render(s.inputs); saveState(s); };
  refresh();
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || !el.dataset.knob) return;
    const x = num(el.value);
    if (x == null) return;
    knobSet(s.inputs, el.dataset.knob, el.dataset.pct ? x / 100 : x);
    if (el.dataset.knob !== 'monthlySaving') s.preset = null;
    clearTimeout(timer);
    timer = setTimeout(refresh, 30);
  });
  onResize(draw);
  watchMiniBar();
}
