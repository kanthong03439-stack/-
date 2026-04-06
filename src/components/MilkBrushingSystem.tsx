import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, setDoc, doc, serverTimestamp, orderBy, limit, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Student, MilkBrushingRecord, Attendance, UserProfile } from '../types';
import { Milk, Smile, Save, Calendar, Filter, CheckCircle2, XCircle, Download, FileText, FileSpreadsheet, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, toDate } from '../lib/utils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MilkBrushingSystem() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('ป.3/1');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [records, setRecords] = useState<Record<string, { milk: boolean; brushing: boolean; isSubstitution?: boolean; substitutedForId?: string; substitutionIndex?: number }>>({});
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchAttendance();
    fetchRecords();
  }, [selectedClass, selectedDate]);

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'students'), where('classId', '==', selectedClass));
      const querySnapshot = await getDocs(q);
      const studentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student))
        .sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0));
      setStudents(studentList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'students');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      const q = query(
        collection(db, 'attendance'),
        where('classId', '==', selectedClass),
        where('date', '==', selectedDate)
      );
      const querySnapshot = await getDocs(q);
      const data: any = {};
      querySnapshot.docs.forEach(doc => {
        const record = doc.data();
        data[record.studentId] = record.status;
      });
      setAttendance(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    }
  };

  const fetchRecords = async () => {
    try {
      const q = query(
        collection(db, 'milkBrushing'), 
        where('classId', '==', selectedClass),
        where('date', '==', selectedDate)
      );
      const querySnapshot = await getDocs(q);
      const data: any = {};
      querySnapshot.docs.forEach(doc => {
        const record = doc.data();
        if (!data[record.studentId]) data[record.studentId] = { milk: false, brushing: false };
        if (record.type === 'milk') {
          data[record.studentId].milk = record.status;
          data[record.studentId].isSubstitution = record.isSubstitution;
          data[record.studentId].substitutedForId = record.substitutedForId;
        } else {
          data[record.studentId].brushing = record.status;
        }
      });
      setRecords(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'milkBrushing');
    }
  };

  const autoAssignSubstitutions = async () => {
    if (students.length === 0) return;

    // 1. Identify absentees (absent or leave)
    const absentees = students.filter(s => attendance[s.id] === 'absent' || attendance[s.id] === 'leave');
    if (absentees.length === 0) {
      alert('ไม่มีนักเรียนขาดเรียนในวันนี้');
      return;
    }

    // 2. Find last substitution index
    let lastIndex = 0;
    try {
      const q = query(
        collection(db, 'milkBrushing'),
        where('classId', '==', selectedClass),
        where('type', '==', 'milk'),
        where('isSubstitution', '==', true),
        where('date', '<', selectedDate),
        orderBy('date', 'desc'),
        orderBy('substitutionIndex', 'desc'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        lastIndex = querySnapshot.docs[0].data().substitutionIndex || 0;
      }
    } catch (error) {
      console.error("Error fetching last substitution index:", error);
    }

    // 3. Assign absentees to present students
    const presentStudents = students.filter(s => attendance[s.id] === 'present' || !attendance[s.id]);
    if (presentStudents.length === 0) return;

    const newRecords = { ...records };
    let currentIndex = lastIndex;

    absentees.forEach((absentee) => {
      currentIndex++;
      // Wrap around if we exceed student count
      const substituteIdx = (currentIndex - 1) % presentStudents.length;
      const substitute = presentStudents[substituteIdx];

      if (!newRecords[substitute.id]) newRecords[substitute.id] = { milk: true, brushing: false };
      newRecords[substitute.id].milk = true;
      newRecords[substitute.id].isSubstitution = true;
      newRecords[substitute.id].substitutedForId = absentee.id;
      newRecords[substitute.id].substitutionIndex = currentIndex;

      // Mark absentee as not drinking
      if (!newRecords[absentee.id]) newRecords[absentee.id] = { milk: false, brushing: false };
      newRecords[absentee.id].milk = false;
    });

    setRecords(newRecords);
    alert(`มอบหมายการดื่มนมแทนให้ ${absentees.length} คน เรียบร้อยแล้ว`);
  };

  const toggleStatus = (studentId: string, type: 'milk' | 'brushing') => {
    setRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId] || { milk: false, brushing: false },
        [type]: !prev[studentId]?.[type]
      }
    }));
  };

  const saveRecords = async () => {
    setSaving(true);
    try {
      for (const studentId of students.map(s => s.id)) {
        const record = records[studentId] || { milk: false, brushing: false };
        
        await setDoc(doc(db, 'milkBrushing', `${selectedDate}_${studentId}_milk`), {
          date: selectedDate,
          studentId,
          type: 'milk',
          status: record.milk,
          classId: selectedClass,
          isSubstitution: record.isSubstitution || false,
          substitutedForId: record.substitutedForId || null,
          substitutionIndex: (record as any).substitutionIndex || null,
          updatedAt: serverTimestamp()
        });
        
        await setDoc(doc(db, 'milkBrushing', `${selectedDate}_${studentId}_brushing`), {
          date: selectedDate,
          studentId,
          type: 'brushing',
          status: record.brushing,
          classId: selectedClass,
          updatedAt: serverTimestamp()
        });
      }
      alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
    } catch (error) {
      console.error("Error saving records: ", error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const generateReport = () => {
    const dateStr = format(toDate(selectedDate), 'd MMMM yyyy', { locale: th });
    const teacherName = userProfile?.displayName || 'ไม่ระบุ';

    const reportData = students.map(s => {
      const record = records[s.id] || { milk: false, brushing: false };
      const substitutedFor = record.substitutedForId ? students.find(st => st.id === record.substitutedForId) : null;
      
      return {
        'เลขที่': s.studentNumber || '-',
        'รหัสนักเรียน': s.studentId,
        'ชื่อ-นามสกุล': `${s.firstName} ${s.lastName}`,
        'การดื่มนม': record.milk ? (record.isSubstitution ? 'ดื่มปกติ + ดื่มแทน' : 'ดื่มปกติ') : 'ไม่ได้ดื่ม',
        'ดื่มแทนใคร': substitutedFor ? `${substitutedFor.firstName} ${substitutedFor.lastName}` : '-',
        'การแปรงฟัน': record.brushing ? 'แปรงฟัน' : 'ไม่ได้แปรง'
      };
    });

    if (reportFormat === 'excel') {
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "MilkBrushing");
      
      XLSX.utils.sheet_add_aoa(ws, [
        [`รายงานการดื่มนมและแปรงฟัน ชั้น ${selectedClass}`],
        [`วันที่: ${dateStr}`],
        [],
      ], { origin: "A1" });

      const lastRow = reportData.length + 6;
      XLSX.utils.sheet_add_aoa(ws, [
        [`ลงชื่อ......................................................`],
        [`( ${teacherName} )`],
        [`ตำแหน่ง ครูประจำชั้น`]
      ], { origin: `D${lastRow}` });

      XLSX.writeFile(wb, `Milk_Brushing_Report_${selectedDate}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Milk and Brushing Report - Class ${selectedClass}`, 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Date: ${dateStr}`, 105, 25, { align: 'center' });

      autoTable(doc, {
        startY: 35,
        head: [['No.', 'ID', 'Name', 'Milk Status', 'Substitute For', 'Brushing']],
        body: students.map(s => {
          const record = records[s.id] || { milk: false, brushing: false };
          const substitutedFor = record.substitutedForId ? students.find(st => st.id === record.substitutedForId) : null;
          return [
            s.studentNumber || '-',
            s.studentId,
            `${s.firstName} ${s.lastName}`,
            record.milk ? (record.isSubstitution ? 'Normal + Sub' : 'Normal') : 'No',
            substitutedFor ? `${substitutedFor.firstName} ${substitutedFor.lastName}` : '-',
            record.brushing ? 'Yes' : 'No'
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      const rightX = 140;
      doc.text(`ลงชื่อ......................................................`, rightX, finalY);
      doc.text(`( ${teacherName} )`, rightX + 10, finalY + 10);
      doc.text(`ตำแหน่ง ครูประจำชั้น`, rightX + 12, finalY + 17);

      doc.save(`Milk_Brushing_Report_${selectedDate}.pdf`);
    }
    setIsReportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="space-y-2 flex-1">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Filter size={16} className="text-blue-600" />
            ชั้นเรียน
          </label>
          <select 
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            {['ป.1/1', 'ป.2/1', 'ป.3/1', 'ป.4/1', 'ป.5/1', 'ป.6/1'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 flex-1">
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
            onClick={autoAssignSubstitutions}
            className="px-4 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 flex items-center gap-2"
            title="มอบหมายการดื่มนมแทนเพื่อนที่ขาดเรียน"
          >
            <UserPlus size={20} />
            ดื่มนมแทน
          </button>
          <button 
            onClick={saveRecords}
            disabled={saving}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'บันทึก...' : 'บันทึก'}
          </button>
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
          >
            <Download size={20} />
            รายงาน
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase w-20">เลขที่</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">ดื่มนม</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">แปรงฟัน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : students.map((student) => {
                const record = records[student.id!] || { milk: false, brushing: false };
                const substitutedFor = record.substitutedForId ? students.find(s => s.id === record.substitutedForId) : null;
                const isAbsent = attendance[student.id!] === 'absent' || attendance[student.id!] === 'leave';

                return (
                  <tr key={student.id} className={cn("hover:bg-slate-50 transition-all", isAbsent && "bg-red-50/30")}>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{student.studentNumber || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">{student.firstName} {student.lastName}</span>
                        {record.isSubstitution && substitutedFor && (
                          <span className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
                            <UserPlus size={10} />
                            ดื่มแทน: {substitutedFor.firstName} {substitutedFor.lastName}
                          </span>
                        )}
                        {isAbsent && (
                          <span className="text-[10px] font-bold text-red-500 uppercase">ขาดเรียน</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => toggleStatus(student.id!, 'milk')}
                          disabled={isAbsent}
                          className={cn(
                            "p-3 rounded-2xl transition-all relative",
                            record.milk ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-300",
                            isAbsent && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Milk size={24} />
                          {record.isSubstitution && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white">
                              +
                            </div>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button 
                          onClick={() => toggleStatus(student.id!, 'brushing')}
                          disabled={isAbsent}
                          className={cn(
                            "p-3 rounded-2xl transition-all",
                            record.brushing ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-300",
                            isAbsent && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <Smile size={24} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Modal */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">ดาวน์โหลดรายงาน</h3>
                  <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                    <XCircle size={24} className="text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">นามสกุลไฟล์</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => setReportFormat('pdf')}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                          reportFormat === 'pdf' ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 hover:border-slate-200 text-slate-400"
                        )}
                      >
                        <FileText size={24} />
                        <span className="font-bold">PDF</span>
                      </button>
                      <button 
                        onClick={() => setReportFormat('excel')}
                        className={cn(
                          "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                          reportFormat === 'excel' ? "border-green-600 bg-green-50 text-green-600" : "border-slate-100 hover:border-slate-200 text-slate-400"
                        )}
                      >
                        <FileSpreadsheet size={24} />
                        <span className="font-bold">Excel</span>
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={generateReport}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                  >
                    <Download size={20} />
                    สร้างรายงาน
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
