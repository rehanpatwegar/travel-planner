/**
 * Group Trip Split Calculation Engine
 * Pure, deterministic calculation of equal splits, per-currency member balances,
 * and greedy minimal-transaction settlement plans.
 *
 * Design Guarantees:
 * 1. Integer Cent Precision: All monetary operations are performed in integer cents
 *    to prevent IEEE 754 floating point drift.
 * 2. Strict Currency Isolation: Balances and settlements are never merged or converted
 *    across different currencies without verified rates.
 * 3. Exact Total Preservation: Remainder cents from uneven divisions are deterministically
 *    distributed so the sum of individual shares always equals the total expense.
 * 4. Legacy Expense Protection: Expenses lacking a valid payer or split records are
 *    isolated and do not silently distort active member balances.
 * 5. Deterministic Greedy Settlement: Generates human-readable debt simplification
 *    independently per currency.
 */

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

export type MemberRole = "owner" | "member";
export type SplitType = "equal" | "custom";

export interface SplitEngineMember {
  id: string;
  display_name: string;
  role?: MemberRole;
  email?: string | null;
  user_id?: string | null;
}

export interface SplitEngineExpense {
  id: string;
  trip_id?: string;
  title: string;
  amount: number | string;
  currency: string;
  paid_by_member_id?: string | null;
  split_type?: SplitType;
  expense_date?: string | null;
  payment_method?: string | null;
  itinerary_item_id?: string | null;
}

export interface SplitEngineSplit {
  id?: string;
  expense_id: string;
  member_id: string;
  amount: number | string;
}

export interface MemberSplitShare {
  memberId: string;
  cents: number;
  amount: number; // e.g. 33.34
}

export interface EqualSplitResult {
  totalCents: number;
  totalAmount: number;
  shares: MemberSplitShare[];
  sharesByMemberId: Record<string, MemberSplitShare>;
}

export interface MemberBalanceSummary {
  memberId: string;
  displayName: string;
  role: MemberRole;
  paidCents: number;
  shareCents: number;
  netCents: number;
  paidAmount: number;
  shareAmount: number;
  netBalance: number; // positive = gets back, negative = owes, 0 = settled
}

export interface SettlementTransaction {
  fromMemberId: string;
  fromDisplayName: string;
  toMemberId: string;
  toDisplayName: string;
  amountCents: number;
  amount: number;
  currency: string;
}

export interface CurrencyBalanceReport {
  currency: string;
  totalExpensesCents: number;
  totalExpensesAmount: number;
  activeExpensesCount: number;
  memberBalances: MemberBalanceSummary[];
  balancesByMemberId: Record<string, MemberBalanceSummary>;
  settlements: SettlementTransaction[];
  isBalanced: boolean; // sum of net balances === 0
  netDiscrepancyCents: number;
}

export interface GroupBalancesInput {
  members: SplitEngineMember[];
  expenses: SplitEngineExpense[];
  splits?: SplitEngineSplit[];
}

export interface GroupBalancesResult {
  reportsByCurrency: Record<string, CurrencyBalanceReport>;
  currencies: string[];
  unassignedExpenses: SplitEngineExpense[];
  incompleteExpenses: Array<{ expense: SplitEngineExpense; reason: string }>;
  validationErrors: string[];
}

// -----------------------------------------------------------------------------
// Helper Utilities
// -----------------------------------------------------------------------------

/**
 * Converts a decimal monetary amount to integer cents safely.
 */
export function toCents(amount: number | string): number {
  const num = typeof amount === "number" ? amount : parseFloat(String(amount).trim());
  if (isNaN(num) || !isFinite(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Converts integer cents back to a 2-decimal floating point number.
 */
export function fromCents(cents: number): number {
  if (isNaN(cents) || !isFinite(cents)) return 0;
  return Math.round(cents) / 100;
}

// -----------------------------------------------------------------------------
// 1. Equal Split Algorithm
// -----------------------------------------------------------------------------

/**
 * Calculates an exact equal split among an ordered list of member IDs.
 * Distributes remainder cents deterministically to the first R members so that:
 * sum(shares) === totalAmount exactly.
 *
 * @throws Error if amount is invalid, members list is empty, or duplicate IDs exist.
 */
export function calculateEqualSplit(
  totalAmount: number | string,
  memberIds: string[]
): EqualSplitResult {
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    throw new Error("Split participant list cannot be empty.");
  }

  // Validate duplicate member IDs
  const uniqueIds = new Set(memberIds);
  if (uniqueIds.size !== memberIds.length) {
    throw new Error("Duplicate member IDs are not permitted in split participants.");
  }

  // Validate member ID strings
  for (const id of memberIds) {
    if (!id || typeof id !== "string" || !id.trim()) {
      throw new Error("Invalid member ID supplied to split.");
    }
  }

  const totalCents = toCents(totalAmount);
  if (totalCents <= 0) {
    throw new Error("Split total amount must be a positive number greater than zero.");
  }

  const count = memberIds.length;
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;

  const shares: MemberSplitShare[] = [];
  const sharesByMemberId: Record<string, MemberSplitShare> = {};

  memberIds.forEach((memberId, index) => {
    // First remainderCents members receive 1 extra cent
    const cents = index < remainderCents ? baseCents + 1 : baseCents;
    const share: MemberSplitShare = {
      memberId,
      cents,
      amount: fromCents(cents),
    };
    shares.push(share);
    sharesByMemberId[memberId] = share;
  });

  return {
    totalCents,
    totalAmount: fromCents(totalCents),
    shares,
    sharesByMemberId,
  };
}

// -----------------------------------------------------------------------------
// 2. Greedy Debt Settlement Algorithm
// -----------------------------------------------------------------------------

/**
 * Generates a simplified, deterministic settlement plan for a single currency.
 * Matches debtors (net < 0) and creditors (net > 0) in descending order of balance.
 *
 * Note: This implements a greedy balance resolution algorithm. It eliminates redundant
 * intermediate transactions (e.g. A -> B and B -> C simplifies directly to A -> C) in O(N log N)
 * time. It is mathematically exact (all debts are settled to 0) but is a heuristic simplification,
 * not a guarantee of the theoretical global minimum number of transactions (which is NP-complete).
 */
export function computeSettlementTransactions(
  memberBalances: MemberBalanceSummary[],
  currency: string
): SettlementTransaction[] {
  // Separate into debtors (owe money) and creditors (are owed money)
  const debtors = memberBalances
    .filter((b) => b.netCents < 0)
    .map((b) => ({
      memberId: b.memberId,
      displayName: b.displayName,
      remainingCents: Math.abs(b.netCents),
    }))
    .sort((a, b) => b.remainingCents - a.remainingCents || a.memberId.localeCompare(b.memberId));

  const creditors = memberBalances
    .filter((b) => b.netCents > 0)
    .map((b) => ({
      memberId: b.memberId,
      displayName: b.displayName,
      remainingCents: b.netCents,
    }))
    .sort((a, b) => b.remainingCents - a.remainingCents || a.memberId.localeCompare(b.memberId));

  const totalDebt = debtors.reduce((sum, d) => sum + d.remainingCents, 0);
  const totalCredit = creditors.reduce((sum, c) => sum + c.remainingCents, 0);

  // If debts and credits do not balance, the ledger has incomplete/asymmetric data
  if (totalDebt !== totalCredit) {
    return [];
  }

  const transactions: SettlementTransaction[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleCents = Math.min(debtor.remainingCents, creditor.remainingCents);

    if (settleCents > 0) {
      transactions.push({
        fromMemberId: debtor.memberId,
        fromDisplayName: debtor.displayName,
        toMemberId: creditor.memberId,
        toDisplayName: creditor.displayName,
        amountCents: settleCents,
        amount: fromCents(settleCents),
        currency: currency.toUpperCase(),
      });

      debtor.remainingCents -= settleCents;
      creditor.remainingCents -= settleCents;
    }

    if (debtor.remainingCents === 0) {
      dIdx++;
    }
    if (creditor.remainingCents === 0) {
      cIdx++;
    }
  }

  return transactions;
}

// -----------------------------------------------------------------------------
// 3. Complete Group Balances & Settlement Engine
// -----------------------------------------------------------------------------

/**
 * Computes per-currency group spending, member liabilities, net balances,
 * and settlement plans for a trip.
 */
export function computeGroupBalances(input: GroupBalancesInput): GroupBalancesResult {
  const members = Array.isArray(input.members) ? input.members : [];
  const expenses = Array.isArray(input.expenses) ? input.expenses : [];
  const splits = Array.isArray(input.splits) ? input.splits : [];

  const validationErrors: string[] = [];
  const unassignedExpenses: SplitEngineExpense[] = [];
  const incompleteExpenses: Array<{ expense: SplitEngineExpense; reason: string }> = [];

  // Build member lookup map & check duplicates
  const memberMap = new Map<string, SplitEngineMember>();
  for (const m of members) {
    if (!m.id || typeof m.id !== "string") {
      validationErrors.push("Encountered member record with invalid or missing ID.");
      continue;
    }
    if (memberMap.has(m.id)) {
      validationErrors.push(`Duplicate member ID detected in member list: ${m.id}`);
      continue;
    }
    memberMap.set(m.id, m);
  }

  // Group splits by expense_id
  const splitsByExpenseId = new Map<string, SplitEngineSplit[]>();
  for (const s of splits) {
    if (!s.expense_id || !s.member_id) continue;
    const existing = splitsByExpenseId.get(s.expense_id) || [];
    existing.push(s);
    splitsByExpenseId.set(s.expense_id, existing);
  }

  // Group expenses by currency
  const expensesByCurrency = new Map<string, SplitEngineExpense[]>();

  for (const exp of expenses) {
    const rawAmount = exp.amount;
    const costCents = toCents(rawAmount);

    if (costCents <= 0) {
      incompleteExpenses.push({
        expense: exp,
        reason: "Expense amount must be a positive number greater than zero.",
      });
      continue;
    }

    const cur = (exp.currency || "USD").trim().toUpperCase();

    // Check if expense is unassigned (no payer specified)
    if (!exp.paid_by_member_id) {
      unassignedExpenses.push(exp);
      continue;
    }

    // Check if payer exists in trip members
    if (!memberMap.has(exp.paid_by_member_id)) {
      unassignedExpenses.push(exp);
      validationErrors.push(
        `Expense "${exp.title}" references unknown payer member ID: ${exp.paid_by_member_id}`
      );
      continue;
    }

    // Check if splits exist for this expense
    const expSplits = splitsByExpenseId.get(exp.id);
    if (!expSplits || expSplits.length === 0) {
      incompleteExpenses.push({
        expense: exp,
        reason: "Expense has no recorded participant split shares.",
      });
      continue;
    }

    // Validate split participant membership & sum of shares
    let totalSplitCents = 0;
    let hasInvalidMember = false;

    for (const split of expSplits) {
      if (!memberMap.has(split.member_id)) {
        hasInvalidMember = true;
        validationErrors.push(
          `Expense "${exp.title}" has split referencing unknown member ID: ${split.member_id}`
        );
        break;
      }
      const splitCents = toCents(split.amount);
      if (splitCents < 0) {
        hasInvalidMember = true;
        validationErrors.push(
          `Expense "${exp.title}" has negative split amount for member: ${split.member_id}`
        );
        break;
      }
      totalSplitCents += splitCents;
    }

    if (hasInvalidMember) {
      incompleteExpenses.push({
        expense: exp,
        reason: "One or more split participants do not belong to this trip.",
      });
      continue;
    }

    // Validate that sum of splits equals total expense amount in cents
    if (totalSplitCents !== costCents) {
      incompleteExpenses.push({
        expense: exp,
        reason: `Split shares total (${fromCents(totalSplitCents)} ${cur}) does not equal expense total (${fromCents(costCents)} ${cur}). Discrepancy: ${fromCents(costCents - totalSplitCents)}`,
      });
      continue;
    }

    // Expense is valid and fully assigned
    const list = expensesByCurrency.get(cur) || [];
    list.push(exp);
    expensesByCurrency.set(cur, list);
  }

  // Compute reports for each currency independently
  const reportsByCurrency: Record<string, CurrencyBalanceReport> = {};
  const currencies: string[] = Array.from(expensesByCurrency.keys()).sort();

  for (const cur of currencies) {
    const validExpList = expensesByCurrency.get(cur) || [];

    // Initialize balance tracking for all members in this currency
    const paidMap = new Map<string, number>();
    const shareMap = new Map<string, number>();

    for (const m of members) {
      paidMap.set(m.id, 0);
      shareMap.set(m.id, 0);
    }

    let totalCurrencyCents = 0;

    for (const exp of validExpList) {
      const expCents = toCents(exp.amount);
      totalCurrencyCents += expCents;

      // Credit payer
      if (exp.paid_by_member_id) {
        const curPaid = paidMap.get(exp.paid_by_member_id) || 0;
        paidMap.set(exp.paid_by_member_id, curPaid + expCents);
      }

      // Debit participants
      const expSplits = splitsByExpenseId.get(exp.id) || [];
      for (const split of expSplits) {
        const splitCents = toCents(split.amount);
        const curShare = shareMap.get(split.member_id) || 0;
        shareMap.set(split.member_id, curShare + splitCents);
      }
    }

    // Construct MemberBalanceSummary objects
    const memberBalances: MemberBalanceSummary[] = [];
    const balancesByMemberId: Record<string, MemberBalanceSummary> = {};

    let netSumCents = 0;

    for (const m of members) {
      const paidCents = paidMap.get(m.id) || 0;
      const shareCents = shareMap.get(m.id) || 0;
      const netCents = paidCents - shareCents;
      netSumCents += netCents;

      const summary: MemberBalanceSummary = {
        memberId: m.id,
        displayName: m.display_name,
        role: m.role || "member",
        paidCents,
        shareCents,
        netCents,
        paidAmount: fromCents(paidCents),
        shareAmount: fromCents(shareCents),
        netBalance: fromCents(netCents),
      };

      memberBalances.push(summary);
      balancesByMemberId[m.id] = summary;
    }

    // Sort member balances by netBalance descending (creditors first, then settled, then debtors)
    memberBalances.sort((a, b) => b.netCents - a.netCents || a.displayName.localeCompare(b.displayName));

    const isBalanced = netSumCents === 0;

    // Generate settlement plan for this currency
    const settlements = isBalanced ? computeSettlementTransactions(memberBalances, cur) : [];

    reportsByCurrency[cur] = {
      currency: cur,
      totalExpensesCents: totalCurrencyCents,
      totalExpensesAmount: fromCents(totalCurrencyCents),
      activeExpensesCount: validExpList.length,
      memberBalances,
      balancesByMemberId,
      settlements,
      isBalanced,
      netDiscrepancyCents: netSumCents,
    };
  }

  return {
    reportsByCurrency,
    currencies,
    unassignedExpenses,
    incompleteExpenses,
    validationErrors,
  };
}

