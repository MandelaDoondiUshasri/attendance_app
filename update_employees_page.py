import re

filepath = 'e:/projects/frgattendance/frontend/src/pages/employees/EmployeesPage.jsx'

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
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);"""
content = content.replace("  const { user } = useAuth();", hook_str)

# 3. fetchEmployees error handling
fetch_replace = """    try {
      setError(null);
      const [empRes, deptRes, desgRes] = await Promise.all([
        api.get('/employees/'),
        api.get('/employees/departments/'),
        api.get('/employees/designations/')
      ]);
      setEmployees(empRes.data.results || empRes.data || []);
      setDepartments(deptRes.data.results || deptRes.data || []);
      setDesignations(desgRes.data.results || desgRes.data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load employee directory.');
    } finally {"""
content = re.sub(r'    try \{\n      const \[empRes.*?    } finally \{', fetch_replace, content, flags=re.DOTALL)

# 4. Replace alerts with addToast
content = content.replace("alert('Employee profile updated successfully!');", "addToast('Employee profile updated successfully!', 'success');")
content = content.replace("alert(errorMsg);", "addToast(errorMsg, 'error');")
content = content.replace("alert('Employee profile registered successfully!');", "addToast('Employee profile registered successfully!', 'success');")
content = content.replace("alert(`Employee ${name} deactivated successfully.`);", "addToast(`Employee ${name} deactivated successfully.`, 'success');")
content = content.replace("alert(err.response?.data?.message || 'Deactivation failed');", "addToast(err.response?.data?.message || 'Deactivation failed', 'error');")
content = content.replace("alert(`Employee ${name} reactivated successfully!`);", "addToast(`Employee ${name} reactivated successfully!`, 'success');")
content = content.replace("alert(err.response?.data?.message || 'Activation failed');", "addToast(err.response?.data?.message || 'Activation failed', 'error');")
content = content.replace("alert('Department created successfully!');", "addToast('Department created successfully!', 'success');")
content = content.replace("alert(err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || err.response?.data?.message || 'Failed to create department');", "addToast(err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || err.response?.data?.message || 'Failed to create department', 'error');")
content = content.replace("alert(`Department \"${name}\" deleted successfully.`);", "addToast(`Department \"${name}\" deleted successfully.`, 'success');")
content = content.replace("alert(err.response?.data?.message || 'Failed to delete department');", "addToast(err.response?.data?.message || 'Failed to delete department', 'error');")
content = content.replace("alert('Designation created successfully!');", "addToast('Designation created successfully!', 'success');")
content = content.replace("alert(err.response?.data?.message || err.response?.data?.title?.[0] || 'Failed to create designation');", "addToast(err.response?.data?.message || err.response?.data?.title?.[0] || 'Failed to create designation', 'error');")
content = content.replace("alert(`Designation \"${title}\" deleted successfully.`);", "addToast(`Designation \"${title}\" deleted successfully.`, 'success');")
content = content.replace("alert(err.response?.data?.message || 'Failed to delete designation');", "addToast(err.response?.data?.message || 'Failed to delete designation', 'error');")

# 5. JSX Loading and Error and Empty
jsx_start = """  if (loading) return <LoadingState type="full" text="Loading directory..." />;
  if (error) return <ErrorState message={error} onRetry={fetchEmployees} />;

  return ("""
content = content.replace("  return (\n    <div className=\"space-y-6\">", jsx_start + "\n    <div className=\"space-y-6\">")

# 6. Table Empty/No Results
empty_state_jsx = """              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    {searchTerm ? (
                      <NoSearchResults searchTerm={searchTerm} onClear={() => setSearchTerm('')} />
                    ) : (
                      <EmptyState title="No Employees Found" description="Get started by adding your first employee." icon={Users} />
                    )}
                  </td>
                </tr>
              ) : ("""
content = content.replace("""              {filteredEmployees.length === 0 ? (
                <tr><td colSpan="8" className="p-6 text-center text-slate-500">No employee records found</td></tr>
              ) : (""", empty_state_jsx)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated EmployeesPage.jsx')
