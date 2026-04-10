import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, setDoc, doc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { Student, UserProfile } from '../types';
import { Scale, Save, Filter, TrendingUp, TrendingDown, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { exportToExcel } from '../lib/excelExport';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { setupThaiFont } from '../lib/pdfFont';

import { fetchStudentsForUser } from '../lib/firestoreUtils';

export default function HealthSystem() {
  const { selectedYear: academicYear, selectedTerm } = useAcademicYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedClass, setSelectedClass] = useState('ป.3/1');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [healthData, setHealthData] = useState<Record<string, { weight: number; height: number }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');

  useEffect(() => {
    fetchUserProfile();
    fetchStudents();
  }, [selectedClass, academicYear]);

  useEffect(() => {
    fetchHealthData();
  }, [selectedClass, selectedMonth, selectedYear, academicYear, selectedTerm]);

  const fetchUserProfile = async () => {
    const user = auth.currentUser;
    if (user) {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const studentList = await fetchStudentsForUser();
      const filteredList = studentList
        .filter(s => (s.yearClasses?.[academicYear] || s.classId) === selectedClass)
        .sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0));
      setStudents(filteredList);
    } catch (error) {
      console.error("Error fetching students: ", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthData = async () => {
    try {
      const q = query(
        collection(db, 'healthRecords'),
        where('classId', '==', selectedClass),
        where('month', '==', selectedMonth),
        where('year', '==', selectedYear),
        where('academicYear', '==', academicYear),
        where('term', '==', selectedTerm)
      );
      const querySnapshot = await getDocs(q);
      const data: any = {};
      querySnapshot.docs.forEach(doc => {
        const record = doc.data();
        data[record.studentId] = { weight: record.weight, height: record.height };
      });
      setHealthData(data);
    } catch (error) {
      console.error("Error fetching health data: ", error);
    }
  };

  const handleHealthChange = (studentId: string, field: 'weight' | 'height', value: number) => {
    setHealthData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId] || { weight: 0, height: 0 }, [field]: value }
    }));
  };

  const saveHealthData = async () => {
    setSaving(true);
    try {
      for (const studentId of students.map(s => s.id)) {
        const { weight, height } = healthData[studentId] || { weight: 0, height: 0 };
        const recordId = `${selectedYear}_${selectedMonth}_${studentId}`;
        
        await setDoc(doc(db, 'healthRecords', recordId), {
          studentId,
          month: selectedMonth,
          year: selectedYear,
          weight,
          height,
          classId: selectedClass,
          academicYear: academicYear,
          term: selectedTerm,
          teacherId: auth.currentUser?.uid,
          updatedAt: serverTimestamp()
        });
      }
      toast.success('บันทึกข้อมูลแล้ว');
    } catch (error) {
      console.error("Error saving health data: ", error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const generateReport = async () => {
    const teacherName = userProfile?.displayName || 'ไม่ระบุ';
    
    // Fetch data for the selected month/year
    let records = [];
    if (selectedMonth === 0) { // Assuming 0 means 'all'
      const q = query(
        collection(db, 'healthRecords'), 
        where('classId', '==', selectedClass),
        where('academicYear', '==', academicYear),
        where('term', '==', selectedTerm)
      );
      const snapshot = await getDocs(q);
      records = snapshot.docs.map(d => d.data());
    } else {
      const q = query(
        collection(db, 'healthRecords'),
        where('classId', '==', selectedClass),
        where('month', '==', selectedMonth),
        where('year', '==', selectedYear),
        where('academicYear', '==', academicYear),
        where('term', '==', selectedTerm)
      );
      const snapshot = await getDocs(q);
      records = snapshot.docs.map(d => d.data());
    }

    const reportData = students.map(s => {
      const record = records.find((r: any) => r.studentId === s.id);
      const weight = record?.weight || 0;
      const height = record?.height || 0;
      const bmi = weight && height ? (weight / ((height / 100) ** 2)).toFixed(1) : '-';
      
      return {
        'เลขที่': s.studentNumber || '-',
        'รหัส': s.studentId,
        'ชื่อ-นามสกุล': `${s.prefix || ''}${s.firstName} ${s.lastName}`,
        'น้ำหนัก (กก.)': weight || '-',
        'ส่วนสูง (ซม.)': height || '-',
        'BMI': bmi
      };
    });

    if (reportFormat === 'excel') {
      const headers = ['เลขที่', 'รหัส', 'ชื่อ-นามสกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI'];
      const data = reportData.map(r => [
        r['เลขที่'],
        r['รหัส'],
        r['ชื่อ-นามสกุล'],
        r['น้ำหนัก (กก.)'],
        r['ส่วนสูง (ซม.)'],
        r['BMI']
      ]);

      await exportToExcel(
        `รายงานข้อมูลน้ำหนักและส่วนสูง ชั้น ${selectedClass} ${selectedMonth !== 0 ? `เดือน ${['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][selectedMonth - 1]} ${selectedYear + 543}` : 'ทั้งหมด'}`,
        `วันที่: ${new Date().toLocaleDateString('th-TH')}`,
        headers,
        data,
        `Health_Report_${selectedClass}_${selectedMonth !== 0 ? `${selectedMonth}_${selectedYear}` : 'All'}.xlsx`,
        [
          `ลงชื่อ......................................................`,
          `( ${teacherName} )`,
          `ตำแหน่ง ครูประจำชั้น`
        ]
      );
    } else {
      const doc = new jsPDF();
      await setupThaiFont(doc);
      
      doc.setFont('Sarabun', 'bold');
      doc.setFontSize(16);
      doc.text(`รายงานข้อมูลน้ำหนักและส่วนสูง ชั้น ${selectedClass} ${selectedMonth !== 0 ? `(${['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][selectedMonth - 1]} ${selectedYear + 543})` : '(ทั้งหมด)'}`, 105, 15, { align: 'center' });
      
      doc.setFont('Sarabun', 'normal');
      doc.setFontSize(12);
      doc.text(`วันที่: ${new Date().toLocaleDateString('th-TH')}`, 105, 25, { align: 'center' });

      autoTable(doc, {
        startY: 35,
        head: [['เลขที่', 'รหัส', 'ชื่อ-นามสกุล', 'น้ำหนัก (กก.)', 'ส่วนสูง (ซม.)', 'BMI']],
        body: reportData.map(r => [
          r['เลขที่'],
          r['รหัส'],
          r['ชื่อ-นามสกุล'],
          r['น้ำหนัก (กก.)'],
          r['ส่วนสูง (ซม.)'],
          r['BMI']
        ]),
        theme: 'grid',
        styles: { font: 'Sarabun', fontSize: 12 },
        headStyles: { fillColor: [37, 99, 235], font: 'Sarabun', fontStyle: 'bold' },
        bodyStyles: { font: 'Sarabun', fontStyle: 'normal' },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      const rightX = 140;
      doc.text(`ลงชื่อ......................................................`, rightX, finalY);
      doc.text(`( ${teacherName} )`, rightX + 10, finalY + 10);
      doc.text(`ตำแหน่ง ครูประจำชั้น`, rightX + 12, finalY + 17);

      doc.save(`Health_Report_${selectedClass}_${selectedMonth !== 0 ? `${selectedMonth}_${selectedYear}` : 'All'}.pdf`);
    }
    setIsReportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="space-y-2 flex-1">
          <label className="text-sm font-bold text-slate-700">ชั้นเรียน</label>
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
          <label className="text-sm font-bold text-slate-700">เดือน</label>
          <select 
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            <option value={0}>ทั้งหมด</option>
            {['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'].map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 flex-1">
          <label className="text-sm font-bold text-slate-700">ปี</label>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
              <option key={y} value={y}>{y + 543}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Download size={20} />
            รายงาน
          </button>
          <button 
            onClick={saveHealthData}
            disabled={saving}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">เลขที่</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">รหัส</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">น้ำหนัก (กก.)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">ส่วนสูง (ซม.)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">BMI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : students.map((student) => {
                const weight = healthData[student.id!]?.weight || 0;
                const height = healthData[student.id!]?.height || 0;
                const bmi = weight && height ? (weight / ((height / 100) ** 2)).toFixed(1) : '-';
                
                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{student.studentNumber || '-'}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{student.studentId}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-800">{student.prefix || ''}{student.firstName} {student.lastName}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <input 
                          type="number"
                          value={weight || ''}
                          onChange={(e) => handleHealthChange(student.id!, 'weight', Number(e.target.value))}
                          className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <input 
                          type="number"
                          value={height || ''}
                          onChange={(e) => handleHealthChange(student.id!, 'height', Number(e.target.value))}
                          className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        bmi === '-' ? "bg-slate-100 text-slate-400" :
                        Number(bmi) < 18.5 ? "bg-blue-50 text-blue-600" :
                        Number(bmi) < 23 ? "bg-green-50 text-green-600" :
                        Number(bmi) < 25 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                      )}>
                        {bmi}
                      </span>
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <Download className="text-blue-600" />
                ดาวน์โหลดรายงาน
              </h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setReportFormat('pdf')}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                      reportFormat === 'pdf' ? "border-blue-600 bg-blue-50 text-blue-600" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <FileText size={32} />
                    <span className="font-bold">PDF</span>
                  </button>
                  <button 
                    onClick={() => setReportFormat('excel')}
                    className={cn(
                      "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
                      reportFormat === 'excel' ? "border-green-600 bg-green-50 text-green-600" : "border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <FileSpreadsheet size={32} />
                    <span className="font-bold">Excel</span>
                  </button>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsReportModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={generateReport}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                  >
                    ดาวน์โหลด
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
