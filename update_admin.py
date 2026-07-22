import os
import re

file_path = "artifacts/evenum/src/pages/AdminDashboard.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Update API client imports
api_imports = """import { 
  customFetch, 
  getGetMeQueryKey,
  useGetAdminFinanceStats,
  useListAdminTransactions,
  useListAdminSettlements,
  useListOrgBalances,
  useListCommissionConfigs,
  getListAdminTransactionsQueryKey,
  getListAdminSettlementsQueryKey,
  getListOrgBalancesQueryKey,
  getListCommissionConfigsQueryKey,
  getGetAdminFinanceStatsQueryKey
} from '@workspace/api-client-react';"""
content = content.replace("import { customFetch, getGetMeQueryKey } from '@workspace/api-client-react';", api_imports)

# 2. Update lucide imports
lucide_imports = '  TrendingUp, Activity, AlertCircle, BarChart3, DollarSign, Receipt, Wallet, CircleDollarSign, CheckCircle2, ArrowRight, Settings, Plus\n} from \'lucide-react\';'
content = content.replace("  TrendingUp, Activity, AlertCircle, BarChart3\n} from 'lucide-react';", lucide_imports)

# 3. Add Recharts and Select/Dialog imports
import_insert = """import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
"""
content = content.replace("const API_BASE", import_insert + "const API_BASE")

# 4. Add Tab trigger
tab_trigger = """            <TabsTrigger value="users" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Users
              {users && <span className="ml-1 text-xs opacity-60">({users.length})</span>}
            </TabsTrigger>
            <TabsTrigger value="finance" className="gap-2">
              <DollarSign className="h-3.5 w-3.5" />
              Finance
            </TabsTrigger>"""
content = content.replace("""            <TabsTrigger value="users" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Users
              {users && <span className="ml-1 text-xs opacity-60">({users.length})</span>}
            </TabsTrigger>""", tab_trigger)

# 5. Add Tab content
tab_content = """          <TabsContent value="finance" className="mt-4">
            <FinanceAdminSection />
          </TabsContent>
        </Tabs>"""
content = content.replace("        </Tabs>", tab_content)

# 6. Append FinanceAdminSection component
finance_section = """
function FinanceAdminSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: isLoadingStats } = useGetAdminFinanceStats({ query: { queryKey: getGetAdminFinanceStatsQueryKey() } });
  
  const [pillarFilter, setPillarFilter] = useState<string>("all");
  const { data: transactionsData, isLoading: isLoadingTransactions } = useListAdminTransactions(
    { limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined },
    { query: { queryKey: getListAdminTransactionsQueryKey({ limit: 50, pillar: pillarFilter !== "all" ? pillarFilter as any : undefined }) } }
  );

  const [settlementFilter, setSettlementFilter] = useState<string>("all");
  const { data: settlements, isLoading: isLoadingSettlements } = useListAdminSettlements(
    { limit: 50, status: settlementFilter !== "all" ? settlementFilter as any : undefined },
    { query: { queryKey: getListAdminSettlementsQueryKey({ limit: 50, status: settlementFilter !== "all" ? settlementFilter as any : undefined }) } }
  );

  const { data: orgBalances, isLoading: isLoadingBalances } = useListOrgBalances({ query: { queryKey: getListOrgBalancesQueryKey() } });
  const { data: commissionConfigs, isLoading: isLoadingConfigs } = useListCommissionConfigs({ query: { queryKey: getListCommissionConfigsQueryKey() } });

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

  const updateSettlement = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      customFetch(`${API_BASE}/api/admin/finance/settlements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminSettlementsQueryKey() });
      toast({ title: 'Settlement status updated' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to update settlement' }),
  });

  const [createSettlementOrgId, setCreateSettlementOrgId] = useState<string>("");
  const [createSettlementOpen, setCreateSettlementOpen] = useState(false);
  
  const createSettlement = useMutation({
    mutationFn: (orgId: number) =>
      customFetch(`${API_BASE}/api/admin/finance/settlements`, {
        method: 'POST',
        body: JSON.stringify({ orgId }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListAdminSettlementsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListOrgBalancesQueryKey() });
      toast({ title: 'Settlement created' });
      setCreateSettlementOpen(false);
      setCreateSettlementOrgId("");
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to create settlement' }),
  });

  const [editingConfigPillar, setEditingConfigPillar] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<string>("");

  const updateConfig = useMutation({
    mutationFn: ({ pillar, rate }: { pillar: string; rate: number }) =>
      customFetch(`${API_BASE}/api/admin/finance/commission-config/${pillar}`, {
        method: 'PATCH',
        body: JSON.stringify({ rate }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getListCommissionConfigsQueryKey() });
      toast({ title: 'Commission configuration updated' });
      setEditingConfigPillar(null);
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e?.data?.error || 'Failed to update config' }),
  });

  const kpis = [
    { label: 'Platform Revenue', value: stats?.totalPlatformRevenue || 0, icon: CircleDollarSign, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Commission Collected', value: stats?.totalCommissionCollected || 0, icon: Receipt, accent: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Revenue Today', value: stats?.revenueToday || 0, icon: TrendingUp, accent: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Revenue This Week', value: stats?.revenueThisWeek || 0, icon: Activity, accent: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Total Transactions', value: stats?.totalTransactions || 0, icon: BarChart3, accent: 'text-primary', bg: 'bg-primary/5', isCount: true },
  ];

  return (
    <div className="space-y-8">
      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => (
          <Card key={idx} className="border-border/50 shadow-sm">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                {kpi.label} <kpi.icon className={`h-4 w-4 ${kpi.accent}`} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-serif font-bold tabular-nums">
                {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" /> : kpi.isCount ? kpi.value : formatCurrency(kpi.value as number)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by Pillar */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-serif">Revenue Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-6 pl-0">
              <div className="h-64 w-full px-4">
                {isLoadingStats ? (
                  <div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary/50" /></div>
                ) : !stats?.revenueByDay?.length ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No recent revenue data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.revenueByDay}>
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(val) => format(new Date(val), 'MMM d')} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#888' }} 
                        dy={10}
                      />
                      <YAxis 
                        tickFormatter={(val) => `$${val}`} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fill: '#888' }} 
                        width={60}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        formatter={(val: number) => [formatCurrency(val), 'Revenue']}
                        labelFormatter={(val) => format(new Date(val), 'MMM d, yyyy')}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['events', 'elections', 'campaigns'].map(pillar => {
              const mapping: Record<string, string> = { events: 'event', elections: 'election', campaigns: 'campaign' };
              const pData = stats?.byPillar?.find((p: any) => p.pillar === mapping[pillar]) || { revenue: 0, commission: 0, count: 0 };
              const icons = {
                events: <CalendarDays className="h-5 w-5 text-emerald-600" />,
                elections: <Vote className="h-5 w-5 text-blue-600" />,
                campaigns: <Megaphone className="h-5 w-5 text-amber-600" />
              };
              return (
                <Card key={pillar} className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                        {icons[pillar as keyof typeof icons]}
                      </div>
                      <CardTitle className="text-sm font-medium capitalize">{pillar}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Revenue:</span>
                        <span className="font-medium">{formatCurrency(pData.revenue)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Commission:</span>
                        <span className="font-medium text-primary">{formatCurrency(pData.commission)}</span>
                      </div>
                      <div className="flex justify-between text-xs pt-2 border-t text-muted-foreground">
                        <span>Transactions:</span>
                        <span>{pData.count}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Commission Configs & Pending Settlements Summary */}
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-sm bg-primary/5">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-serif flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" /> Pending Settlements
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-serif font-bold text-primary tabular-nums">
                  {formatCurrency(stats?.pendingSettlementsTotal || 0)}
                </span>
                <span className="text-sm text-muted-foreground">{stats?.pendingSettlementsCount || 0} organizations awaiting payout</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 pt-5 px-5">
              <CardTitle className="text-base font-serif flex items-center gap-2">
                <Settings className="h-4 w-4" /> Commission Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="pl-5">Pillar</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingConfigs ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground/50" /></TableCell></TableRow>
                  ) : commissionConfigs?.map((conf: any) => (
                    <TableRow key={conf.pillar}>
                      <TableCell className="pl-5 font-medium capitalize text-sm">{conf.pillar}</TableCell>
                      <TableCell>
                        {editingConfigPillar === conf.pillar ? (
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number" 
                              value={editRate} 
                              onChange={e => setEditRate(e.target.value)} 
                              className="w-16 h-7 text-xs" 
                              step="0.1"
                              min="0" max="100"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="font-mono">{(conf.rate * 100).toFixed(1)}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        {editingConfigPillar === conf.pillar ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingConfigPillar(null)}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" className="h-7 w-7 p-0" disabled={updateConfig.isPending} onClick={() => updateConfig.mutate({ pillar: conf.pillar, rate: parseFloat(editRate) / 100 })}>
                              {updateConfig.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-xs h-7 text-primary" onClick={() => { setEditingConfigPillar(conf.pillar); setEditRate((conf.rate * 100).toString()); }}>
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Settlements Table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-serif">Settlements</CardTitle>
              <CardDescription className="mt-0.5">Manage payouts to organizations</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={settlementFilter} onValueChange={setSettlementFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_settlement">Pending</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              
              <Dialog open={createSettlementOpen} onOpenChange={setCreateSettlementOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-9"><Plus className="mr-2 h-4 w-4" /> Create Settlement</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Settlement</DialogTitle>
                    <DialogDescription>Initiate a new payout for an organization with a pending balance.</DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Select value={createSettlementOrgId} onValueChange={setCreateSettlementOrgId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {orgBalances?.filter((ob: any) => ob.pendingBalance > 0).map((ob: any) => (
                          <SelectItem key={ob.orgId} value={ob.orgId.toString()}>
                            {ob.organizationName} - {formatCurrency(ob.pendingBalance)}
                          </SelectItem>
                        ))}
                        {orgBalances?.filter((ob: any) => ob.pendingBalance > 0).length === 0 && (
                          <div className="p-4 text-sm text-center text-muted-foreground">No orgs with pending balances</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateSettlementOpen(false)}>Cancel</Button>
                    <Button disabled={!createSettlementOrgId || createSettlement.isPending} onClick={() => createSettlement.mutate(parseInt(createSettlementOrgId, 10))}>
                      {createSettlement.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Create Settlement
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead className="w-16 text-center">ID</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingSettlements ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/50" /></TableCell></TableRow>
              ) : !settlements?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No settlements found</TableCell></TableRow>
              ) : settlements.map((s: any) => (
                <TableRow key={s.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">#{s.id}</TableCell>
                  <TableCell className="font-medium">{s.organizationName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(s.createdAt), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(s.amount, s.currency)}</TableCell>
                  <TableCell className="text-sm">{s.transactionCount}</TableCell>
                  <TableCell>{getSettlementBadge(s.status)}</TableCell>
                  <TableCell className="text-right">
                    {s.status === 'pending_settlement' && <Button size="sm" variant="outline" className="text-xs h-7" disabled={updateSettlement.isPending} onClick={() => updateSettlement.mutate({ id: s.id, status: 'ready' })}>Mark Ready</Button>}
                    {s.status === 'ready' && <Button size="sm" variant="default" className="text-xs h-7 bg-amber-500 hover:bg-amber-600 text-white" disabled={updateSettlement.isPending} onClick={() => updateSettlement.mutate({ id: s.id, status: 'released' })}>Release</Button>}
                    {s.status === 'released' && <Button size="sm" variant="default" className="text-xs h-7 bg-emerald-500 hover:bg-emerald-600 text-white" disabled={updateSettlement.isPending} onClick={() => updateSettlement.mutate({ id: s.id, status: 'completed' })}>Complete</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Organization Balances */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-serif">Organization Balances</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Net Earnings</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Released</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingBalances ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/50" /></TableCell></TableRow>
                ) : orgBalances?.slice(0, 15).map((ob: any) => (
                  <TableRow key={ob.orgId} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-sm">{ob.organizationName}</TableCell>
                    <TableCell className="text-right text-sm text-primary">{formatCurrency(ob.netEarnings)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{formatCurrency(ob.pendingBalance)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{formatCurrency(ob.releasedBalance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Global Transaction Log */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-serif">Recent Transactions</CardTitle>
            <Select value={pillarFilter} onValueChange={setPillarFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
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
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Org</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Comm.</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingTransactions ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary/50" /></TableCell></TableRow>
                ) : !transactionsData?.transactions?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No transactions</TableCell></TableRow>
                ) : transactionsData.transactions.slice(0, 15).map((tx: any) => (
                  <TableRow key={tx.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="font-medium text-sm truncate max-w-[120px]" title={tx.organizationName}>{tx.organizationName}</div>
                      <div className="text-[10px] text-muted-foreground">{format(new Date(tx.createdAt), 'MMM d, h:mm a')}</div>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{tx.pillar}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(tx.grossAmount, tx.currency)}</TableCell>
                    <TableCell className="text-right text-sm text-primary">{formatCurrency(tx.commissionAmount, tx.currency)}</TableCell>
                    <TableCell className="text-right">
                      {tx.status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-emerald-500 inline" /> : <Badge variant="outline" className="text-[10px] px-1 h-5">{tx.status}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
"""
content = content + finance_section

with open(file_path, "w") as f:
    f.write(content)
print("Updated AdminDashboard.tsx")
