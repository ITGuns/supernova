import { useNotifications } from '../store/notificationStore';
import { useWorkflows, type BusinessRule, type WorkflowEvent } from '../store/workflowStore';

// Business rules (Setup → Workflows). A rule's condition is plain text such
// as "sale total is over $500", "items more than 10", "discount over 20%",
// "no customer" or "customer is Jane Smith"; this evaluates it against the
// event's context and returns what the register should do.

export interface RuleContext {
  totalMinor?: number;
  items?: number;
  discountMinor?: number;
  customerName?: string;
  productName?: string;
  stock?: number;
  user?: string;
}

export interface RuleOutcome {
  /** Messages to show the cashier. */
  messages: string[];
  /** Notes to add to the sale. */
  notes: string[];
  /** Rules that need a manager's password before continuing. */
  approvals: BusinessRule[];
}

const num = (s: string): number | null => {
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]!) : null;
};

/** Whether a rule's condition holds. An empty condition always applies. */
export function conditionHolds(condition: string, ctx: RuleContext): boolean {
  const c = condition.trim().toLowerCase();
  if (!c) return true;
  const over = /(over|above|more than|greater than|at least|>=|>)/.test(c);
  const under = /(under|below|less than|fewer than|at most|<=|<)/.test(c);
  const n = num(c);
  if (/no customer|customer is empty|without (a )?customer|customer is missing/.test(c)) return !(ctx.customerName ?? '').trim();
  if (/has (a )?customer|customer is set|customer attached/.test(c)) return !!(ctx.customerName ?? '').trim();
  const custIs = c.match(/customer (?:is|equals|=) (.+)/);
  if (custIs) return (ctx.customerName ?? '').trim().toLowerCase() === custIs[1]!.trim().replace(/["']/g, '');
  const cmp = (value: number, threshold: number) => (over ? value >= threshold : under ? value <= threshold : value === threshold);
  if (n === null) return true;
  if (/discount/.test(c)) {
    if (/%/.test(c)) {
      const pct = (ctx.totalMinor ?? 0) + (ctx.discountMinor ?? 0) > 0 ? ((ctx.discountMinor ?? 0) / ((ctx.totalMinor ?? 0) + (ctx.discountMinor ?? 0))) * 100 : 0;
      return cmp(pct, n);
    }
    return cmp((ctx.discountMinor ?? 0) / 100, n);
  }
  if (/item|unit|quantit|qty/.test(c)) return cmp(ctx.items ?? 0, n);
  if (/stock|on hand|inventory/.test(c)) return cmp(ctx.stock ?? 0, n);
  // Default: the sale total in dollars.
  return cmp((ctx.totalMinor ?? 0) / 100, n);
}

/** Evaluate every enabled rule for an event. Emails become in-app notifications to the owner. */
export function runRules(event: WorkflowEvent, ctx: RuleContext): RuleOutcome {
  const rules = useWorkflows.getState().rules.filter((r) => r.enabled && r.event === event && conditionHolds(r.condition, ctx));
  const out: RuleOutcome = { messages: [], notes: [], approvals: [] };
  for (const r of rules) {
    const text = r.message || `${r.name}${r.condition ? ` (${r.condition})` : ''}`;
    if (r.action === 'Show a message to the cashier') out.messages.push(text);
    else if (r.action === 'Add a note to the sale') out.notes.push(text);
    else if (r.action === 'Require a manager to approve') out.approvals.push(r);
    else if (r.action === 'Email the account owner') {
      const detail = [ctx.productName, ctx.customerName ? `Customer ${ctx.customerName}` : '', ctx.totalMinor !== undefined ? `Total $${(ctx.totalMinor / 100).toFixed(2)}` : '', ctx.user ? `by ${ctx.user}` : ''].filter(Boolean).join(' · ');
      useNotifications.getState().notify(`${event}: ${r.name}`, `${text}${detail ? ` — ${detail}` : ''}`);
    }
  }
  return out;
}
