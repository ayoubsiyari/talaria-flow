/**
 * Custom Select — shared language / country control used on public and account pages.
 * Native option lists are never used.
 */
(function () {
  window.TF = window.TF || {};

  function optBg(sel, hi) {
    if (sel) return 'rgba(46,232,255,0.08)';
    if (hi) return 'rgba(255,255,255,0.06)';
    return 'transparent';
  }

  window.TF.mountSelect = function (host, opts) {
    if (!host) return;
    if (host.__tfSelectOff) host.__tfSelectOff();
    opts = opts || {};
    var value = opts.value;
    var options = opts.options || [];
    var onChange = opts.onChange || function () {};
    var width = opts.width || '100%';
    var ariaLabel = opts.ariaLabel || '';
    var open = false;
    var hi = -1;
    var btn;
    var list;

    host.style.position = 'relative';
    host.style.width = width;
    host.innerHTML = '';

    btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
    btn.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;' +
      'height:44px;padding:0 14px;background:#07080C;color:#F2F4F8;' +
      'border:1px solid rgba(255,255,255,0.16);border-radius:10px;' +
      'font:500 14.5px Archivo, sans-serif;cursor:pointer;text-align:left;line-height:1';
    var label = document.createElement('span');
    label.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    var chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('width', '12');
    chevron.setAttribute('height', '12');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', '#8B90A3');
    chevron.setAttribute('stroke-width', '2.2');
    chevron.setAttribute('stroke-linecap', 'round');
    chevron.setAttribute('stroke-linejoin', 'round');
    chevron.style.cssText = 'flex:none;transition:transform .18s';
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm6 9 6 6 6-6');
    chevron.appendChild(path);
    btn.appendChild(label);
    btn.appendChild(chevron);
    host.appendChild(btn);

    function cur() {
      for (var i = 0; i < options.length; i++) if (options[i].value === value) return options[i];
      return null;
    }
    function paintLabel() {
      var c = cur();
      label.textContent = c ? c.label : '—';
    }
    function setOpen(next) {
      open = !!next;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      chevron.style.transform = open ? 'rotate(180deg)' : 'none';
      if (open) {
        hi = -1;
        for (var i = 0; i < options.length; i++) if (options[i].value === value) { hi = i; break; }
        if (hi < 0 && options.length) hi = 0;
        renderList();
      } else if (list) {
        list.remove();
        list = null;
        btn.removeAttribute('aria-activedescendant');
      }
    }
    function renderList() {
      if (list) list.remove();
      list = document.createElement('div');
      list.setAttribute('role', 'listbox');
      list.style.cssText = 'position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:80;' +
        'max-height:280px;overflow-y:auto;padding:6px;background:#0E1017;' +
        'border:1px solid rgba(255,255,255,0.12);border-radius:12px;' +
        'box-shadow:0 12px 32px rgba(0,0,0,.45)';
      options.forEach(function (o, i) {
        var sel = o.value === value;
        var row = document.createElement('button');
        row.type = 'button';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', sel ? 'true' : 'false');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;' +
          'width:100%;min-height:40px;padding:8px 10px;border:0;border-radius:8px;' +
          'color:#F2F4F8;font:500 14px Archivo, sans-serif;cursor:pointer;text-align:left';
        row.style.background = optBg(sel, i === hi);
        var text = document.createElement('span');
        text.textContent = o.label;
        row.appendChild(text);
        if (sel) {
          var dot = document.createElement('span');
          dot.style.cssText = 'width:6px;height:6px;border-radius:50%;background:#2EE8FF;flex:none';
          row.appendChild(dot);
        }
        row.addEventListener('mouseenter', function () {
          hi = i;
          if (!sel) row.style.background = 'rgba(255,255,255,0.06)';
        });
        row.addEventListener('mouseleave', function () {
          if (!sel) row.style.background = 'transparent';
        });
        row.addEventListener('click', function () {
          value = o.value;
          paintLabel();
          setOpen(false);
          onChange(o.value);
        });
        list.appendChild(row);
      });
      host.appendChild(list);
      var rows = list.querySelectorAll('[role="option"]');
      if (hi >= 0 && rows[hi]) {
        if (!rows[hi].id) rows[hi].id = 'tf-opt-' + Math.random().toString(36).slice(2, 8);
        btn.setAttribute('aria-activedescendant', rows[hi].id);
        rows[hi].scrollIntoView({ block: 'nearest' });
      } else btn.removeAttribute('aria-activedescendant');
    }
    function onDoc(e) {
      if (!host.contains(e.target)) setOpen(false);
    }
    var typed = '';
    var typedAt = 0;
    // Type-ahead like a native select: printable keys jump to the first label starting with what was typed.
    function typeAhead(ch) {
      var now = Date.now();
      if (now - typedAt > 700) typed = '';
      typedAt = now;
      var repeat = typed.length === 1 && typed === ch.toLowerCase();
      typed = repeat ? typed : typed + ch.toLowerCase();
      var start = repeat || typed.length === 1 ? hi + 1 : hi;
      for (var n = 0; n < options.length; n++) {
        var i = (Math.max(start, 0) + n) % options.length;
        if (String(options[i].label || '').toLowerCase().indexOf(typed) === 0) {
          hi = i;
          if (!open) setOpen(true); else renderList();
          return true;
        }
      }
      return false;
    }
    function onKey(e) {
      var printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ';
      if (printable) {
        if (typeAhead(e.key)) e.preventDefault();
        return;
      }
      if (!open) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        hi = e.key === 'Home' ? 0 : options.length - 1;
        renderList();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        hi = hi < options.length - 1 ? hi + 1 : 0;
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        hi = hi <= 0 ? options.length - 1 : hi - 1;
        renderList();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (hi >= 0 && options[hi]) {
          value = options[hi].value;
          paintLabel();
          setOpen(false);
          onChange(options[hi].value);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        btn.focus();
      } else if (e.key === 'Tab') {
        setOpen(false);
      }
    }

    btn.addEventListener('click', function () { setOpen(!open); });
    btn.addEventListener('focus', function () { btn.style.borderColor = '#2EE8FF'; });
    btn.addEventListener('blur', function () { btn.style.borderColor = 'rgba(255,255,255,0.16)'; });
    host.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    paintLabel();

    host.__tfSelectOff = function () {
      document.removeEventListener('mousedown', onDoc);
      host.removeEventListener('keydown', onKey);
      host.innerHTML = '';
      host.__tfSelectOff = null;
    };
    return {
      setValue: function (v) { value = v; paintLabel(); if (open) renderList(); },
      close: function () { setOpen(false); }
    };
  };
})();
