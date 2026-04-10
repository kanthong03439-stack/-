import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, getDocs, writeBatch, doc, getDoc } from 'firebase/firestore';
import { 
  Users, 
  CalendarCheck, 
  GraduationCap, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  AlertCircle,
  BookOpen,
  User
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronRight, PiggyBank } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, subDays, subWeeks, subMonths } from 'date-fns';
import { th } from 'date-fns/locale';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import { Student, UserProfile, Subject } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const { selectedYear, selectedTerm, setSelectedYear, setSelectedTerm } = useAcademicYear();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const [isTermDropdownOpen, setIsTermDropdownOpen] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [showPromotionConfirm, setShowPromotionConfirm] = useState(false);
  const [targetYear, setTargetYear] = useState('');
  
  const [stats, setStats] = useState({
    totalStudents: 0,
    attendanceRate: 0,
    averageGrade: 0,
    totalSavings: 0,
    enrolledSubjects: 0
  });

  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [viewType, setViewType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [genderViewType, setGenderViewType] = useState<'all' | 'class'>('all');
  const [selectedGenderClass, setSelectedGenderClass] = useState<string>('ป.1/1');
  const [filteredStudentCount, setFilteredStudentCount] = useState<number>(0);
  const [genderData, setGenderData] = useState([
    { name: 'ชาย', value: 0 },
    { name: 'หญิง', value: 0 },
  ]);

  const promoteStudents = async (newYear: string) => {
    if (userProfile?.role === 'student') return;
    setIsPromoting(true);
    try {
      const studentsSnap = await getDocs(collection(db, 'students'));
      const batch = writeBatch(db);
      
      const prevYear = (parseInt(newYear) - 1).toString();
      
      studentsSnap.docs.forEach((studentDoc) => {
        const student = studentDoc.data() as Student;
        const currentClass = student.yearClasses?.[prevYear] || student.classId;
        
        let nextClass = '';
        if (currentClass.startsWith('ป.1')) nextClass = currentClass.replace('ป.1', 'ป.2');
        else if (currentClass.startsWith('ป.2')) nextClass = currentClass.replace('ป.2', 'ป.3');
        else if (currentClass.startsWith('ป.3')) nextClass = currentClass.replace('ป.3', 'ป.4');
        else if (currentClass.startsWith('ป.4')) nextClass = currentClass.replace('ป.4', 'ป.5');
        else if (currentClass.startsWith('ป.5')) nextClass = currentClass.replace('ป.5', 'ป.6');
        else if (currentClass.startsWith('ป.6')) nextClass = 'จบการศึกษา';
        else nextClass = currentClass; // Keep as is if not P.1-P.6

        // Update yearClasses map
        const updatedYearClasses = {
          ...(student.yearClasses || {}),
          [newYear]: nextClass
        };

        batch.update(studentDoc.ref, {
          yearClasses: updatedYearClasses,
          classId: nextClass // Update current classId as well for compatibility
        });
      });

      await batch.commit();
      setSelectedYear(newYear);
      window.location.reload(); // Refresh to clear all cached data and listeners
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    } finally {
      setIsPromoting(false);
      setShowPromotionConfirm(false);
    }
  };

  const handleYearSelect = async (year: string) => {
    if (year === selectedYear) return;
    
    if (userProfile?.role !== 'student') {
      // Check if this year is "new" (no students have it in yearClasses yet)
      const studentsSnap = await getDocs(query(collection(db, 'students')));
      const hasYearData = studentsSnap.docs.some(doc => {
        const data = doc.data() as Student;
        return data.yearClasses && data.yearClasses[year];
      });

      if (!hasYearData && parseInt(year) > parseInt(selectedYear)) {
        setTargetYear(year);
        setShowPromotionConfirm(true);
      } else {
        setSelectedYear(year);
      }
    } else {
      setSelectedYear(year);
    }
    setIsYearDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isYearDropdownOpen && !target.closest('.academic-year-dropdown')) {
        setIsYearDropdownOpen(false);
      }
      if (isTermDropdownOpen && !target.closest('.term-dropdown')) {
        setIsTermDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isYearDropdownOpen, isTermDropdownOpen]);

  const [attendanceSummary, setAttendanceSummary] = useState({ total: 0, present: 0, absent: 0 });
  const [gradeSummary, setGradeSummary] = useState<any[]>([]);
  const [studentDetails, setStudentDetails] = useState<Student | null>(null);
  const [studentSubjects, setStudentSubjects] = useState<Subject[]>([]);
  const [selectedAttendanceSubject, setSelectedAttendanceSubject] = useState<string>('all');
  const [selectedGradeSubject, setSelectedGradeSubject] = useState<string>('all');
  
  // Store raw data for filtering
  const [rawAttendanceData, setRawAttendanceData] = useState<any[]>([]);
  const [rawGradeData, setRawGradeData] = useState<any[]>([]);

  useEffect(() => {
    if (userProfile?.role !== 'student') return;

    // Filter attendance
    const filteredAttendance = selectedAttendanceSubject === 'all' 
      ? rawAttendanceData 
      : rawAttendanceData.filter(a => a.subjectId === selectedAttendanceSubject);

    const total = filteredAttendance.length;
    const present = filteredAttendance.filter(a => a.status === 'present').length;
    const absent = filteredAttendance.filter(a => a.status === 'absent' || a.status === 'leave').length;
    setAttendanceSummary({ total, present, absent });
    
    // Only update overall stats if 'all' is selected to keep top cards consistent
    if (selectedAttendanceSubject === 'all') {
      setStats(prev => ({ ...prev, attendanceRate: total > 0 ? (present / total) * 100 : 0 }));
    }

    // Group attendance for chart
    const groupedData: Record<string, any> = {};
    filteredAttendance.forEach(a => {
      const date = parseISO(a.date);
      let key = format(date, 'dd MMM', { locale: th });
      if (!groupedData[key]) {
        groupedData[key] = { name: key, มาเรียน: 0, สาย: 0, ขาด: 0, date: date };
      }
      if (a.status === 'present') groupedData[key].มาเรียน++;
      else if (a.status === 'late') groupedData[key].สาย++;
      else if (a.status === 'absent' || a.status === 'leave') groupedData[key].ขาด++;
    });
    setAttendanceData(Object.values(groupedData).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-7));

  }, [rawAttendanceData, selectedAttendanceSubject, userProfile]);

  useEffect(() => {
    if (userProfile?.role !== 'student') return;

    // Filter grades
    const filteredGrades = selectedGradeSubject === 'all'
      ? rawGradeData
      : rawGradeData.filter(g => g.subjectId === selectedGradeSubject);
    
    setGradeSummary(filteredGrades);

    if (selectedGradeSubject === 'all') {
      // Group grades by subject
      const gradesBySubject: Record<string, number> = {};
      rawGradeData.forEach(g => {
        if (!gradesBySubject[g.subjectId]) gradesBySubject[g.subjectId] = 0;
        gradesBySubject[g.subjectId] += (g.score || 0);
      });

      // Calculate grade for each subject
      let totalGradePoints = 0;
      let subjectCount = 0;
      
      Object.values(gradesBySubject).forEach(totalScore => {
        let grade = 0;
        if (totalScore >= 80) grade = 4;
        else if (totalScore >= 75) grade = 3.5;
        else if (totalScore >= 70) grade = 3;
        else if (totalScore >= 65) grade = 2.5;
        else if (totalScore >= 60) grade = 2;
        else if (totalScore >= 55) grade = 1.5;
        else if (totalScore >= 50) grade = 1;
        else grade = 0;
        
        totalGradePoints += grade;
        subjectCount++;
      });

      const avgGrade = subjectCount > 0 ? totalGradePoints / subjectCount : 0;
      setStats(prev => ({ ...prev, averageGrade: avgGrade }));
    } else {
      const totalScore = filteredGrades.reduce((sum, g) => sum + (g.score || 0), 0);
      let grade = 0;
      if (totalScore >= 80) grade = 4;
      else if (totalScore >= 75) grade = 3.5;
      else if (totalScore >= 70) grade = 3;
      else if (totalScore >= 65) grade = 2.5;
      else if (totalScore >= 60) grade = 2;
      else if (totalScore >= 55) grade = 1.5;
      else if (totalScore >= 50) grade = 1;
      else grade = 0;
      
      setStats(prev => ({ ...prev, averageGrade: grade }));
    }
  }, [rawGradeData, selectedGradeSubject, userProfile]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (auth.currentUser) {
        const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (docSnap.exists()) {
          const profile = docSnap.data() as UserProfile;
          setUserProfile(profile);
          
          if (profile.role === 'teacher' && profile.isApproved) {
            // Data isolation: Teachers only see their own students and data.
            // No backfilling of unassigned students.
          }
          
          // Fetch student details if role is student
          if (profile.role === 'student') {
            let foundStudent = false;
            if (profile.studentId) {
              const q = query(collection(db, 'students'), where('studentId', '==', profile.studentId));
              const snap = await getDocs(q);
              if (!snap.empty) {
                setStudentDetails({ id: snap.docs[0].id, ...snap.docs[0].data() } as Student);
                foundStudent = true;
              }
            }
            
            // Fallback: Try to find by displayName
            if (!foundStudent && profile.displayName) {
              const studentsSnap = await getDocs(collection(db, 'students'));
              const matchedStudent = studentsSnap.docs.find(doc => {
                const data = doc.data();
                const fullName1 = `${data.prefix || ''}${data.firstName} ${data.lastName}`.trim();
                const fullName2 = `${data.firstName} ${data.lastName}`.trim();
                const fullName3 = `${data.prefix || ''}${data.firstName}${data.lastName}`.trim();
                const fullName4 = `${data.firstName}${data.lastName}`.trim();
                const profileName = profile.displayName.trim();
                
                return profileName === fullName1 || profileName === fullName2 || profileName === fullName3 || profileName === fullName4;
              });
              
              if (matchedStudent) {
                setStudentDetails({ id: matchedStudent.id, ...matchedStudent.data() } as Student);
              }
            }
          }
        }
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!userProfile) return;
    if (!userProfile.isApproved && userProfile.role !== 'admin') return;

    let unsubStudents: () => void = () => {};
    let unsubAttendance: () => void = () => {};
    let unsubSavings: () => void = () => {};
    let unsubGrades: () => void = () => {};

    // Student specific data fetching
    if (userProfile.role === 'student') {
      if (!studentDetails) return; // Wait for studentDetails to be loaded
      
      const studentDocId = studentDetails.id;

      // Attendance
      const qAttendance = query(
        collection(db, 'attendance'),
        where('studentId', '==', studentDocId),
        where('academicYear', '==', selectedYear),
        where('term', '==', selectedTerm)
      );
      unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
        const attendance = snapshot.docs.map(doc => doc.data());
        setRawAttendanceData(attendance);
      });

      // Grades
      const qGrades = query(
        collection(db, 'grades'),
        where('studentId', '==', studentDocId),
        where('academicYear', '==', selectedYear)
      );
      unsubGrades = onSnapshot(qGrades, (snapshot) => {
        const grades = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((g: any) => String(g.term) === String(selectedTerm) || String(g.semester) === String(selectedTerm));
        setRawGradeData(grades);
      });

      // Savings
      const qSavings = query(
        collection(db, 'savings'),
        where('studentId', '==', studentDocId),
        where('academicYear', '==', selectedYear)
      );
      unsubSavings = onSnapshot(qSavings, (snapshot) => {
        const savings = snapshot.docs.map(doc => doc.data());
        const total = savings.reduce((sum, s) => sum + (s.type === 'deposit' ? s.amount : -s.amount), 0);
        setStats(prev => ({ ...prev, totalSavings: total }));
      });

      // Subjects (Enrolled)
      const fetchSubjects = async () => {
        const classId = studentDetails.yearClasses?.[selectedYear] || studentDetails.classId;
        if (!classId) return;
        
        const qSubjects = query(
          collection(db, 'subjects'),
          where('classId', '==', classId),
          where('academicYear', '==', selectedYear)
        );
        const subjectsSnap = await getDocs(qSubjects);
        const subjectsList = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
        setStudentSubjects(subjectsList);
        setStats(prev => ({ ...prev, enrolledSubjects: subjectsList.length }));
      };
      fetchSubjects();

      return () => {
        unsubAttendance();
        unsubGrades();
        unsubSavings();
      };
    } else {
      // Teacher/Admin data fetching (Full Overview)
      const studentsQuery = userProfile.role === 'admin' 
        ? collection(db, 'students')
        : query(collection(db, 'students'), where('teacherId', '==', auth.currentUser?.uid));

      unsubStudents = onSnapshot(studentsQuery, (snapshot) => {
        const allStudents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        const students = allStudents.filter(s => {
          const classInYear = s.yearClasses?.[selectedYear] || s.classId;
          return classInYear !== 'จบการศึกษา';
        });

        const filteredStudents = genderViewType === 'class' 
          ? students.filter(s => (s.yearClasses?.[selectedYear] || s.classId) === selectedGenderClass)
          : students;

        const male = filteredStudents.filter(s => s.gender === 'male').length;
        const female = filteredStudents.filter(s => s.gender === 'female').length;
        setStats(prev => ({ ...prev, totalStudents: students.length }));
        setFilteredStudentCount(filteredStudents.length);
        setGenderData([{ name: 'ชาย', value: male }, { name: 'หญิง', value: female }]);
      });

      const qAttendance = userProfile.role === 'admin'
        ? query(
            collection(db, 'attendance'),
            where('academicYear', '==', selectedYear),
            where('term', '==', selectedTerm)
          )
        : query(
            collection(db, 'attendance'),
            where('teacherId', '==', auth.currentUser?.uid),
            where('academicYear', '==', selectedYear),
            where('term', '==', selectedTerm)
          );

      unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
        const attendance = snapshot.docs.map(doc => doc.data());
        const filteredAttendance = selectedClass === 'all' ? attendance : attendance.filter(a => a.classId === selectedClass);
        const total = filteredAttendance.length;
        const present = filteredAttendance.filter(a => a.status === 'present').length;
        setStats(prev => ({ ...prev, attendanceRate: total > 0 ? (present / total) * 100 : 0 }));

        const groupedData: Record<string, any> = {};
        filteredAttendance.forEach(a => {
          const date = parseISO(a.date);
          let key = viewType === 'daily' ? a.date : (viewType === 'weekly' ? format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd') : format(startOfMonth(date), 'yyyy-MM'));
          let label = viewType === 'daily' ? format(date, 'dd MMM', { locale: th }) : (viewType === 'weekly' ? `สัปดาห์ ${format(startOfWeek(date, { weekStartsOn: 1 }), 'dd MMM', { locale: th })}` : format(startOfMonth(date), 'MMM yyyy', { locale: th }));
          
          if (!groupedData[key]) {
            groupedData[key] = { name: label, มาเรียน: 0, สาย: 0, ขาด: 0, date: date };
          }
          if (a.status === 'present') groupedData[key].มาเรียน++;
          else if (a.status === 'late') groupedData[key].สาย++;
          else if (a.status === 'absent' || a.status === 'leave') groupedData[key].ขาด++;
        });
        const chartData = Object.values(groupedData).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-7);
        setAttendanceData(chartData.length > 0 ? chartData : [{ name: '-', มาเรียน: 0, สาย: 0, ขาด: 0 }]);
      });

      const qSavings = userProfile.role === 'admin'
        ? query(collection(db, 'savings'), where('academicYear', '==', selectedYear))
        : query(collection(db, 'savings'), where('teacherId', '==', auth.currentUser?.uid), where('academicYear', '==', selectedYear));

      unsubSavings = onSnapshot(qSavings, (snapshot) => {
        const savings = snapshot.docs.map(doc => doc.data());
        const total = savings.reduce((sum, s) => sum + (s.type === 'deposit' ? s.amount : -s.amount), 0);
        setStats(prev => ({ ...prev, totalSavings: total }));
      });

      const qGrades = userProfile.role === 'admin'
        ? query(collection(db, 'grades'), where('academicYear', '==', selectedYear), where('term', '==', selectedTerm))
        : query(collection(db, 'grades'), where('teacherId', '==', auth.currentUser?.uid), where('academicYear', '==', selectedYear), where('term', '==', selectedTerm));

      unsubGrades = onSnapshot(qGrades, (snapshot) => {
        const grades = snapshot.docs.map(doc => doc.data());
        const avg = grades.length > 0 ? grades.reduce((sum, g) => sum + (g.score || 0), 0) / grades.length : 0;
        setStats(prev => ({ ...prev, averageGrade: avg }));
      });

      return () => {
        unsubStudents();
        unsubAttendance();
        unsubSavings();
        unsubGrades();
      };
    }
  }, [selectedYear, selectedTerm, viewType, selectedClass, genderViewType, selectedGenderClass, userProfile, studentDetails]);

  return (
    <div className="space-y-6">
      {/* Dashboard Header with Academic Year */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">ภาพรวมระบบ</h2>
          <p className="text-slate-500 text-sm">สรุปข้อมูลสำคัญของโรงเรียนบ้านแม่ตาวแพะ</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative academic-year-dropdown">
            <div 
              onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-300 transition-all cursor-pointer group"
            >
              <GraduationCap size={18} className="text-blue-600" />
              <span className="text-sm font-bold text-slate-700">ปีการศึกษา {selectedYear}</span>
              <ChevronDown size={16} className={cn("text-slate-400 group-hover:text-blue-600 transition-all", isYearDropdownOpen && "rotate-180")} />
            </div>

            {isYearDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 overflow-hidden">
                {['2567', '2568', '2569', '2570'].map((year) => (
                  <button
                    key={year}
                    onClick={() => handleYearSelect(year)}
                    className={cn(
                      "w-full px-4 py-2 text-sm text-left transition-all",
                      selectedYear === year ? "bg-blue-50 text-blue-600 font-bold" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    ปีการศึกษา {year}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative term-dropdown">
            <div 
              onClick={() => setIsTermDropdownOpen(!isTermDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-blue-300 transition-all cursor-pointer group"
            >
              <CalendarCheck size={18} className="text-blue-600" />
              <span className="text-sm font-bold text-slate-700">ภาคเรียนที่ {selectedTerm}</span>
              <ChevronDown size={16} className={cn("text-slate-400 group-hover:text-blue-600 transition-all", isTermDropdownOpen && "rotate-180")} />
            </div>

            {isTermDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 overflow-hidden">
                {['1', '2'].map((term) => (
                  <button
                    key={term}
                    onClick={() => {
                      setSelectedTerm(term);
                      setIsTermDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2 text-sm text-left transition-all",
                      selectedTerm === term ? "bg-blue-50 text-blue-600 font-bold" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    ภาคเรียนที่ {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Promotion Confirmation Modal */}
      <AnimatePresence>
        {showPromotionConfirm && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <RefreshCw size={32} className={cn("text-blue-600", isPromoting && "animate-spin")} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">เริ่มปีการศึกษาใหม่ {targetYear}</h3>
              <p className="text-slate-500 text-center mb-8">
                ระบบจะทำการเลื่อนชั้นนักเรียนทุกคนโดยอัตโนมัติ และเตรียมข้อมูลพื้นฐานใหม่สำหรับปีการศึกษานี้ คุณต้องการดำเนินการต่อหรือไม่?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => promoteStudents(targetYear)}
                  disabled={isPromoting}
                  className="w-full py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
                >
                  {isPromoting ? <RefreshCw size={20} className="animate-spin" /> : 'ยืนยันและเริ่มปีการศึกษาใหม่'}
                </button>
                <button
                  onClick={() => setShowPromotionConfirm(false)}
                  disabled={isPromoting}
                  className="w-full py-3 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  ยกเลิก
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Info Header */}
      {userProfile?.role === 'student' && studentDetails && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
            {studentDetails.firstName.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{studentDetails.prefix || ''}{studentDetails.firstName} {studentDetails.lastName}</h2>
            <div className="flex gap-4 text-sm text-slate-500 mt-1">
              <span>เลขที่: {studentDetails.studentNumber || '-'}</span>
              <span>รหัสนักเรียน: {studentDetails.studentId}</span>
              <span>ระดับชั้น: {studentDetails.yearClasses?.[selectedYear] || studentDetails.classId}</span>
            </div>
          </div>
        </div>
      )}

      {/* Enrolled Subjects List for Students */}
      {userProfile?.role === 'student' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">รายวิชาที่เรียน</h3>
          {studentSubjects.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">ยังไม่มีรายวิชาที่เรียน</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studentSubjects.map(subject => (
                <div key={subject.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{subject.name}</h4>
                    <p className="text-xs text-slate-500">รหัสวิชา: {subject.code}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attendance and Grade Summary for Students */}
      {userProfile?.role === 'student' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">สรุปการมาเรียน</h3>
              <select 
                value={selectedAttendanceSubject}
                onChange={(e) => setSelectedAttendanceSubject(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ทุกรายวิชา</option>
                {studentSubjects.map(subject => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-2xl text-center">
                <p className="text-xs text-blue-600 font-bold">เปิดเรียน</p>
                <p className="text-xl font-bold text-blue-800">{attendanceSummary.total}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-2xl text-center">
                <p className="text-xs text-green-600 font-bold">มาเรียน</p>
                <p className="text-xl font-bold text-green-800">{attendanceSummary.present}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-2xl text-center">
                <p className="text-xs text-red-600 font-bold">ขาด/ลา</p>
                <p className="text-xl font-bold text-red-800">{attendanceSummary.absent}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">สรุปคะแนนผลการเรียน</h3>
              <select 
                value={selectedGradeSubject}
                onChange={(e) => setSelectedGradeSubject(e.target.value)}
                className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ทุกรายวิชา</option>
                {studentSubjects.map(subject => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-2 text-xs font-bold text-slate-500">ที่มาของคะแนน</th>
                    <th className="pb-2 text-xs font-bold text-slate-500">คะแนนที่ได้</th>
                    <th className="pb-2 text-xs font-bold text-slate-500">คะแนนเต็ม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {gradeSummary.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-sm text-slate-500">ยังไม่มีข้อมูลคะแนน</td>
                    </tr>
                  ) : (
                    gradeSummary.map((grade) => (
                      <tr key={grade.id}>
                        <td className="py-3 text-sm text-slate-700">{grade.description || '-'}</td>
                        <td className="py-3 text-sm text-slate-700">{grade.score || 0}</td>
                        <td className="py-3 text-sm text-slate-700">{grade.maxScore || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {userProfile?.role === 'student' ? (
          <>
            <StatCard 
              title="รายวิชาที่เรียน" 
              value={stats.enrolledSubjects} 
              unit="วิชา" 
              icon={BookOpen} 
              color="blue"
            />
            <StatCard 
              title="อัตราการมาเรียน" 
              value={stats.attendanceRate.toFixed(1)} 
              unit="%" 
              icon={CalendarCheck} 
              color="green"
            />
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col relative"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                  <GraduationCap size={24} />
                </div>
                <select
                  value={selectedGradeSubject}
                  onChange={(e) => setSelectedGradeSubject(e.target.value)}
                  className="max-w-[120px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-amber-500 truncate"
                >
                  <option value="all">รวมทุกวิชา</option>
                  {studentSubjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm font-medium text-slate-500">
                {selectedGradeSubject === 'all' ? 'เกรดเฉลี่ยสะสม' : 'เกรดเฉลี่ยรายวิชา'}
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <h2 className="text-3xl font-bold text-slate-800">{stats.averageGrade.toFixed(2)}</h2>
              </div>
            </motion.div>
            <StatCard 
              title="เงินออมของคุณ" 
              value={stats.totalSavings.toLocaleString()} 
              unit="บาท" 
              icon={PiggyBank} 
              color="indigo"
            />
          </>
        ) : (
          <>
            <StatCard 
              title="นักเรียนทั้งหมด" 
              value={stats.totalStudents} 
              unit="คน" 
              icon={Users} 
              color="blue"
            />
            <StatCard 
              title="อัตราการมาเรียน" 
              value={stats.attendanceRate.toFixed(1)} 
              unit="%" 
              icon={CalendarCheck} 
              color="green"
            />
            <StatCard 
              title="เกรดเฉลี่ยรวม" 
              value={stats.averageGrade.toFixed(2)} 
              unit="" 
              icon={GraduationCap} 
              color="amber"
            />
            <StatCard 
              title="เงินออมสะสม" 
              value={stats.totalSavings.toLocaleString()} 
              unit="บาท" 
              icon={TrendingUp} 
              color="indigo"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800">
              {userProfile?.role === 'student' ? 'สถิติการมาเรียนของคุณ' : 'สถิติการมาเรียน'}
            </h3>
            {userProfile?.role !== 'student' && (
              <div className="flex items-center gap-2">
                <select 
                  value={selectedClass} 
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">ทุกชั้นเรียน</option>
                  {['ป.1/1', 'ป.2/1', 'ป.3/1', 'ป.4/1', 'ป.5/1', 'ป.6/1'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select 
                  value={viewType} 
                  onChange={(e) => setViewType(e.target.value as any)}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">รายวัน</option>
                  <option value="weekly">รายสัปดาห์</option>
                  <option value="monthly">รายเดือน</option>
                </select>
              </div>
            )}
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  cursor={{fill: '#f8fafc'}}
                />
                <Bar dataKey="มาเรียน" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="สาย" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="ขาด" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gender Distribution or Student Info */}
        {userProfile?.role === 'student' ? (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-6">ข้อมูลส่วนตัว</h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <User size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">ชื่อ-นามสกุล</p>
                  <p className="font-bold text-slate-800">{userProfile.displayName}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                  <GraduationCap size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-500">เลขประจำตัวนักเรียน</p>
                  <p className="font-bold text-slate-800">{userProfile.studentId}</p>
                </div>
              </div>
              <div className="p-4 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
                <p className="text-xs opacity-80 mb-1">สถานะการเรียน</p>
                <p className="text-lg font-bold">กำลังศึกษาอยู่</p>
                <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-1000" 
                    style={{ width: `${stats.attendanceRate}%` }}
                  />
                </div>
                <p className="text-[10px] mt-2 opacity-80 text-right">การมาเรียน {stats.attendanceRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-800">สัดส่วนนักเรียน</h3>
              <div className="flex items-center gap-2">
                {genderViewType === 'class' && (
                  <select 
                    value={selectedGenderClass} 
                    onChange={(e) => setSelectedGenderClass(e.target.value)}
                    className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {['ป.1/1', 'ป.2/1', 'ป.3/1', 'ป.4/1', 'ป.5/1', 'ป.6/1'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
                <select 
                  value={genderViewType} 
                  onChange={(e) => setGenderViewType(e.target.value as any)}
                  className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">ทั้งหมด</option>
                  <option value="class">รายชั้น</option>
                </select>
              </div>
            </div>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {genderData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-800">{filteredStudentCount}</span>
                <span className="text-xs text-slate-400">คน</span>
              </div>
            </div>
            <div className="space-y-3 mt-4">
              {genderData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index]}}></div>
                    <span className="text-sm text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{item.value} คน</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, unit, icon: Icon, color, trend }: any) {
  const colorClasses: any = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-2xl", colorClasses[color])}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
            trend.startsWith('+') ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          )}>
            {trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <h2 className="text-3xl font-bold text-slate-800">{value}</h2>
        <span className="text-sm text-slate-400 font-medium">{unit}</span>
      </div>
    </motion.div>
  );
}
