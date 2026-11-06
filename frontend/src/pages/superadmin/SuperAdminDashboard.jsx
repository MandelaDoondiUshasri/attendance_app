import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  Building2, Users, CreditCard, DollarSign, TrendingUp, AlertTriangle,
  Plus, CheckCircle2, XCircle, Search, Shield, RefreshCw, Eye, ArrowUpRight
} from 'lucide-react';

export const SuperAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('companies'); // 'companies' | 'plans'
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Onboarding Modal State
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [formData, setFormData] = useState({
    company_name: '',
    slug: '',
    contact_email: '',
    contact_phone: '',
    industry: '',
    plan_tier: 'STARTER',
    billing_cycle: 'MONTHLY',
    admin_name: '',
    admin_email: '',
    admin_password: '',
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, companiesRes, plansRes] = await Promise.all([
        api.get('/super-admin/dashboard/stats/').catch(() => ({ data: null })),
        api.get('/super-admin/companies/').catch(() => ({ data: [] })),
        api.get('/super-admin/plans/').catch(() => ({ data: [] })),
      ]);
      setStats(statsRes.data);
      setCompanies(companiesRes.data?.results || (Array.isArray(companiesRes.data) ? companiesRes.data : []));
      setPlans(plansRes.data?.results || (Array.isArray(plansRes.data) ? plansRes.data : []));
    } catch (e) {
      console.error('Failed to load Super Admin data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSlugGen = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  };

  const handleCompanyNameChange = (e) => {
    const name = e.target.value;
    setFormData(prev => ({
      ...prev,
      company_name: name,
      slug: handleSlugGen(name)
    }));
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await api.post('/super-admin/companies/onboard/', formData);
      setSuccessMessage(`Company "${res.data.name}" onboarded successfully!`);
      setShowOnboardModal(false);
      setFormData({
        company_name: '',
        slug: '',
        contact_email: '',
        contact_phone: '',
        industry: '',
        plan_tier: 'STARTER',
        billing_cycle: 'MONTHLY',
        admin_name: '',
        admin_email: '',
        admin_password: '',
      });
      fetchDashboardData();
    } catch (err) {
      const msg = err.response?.data?.detail || 
                  err.response?.data?.company_name?.[0] || 
                  err.response?.data?.slug?.[0] || 
                  err.response?.data?.admin_email?.[0] || 
                  'Failed to onboard company. Please check input parameters.';
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusToggle = async (company) => {
    const isSuspended = company.status === 'SUSPENDED';
    const action = isSuspended ? 'reactivate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} ${company.name}?`)) return;

    try {
      await api.post(`/super-admin/companies/${company.id}/${action}/`);
      fetchDashboardData();
    } catch (e) {
      alert(`Failed to ${action} company.`);
    }
  };

  const filteredCompanies = companies.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.contact_email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              SaaS Multi-Tenant Engine
            </span>
            <span className="text-xs text-slate-400">v2.0 2026 Production Edition</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">Platform Super Admin Console</h1>
          <p className="text-sm text-slate-400">
            Tenant provisioning, license entitlement governance, and global recurring revenue metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowOnboardModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg shadow-lg shadow-brand-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Onboard Company
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* High-Level SaaS Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Companies</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats?.total_companies ?? '-'}</span>
            <span className="text-xs text-emerald-400 font-medium">{stats?.active_companies ?? 0} active</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{stats?.suspended_companies ?? 0} suspended</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Headcount</span>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats?.total_employees ?? '-'}</span>
            <span className="text-xs text-blue-400 font-medium">Platform-wide</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Across all registered tenants</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Projected MRR</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">
              ₹{Number(stats?.mrr_inr || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Monthly Recurring Revenue</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Subscriptions</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stats?.active_subscriptions ?? '-'}</span>
            {stats?.expiring_subscriptions_count > 0 && (
              <span className="text-xs text-amber-400 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3" />
                {stats.expiring_subscriptions_count} expiring soon
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Within active or grace window</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('companies')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'companies'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Customer Organizations ({companies.length})
        </button>
        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'plans'
              ? 'border-brand-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Subscription Plans ({plans.length})
        </button>
      </div>

      {/* TAB 1: Companies Table */}
      {activeTab === 'companies' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search companies, slugs, emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              {['ALL', 'ACTIVE', 'SUSPENDED'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    statusFilter === st
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/60 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Company / Tenant</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Plan & Utilization</th>
                    <th className="px-5 py-3 font-semibold">Subscription Window</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {filteredCompanies.map((c) => {
                    const isMaster = c.is_master_tenant;
                    const sub = c.subscription;
                    const maxEmp = sub?.max_employees || 25;
                    const currEmp = c.employee_count || 0;
                    const utilPercent = Math.min(100, Math.round((currEmp / maxEmp) * 100));

                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-brand-400 text-sm">
                              {c.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-2">
                                {c.name}
                                {isMaster && (
                                  <span className="px-2 py-0.5 text-[10px] bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded font-medium">
                                    Master Tenant
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400">
                                slug: <span className="text-slate-300 font-mono">{c.slug}</span> • {c.contact_email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            c.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {c.status}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-white flex justify-between">
                              <span>{sub?.plan_name || 'Standard'}</span>
                              <span className="text-slate-400">{currEmp} / {maxEmp} staff</span>
                            </div>
                            <div className="w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  utilPercent > 90 ? 'bg-rose-500' : utilPercent > 70 ? 'bg-amber-500' : 'bg-brand-500'
                                }`}
                                style={{ width: `${utilPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {sub ? (
                            <div>
                              <div className="text-slate-200">Valid to: {sub.expiry_date}</div>
                              <div className="text-slate-400">
                                {sub.days_remaining > 0 ? (
                                  <span className="text-emerald-400">{sub.days_remaining} days left</span>
                                ) : sub.is_in_grace_period ? (
                                  <span className="text-amber-400 font-medium">In Grace Period ({sub.grace_period_days}d)</span>
                                ) : (
                                  <span className="text-rose-400 font-medium">Expired</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">No active plan</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!isMaster && (
                            <button
                              onClick={() => handleStatusToggle(c)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium border transition ${
                                c.status === 'ACTIVE'
                                  ? 'border-rose-800/80 text-rose-400 hover:bg-rose-950/50'
                                  : 'border-emerald-800/80 text-emerald-400 hover:bg-emerald-950/50'
                              }`}
                            >
                              {c.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCompanies.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                        No customer organizations matched your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Subscription Plans */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      {p.tier}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-2">{p.name}</h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">{p.billing_cycle}</span>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">₹{Number(p.price_inr).toLocaleString('en-IN')}</span>
                  <span className="text-xs text-slate-400">/{p.billing_cycle.toLowerCase()}</span>
                </div>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    Up to <strong className="text-white">{p.max_employees.toLocaleString()}</strong> active employees
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {p.max_storage_mb / 1000} GB Cloud Document & Avatar Storage
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {p.has_payroll_module ? 'Full Payroll & Payslip Engine' : 'Basic Timesheet Only'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {p.has_pf_esi_compliance ? 'EPFO 2026 & ESI Compliance' : 'Standard Deductions'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {p.has_early_pass_module ? 'EarlyPass Governance Suite' : 'No EarlyPass'}
                  </li>
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onboard Company Modal */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-400" />
                Onboard New Customer Organization
              </h2>
              <button
                onClick={() => setShowOnboardModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={handleCompanyNameChange}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">URL Identifier (Slug) *</label>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                    placeholder="e.g. acme"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Corporate Contact Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                    placeholder="admin@acmecorp.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Plan Tier</label>
                  <select
                    value={formData.plan_tier}
                    onChange={(e) => setFormData(prev => ({ ...prev, plan_tier: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="STARTER">Starter Plan (25 staff)</option>
                    <option value="PROFESSIONAL">Professional Plan (100 staff)</option>
                    <option value="ENTERPRISE">Enterprise Plan (Unlimited)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Billing Cycle</label>
                  <select
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData(prev => ({ ...prev, billing_cycle: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="YEARLY">Yearly (Annual License)</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-400 mb-2">
                  Initial Company Admin Account
                </h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Admin Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.admin_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, admin_name: e.target.value }))}
                        placeholder="e.g. John Doe"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Admin Email (Login) *</label>
                      <input
                        type="email"
                        required
                        value={formData.admin_email}
                        onChange={(e) => setFormData(prev => ({ ...prev, admin_email: e.target.value }))}
                        placeholder="john@acmecorp.com"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Admin Temporary Password *</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formData.admin_password}
                      onChange={(e) => setFormData(prev => ({ ...prev, admin_password: e.target.value }))}
                      placeholder="Minimum 8 characters"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-lg shadow-lg shadow-brand-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Provisioning Tenant...' : 'Provision Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;

