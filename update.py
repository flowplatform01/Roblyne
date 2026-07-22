import os
import re

file_path = "artifacts/evenum/src/pages/OrganizationWorkspace.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Update API client imports
api_imports = """  getGetPublicOrganizationQueryKey,
  useGetOrgFinanceSummary,
  useListOrgTransactions,
  useListOrgSettlements,
  getGetOrgFinanceSummaryQueryKey,
  getListOrgTransactionsQueryKey,
  getListOrgSettlementsQueryKey,
} from "@workspace/api-client-react";"""
content = content.replace('  getGetPublicOrganizationQueryKey,\n} from "@workspace/api-client-react";', api_imports)

# 2. Update lucide-react imports
lucide_imports = 'import { Loader2, Plus, Users, Vote, CalendarDays, Megaphone, ArrowRight, ExternalLink, Trash2, Shield, UserCheck, Settings, Save, Globe, Wallet, DollarSign, Receipt, ArrowUpRight, CheckCircle2, TrendingUp } from "lucide-react";'
content = re.sub(r'import \{ Loader2, .*? \} from "lucide-react";', lucide_imports, content)

# 3. Add Table import
content = content.replace('import { Badge } from "@/components/ui/badge";', 'import { Badge } from "@/components/ui/badge";\nimport { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";')

# 4. Update valid tabs array
content = content.replace("['overview', 'elections', 'events', 'campaigns', 'team', 'settings']", "['overview', 'elections', 'events', 'campaigns', 'team', 'finance', 'settings']")

# 5. Add Tab trigger
tab_trigger = """          <TabsTrigger value="team" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">Team</TabsTrigger>
          <TabsTrigger value="finance" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">
            <Wallet className="h-3.5 w-3.5 mr-1.5" />Finance
          </TabsTrigger>"""
content = content.replace('<TabsTrigger value="team" className="px-4 md:px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1 md:flex-none">Team</TabsTrigger>', tab_trigger)

# 6. Add Tab content
tab_content = """        <TabsContent value="team" className="mt-0 focus-visible:outline-none">
          <TeamSection orgId={orgId} />
        </TabsContent>

        <TabsContent value="finance" className="mt-0 focus-visible:outline-none">
          <FinanceSection orgId={orgId} />
        </TabsContent>"""
content = content.replace('        <TabsContent value="team" className="mt-0 focus-visible:outline-none">\n          <TeamSection orgId={orgId} />\n        </TabsContent>', tab_content)

# 7. Add FinanceSection component
finance_section = """
function FinanceSection({ orgId }: { orgId: number }) {
  const { data: summary, isLoading: isLoadingSummary } = useGetOrgFinanceSummary(orgId, { query: { enabled: !!orgId, queryKey: getGetOrgFinanceSummaryQueryKey(orgId) } });
  
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const { data: transactionsData, isLoading: isLoadingTransactions } = useListOrgTransactions(
    orgId,
    { limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined },
    { query: { enabled: !!orgId, queryKey: getListOrgTransactionsQueryKey(orgId, { limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined }) } }
  );
  
  const { data: settlements, isLoading: isLoadingSettlements } = useListOrgSettlements(orgId, { query: { enabled: !!orgId, queryKey: getListOrgSettlementsQueryKey(orgId) } });

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const getSettlementBadge = (status: string) => {
    switch(status) {
      case 'pending_settlement': return <Badge variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100">Pending</Badge>;
      case 'ready': return <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">Ready</Badge>;
      case 'released': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Released</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTxStatusBadge = (status: string) => {
    switch(status) {
      case 'completed': return <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Completed</Badge>;
      case 'refunded': return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Refunded</Badge>;
      case 'disputed': return <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">Disputed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExport = () => {
    const API_BASE = import.meta.env.BASE_URL.replace(/\\/$/, '');
    window.open(`${API_BASE}/api/organizations/${orgId}/finance/export`);
  };

  if (isLoadingSummary) {
    return (
      <div className="flex items-center justify-center h-48 border rounded-xl bg-card">
        <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold">Financial Operations</h2>
            <p className="text-sm text-muted-foreground">Manage revenue, platform commissions, and settlements</p>
          </div>
        </div>
        <Button onClick={handleExport} variant="outline">
          <ArrowUpRight className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Gross Revenue <DollarSign className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-serif font-bold">{formatCurrency(summary?.totalRevenue || 0)}</div>
          </CardContent>
        </Card>
        
        <Card className="border-border/50 shadow-sm bg-muted/20">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Platform Commission <Receipt className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-serif font-bold text-muted-foreground">{formatCurrency(summary?.totalCommissionPaid || 0)}</div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 shadow-sm bg-primary/5">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-primary flex items-center justify-between">
              Net Earnings <TrendingUp className="h-3.5 w-3.5" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-serif font-bold text-primary">{formatCurrency(summary?.totalOrgEarnings || 0)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Pending Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-serif font-bold">{formatCurrency(summary?.pendingBalance || 0)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
              Released Balance <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-serif font-bold">{formatCurrency(summary?.releasedBalance || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-serif">Revenue by Pillar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['event', 'election', 'campaign'].map(pillar => {
              const pData = summary?.byPillar?.find((p: any) => p.pillar === pillar) || { revenue: 0, earnings: 0, count: 0 };
              const icons = {
                event: <CalendarDays className="h-5 w-5 text-emerald-600" />,
                election: <Vote className="h-5 w-5 text-blue-600" />,
                campaign: <Megaphone className="h-5 w-5 text-amber-600" />
              };
              
              return (
                <div key={pillar} className="p-4 border rounded-xl bg-card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                      {icons[pillar as keyof typeof icons]}
                    </div>
                    <h3 className="font-medium capitalize">{pillar}s</h3>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Revenue:</span>
                      <span className="font-medium">{formatCurrency(pData.revenue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Earnings:</span>
                      <span className="font-medium text-primary">{formatCurrency(pData.earnings)}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-2 pt-2 border-t text-muted-foreground">
                      <span>Transactions:</span>
                      <span>{pData.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-serif">Transaction History</CardTitle>
                <CardDescription>All financial activity for your organization</CardDescription>
              </div>
              <Select value={pillarFilter} onValueChange={setPillarFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All Pillars" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pillars</SelectItem>
                  <SelectItem value="event">Events</SelectItem>
                  <SelectItem value="election">Elections</SelectItem>
                  <SelectItem value="campaign">Campaigns</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingTransactions ? (
                <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
              ) : !transactionsData?.transactions?.length ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Date</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsData.transactions.map((tx: any) => (
                      <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="text-xs">
                          {format(new Date(tx.createdAt), 'MMM d, h:mm a')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{tx.entityTitle}</div>
                          <div className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                            {tx.pillar} • {tx.transactionType.replace('_', ' ')}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{formatCurrency(tx.grossAmount, tx.currency)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">-{formatCurrency(tx.commissionAmount, tx.currency)}</TableCell>
                        <TableCell className="font-medium text-primary text-sm">{formatCurrency(tx.orgEarnings, tx.currency)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            {getTxStatusBadge(tx.status)}
                            {tx.status === 'completed' && <span className="text-[10px] text-muted-foreground capitalize">{tx.settlementStatus.replace('_', ' ')}</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-serif">Settlement History</CardTitle>
              <CardDescription>Payouts to your bank account</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingSettlements ? (
                <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary/50" /></div>
              ) : !settlements?.length ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No settlements yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((s: any) => (
                      <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="text-xs">
                          {format(new Date(s.createdAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {formatCurrency(s.amount, s.currency)}
                          <div className="text-[10px] text-muted-foreground font-normal">{s.transactionCount} txns</div>
                        </TableCell>
                        <TableCell>
                          {getSettlementBadge(s.status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
"""
content = content + finance_section

with open(file_path, "w") as f:
    f.write(content)
print("Updated OrganizationWorkspace.tsx")
