import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, where, setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Student, Grade, Subject, UserProfile } from '../types';
import { GraduationCap, Save, Filter, Search, Plus, Trash2, BookOpen, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function GradeSystem() {
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
  const [reportFormat, setReportFormat] = useState<'pdf' | 'excel'>('pdf');

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
    if (selectedSubject) {
      fetchGrades();
    }
  }, [selectedSubject, selectedSemester]);

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
      let q = query(collection(db, 'subjects'), where('teacherId', '==', user.uid));
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
      const q = query(collection(db, 'students'), where('classId', '==', selectedClass));
      const querySnapshot = await getDocs(q);
      const studentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Student))
        .sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0));
      setStudents(studentList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'students');
    } finally {
      setLoading(false);
    }
  };

  const fetchGrades = async () => {
    try {
      let q;
      if (selectedSemester === 'all') {
        q = query(
          collection(db, 'grades'), 
          where('subjectId', '==', selectedSubject),
          where('classId', '==', selectedClass)
        );
      } else {
        q = query(
          collection(db, 'grades'), 
          where('subjectId', '==', selectedSubject),
          where('classId', '==', selectedClass),
          where('semester', '==', selectedSemester)
        );
      }
      const querySnapshot = await getDocs(q);
      const gradeList = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Grade));
      setExistingGrades(gradeList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'grades');
    }
  };

  const handleScoreChange = (studentId: string, score: number) => {
    setScores(prev => ({ ...prev, [studentId]: score }));
  };

  const saveGrades = async () => {
    if (selectedSemester === 'all') {
      alert('กรุณาเลือกภาคเรียนที่ 1 หรือ 2 เพื่อบันทึกคะแนน');
      return;
    }
    setSaving(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      for (const studentId of Object.keys(scores)) {
        const score = scores[studentId];
        const gradeId = `${date}_${studentId}_${selectedSubject}_${selectedSemester}`;
        
        await setDoc(doc(db, 'grades', gradeId), {
          studentId,
          subjectId: selectedSubject,
          classId: selectedClass,
          score,
          maxScore,
          description,
          date,
          semester: selectedSemester,
          updatedAt: serverTimestamp()
        });
      }
      alert('บันทึกคะแนนเรียบร้อยแล้ว!');
      fetchGrades();
      setScores({});
    } catch (error) {
      console.error("Error saving grades: ", error);
      alert('เกิดข้อผิดพลาดในการบันทึกคะแนน');
    } finally {
      setSaving(false);
    }
  };

  const calculateTotal = (studentId: string) => {
    const studentGrades = existingGrades.filter(g => g.studentId === studentId);
    const totalScore = studentGrades.reduce((sum, g) => sum + g.score, 0);
    const totalMax = studentGrades.reduce((sum, g) => sum + g.maxScore, 0);
    const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    
    let grade = 0;
    if (percentage >= 80) grade = 4;
    else if (percentage >= 75) grade = 3.5;
    else if (percentage >= 70) grade = 3;
    else if (percentage >= 65) grade = 2.5;
    else if (percentage >= 60) grade = 2;
    else if (percentage >= 55) grade = 1.5;
    else if (percentage >= 50) grade = 1;
    else grade = 0;

    return { totalScore, totalMax, percentage, grade };
  };

  const generateReport = () => {
    const subject = subjects.find(s => s.id === selectedSubject);
    const subjectName = subject ? subject.name : 'ไม่ระบุ';
    const teacherName = userProfile?.displayName || 'ไม่ระบุ';
    const semesterText = selectedSemester === 'all' ? 'ภาคเรียนที่ 1 และ 2' : `ภาคเรียนที่ ${selectedSemester}`;

    const reportData = students.map(s => {
      const { totalScore, totalMax, grade } = calculateTotal(s.id);
      return {
        'เลขที่': s.studentNumber || '-',
        'รหัส': s.studentId,
        'ชื่อ-นามสกุล': `${s.firstName} ${s.lastName}`,
        'คะแนนรวม': `${totalScore} / ${totalMax}`,
        'เกรด': grade.toFixed(1)
      };
    });

    if (reportFormat === 'excel') {
      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Grades");
      
      XLSX.utils.sheet_add_aoa(ws, [
        [`รายงานผลการเรียน วิชา ${subjectName} ชั้น ${selectedClass}`],
        [`${semesterText}`],
        [],
      ], { origin: "A1" });

      const lastRow = reportData.length + 6;
      XLSX.utils.sheet_add_aoa(ws, [
        [`ลงชื่อ......................................................`],
        [`( ${teacherName} )`],
        [`ตำแหน่ง ครูประจำรายวิชา`]
      ], { origin: `D${lastRow}` });

      XLSX.writeFile(wb, `Grade_Report_${selectedSubject}_${selectedSemester}.xlsx`);
    } else {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text(`Grade Report - ${subjectName}`, 105, 15, { align: 'center' });
      doc.setFontSize(12);
      doc.text(`Class: ${selectedClass} | ${semesterText}`, 105, 25, { align: 'center' });

      autoTable(doc, {
        startY: 35,
        head: [['No.', 'ID', 'Name', 'Total Score', 'Grade']],
        body: students.map(s => {
          const { totalScore, totalMax, grade } = calculateTotal(s.id);
          return [
            s.studentNumber || '-',
            s.studentId,
            `${s.firstName} ${s.lastName}`,
            `${totalScore} / ${totalMax}`,
            grade.toFixed(1)
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235] }
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">กำลังโหลด...</td></tr>
              ) : students.map((student) => {
                const { totalScore, totalMax, grade } = calculateTotal(student.id);
                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 text-sm font-medium text-slate-500">{student.studentNumber || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-slate-800">{student.firstName} {student.lastName}</span>
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
