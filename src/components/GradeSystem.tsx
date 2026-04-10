import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, setDoc, doc, serverTimestamp, getDoc, onSnapshot, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';
import { Student, Grade, Subject, UserProfile } from '../types';
import { GraduationCap, Save, Filter, Search, Plus, Trash2, BookOpen, Download, FileText, FileSpreadsheet, CalendarCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType, fetchStudentsForUser } from '../lib/firestoreUtils';
import { exportToExcel } from '../lib/excelExport';
import { setupThaiFont } from '../lib/pdfFont';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function GradeSystem() {
  const { selectedYear, selectedTerm } = useAcademicYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [selectedClassLevel, setSelectedClassLevel] = useState<string>('ทั้งหมด');
  const [selectedClass, setSelectedClass] = useState('ป.3/1');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number | 'all'>(1);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [existingGrades, setExistingGrades] = useState<Grade[]>([]);
  const [maxScore, setMaxScore] = useState(10);
  const [description, setDescription] = useState('คะแนนเก็บครั้งที่ 1');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean, gradeId: string | null }>({ isOpen: false, gradeId: null });
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    fetchUserProfile();
    fetchSubjects();
  }, [selectedClassLevel]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudents();
    }
  }, [selectedClass]);

  useEffect(() => {
    if (!selectedSubject) return;

    let q;
    if (selectedSemester === 'all') {
      q = query(
        collection(db, 'grades'),
        where('subjectId', '==', selectedSubject),
        where('classId', '==', selectedClass),
        where('academicYear', '==', selectedYear)
      );
    } else {
      q = query(
        collection(db, 'grades'),
        where('subjectId', '==', selectedSubject),
        where('classId', '==', selectedClass),
        where('semester', '==', selectedSemester),
        where('academicYear', '==', selectedYear)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const gradeList = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Grade));
      setExistingGrades(gradeList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    });

    return () => unsubscribe();
  }, [selectedSubject, selectedSemester, selectedClass]);

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

  const fetchSubjects = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      let q = query(
        collection(db, 'subjects'), 
        where('teacherId', '==', user.uid),
        where('academicYear', '==', selectedYear)
      );
      const querySnapshot = await getDocs(q);
      let subjectList = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Subject));
      
      if (selectedClassLevel !== 'ทั้งหมด') {
        subjectList = subjectList.filter(s => s.classId.startsWith(selectedClassLevel));
      }

      setSubjects(subjectList);
      if (subjectList.length > 0 && !selectedSubject) {
        setSelectedSubject(subjectList[0].id);
        setSelectedClass(subjectList[0].classId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    }
  };

  const fetchStudents = async () => {
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

  const handleScoreChange = (studentId: string, score: number) => {
    setScores(prev => ({ ...prev, [studentId]: score }));
  };

  const saveGrades = async () => {
    if (selectedSemester === 'all') {
      setNotification({ message: 'กรุณาเลือกภาคเรียนที่ 1 หรือ 2 เพื่อบันทึกคะแนน', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      for (const studentId of Object.keys(scores)) {
        const score = scores[studentId];
        // Use addDoc for unique entries or a more specific ID
        await addDoc(collection(db, 'grades'), {
          studentId,
          subjectId: selectedSubject,
          classId: selectedClass,
          score,
          maxScore,
          description,
          date,
          semester: selectedSemester,
          academicYear: selectedYear,
          term: String(selectedSemester),
          teacherId: auth.currentUser?.uid,
          updatedAt: serverTimestamp()
        });
      }
      setNotification({ message: 'บันทึกคะแนนเรียบร้อยแล้ว!', type: 'success' });
      setScores({});
    } catch (error) {
      console.error("Error saving grades: ", error);
      handleFirestoreError(error, OperationType.WRITE, 'grades');
    } finally {
      setSaving(false);
    }
  };

  const deleteGrade = async (gradeId: string) => {
    try {
      await deleteDoc(doc(db, 'grades', gradeId));
      setNotification({ message: 'ลบคะแนนเรียบร้อยแล้ว', type: 'success' });
    } catch (error) {
      console.error("Error deleting grade: ", error);
      handleFirestoreError(error, OperationType.DELETE, `grades/${gradeId}`);
    }
    setDeleteConfirm({ isOpen: false, gradeId: null });
  };

  const updateGrade = async (gradeId: string, newScore: number, newMax: number, newDesc: string) => {
    try {
      await updateDoc(doc(db, 'grades', gradeId), {
        score: newScore,
        maxScore: newMax,
        description: newDesc,
        updatedAt: serverTimestamp()
      });
      setNotification({ message: 'แก้ไขคะแนนเรียบร้อยแล้ว', type: 'success' });
      setEditingGrade(null);
    } catch (error) {
      console.error("Error updating grade: ", error);
      handleFirestoreError(error, OperationType.UPDATE, `grades/${gradeId}`);
    }
  };

  const calculateTotal = (studentId: string) => {
    const studentGrades = existingGrades.filter(g => g.studentId === studentId);
    const totalScore = studentGrades.reduce((sum, g) => sum + g.score, 0);
    // คะแนนเต็มรวมทั้งหมดคือ 100 คะแนนตามความต้องการ
    const totalMax = 100;
    
    let grade = 0;
    if (totalScore >= 80) grade = 4;
    else if (totalScore >= 75) grade = 3.5;
    else if (totalScore >= 70) grade = 3;
    else if (totalScore >= 65) grade = 2.5;
    else if (totalScore >= 60) grade = 2;
    else if (totalScore >= 55) grade = 1.5;
    else if (totalScore >= 50) grade = 1;
    else grade = 0;

    return { totalScore, totalMax, percentage: totalScore, grade };
  };

  const generateReport = async () => {
    const subject = subjects.find(s => s.id === selectedSubject);
    const subjectName = subject ? subject.name : 'ไม่ระบุ';
    const teacherName = userProfile?.displayName || 'ไม่ระบุ';
    const semesterText = selectedSemester === 'all' ? 'ภาคเรียนที่ 1 และ 2' : `ภาคเรียนที่ ${selectedSemester}`;

    const reportData = students.map(s => {
      const { totalScore, totalMax, grade } = calculateTotal(s.id);
      return {
        'เลขที่': s.studentNumber || '-',
        'รหัส': s.studentId,
        'ชื่อ-นามสกุล': `${s.prefix || ''}${s.firstName} ${s.lastName}`,
        'คะแนนรวม': `${totalScore} / ${totalMax}`,
        'เกรด': grade.toFixed(1)
      };
    });

    if (reportFormat === 'excel') {
      const headers = ['เลขที่', 'รหัส', 'ชื่อ-นามสกุล', 'คะแนนรวม', 'เกรด'];
      const data = reportData.map(r => [
        r['เลขที่'],
        r['รหัส'],
        r['ชื่อ-นามสกุล'],
        r['คะแนนรวม'],
        r['เกรด']
      ]);

      await exportToExcel(
        `รายงานผลการเรียน วิชา ${subjectName} ชั้น ${selectedClass}`,
        `${semesterText}`,
        headers,
        data,
        `Grade_Report_${selectedSubject}_${selectedSemester}.xlsx`,
        [
          `ลงชื่อ......................................................`,
          `( ${teacherName} )`,
          `ตำแหน่ง ครูประจำรายวิชา`
        ]
      );
    } else {
      const doc = new jsPDF();
      await setupThaiFont(doc);
      
      doc.setFont('Sarabun', 'bold');
      doc.setFontSize(16);
      doc.text(`รายงานผลการเรียน - วิชา ${subjectName}`, 105, 15, { align: 'center' });
      
      doc.setFont('Sarabun', 'normal');
      doc.setFontSize(12);
      doc.text(`ชั้น: ${selectedClass} | ${semesterText}`, 105, 25, { align: 'center' });

      (doc as any).autoTable({
        startY: 35,
        head: [['เลขที่', 'รหัส', 'ชื่อ-นามสกุล', 'คะแนนรวม', 'เกรด']],
        body: students.map(s => {
          const { totalScore, totalMax, grade } = calculateTotal(s.id);
          return [
            s.studentNumber || '-',
            s.studentId,
            `${s.prefix || ''}${s.firstName} ${s.lastName}`,
            `${totalScore} / ${totalMax}`,
            grade.toFixed(1)
          ];
        }),
        theme: 'grid',
        styles: { font: 'Sarabun', fontSize: 12 },
        headStyles: { fillColor: [37, 99, 235], font: 'Sarabun', fontStyle: 'bold' },
        bodyStyles: { font: 'Sarabun', fontStyle: 'normal' },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      const rightX = 140;
      doc.text(`ลงชื่อ......................................................`, rightX, finalY);
      doc.text(`( ${teacherName} )`, rightX + 10, finalY + 10);
      doc.text(`ตำแหน่ง ครูประจำรายวิชา`, rightX + 12, finalY + 17);

      doc.save(`Grade_Report_${selectedSubject}_${selectedSemester}.pdf`);
    }
    setIsReportModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Config Panel */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
            {['ทั้งหมด', 'ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'].map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">วิชา</label>
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
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.code}) - {s.classId}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold text-slate-700">ภาคเรียน</label>
          <select 
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
          >
            <option value={1}>ภาคเรียนที่ 1</option>
            <option value={2}>ภาคเรียนที่ 2</option>
            <option value="all">รวมทั้ง 2 ภาคเรียน</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setIsReportModalOpen(true)}
            className="flex-1 p-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <Download size={18} />
            รายงาน
          </button>
        </div>
      </div>

      {/* Entry Panel */}
      {selectedSemester !== 'all' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">ที่มาของคะแนน</label>
            <input 
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="เช่น สอบย่อยครั้งที่ 1"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">คะแนนเต็ม</label>
            <input 
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>
        </div>
      )}

      {/* Score Entry Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">
            {selectedSemester === 'all' ? 'สรุปคะแนนและเกรดเฉลี่ย' : 'กรอกคะแนนนักเรียน'}
          </h3>
          {selectedSemester !== 'all' && (
            <button 
              onClick={saveGrades}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'กำลังบันทึก...' : 'บันทึกคะแนน'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">เลขที่</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">ชื่อ-นามสกุล</th>
                {selectedSemester !== 'all' && (
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">คะแนนเก็บ</th>
                )}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">คะแนนรวม</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">เกรดเฉลี่ย</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : students.map((student) => {
                const { totalScore, totalMax, grade } = calculateTotal(student.id);
                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{student.studentNumber || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-800">{student.prefix || ''}{student.firstName} {student.lastName}</span>
                    </td>
                    {selectedSemester !== 'all' && (
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-3">
                          <input 
                            type="number"
                            min="0"
                            max={maxScore}
                            value={scores[student.id] || ''}
                            onChange={(e) => handleScoreChange(student.id, Number(e.target.value))}
                            className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                          />
                          <span className="text-slate-400 font-medium">/ {maxScore}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-bold text-slate-700">{totalScore} / {totalMax}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-bold",
                        grade >= 3 ? "bg-green-100 text-green-700" :
                        grade >= 2 ? "bg-blue-100 text-blue-700" :
                        grade >= 1 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        {grade.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => {
                          setSelectedStudent(student);
                          setIsManageModalOpen(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="จัดการคะแนนรายบุคคล"
                      >
                        <Search size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manage Scores Modal */}
      <AnimatePresence>
        {isManageModalOpen && selectedStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">จัดการคะแนนรายบุคคล</h2>
                  <p className="text-slate-500">{selectedStudent.prefix}{selectedStudent.firstName} {selectedStudent.lastName} | เลขที่ {selectedStudent.studentNumber}</p>
                </div>
                <button onClick={() => setIsManageModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <Plus className="rotate-45 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {existingGrades.filter(g => g.studentId === selectedStudent.id).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100">
                    ยังไม่มีข้อมูลคะแนนเก็บ
                  </div>
                ) : (
                  <div className="space-y-3">
                    {existingGrades
                      .filter(g => g.studentId === selectedStudent.id)
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .map((grade) => (
                        <div key={grade.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                          {editingGrade?.id === grade.id ? (
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 mr-4">
                              <input 
                                type="text"
                                value={editingGrade.description}
                                onChange={(e) => setEditingGrade({...editingGrade, description: e.target.value})}
                                className="p-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="คำอธิบาย"
                              />
                              <div className="flex items-center gap-2">
                                <input 
                                  type="number"
                                  value={editingGrade.score}
                                  onChange={(e) => setEditingGrade({...editingGrade, score: Number(e.target.value)})}
                                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-slate-400">/</span>
                                <input 
                                  type="number"
                                  value={editingGrade.maxScore}
                                  onChange={(e) => setEditingGrade({...editingGrade, maxScore: Number(e.target.value)})}
                                  className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm text-center outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => updateGrade(grade.id!, editingGrade.score, editingGrade.maxScore, editingGrade.description)}
                                  className="flex-1 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all"
                                >
                                  บันทึก
                                </button>
                                <button 
                                  onClick={() => setEditingGrade(null)}
                                  className="flex-1 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-all"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1">
                                <p className="font-bold text-slate-800">{grade.description}</p>
                                <p className="text-xs text-slate-400 flex items-center gap-1">
                                  <CalendarCheck size={12} />
                                  {new Date(grade.date).toLocaleDateString('th-TH')} | ภาคเรียนที่ {grade.semester}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <p className="text-lg font-bold text-blue-600">{grade.score} <span className="text-sm text-slate-400 font-normal">/ {grade.maxScore}</span></p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <button 
                                    onClick={() => setEditingGrade(grade)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                  >
                                    <FileText size={16} />
                                  </button>
                                  <button 
                                    onClick={() => setDeleteConfirm({ isOpen: true, gradeId: grade.id! })}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <button 
                  onClick={() => setIsManageModalOpen(false)}
                  className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">ยืนยันการลบคะแนน</h3>
              <p className="text-slate-500 mb-6">คุณต้องการลบคะแนนนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm({ isOpen: false, gradeId: null })}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => deleteConfirm.gradeId && deleteGrade(deleteConfirm.gradeId)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-all"
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
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-[70] px-6 py-3 rounded-2xl shadow-xl font-bold text-white flex items-center gap-2",
              notification.type === 'success' ? "bg-green-600" : "bg-red-600"
            )}
          >
            {notification.type === 'success' ? <Save size={18} /> : <Plus className="rotate-45" size={18} />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

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
