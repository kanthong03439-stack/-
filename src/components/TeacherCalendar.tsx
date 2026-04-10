import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { CalendarEvent } from '../types';
import { Plus, X, Trash2, Calendar as CalendarIcon, Clock, Tag, AlignLeft, RefreshCw, Smartphone, Info, Banknote, ChevronRight, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { fetchRealTimeThaiHolidays, Holiday, getHolidayDescription, getTeacherSalaryDate } from '../utils/thaiHolidays';

export default function TeacherCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [salaryDates, setSalaryDates] = useState<{date: string, month: string}[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleTokens, setGoogleTokens] = useState<any>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [allDay, setAllDay] = useState(true);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('งานทั่วไป');
  const [color, setColor] = useState('#3b82f6'); // Default blue

  const CATEGORIES = [
    { name: 'งานทั่วไป', color: '#3b82f6' },
    { name: 'การสอน', color: '#10b981' },
    { name: 'ประชุม', color: '#f59e0b' },
    { name: 'กิจกรรมโรงเรียน', color: '#8b5cf6' },
    { name: 'ส่วนตัว', color: '#ef4444' },
    { name: 'วันหยุดราชการ', color: '#dc2626' },
    { name: 'วันเงินเดือนออก', color: '#059669' },
  ];

  const loadHolidays = async (year: number) => {
    const data = await fetchRealTimeThaiHolidays(year);
    setHolidays(data.map(h => ({ ...h, description: getHolidayDescription(h.name) })));
    
    // Calculate salary dates for the year
    const salaries = Array.from({ length: 12 }, (_, i) => ({
      date: getTeacherSalaryDate(year, i),
      month: new Intl.DateTimeFormat('th-TH', { month: 'long' }).format(new Date(year, i, 1))
    }));
    setSalaryDates(salaries);
  };

  useEffect(() => {
    loadHolidays(currentYear);

    const savedTokens = localStorage.getItem('google_calendar_tokens');
    if (savedTokens) {
      setGoogleTokens(JSON.parse(savedTokens));
    }

    const q = auth.currentUser 
      ? query(collection(db, 'calendar_events'), where('userId', '==', auth.currentUser.uid))
      : query(collection(db, 'calendar_events'));
      
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData: CalendarEvent[] = [];
      snapshot.forEach((doc) => {
        eventsData.push({ id: doc.id, ...doc.data() } as CalendarEvent);
      });
      setEvents(eventsData);
      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn('Permission denied, ignoring...');
        return;
      }
      console.error('Snapshot error:', error);
    });

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        setGoogleTokens(tokens);
        localStorage.setItem('google_calendar_tokens', JSON.stringify(tokens));
        toast.success('เชื่อมต่อ Google Calendar สำเร็จ!');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleConnectGoogle = async () => {
    try {
      console.log('Fetching Google Auth URL...');
      const response = await fetch('/api/auth/google/url');
      if (!response.ok) {
        const text = await response.text();
        console.error('Server responded with error:', response.status, text);
        throw new Error(`Server error: ${response.status}`);
      }
      const { url } = await response.json();
      window.open(url, 'google_auth', 'width=600,height=700');
    } catch (error) {
      console.error('Error connecting to Google:', error);
      toast.error('ไม่สามารถเชื่อมต่อกับ Google ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const syncWithGoogle = async () => {
    if (!googleTokens) return;
    setIsSyncing(true);
    try {
      const response = await fetch('/api/calendar/events/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: googleTokens }),
      });
      const googleEvents = await response.json();

      if (!Array.isArray(googleEvents)) {
        if (googleEvents.error) {
          if (googleEvents.error.includes('Calendar API has not been used') || googleEvents.error.includes('disabled')) {
            toast.error('กรุณาเปิดใช้งาน Google Calendar API ใน Google Cloud Console ก่อนใช้งานฟีเจอร์นี้');
          } else {
            toast.error(`เกิดข้อผิดพลาดจาก Google: ${googleEvents.error}`);
          }
        } else {
          console.error('Expected array of events but got:', googleEvents);
        }
        return;
      }

      // Add missing events to Firestore
      for (const gEvent of googleEvents) {
        const exists = events.find(e => e.googleEventId === gEvent.id);
        if (!exists && auth.currentUser) {
          await addDoc(collection(db, 'calendar_events'), {
            title: gEvent.summary || 'ไม่มีชื่อกิจกรรม',
            start: gEvent.start.dateTime || gEvent.start.date,
            end: gEvent.end?.dateTime || gEvent.end?.date || null,
            allDay: !!gEvent.start.date,
            description: gEvent.description || '',
            category: 'งานทั่วไป',
            color: '#3b82f6',
            googleEventId: gEvent.id,
            userId: auth.currentUser.uid,
            createdAt: new Date().toISOString()
          });
        }
      }
      toast.success('ซิงค์ข้อมูลจาก Google Calendar สำเร็จ!');
    } catch (error) {
      console.error('Error syncing with Google:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDateClick = (arg: any) => {
    setSelectedEvent(null);
    setTitle('');
    setStart(arg.dateStr + (allDay ? '' : 'T08:00'));
    setEnd(arg.dateStr + (allDay ? '' : 'T09:00'));
    setAllDay(true);
    setDescription('');
    setCategory('งานทั่วไป');
    setColor('#3b82f6');
    setIsModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    if (arg.event.extendedProps.isHoliday) {
      toast(`${arg.event.title.replace('🇹🇭 ', '')}\n\n${arg.event.extendedProps.description || ''}`, { icon: '🇹🇭' });
      return;
    }
    if (arg.event.extendedProps.isSalary) {
      toast(`วันเงินเดือนออกข้าราชการครู: ${arg.event.extendedProps.month}\nอ้างอิงข้อมูลจากกรมบัญชีกลาง`, { icon: '💰' });
      return;
    }
    const event = events.find(e => e.id === arg.event.id);
    if (event) {
      setSelectedEvent(event);
      setTitle(event.title);
      setStart(event.start);
      setEnd(event.end || '');
      setAllDay(event.allDay);
      setDescription(event.description || '');
      setCategory(event.category || 'งานทั่วไป');
      setColor(event.color || '#3b82f6');
      setIsModalOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const eventData: any = {
      title,
      start,
      end: end || null,
      allDay,
      description,
      category,
      color,
      userId: auth.currentUser.uid,
      createdAt: selectedEvent ? selectedEvent.createdAt : new Date().toISOString()
    };

    try {
      let gEventId = selectedEvent?.googleEventId;

      // Sync with Google Calendar if connected
      if (googleTokens) {
        const method = selectedEvent?.googleEventId ? 'PUT' : 'POST';
        const url = selectedEvent?.googleEventId 
          ? `/api/calendar/events/${selectedEvent.googleEventId}` 
          : '/api/calendar/events';
        
        const gResponse = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: googleTokens, event: eventData }),
        });
        const gData = await gResponse.json();
        if (gData.id) {
          gEventId = gData.id;
        }
      }

      eventData.googleEventId = gEventId;

      if (selectedEvent && selectedEvent.id) {
        await updateDoc(doc(db, 'calendar_events', selectedEvent.id), eventData);
      } else {
        await addDoc(collection(db, 'calendar_events'), eventData);
      }
      setIsModalOpen(false);
      toast.success('บันทึกข้อมูลแล้ว');
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleDelete = () => {
    if (selectedEvent && selectedEvent.id) {
      setItemToDelete(selectedEvent.id);
      setIsDeleteModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      // Delete from Google Calendar if connected
      if (googleTokens && selectedEvent?.googleEventId) {
        await fetch(`/api/calendar/events/${selectedEvent.googleEventId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokens: googleTokens }),
        });
      }

      await deleteDoc(doc(db, 'calendar_events', itemToDelete));
      setIsDeleteModalOpen(false);
      setIsModalOpen(false);
      setItemToDelete(null);
      toast.success('ลบข้อมูลแล้ว');
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const upcomingEvents = events
    .filter(e => {
      const eventDate = new Date(e.start);
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const currentMonthHolidays = holidays.filter(h => {
    const hDate = new Date(h.date);
    return hDate.getMonth() === currentMonth && hDate.getFullYear() === currentYear;
  });

  const currentMonthSalary = salaryDates.find(s => {
    const sDate = new Date(s.date);
    return sDate.getMonth() === currentMonth && sDate.getFullYear() === currentYear;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider">
            <CalendarIcon size={14} />
            <span>Professional Teacher Schedule</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">ปฏิทินงานครู</h2>
          <p className="text-slate-500 text-lg max-w-2xl">ติดตามภาระงาน วันหยุดราชการ และวันเงินเดือนออกอย่างเป็นระบบ</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          {!googleTokens ? (
            <button
              onClick={handleConnectGoogle}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all font-bold shadow-sm"
            >
              <Smartphone size={20} className="text-slate-400" />
              <span>เชื่อมต่อ Google Calendar</span>
            </button>
          ) : (
            <button
              onClick={syncWithGoogle}
              disabled={isSyncing}
              className={cn(
                "flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white text-blue-600 px-6 py-3 rounded-2xl border border-blue-100 hover:bg-blue-50 transition-all font-bold shadow-sm",
                isSyncing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw size={20} className={cn(isSyncing && "animate-spin")} />
              <span>{isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูลจากมือถือ'}</span>
            </button>
          )}
          <button
            onClick={() => {
              setSelectedEvent(null);
              setTitle('');
              setStart(new Date().toISOString().split('T')[0]);
              setEnd('');
              setAllDay(true);
              setDescription('');
              setCategory('งานทั่วไป');
              setColor('#3b82f6');
              setIsModalOpen(true);
            }}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl hover:bg-blue-700 transition-all font-bold shadow-xl shadow-blue-200 active:scale-95"
          >
            <Plus size={20} />
            <span>เพิ่มกิจกรรม</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Calendar Section */}
        <div className="xl:col-span-3 bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm overflow-hidden">
          <style>{`
            .fc { font-family: inherit; }
            .fc-toolbar-title { font-weight: 900 !important; color: #0f172a; font-size: 1.5rem !important; }
            .fc-button { border-radius: 1rem !important; font-weight: 700 !important; text-transform: capitalize !important; }
            .fc-button-primary { background-color: #f1f5f9 !important; border-color: #f1f5f9 !important; color: #475569 !important; }
            .fc-button-primary:hover { background-color: #e2e8f0 !important; border-color: #e2e8f0 !important; color: #0f172a !important; }
            .fc-button-active { background-color: #0f172a !important; border-color: #0f172a !important; color: #ffffff !important; }
            .fc-daygrid-day-number { font-weight: 600; color: #64748b; padding: 8px !important; }
            .fc-col-header-cell-cushion { font-weight: 700; color: #0f172a; padding: 12px !important; }
            .fc-event { border-radius: 0.5rem !important; border: none !important; padding: 2px 4px !important; font-weight: 600 !important; cursor: pointer !important; }
            .fc-day-today { background-color: #f8fafc !important; }
            
            /* Weekend Styling */
            .fc-day-sat, .fc-day-sun { background-color: #fff7ed !important; }
            .fc-day-sat .fc-daygrid-day-number, .fc-day-sun .fc-daygrid-day-number { color: #ea580c !important; }
            
            /* Weekday Styling */
            .fc-day-mon, .fc-day-tue, .fc-day-wed, .fc-day-thu, .fc-day-fri { background-color: #ffffff; }
          `}</style>
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={[
              ...events.map(e => ({
                id: e.id,
                title: e.title,
                start: e.start,
                end: e.end,
                allDay: e.allDay,
                backgroundColor: e.color,
                extendedProps: { ...e }
              })),
              ...holidays.map((h, index) => ({
                id: `holiday-${index}`,
                title: `🇹🇭 ${h.name}`,
                start: h.date,
                allDay: true,
                backgroundColor: '#dc2626',
                display: 'block',
                extendedProps: { isHoliday: true, ...h }
              })),
              ...salaryDates.map((s, index) => ({
                id: `salary-${index}`,
                title: `💰 เงินเดือนออก`,
                start: s.date,
                allDay: true,
                backgroundColor: '#059669',
                display: 'block',
                extendedProps: { isSalary: true, ...s }
              }))
            ]}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            datesSet={(arg) => {
              const year = arg.view.currentStart.getFullYear();
              const month = arg.view.currentStart.getMonth();
              if (year !== currentYear) {
                setCurrentYear(year);
                loadHolidays(year);
              }
              setCurrentMonth(month);
            }}
            locale="th"
            height="auto"
          />
        </div>

        {/* Sidebar Overview Section */}
        <div className="space-y-6">
          {/* Monthly Summary Card */}
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <AlertCircle size={20} />
              </div>
              <h3 className="font-black text-slate-900">สรุปกิจกรรมเดือนนี้</h3>
            </div>

            <div className="space-y-4">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((e, idx) => (
                  <div key={idx} className="group relative pl-4 border-l-2 border-blue-200 hover:border-blue-500 transition-all">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {new Date(e.start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                    </p>
                    <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{e.title}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 italic">ไม่มีกิจกรรมที่บันทึกไว้</p>
              )}
            </div>
          </div>

          {/* Holiday Info Card */}
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <Info size={20} />
              </div>
              <h3 className="font-black text-slate-900">วันหยุดและวันสำคัญ</h3>
            </div>

            <div className="space-y-4">
              {currentMonthHolidays.length > 0 ? (
                currentMonthHolidays.map((h, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-red-600">
                        {new Date(h.date).getDate()}
                      </span>
                      <p className="text-sm font-bold text-slate-800">{h.name}</p>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed pl-6">{h.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 italic">ไม่มีวันหยุดราชการในเดือนนี้</p>
              )}
            </div>
          </div>

          {/* Salary Info Card */}
          {currentMonthSalary && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-emerald-600 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-100 relative overflow-hidden"
            >
              <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                <Banknote size={120} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote size={20} />
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80">Salary Day</span>
                </div>
                <h4 className="text-2xl font-black mb-1">วันเงินเดือนออก</h4>
                <p className="text-emerald-100 text-sm font-medium mb-4">อ้างอิงกรมบัญชีกลาง</p>
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-4 inline-block">
                  <p className="text-3xl font-black">
                    {new Date(currentMonthSalary.date).getDate()}
                  </p>
                  <p className="text-xs font-bold opacity-90">
                    {currentMonthSalary.month}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Legend Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Tag size={18} className="text-blue-500" />
          <h4 className="font-bold text-slate-900">สัญลักษณ์และหมวดหมู่</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-red-50 border border-red-100">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-xs font-bold text-red-900">วันหยุดราชการ</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
            <span className="text-xs font-bold text-emerald-900">วันเงินเดือนออก</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 border border-orange-100">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs font-bold text-orange-900">เสาร์ - อาทิตย์</span>
          </div>
          {CATEGORIES.filter(c => c.name !== 'วันหยุดราชการ' && c.name !== 'วันเงินเดือนออก').map(cat => (
            <div key={cat.name} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
              <span className="text-xs font-bold text-slate-700">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                    <CalendarIcon size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none">
                      {selectedEvent ? 'แก้ไขกิจกรรม' : 'เพิ่มกิจกรรมใหม่'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">ระบุรายละเอียดกิจกรรมของคุณ</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">ชื่อกิจกรรม *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                    placeholder="เช่น ประชุมสายชั้น, ส่งแผนการสอน"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">เริ่มวันที่ *</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type={allDay ? "date" : "datetime-local"}
                        required
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="w-full border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">สิ้นสุดวันที่</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type={allDay ? "date" : "datetime-local"}
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="w-full border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="allDay" className="text-sm font-bold text-slate-700">กิจกรรมตลอดทั้งวัน</label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">หมวดหมู่และสี</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.filter(c => c.name !== 'วันหยุดราชการ' && c.name !== 'วันเงินเดือนออก').map((cat) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => {
                          setCategory(cat.name);
                          setColor(cat.color);
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-2",
                          category === cat.name
                            ? "border-transparent text-white shadow-lg"
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        )}
                        style={{ backgroundColor: category === cat.name ? cat.color : 'transparent' }}
                      >
                        <Tag size={12} />
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">รายละเอียด</label>
                  <div className="relative">
                    <AlignLeft className="absolute left-4 top-4 text-slate-400" size={18} />
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium resize-none"
                      placeholder="ระบุรายละเอียดเพิ่มเติม..."
                    ></textarea>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  {selectedEvent && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="p-5 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all"
                    >
                      <Trash2 size={24} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-8 py-5 border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-8 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95"
                  >
                    บันทึกกิจกรรม
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">ลบกิจกรรม?</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">คุณแน่ใจหรือไม่ที่จะลบกิจกรรมนี้ออกจากปฏิทิน?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  ลบข้อมูล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
