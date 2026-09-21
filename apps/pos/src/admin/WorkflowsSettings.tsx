import { useState } from 'react';
import { useCustomFields, type CustomField, type CustomFieldApplication, type CustomFieldType } from '../store/customFieldStore';
import { WORKFLOW_ACTIONS, WORKFLOW_EVENTS, useWorkflows, type BusinessRule, type WorkflowAction, type WorkflowEvent } from '../store/workflowStore';
import { Switch } from './controls';

// Setup → Workflows: custom fields, business rules and the events they run on.

const APPLICATIONS: CustomFieldApplication[] = ['Customers', 'Products', 'Sales', 'Users', 'Services'];
const ENTITIES: Record<CustomFieldApplication, string[]> = {
  Customers: ['Customer'],
  Products: ['Product'],
  Sales: ['Sale', 'Sale line item'],
  Users: ['User'],
  Services: ['Service'],
};
const TYPES: CustomFieldType[] = ['Text', 'Number', 'Date', 'Checkbox', 'Dropdown'];

const selStyle = { height: '38px', background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: '8px', padding: '0 8px' } as const;

export function WorkflowsSettings() {
  const fields = useCustomFields((s) => s.fields);
  const addField = useCustomFields((s) => s.addField);
  const updateField = useCustomFields((s) => s.updateField);
  const deleteField = useCustomFields((s) => s.deleteField);
  const rules = useWorkflows((s) => s.rules);
  const addRule = useWorkflows((s) => s.addRule);
  const updateRule = useWorkflows((s) => s.updateRule);
  const deleteRule = useWorkflows((s) => s.deleteRule);

  const [tab, setTab] = useState<'fields' | 'rules' | 'events'>('fields');
  const [appFilter, setAppFilter] = useState<'all' | CustomFieldApplication>('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [fieldModal, setFieldModal] = useState<(Omit<CustomField, 'id' | 'createdAt'> & { id?: string }) | null>(null);
  const [ruleModal, setRuleModal] = useState<(Omit<BusinessRule, 'id' | 'createdAt'> & { id?: string }) | null>(null);
  const [error, setError] = useState('');

  const [applied, setApplied] = useState<{ app: 'all' | CustomFieldApplication; entity: string }>({ app: 'all', entity: 'all' });
  const visibleFields = fields.filter((f) => (applied.app === 'all' || f.application === applied.app) && (applied.entity === 'all' || f.entity === applied.entity));

  const saveField = () => {
    if (!fieldModal) return;
    const name = fieldModal.name.trim();
    if (!name) return setError('Give the custom field a name.');
    if (fields.some((f) => f.id !== fieldModal.id && f.name.toLowerCase() === name.toLowerCase() && f.application === fieldModal.application)) return setError(`A ${fieldModal.application.toLowerCase()} field called “${name}” already exists.`);
    if (fieldModal.type === 'Dropdown' && fieldModal.options.filter(Boolean).length < 2) return setError('Give the dropdown at least two options.');
    const body = { ...fieldModal, name, options: fieldModal.type === 'Dropdown' ? fieldModal.options.map((o) => o.trim()).filter(Boolean) : [] };
    if (fieldModal.id) updateField(fieldModal.id, body);
    else addField(body);
    setFieldModal(null);
  };

  const saveRule = () => {
    if (!ruleModal) return;
    const name = ruleModal.name.trim();
    if (!name) return setError('Give the rule a name.');
    if (ruleModal.id) updateRule(ruleModal.id, { ...ruleModal, name });
    else addRule({ ...ruleModal, name });
    setRuleModal(null);
  };

  return (
    <>
      <h1 className="page-title">Workflows</h1>
      <div className="sh-tabs">
        <button className={`sh-tab ${tab === 'fields' ? 'active' : ''}`} onClick={() => setTab('fields')}>Custom fields</button>
        <button className={`sh-tab ${tab === 'rules' ? 'active' : ''}`} onClick={() => setTab('rules')}>Business rules</button>
        <button className={`sh-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}>Events</button>
      </div>

      {tab === 'fields' && (
        <>
          <div className="subbar-row">
            <span>Custom fields allow you to store custom data about specific products, customers and other entities in Nova Retail. <span className="rlink">Need help?</span></span>
            <button className="btn-p" onClick={() => { setFieldModal({ name: '', application: 'Customers', entity: 'Customer', type: 'Text', options: [] }); setError(''); }}>Add custom field</button>
          </div>
          <div className="sc-filter-card">
            <div className="sc-frow">
              <div className="f-field">
                <label>Application</label>
                <select className="set-select" value={appFilter} onChange={(e) => { setAppFilter(e.target.value as typeof appFilter); setEntityFilter('all'); }} style={selStyle}>
                  <option value="all">All</option>
                  {APPLICATIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="f-field">
                <label>Entity</label>
                <select className="set-select" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={selStyle}>
                  <option value="all">All</option>
                  {(appFilter === 'all' ? APPLICATIONS.flatMap((a) => ENTITIES[a]) : ENTITIES[appFilter]).map((e) => <option key={e}>{e}</option>)}
                </select>
              </div>
              <div className="f-field f-field-btn">
                <button className="btn-p" onClick={() => setApplied({ app: appFilter, entity: entityFilter })}>Search</button>
              </div>
            </div>
          </div>
          <div className="inv-count">Displaying {visibleFields.length} custom field{visibleFields.length === 1 ? '' : 's'}</div>
          <div className="atable">
            <div className="athead wf4">
              <span>Custom field</span>
              <span>Application</span>
              <span>Entity</span>
              <span>Type</span>
              <span />
            </div>
            {visibleFields.length === 0 && <div className="ct-empty">No custom fields yet. Add one to start capturing extra details.</div>}
            {visibleFields.map((f) => (
              <div key={f.id} className="arow wf4">
                <span className="rlink" onClick={() => { setFieldModal({ ...f }); setError(''); }}>{f.name}</span>
                <span>{f.application}</span>
                <span>{f.entity}</span>
                <span>{f.type}{f.options.length ? <span className="ct-muted"> · {f.options.join(', ')}</span> : null}</span>
                <span className="row-actions">
                  <span className="ic" onClick={() => { setFieldModal({ ...f }); setError(''); }}>✎</span>
                  <span className="ic" onClick={() => deleteField(f.id)}>🗑</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'rules' && (
        <>
          <div className="subbar-row">
            <span>Business rules run automatically when an event happens in your store. <span className="rlink">Need help?</span></span>
            <button className="btn-p" onClick={() => { setRuleModal({ name: '', event: 'Sale completed', condition: '', action: 'Show a message to the cashier', message: '', enabled: true }); setError(''); }}>Add business rule</button>
          </div>
          <div className="atable">
            <div className="athead wf5">
              <span>Rule</span>
              <span>Event</span>
              <span>Action</span>
              <span className="c">Enabled</span>
              <span />
            </div>
            {rules.length === 0 && <div className="ct-empty">No business rules yet. For example: when a sale over $500 is completed, require a manager to approve.</div>}
            {rules.map((r) => (
              <div key={r.id} className="arow wf5">
                <span>
                  <span className="rlink" onClick={() => { setRuleModal({ ...r }); setError(''); }}>{r.name}</span>
                  {r.condition && <><br /><span className="ct-muted">When {r.condition}</span></>}
                </span>
                <span>{r.event}</span>
                <span>{r.action}{r.message ? <span className="ct-muted"> · “{r.message}”</span> : null}</span>
                <span className="c"><Switch on={r.enabled} onClick={() => updateRule(r.id, { enabled: !r.enabled })} /></span>
                <span className="row-actions"><span className="ic" onClick={() => deleteRule(r.id)}>🗑</span></span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'events' && (
        <>
          <div className="subbar-row">
            <span>Events are the moments in your store a business rule can react to.</span>
          </div>
          <div className="atable">
            <div className="athead wf3">
              <span>Event</span>
              <span>Description</span>
              <span className="r">Rules</span>
            </div>
            {WORKFLOW_EVENTS.map((ev) => (
              <div key={ev.name} className="arow wf3">
                <span>{ev.name}</span>
                <span className="ct-muted">{ev.description}</span>
                <span className="r">{rules.filter((r) => r.event === ev.name).length}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {fieldModal && (
        <div className="pm-overlay" onClick={() => setFieldModal(null)}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>{fieldModal.id ? 'Edit custom field' : 'Add custom field'}</h2>
              <button className="pm-close" onClick={() => setFieldModal(null)} aria-label="Close">×</button>
            </div>
            <form className="reg-open-body" onSubmit={(e) => { e.preventDefault(); saveField(); }}>
              {error && <div className="pe-error" role="alert">{error}</div>}
              <label className="reg-open-field"><span>Name</span><input value={fieldModal.name} autoFocus onChange={(e) => { setFieldModal({ ...fieldModal, name: e.target.value }); setError(''); }} placeholder="e.g. Membership number" /></label>
              <div className="reg-two">
                <label className="reg-open-field">
                  <span>Application</span>
                  <select value={fieldModal.application} onChange={(e) => { const application = e.target.value as CustomFieldApplication; setFieldModal({ ...fieldModal, application, entity: ENTITIES[application][0] ?? '' }); }}>
                    {APPLICATIONS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
                <label className="reg-open-field">
                  <span>Entity</span>
                  <select value={fieldModal.entity} onChange={(e) => setFieldModal({ ...fieldModal, entity: e.target.value })}>
                    {ENTITIES[fieldModal.application].map((en) => <option key={en}>{en}</option>)}
                  </select>
                </label>
              </div>
              <label className="reg-open-field">
                <span>Type</span>
                <select value={fieldModal.type} onChange={(e) => setFieldModal({ ...fieldModal, type: e.target.value as CustomFieldType })}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              {fieldModal.type === 'Dropdown' && (
                <label className="reg-open-field">
                  <span>Options <span className="pe-hint">One per line</span></span>
                  <textarea rows={4} value={fieldModal.options.join('\n')} onChange={(e) => { setFieldModal({ ...fieldModal, options: e.target.value.split('\n') }); setError(''); }} placeholder={'Small\nMedium\nLarge'} />
                </label>
              )}
              <button className="pm-complete" type="submit">{fieldModal.id ? 'Save changes' : 'Add custom field'}</button>
            </form>
          </div>
        </div>
      )}

      {ruleModal && (
        <div className="pm-overlay" onClick={() => setRuleModal(null)}>
          <div className="pm reg-open" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="pm-head">
              <h2>{ruleModal.id ? 'Edit business rule' : 'Add business rule'}</h2>
              <button className="pm-close" onClick={() => setRuleModal(null)} aria-label="Close">×</button>
            </div>
            <form className="reg-open-body" onSubmit={(e) => { e.preventDefault(); saveRule(); }}>
              {error && <div className="pe-error" role="alert">{error}</div>}
              <label className="reg-open-field"><span>Rule name</span><input value={ruleModal.name} autoFocus onChange={(e) => { setRuleModal({ ...ruleModal, name: e.target.value }); setError(''); }} placeholder="e.g. Manager approval for big sales" /></label>
              <label className="reg-open-field">
                <span>When this event happens</span>
                <select value={ruleModal.event} onChange={(e) => setRuleModal({ ...ruleModal, event: e.target.value as WorkflowEvent })}>
                  {WORKFLOW_EVENTS.map((ev) => <option key={ev.name}>{ev.name}</option>)}
                </select>
              </label>
              <label className="reg-open-field"><span>Only if <span className="pe-hint">(Optional)</span></span><input value={ruleModal.condition} onChange={(e) => setRuleModal({ ...ruleModal, condition: e.target.value })} placeholder="e.g. sale total is over $500" /></label>
              <label className="reg-open-field">
                <span>Do this</span>
                <select value={ruleModal.action} onChange={(e) => setRuleModal({ ...ruleModal, action: e.target.value as WorkflowAction })}>
                  {WORKFLOW_ACTIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              <label className="reg-open-field"><span>Message <span className="pe-hint">(Optional)</span></span><input value={ruleModal.message} onChange={(e) => setRuleModal({ ...ruleModal, message: e.target.value })} placeholder="Shown to the cashier or added to the note" /></label>
              <button className="pm-complete" type="submit">{ruleModal.id ? 'Save changes' : 'Add business rule'}</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
