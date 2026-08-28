import re

filepath = 'e:/projects/frgattendance/frontend/src/pages/attendance/AttendancePage.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
imports = """import EmptyState from '../../components/common/states/EmptyState';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import NoSearchResults from '../../components/common/states/NoSearchResults';
import FormError from '../../components/common/states/FormError';
import { useAppState } from '../../context/AppStateContext';
"""
content = content.replace("import { useAuth } from '../../context/AuthContext';", "import { useAuth } from '../../context/AuthContext';\n" + imports)

# 2. Hooks and states
hook_str = """  const { user } = useAuth();
  const { addToast } = useAppState();
  const [error, setError] = useState(null);"""
content = content.replace("  const { user } = useAuth();", hook_str)

# 3. fetchData error handling
fetch_replace = """    try {
      setError(null);
      let attUrl = '/attendance/';
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (dateFilter) params.append('date', dateFilter);
      if (params.toString()) attUrl += `?${params.toString()}`;

      const [attRes, corrRes] = await Promise.all([
        api.get(attUrl),
        api.get('/attendance/corrections/')
      ]);

      setAttendances(attRes.data?.results || attRes.data || []);
      setCorrections(corrRes.data?.results || corrRes.data || []);
    } catch (e) {
      console.error('Error fetching attendance data:', e);
      setError('Failed to load attendance records.');
    } finally {"""
content = re.sub(r'    try \{\n      let attUrl.*?    \} finally \{', fetch_replace, content, flags=re.DOTALL)

# 4. Replace alerts with addToast
content = content.replace("alert(`Attendance correction for ${employeeName} APPROVED successfully.`);", "addToast(`Attendance correction for ${employeeName} APPROVED successfully.`, 'success');")
content = content.replace("alert(err.response?.data?.error || 'Failed to approve attendance correction.');", "addToast(err.response?.data?.error || 'Failed to approve attendance correction.', 'error');")
content = content.replace("alert(`Attendance correction for ${rejectingCorrection.employee_name} REJECTED.`);", "addToast(`Attendance correction for ${rejectingCorrection.employee_name} REJECTED.`, 'success');")
content = content.replace("alert(err.response?.data?.error || 'Failed to reject attendance correction.');", "addToast(err.response?.data?.error || 'Failed to reject attendance correction.', 'error');")

# 5. JSX Loading and Error
jsx_start = """
  if (loading) return <LoadingState type="full" text="Loading attendance data..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return ("""
content = content.replace("  return (\n    <div className=\"space-y-6\">", jsx_start + "\n    <div className=\"space-y-6\">")

# 6. Replace inline loading states in tables with EmptyState / NoSearchResults
# Tab 1: Attendance Logs Table
empty_att_logs_find = """                  {loading ? (
                    <tr><td colSpan="8" className="p-8 text-center text-slate-500 font-semibold">Loading attendance logs...</td></tr>
                  ) : filteredAttendances.length === 0 ? (
                    <tr><td colSpan="8" className="p-8 text-center text-slate-500 font-semibold">No attendance records found matching filters</td></tr>
                  ) : ("""
empty_att_logs_replace = """                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-0">
                        {searchQuery ? (
                          <NoSearchResults searchTerm={searchQuery} onClear={() => setSearchQuery('')} />
                        ) : (
                          <EmptyState title="No Attendance Records" description="No records found for the applied filters." icon={CalendarCheck} />
                        )}
                      </td>
                    </tr>
                  ) : ("""
content = content.replace(empty_att_logs_find, empty_att_logs_replace)

# Tab 2: Pending Corrections Table
empty_pending_find = """                  {loading ? (
                    <tr><td colSpan="8" className="p-8 text-center text-slate-500">Loading pending requests...</td></tr>
                  ) : pendingCorrections.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500/40" />
                          <p className="font-bold text-slate-400">No Pending Attendance Corrections</p>
                          <p className="text-xs text-slate-500">All employee correction submissions are up to date.</p>
                        </div>
                      </td>
                    </tr>
                  ) : ("""
empty_pending_replace = """                  {pendingCorrections.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-0">
                        <EmptyState title="No Pending Corrections" description="All employee correction submissions are up to date." icon={CheckCircle2} />
                      </td>
                    </tr>
                  ) : ("""
content = content.replace(empty_pending_find, empty_pending_replace)

# Tab 3: History Table
empty_history_find = """                {resolvedCorrections.length === 0 ? (
                  <tr><td colSpan="7" className="p-8 text-center text-slate-500">No historical correction records found.</td></tr>
                ) : ("""
empty_history_replace = """                {resolvedCorrections.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-0">
                      <EmptyState title="No History Found" description="No historical correction records found." icon={FileText} />
                    </td>
                  </tr>
                ) : ("""
content = content.replace(empty_history_find, empty_history_replace)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated AttendancePage.jsx')
