import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../firebase';
import { collection, query, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, where, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Student, UserProfile } from '../types';
import { Plus, Search, FileUp, Download, Trash2, Edit2, UserPlus, Filter, AlertTriangle, XCircle, Trash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useAcademicYear } from '../contexts/AcademicYearContext';

export default function StudentManagement() {
  const { selectedYear } = useAcademicYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState<Partial<Student>>({});
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<'all' | 'grade' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const classes = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'ป.1', label: 'ป.1' },
    { id: 'ป.2', label: 'ป.2' },
    { id: 'ป.3', label: 'ป.3' },
    { id: 'ป.4', label: 'ป.4' },
    { id: 'ป.5', label: 'ป.5' },
    { id: 'ป.6', label: 'ป.6' },
  ];

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const profile = userDoc.data() as UserProfile;
      
      let q;
      if (profile.role === 'admin') {
        q = query(collection(db, 'students'));
      } else {
        q = query(collection(db, 'students'), where('teacherId', '==', user.uid));
      }
      
      const querySnapshot = await getDocs(q);
      const studentList = querySnapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Student));
      setStudents(studentList);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'students');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const studentData = {
        ...currentStudent,
        yearClasses: {
          ...(currentStudent.yearClasses || {}),
          [selectedYear]: currentStudent.classId || ''
        }
      };

      if (currentStudent.id) {
        await updateDoc(doc(db, 'students', currentStudent.id), studentData);
      } else {
        await addDoc(collection(db, 'students'), {
          ...studentData,
          teacherId: user.uid,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, currentStudent.id ? OperationType.UPDATE : OperationType.CREATE, 'students');
    }
  };

  const downloadTemplate = async () => {
    const templateData = [
      {
        'เลขที่': 1,
        'รหัสนักเรียน': '67001',
        'คำนำหน้าชื่อ': 'เด็กชาย',
        'ชื่อ': 'สมชาย',
        'นามสกุล': 'ใจดี',
        'ชั้น': 'ป.1/1',
        'เพศ': 'ชาย',
        'วันเกิด': '20/05/2560',
        'น้ำหนัก': 25,
        'ส่วนสูง': 120
      },
      {
        'เลขที่': 2,
        'รหัสนักเรียน': '67002',
        'คำนำหน้าชื่อ': 'เด็กหญิง',
        'ชื่อ': 'สมหญิง',
        'นามสกุล': 'รักเรียน',
        'ชั้น': 'ป.1/1',
        'เพศ': 'หญิง',
        'วันเกิด': '15/08/2560',
        'น้ำหนัก': 22,
        'ส่วนสูง': 118
      }
    ];

    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');
    
    const headers = Object.keys(templateData[0]);
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    });
    
    templateData.forEach(data => {
      const dataRow = worksheet.addRow(Object.values(data));
      dataRow.font = { name: 'Sarabun', size: 12 };
    });
    
    worksheet.columns.forEach(column => { column.width = 20; });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, "student_template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Import to Firestore
        const user = auth.currentUser;
        if (!user) return;
        
        for (const row of data as any[]) {
          const classId = String(row['ชั้น'] || row['classId'] || '');
          await addDoc(collection(db, 'students'), {
            studentNumber: Number(row['เลขที่'] || row['studentNumber'] || 0),
            studentId: String(row['รหัสนักเรียน'] || row['studentId'] || ''),
            prefix: String(row['คำนำหน้าชื่อ'] || row['prefix'] || ''),
            firstName: String(row['ชื่อ'] || row['firstName'] || ''),
            lastName: String(row['นามสกุล'] || row['lastName'] || ''),
            classId: classId,
            yearClasses: { [selectedYear]: classId },
            gender: (row['เพศ'] === 'ชาย' || row['gender'] === 'male') ? 'male' : 'female',
            birthDate: row['วันเกิด'] || row['birthDate'] || null,
            weight: Number(row['น้ำหนัก'] || row['weight'] || 0),
            height: Number(row['ส่วนสูง'] || row['height'] || 0),
            teacherId: user.uid,
            createdAt: new Date().toISOString()
          });
        }
        fetchStudents();
        toast.success('นำเข้าข้อมูลสำเร็จ!');
      } catch (error) {
        console.error('Error importing excel:', error);
        toast.error('เกิดข้อผิดพลาดในการนำเข้าข้อมูล กรุณาตรวจสอบรูปแบบไฟล์');
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'students', id));
      setConfirmDelete(null);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${id}`);
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteConfirm) return;
    setIsDeleting(true);
    try {
      const studentsToDelete = bulkDeleteConfirm === 'all' 
        ? students 
        : filteredStudents;

      const batch = writeBatch(db);
      studentsToDelete.forEach((student) => {
        if (student.id) {
          batch.delete(doc(db, 'students', student.id));
        }
      });

      await batch.commit();
      setBulkDeleteConfirm(null);
      fetchStudents();
      toast.success('ลบข้อมูลสำเร็จ!');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'students/bulk');
    } finally {
      setIsDeleting(false);
    }
  };

  const calculateAge = (birthDate: string): string => {
    // Assuming birthDate is DD/MM/YYYY (พ.ศ.)
    if (!birthDate) return '-';
    
    const parts = birthDate.split('/');
    if (parts.length !== 3) return '-';
    
    const birthMonth = parseInt(parts[1], 10);
    const birthYearBE = parseInt(parts[2], 10);
    
    const currentYearBE = 2569; // 2026 + 543
    const currentMonth = 4; // April
    
    let years = currentYearBE - birthYearBE;
    let months = currentMonth - birthMonth;
    
    if (months < 0) {
      years--;
      months += 12;
    }
    
    return `อายุ ${years} ปี ${months} เดือน`;
  };

  const filteredStudents = students.filter(s => {
    const studentClass = s.yearClasses?.[selectedYear] || s.classId;
    const matchesSearch = `${s.firstName} ${s.lastName} ${s.studentId}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === 'all' || studentClass?.startsWith(selectedClass);
    const existsInYear = !!(s.yearClasses?.[selectedYear] || s.classId); // Simple check
    return matchesSearch && matchesClass && existsInYear && studentClass !== 'จบการศึกษา';
  }).sort((a, b) => (a.studentNumber || 0) - (b.studentNumber || 0));

  return (
    <div className="space-y-6">
      {/* Class Filter Tabs */}
      <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-2">
          {classes.map((cls) => {
            const count = cls.id === 'all' 
              ? filteredStudents.length 
              : students.filter(s => {
                  const studentClass = s.yearClasses?.[selectedYear] || s.classId;
                  return studentClass?.startsWith(cls.id) && studentClass !== 'จบการศึกษา';
                }).length;
            
            return (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={cn(
                  "px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2",
                  selectedClass === cls.id 
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                {cls.label}
                <span className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px]",
                  selectedClass === cls.id ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-slate-800">
            {selectedClass === 'all' ? 'รายชื่อนักเรียนทั้งหมด' : `รายชื่อนักเรียนชั้น${selectedClass}`}
          </h2>
          <p className="text-sm text-slate-500">จัดการข้อมูลนักเรียนและประวัติส่วนตัว</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="ค้นหาชื่อ หรือรหัสนักเรียน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download size={18} />
            <span className="hidden lg:inline text-sm font-bold">ต้นแบบ</span>
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 cursor-pointer transition-all shadow-sm">
            <FileUp size={18} />
            <span className="hidden lg:inline text-sm font-bold">นำเข้า</span>
            <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
          
          <div className="flex items-center gap-2">
            {selectedClass === 'all' ? (
              <button 
                onClick={() => setBulkDeleteConfirm('all')}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-100 rounded-2xl hover:bg-red-100 transition-all shadow-sm"
                title="ลบนักเรียนทั้งหมด"
              >
                <Trash2 size={18} />
                <span className="hidden xl:inline text-sm font-bold">ลบทั้งหมด</span>
              </button>
            ) : (
              <button 
                onClick={() => setBulkDeleteConfirm('grade')}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-2xl hover:bg-orange-100 transition-all shadow-sm"
                title={`ลบนักเรียนชั้น ${selectedClass} ทั้งหมด`}
              >
                <Trash size={18} />
                <span className="hidden xl:inline text-sm font-bold">ลบชั้น {selectedClass}</span>
              </button>
            )}
          </div>

          <button 
            onClick={() => { 
              setCurrentStudent({ 
                classId: selectedClass !== 'all' ? `${selectedClass}/1` : 'ป.1/1',
                gender: 'male'
              }); 
              setIsModalOpen(true); 
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <UserPlus size={18} />
            <span className="text-sm font-bold">
              {selectedClass === 'all' ? 'เพิ่มนักเรียน' : `เพิ่มนักเรียนชั้น${selectedClass}`}
            </span>
          </button>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">เลขที่</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">รหัส</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ชั้น</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">เพศ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">อายุ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">กำลังโหลดข้อมูล...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">ไม่พบข้อมูลนักเรียน</td>
                </tr>
              ) : filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-all group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-600">{student.studentNumber || '-'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-600">{student.studentId}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                        student.gender === 'male' ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                      )}>
                        {student.firstName.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-800">{student.prefix || ''}{student.firstName} {student.lastName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {student.yearClasses?.[selectedYear] || student.classId}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase",
                      student.gender === 'male' ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                    )}>
                      {student.gender === 'male' ? 'ชาย' : 'หญิง'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {calculateAge(student.birthDate || '')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 transition-all">
                      <button 
                        onClick={() => { setCurrentStudent(student); setIsModalOpen(true); }}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => setConfirmDelete(student.id!)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {bulkDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">ยืนยันการลบข้อมูลจำนวนมาก</h3>
                <p className="text-slate-500 text-sm">
                  {bulkDeleteConfirm === 'all' 
                    ? 'คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักเรียน "ทั้งหมด" ในระบบ? การดำเนินการนี้ไม่สามารถย้อนกลับได้'
                    : `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักเรียนชั้น "${selectedClass}" ทั้งหมด? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setBulkDeleteConfirm(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Student Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">
                  {currentStudent.id ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>
              <form onSubmit={handleSaveStudent} className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">เลขที่</label>
                    <input 
                      type="number"
                      value={currentStudent.studentNumber || ''}
                      onChange={e => setCurrentStudent({...currentStudent, studentNumber: Number(e.target.value)})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">รหัสนักเรียน</label>
                    <input 
                      required
                      type="text"
                      value={currentStudent.studentId || ''}
                      onChange={e => setCurrentStudent({...currentStudent, studentId: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">ชั้นเรียน (เช่น ป.1/1)</label>
                    <input 
                      required
                      type="text"
                      value={currentStudent.classId || ''}
                      onChange={e => setCurrentStudent({...currentStudent, classId: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">คำนำหน้าชื่อ</label>
                    <input 
                      type="text"
                      value={currentStudent.prefix || ''}
                      onChange={e => setCurrentStudent({...currentStudent, prefix: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">ชื่อ</label>
                    <input 
                      required
                      type="text"
                      value={currentStudent.firstName || ''}
                      onChange={e => setCurrentStudent({...currentStudent, firstName: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">นามสกุล</label>
                    <input 
                      required
                      type="text"
                      value={currentStudent.lastName || ''}
                      onChange={e => setCurrentStudent({...currentStudent, lastName: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">เพศ</label>
                    <select 
                      value={currentStudent.gender || 'male'}
                      onChange={e => setCurrentStudent({...currentStudent, gender: e.target.value as any})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="male">ชาย</option>
                      <option value="female">หญิง</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">วันเกิด</label>
                    <input 
                      type="date"
                      value={currentStudent.birthDate || ''}
                      onChange={e => setCurrentStudent({...currentStudent, birthDate: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">น้ำหนัก (กก.)</label>
                    <input 
                      type="number"
                      value={currentStudent.weight || ''}
                      onChange={e => setCurrentStudent({...currentStudent, weight: Number(e.target.value)})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">ส่วนสูง (ซม.)</label>
                    <input 
                      type="number"
                      value={currentStudent.height || ''}
                      onChange={e => setCurrentStudent({...currentStudent, height: Number(e.target.value)})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                  >
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-800">ยืนยันการลบข้อมูล</h3>
                <p className="text-slate-500 text-sm">
                  คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนักเรียนคนนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
