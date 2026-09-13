(function () {
  window.TF = window.TF || {};

  function toast(msg) {
    if (window.tfToast) window.tfToast(msg);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function slug(s) {
    return String(s || 'template')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || ('tpl-' + Date.now());
  }
  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }
  function emptyLocale() {
    return { subject: '', preheader: '', eyebrow: '', title: '', blocks: [] };
  }
  function stripHtml(s) {
    return String(s == null ? '' : s).replace(/<[^>]+>/g, '');
  }
  function localeFromSpec(spec) {
    if (!spec) return emptyLocale();
    return {
      subject: stripHtml(spec.subject || ''),
      preheader: stripHtml(spec.preheader || ''),
      eyebrow: stripHtml(spec.eyebrow || ''),
      title: stripHtml(spec.title || ''),
      blocks: (spec.blocks || []).map(normalizeBlock),
    };
  }
  function normalizeBlock(b) {
    b = b || {};
    switch (b.type) {
      case 'button': return { type: 'button', label: stripHtml(b.label || ''), href: b.href || '#' };
      case 'callout': return { type: 'callout', label: stripHtml(b.label || ''), text: stripHtml(b.text || ''), color: b.color || '' };
      case 'list': return { type: 'list', items: (b.items && b.items.length) ? b.items.map(stripHtml) : [''] };
      case 'steps': return { type: 'steps', items: (b.items && b.items.length) ? b.items.map(stripHtml) : [''] };
      case 'kv': return { type: 'kv', rows: (b.rows && b.rows.length) ? b.rows.map(function (r) { return [stripHtml(r[0] || ''), stripHtml(r[1] || '')]; }) : [['', '']] };
      case 'image': return { type: 'image', src: b.src || '', alt: stripHtml(b.alt || '') };
      case 'code': return { type: 'code', value: stripHtml(b.value || ''), note: stripHtml(b.note || '') };
      case 'status': return { type: 'status', text: stripHtml(b.text || ''), color: b.color || '#FBBF24' };
      case 'spacer': return { type: 'spacer', height: b.height || 16 };
      case 'divider': return { type: 'divider' };
      case 'h2': return { type: 'h2', text: stripHtml(b.text || '') };
      default: return { type: b.type || 'p', text: stripHtml(b.text || '') };
    }
  }
  function localeToSpec(loc, extra) {
    extra = extra || {};
    return {
      subject: loc.subject || '',
      preheader: loc.preheader || '',
      eyebrow: loc.eyebrow || '',
      title: loc.title || '',
      accent: extra.accent || '#2EE8FF',
      lang: extra.lang || 'en',
      unsubscribe: extra.unsubscribe,
      blocks: (loc.blocks || []).map(function (b) { return clone(b); }),
    };
  }
  function localeHasCopy(loc) {
    if (!loc) return false;
    if (loc.subject || loc.title || loc.preheader || loc.eyebrow) return true;
    return (loc.blocks || []).some(function (b) {
      if (b.text || b.label || b.value || b.src) return true;
      if (b.items && b.items.some(Boolean)) return true;
      if (b.rows && b.rows.some(function (r) { return r[0] || r[1]; })) return true;
      return b.type === 'divider' || b.type === 'spacer';
    });
  }

  var PRESETS = {
    Transactional: {
      desc: 'Confirmation, code, status change. Sent automatically.',
      accent: '#2EE8FF',
      en: {
        eyebrow: 'Account',
        subject: 'Subject line',
        preheader: 'One-line preview text',
        title: 'Headline',
        blocks: [
          { type: 'p', text: 'One short paragraph that says what happened and what to do.' },
          { type: 'button', label: 'Open your account', href: 'https://www.talaria-flow.com/account/access/' },
          { type: 'callout', label: 'Not you?', text: 'Ignore this email. Nothing else happens.' },
        ],
      },
    },
    Announcement: {
      desc: 'One message to a chosen audience.',
      accent: '#FF37B0',
      en: {
        eyebrow: 'Course',
        subject: 'Something new',
        preheader: 'What it is in one line',
        title: 'Announcement headline',
        blocks: [
          { type: 'p', text: 'Say what shipped and why it matters to a trader.' },
          { type: 'image', src: '/assets/nt-platform.png', alt: 'Screenshot' },
          { type: 'list', items: ['First benefit', 'Second benefit', 'Third benefit'] },
          { type: 'button', label: 'See the tools suite', href: 'https://www.talaria-flow.com/tools/' },
        ],
      },
    },
    Newsletter: {
      desc: 'Recurring update with several sections.',
      accent: '#2EE8FF',
      en: {
        eyebrow: 'Issue 01',
        subject: 'Talaria Flow monthly',
        preheader: 'This month in order flow',
        title: 'This month',
        blocks: [
          { type: 'p', text: 'Intro paragraph.' },
          { type: 'h2', text: 'Section one' },
          { type: 'p', text: 'Body.' },
          { type: 'divider' },
          { type: 'h2', text: 'Section two' },
          { type: 'p', text: 'Body.' },
          { type: 'button', label: 'Read on the site', href: 'https://www.talaria-flow.com' },
        ],
      },
    },
  };

  var BLOCKS = [
    { type: 'p', name: 'Paragraph', desc: 'A short block of body copy.', thumb: 'bars' },
    { type: 'h2', name: 'Heading', desc: 'Section title inside the email.', thumb: 'heading' },
    { type: 'button', name: 'Button', desc: 'Primary action with a link.', thumb: 'button' },
    { type: 'callout', name: 'Callout', desc: 'Label plus a note in a box.', thumb: 'callout' },
    { type: 'kv', name: 'Key–value rows', desc: 'Labelled facts in two columns.', thumb: 'kv' },
    { type: 'steps', name: 'Steps', desc: 'Numbered sequence.', thumb: 'steps' },
    { type: 'list', name: 'Bullet list', desc: 'A list of short points.', thumb: 'list' },
    { type: 'code', name: 'Code / OTP', desc: 'A large one-time code.', thumb: 'code' },
    { type: 'divider', name: 'Divider', desc: 'A thin rule between sections.', thumb: 'divider' },
    { type: 'spacer', name: 'Spacer', desc: 'Empty vertical space.', thumb: 'spacer' },
    { type: 'image', name: 'Image', desc: 'A screenshot or hero image.', thumb: 'image' },
    { type: 'status', name: 'Status pill', desc: 'A coloured state label.', thumb: 'status' },
  ];
  var ACCENTS = [
    ['#2EE8FF', 'Cyan'],
    ['#FF37B0', 'Magenta'],
    ['#FBBF24', 'Amber'],
  ];
  var FIELDS = [
    { key: 'first_name', label: "member's first name" },
    { key: 'email', label: "member's email address" },
    { key: 'code', label: 'one-time sign-in code' },
    { key: 'reason', label: 'reviewer note on a rejected submission' },
    { key: 'submitted_at', label: 'when they uploaded proof' },
    { key: 'file_count', label: 'number of files they uploaded' },
    { key: 'token', label: 'confirm / reset link token' },
  ];
  var KNOWN_FIELDS = FIELDS.map(function (f) { return f.key; }).concat([
    'device', 'location', 'time', 'course_url', 'dashboard_url', 'unsubscribe_url',
    'preferences_url', 'confirm_url', 'reset_url', 'hero_image_url', 'hero_image_alt',
    'section_1_title', 'section_1_body', 'section_2_title', 'section_2_body',
    'cta_label', 'cta_url', 'intro', 'issue_label', 'subject', 'preheader', 'title',
  ]);

  function defaultBlock(type) {
    switch (type) {
      case 'button': return { type: 'button', label: 'Continue', href: 'https://www.talaria-flow.com/' };
      case 'callout': return { type: 'callout', label: 'Note', text: '' };
      case 'list': return { type: 'list', items: [''] };
      case 'steps': return { type: 'steps', items: [''] };
      case 'kv': return { type: 'kv', rows: [['', '']] };
      case 'image': return { type: 'image', src: '', alt: '' };
      case 'code': return { type: 'code', value: '{{code}}', note: '' };
      case 'status': return { type: 'status', text: 'Under review', color: '#FBBF24' };
      case 'spacer': return { type: 'spacer', height: 16 };
      case 'divider': return { type: 'divider' };
      case 'h2': return { type: 'h2', text: '' };
      default: return { type: 'p', text: '' };
    }
  }

  function thumb(kind) {
    var box = 'width:40px;height:24px;border-radius:4px;background:#0B0D13;border:1px solid rgba(255,255,255,0.12);display:grid;place-items:center;flex:none;overflow:hidden';
    if (kind === 'button') return '<span style="' + box + '"><span style="display:block;width:22px;height:8px;border-radius:3px;background:#2EE8FF"></span></span>';
    if (kind === 'heading') return '<span style="' + box + '"><span style="display:block;width:26px;height:4px;background:#F2F4F8;border-radius:1px"></span></span>';
    if (kind === 'callout') return '<span style="' + box + ';justify-content:start;padding:0 4px"><span style="width:2px;height:14px;background:#2EE8FF;margin-right:4px"></span><span style="display:flex;flex-direction:column;gap:2px"><span style="display:block;width:18px;height:2px;background:#8B90A3"></span><span style="display:block;width:14px;height:2px;background:#7C8296"></span></span></span>';
    if (kind === 'kv') return '<span style="' + box + ';grid-template-columns:1fr 1fr;gap:2px;padding:3px">' + [0, 1, 2].map(function () { return '<span style="height:3px;background:#7C8296"></span><span style="height:3px;background:#B7BCCB"></span>'; }).join('') + '</span>';
    if (kind === 'steps') return '<span style="' + box + ';grid-template-columns:6px 1fr;gap:2px 3px;padding:3px 4px">' + [0, 1, 2].map(function () { return '<span style="width:4px;height:4px;border-radius:50%;background:#2EE8FF"></span><span style="height:3px;background:#8B90A3"></span>'; }).join('') + '</span>';
    if (kind === 'list') return '<span style="' + box + ';grid-template-columns:4px 1fr;gap:2px 3px;padding:3px 5px">' + [0, 1, 2].map(function () { return '<span style="width:3px;height:3px;background:#2EE8FF"></span><span style="height:2px;background:#8B90A3"></span>'; }).join('') + '</span>';
    if (kind === 'code') return '<span style="' + box + '"><span style="font-family:Geist Mono,monospace;font-size:8px;letter-spacing:.12em;color:#F2F4F8">4829</span></span>';
    if (kind === 'divider') return '<span style="' + box + '"><span style="display:block;width:28px;height:1px;background:rgba(255,255,255,0.28)"></span></span>';
    if (kind === 'spacer') return '<span style="' + box + '"><span style="display:block;width:1px;height:14px;border-left:1px dashed #7C8296"></span></span>';
    if (kind === 'image') return '<span style="' + box + ';background:linear-gradient(135deg,#1a2230,#0B0D13)"><span style="width:10px;height:8px;border:1px solid #8B90A3;border-radius:2px"></span></span>';
    if (kind === 'status') return '<span style="' + box + '"><span style="display:inline-flex;align-items:center;gap:3px;border:1px solid #FBBF24;border-radius:3px;padding:1px 4px"><span style="width:3px;height:3px;background:#FBBF24"></span><span style="width:10px;height:2px;background:#FBBF24"></span></span></span>';
    return '<span style="' + box + ';justify-items:start;padding:4px 5px;gap:2px"><span style="display:block;width:26px;height:2px;background:#8B90A3"></span><span style="display:block;width:20px;height:2px;background:#7C8296"></span><span style="display:block;width:24px;height:2px;background:#7C8296"></span></span>';
  }

  function findUnknown(loc) {
    var blob = JSON.stringify(loc || {});
    var found = [];
    blob.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, function (_, k) {
      if (KNOWN_FIELDS.indexOf(k) < 0 && found.indexOf(k) < 0) found.push(k);
      return _;
    });
    return found;
  }
  function insertAtCaret(el, token) {
    if (!el) return;
    var start = el.selectionStart == null ? el.value.length : el.selectionStart;
    var end = el.selectionEnd == null ? start : el.selectionEnd;
    el.value = el.value.slice(0, start) + token + el.value.slice(end);
    var pos = start + token.length;
    try { el.setSelectionRange(pos, pos); } catch (e) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.focus();
  }
  function fieldMenu() {
    return '<div data-field-menu style="position:absolute;top:calc(100% + 4px);right:0;z-index:40;width:260px;padding:6px;background:#0E1017;border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 16px 40px rgba(0,0,0,.5)">' +
      FIELDS.map(function (f) {
        return '<button type="button" data-insert-field="{{' + f.key + '}}" style="display:block;width:100%;text-align:left;padding:8px 10px;border:0;border-radius:8px;background:transparent;color:#F2F4F8;cursor:pointer"><span style="display:block;font-family:Geist Mono,monospace;font-size:12px;color:#2EE8FF">{{' + f.key + '}}</span><span style="display:block;font-size:12px;color:#8B90A3">' + esc(f.label) + '</span></button>';
      }).join('') + '</div>';
  }
  function insertBtn(key) {
    return '<span data-insert-wrap="' + esc(key) + '" style="position:relative;display:inline-flex"><button type="button" data-insert-open="' + esc(key) + '" style="height:26px;padding:0 8px;border:1px solid rgba(255,255,255,0.16);border-radius:7px;background:transparent;color:#B7BCCB;font-size:11.5px;font-weight:600;cursor:pointer">Insert field</button></span>';
  }
  function labeledInput(id, label, value, extra) {
    extra = extra || {};
    var warn = extra.warnAt;
    var n = String(value || '').length;
    var over = warn && n > warn;
    return '<label style="display:flex;flex-direction:column;gap:4px">' +
      '<span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-family:Geist Mono,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8B90A3">' + esc(label) + '</span>' +
      insertBtn(id) +
      (warn != null ? '<span data-count="' + id + '" style="margin-left:auto;font-family:Geist Mono,monospace;font-size:11px;color:' + (over ? '#FBBF24' : '#7C8296') + '">' + n + (over ? ' · keep under ' + warn : '') + '</span>' : '') +
      '</span>' +
      (extra.area
        ? '<textarea data-field="' + id + '" rows="' + (extra.rows || 3) + '" class="scp3" style="width:100%;box-sizing:border-box;resize:vertical;min-height:72px;background:#07080C;border:1px solid ' + (extra.bad ? '#FF8AD0' : 'rgba(255,255,255,0.16)') + ';border-radius:8px;padding:8px 10px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:14px;line-height:1.45;outline:none">' + esc(value) + '</textarea>'
        : '<input data-field="' + id + '" value="' + esc(value) + '" class="scp3" style="height:36px;background:#07080C;border:1px solid ' + (extra.bad ? '#FF8AD0' : 'rgba(255,255,255,0.16)') + ';border-radius:8px;padding:0 10px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:14px;outline:none">') +
      '</label>';
  }

  window.TF.initEmailEditorPage = function () {
    var root = document.getElementById('email-editor') || document.querySelector('[data-email-editor]');
    if (!root || root.getAttribute('data-ed-bound') === '1') return;
    root.setAttribute('data-ed-bound', '1');
    var parts = location.pathname.replace(/\/+$/, '').split('/');
    var id = parts[parts.length - 1];
    var isNew = !id || id === 'new' || id === 'edit';
    var state = {
      id: isNew ? '' : id,
      name: 'New template',
      kind: 'campaign',
      trigger: 'Manual send',
      locale: 'en',
      wide: true,
      preset: 'Transactional',
      accent: '#2EE8FF',
      unsubscribe: undefined,
      en: clone(PRESETS.Transactional.en),
      ar: emptyLocale(),
      pickerOpen: false,
      insertOpen: '',
      savedAt: null,
      dirty: false,
      unknown: [],
    };

    function loc() { return state.locale === 'ar' ? state.ar : state.en; }
    function setLoc(next) { if (state.locale === 'ar') state.ar = next; else state.en = next; }
    function markDirty() { state.dirty = true; paintFooter(); refreshPreview(); }

    function fullSpec() {
      var spec = localeToSpec(state.en, { accent: state.accent, lang: 'en', unsubscribe: state.unsubscribe });
      if (localeHasCopy(state.ar)) spec.ar = localeToSpec(state.ar, { accent: state.accent, lang: 'ar', unsubscribe: state.unsubscribe });
      return spec;
    }

    function savedLabel() {
      if (state.dirty) return 'Unsaved changes';
      if (!state.savedAt) return 'Not saved yet';
      var mins = Math.max(0, Math.round((Date.now() - state.savedAt) / 60000));
      if (mins < 1) return 'Saved just now';
      if (mins === 1) return 'Saved 1 minute ago';
      return 'Saved ' + mins + ' minutes ago';
    }

    function refreshPreview() {
      var spec = fullSpec();
      var current = state.locale === 'ar' ? spec.ar : spec;
      var subj = document.getElementById('ed-subject');
      var widthBtn = document.getElementById('ed-width');
      var frame = document.getElementById('ed-frame');
      if (widthBtn) widthBtn.textContent = state.wide ? 'Desktop 600' : 'Mobile 375';
      if (state.locale === 'ar' && !spec.ar) {
        if (subj) subj.textContent = 'No Arabic version yet · Add translation';
        if (frame) {
          frame.style.width = state.wide ? '600px' : '375px';
          frame.srcdoc = '<!doctype html><html><body style="margin:0;background:#07080C;color:#F2F4F8;font-family:Archivo,sans-serif;display:grid;place-items:center;min-height:360px;text-align:center;padding:32px"><div><div style="font-size:16px;font-weight:600;margin-bottom:8px">No Arabic version yet</div><div style="font-size:13.5px;color:#8B90A3">Add translation — English is not shown here as a silent fallback.</div></div></body></html>';
        }
        return;
      }
      if (subj) subj.textContent = (current && current.subject) || 'Subject';
      if (frame && window.TFEmail) {
        frame.style.width = state.wide ? '600px' : '375px';
        var html = window.TFEmail.render(spec, { baseUrl: '/', lang: state.locale });
        // The editor has no recipient: only the greeting name is filled, every other field renders empty.
        var data = {
          first_name: 'there',
          email: 'member@example.com',
          code: '123456',
          token: 't',
          reason: 'Second screenshot is missing the Simulation label',
          submitted_at: '9 Sep 2026, 10:00',
          file_count: '2',
          device: 'Chrome on Windows',
          location: 'London, UK',
          time: '2026-09-09 10:00',
          course_url: 'https://www.talaria-flow.com/account/course/',
          dashboard_url: 'https://www.talaria-flow.com/account/access/',
          unsubscribe_url: 'https://www.talaria-flow.com/account/notifications/',
          preferences_url: 'https://www.talaria-flow.com/account/notifications/',
          confirm_url: 'https://www.talaria-flow.com/login/',
          reset_url: 'https://www.talaria-flow.com/login/?type=recovery',
          hero_image_url: '/assets/nt-platform.png',
          hero_image_alt: 'NinjaTrader',
          section_1_title: 'Section one',
          section_1_body: 'Body',
          section_2_title: 'Section two',
          section_2_body: 'Body',
          cta_label: 'Continue',
          cta_url: 'https://www.talaria-flow.com/',
          intro: 'Intro',
          issue_label: 'Issue 01',
          subject: current && current.subject || 'Subject',
          preheader: current && current.preheader || 'Preview',
          title: current && current.title || 'Title',
        };
        html = html.replace(/\{\{([\s\S]*?)\}\}/g, function (_, inner) {
          var k = String(inner).replace(/<[^>]*>/g, '').replace(/\s+/g, '');
          if (!/^[a-zA-Z0-9_]+$/.test(k)) return '';
          return data[k] == null ? '' : esc(data[k]);
        });
        frame.srcdoc = html;
      }
    }

    function paintLang() {
      ['ed-lang-en', 'ed-lang-ar'].forEach(function (bid) {
        var b = document.getElementById(bid);
        if (!b) return;
        var on = (bid === 'ed-lang-en' && state.locale === 'en') || (bid === 'ed-lang-ar' && state.locale === 'ar');
        b.style.background = on ? 'rgba(255,255,255,0.08)' : 'transparent';
        b.style.color = on ? '#F2F4F8' : '#8B90A3';
      });
    }

    function paintFooter() {
      var foot = document.getElementById('ed-foot');
      if (!foot) return;
      var hasAr = localeHasCopy(state.ar);
      foot.innerHTML =
        '<span style="font-size:13px;color:#8B90A3">' + esc(savedLabel()) +
        (hasAr ? '' : ' · <span style="color:#FBBF24">EN only until Arabic is added</span>') + '</span>' +
        '<button type="button" id="ed-copy-ar" style="height:36px;padding:0 12px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#F2F4F8;font-size:13px;font-weight:600;cursor:pointer;margin-left:auto">Copy English into Arabic</button>' +
        '<button type="button" id="ed-test" class="scp5" style="height:36px;padding:0 12px;border:1px solid rgba(255,255,255,0.16);border-radius:10px;background:transparent;color:#F2F4F8;font-size:13px;font-weight:600;cursor:pointer">Send test to me</button>' +
        '<button type="button" id="ed-save" class="btn-primary scp4" style="height:36px;padding:0 14px;border:0;border-radius:10px;background:#2EE8FF;color:#04141A;font-size:13px;font-weight:600;cursor:pointer">Save template</button>';
      var copy = document.getElementById('ed-copy-ar');
      var test = document.getElementById('ed-test');
      var save = document.getElementById('ed-save');
      if (copy) copy.addEventListener('click', function () {
        state.ar = clone(state.en);
        state.locale = 'ar';
        state.dirty = true;
        paint();
        toast('English copied into Arabic. Edit the translation.');
      });
      if (test) test.addEventListener('click', sendTest);
      if (save) save.addEventListener('click', saveTpl);
    }

    function paintBlock(b, i) {
      var unknown = state.unknown;
      function bad(val) {
        return unknown.some(function (k) { return String(val || '').indexOf('{{' + k + '}}') >= 0; });
      }
      var body = '';
      if (b.type === 'button') {
        body = labeledInput('b-' + i + '-label', 'Label', b.label, { bad: bad(b.label) }) +
          labeledInput('b-' + i + '-href', 'Link', b.href, { bad: bad(b.href) });
      } else if (b.type === 'callout') {
        body = labeledInput('b-' + i + '-label', 'Label', b.label, { bad: bad(b.label) }) +
          labeledInput('b-' + i + '-text', 'Text', b.text, { area: true, bad: bad(b.text) });
      } else if (b.type === 'kv') {
        body = (b.rows || []).map(function (r, ri) {
          return '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px;align-items:end">' +
            labeledInput('b-' + i + '-k-' + ri, 'Label', r[0], { bad: bad(r[0]) }) +
            labeledInput('b-' + i + '-v-' + ri, 'Value', r[1], { bad: bad(r[1]) }) +
            '<button type="button" data-rm-row="' + i + ':' + ri + '" aria-label="Remove row ' + (ri + 1) + '" style="height:36px;width:36px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:transparent;color:#FF8AD0;cursor:pointer">×</button></div>';
        }).join('') + '<button type="button" data-add-row="' + i + '" style="height:30px;padding:0 10px;border:1px dashed rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#B7BCCB;font-size:12.5px;cursor:pointer">+ Row</button>';
      } else if (b.type === 'list' || b.type === 'steps') {
        body = (b.items || []).map(function (item, ii) {
          return '<div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:end">' +
            labeledInput('b-' + i + '-i-' + ii, (b.type === 'steps' ? 'Step ' : 'Item ') + (ii + 1), item, { bad: bad(item) }) +
            '<button type="button" data-rm-item="' + i + ':' + ii + '" aria-label="Remove ' + (b.type === 'steps' ? 'step ' : 'item ') + (ii + 1) + '" style="height:36px;width:36px;border:1px solid rgba(255,255,255,0.12);border-radius:8px;background:transparent;color:#FF8AD0;cursor:pointer">×</button></div>';
        }).join('') + '<button type="button" data-add-item="' + i + '" style="height:30px;padding:0 10px;border:1px dashed rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#B7BCCB;font-size:12.5px;cursor:pointer">+ ' + (b.type === 'steps' ? 'Step' : 'Item') + '</button>';
      } else if (b.type === 'image') {
        body = labeledInput('b-' + i + '-src', 'Image URL', b.src, { bad: bad(b.src) }) +
          labeledInput('b-' + i + '-alt', 'Alt text', b.alt, { bad: bad(b.alt) });
      } else if (b.type === 'code') {
        body = labeledInput('b-' + i + '-value', 'Code', b.value, { bad: bad(b.value) }) +
          labeledInput('b-' + i + '-note', 'Note under the code', b.note, { bad: bad(b.note) });
      } else if (b.type === 'status') {
        body = labeledInput('b-' + i + '-text', 'Status label', b.text, { bad: bad(b.text) });
      } else if (b.type === 'spacer') {
        body = '<label style="display:flex;flex-direction:column;gap:4px;font-family:Geist Mono,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8B90A3">Height in pixels<input data-field="b-' + i + '-height" type="number" min="8" max="80" value="' + (b.height || 16) + '" class="scp3" style="height:36px;background:#07080C;border:1px solid rgba(255,255,255,0.16);border-radius:8px;padding:0 10px;color:#F2F4F8;font-family:Archivo,sans-serif;font-size:14px;outline:none"></label>';
      } else if (b.type === 'divider') {
        body = '<div style="font-size:12.5px;color:#8B90A3">A thin rule. Nothing to edit.</div>';
      } else {
        body = labeledInput('b-' + i + '-text', b.type === 'h2' ? 'Heading' : 'Text', b.text, { area: true, bad: bad(b.text) });
      }
      var meta = BLOCKS.filter(function (x) { return x.type === b.type; })[0];
      return '<div style="border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:8px;background:#07080C">' +
        '<div style="display:flex;align-items:center;gap:6px"><span style="font-family:Geist Mono,monospace;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#2EE8FF;margin-right:auto">' + esc((meta && meta.name) || b.type) + '</span>' +
        '<button type="button" data-up="' + i + '" aria-label="Move block ' + (i + 1) + ' up" style="width:26px;height:26px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;background:transparent;color:#B7BCCB;cursor:pointer;font-size:12px">↑</button>' +
        '<button type="button" data-down="' + i + '" aria-label="Move block ' + (i + 1) + ' down" style="width:26px;height:26px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;background:transparent;color:#B7BCCB;cursor:pointer;font-size:12px">↓</button>' +
        '<button type="button" data-rm="' + i + '" aria-label="Remove block ' + (i + 1) + '" style="width:26px;height:26px;border:1px solid rgba(255,255,255,0.12);border-radius:6px;background:transparent;color:#FF8AD0;cursor:pointer;font-size:12px">×</button></div>' +
        body + '</div>';
    }

    function paintForm() {
      var form = document.getElementById('ed-form');
      if (!form) return;
      var L = loc();
      var picker = state.pickerOpen
        ? '<div data-block-picker style="display:flex;flex-direction:column;gap:4px;padding:8px;background:#07080C;border:1px solid rgba(255,255,255,0.12);border-radius:10px">' +
          BLOCKS.map(function (b) {
            return '<button type="button" data-add="' + b.type + '" style="display:grid;grid-template-columns:40px minmax(0,1fr);gap:10px;align-items:center;width:100%;text-align:left;padding:8px;border:0;border-radius:8px;background:transparent;color:#F2F4F8;cursor:pointer;white-space:normal">' +
              thumb(b.thumb) + '<div><div style="font-size:13.5px;font-weight:600">' + esc(b.name) + '</div><div style="font-size:12px;color:#8B90A3">' + esc(b.desc) + '</div></div></button>';
          }).join('') + '</div>'
        : '';
      form.innerHTML =
        '<div style="padding:14px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:10px">' +
          '<div style="font-family:Geist Mono,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3">Start from</div>' +
          '<div style="display:grid;grid-template-columns:1fr;gap:8px">' +
          Object.keys(PRESETS).map(function (k) {
            var on = k === state.preset;
            return '<button type="button" data-preset="' + k + '" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:58px;padding:10px 12px;border:1px solid ' + (on ? '#2EE8FF' : 'rgba(255,255,255,0.16)') + ';border-radius:8px;background:' + (on ? 'rgba(46,232,255,0.1)' : 'transparent') + ';color:#F2F4F8;font-family:Archivo,sans-serif;cursor:pointer;text-align:left;white-space:normal"><div style="font-size:13px;font-weight:600">' + k + '</div><div style="font-size:12px;color:#8B90A3;font-weight:400;line-height:1.35">' + esc(PRESETS[k].desc) + '</div></button>';
          }).join('') + '</div></div>' +
        '<div style="padding:14px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:10px">' +
          '<div style="display:flex;align-items:center;gap:8px"><span style="font-family:Geist Mono,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3;margin-right:auto">Header · ' + (state.locale === 'ar' ? 'Arabic' : 'English') + '</span></div>' +
          labeledInput('eyebrow', 'Small label above the title (Account, Review, Course)', L.eyebrow) +
          labeledInput('subject', 'Inbox subject line', L.subject, { warnAt: 60 }) +
          labeledInput('preheader', 'Grey text next to the subject in the inbox', L.preheader, { warnAt: 90 }) +
          labeledInput('title', 'Big headline inside the email', L.title) +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-family:Geist Mono,monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8B90A3;margin-right:auto">Colour of the top rule and the button</span>' +
          ACCENTS.map(function (a) {
            return '<button type="button" data-accent="' + a[0] + '" aria-label="' + a[1] + '" style="width:24px;height:24px;border-radius:6px;background:' + a[0] + ';border:2px solid ' + (state.accent === a[0] ? '#F2F4F8' : 'transparent') + ';cursor:pointer"></button>';
          }).join('') + '</div></div>' +
        '<div style="padding:14px;background:#0E1017;border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;flex-direction:column;gap:8px">' +
          '<div style="font-family:Geist Mono,monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8B90A3">Blocks</div>' +
          (L.blocks.length ? L.blocks.map(paintBlock).join('') : '<div style="font-size:13px;color:#8B90A3;padding:8px 0">No blocks yet. Add one below.</div>') +
          '<button type="button" data-toggle-picker style="height:36px;padding:0 12px;border:1px dashed rgba(255,255,255,0.2);border-radius:8px;background:transparent;color:#B7BCCB;font-size:13px;font-weight:600;cursor:pointer;text-align:left">' + (state.pickerOpen ? 'Close block picker' : '+ Add block') + '</button>' +
          picker +
        '</div>';
      bindForm(form);
    }

    function applyField(key, value) {
      var L = loc();
      if (key === 'eyebrow' || key === 'subject' || key === 'preheader' || key === 'title') {
        L[key] = value;
        setLoc(L);
        return;
      }
      var m = /^b-(\d+)-(.*)$/.exec(key);
      if (!m) return;
      var i = Number(m[1]);
      var rest = m[2];
      var b = L.blocks[i];
      if (!b) return;
      if (rest === 'text') b.text = value;
      else if (rest === 'label') b.label = value;
      else if (rest === 'href') b.href = value;
      else if (rest === 'src') b.src = value;
      else if (rest === 'alt') b.alt = value;
      else if (rest === 'value') b.value = value;
      else if (rest === 'note') b.note = value;
      else if (rest === 'height') b.height = Number(value) || 16;
      else if (rest.indexOf('k-') === 0) { var ki = Number(rest.slice(2)); b.rows[ki][0] = value; }
      else if (rest.indexOf('v-') === 0) { var vi = Number(rest.slice(2)); b.rows[vi][1] = value; }
      else if (rest.indexOf('i-') === 0) { var ii = Number(rest.slice(2)); b.items[ii] = value; }
      setLoc(L);
    }

    function bindForm(form) {
      form.querySelectorAll('[data-preset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var k = btn.getAttribute('data-preset');
          state.preset = k;
          state.accent = PRESETS[k].accent;
          state.en = clone(PRESETS[k].en);
          state.ar = emptyLocale();
          state.locale = 'en';
          state.dirty = true;
          paint();
        });
      });
      form.querySelectorAll('[data-accent]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          state.accent = btn.getAttribute('data-accent');
          state.dirty = true;
          paint();
        });
      });
      form.querySelectorAll('[data-field]').forEach(function (input) {
        input.addEventListener('input', function () {
          applyField(input.getAttribute('data-field'), input.value);
          state.dirty = true;
          var count = form.querySelector('[data-count="' + input.getAttribute('data-field') + '"]');
          if (count) {
            var warn = input.getAttribute('data-field') === 'subject' ? 60 : input.getAttribute('data-field') === 'preheader' ? 90 : 0;
            var n = input.value.length;
            count.textContent = warn && n > warn ? n + ' · keep under ' + warn : String(n);
            count.style.color = warn && n > warn ? '#FBBF24' : '#7C8296';
          }
          markDirty();
        });
        input.addEventListener('focus', function () { state.lastField = input; });
      });
      form.querySelectorAll('[data-insert-open]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var key = btn.getAttribute('data-insert-open');
          var wrap = form.querySelector('[data-insert-wrap="' + key + '"]');
          var open = state.insertOpen === key;
          form.querySelectorAll('[data-field-menu]').forEach(function (m) { m.remove(); });
          state.insertOpen = open ? '' : key;
          if (!open && wrap) {
            wrap.insertAdjacentHTML('beforeend', fieldMenu());
            wrap.querySelectorAll('[data-insert-field]').forEach(function (item) {
              item.addEventListener('click', function (ev) {
                ev.stopPropagation();
                var target = form.querySelector('[data-field="' + key + '"]');
                insertAtCaret(target, item.getAttribute('data-insert-field'));
                applyField(key, target.value);
                state.dirty = true;
                state.insertOpen = '';
                wrap.querySelectorAll('[data-field-menu]').forEach(function (m) { m.remove(); });
                markDirty();
              });
            });
          }
        });
      });
      var toggle = form.querySelector('[data-toggle-picker]');
      if (toggle) toggle.addEventListener('click', function () { state.pickerOpen = !state.pickerOpen; paintForm(); refreshPreview(); paintLang(); });
      form.querySelectorAll('[data-add]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var L = loc();
          L.blocks.push(defaultBlock(btn.getAttribute('data-add')));
          setLoc(L);
          state.pickerOpen = false;
          state.dirty = true;
          paint();
        });
      });
      form.querySelectorAll('[data-up]').forEach(function (btn) {
        btn.addEventListener('click', function () { move(Number(btn.getAttribute('data-up')), -1); });
      });
      form.querySelectorAll('[data-down]').forEach(function (btn) {
        btn.addEventListener('click', function () { move(Number(btn.getAttribute('data-down')), 1); });
      });
      form.querySelectorAll('[data-rm]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var L = loc();
          L.blocks = L.blocks.filter(function (_, j) { return j !== Number(btn.getAttribute('data-rm')); });
          setLoc(L);
          state.dirty = true;
          paint();
        });
      });
      form.querySelectorAll('[data-add-row]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var L = loc();
          L.blocks[Number(btn.getAttribute('data-add-row'))].rows.push(['', '']);
          setLoc(L);
          state.dirty = true;
          paint();
        });
      });
      form.querySelectorAll('[data-rm-row]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var p = btn.getAttribute('data-rm-row').split(':');
          var L = loc();
          L.blocks[Number(p[0])].rows.splice(Number(p[1]), 1);
          if (!L.blocks[Number(p[0])].rows.length) L.blocks[Number(p[0])].rows.push(['', '']);
          setLoc(L);
          state.dirty = true;
          paint();
        });
      });
      form.querySelectorAll('[data-add-item]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var L = loc();
          L.blocks[Number(btn.getAttribute('data-add-item'))].items.push('');
          setLoc(L);
          state.dirty = true;
          paint();
        });
      });
      form.querySelectorAll('[data-rm-item]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var p = btn.getAttribute('data-rm-item').split(':');
          var L = loc();
          L.blocks[Number(p[0])].items.splice(Number(p[1]), 1);
          if (!L.blocks[Number(p[0])].items.length) L.blocks[Number(p[0])].items.push('');
          setLoc(L);
          state.dirty = true;
          paint();
        });
      });
    }

    function move(i, d) {
      var L = loc();
      var j = i + d;
      if (j < 0 || j >= L.blocks.length) return;
      var tmp = L.blocks[i];
      L.blocks[i] = L.blocks[j];
      L.blocks[j] = tmp;
      setLoc(L);
      state.dirty = true;
      paint();
    }

    function paint() {
      var titleEl = document.getElementById('ed-title');
      if (titleEl) titleEl.textContent = isNew ? 'New template' : state.name;
      var lede = document.getElementById('ed-lede');
      if (lede) lede.textContent = 'Build the email once. It renders the same in every inbox.';
      paintLang();
      paintForm();
      paintFooter();
      refreshPreview();
    }

    async function saveTpl() {
      var spec = fullSpec();
      state.unknown = findUnknown(state.en).concat(findUnknown(state.ar)).filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (state.unknown.length) {
        paint();
        toast('Unknown fields: ' + state.unknown.map(function (k) { return '{{' + k + '}}'; }).join(', '));
        return;
      }
      if (!state.id) state.id = slug(state.en.subject || state.en.title || state.name);
      var row = window.TF.getEmailTemplate(state.id) || {
        id: state.id,
        name: state.en.subject || state.en.title || 'Untitled',
        kind: state.kind,
        trigger: state.trigger,
        lang: 'en',
      };
      row.name = state.en.subject || state.en.title || row.name;
      row.spec = spec;
      row.spec_ar = spec.ar || null;
      row.ready = !!spec.ar;
      var saved = await window.TF.saveEmailTemplate(row);
      if (!saved || !saved.ok) {
        toast((saved && saved.message) || 'Could not save the template.');
        paintFooter();
        return false;
      }
      isNew = false;
      state.savedAt = Date.now();
      state.dirty = false;
      toast(spec.ar ? ('Saved ' + row.id) : ('Saved ' + row.id + ' as EN only — add Arabic before it is ready'));
      if (/\/admin\/emails\/(?:templates\/)?new/.test(location.pathname)) {
        history.replaceState({}, '', '/admin/emails/' + row.id + '/');
      }
      paint();
      return true;
    }

    // Unsaved edits are sent as a spec so the test reflects what is on screen.
    async function sendTest() {
      state.unknown = findUnknown(state.en).concat(findUnknown(state.ar)).filter(function (v, i, a) { return a.indexOf(v) === i; });
      if (state.unknown.length) {
        paint();
        toast('Unknown fields: ' + state.unknown.map(function (k) { return '{{' + k + '}}'; }).join(', '));
        return;
      }
      var auth = window.TF.getCurrentUser ? await window.TF.getCurrentUser() : null;
      var email = auth && auth.user && auth.user.email;
      if (!email) { toast('Sign in again to send a test.'); return; }
      var body = { lang: state.locale, to: email };
      if (state.id && !state.dirty) body.id = state.id;
      else body.spec = fullSpec();
      var res = await window.TF.api('/api/admin/emails/test', { body: body });
      if (!res.ok) { toast((res.body && (res.body.message || res.body.error)) || 'Test send failed.'); return; }
      toast('Test sent to ' + email + '.');
    }

    var widthBtn = document.getElementById('ed-width');
    if (widthBtn) widthBtn.addEventListener('click', function () { state.wide = !state.wide; refreshPreview(); });
    var enBtn = document.getElementById('ed-lang-en');
    var arBtn = document.getElementById('ed-lang-ar');
    if (enBtn) enBtn.addEventListener('click', function () { state.locale = 'en'; paint(); });
    if (arBtn) arBtn.addEventListener('click', function () { state.locale = 'ar'; paint(); });
    document.addEventListener('click', function (e) {
      if (!root.contains(e.target)) return;
      if (e.target.closest('[data-insert-wrap]')) return;
      if (state.insertOpen) {
        state.insertOpen = '';
        root.querySelectorAll('[data-field-menu]').forEach(function (m) { m.remove(); });
      }
    });

    var headerTest = document.getElementById('ed-test');
    var headerSave = document.getElementById('ed-save');
    if (headerTest && headerTest.closest('[data-email-editor] > div')) headerTest.hidden = true;
    if (headerSave && headerSave.closest('[data-email-editor] > div')) headerSave.hidden = true;

    Promise.resolve(window.TF.requireAdmin()).then(function (auth) {
      if (!auth) return;
      window.TF.readyEmails.then(function () {
        if (window.TF.emailTemplatesError) toast(window.TF.emailTemplatesError);
        if (!isNew) {
          var row = window.TF.getEmailTemplate(id);
          if (!row) toast('Template "' + id + '" was not found. Saving creates it.');
          if (row) {
            state.id = row.id;
            state.name = row.name;
            state.kind = row.kind;
            state.trigger = row.trigger;
            state.accent = (row.spec && row.spec.accent) || state.accent;
            state.unsubscribe = row.spec && row.spec.unsubscribe;
            state.en = localeFromSpec(row.spec);
            state.ar = localeFromSpec((row.spec && row.spec.ar) || row.spec_ar);
            state.savedAt = row.updated_at ? Date.parse(row.updated_at) : Date.now();
          }
        }
        paint();
      });
    });
  };
})();
