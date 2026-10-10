import "./_group.css";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Coins,
  Megaphone,
  Receipt,
  Settings,
  TrendingUp,
  Vote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const currency = (amount: number, code = "XAF") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 0 }).format(amount);

const kpis = [
  { label: "Platform Revenue", value: "XAF 12.48M", icon: Coins, color: "text-emerald-600", tint: "bg-emerald-50" },
  { label: "Commission Collected", value: "XAF 1.86M", icon: Receipt, color: "text-primary", tint: "bg-primary/10" },
  { label: "Revenue Today", value: "XAF 184K", icon: TrendingUp, color: "text-violet-600", tint: "bg-violet-50" },
  { label: "Revenue This Week", value: "XAF 1.24M", icon: Activity, color: "text-amber-600", tint: "bg-amber-50" },
  { label: "Revenue This Month", value: "XAF 4.61M", icon: BarChart3, color: "text-rose-600", tint: "bg-rose-50" },
  { label: "Total Transactions", value: "2,846", icon: BarChart3, color: "text-primary", tint: "bg-primary/5" },
];

const revenue = [
  { date: "Sep 12", amount: 260 }, { date: "Sep 13", amount: 410 }, { date: "Sep 14", amount: 330 },
  { date: "Sep 15", amount: 540 }, { date: "Sep 16", amount: 390 }, { date: "Sep 17", amount: 620 },
  { date: "Sep 18", amount: 470 }, { date: "Sep 19", amount: 710 }, { date: "Sep 20", amount: 580 },
  { date: "Sep 21", amount: 790 }, { date: "Sep 22", amount: 640 }, { date: "Sep 23", amount: 910 },
];

const pillars = [
  { name: "Events", revenue: 5_420_000, commission: 812_000, count: 1_320, icon: CalendarDays, color: "text-emerald-600" },
  { name: "Elections", revenue: 3_860_000, commission: 386_000, count: 486, icon: Vote, color: "text-primary" },
  { name: "Campaigns", revenue: 3_200_000, commission: 640_000, count: 1_040, icon: Megaphone, color: "text-amber-600" },
];

const settlements = [
  { id: 284, organization: "Westbridge Alumni Network", date: "Sep 22, 2026", amount: "XAF 842,000", count: 28, status: "Ready" },
  { id: 283, organization: "Central District Council", date: "Sep 21, 2026", amount: "XAF 620,500", count: 16, status: "Pending" },
  { id: 282, organization: "Lagos Creative Forum", date: "Sep 20, 2026", amount: "NGN 1,450,000", count: 42, status: "Released" },
  { id: 281, organization: "National Students Union", date: "Sep 19, 2026", amount: "XAF 418,000", count: 12, status: "Completed" },
];

const balances = [
  { org: "Westbridge Alumni Network", earned: "XAF 2,840,000", available: "XAF 842,000", awaiting: "XAF 210,000", released: "XAF 1,788,000" },
  { org: "Central District Council", earned: "XAF 2,120,500", available: "XAF 620,500", awaiting: "XAF 0", released: "XAF 1,500,000" },
  { org: "Lagos Creative Forum", earned: "NGN 6,450,000", available: "NGN 1,450,000", awaiting: "NGN 680,000", released: "NGN 4,320,000" },
  { org: "National Students Union", earned: "XAF 1,418,000", available: "XAF 0", awaiting: "XAF 418,000", released: "XAF 1,000,000" },
];

const transactions = [
  { org: "Westbridge Alumni Network", type: "Event", gross: "XAF 320,000", commission: "XAF 48,000", status: "Completed" },
  { org: "Lagos Creative Forum", type: "Campaign", gross: "NGN 820,000", commission: "NGN 164,000", status: "Completed" },
  { org: "Central District Council", type: "Election", gross: "XAF 180,000", commission: "XAF 18,000", status: "Completed" },
  { org: "National Students Union", type: "Event", gross: "XAF 96,000", commission: "XAF 14,400", status: "Pending" },
];

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: "bg-slate-100 text-slate-700",
    Ready: "bg-primary/10 text-primary",
    Released: "bg-amber-100 text-amber-800",
    Completed: "bg-emerald-100 text-emerald-800",
  };
  return <Badge variant="secondary" className={styles[status] ?? ""}>{status}</Badge>;
}

export function CurrentFinance() {
  return (
    <main className="finance-mock min-h-screen space-y-8 bg-background p-7 text-foreground">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowRight className="h-3.5 w-3.5" /> Export All Transactions
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, color, tint }) => (
          <Card key={label} className="border-border/60 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                {label}<span className={`rounded-md p-1.5 ${tint}`}><Icon className={`h-4 w-4 ${color}`} /></span>
              </CardTitle>
            </CardHeader>
            <CardContent><div className="font-serif text-lg font-bold tabular-nums">{value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="font-serif text-base">Revenue Trend (30 Days)</CardTitle></CardHeader>
            <CardContent className="h-[270px] pb-6 pl-0 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} />
                  <YAxis tickFormatter={(value) => `${value}k`} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#777" }} width={42} />
                  <Tooltip formatter={(value) => [`${value}k XAF`, "Revenue"]} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {pillars.map(({ name, revenue: total, commission, count, icon: Icon, color }) => (
              <Card key={name} className="border-border/60 shadow-sm">
                <CardHeader className="px-4 pb-2 pt-4">
                  <div className="flex items-center gap-3"><span className="rounded bg-muted p-2"><Icon className={`h-4 w-4 ${color}`} /></span><CardTitle className="text-sm font-medium">{name}</CardTitle></div>
                </CardHeader>
                <CardContent className="space-y-2 px-4 pb-4 pt-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Revenue</span><span>{currency(total)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Commission</span><span className="text-primary">{currency(commission)}</span></div>
                  <div className="flex justify-between border-t pt-2 text-xs text-muted-foreground"><span>Transactions</span><span>{count}</span></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <aside className="space-y-6">
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="px-5 pb-3 pt-5"><CardTitle className="flex items-center gap-2 font-serif text-base"><AlertCircle className="h-4 w-4 text-primary" /> Pending Settlements</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="font-serif text-3xl font-bold tabular-nums text-primary">{currency(2_184_500)}</div>
              <p className="mt-1 text-sm text-muted-foreground">8 batches awaiting payout</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="px-5 pb-3 pt-5"><CardTitle className="flex items-center gap-2 font-serif text-base"><Settings className="h-4 w-4" /> Commission Rates</CardTitle></CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader><TableRow><TableHead className="pl-5">Pillar</TableHead><TableHead>Rate</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {[["Events", "15.0%"], ["Elections", "10.0%"], ["Campaigns", "20.0%"]].map(([name, rate]) => (
                    <TableRow key={name}><TableCell className="pl-5 font-medium">{name}</TableCell><TableCell><Badge variant="secondary" className="font-mono">{rate}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="h-7 text-xs text-primary">Edit</Button></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50 pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="font-serif text-base">Settlements</CardTitle><p className="mt-1 text-sm text-muted-foreground">Manage payouts to organizations</p></div>
            <div className="flex items-center gap-3"><select aria-label="Filter settlements" className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option>All Status</option><option>Pending</option><option>Ready</option></select><Button size="sm" className="h-9">+ Create Settlement</Button></div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead className="text-center">ID</TableHead><TableHead>Organization</TableHead><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Transactions</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>{settlements.map((row) => <TableRow key={row.id}>
              <TableCell className="text-center font-mono text-xs text-muted-foreground">#{row.id}</TableCell><TableCell className="font-medium">{row.organization}</TableCell><TableCell className="text-xs text-muted-foreground">{row.date}</TableCell><TableCell className="font-medium">{row.amount}</TableCell><TableCell>{row.count}</TableCell><TableCell><StatusBadge status={row.status} /></TableCell><TableCell className="text-right"><Button size="sm" variant="outline" className="h-7 text-xs">{row.status === "Pending" ? "Mark Ready" : row.status === "Ready" ? "Release" : "View"}</Button></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="border-b border-border/50 pb-3"><CardTitle className="font-serif text-base">Organization Balances</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow><TableHead>Organization</TableHead><TableHead className="text-right">Net Earnings</TableHead><TableHead className="text-right">Available</TableHead><TableHead className="text-right">Awaiting Payout</TableHead><TableHead className="text-right">Released</TableHead></TableRow></TableHeader>
              <TableBody>{balances.map((row) => <TableRow key={row.org}><TableCell className="font-medium">{row.org}</TableCell><TableCell className="text-right text-primary">{row.earned}</TableCell><TableCell className="text-right font-medium">{row.available}</TableCell><TableCell className="text-right">{row.awaiting}</TableCell><TableCell className="text-right text-muted-foreground">{row.released}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-3"><CardTitle className="font-serif text-base">Recent Transactions</CardTitle><select aria-label="Filter transactions" className="h-8 rounded-md border border-input bg-background px-2 text-xs"><option>All Pillars</option><option>Events</option><option>Elections</option></select></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table><TableHeader><TableRow><TableHead>Organization</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Commission</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
              <TableBody>{transactions.map((row) => <TableRow key={`${row.org}-${row.type}`}><TableCell className="max-w-[180px]"><div className="truncate font-medium">{row.org}</div><div className="text-[10px] text-muted-foreground">Sep 23, 2026</div></TableCell><TableCell className="capitalize">{row.type}</TableCell><TableCell className="text-right">{row.gross}</TableCell><TableCell className="text-right text-primary">{row.commission}</TableCell><TableCell className="text-right">{row.status === "Completed" ? <CheckCircle2 className="inline h-4 w-4 text-emerald-500" /> : <StatusBadge status={row.status} />}</TableCell></TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
