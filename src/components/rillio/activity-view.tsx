"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";
import { formatMinor } from "@/lib/money";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

type Txn = {
  id: string;
  occurredAt: string;
  description: string;
  merchantName: string | null;
  amountMinor: string;
  currency: string;
  direction: "inflow" | "outflow";
  status: string;
  category: { id: string; name: string; kind: string } | null;
  sourceProvider: string;
};

type Category = { id: string; name: string; kind: string };

type MappingSuggestion = {
  status: "needs_mapping";
  headers: string[];
  suggestion: { date?: string; amount?: string; description?: string; merchant?: string; currency?: string; account?: string };
};

type ImportResult = {
  importJobId: string;
  status: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  duplicateRows: number;
  errors: { row: number; field: string; code: string; message: string }[];
};

export function ActivityView({ user }: { user: { id: string; baseCurrency: string } }) {
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState<Txn | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Import wizard state
  const [file, setFile] = useState<File | null>(null);
  const [needsMapping, setNeedsMapping] = useState<MappingSuggestion | null>(null);
  const [mapping, setMapping] = useState<{ date: string; amount: string; description: string; merchant?: string; currency?: string; account?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const [txns, cats] = await Promise.all([
        apiFetch<{ data: Txn[] }>("/api/transactions?limit=100"),
        apiFetch<{ categories: Category[] }>("/api/categories"),
      ]);
      setTransactions(txns.data);
      setCategories(cats.categories);
    } catch (e) {
      toast.error("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetWizard() {
    setFile(null);
    setNeedsMapping(null);
    setMapping(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFilePicked(f: File) {
    setFile(f);
    setNeedsMapping(null);
    setMapping(null);
    setImportResult(null);
    // Send file without mapping first to get header suggestion
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await apiFetch<MappingSuggestion | ImportResult>("/api/imports", {
        method: "POST",
        body: fd,
      });
      if ((res as MappingSuggestion).status === "needs_mapping") {
        const s = (res as MappingSuggestion).suggestion;
        setNeedsMapping(res as MappingSuggestion);
        setMapping({
          date: s.date ?? "",
          amount: s.amount ?? "",
          description: s.description ?? "",
          merchant: s.merchant,
          currency: s.currency,
          account: s.account,
        });
      } else {
        setImportResult(res as ImportResult);
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      toast.error(err.message);
    }
  }

  async function confirmMapping() {
    if (!file || !mapping) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      const res = await apiFetch<ImportResult>("/api/imports", {
        method: "POST",
        body: fd,
      });
      setImportResult(res);
      if (res.status === "ready" || res.status === "partial") {
        toast.success(`Imported ${res.acceptedRows} of ${res.totalRows} rows.`);
        load();
      } else {
        toast.error(`Import failed: ${res.rejectedRows} rows rejected.`);
      }
    } catch (e) {
      const err = e as Error & { code?: string };
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  async function changeCategory(txnId: string, categoryId: string) {
    try {
      await apiFetch(`/api/transactions/${txnId}/category`, {
        method: "PATCH",
        body: JSON.stringify({ categoryId, reason: "User correction" }),
      });
      toast.success("Category updated.");
      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === txnId
            ? { ...t, category: categories.find((c) => c.id === categoryId) ?? null }
            : t
        )
      );
      if (selectedTxn?.id === txnId) {
        setSelectedTxn({
          ...selectedTxn,
          category: categories.find((c) => c.id === categoryId) ?? null,
        });
      }
    } catch (e) {
      toast.error("Failed to update category.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Where it went</h1>
          <p className="text-sm text-slate-400 mt-1">
            Every transaction has a source. Every category can be corrected.
          </p>
        </div>
        <Button
          onClick={() => { resetWizard(); setImportOpen(true); }}
          className="bg-lime-400 text-ink-950 hover:bg-lime-400/90"
        >
          <Upload size={16} className="mr-1.5" /> Import CSV
        </Button>
      </div>

      <Card className="bg-ink-800 border-white/10">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-ink-700" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto text-slate-500" size={32} />
              <h3 className="mt-3 text-sm font-medium text-paper-100">Your money story starts here.</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Export a CSV from your bank or card statement and upload it. We parse, dedupe, and categorize deterministically.
              </p>
              <Button onClick={() => setImportOpen(true)} className="mt-4 bg-lime-400 text-ink-950 hover:bg-lime-400/90">
                <Upload size={16} className="mr-1.5" /> Import transactions
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  txn={t}
                  categories={categories}
                  onCategoryChange={(cid) => changeCategory(t.id, cid)}
                  onClick={() => setSelectedTxn(t)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import wizard sheet */}
      <Sheet open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) resetWizard(); }}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display">Import transactions</SheetTitle>
            <SheetDescription className="text-slate-300">
              Upload a CSV from your bank or card provider. We respect your privacy — data stays in your workspace.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            {!file && !importResult && (
              <div className="space-y-3">
                <Label>CSV file</Label>
                <div
                  className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-mint-400/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) onFilePicked(e.dataTransfer.files[0]);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="mx-auto text-slate-400 mb-2" size={24} />
                  <div className="text-sm font-medium">Drop your CSV here or click to browse</div>
                  <div className="text-xs text-slate-500 mt-1">Max 25 MB · .csv files only</div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && onFilePicked(e.target.files[0])}
                  />
                </div>
                <div className="text-xs text-slate-400 rounded-lg p-3 bg-ink-850 border border-white/5">
                  <strong className="text-slate-300">Expected columns:</strong> date, amount, description (or memo/payee).
                  Optional: merchant, currency, account. We&apos;ll suggest a mapping from your headers.
                </div>
              </div>
            )}

            {file && !needsMapping && !importResult && (
              <div className="text-center py-8">
                <div className="animate-pulse text-mint-400">Parsing {file.name}…</div>
              </div>
            )}

            {needsMapping && mapping && (
              <div className="space-y-3">
                <div className="text-sm text-slate-300">
                  Confirm column mapping for <strong className="text-paper-100">{file?.name}</strong>
                </div>
                <MappingSelect label="Date column" value={mapping.date} headers={needsMapping.headers} onChange={(v) => setMapping({ ...mapping, date: v })} />
                <MappingSelect label="Amount column" value={mapping.amount} headers={needsMapping.headers} onChange={(v) => setMapping({ ...mapping, amount: v })} />
                <MappingSelect label="Description column" value={mapping.description} headers={needsMapping.headers} onChange={(v) => setMapping({ ...mapping, description: v })} />
                <MappingSelect label="Merchant column (optional)" value={mapping.merchant ?? ""} headers={needsMapping.headers} onChange={(v) => setMapping({ ...mapping, merchant: v || undefined })} />
                <MappingSelect label="Currency column (optional)" value={mapping.currency ?? ""} headers={needsMapping.headers} onChange={(v) => setMapping({ ...mapping, currency: v || undefined })} />
                <MappingSelect label="Account column (optional)" value={mapping.account ?? ""} headers={needsMapping.headers} onChange={(v) => setMapping({ ...mapping, account: v || undefined })} />
                <Button
                  onClick={confirmMapping}
                  disabled={!mapping.date || !mapping.amount || !mapping.description || importing}
                  className="w-full bg-lime-400 text-ink-950 hover:bg-lime-400/90"
                >
                  {importing ? "Importing…" : "Confirm and import"}
                </Button>
              </div>
            )}

            {importResult && (
              <div className="space-y-4">
                <div className={`rounded-lg p-4 border ${importResult.rejectedRows > 0 ? "bg-warning-500/10 border-warning-500/30" : "bg-success-500/10 border-success-500/30"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {importResult.rejectedRows > 0 ? <AlertCircle className="text-warning-500" size={18} /> : <CheckCircle2 className="text-success-500" size={18} />}
                    <div className="font-medium text-paper-100">
                      {importResult.status === "ready" ? "Import complete" : "Import completed with review items"}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xl font-display num font-semibold text-paper-100">{importResult.acceptedRows}</div>
                      <div className="text-xs text-slate-400">Accepted</div>
                    </div>
                    <div>
                      <div className="text-xl font-display num font-semibold text-warning-500">{importResult.rejectedRows}</div>
                      <div className="text-xs text-slate-400">Rejected</div>
                    </div>
                    <div>
                      <div className="text-xl font-display num font-semibold text-slate-300">{importResult.duplicateRows}</div>
                      <div className="text-xs text-slate-400">Duplicates</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 text-center">of {importResult.totalRows} total rows</div>
                </div>

                {importResult.errors.length > 0 && (
                  <div>
                    <Label className="text-xs text-slate-400">Rejected rows report</Label>
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-ink-850">
                      {importResult.errors.slice(0, 50).map((e, i) => (
                        <div key={i} className="px-3 py-2 text-xs border-b border-white/5 last:border-0">
                          <div className="flex justify-between">
                            <span className="text-slate-300">Row {e.row}</span>
                            <Badge variant="outline" className="text-[10px] border-white/10 text-slate-400">{e.code}</Badge>
                          </div>
                          <div className="text-slate-500 mt-0.5">{e.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-white/10" onClick={resetWizard}>Import another</Button>
                  <Button className="flex-1 bg-lime-400 text-ink-950 hover:bg-lime-400/90" onClick={() => { setImportOpen(false); resetWizard(); load(); }}>Done</Button>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Transaction detail */}
      <Sheet open={!!selectedTxn} onOpenChange={(o) => !o && setSelectedTxn(null)}>
        <SheetContent className="bg-ink-900 border-white/10 text-paper-100 w-full sm:max-w-md">
          {selectedTxn && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display">{selectedTxn.description}</SheetTitle>
                <SheetDescription className="text-slate-300">
                  {selectedTxn.merchantName && <span>{selectedTxn.merchantName} · </span>}
                  {new Date(selectedTxn.occurredAt).toLocaleString()}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-lg p-4 bg-ink-800 border border-white/5">
                  <div className="text-xs text-slate-400">Amount</div>
                  <div className={`num font-display text-2xl font-semibold mt-1 ${selectedTxn.direction === "inflow" ? "text-mint-400" : "text-paper-100"}`}>
                    {formatMinor(BigInt(selectedTxn.amountMinor), selectedTxn.currency, { signed: true })}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {selectedTxn.direction} · {selectedTxn.status} · {selectedTxn.sourceProvider}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={selectedTxn.category?.id ?? ""}
                    onValueChange={(cid) => {
                      changeCategory(selectedTxn.id, cid);
                      setSelectedTxn({ ...selectedTxn, category: categories.find((c) => c.id === cid) ?? null });
                    }}
                  >
                    <SelectTrigger className="bg-ink-850 border-white/10">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-ink-850 border-white/10">
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-paper-100">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-lg p-3 bg-ink-850 border border-white/5 text-xs text-slate-400">
                  <div className="text-slate-300 font-medium mb-1">Source provenance</div>
                  <div>Provider: {selectedTxn.sourceProvider}</div>
                  <div className="mt-1">Imported and normalized with exact integer math. Raw evidence retained for audit.</div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TransactionRow({
  txn,
  categories,
  onCategoryChange,
  onClick,
}: {
  txn: Txn;
  categories: Category[];
  onCategoryChange: (cid: string) => void;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-ink-850/50 cursor-pointer transition-colors" onClick={onClick}>
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${txn.direction === "inflow" ? "bg-mint-400/15 text-mint-400" : "bg-ink-700 text-slate-400"}`}>
        {txn.direction === "inflow" ? "+" : "−"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-paper-100 truncate">{txn.description}</div>
        <div className="text-xs text-slate-500">
          {new Date(txn.occurredAt).toLocaleDateString()} · {txn.merchantName ?? "—"}
        </div>
      </div>
      <div className="hidden sm:block flex-shrink-0 w-32">
        <Select
          value={txn.category?.id ?? ""}
          onValueChange={(cid) => { onCategoryChange(cid); }}
        >
          <SelectTrigger
            className="bg-ink-850 border-white/10 h-8 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue placeholder="Uncategorized" />
          </SelectTrigger>
          <SelectContent className="bg-ink-850 border-white/10">
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-paper-100">{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={`num text-sm font-medium flex-shrink-0 w-20 text-right ${txn.direction === "inflow" ? "text-mint-400" : "text-paper-100"}`}>
        {formatMinor(BigInt(txn.amountMinor), txn.currency, { signed: true })}
      </div>
    </div>
  );
}

function MappingSelect({ label, value, headers, onChange }: { label: string; value: string; headers: string[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-400">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-ink-850 border-white/10">
          <SelectValue placeholder="Select column" />
        </SelectTrigger>
        <SelectContent className="bg-ink-850 border-white/10">
          {headers.map((h) => (
            <SelectItem key={h} value={h} className="text-paper-100">{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
