import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, setDoc, doc, getDoc, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType, fetchStudentsForUser } from '../lib/firestoreUtils';
import { Student, Attendance, Subject, UserProfile } from '../types';
import { Calendar, Check, X, Clock, AlertCircle, Save, Filter, Milk, Smile, Download, FileText, FileSpreadsheet, XCircle, BookOpen, Search } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { exportToExcel } from '../lib/excelExport';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { setupThaiFont } from '../lib/pdfFont';
import { useAcademicYear } from '../contexts/AcademicYearContext';

export default function AttendanceSystem() {
  const { selectedYear, selectedTerm } = useAcademicYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClassLevel, setSelectedClassLevel] = useState<string>('ทั้งหมด');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState('ป.3/1');
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late' | 'leave'>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  // Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'class' | 'subject'>('subject');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [reportTeacherName, setReportTeacherName] = useState('');

  useEffect(() => {
    fetchUserProfile();
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (isReportModalOpen && userProfile) {
      setReportTeacherName(userProfile.displayName || '');
    }
  }, [isReportModalOpen, userProfile]);

  useEffect(() => {
    fetchStudents();
    fetchAttendance();
  }, [selectedClass, selectedDate, selectedSubject, selectedPeriod]);

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    }
  };

  const fetchSubjects = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const q = query(
        collection(db, 'subjects'), 
        where('teacherId', '==', user.uid),
        where('academicYear', '==', selectedYear)
      );
      const querySnapshot = await getDocs(q);
      const subjectList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      setSubjects(subjectList);
      if (subjectList.length > 0) {
        setSelectedSubject(subjectList[0].id);
        setSelectedClass(subjectList[0].classId);
      } else {
        setSelectedSubject('');
        setSelectedClass('');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    }
  };

  const fetchStudents = async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const studentList = await fetchStudentsForUser();
      const filteredList = studentList
        .filter(s => (s.yearClasses?.[selectedYear] || s.classId) === selectedClass)
        .sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0));
      setStudents(filteredList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    if (!selectedSubject) return;
    try {
      const q = query(
        collection(db, 'attendance'), 
        where('classId', '==', selectedClass),
        where('date', '==', selectedDate),
        where('subjectId', '==', selectedSubject),
        where('period', '==', selectedPeriod),
        where('academicYear', '==', selectedYear),
        where('term', '==', selectedTerm)
      );
      const querySnapshot = await getDocs(q);
      const records: any = {};
      querySnapshot.docs.forEach(doc => {
        const data = doc.data();
        records[data.studentId] = data.status;
      });
      setAttendance(records);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    }
  };

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'leave') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const clearAttendance = async () => {
    console.log("Clear attendance button clicked.");
    // if (!confirm(`คุณต้องการล้างข้อมูลการเช็คชื่อของวันที่ ${selectedDate} สำหรับวิชานี้ใช่หรือไม่?`)) return;
    
    setSaving(true);
    try {
      // 1. Delete attendance records
      const q = query(
        collection(db, 'attendance'), 
        where('classId', '==', selectedClass),
        where('date', '==', selectedDate),
        where('subjectId', '==', selectedSubject),
        where('period', '==', selectedPeriod),
        where('academicYear', '==', selectedYear),
        where('term', '==', selectedTerm)
      );
      const querySnapshot = await getDocs(q);
      console.log(`Found ${querySnapshot.size} attendance records to delete.`);
      const batch = writeBatch(db);
      querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // 2. Clear milk/brushing records for this date and class
      const qMilk = query(
        collection(db, 'milkBrushing'),
        where('classId', '==', selectedClass),
        where('date', '==', selectedDate),
        where('academicYear', '==', selectedYear),
        where('term', '==', selectedTerm)
      );
      const milkSnapshot = await getDocs(qMilk);
      console.log(`Found ${milkSnapshot.size} milk/brushing records to delete.`);
      const milkBatch = writeBatch(db);
      milkSnapshot.docs.forEach(doc => milkBatch.delete(doc.ref));
      await milkBatch.commit();

      setAttendance({});
      toast.success('ล้างข้อมูลเรียบร้อยแล้ว!');
    } catch (error) {
      console.error("Error clearing attendance: ", error);
      toast.error('เกิดข้อผิดพลาดในการล้างข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const saveAttendance = async () => {
    if (!selectedSubject) {
      toast.error('กรุณาเลือกรายวิชา');
      return;
    }
    setSaving(true);
    try {
      for (const studentId of Object.keys(attendance)) {
        const status = attendance[studentId];
        const recordId = `${selectedDate}_${selectedSubject}_${selectedPeriod}_${studentId}`;
        
        await setDoc(doc(db, 'attendance', recordId), {
          date: selectedDate,
          studentId,
          status,
          classId: selectedClass,
          subjectId: selectedSubject,
          period: selectedPeriod,
          academicYear: selectedYear,
          term: selectedTerm,
          teacherId: auth.currentUser?.uid,
          updatedAt: serverTimestamp()
        });

        // Auto-link for all classes to Milk and Brushing
        await setDoc(doc(db, 'milkBrushing', `${selectedDate}_${studentId}_milk`), {
          date: selectedDate,
          studentId,
          type: 'milk',
          status: status === 'present',
          classId: selectedClass,
          academicYear: selectedYear,
          term: selectedTerm,
          teacherId: auth.currentUser?.uid,
          updatedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'milkBrushing', `${selectedDate}_${studentId}_brushing`), {
          date: selectedDate,
          studentId,
          type: 'brushing',
          status: status === 'present',
          classId: selectedClass,
          academicYear: selectedYear,
          term: selectedTerm,
          teacherId: auth.currentUser?.uid,
          updatedAt: serverTimestamp()
        });
      }
      toast.success('บันทึกข้อมูลแล้ว');
    } catch (error) {
      console.error("Error saving attendance: ", error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const generateReport = async () => {
    const subject = subjects.find(s => s.id === selectedSubject);
    const subjectName = subject?.name || 'ไม่ระบุ';
    const teacherName = userProfile?.displayName || 'ไม่ระบุ';
    
    // Fetch all attendance records for this subject/class
    const q = query(
      collection(db, 'attendance'), 
      where('classId', '==', selectedClass),
      where('subjectId', '==', selectedSubject),
      where('academicYear', '==', selectedYear),
      where('term', '==', selectedTerm)
    );
    const querySnapshot = await getDocs(q);
    const allRecords: any = {};
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!allRecords[data.date]) allRecords[data.date] = {};
      allRecords[data.date][data.studentId] = data.status;
    });

    const dates = Object.keys(allRecords).sort();
    
    if (reportFormat === 'excel') {
      const headers = ['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', ...dates];
      const data = students.map(s => [
        s.studentNumber || '-',
        s.studentId,
        `${s.prefix || ''}${s.firstName} ${s.lastName}`,
        ...dates.map(date => {
          const status = allRecords[date][s.id];
          return status === 'present' ? 'มา' : 
                 status === 'absent' ? 'ขาด' :
                 status === 'late' ? 'สาย' :
                 status === 'leave' ? 'ลา' : '-';
        })
      ]);

      await exportToExcel(
        `รายงานการเช็คชื่อ/เวลาเรียนทั้งหมด (${reportType === 'class' ? 'ครูประจำชั้น' : 'ครูประจำรายวิชา'})`,
        `วิชา: ${subjectName} | ชั้น: ${selectedClass}`,
        headers,
        data,
        `Attendance_Report_All.xlsx`,
        [
          `ลงชื่อ......................................................`,
          `( ${reportTeacherName} )`,
          `ตำแหน่ง ${reportType === 'class' ? 'ครูประจำชั้น' : 'ครูประจำรายวิชา'}`
        ]
      );
    } else {
      const doc = new jsPDF();
      await setupThaiFont(doc);
      
      doc.setFont('Sarabun', 'bold');
      doc.setFontSize(16);
      doc.text(`รายงานการเช็คชื่อ/เวลาเรียนทั้งหมด (${reportType === 'class' ? 'ครูประจำชั้น' : 'ครูประจำรายวิชา'})`, 105, 15, { align: 'center' });
      
      doc.setFont('Sarabun', 'normal');
      doc.setFontSize(12);
      doc.text(`วิชา: ${subjectName} | ชั้น: ${selectedClass}`, 105, 25, { align: 'center' });

      autoTable(doc, {
        startY: 40,
        head: [['เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', ...dates]],
        body: students.map(s => [
          s.studentNumber || '-',
          s.studentId,
          `${s.prefix || ''}${s.firstName} ${s.lastName}`,
          ...dates.map(date => {
            const status = allRecords[date][s.id];
            return status === 'present' ? 'มา' : 
                   status === 'absent' ? 'ขาด' :
                   status === 'late' ? 'สาย' :
                   status === 'leave' ? 'ลา' : '-';
          })
        ]),
        theme: 'grid',
        styles: { font: 'Sarabun', fontSize: 12 },
        headStyles: { fillColor: [37, 99, 235], font: 'Sarabun', fontStyle: 'bold' },
        bodyStyles: { font: 'Sarabun', fontStyle: 'normal' },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      const rightX = 140;
      doc.text(`ลงชื่อ......................................................`, rightX, finalY);
      doc.text(`( ${reportTeacherName} )`, rightX + 10, finalY + 10);
      doc.text(`ตำแหน่ง ${reportType === 'class' ? 'ครูประจำชั้น' : 'ครูประจำรายวิชา'}`, rightX + 12, finalY + 17);

      doc.save(`Attendance_Report_All.pdf`);
    }
    setIsReportModalOpen(false);
  };

  const stats = {
    present: Object.values(attendance).filter(v => v === 'present').length,
    absent: Object.values(attendance).filter(v => v === 'absent').length,
    late: Object.values(attendance).filter(v => v === 'late').length,
    leave: Object.values(attendance).filter(v => v === 'leave').length,
  };

  const filteredSubjects = selectedClassLevel === 'ทั้งหมด' 
    ? subjects 
    : subjects.filter(s => s.classId.startsWith(selectedClassLevel));

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Filter size={16} className="text-blue-600" />
            ระดับชั้น
          </label>
          <select 
            value={selectedClassLevel}
            onChange={(e) => {
              setSelectedClassLevel(e.target.value);
              setSelectedSubject('');
            }}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            <option value="ทั้งหมด">ทั้งหมด</option>
            {['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'].map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <BookOpen size={16} className="text-blue-600" />
            วิชา
          </label>
          <select 
            value={selectedSubject}
            onChange={(e) => {
              const sub = subjects.find(s => s.id === e.target.value);
              setSelectedSubject(e.target.value);
              if (sub) setSelectedClass(sub.classId);
            }}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            <option value="">เลือกวิชา</option>
            {filteredSubjects.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.classId})</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Clock size={16} className="text-blue-600" />
            คาบที่
          </label>
          <select 
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(Number(e.target.value))}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(p => (
              <option key={p} value={p}>คาบที่ {p}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Calendar size={16} className="text-blue-600" />
            วันที่
          </label>
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={saveAttendance}
            disabled={saving || !selectedSubject}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'บันทึก...' : 'บันทึก'}
          </button>
          <button 
            onClick={clearAttendance}
            disabled={saving || !selectedSubject}
            className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <XCircle size={18} />
            ล้างข้อมูล
          </button>
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Download size={18} />
            รายงาน
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
          <p className="text-xs font-bold text-blue-600 uppercase">มาเรียน</p>
          <p className="text-2xl font-bold text-blue-800">{stats.present}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
          <p className="text-xs font-bold text-red-600 uppercase">ขาดเรียน</p>
          <p className="text-2xl font-bold text-red-800">{stats.absent}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
          <p className="text-xs font-bold text-amber-600 uppercase">มาสาย</p>
          <p className="text-2xl font-bold text-amber-800">{stats.late}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold text-slate-600 uppercase">ลา</p>
          <p className="text-2xl font-bold text-slate-800">{stats.leave}</p>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="ค้นหารายชื่อนักเรียน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-20">เลขที่</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">รหัส</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">
                  สถานะการมาเรียน
                  <button 
                    onClick={() => {
                      const allPresent = students.reduce((acc, s) => ({ ...acc, [s.id]: 'present' }), {});
                      setAttendance(allPresent);
                    }}
                    className="block w-full mt-2 text-[10px] bg-blue-100 text-blue-700 hover:bg-blue-200 py-1 px-2 rounded-lg transition-all"
                  >
                    มาเรียนทั้งหมด
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : students.filter(s => `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">ไม่พบรายชื่อนักเรียนที่ค้นหา</td></tr>
              ) : students.filter(s => `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(searchQuery.toLowerCase())).map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-4 text-sm font-bold text-slate-400">{student.studentNumber || '-'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-500">{student.studentId}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800">{student.prefix || ''}{student.firstName} {student.lastName}</span>
                      {selectedClass.startsWith('ป.3') && selectedPeriod === 1 && (
                        <div className="flex gap-1">
                          <Milk size={14} className="text-blue-400" />
                          <Smile size={14} className="text-green-400" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <StatusButton 
                        active={attendance[student.id] === 'present'} 
                        onClick={() => handleStatusChange(student.id, 'present')}
                        color="blue"
                        label="มา"
                        icon={Check}
                      />
                      <StatusButton 
                        active={attendance[student.id] === 'absent'} 
                        onClick={() => handleStatusChange(student.id, 'absent')}
                        color="red"
                        label="ขาด"
                        icon={X}
                      />
                      <StatusButton 
                        active={attendance[student.id] === 'late'} 
                        onClick={() => handleStatusChange(student.id, 'late')}
                        color="amber"
                        label="สาย"
                        icon={Clock}
                      />
                      <StatusButton 
                        active={attendance[student.id] === 'leave'} 
                        onClick={() => handleStatusChange(student.id, 'leave')}
                        color="slate"
                        label="ลา"
                        icon={AlertCircle}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">ดาวน์โหลดรายงาน</h3>
                <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">รูปแบบรายงาน</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setReportType('subject')}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all text-left",
                        reportType === 'subject' ? "border-blue-600 bg-blue-50" : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <p className={cn("font-bold text-sm", reportType === 'subject' ? "text-blue-600" : "text-slate-600")}>ครูประจำรายวิชา</p>
                      <p className="text-xs text-slate-400 mt-1">รายงานตามวิชาที่สอน</p>
                    </button>
                    <button 
                      onClick={() => setReportType('class')}
                      className={cn(
                        "p-4 rounded-2xl border-2 transition-all text-left",
                        reportType === 'class' ? "border-blue-600 bg-blue-50" : "border-slate-100 hover:border-slate-200"
                      )}
                    >
                      <p className={cn("font-bold text-sm", reportType === 'class' ? "text-blue-600" : "text-slate-600")}>ครูประจำชั้น</p>
                      <p className="text-xs text-slate-400 mt-1">รายงานภาพรวมห้องเรียน</p>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">ชื่อครูผู้รายงาน</label>
                  <input 
                    type="text"
                    value={reportTeacherName}
                    onChange={(e) => setReportTeacherName(e.target.value)}
                    placeholder="กรอกชื่อ-นามสกุล"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700">นามสกุลไฟล์</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setReportFormat('pdf')}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                        reportFormat === 'pdf' ? "border-red-600 bg-red-50 text-red-600" : "border-slate-100 text-slate-600"
                      )}
                    >
                      <FileText size={20} />
                      <span className="font-bold text-sm">PDF</span>
                    </button>
                    <button 
                      onClick={() => setReportFormat('excel')}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border-2 transition-all",
                        reportFormat === 'excel' ? "border-green-600 bg-green-50 text-green-600" : "border-slate-100 text-slate-600"
                      )}
                    >
                      <FileSpreadsheet size={20} />
                      <span className="font-bold text-sm">Excel</span>
                    </button>
                  </div>
                </div>

                <button 
                  onClick={generateReport}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  <Download size={20} />
                  สร้างรายงาน
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusButton({ active, onClick, color, label, icon: Icon }: any) {
  const colors: any = {
    blue: active ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-400 hover:bg-blue-100",
    red: active ? "bg-red-600 text-white" : "bg-red-50 text-red-400 hover:bg-red-100",
    amber: active ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-400 hover:bg-amber-100",
    slate: active ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200",
  };

  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
        colors[color]
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}
