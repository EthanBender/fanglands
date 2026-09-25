// ============================================================================
// THE QUEST BOX OPENS — owner: "the quest helper gets cut off, clicking on it does not expand it"
// The tracked-quest box on the HUD fits one line and cuts the rest off with an ellipsis, so the sentence that
// tells a ten-year-old what to do next is the sentence he cannot read. Tapping it now opens the whole thing:
// the full instruction wrapped over as many lines as it needs, where the marker is pointing, and every other
// quest he has on the go, each one tappable to track instead.
// Feature file: registers through HOOKS only. 10-hud publishes the scroll's rect on HUD_LAYOUT (questX/Y/W/H).
// ============================================================================
{
  const boxRect = () => {
    const L = HUD_LAYOUT;
    if (!L || !L.questH || !L.questW) return null;
    return { x: L.questX, y: L.questY, w: L.questW, h: L.questH };
  };
  const tracked = () => (quest.tracked && typeof activeQuests === 'function' && activeQuests().includes(quest.tracked) ? quest.tracked : null);
  const nameOf = id => (QUEST_DEFS[id] ? QUEST_DEFS[id].name : id);
  const textOf = id => { try { return questText(id) || ''; } catch (e) { return ''; } };

  // The quest scroll (src/59-hudkit.js, drawn by 10-hud) is itself the control: the whole scroll, or the rolled strip in a
  // phone boss fight, is one tap labelled 'questbox:open' that opens the panel below (pointer-up; the wax seal is
  // decoration inside the hit). Its rect is published on HUD_LAYOUT, which is what boxRect() reads.

  // J already opens the quest list; this is the one the box opens, and it leads with the quest you are on.
  // It wears the book frame (panelBox): the whole instruction in the system sans, wrapped at whole words and never cut
  // (14 px on a computer and an iPad, 13 on a phone), a pin and "Head for X, n tiles away", ALSO ON THE GO in gold
  // Cinzel over one plate button per other quest (tap one to follow it instead), and Close, each a kit row tall.
  const HEAD = 62, PAD = 18;
  const bodyFont = () => HK.FS(600, HK.cur().fam === 'phoneP' || HK.cur().fam === 'phoneL' ? 13 : 14);
  const headFont = () => HK.FS(700, 13);
  const lineH = () => Math.round(bodyFont().px * HK.k() * 1.42);
  function detailGeom(g, narrow) {
    const id = tracked();
    const all = (typeof activeQuests === 'function' ? activeQuests() : []).filter(q => QUEST_DEFS[q]);
    const others = all.filter(q => q !== id);
    const body = id ? textOf(id) : '';
    const w = narrow ? Math.min(VW - 24, 380) : 460;
    const inner = w - PAD * 2, rh = HK.row(), gap = rh >= 44 ? 10 : 8;
    const lines = body ? HK.wrap(g, body, inner, 99, bodyFont()).lines : [];
    const target = id && typeof trackedTarget === 'function' ? trackedTarget() : null;
    let head = [];
    if (target) {
      const tiles = Math.round(dist(player.x, player.y, tc(target.x), tc(target.y)) / TILE);
      head = HK.wrap(g, `Head for ${target.label || 'the marker'}, ${tiles} tile${tiles === 1 ? '' : 's'} away`, inner - 22, 3, headFont()).lines;
    }
    // measured, not guessed: header, the instruction, the marker line, the list, then the footer (Close)
    const listH = others.length ? 26 + others.length * (rh + gap) : 0;
    const foot = rh + 18 + 10;
    const headH = head.length ? 12 + head.length * 18 : 8;
    const h = Math.min(VH - 24, HEAD + lines.length * lineH() + headH + listH + foot);
    return { id, others, body, w, inner, rh, gap, lines, target, head, headH, h, foot };
  }
  HOOKS.panel.quest_detail = (g, narrow) => {
    const Q = detailGeom(g, narrow);
    const { id, others, inner, rh, gap, lines, target } = Q;
    const { px, py, h } = panelBox(g, Q.w, Q.h, id ? nameOf(id) : 'Your quests', id ? 'What to do next' : 'Nothing tracked right now');
    let y = py + HEAD;
    const f = bodyFont(), lh = lineH();
    lines.forEach((ln, i) => HK.text(g, ln, px + PAD, y + f.px * HK.k() + i * lh, { font: f, color: HK.T.ink, box: { x: px + PAD, y: y + i * lh, w: inner, h: lh }, fitId: 'questbox:text' }));
    y += lines.length * lh;
    if (Q.head.length) {
      // where the gold arrow on the ring points: a drawn pin and one plain line
      HK.emblem(g, 'pin', px + PAD + 7, y + 17, 14, HK.T.goldHi);
      Q.head.forEach((ln, i) => HK.text(g, ln, px + PAD + 20, y + 22 + i * 18, { font: headFont(), color: HK.T.inkDim, box: { x: px + PAD + 20, y: y + 8 + i * 18, w: inner - 20, h: 18 }, fitId: 'questbox:head' }));
    }
    y += Q.headH;

    if (others.length) {
      // a gold hairline and the section header in Cinzel caps
      g.beginPath(); g.moveTo(px + PAD, y + 3.5); g.lineTo(px + PAD + inner, y + 3.5); g.strokeStyle = 'rgba(217,178,92,0.45)'; g.lineWidth = 1; g.stroke();
      HK.text(g, 'ALSO ON THE GO', px + PAD, y + 20, { font: HK.FC(800, 11), color: HK.T.gold });
      y += 26;
      for (const q of others) {
        if (y + rh > py + h - Q.foot) break;              // never run under the footer
        button(g, px + PAD, y, inner, rh, nameOf(q), () => { quest.tracked = q; quest.untrackedByPlayer = false; save(); }, '#21262d');
        y += rh + gap;
      }
    }
    button(g, px + PAD, py + h - rh - 18, inner, rh, 'Close', () => closePanel(), '#21262d');
  };

  window.QUESTBOX = { boxRect, tracked };

  const P = 'questbox: ';
  HOOKS.selfTest.push((check, F) => {
    // put a quest on the tracker, then check the box is a control that opens the whole text
    const t0 = quest.tracked, u0 = quest.untrackedByPlayer;
    const live = (typeof activeQuests === 'function' ? activeQuests() : []).filter(q => QUEST_DEFS[q]);
    if (!live.length) { check(P + 'the tracked-quest box opens the full instruction when you tap it', false, { noActiveQuests: true }); quest.tracked = t0; return; }
    quest.tracked = live[0]; quest.untrackedByPlayer = false;
    closePanel(); render();
    const r = QUESTBOX.boxRect();
    const hit = r && buttons.find(b => b.label === 'questbox:open');
    const covers = !!(hit && r && Math.abs(hit.x - r.x) < 1 && Math.abs(hit.y - r.y) < 1 && Math.abs(hit.w - r.w) < 1 && Math.abs(hit.h - r.h) < 1);
    if (hit) hit.action();
    const opened = panel === 'quest_detail';
    // Record what the panel paints. The headless canvas is a Proxy that swallows property sets, so wrapping
    // ctx.fillText does nothing there — the panel is handed its own recording context instead.
    let drawn = '';
    const rec = new Proxy({}, {
      get: (t, k) => k === 'measureText' ? (str => ({ width: String(str).length * 6 }))
        : k === 'fillText' || k === 'strokeText' ? ((str) => { drawn += String(str) + '\n'; })
        : (k === 'createLinearGradient' || k === 'createRadialGradient') ? (() => ({ addColorStop: () => { } }))
        : typeof k === 'string' ? (() => { }) : undefined,
      set: () => true,
    });
    const keep = buttons.length;
    HOOKS.panel.quest_detail(rec, false);
    buttons.length = keep;
    const full = questText(live[0]) || '';
    // wrapText breaks the sentence across several fillText calls, so compare with the whitespace taken out:
    // every word of the instruction must have been painted, and none of it replaced by an ellipsis
    const squash = t => String(t).replace(/\s+/g, '');
    const wholeText = full.length < 6 || squash(drawn).includes(squash(full));
    const noEllipsis = !squash(drawn).includes(squash(full.slice(0, Math.max(8, full.length - 12))) + '…');
    closePanel();
    quest.tracked = t0; quest.untrackedByPlayer = u0;
    check(P + 'the tracked-quest box is a control that opens the whole instruction, not a line that cuts off', covers && opened && wholeText && noEllipsis, { covers, opened, wholeText, noEllipsis, len: full.length });

    // and every other live quest is offered, so you can switch what you are following
    if (live.length > 1) {
      quest.tracked = live[0]; closePanel(); openPanel('quest_detail'); render();
      const other = buttons.find(b => b.label === (QUEST_DEFS[live[1]] || {}).name);
      if (other) other.action();
      const switched = quest.tracked === live[1];
      closePanel(); quest.tracked = t0; quest.untrackedByPlayer = u0;
      check(P + 'the panel lists your other quests and tapping one follows it instead', switched, { switched, live: live.length });
    } else {
      check(P + 'the panel lists your other quests and tapping one follows it instead', true, { onlyOneActive: true });
    }
  });

  // ---------- the panel audit: Quest detail, the Captain of the Watch and the Companion hero ----------
  // The three panels this file and 21-companion / 23-law draw, at all 8 device sizes, touch and mouse (the rules of the
  // kit's own panel check, 59-hudkit check 11, plus the finger gap): the book frame's close seal is there; from it on,
  // every control is 44 px or more on touch (26 with a mouse) and 8 px from every other on touch (4 with a mouse),
  // measured circle to rect; everything sits inside the panel and on screen; and every boxed word fits at Large.
  HOOKS.selfTest.push((check, F, h) => {
    const own = k => Object.getOwnPropertyDescriptor(window, k), size0 = { w: own('innerWidth'), h: own('innerHeight') };
    const touch0 = window.__forceTouch, text0 = window.SETTINGS ? SETTINGS.get('text') : 'normal', p0 = paused, pan0 = panel, arg0 = panelArg;
    const comp0 = player.companion ? JSON.parse(JSON.stringify(player.companion)) : null, law0 = player.law ? JSON.parse(JSON.stringify(player.law)) : null;
    const t0 = quest.tracked, u0 = quest.untrackedByPlayer, dc = dialog.cur, dq = dialog.queue.slice();
    const setSize = (w, hh) => { window.innerWidth = w; window.innerHeight = hh; if (VW !== w || VH !== hh) resize(); return VW === w && VH === hh; };
    const fc = HK.audit.fitCtx();
    const shape = b => b.r ? { k: 'c', x: b.cx != null ? b.cx : b.x + b.w / 2, y: b.cy != null ? b.cy : b.y + b.h / 2, r: b.r, label: b.label } : { k: 'r', x: b.x, y: b.y, w: b.w, h: b.h, label: b.label };
    // the words these three panels draw: their sentences and their plate buttons' labels
    const PANEL_FIT = /^(button|companion:words|captain:words|questbox:text|questbox:head)$/;
    const box = q => q.k === 'c' ? { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 } : q;
    const live = (typeof activeQuests === 'function' ? activeQuests() : []).filter(q => QUEST_DEFS[q]);
    const problems = []; let tried = 0, frames = 0;
    const scenes = [
      ['quest_detail', null, () => { quest.tracked = live[0] || null; quest.untrackedByPlayer = false; }],
      ['captain', null, () => { player.law = { wanted: 2, timer: 38, fines: 150 }; }],
      ['captain', null, () => { player.law = { wanted: 0, timer: 0, fines: 0 }; }],
      ['companion', { hire: 'garrick' }, () => { player.companion = { id: 'sera', hp: 44, mode: 'follow', x: player.x - 30, y: player.y, downT: 0, freed: { sera: true } }; }],
      ['companion', null, () => { player.companion = { id: 'sera', hp: 44, mode: 'stay', x: player.x - 30, y: player.y, downT: 0, freed: { sera: true } }; }],
    ];
    try {
      paused = false; dialog.cur = null; dialog.queue.length = 0;
      for (const [w, hh] of HK.audit.SIZES) {
        if (!setSize(w, hh)) continue; tried++;
        for (const t of [true, false]) for (const text of ['normal', 'large']) {
          window.__forceTouch = t; if (window.SETTINGS) SETTINGS.set('text', text);
          for (const [pn, arg, prep] of scenes) {
            prep(); closePanel(); openPanel(pn, arg);
            HK.FIT.on = true; HK.FIT.log.length = 0; drawHud(fc); HK.FIT.on = false; frames++;
            const where = `${w}x${hh} ${t ? 'touch' : 'mouse'} ${text} ${pn}${arg ? ' (hire)' : ''}`;
            if (panel !== pn || !panelRect) { problems.push(`${where}: the panel did not open`); continue; }
            const all = buttons.filter(b => !b.offscreen && b.w > 0 && b.h > 0);
            const ci = all.findIndex(b => b.label === '×');
            if (ci < 0) { problems.push(`${where}: no close seal`); continue; }
            const P = panelRect, ctl = all.slice(ci).map(shape), floor = t ? 44 : 26, clear = t ? 8 : 4;
            if (ctl.length < 2) problems.push(`${where}: only ${ctl.length} control`);
            if (P.x < -0.5 || P.y < -0.5 || P.x + P.w > VW + 0.5 || P.y + P.h > VH + 0.5) problems.push(`${where}: the panel is off screen`);
            for (const q of ctl) {
              const b = box(q);
              if (b.w < floor - 0.5 || b.h < floor - 0.5) problems.push(`${where}: ${q.label} is ${Math.round(b.w)}x${Math.round(b.h)}, under ${floor}`);
              if (b.x < P.x - 0.5 || b.y < P.y - 0.5 || b.x + b.w > P.x + P.w + 0.5 || b.y + b.h > P.y + P.h + 0.5) problems.push(`${where}: ${q.label} is outside the panel`);
            }
            for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) { const gp = HK.gapBetween(ctl[i], ctl[j]); if (gp < clear - 0.01) problems.push(`${where}: ${ctl[i].label} ~ ${ctl[j].label} gap ${gp.toFixed(1)} < ${clear}`); }
            // every boxed word inside the panel fits its box (sentences wrap at whole words; button labels shrink)
            for (const e of HK.FIT.log) {
              if (!e.box || !PANEL_FIT.test(e.id || '')) continue;
              const x0 = e.align === 'center' ? e.x - e.w / 2 : e.align === 'right' ? e.x - e.w : e.x;
              if (x0 < e.box.x - 1 || x0 + e.w > e.box.x + e.box.w + 1) problems.push(`${where}: "${e.s}" runs out of its box`);
            }
          }
          closePanel();
        }
      }
    } finally {
      HK.FIT.on = false; closePanel();
      player.companion = comp0; player.law = law0; quest.tracked = t0; quest.untrackedByPlayer = u0;
      if (window.SETTINGS) SETTINGS.set('text', text0);
      window.__forceTouch = touch0;
      if (size0.w) { Object.defineProperty(window, 'innerWidth', size0.w); Object.defineProperty(window, 'innerHeight', size0.h); } else { try { delete window.innerWidth; delete window.innerHeight; } catch (e) { } }
      resize(); paused = p0; dialog.cur = dc; dialog.queue.length = 0; dialog.queue.push(...dq); if (pan0) openPanel(pan0, arg0); render();
    }
    check(P + 'Quest detail, the Captain of the Watch and the Companion hero (hiring and with her) wear the book frame at all 8 sizes, touch and mouse, normal and Large text: a close seal, then every control 44 px or more on touch (26 with a mouse), 8 px apart on touch (4 with a mouse), inside the panel and on screen, and every word inside its box',
      tried === 8 && frames === 8 * 2 * 2 * scenes.length && problems.length === 0, { tried, frames, problems: problems.slice(0, 12), total: problems.length });
  });
}
