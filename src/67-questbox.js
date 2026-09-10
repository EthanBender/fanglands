// ============================================================================
// THE QUEST BOX OPENS — owner: "the quest helper gets cut off, clicking on it does not expand it"
// The tracked-quest box on the HUD fits one line and cuts the rest off with an ellipsis, so the sentence that
// tells a ten-year-old what to do next is the sentence he cannot read. Tapping it now opens the whole thing:
// the full instruction wrapped over as many lines as it needs, where the marker is pointing, and every other
// quest he has on the go, each one tappable to track instead.
// Feature file: registers through HOOKS only. 10-hud publishes the box's rect on HUD_LAYOUT (questX/questW).
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

  // an invisible control over the box, plus a small chevron so it looks like it opens
  HOOKS.hud.push(g => {
    if (paused || panel) return;
    const r = boxRect(), id = tracked();
    if (!r || !id) return;
    // a hit area, not a drawn control: button() paints its label, which would print "questbox:open" over the box
    buttons.push({ x: r.x, y: r.y, w: r.w, h: r.h, label: 'questbox:open', action: () => openPanel('quest_detail') });
    // the chevron: two strokes in the corner, quiet enough not to fight the text
    g.strokeStyle = 'rgba(139,148,158,0.85)'; g.lineWidth = 2; g.lineCap = 'round';
    const cx = r.x + r.w - 16, cy = r.y + r.h / 2;
    g.beginPath(); g.moveTo(cx - 4, cy - 4); g.lineTo(cx + 1, cy); g.lineTo(cx - 4, cy + 4); g.stroke();
    g.lineCap = 'butt';
  });

  // J already opens the quest list; this is the one the box opens, and it leads with the quest you are on
  const HEAD = 74, LINE = 20, ROW = 34, FOOT = 52, PAD = 18;
  HOOKS.panel.quest_detail = (g, narrow) => {
    const id = tracked();
    const all = (typeof activeQuests === 'function' ? activeQuests() : []).filter(q => QUEST_DEFS[q]);
    const others = all.filter(q => q !== id);
    const body = id ? textOf(id) : '';
    const w = narrow ? Math.min(VW - 24, 380) : 460;
    const inner = w - PAD * 2;
    g.font = '14px sans-serif';
    const lines = body ? Math.max(1, dialogLines(g, body, inner)) : 0;
    const target = id && typeof trackedTarget === 'function' ? trackedTarget() : null;
    // measured, not guessed: header, the instruction, the marker line, the list, then the footer
    const listH = others.length ? 22 + others.length * ROW : 0;
    const h = Math.min(VH - 24, HEAD + lines * LINE + (target ? 30 : 6) + listH + FOOT);
    const { px, py } = panelBox(g, w, h, id ? nameOf(id) : 'Your quests', id ? 'What to do next' : 'Nothing tracked right now');

    let y = py + HEAD;                                   // panelBox writes its subtitle at py + 50
    if (body) {
      g.fillStyle = '#e6edf3'; g.font = '14px sans-serif'; g.textAlign = 'left';
      wrapText(g, body, px + PAD, y, inner, LINE);
      y += lines * LINE;
    }
    if (target) {
      const tiles = Math.round(dist(player.x, player.y, tc(target.x), tc(target.y)) / TILE);
      g.fillStyle = '#f5c542'; g.font = 'bold 12px sans-serif'; g.textAlign = 'left';
      g.fillText(`Head for ${target.label || 'the marker'} — ${tiles} tiles away`, px + PAD, y + 18);
      y += 30;
    } else y += 6;

    if (others.length) {
      g.fillStyle = '#8b949e'; g.font = 'bold 11px sans-serif'; g.textAlign = 'left';
      g.fillText('ALSO ON THE GO', px + PAD, y + 12);
      y += 22;
      for (const q of others) {
        if (y + 28 > py + h - FOOT) break;               // never run under the footer
        button(g, px + PAD, y, inner, 28, nameOf(q), () => { quest.tracked = q; quest.untrackedByPlayer = false; save(); }, '#21262d');
        y += ROW;
      }
    }
    button(g, px + PAD, py + h - 44, inner, 32, 'Close', () => closePanel());
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
}
