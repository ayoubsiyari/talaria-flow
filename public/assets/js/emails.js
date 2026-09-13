(function () {
  window.TF = window.TF || {};
  var templates = [];

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Merge fields (reviewer note, first name, ...) are user text: always escaped. Unknown fields render empty.
  function fill(html, data) {
    return html.replace(/\{\{([\s\S]*?)\}\}/g, function (_, inner) {
      var k = String(inner).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, '').replace(/\s+/g, '');
      if (!/^[a-zA-Z0-9_]+$/.test(k)) return '';
      return escapeHtml(data && data[k] != null ? data[k] : '');
    });
  }

  function rowFromSpec(spec, i) {
    return {
      id: spec.file || spec.id || ('tpl-' + i),
      name: spec.name,
      kind: spec.kind,
      trigger: spec.trigger,
      spec: spec,
      spec_ar: spec.spec_ar || null,
      lang: spec.lang || 'en',
      updated_at: spec.updated_at || null,
    };
  }

  // email_templates rows (one per id+lang) override the built-in JSON spec.
  function applyOverrides(rows) {
    (rows || []).forEach(function (r) {
      if (!r || !r.id || !r.spec) return;
      var row = templates.filter(function (t) { return t.id === r.id; })[0];
      if (!row) {
        row = { id: r.id, name: r.name || r.id, kind: r.kind || 'campaign', trigger: r.trigger || 'Manual send', spec: null, spec_ar: null, lang: 'en', updated_at: r.updated_at || null };
        templates.push(row);
      }
      if (r.lang === 'ar') row.spec_ar = r.spec;
      else {
        row.spec = r.spec;
        if (r.name) row.name = r.name;
        if (r.kind) row.kind = r.kind;
        if (r.trigger) row.trigger = r.trigger;
      }
      if (r.updated_at && (!row.updated_at || r.updated_at > row.updated_at)) row.updated_at = r.updated_at;
    });
  }

  window.TF.getEmailTemplates = function () { return templates.slice(); };
  window.TF.getEmailTemplate = function (id) {
    return templates.filter(function (t) { return t.id === id || (t.spec && t.spec.file === id); })[0] || null;
  };

  /** Persist a template through RLS (admins may upsert email_templates). Resolves { ok, message }. */
  window.TF.saveEmailTemplate = async function (row) {
    var now = new Date().toISOString();
    var found = false;
    templates = templates.map(function (t) {
      if (t.id === row.id) { found = true; return Object.assign({}, t, row, { updated_at: now }); }
      return t;
    });
    if (!found) templates.push(Object.assign({ updated_at: now }, row));
    var sb = window.TF.getClient && window.TF.getClient();
    if (!sb) return { ok: false, message: 'Not connected.' };
    var base = { id: row.id, name: row.name, kind: row.kind, trigger: row.trigger, updated_at: now };
    var payload = [Object.assign({}, base, { spec: row.spec, lang: 'en' })];
    if (row.spec_ar) payload.push(Object.assign({}, base, { spec: row.spec_ar, lang: 'ar' }));
    try {
      var res = await sb.from('email_templates').upsert(payload);
      if (res && res.error) return { ok: false, message: res.error.message || 'Could not save the template.' };
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e && e.message) || 'Could not save the template.' };
    }
  };

  function missingArHtml() {
    return '<!doctype html><html lang="en"><body style="margin:0;background:#07080C;color:#F2F4F8;font-family:Archivo,sans-serif"><div style="min-height:360px;display:grid;place-items:center;padding:40px 24px;text-align:center"><div><div style="font-size:16px;font-weight:600;margin-bottom:8px">No Arabic version yet</div><div style="font-size:13.5px;color:#8B90A3">Add translation — English is not shown here as a silent fallback.</div></div></div></body></html>';
  }

  function hasArabic(spec) {
    return !!(spec && spec.ar && (spec.ar.title || spec.ar.subject || (spec.ar.blocks && spec.ar.blocks.length)));
  }
  window.TF.hasArabic = function (row) {
    if (!row) return false;
    if (row.spec_ar && (row.spec_ar.title || row.spec_ar.subject || (row.spec_ar.blocks && row.spec_ar.blocks.length))) return true;
    return hasArabic(row.spec || row);
  };

  /** Render a template (by id or spec object) for preview. `data` holds the only merge values used. */
  window.TF.renderEmail = async function (id, lang, data) {
    if (!window.TFEmail) throw new Error('TFEmail renderer missing');
    var row = typeof id === 'object' ? { spec: id, id: id.file || id.id } : window.TF.getEmailTemplate(id);
    if (!row) {
      row = templates.filter(function (t) { return t.id.indexOf(String(id)) === 0 || t.id.slice(0, 2) === String(id); })[0];
    }
    if (!row) throw new Error('Unknown template ' + id);
    var spec = JSON.parse(JSON.stringify(row.spec || row));
    if (row.spec_ar && !spec.ar) spec.ar = row.spec_ar;
    lang = lang === 'ar' ? 'ar' : 'en';
    var origin = (typeof location !== 'undefined' && location.origin) ? location.origin : '';
    var payload = Object.assign({
      first_name: 'there',
      email: '',
      hero_image_url: origin + '/assets/nt-platform.png',
      hero_image_alt: 'Talaria Flow suite on a NinjaTrader chart',
      dashboard_url: origin + '/account/access/',
      course_url: origin + '/account/course/',
    }, data || {});
    if (lang === 'ar' && !hasArabic(spec)) {
      return { html: missingArHtml(), subject: 'No Arabic version yet · Add translation', data: payload, spec: spec, missingAr: true };
    }
    var html = window.TFEmail.render(spec, { baseUrl: '/', lang: lang });
    html = fill(html, payload);
    var resolved = (lang === 'ar' && spec.ar) ? Object.assign({}, spec, spec.ar, { lang: 'ar' }) : spec;
    var subject = fill(resolved.subject || row.name || '', payload);
    return { html: html, subject: subject, data: payload, spec: resolved, missingAr: false };
  };

  async function loadOverrides() {
    var sb = null;
    try {
      sb = window.TF.ensureClient ? await window.TF.ensureClient() : (window.TF.getClient && window.TF.getClient());
    } catch (e) { sb = null; }
    if (!sb) return;
    var res = await sb.from('email_templates').select('id, name, kind, trigger, spec, lang, updated_at');
    if (res && res.error) throw res.error;
    applyOverrides((res && res.data) || []);
  }

  function bootTemplates() {
    if (!/(?:^|\/)admin(?:\/|$)/.test(location.pathname)) return Promise.resolve();
    return fetch('/assets/emails/templates.json')
      .then(function (r) { if (!r.ok) throw new Error('templates.json ' + r.status); return r.json(); })
      .then(function (list) {
        templates = (list || []).map(rowFromSpec);
        window.TF.emailTemplatesError = '';
      })
      .catch(function () {
        templates = [];
        window.TF.emailTemplatesError = 'Could not load the email templates.';
      })
      .then(function () {
        return loadOverrides().catch(function () {
          window.TF.emailTemplatesError = window.TF.emailTemplatesError || 'Could not load saved template edits.';
        });
      });
  }
  window.TF.readyEmails = bootTemplates();
})();
