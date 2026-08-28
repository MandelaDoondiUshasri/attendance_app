import React, { useState, useEffect } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, 
  parseISO 
} from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Plus, X, Filter 
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/common/Modal';

export default function CompanyCalendar() {
  const { user } = useAuth();
  const isManagement = ['HR', 'CEO', 'SYSTEM_ADMIN'].includes(user?.role);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    festival_type: 'GENERAL'
  });

  const [selectedDayEvents, setSelectedDayEvents] = useState(null);

  const fetchEvents = async (date) => {
    try {
      setLoading(true);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const res = await api.get(`/attendance/holidays/calendar-events/?year=${year}&month=${month}`);
      // Parse ISO strings back to Date objects
      const parsedEvents = res.data.events.map(ev => ({
        ...ev,
        date: parseISO(ev.date)
      }));
      setEvents(parsedEvents);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents(currentDate);
  }, [currentDate]);

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      await api.post('/attendance/holidays/', newHoliday);
      setShowAddModal(false);
      setNewHoliday({ name: '', date: '', festival_type: 'GENERAL' });
      fetchEvents(currentDate);
    } catch (err) {
      alert('Failed to add holiday.');
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const renderHeader = () => {
    return (
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-4">
          <CalendarIcon className="w-8 h-8 text-indigo-400" />
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Company Calendar
          </h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-white/5 rounded-lg p-1 border border-white/10">
            <button 
              onClick={prevMonth}
              className="p-2 hover:bg-white/10 rounded-md transition-colors text-slate-300"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 font-semibold text-white min-w-[140px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button 
              onClick={nextMonth}
              className="p-2 hover:bg-white/10 rounded-md transition-colors text-slate-300"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          {isManagement && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center px-4 py-2 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Festival/Holiday
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} className="text-center font-semibold text-slate-400 py-2 border-b border-white/10">
          {format(addDays(startDate, i), 'EEEE')}
        </div>
      );
    }
    return <div className="grid grid-cols-7 bg-white/5 rounded-t-xl">{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = '';

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const cloneDay = day;
        
        const dayEvents = events.filter(e => isSameDay(e.date, cloneDay));

        days.push(
          <div
            key={day}
            onClick={() => {
              if (dayEvents.length > 0) setSelectedDayEvents({ date: cloneDay, events: dayEvents });
            }}
            className={`min-h-[80px] p-2 border-b border-r border-white/5 transition-all duration-200 
              ${!isSameMonth(day, monthStart) ? 'bg-black/20 text-slate-600' : 'bg-transparent text-slate-200 hover:bg-white/5'}
              ${dayEvents.length > 0 ? 'cursor-pointer' : ''}
            `}
          >
            <div className="flex justify-between items-start">
              <span className={`font-medium ${isSameDay(day, new Date()) ? 'bg-indigo-500 text-white w-7 h-7 rounded-full flex items-center justify-center' : ''}`}>
                {formattedDate}
              </span>
            </div>
            
            <div className="mt-2 space-y-1">
              {dayEvents.slice(0, 3).map((event, idx) => (
                <div 
                  key={event.id}
                  className="px-2 py-1 text-xs rounded border backdrop-blur-sm truncate"
                  style={{ 
                    backgroundColor: `${event.color}20`,
                    borderColor: `${event.color}40`,
                    color: event.color 
                  }}
                  title={event.title}
                >
                  {event.title}
                </div>
              ))}
              {dayEvents.length > 3 && (
                <div className="text-xs text-slate-400 pl-1">
                  +{dayEvents.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-7" key={day}>
          {days}
        </div>
      );
      days = [];
    }
    return <div className="border-l border-white/5">{rows}</div>;
  };

  const renderLegend = () => (
    <div className="flex flex-wrap gap-4 mt-6 p-4 glass-panel rounded-xl">
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
        <span className="text-sm text-slate-300">General Holiday</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
        <span className="text-sm text-slate-300">Optional Holiday</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
        <span className="text-sm text-slate-300">Leave</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
        <span className="text-sm text-slate-300">WFH Request</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-3 h-3 rounded-full bg-sky-500"></div>
        <span className="text-sm text-slate-300">Worked WFH</span>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {renderHeader()}
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="glass-panel rounded-xl overflow-hidden border border-white/10 shadow-2xl relative">
        {loading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        )}
        {renderDays()}
        {renderCells()}
      </div>

      {renderLegend()}

      {/* Add Holiday Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Festival / Holiday">
        <form onSubmit={handleAddHoliday} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Festival Name</label>
            <input 
              type="text" 
              required
              value={newHoliday.name}
              onChange={e => setNewHoliday({...newHoliday, name: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date</label>
            <input 
              type="date" 
              required
              value={newHoliday.date}
              onChange={e => setNewHoliday({...newHoliday, date: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Type</label>
            <select
              value={newHoliday.festival_type}
              onChange={e => setNewHoliday({...newHoliday, festival_type: e.target.value})}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="GENERAL">General Holiday</option>
              <option value="OPTIONAL">Optional Holiday</option>
            </select>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/25"
            >
              Add Holiday
            </button>
          </div>
        </form>
      </Modal>

      {/* Day Events Details Modal */}
      <Modal isOpen={!!selectedDayEvents} onClose={() => setSelectedDayEvents(null)} title={`Events on ${selectedDayEvents ? format(selectedDayEvents.date, 'MMM do, yyyy') : ''}`}>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {selectedDayEvents?.events.map(event => (
            <div 
              key={event.id}
              className="p-3 rounded-lg border glass-panel flex flex-col space-y-1"
              style={{ borderColor: `${event.color}40`, backgroundColor: `${event.color}10` }}
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }}></div>
                <span className="font-medium text-white">{event.title}</span>
              </div>
              {event.employee_name && (
                <span className="text-sm text-slate-300 ml-4">Employee: {event.employee_name}</span>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
