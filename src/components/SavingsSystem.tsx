import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, addDoc, serverTimestamp, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType, fetchStudentsForUser } from '../lib/firestoreUtils';
import { Student, Saving } from '../types';
import { PiggyBank, Plus, TrendingUp, TrendingDown, History as LucideHistory, Search, Filter, Trash2, XCircle, FileDown, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { setupThaiFont } from '../lib/pdfFont';
import { exportToExcel } from '../lib/excelExport';
import { useAcademicYear } from '../contexts/AcademicYearContext';

export default function SavingsSystem() {
  const { selectedYear, selectedTerm } = useAcademicYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('ป.3/1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [amount, setAmount] = useState<number>(0);
  const [type, setType] = useState<'deposit' | 'withdraw'>('deposit');
  const [records, setRecords] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchStudents();
    fetchRecords();
  }, [selectedYear, selectedTerm]);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchStudents = async () => {
    try {
      const studentList = await fetchStudentsForUser();
      const filteredList = studentList
        .filter(s => !!(s.yearClasses?.[selectedYear] || s.classId));
      setStudents(filteredList);
    } catch (error) {
      console.error("Error fetching students: ", error);
    }
  };

  const filteredStudents = students.filter(s => {
    const studentClass = s.yearClasses?.[selectedYear] || s.classId;
    const matchesClass = selectedClass === 'ทั้งหมด' || studentClass === selectedClass;
    const matchesSearch = `${s.prefix || ''}${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'savings'), 
        where('academicYear', '==', selectedYear),
        where('term', '==', selectedTerm),
        orderBy('date', 'desc')
      );
      const querySnapshot = await getDocs(q);
      setRecords(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Saving)));
    } catch (error) {
      console.error("Error fetching records: ", error);
    } finally {
      setLoading(false);
    }
  };

  const getStudentBalance = (studentId: string) => {
    const studentRecords = records.filter(r => r.studentId === studentId);
    return studentRecords.reduce((acc, r) => r.type === 'deposit' ? acc + r.amount : acc - r.amount, 0);
  };

  const deleteRecord = async (recordId: string) => {
    try {
      await deleteDoc(doc(db, 'savings', recordId));
      setRecords(prev => prev.filter(r => r.id !== recordId));
      setNotification({ message: 'ลบรายการสำเร็จ!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'savings/' + recordId);
    }
    setDeleteConfirm({ isOpen: false, id: null });
  };

  const filteredRecords = records.filter(r => {
    const student = students.find(s => s.id === r.studentId);
    const studentClass = student?.yearClasses?.[selectedYear] || student?.classId;
    const matchesClass = selectedClass === 'ทั้งหมด' || studentClass === selectedClass;
    return matchesClass;
  });

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || amount <= 0) return;
    
    if (type === 'withdraw') {
      const balance = getStudentBalance(selectedStudent);
      if (amount > balance) {
        setNotification({ message: `ยอดเงินคงเหลือไม่เพียงพอ (คงเหลือ: ${balance} บาท)`, type: 'error' });
        return;
      }
    }
    
    setSaving(true);
    try {
      await addDoc(collection(db, 'savings'), {
        studentId: selectedStudent,
        amount,
        type,
        date: new Date().toISOString(),
        academicYear: selectedYear,
        term: selectedTerm,
        teacherId: auth.currentUser?.uid,
        createdAt: serverTimestamp()
      });
      setAmount(0);
      fetchRecords();
      setNotification({ message: 'บันทึกรายการสำเร็จ!', type: 'success' });
    } catch (error) {
      console.error("Error saving transaction: ", error);
      handleFirestoreError(error, OperationType.WRITE, 'savings');
    } finally {
      setSaving(false);
    }
  };

  const getStudentName = (id: string) => {
    const s = students.find(s => s.id === id);
    return s ? `${s.prefix || ''}${s.firstName} ${s.lastName}` : 'ไม่ทราบชื่อ';
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    await setupThaiFont(doc);
    
    const title = `รายงานการออมทรัพย์นักเรียน ชั้น ${selectedClass}`;
    const subtitle = `โรงเรียนบ้านแม่ตาวแพะ | ข้อมูล ณ วันที่ ${format(new Date(), 'dd MMMM yyyy', { locale: th })}`;
    
    doc.setFontSize(18);
    doc.text(title, 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text(subtitle, 105, 22, { align: 'center' });

    const tableData = filteredStudents.map((s, index) => {
      const studentRecords = records.filter(r => r.studentId === s.id);
      const deposits = studentRecords.filter(r => r.type === 'deposit').reduce((sum, r) => sum + r.amount, 0);
      const withdrawals = studentRecords.filter(r => r.type === 'withdraw').reduce((sum, r) => sum + r.amount, 0);
      const balance = deposits - withdrawals;
      
      return [
        index + 1,
        s.studentId,
        `${s.prefix || ''}${s.firstName} ${s.lastName}`,
        deposits.toLocaleString(),
        withdrawals.toLocaleString(),
        balance.toLocaleString()
      ];
    });

    autoTable(doc, {
      startY: 30,
      head: [['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'ยอดฝากสะสม', 'ยอดถอนสะสม', 'ยอดคงเหลือ']],
      body: tableData,
      styles: { font: 'Sarabun', fontSize: 10 },
      headStyles: { fillColor: [37, 99, 235], halign: 'center' },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
      },
    });

    doc.save(`รายงานการออมทรัพย์_${selectedClass}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  const handleExportExcel = async () => {
    const title = `รายงานการออมทรัพย์นักเรียน ชั้น ${selectedClass}`;
    const subtitle = `โรงเรียนบ้านแม่ตาวแพะ | ข้อมูล ณ วันที่ ${format(new Date(), 'dd MMMM yyyy', { locale: th })}`;
    const headers = ['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-นามสกุล', 'ยอดฝากสะสม (บาท)', 'ยอดถอนสะสม (บาท)', 'ยอดคงเหลือ (บาท)'];
    
    const tableData = filteredStudents.map((s, index) => {
      const studentRecords = records.filter(r => r.studentId === s.id);
      const deposits = studentRecords.filter(r => r.type === 'deposit').reduce((sum, r) => sum + r.amount, 0);
      const withdrawals = studentRecords.filter(r => r.type === 'withdraw').reduce((sum, r) => sum + r.amount, 0);
      const balance = deposits - withdrawals;
      
      return [
        index + 1,
        s.studentId,
        `${s.prefix || ''}${s.firstName} ${s.lastName}`,
        deposits,
        withdrawals,
        balance
      ];
    });

    await exportToExcel(
      title,
      subtitle,
      headers,
      tableData,
      `รายงานการออมทรัพย์_${selectedClass}_${format(new Date(), 'yyyyMMdd')}.xlsx`
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Transaction Form */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-6 text-blue-600">
            <PiggyBank size={24} />
            <h3 className="font-bold text-slate-800">บันทึกการออม</h3>
          </div>
          <form onSubmit={handleTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Filter size={14} className="text-blue-600" />
                  ชั้นเรียน
                </label>
                <select 
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedStudent('');
                  }}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                >
                  <option value="ทั้งหมด">ทั้งหมด</option>
                  {['ป.1/1', 'ป.2/1', 'ป.3/1', 'ป.4/1', 'ป.5/1', 'ป.6/1'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Search size={14} className="text-blue-600" />
                  ค้นหาชื่อ
                </label>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ชื่อ/รหัส..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">เลือกนักเรียน</label>
              <select 
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                required
              >
                <option value="">-- เลือกนักเรียน --</option>
                {filteredStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.studentId} - {s.prefix || ''}{s.firstName} {s.lastName} (คงเหลือ: {getStudentBalance(s.id)} บาท)
                  </option>
                ))}
              </select>
              {filteredStudents.length === 0 && searchQuery && (
                <p className="text-xs text-red-500 mt-1">ไม่พบนักเรียนที่ค้นหา</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">ประเภท</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('deposit')}
                  className={cn(
                    "py-2.5 rounded-xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                    type === 'deposit' ? "border-green-600 bg-green-50 text-green-600" : "border-slate-100 text-slate-400"
                  )}
                >
                  <TrendingUp size={18} />
                  ฝากเงิน
                </button>
                <button
                  type="button"
                  onClick={() => setType('withdraw')}
                  className={cn(
                    "py-2.5 rounded-xl border-2 transition-all font-bold flex items-center justify-center gap-2",
                    type === 'withdraw' ? "border-red-600 bg-red-50 text-red-600" : "border-slate-100 text-slate-400"
                  )}
                >
                  <TrendingDown size={18} />
                  ถอนเงิน
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">จำนวนเงิน (บาท)</label>
              <input 
                type="number"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-xl text-center"
                placeholder="0.00"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={saving}
              className={cn(
                "w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50",
                type === 'deposit' ? "bg-green-600 hover:bg-green-700 shadow-green-100" : "bg-red-600 hover:bg-red-700 shadow-red-100"
              )}
            >
              <Plus size={20} />
              {saving ? 'กำลังบันทึก...' : 'ยืนยันรายการ'}
            </button>
          </form>
        </div>
      </div>

      {/* History Table */}
      <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 text-slate-800">
            <LucideHistory size={24} className="text-blue-600" />
            <h3 className="font-bold">ประวัติการทำรายการ</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all border border-red-100"
            >
              <FileDown size={18} />
              PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-sm hover:bg-green-100 transition-all border border-green-100"
            >
              <FileSpreadsheet size={18} />
              Excel
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">วันที่</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">นักเรียน</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ประเภท</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">จำนวนเงิน</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">ไม่พบประวัติการทำรายการ</td></tr>
              ) : filteredRecords.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {record.date && !isNaN(new Date(record.date).getTime()) ? format(new Date(record.date), 'dd MMM yy', { locale: th }) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-bold text-slate-800">{getStudentName(record.studentId)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase",
                      record.type === 'deposit' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {record.type === 'deposit' ? 'ฝาก' : 'ถอน'}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 py-4 text-sm font-bold text-right",
                    record.type === 'deposit' ? "text-green-600" : "text-red-600"
                  )}>
                    {record.type === 'deposit' ? '+' : '-'}{record.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setDeleteConfirm({ isOpen: true, id: record.id! })}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ยืนยันการลบ</h3>
              <p className="text-slate-500 mb-6">คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm({ isOpen: false, id: null })}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => deleteConfirm.id && deleteRecord(deleteConfirm.id)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all"
                >
                  ลบข้อมูล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl z-[70] flex items-center gap-3 border",
              notification.type === 'success' ? "bg-white border-green-100 text-green-600" : "bg-white border-red-100 text-red-600"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              notification.type === 'success' ? "bg-green-50" : "bg-red-50"
            )}>
              {notification.type === 'success' ? <Plus size={18} /> : <XCircle size={18} />}
            </div>
            <span className="font-bold text-slate-800">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
