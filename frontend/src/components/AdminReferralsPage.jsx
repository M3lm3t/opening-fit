import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../context/AuthDataProvider";
import {
  createReferralPartner,
  downloadReferralCsv,
  loadReferralAdminReport,
} from "../lib/referralAdminApi";
import {
  EmptyState,
  FormField,
  LoadingState,
  PageContainer,
  PageHeader,
  PageState,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  StatusBadge,
  Surface,
} from "./ui/UiPrimitives";
import "./AdminReferralsPage.css";

const EMPTY_FORM = { name: "", code: "", email: "", commissionType: "fixed", commissionValue: "2.00", isActive: true };
const money = (value, currency = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: String(currency || "GBP").toUpperCase() }).format(Number(value || 0));
const dateText = (value) => value ? new Date(value).toLocaleDateString("en-GB") : "—";

export default function AdminReferralsPage() {
  const { user, authLoading, hydrated } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ start: "", end: "", partner: "", status: "" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [selectedCode, setSelectedCode] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try { setReport(await loadReferralAdminReport(filters)); }
    catch (loadError) { setError(loadError.message || "Referral data could not be loaded."); }
    finally { setLoading(false); }
  }, [filters, user?.id]);

  useEffect(() => { if (hydrated && user?.id) void load(); else if (hydrated) setLoading(false); }, [hydrated, load, user?.id]);

  const selectedPartner = report?.partners?.find((partner) => partner.code === selectedCode) || null;
  const selectedReferrals = useMemo(
    () => (report?.referrals || []).filter((row) => row.referralCode === selectedCode),
    [report?.referrals, selectedCode]
  );
  const selectedVisits = useMemo(
    () => (report?.visitsOverTime || []).filter((point) => point.partnerId === selectedPartner?.id),
    [report?.visitsOverTime, selectedPartner?.id]
  );

  async function submitPartner(event) {
    event.preventDefault();
    setCreating(true); setFormStatus("");
    try {
      await createReferralPartner({ ...form, commissionValue: Number(form.commissionValue) });
      setForm(EMPTY_FORM); setFormStatus("Partner created."); await load();
    } catch (createError) { setFormStatus(createError.message || "Partner could not be created."); }
    finally { setCreating(false); }
  }

  async function copyLink(code) {
    const link = `https://openingfit.com/?ref=${code}`;
    try { await navigator.clipboard.writeText(link); setCopyStatus(`Copied ${code} link.`); }
    catch { setCopyStatus(`Copy this link: ${link}`); }
  }

  if (authLoading || !hydrated) return <PageContainer><LoadingState title="Checking admin access">Verifying your OpeningFit session.</LoadingState></PageContainer>;
  if (!user) return <PageContainer><PageState kind="signed-out" title="Admin sign-in required">Sign in through the normal account page, then return to this URL.</PageState></PageContainer>;
  if (loading && !report) return <PageContainer className="referralAdmin"><LoadingState title="Loading referral performance">Preparing visits, registrations and confirmed sales.</LoadingState><div className="referralAdminSummary" aria-hidden="true">{Array.from({ length: 7 }, (_, index) => <Surface key={index} className="referralAdminMetric"><Skeleton height="12px" width="65%" /><Skeleton height="26px" width="45%" /></Surface>)}</div></PageContainer>;
  if (error && !report) return <PageContainer><PageState kind="error" title="Referral admin unavailable" action={<PrimaryButton onClick={load}>Retry</PrimaryButton>}>{error}</PageState></PageContainer>;

  const summary = report?.summary || {};
  const cards = [
    ["Visits", summary.totalVisits], ["Registrations", summary.registrations], ["Confirmed sales", summary.confirmedSales],
    ["Conversion", `${summary.conversionRate || 0}%`], ["Gross revenue", money(summary.grossRevenue)],
    ["Commission owed", money(summary.outstandingCommission)], ["Refunded", summary.refundedReferrals],
  ];

  return <PageContainer className="referralAdmin" size="wide">
    <PageHeader eyebrow="Owner tools" title="Referral partners" description="Private referral performance, attribution and commission records."
      actions={<SecondaryButton onClick={() => downloadReferralCsv(filters).catch((e) => setError(e.message))}>Export CSV</SecondaryButton>} />

    {error ? <div className="referralAdminNotice" role="alert">{error} <button type="button" onClick={load}>Retry</button></div> : null}
    {copyStatus ? <div className="referralAdminNotice" role="status">{copyStatus}</div> : null}

    <div className="referralAdminSummary" aria-label="Referral summary">
      {cards.map(([label, value]) => <Surface key={label} className="referralAdminMetric"><span>{label}</span><strong>{value ?? 0}</strong></Surface>)}
    </div>

    <Surface className="referralAdminFilters">
      <FormField label="From"><input type="date" value={filters.start} onChange={(e) => setFilters((v) => ({ ...v, start: e.target.value }))} /></FormField>
      <FormField label="To"><input type="date" value={filters.end} onChange={(e) => setFilters((v) => ({ ...v, end: e.target.value }))} /></FormField>
      <FormField label="Partner"><select value={filters.partner} onChange={(e) => setFilters((v) => ({ ...v, partner: e.target.value }))}><option value="">All partners</option>{report?.partners?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
      <FormField label="Status"><select value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))}><option value="">All statuses</option><option>registered</option><option>converted</option><option>refunded</option><option>cancelled</option></select></FormField>
    </Surface>

    <div className="referralAdminLayout">
      <Surface className="referralAdminPartners">
        <h2>Partners</h2>
        {!report?.partners?.length ? <EmptyState title="No referral partners yet">Create the first partner using the compact form.</EmptyState> :
          <div className="referralAdminTableWrap"><table><thead><tr><th>Partner</th><th>Status</th><th>Visits</th><th>Registrations</th><th>Sales</th><th>Conversion</th><th>Gross</th><th>Commission</th><th>Link</th></tr></thead><tbody>
            {report.partners.map((p) => <tr key={p.id}><td><button className="referralPartnerLink" type="button" onClick={() => setSelectedCode(p.code)}><strong>{p.name}</strong><small>{p.code}</small></button></td><td><StatusBadge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</StatusBadge></td><td>{p.visits}</td><td>{p.registrations}</td><td>{p.confirmedSales}</td><td>{p.conversionRate}%</td><td>{money(p.grossRevenue)}</td><td>{money(p.commissionOwed)}</td><td><SecondaryButton size="small" onClick={() => copyLink(p.code)}>Copy link</SecondaryButton></td></tr>)}
          </tbody></table></div>}
      </Surface>

      <Surface className="referralAdminCreate"><h2>Create partner</h2><form onSubmit={submitPartner}>
        <FormField label="Name" required><input required maxLength={120} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} /></FormField>
        <FormField label="Code" helpText="Lowercase letters, numbers, hyphens and underscores." required><input required maxLength={50} pattern="[a-z0-9_-]+" value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value.toLowerCase().trim() }))} /></FormField>
        <FormField label="Email"><input type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} /></FormField>
        <div className="referralAdminFormRow"><FormField label="Commission"><select value={form.commissionType} onChange={(e) => setForm((v) => ({ ...v, commissionType: e.target.value }))}><option value="fixed">Fixed</option><option value="percentage">Percentage</option></select></FormField><FormField label="Value"><input type="number" min="0" max={form.commissionType === "percentage" ? 100 : undefined} step="0.01" value={form.commissionValue} onChange={(e) => setForm((v) => ({ ...v, commissionValue: e.target.value }))} /></FormField></div>
        <label className="referralAdminCheck"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((v) => ({ ...v, isActive: e.target.checked }))} /> Active</label>
        <PrimaryButton type="submit" disabled={creating}>{creating ? "Creating…" : "Create partner"}</PrimaryButton>
        {formStatus ? <p role="status">{formStatus}</p> : null}
      </form></Surface>
    </div>

    {selectedPartner ? <div className="referralAdminDrawer" role="dialog" aria-modal="true" aria-labelledby="referral-detail-title"><div className="referralAdminDrawerPanel"><header><div><span>Partner detail</span><h2 id="referral-detail-title">{selectedPartner.name}</h2></div><button type="button" onClick={() => setSelectedCode("")} aria-label="Close partner detail"><X size={20} aria-hidden="true" /></button></header><p className="referralAdminUrl">https://openingfit.com/?ref={selectedPartner.code}</p><h3>Referred accounts</h3>{!selectedReferrals.length ? <EmptyState title="No registrations in this view">Adjust the date or status filters to inspect more history.</EmptyState> : <div className="referralAdminDetailList">{selectedReferrals.map((row, index) => <article key={`${row.registeredAt}-${index}`}><div><strong>{row.referredEmail || "Account email unavailable"}</strong><StatusBadge tone={row.status === "converted" ? "success" : row.status === "refunded" ? "error" : "info"}>{row.status}</StatusBadge></div><small>Registered {dateText(row.registeredAt)} · Purchase {money(row.grossAmount, row.currency)} · Commission {money(row.commissionAmount, row.currency)}</small>{row.refundedAt ? <small>Refunded {dateText(row.refundedAt)}</small> : null}</article>)}</div>}<h3>Visits over time</h3>{!selectedVisits.length ? <p className="referralAdminUrl">No visits in this date range.</p> : <div className="referralAdminVisitList">{selectedVisits.map((point) => <div key={point.date}><span>{point.date}</span><strong>{point.visits}</strong></div>)}</div>}</div></div> : null}
  </PageContainer>;
}
