import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles, Camera, FileText, CalendarCheck, Clock, ShieldCheck,
  CheckCircle2, ArrowRight, ChevronDown, ChevronUp, Search,
  HelpCircle, CheckSquare, Download, ExternalLink, Lock,
  Calendar, DollarSign, AlertCircle, Eye, Zap, Layers,
  Check, RefreshCw, BookmarkCheck, LogOut
} from 'lucide-react';
import { useAuth, hasProfilePhoto } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';

export const WhatsNewPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [isMarkedRead, setIsMarkedRead] = useState(false);

  // Interactive Checklist State saved in localStorage
  const [checklist, setChecklist] = useState(() => {
    const saved = localStorage.getItem('whats_new_checklist_v12');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return {
      earlypass: false,
      payslips: false,
      leaves: false,
      timesheet: false,
    };
  });

  useEffect(() => {
    const lastRead = localStorage.getItem('whats_new_last_read_v12');
    if (lastRead) {
      setIsMarkedRead(true);
    }
  }, []);

  const toggleChecklistItem = (key) => {
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next);
    localStorage.setItem('whats_new_checklist_v12', JSON.stringify(next));
  };

  const handleMarkAsRead = () => {
    const now = new Date().toISOString();
    localStorage.setItem('whats_new_last_read_v12', now);
    setIsMarkedRead(true);
    addToast('Marked all new updates as read! You are all caught up.', 'success');
  };

  const completedTasksCount = Object.values(checklist).filter(Boolean).length;
  const totalTasks = 4;
  const progressPercent = Math.round((completedTasksCount / totalTasks) * 100);

  // Updates Data
  const updates = [
    {
      id: 'earlypass-approved-exit',
      category: 'ATTENDANCE',
      title: 'EarlyPass – Approved Early Exit Without Salary Deduction',
      version: 'v1.3.0 • Attendance & HR Policy',
      badge: 'APPROVED EXCEPTION',
      badgeColor: 'amber',
      date: 'Oct 5, 2026',
      icon: LogOut,
      summary: 'Need to leave work before completing the standard 8-hour requirement? EarlyPass allows you to submit an early departure request to CEO/HR. When approved, your early exit is treated as an official attendance exception with ₹0 salary deduction!',
      whyItMatters: [
        '100% Salary Protection: Approved EarlyPass prevents short-hours salary deductions (₹0 salary deduction).',
        'Preserves True Attendance Records: Actual working hours (e.g. 6h 30m) are faithfully preserved without artificial alteration to 8 hours.',
        'CEO / HR Governed: Empowers management with full audit trails, abuse-prevention limits, and authorized approvals for personal emergencies.'
      ],
      howToUseSteps: [
        'Clock in for your regular workday on your Employee Dashboard.',
        'Click "Request EarlyPass" on the dashboard quick actions bar or navigate to "EarlyPass Requests".',
        'Confirm request date, check-in punch, and enter requested exit time (e.g. 3:30 PM), reason, and optional attachments.',
        'Submit request (status begins as "Pending Approval"). Once authorized by CEO or HR, your day is marked "Present – Approved Early Exit" with ₹0 deduction!'
      ],
      note: 'Actual Attendance ≠ Payroll Treatment: If you work 6.5 hours, your attendance record accurately shows 6.5 hours, while payroll waives deductions for that day as an approved exception.',
      actionLabel: 'Request EarlyPass',
      actionPath: '/early-pass',
    },
    {
      id: 'employee-payslips-portal',
      category: 'PAYROLL',
      title: 'Brand-New "My Payslips" Portal & Instant PDF Downloads',
      version: 'v1.2.0 • Major Feature',
      badge: 'NEW MODULE',
      badgeColor: 'emerald',
      date: 'Oct 4 – 5, 2026',
      icon: DollarSign,
      summary: 'Employees no longer need to wait for emailed monthly salary slips! A dedicated "My Payslips" portal is now available directly in your navigation menu with 1-click PDF downloads.',
      whyItMatters: [
        'Instant on-demand access to your certified monthly compensation statements.',
        'Full financial transparency: view Gross Salary, Allowances, PF/ESI deductions, and Net Take-Home.',
        'Official encrypted PDF with company seal & signature, formatted for official loan, banking, and tax needs.'
      ],
      howToUseSteps: [
        'Click "My Payslips" in the sidebar navigation or from the quick action button on your dashboard.',
        'Filter by year and month to review past salary distributions.',
        'Click the "Preview" (eye icon) to inspect your itemized earnings, bonuses, deductions, and Loss of Pay (LOP) breakdowns.',
        'Click "Download PDF" to save an official, print-ready payslip directly to your computer or mobile device.'
      ],
      note: 'Payslips are officially released by HR at the start of each month. An in-app alert will notify you as soon as your slip is published.',
      actionLabel: 'Go to My Payslips',
      actionPath: '/employee/payslips',
    },
    {
      id: 'leave-carry-forward-and-split-approval',
      category: 'LEAVES',
      title: 'Dynamic Casual Leave (CL) Carry-Forward & Smart Split Approvals',
      version: 'v1.2.0 • Policy Upgrade',
      badge: 'SMART ENGINE',
      badgeColor: 'indigo',
      date: 'Oct 4 – 5, 2026',
      icon: CalendarCheck,
      summary: 'Our leave governance engine has been upgraded with dynamic Casual Leave roll-over and intelligent split approvals so your leave requests are treated fairly without flat rejections.',
      whyItMatters: [
        'Dynamic Carry-Forward: Unused Casual Leaves from previous months automatically roll over into your available balance.',
        'No Flat Rejections: If you request more leave than your available CL balance, the system automatically splits eligible days under CL and approves the excess as Loss of Pay (LOP).',
        'Direct "Loss of Pay (LOP)" Option: Transparently request unpaid leave when CL is exhausted, with clear upfront daily deduction calculations.'
      ],
      howToUseSteps: [
        'Navigate to "Leave Applications" or click "Apply Leave" from your dashboard.',
        'Select Casual Leave (CL) or Loss of Pay (LOP). Available balances and carry-forwards are automatically calculated.',
        'If your requested days exceed your current CL allowance, the system clearly prompts the split breakdown before submission.',
        'Monitor your visual balance progress meters on your dashboard to see utilized vs remaining allowances.'
      ],
      note: 'LOP deductions are calculated based on actual calendar days of the month (Monthly Salary ÷ Total Days in Month × LOP Days).',
      actionLabel: 'View Leave Balances',
      actionPath: '/leaves',
    },
    {
      id: 'elevated-dashboard-and-clock-hud',
      category: 'EXPERIENCE',
      title: 'Elevated Dashboard, Glassmorphism Hero & Real-Time Clock HUD',
      version: 'v1.2.0 • Visual Polish',
      badge: 'REDESIGNED UI',
      badgeColor: 'sky',
      date: 'Oct 4 – 5, 2026',
      icon: Clock,
      summary: 'A completely modernized workspace interface featuring a live high-precision clock & calendar HUD, glassmorphism hero greeting, and one-touch attendance actions.',
      whyItMatters: [
        'Always-visible live clock & date widget in the topbar keeps you synchronized with company shift timings.',
        'Fast one-touch punch-in and punch-out with real-time shift duration stopwatch and geolocation tagging.',
        'Sleek modern status cards showing Today\'s Attendance, Monthly Attendance percentages, and active approvals.'
      ],
      howToUseSteps: [
        'Check the Topbar HUD anytime for current live server time and date.',
        'Clock in at the start of your shift from the Employee Dashboard. The timer will track your elapsed working hours live.',
        'Use the Quick Action buttons to Apply Leave, Request WFH, or Correct a missed punch with one click.',
        'Toggle the sidebar collapse button to maximize your workspace screen area on smaller displays.'
      ],
      note: 'Your shift duration timer updates every second. Standard shifts are configured for 8 hours (full-day) or 4 hours (half-day).',
      actionLabel: 'Explore Dashboard',
      actionPath: '/employee/dashboard',
    },
    {
      id: 'attendance-regularization-and-half-day',
      category: 'ATTENDANCE',
      title: 'Streamlined Attendance Regularization & Half-Day Clarity',
      version: 'v1.2.0 • Workflow Polish',
      badge: 'IMPROVED FLOW',
      badgeColor: 'violet',
      date: 'Oct 4 – 5, 2026',
      icon: CheckSquare,
      summary: 'Forgot to clock in or had a technical issue? The attendance regularization (correction) request workflow is now simpler, with transparent half-day shift calculation standards.',
      whyItMatters: [
        'Quickly submit corrections with supporting remarks directly from your dashboard or Timesheet.',
        'Clear Half-Day Policy: shifts between 4 and 7 hours qualify as half-day; 8+ hours qualify as full day.',
        'Real-time status tracking showing Pending, Approved, or Rejected state directly in your daily logs.'
      ],
      howToUseSteps: [
        'Click "Correct Attendance" on your dashboard or navigate to "My Timesheet".',
        'Select the target date, enter your actual in/out times, and provide a clear explanation.',
        'Submit for supervisor/HR approval. You will receive an alert once reviewed.'
      ],
      note: 'Timely correction requests must be filed within the active payroll cycle to ensure accurate month-end salary processing.',
      actionLabel: 'Open Timesheet',
      actionPath: '/attendance',
    }
  ];

  // FAQs
  const faqs = [
    {
      q: 'How does EarlyPass protect my salary when leaving before 8 hours?',
      a: 'EarlyPass works as an authorized attendance exception. When CEO or HR approves your request, your attendance is marked as "Present – Approved Early Exit" and your salary deduction is ₹0. Your actual working hours (e.g. 6h 30m) remain accurately preserved in attendance logs, while payroll waives short-hour deductions.'
    },
    {
      q: 'How do I download my monthly salary payslip?',
      a: 'Head to "My Payslips" from the left sidebar or the dashboard quick action button. You can filter by year and month. Click the "Download PDF" button to instantly receive your official formatted payslip with earnings, deductions, and net pay.'
    },
    {
      q: 'What happens if I apply for leave beyond my available Casual Leave balance?',
      a: 'Our smart leave engine will automatically split your request. The days covered by your remaining CL balance will be approved under Casual Leave, and the remaining excess days will be approved as Loss of Pay (LOP), preventing outright rejection of your request.'
    },
    {
      q: 'How is Loss of Pay (LOP) calculated in my salary?',
      a: 'LOP is calculated using calendar-day daily rate: (Monthly Gross Salary ÷ Total Days in Month) × LOP Days. This ensures 100% fair and transparent deductions without penalty discrepancies.'
    },
    {
      q: 'What are the minimum working hours for a Half-Day vs Full-Day shift?',
      a: 'A minimum of 4 working hours is required to be credited for a Half-Day. Working 8 hours or more credits a Full-Day. Ensure you punch out at the end of your shift to record your hours accurately.'
    },
    {
      q: 'Where can I find the new "What\'s New" page in the future?',
      a: 'You can access this page anytime via the "What\'s New" link in your sidebar navigation, or by clicking the sparkle icon in the top header bar.'
    }
  ];

  // Filtering
  const filteredUpdates = updates.filter(u => {
    const matchesCategory = activeCategory === 'ALL' || u.category === activeCategory;
    const matchesQuery = searchQuery.trim() === '' ||
      u.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.badge.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* HERO SECTION */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-500/20 to-sky-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>OCTOBER 2026 RELEASE • NEW UPDATES FROM YESTERDAY</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              What's New in Your <span className="bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400 bg-clip-text text-transparent">FRG Workspace</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed">
              We've rolled out essential upgrades to streamline your daily routine: EarlyPass approved early-exit with ₹0 deduction, digital PDF payslips, dynamic Casual Leave carry-forward, smart split approvals, and an elevated real-time dashboard.
            </p>
          </div>

          {/* Quick Action / Status Badge */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
            <button
              onClick={handleMarkAsRead}
              id="whats-new-mark-read-btn"
              className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2.5 transition-all shadow-lg cursor-pointer ${
                isMarkedRead
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white border border-indigo-400/30 hover:scale-[1.02] active:scale-95'
              }`}
            >
              {isMarkedRead ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>You're All Caught Up!</span>
                </>
              ) : (
                <>
                  <BookmarkCheck className="w-4 h-4 text-white" />
                  <span>Mark All as Read</span>
                </>
              )}
            </button>

            <Link
              to="/employee/dashboard"
              className="px-5 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-white/10 hover:border-white/20 transition-all cursor-pointer"
            >
              <span>Back to Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* QUICK STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-amber-500/30 transition-all group backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
              <LogOut className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              ₹0 Deduction
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-3">EarlyPass Exception</h2>
          <p className="text-xs text-slate-400 mt-1">Leave before 8h with approved exception and zero salary cut upon CEO/HR approval.</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-emerald-500/30 transition-all group backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              New Portal
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-3">Digital PDF Payslips</h2>
          <p className="text-xs text-slate-400 mt-1">1-click instant PDF download with itemized earnings, deductions & taxes.</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-indigo-500/30 transition-all group backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Smart Engine
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-3">Dynamic CL Rollover</h2>
          <p className="text-xs text-slate-400 mt-1">Unused leaves automatically carry forward, with intelligent split approvals.</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-sky-500/30 transition-all group backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
              Real-time
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-3">Live Clock & HUD</h2>
          <p className="text-xs text-slate-400 mt-1">High-precision topbar digital clock, shift duration timer & status badges.</p>
        </div>
      </div>

      {/* INTERACTIVE EMPLOYEE ACTION CHECKLIST */}
      <div className="p-6 rounded-3xl bg-slate-900/90 border border-white/10 relative overflow-hidden backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Employee Quick Start Checklist</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Take 2 minutes to verify these 4 updates to ensure your account is completely in sync.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-bold text-white tabular-nums">{completedTasksCount} / {totalTasks} Completed</span>
              <p className="text-[10px] text-slate-400">{progressPercent}% Ready</p>
            </div>
            <div className="w-24 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <label
            onClick={() => toggleChecklistItem('earlypass')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              checklist.earlypass
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={checklist.earlypass}
              onChange={() => {}}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <div className="text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">1. Explore EarlyPass Workflow</span>
                <Link to="/early-pass" onClick={(e) => e.stopPropagation()} className="text-[10px] text-amber-400 hover:underline flex items-center gap-1">
                  EarlyPass <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Learn how to request an approved early departure without salary deduction.</p>
            </div>
          </label>

          <label
            onClick={() => toggleChecklistItem('payslips')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              checklist.payslips
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={checklist.payslips}
              onChange={() => {}}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <div className="text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">2. Explore "My Payslips"</span>
                <Link to="/employee/payslips" onClick={(e) => e.stopPropagation()} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1">
                  Payslips <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">View your itemized salary breakdown and test the instant PDF download.</p>
            </div>
          </label>

          <label
            onClick={() => toggleChecklistItem('leaves')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              checklist.leaves
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={checklist.leaves}
              onChange={() => {}}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <div className="text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">3. Review Leave Balances</span>
                <Link to="/leaves" onClick={(e) => e.stopPropagation()} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1">
                  Leaves <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Check your carried-forward Casual Leave balance and new LOP category.</p>
            </div>
          </label>

          <label
            onClick={() => toggleChecklistItem('timesheet')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              checklist.timesheet
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-white/[0.02] border-white/10 hover:border-white/20 text-slate-300'
            }`}
          >
            <input
              type="checkbox"
              checked={checklist.timesheet}
              onChange={() => {}}
              className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
            />
            <div className="text-xs flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">4. Check Timesheet & Shifts</span>
                <Link to="/attendance" onClick={(e) => e.stopPropagation()} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1">
                  Timesheet <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Understand Half-Day (4h) vs Full-Day (8h) shift requirements.</p>
            </div>
          </label>
        </div>
      </div>

      {/* CATEGORY FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'All Updates' },
            { id: 'SECURITY', label: 'Security & Photo' },
            { id: 'PAYROLL', label: 'Payroll & Payslips' },
            { id: 'LEAVES', label: 'Leaves & LOP' },
            { id: 'EXPERIENCE', label: 'Dashboard & UI' },
            { id: 'ATTENDANCE', label: 'Timesheet' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search updates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* FEATURE CARDS LIST */}
      <div className="space-y-6">
        {filteredUpdates.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              id={item.id}
              className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/10 hover:border-white/20 transition-all backdrop-blur-xl relative overflow-hidden shadow-xl"
            >
              {/* Top Meta Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {item.badge}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {item.version}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white mt-1">
                      {item.title}
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 bg-white/[0.03] px-3 py-1 rounded-full border border-white/[0.06]">
                    {item.date}
                  </span>
                </div>
              </div>

              {/* Main Summary */}
              <p className="text-sm text-slate-300 mt-4 leading-relaxed font-normal">
                {item.summary}
              </p>

              {/* 2-Column Details: Why it Matters + Step by Step Guide */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Column 1: Why it matters / Benefits */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Key Benefits for Employees
                  </h3>
                  <ul className="space-y-2.5">
                    {item.whyItMatters.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Column 2: Step-by-Step Guidance */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    Step-by-Step Instructions
                  </h3>
                  <ol className="space-y-2.5">
                    {item.howToUseSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-300 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-sky-500/30">
                          {idx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Notice & Direct Action Link */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-6 pt-4 border-t border-white/[0.08]">
                <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{item.note}</span>
                </div>

                <Link
                  to={item.actionPath}
                  className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white rounded-xl text-xs font-bold border border-indigo-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] shrink-0"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}

        {filteredUpdates.length === 0 && (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-white/5">
            <Search className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No updates found matching your search.</p>
          </div>
        )}
      </div>

      {/* FAQ SECTION */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 backdrop-blur-xl space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 mb-2">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>CLARIFICATIONS & FAQ</span>
          </div>
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
          <p className="text-xs text-slate-400 mt-1">
            Common questions regarding our latest system updates and policies.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left text-xs sm:text-sm font-semibold text-white hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-xs text-slate-300 leading-relaxed border-t border-white/[0.04] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FOOTER ASSISTANCE CARD */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/20 text-center space-y-3">
        <h2 className="text-lg font-bold text-white">Need Additional Assistance?</h2>
        <p className="text-xs text-slate-400 max-w-lg mx-auto">
          If you have questions regarding your salary calculation, leave balances, or experiencing technical difficulties with photo upload, please reach out to the HR Helpdesk.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            to="/profile"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-all"
          >
            My Profile
          </Link>
          <Link
            to="/employee/dashboard"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewPage;
