"use client";

import { useMemo, useState } from "react";
import {
  Scale,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Coins,
  ShieldCheck,
  User,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TripMember, Expense } from "./types";
import {
  computeGroupBalances,
  GroupBalancesResult,
  CurrencyBalanceReport,
} from "@/lib/budget/splitEngine";
import { formatCurrencyAmount, getCurrencySymbol } from "@/lib/utils";

interface GroupSplitBalancesCardProps {
  members: TripMember[];
  expenses: Expense[];
  primaryCurrency?: string;
}

export function GroupSplitBalancesCard({
  members,
  expenses,
  primaryCurrency = "USD",
}: GroupSplitBalancesCardProps) {
  // Compute group balances via pure calculation engine
  const balancesResult: GroupBalancesResult = useMemo(() => {
    // Transform enriched expenses splits into engine format
    const allSplits = expenses.flatMap((exp) =>
      (exp.splits || []).map((s) => ({
        id: s.id,
        expense_id: exp.id,
        member_id: s.member_id,
        amount: s.amount,
      }))
    );

    return computeGroupBalances({
      members: members.map((m) => ({
        id: m.id,
        display_name: m.display_name,
        role: m.role,
        email: m.email,
        user_id: m.user_id,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        trip_id: e.trip_id,
        title: e.title,
        amount: e.amount,
        currency: (e.currency || primaryCurrency).trim().toUpperCase(),
        paid_by_member_id: e.paid_by_member_id,
        split_type: e.split_type || "equal",
      })),
      splits: allSplits,
    });
  }, [members, expenses, primaryCurrency]);

  const availableCurrencies = balancesResult.currencies;

  // Active currency tab
  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    const primary = primaryCurrency.trim().toUpperCase();
    if (availableCurrencies.includes(primary)) return primary;
    return availableCurrencies[0] || primary;
  });

  // Ensure selected currency stays valid if currencies change
  const activeCurrency = availableCurrencies.includes(selectedCurrency)
    ? selectedCurrency
    : availableCurrencies[0] || primaryCurrency.trim().toUpperCase();

  const activeReport: CurrencyBalanceReport | undefined =
    balancesResult.reportsByCurrency[activeCurrency];

  const hasGroupExpenses =
    activeReport && activeReport.activeExpensesCount > 0;

  function formatMoney(amount: number, cur: string = activeCurrency) {
    return formatCurrencyAmount(amount, cur);
  }

  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 py-3.5 px-5 gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-emerald-600" />
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold text-slate-900">
                Group Balances & Settlements
              </CardTitle>
              {availableCurrencies.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold border-emerald-200 bg-emerald-50 text-emerald-700"
                >
                  {availableCurrencies.length}{" "}
                  {availableCurrencies.length === 1
                    ? "Currency"
                    : "Currencies"}
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs text-slate-500">
              Fair cost distribution and simplified debt settlements.
            </CardDescription>
          </div>
        </div>

        {/* Currency Tabs */}
        {availableCurrencies.length > 1 && (
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
            {availableCurrencies.map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setSelectedCurrency(cur)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                  activeCurrency === cur
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {!hasGroupExpenses ? (
          <div className="py-8 text-center text-xs text-slate-400 space-y-2">
            <Coins className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="italic max-w-sm mx-auto">
              No shared group expenses recorded in {activeCurrency} yet. When adding an expense, select who paid and choose equal or custom split mode.
            </p>
          </div>
        ) : (
          <>
            {/* Member Balances Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">
                  Member Balances ({activeCurrency})
                </span>
                <span className="text-[11px] text-slate-400">
                  Total Shared: {formatMoney(activeReport.totalExpensesAmount)}
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-100 text-[11px] text-slate-500 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Member</th>
                      <th className="py-2.5 px-3 text-right">Total Paid</th>
                      <th className="py-2.5 px-3 text-right">Fair Share</th>
                      <th className="py-2.5 px-3 text-right">Net Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {activeReport.memberBalances.map((m) => {
                      const getsBack = m.netBalance > 0.005;
                      const owes = m.netBalance < -0.005;
                      const isSettled = !getsBack && !owes;

                      return (
                        <tr
                          key={m.memberId}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">
                              {m.displayName}
                              {m.role === "owner" && (
                                <span className="ml-1.5 text-[10px] text-blue-600 font-normal">
                                  (Organizer)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700 font-medium">
                            {formatMoney(m.paidAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700">
                            {formatMoney(m.shareAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {getsBack ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px] font-bold gap-1"
                              >
                                <TrendingUp className="h-3 w-3" />
                                Gets back {formatMoney(m.netBalance)}
                              </Badge>
                            ) : owes ? (
                              <Badge
                                variant="outline"
                                className="border-rose-300 bg-rose-50 text-rose-700 text-[10px] font-bold gap-1"
                              >
                                <TrendingDown className="h-3 w-3" />
                                Owes {formatMoney(Math.abs(m.netBalance))}
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]"
                              >
                                Settled
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Suggested Settlements Section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Suggested Settlement Plan
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {activeReport.settlements.length === 1
                    ? "1 Transaction"
                    : `${activeReport.settlements.length} Transactions`}
                </span>
              </div>

              {activeReport.settlements.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-500 italic">
                  All member balances in {activeCurrency} are completely balanced! No payments needed.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeReport.settlements.map((tx, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-white text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="font-bold text-slate-900 truncate">
                          {tx.fromDisplayName}
                        </span>
                        <ArrowRight className="h-3 w-3 text-emerald-600 shrink-0" />
                        <span className="font-bold text-slate-900 truncate">
                          {tx.toDisplayName}
                        </span>
                      </div>

                      <div className="shrink-0 text-right">
                        <span className="font-extrabold text-emerald-700 text-xs">
                          {formatMoney(tx.amount, tx.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reference-Only Disclaimer Badge */}
              <div className="flex items-start gap-1.5 text-[10px] text-slate-500 pt-1">
                <Info className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                <p className="leading-tight">
                  Suggested settlements minimize the number of transfers needed between members. For reference only — payments should be settled directly outside the app (cash, UPI, bank transfer, etc.).
                </p>
              </div>
            </div>

            {/* Unassigned / Solo Expenses Footnote */}
            {balancesResult.unassignedExpenses.length > 0 && (
              <div className="text-[11px] text-slate-400 italic flex items-center gap-1.5 pt-1">
                <Coins className="h-3 w-3 text-slate-400 shrink-0" />
                <span>
                  {balancesResult.unassignedExpenses.length} solo / personal expense(s) have no assigned payer and are not included in group balances.
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

