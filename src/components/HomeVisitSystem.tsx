/* @jsxRuntime classic */
import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { Student, UserProfile } from '../types';
import { Home, Plus, Calendar, Search, User, Download, FileText, FileCode, ChevronRight, ChevronLeft, Save, Trash2, Camera, MapPin, Clock, Info, Smile, TrendingUp, History as LucideHistory } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import SignatureCanvas from 'react-signature-canvas';
import { cn, toDate } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun, PageBreak } from 'docx';
import { saveAs } from 'file-saver';
import { createHeaderParagraph, createInfoParagraph } from '../lib/docxGenerator';

interface HouseholdMember {
  id: string;
  relationship: string;
  age: number;
  education: string;
  occupation: string;
  disability: boolean;
  incomeWages: number;
  incomeAgri: number;
  incomeBusiness: number;
  incomeWelfare: number;
  incomeOther: number;
  totalIncome: number;
}

interface HomeVisitData {
  schoolName: string;
  district: string;
  visitDate: string;
  studentIdCard: string;
  studentAddress: string;
  gpsLocation: {
    lat: number;
    lng: number;
  };
  parentName: string;
  parentSurname: string;
  parentPhone: string;
  parentRelationship: string;
  parentOccupation: string;
  parentEducation: string;
  parentIdCard: string;
  hasNoParent: boolean;
  hasNoIdCard: boolean;
  isWelfareRegistered: boolean;
  householdMembers: HouseholdMember[];
  householdStatus: {
    hasDisabled: boolean;
    hasElderly: boolean;
    isSingleParent: boolean;
    hasUnemployed: boolean;
    housingType: 'own' | 'rent' | 'others' | 'welfare' | '';
    housingCondition: 'dilapidated' | 'normal' | 'good' | '';
    housingMaterial: 'wood' | 'concrete' | 'half' | 'others' | '';
    noToilet: boolean;
    utilities: {
      electricity: boolean;
      water: boolean;
    };
    vehicles: {
      car: boolean;
      pickup: boolean;
      tractor: boolean;
      motorcycle: boolean;
    };
    isFarmer: boolean;
    landSize: 'lessThan1' | 'noLand' | 'moreThan1' | '';
    averageIncomePerPerson: number;
  };
  familyRelationship: {
    timeTogether: number;
    activities: string;
    memberRelations: Record<string, 'close' | 'normal' | 'distant' | 'conflict' | 'none' | ''>;
    memberRelationsOtherDetail: string;
    guardianIfAbsent: 'relatives' | 'neighbors' | 'alone' | 'others' | '';
    guardianOthersDetail: string;
  };
  helpNeeded: string[];
  helpNeededOther: string;
  studentFinance: {
    incomeSource: string;
    occupation: string;
    dailyIncome: number;
    dailyAllowance: number;
    hasWork: boolean;
    workDescription: string;
    hasDebt: boolean;
    debtAmount: number;
  };
  parentNeeds: {
    education: boolean;
    behavior: boolean;
    economy: boolean;
    others: string;
  };
  assistanceReceived: {
    elderly: boolean;
    disability: boolean;
    others: string;
    details: string;
  };
  parentConcerns: string;
  teacherSummary: string;
  behaviorRisks: {
    health: string[];
    safety: string[];
    study: string[];
    social: string[];
    distanceToSchool: number;
    travelTimeHours: number;
    travelTimeMinutes: number;
    travelMethod: string;
    responsibilities: string[];
    responsibilitiesOtherDetail: string;
    hobbies: string[];
    hobbiesOtherDetail: string;
    drugUse: string[];
    violence: string[];
    sexualBehavior: string[];
    gameAddiction: string[];
    gameAddictionOtherDetail: string;
    internetAccess: string;
    electronicUse: string[];
  };
  informant: string;
  parentSignatureName: string;
  parentSignature: string;
  photos: {
    student: string;
    exterior: string;
    interior: string;
    studentWithTeacher: string;
  };
  photoCategory: string;
  certification: {
    signerName: string;
    position: string;
    day: string;
    month: string;
    year: string;
  };
}

const initialFormState: HomeVisitData = {
  schoolName: '',
  district: '',
  visitDate: format(new Date(), 'yyyy-MM-dd'),
  studentIdCard: '',
  studentAddress: '',
  gpsLocation: { lat: 0, lng: 0 },
  parentName: '',
  parentSurname: '',
  parentPhone: '',
  parentRelationship: '',
  parentOccupation: '',
  parentEducation: '',
  parentIdCard: '',
  hasNoParent: false,
  hasNoIdCard: false,
  isWelfareRegistered: false,
  householdMembers: Array.from({ length: 10 }, (_, i) => ({
    id: (i + 1).toString(),
    relationship: '',
    age: 0,
    education: '',
    occupation: '',
    disability: false,
    incomeWages: 0,
    incomeAgri: 0,
    incomeBusiness: 0,
    incomeWelfare: 0,
    incomeOther: 0,
    totalIncome: 0
  })),
  householdStatus: {
    hasDisabled: false,
    hasElderly: false,
    isSingleParent: false,
    hasUnemployed: false,
    housingType: '',
    housingCondition: '',
    housingMaterial: '',
    noToilet: false,
    utilities: {
      electricity: true,
      water: true
    },
    vehicles: { car: false, pickup: false, tractor: false, motorcycle: false },
    isFarmer: false,
    landSize: '',
    averageIncomePerPerson: 0
  },
  familyRelationship: {
    timeTogether: 0,
    activities: '',
    memberRelations: {
      'บิดา': '',
      'มารดา': '',
      'พี่ชาย/น้องชาย': '',
      'พี่สาว/น้องสาว': '',
      'ปู่/ย่า/ตา/ยาย': '',
      'ญาติ': '',
      'อื่นๆ': ''
    },
    memberRelationsOtherDetail: '',
    guardianIfAbsent: '',
    guardianOthersDetail: ''
  },
  helpNeeded: [],
  helpNeededOther: '',
  studentFinance: {
    incomeSource: '',
    occupation: '',
    dailyIncome: 0,
    dailyAllowance: 0,
    hasWork: false,
    workDescription: '',
    hasDebt: false,
    debtAmount: 0
  },
  parentNeeds: {
    education: false,
    behavior: false,
    economy: false,
    others: ''
  },
  assistanceReceived: {
    elderly: false,
    disability: false,
    others: '',
    details: ''
  },
  parentConcerns: '',
  teacherSummary: '',
  behaviorRisks: {
    health: [],
    safety: [],
    study: [],
    social: [],
    distanceToSchool: 0,
    travelTimeHours: 0,
    travelTimeMinutes: 0,
    travelMethod: '',
    responsibilities: [],
    responsibilitiesOtherDetail: '',
    hobbies: [],
    hobbiesOtherDetail: '',
    drugUse: [],
    violence: [],
    sexualBehavior: [],
    gameAddiction: [],
    gameAddictionOtherDetail: '',
    internetAccess: '',
    electronicUse: []
  },
  informant: '',
  parentSignatureName: '',
  parentSignature: '',
  photos: {
    student: '',
    exterior: '',
    interior: '',
    studentWithTeacher: ''
  },
  photoCategory: '',
  certification: {
    signerName: '',
    position: '',
    day: '',
    month: '',
    year: ''
  }
};

export default function HomeVisitSystem() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [formData, setFormData] = useState<HomeVisitData>(initialFormState);
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const signaturePadRef = useRef<SignatureCanvas>(null);

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfVisitData, setPdfVisitData] = useState<any>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    fetchStudents();
    fetchVisits();
    fetchUserProfile();
  }, []);

  const formatThaiDate = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      const date = toDate(dateVal);
      const day = date.getDate();
      const month = format(date, 'MMMM', { locale: th });
      const year = date.getFullYear() + 543;
      return `${day} ${month} พ.ศ. ${year}`;
    } catch (e) {
      return String(dateVal);
    }
  };

  const fetchStudents = async () => {
    try {
      const q = query(collection(db, 'students'), orderBy('studentId'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'students');
    }
  };

  const fetchVisits = async () => {
    try {
      const q = query(collection(db, 'homeVisits'), orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVisits(data);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'homeVisits');
    }
  };

  const fetchUserProfile = async () => {
    if (!auth.currentUser) return;
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${auth.currentUser.uid}`);
    }
  };

  const handleSave = async () => {
    if (!selectedStudentId) {
      setNotification({ type: 'error', message: 'กรุณาเลือกนักเรียน' });
      return;
    }
    setLoading(true);
    try {
      const visitData = {
        ...formData,
        studentId: selectedStudentId,
        teacherId: auth.currentUser?.uid,
        teacherName: userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : 'ไม่ระบุ',
        date: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'homeVisits'), visitData);
      setNotification({ type: 'success', message: 'บันทึกข้อมูลสำเร็จ' });
      fetchVisits();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'homeVisits');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: keyof HomeVisitData['photos']) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData(prev => ({
        ...prev,
        photos: { ...prev.photos, [field]: base64 }
      }));
    };
    reader.readAsDataURL(file);
  };

  const updateMember = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      householdMembers: prev.householdMembers.map(m => 
        m.id === id ? { ...m, [field]: value } : m
      )
    }));
  };

  const toggleBehaviorRisk = (category: keyof HomeVisitData['behaviorRisks'], value: string) => {
    setFormData(prev => {
      const current = (prev.behaviorRisks[category] as string[]) || [];
      const updated = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      return {
        ...prev,
        behaviorRisks: { ...prev.behaviorRisks, [category]: updated }
      };
    });
  };

  const downloadWord = async (visit: any) => {
    try {
      await exportToWord(visit);
      setNotification({ type: 'success', message: 'สร้างไฟล์ Word สำเร็จ' });
    } catch (error) {
      console.error('Error exporting to Word:', error);
      setNotification({ type: 'error', message: 'เกิดข้อผิดพลาดในการสร้างไฟล์ Word' });
    }
  };

  const downloadPDF = async (visit: any) => {
    setPdfVisitData(visit);
    setIsGeneratingPDF(true);
    
    // Wait for the hidden container to render
    setTimeout(async () => {
      if (!pdfContainerRef.current) return;
      
      try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pages = pdfContainerRef.current.children;
        
        for (let i = 0; i < pages.length; i++) {
          const canvas = await html2canvas(pages[i] as HTMLElement, {
            scale: 2,
            useCORS: true,
            logging: false
          });
          const imgData = canvas.toDataURL('image/jpeg', 1.0);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }
        
        const student = students.find(s => s.id === visit.studentId);
        pdf.save(`Home_Visit_${student?.firstName || 'Report'}.pdf`);
        setNotification({ type: 'success', message: 'สร้างไฟล์ PDF สำเร็จ' });
      } catch (error) {
        console.error('Error generating PDF:', error);
        setNotification({ type: 'error', message: 'เกิดข้อผิดพลาดในการสร้าง PDF' });
      } finally {
        setIsGeneratingPDF(false);
        setPdfVisitData(null);
      }
    }, 500);
  };

  const renderPage1 = (data: HomeVisitData, isPDF = false) => {
    const student = students.find(s => s.id === selectedStudentId);
    
    const renderIdCardBoxes = (idCard: string = '') => {
      const chars = idCard.replace(/-/g, '').padEnd(13, ' ').split('');
      return (
        <div className="flex gap-1">
          {chars.map((char, i) => (
            <div key={i} className={cn(
              "w-5 h-6 border border-slate-400 flex items-center justify-center font-bold text-blue-800 bg-white",
              (i === 0 || i === 4 || i === 9 || i === 11) && "mr-1"
            )}>
              {char}
            </div>
          ))}
        </div>
      );
    };

    return (
      <div 
        className={cn(
          "bg-white relative text-slate-800 font-sans leading-relaxed border border-slate-200",
          isPDF ? "p-[1.5cm] w-[210mm] min-h-[29.7cm] text-[12px]" : "shadow-2xl mx-auto p-[1.5cm] md:p-[2cm] min-h-[29.7cm] text-sm"
        )}
        id={isPDF ? undefined : "form-page-1"}
        style={{ fontFamily: "'Sarabun', sans-serif" }}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1"></div>
          <div className="text-center flex-1">
            <h2 className="text-2xl font-bold text-slate-900">บันทึกการเยี่ยมบ้าน</h2>
          </div>
          <div className="flex-1 text-right text-xs text-slate-400">หน้า 1/4</div>
        </div>

        <div className="border-t border-slate-800 my-4"></div>

        <div className="space-y-4">
          <div>
            <p className="font-bold">คำชี้แจง :</p>
            <ul className="list-disc list-inside pl-4 space-y-1 text-[11px]">
              <li>แบบบันทึกการเยี่ยมบ้านฉบับนี้รวมการคัดกรองนักเรียนยากจนเข้าด้วยกัน เพื่อให้คุณครูสามารถลงพื้นที่ได้พร้อมกันในครั้งเดียว</li>
              <li>การตอบแบบสอบถาม : หากเป็นตัวเลือก ○ หมายถึง ให้ตอบเพียงข้อเดียว และ หากเป็นตัวเลือก □ หมายถึง ให้ตอบได้มากกว่า 1 ข้อ</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span>โรงเรียน</span>
            <input 
              type="text" 
              value={data.schoolName}
              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, schoolName: e.target.value }))}
              className="flex-1 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
              readOnly={isPDF}
            />
            <span>สพป./สพม.</span>
            <input 
              type="text" 
              value={data.district}
              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, district: e.target.value }))}
              className="flex-1 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
              readOnly={isPDF}
            />
            <span>วันที่เยี่ยมบ้าน</span>
            <input 
              type="date" 
              value={data.visitDate}
              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, visitDate: e.target.value }))}
              className="w-32 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
              readOnly={isPDF}
            />
          </div>

          <div className="relative">
            {/* Student Photo Placeholder */}
            <div className="absolute top-0 right-0 w-24 h-32 border border-slate-400 flex flex-col items-center justify-center text-[10px] text-slate-400 text-center p-1 bg-white">
              {data.photos.student || student?.photoUrl ? (
                <img src={data.photos.student || student?.photoUrl} className="w-full h-full object-cover" alt="Student" />
              ) : (
                <>
                  <span>รูปถ่าย</span>
                  <div className="my-2"></div>
                  <span>นักเรียน</span>
                </>
              )}
              {!isPDF && <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'student')} className="absolute inset-0 opacity-0 cursor-pointer" />}
            </div>

            <div className="space-y-3 pr-28">
              <div className="flex flex-wrap gap-2 items-center">
                <span>1. ชื่อนักเรียน</span>
                <input 
                  type="text" 
                  value={student ? `${student.firstName}` : ''}
                  className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly
                />
                <span>นามสกุล</span>
                <input 
                  type="text" 
                  value={student ? `${student.lastName}` : ''}
                  className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly
                />
                <span>ชั้น</span>
                <input 
                  type="text" 
                  value={student?.classId || ''}
                  className="w-20 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly
                />
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <span>เลขที่บัตรประชาชน</span>
                {renderIdCardBoxes(data.studentIdCard)}
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span>2. ชื่อผู้ปกครองนักเรียน</span>
                <input 
                  type="text" 
                  value={data.parentName}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                  className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>นามสกุล</span>
                <input 
                  type="text" 
                  value={data.parentSurname}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentSurname: e.target.value }))}
                  className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>เบอร์โทรศัพท์</span>
                <input 
                  type="text" 
                  value={data.parentPhone}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
                  className="w-32 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <label className="flex items-center gap-1 cursor-pointer">
                  <div className={cn("w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center", data.hasNoParent && "bg-blue-600 border-blue-600")}>
                    {data.hasNoParent && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <input type="checkbox" checked={data.hasNoParent} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, hasNoParent: e.target.checked }))} className="hidden" />
                  <span>ไม่มีผู้ปกครอง</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span>ความสัมพันธ์ของผู้ปกครองกับนักเรียน</span>
                <input 
                  type="text" 
                  value={data.parentRelationship}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentRelationship: e.target.value }))}
                  className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>อาชีพ</span>
                <input 
                  type="text" 
                  value={data.parentOccupation}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentOccupation: e.target.value }))}
                  className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>การศึกษาสูงสุด</span>
                <input 
                  type="text" 
                  value={data.parentEducation}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentEducation: e.target.value }))}
                  className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly={isPDF}
                />
              </div>

              <div className="flex flex-wrap gap-4 items-center">
                <span>เลขที่บัตรประชาชน</span>
                {renderIdCardBoxes(data.parentIdCard)}
                <label className="flex items-center gap-1 cursor-pointer">
                  <div className={cn("w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center", data.hasNoIdCard && "bg-blue-600 border-blue-600")}>
                    {data.hasNoIdCard && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <input type="checkbox" checked={data.hasNoIdCard} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, hasNoIdCard: e.target.checked }))} className="hidden" />
                  <span>ไม่มีบัตรประจำตัวประชาชน</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <div className={cn("w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center", data.isWelfareRegistered && "bg-blue-600 border-blue-600")}>
                    {data.isWelfareRegistered && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  <input type="checkbox" checked={data.isWelfareRegistered} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, isWelfareRegistered: e.target.checked }))} className="hidden" />
                  <span>เคยลงทะเบียนเพื่อสวัสดิการแห่งรัฐ (ลงทะเบียนคนจน)</span>
                </label>
              </div>
            </div>
          </div>

          <div>
            <p className="font-bold">3. จำนวนสมาชิกในครัวเรือน (รวมตัวนักเรียน) <input type="number" value={data.householdMembers.length} className="w-10 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800" readOnly /> คน มีรายละเอียดดังนี้ (กรอกเฉพาะนักเรียนยากจนเท่านั้น)</p>
            <div className="mt-2">
              <table className="w-full border-collapse border border-slate-800 text-[10px]">
                <thead>
                  <tr>
                    <th rowSpan={2} className="border border-slate-800 p-1 w-8">คนที่</th>
                    <th rowSpan={2} className="border border-slate-800 p-1">ความสัมพันธ์กับนักเรียน</th>
                    <th rowSpan={2} className="border border-slate-800 p-1 w-10">อายุ</th>
                    <th rowSpan={2} className="border border-slate-800 p-1 w-24">ความพิการทางร่างกาย/สติปัญญา (ใส่เครื่องหมาย ✓ หรือ - )</th>
                    <th colSpan={5} className="border border-slate-800 p-1">รายได้เฉลี่ยต่อเดือนแยกตามประเภท (บาท/เดือน)</th>
                    <th rowSpan={2} className="border border-slate-800 p-1 w-16">รายได้รวมเฉลี่ยต่อเดือน</th>
                  </tr>
                  <tr>
                    <th className="border border-slate-800 p-1 w-16">ค่าจ้าง เงินเดือน</th>
                    <th className="border border-slate-800 p-1 w-16">ประกอบอาชีพทางการเกษตร (หลังหักค่าใช้จ่าย)</th>
                    <th className="border border-slate-800 p-1 w-16">ธุรกิจส่วนตัว (หลังหักค่าใช้จ่าย)</th>
                    <th className="border border-slate-800 p-1 w-16">สวัสดิการจากรัฐ/เอกชน (เงินบำนาญ, เบี้ยผู้สูงอายุ, อุดหนุนเด็กแรกเกิด, อุดหนุนคนพิการ, อื่นๆ)</th>
                    <th className="border border-slate-800 p-1 w-16">รายได้จากแหล่งอื่น (เงินโอน, ค่าเช่า, ดอกเบี้ย, อื่นๆ)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.householdMembers.slice(0, 10).map((member, idx) => {
                    const total = member.incomeWages + member.incomeAgri + member.incomeBusiness + member.incomeWelfare + member.incomeOther;
                    return (
                      <tr key={member.id}>
                        <td className="border border-slate-800 p-1 text-center">{idx + 1}</td>
                        <td className="border border-slate-800 p-1">
                          <input type="text" value={member.relationship} onChange={(e) => !isPDF && updateMember(member.id, 'relationship', e.target.value)} className="w-full outline-none bg-transparent font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1 text-center">
                          <input type="number" value={member.age || ''} onChange={(e) => !isPDF && updateMember(member.id, 'age', Number(e.target.value))} className="w-full outline-none bg-transparent text-center font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1 text-center">
                          <input type="text" value={member.disability ? '✓' : '-'} onChange={(e) => !isPDF && updateMember(member.id, 'disability', e.target.value === '✓')} className="w-full outline-none bg-transparent text-center font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1">
                          <input type="number" value={member.incomeWages || ''} onChange={(e) => !isPDF && updateMember(member.id, 'incomeWages', Number(e.target.value))} className="w-full outline-none bg-transparent text-right font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1">
                          <input type="number" value={member.incomeAgri || ''} onChange={(e) => !isPDF && updateMember(member.id, 'incomeAgri', Number(e.target.value))} className="w-full outline-none bg-transparent text-right font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1">
                          <input type="number" value={member.incomeBusiness || ''} onChange={(e) => !isPDF && updateMember(member.id, 'incomeBusiness', Number(e.target.value))} className="w-full outline-none bg-transparent text-right font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1">
                          <input type="number" value={member.incomeWelfare || ''} onChange={(e) => !isPDF && updateMember(member.id, 'incomeWelfare', Number(e.target.value))} className="w-full outline-none bg-transparent text-right font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1">
                          <input type="number" value={member.incomeOther || ''} onChange={(e) => !isPDF && updateMember(member.id, 'incomeOther', Number(e.target.value))} className="w-full outline-none bg-transparent text-right font-bold text-blue-800" readOnly={isPDF} />
                        </td>
                        <td className="border border-slate-800 p-1 text-right font-bold text-blue-800">{total > 0 ? total.toLocaleString() : ''}</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td colSpan={9} className="border border-slate-800 p-1 font-bold">รวมรายได้ครัวเรือน (รายการที่ 1 - 10)</td>
                    <td className="border border-slate-800 p-1 text-right font-bold text-blue-800">
                      {data.householdMembers.reduce((sum, m) => sum + m.incomeWages + m.incomeAgri + m.incomeBusiness + m.incomeWelfare + m.incomeOther, 0).toLocaleString()}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={9} className="border border-slate-800 p-1 font-bold">รายได้ครัวเรือนเฉลี่ยต่อคน (รวมรายได้ครัวเรือน หารด้วยจำนวนสมาชิกทั้งหมด จากข้อ 2)</td>
                    <td className="border border-slate-800 p-1 text-right font-bold text-blue-800">
                      {(data.householdMembers.reduce((sum, m) => sum + m.incomeWages + m.incomeAgri + m.incomeBusiness + m.incomeWelfare + m.incomeOther, 0) / (data.householdMembers.length || 1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-bold">4. สถานะของครัวเรือน กรอกเฉพาะบุคคลที่อาศัยในบ้านปัจจุบัน</p>
            <div className="pl-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="font-bold text-[11px]">4.1. ครัวเรือนมีภาระพึ่งพิง ดังนี้</p>
                  <div className="pl-4 space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.hasDisabled && "bg-slate-800")}>
                        {data.householdStatus.hasDisabled && <div className="w-1.5 h-1.5 bg-white"></div>}
                      </div>
                      <input type="checkbox" checked={data.householdStatus.hasDisabled} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, hasDisabled: e.target.checked } }))} className="hidden" />
                      <span>มีคนพิการ</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.hasElderly && "bg-slate-800")}>
                        {data.householdStatus.hasElderly && <div className="w-1.5 h-1.5 bg-white"></div>}
                      </div>
                      <input type="checkbox" checked={data.householdStatus.hasElderly} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, hasElderly: e.target.checked } }))} className="hidden" />
                      <span>มีผู้สูงอายุเกิน 60 ปี</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.isSingleParent && "bg-slate-800")}>
                        {data.householdStatus.isSingleParent && <div className="w-1.5 h-1.5 bg-white"></div>}
                      </div>
                      <input type="checkbox" checked={data.householdStatus.isSingleParent} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, isSingleParent: e.target.checked } }))} className="hidden" />
                      <span>เป็นพ่อ/แม่เลี้ยงเดี่ยว</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.hasUnemployed && "bg-slate-800")}>
                        {data.householdStatus.hasUnemployed && <div className="w-1.5 h-1.5 bg-white"></div>}
                      </div>
                      <input type="checkbox" checked={data.householdStatus.hasUnemployed} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, hasUnemployed: e.target.checked } }))} className="hidden" />
                      <span>มีคนอายุ 15-65 ปี ว่างงาน (ที่ไม่ใช่นักเรียน/นักศึกษา)</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[11px]">4.2. ประเภทที่อยู่อาศัย ดังนี้</p>
                  <div className="pl-4 space-y-1">
                    {[
                      { label: 'บ้านของตนเอง', value: 'own' },
                      { label: 'บ้านเช่า', value: 'rent' },
                      { label: 'อาศัยอยู่กับผู้อื่น', value: 'others' }
                    ].map(v => (
                      <label key={v.value} className="flex items-center gap-2 cursor-pointer">
                        <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", data.householdStatus.housingType === v.value && "bg-slate-800")}>
                          {data.householdStatus.housingType === v.value && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </div>
                        <input type="radio" name="housingType" checked={data.householdStatus.housingType === v.value} onChange={() => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, housingType: v.value as any } }))} className="hidden" />
                        <span>{v.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[11px]">4.3 สภาพที่อยู่อาศัย ดังนี้</p>
                <div className="pl-4 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.housingCondition === 'dilapidated' && "bg-slate-800")}>
                      {data.householdStatus.housingCondition === 'dilapidated' && <div className="w-1.5 h-1.5 bg-white"></div>}
                    </div>
                    <input type="checkbox" checked={data.householdStatus.housingCondition === 'dilapidated'} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, housingCondition: e.target.checked ? 'dilapidated' : '' } }))} className="hidden" />
                    <span>สภาพบ้านชำรุดทรุดโทรม หรือ บ้านทำจากวัสดุพื้นบ้าน เช่น ไม้ไผ่ ใบจากหรือวัสดุเหลือใช้</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.noToilet && "bg-slate-800")}>
                      {data.householdStatus.noToilet && <div className="w-1.5 h-1.5 bg-white"></div>}
                    </div>
                    <input type="checkbox" checked={data.householdStatus.noToilet} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, noToilet: e.target.checked } }))} className="hidden" />
                    <span>ไม่มีห้องส้วมในที่อยู่อาศัยและบริเวณ</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[11px]">4.4 ยานพาหนะของครอบครัว</p>
                <div className="pl-4 grid grid-cols-2 gap-x-8 gap-y-1">
                  {[
                    { label: '- รถยนต์ส่วนบุคคล', field: 'car' },
                    { label: '- รถปิกอัพ/รถบรรทุกเล็ก/รถตู้', field: 'pickup' },
                    { label: '- รถไถ/เกี่ยวข้าว/รถอีแต๋น/อื่นๆ ประเภทเดียวกัน', field: 'tractor' }
                  ].map(v => (
                    <React.Fragment key={v.field}>
                      <span>{v.label}</span>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", data.householdStatus.vehicles[v.field as keyof typeof data.householdStatus.vehicles] && "bg-slate-800")}>
                            {data.householdStatus.vehicles[v.field as keyof typeof data.householdStatus.vehicles] && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                          </div>
                          <input type="radio" checked={data.householdStatus.vehicles[v.field as keyof typeof data.householdStatus.vehicles]} onChange={() => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, vehicles: { ...prev.householdStatus.vehicles, [v.field]: true } } }))} className="hidden" />
                          <span>มี</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", !data.householdStatus.vehicles[v.field as keyof typeof data.householdStatus.vehicles] && "bg-slate-800")}>
                            {!data.householdStatus.vehicles[v.field as keyof typeof data.householdStatus.vehicles] && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                          </div>
                          <input type="radio" checked={!data.householdStatus.vehicles[v.field as keyof typeof data.householdStatus.vehicles]} onChange={() => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, vehicles: { ...prev.householdStatus.vehicles, [v.field]: false } } }))} className="hidden" />
                          <span>ไม่มี</span>
                        </label>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-[11px]">4.5 เป็นเกษตรกร มีที่ดินทำกิน (รวมเช่า)</p>
                <div className="pl-4 flex gap-8">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.landSize === 'lessThan1' && "bg-slate-800")}>
                      {data.householdStatus.landSize === 'lessThan1' && <div className="w-1.5 h-1.5 bg-white"></div>}
                    </div>
                    <input type="checkbox" checked={data.householdStatus.landSize === 'lessThan1'} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, landSize: e.target.checked ? 'lessThan1' : '' } }))} className="hidden" />
                    <span>ไม่เกิน 1 ไร่</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.householdStatus.landSize === 'noLand' && "bg-slate-800")}>
                      {data.householdStatus.landSize === 'noLand' && <div className="w-1.5 h-1.5 bg-white"></div>}
                    </div>
                    <input type="checkbox" checked={data.householdStatus.landSize === 'noLand'} onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, landSize: e.target.checked ? 'noLand' : '' } }))} className="hidden" />
                    <span>ไม่มีที่ดินเป็นของตนเอง</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPage2 = (data: HomeVisitData, isPDF = false) => (
    <div 
      className={cn(
        "bg-white relative text-slate-800 font-sans leading-relaxed border border-slate-200",
        isPDF ? "p-[1.5cm] w-[210mm] min-h-[29.7cm] text-[12px]" : "shadow-2xl mx-auto p-[1.5cm] md:p-[2cm] min-h-[29.7cm] text-sm"
      )}
      id={isPDF ? undefined : "form-page-2"}
      style={{ fontFamily: "'Sarabun', sans-serif" }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1"></div>
        <div className="text-center flex-1">
          <h2 className="text-2xl font-bold text-slate-900">บันทึกการเยี่ยมบ้าน</h2>
        </div>
        <div className="flex-1 text-right text-xs text-slate-400">หน้า 2/4</div>
      </div>

      <div className="border-t border-slate-800 my-4"></div>

      <div className="space-y-6">
        {/* Section 5 */}
        <div className="space-y-3">
          <p className="font-bold">5. ความสัมพันธ์ในครอบครัว</p>
          <div className="pl-4 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span>5.1 สมาชิกในครอบครัวมีเวลาอยู่ร่วมกันกี่ชั่วโมงต่อวัน</span>
              <input 
                type="number" 
                value={data.familyRelationship.timeTogether || ''}
                onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, familyRelationship: { ...prev.familyRelationship, timeTogether: Number(e.target.value) } }))}
                className="w-20 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
                readOnly={isPDF}
              />
              <span>ชั่วโมง/วัน</span>
            </div>

            <div className="space-y-2">
              <span>5.2 ความสัมพันธ์ระหว่างนักเรียนกับสมาชิกในครอบครัว</span>
              <table className="w-full border-collapse border border-slate-800 text-center text-[11px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-800 p-1 w-1/3">สมาชิก</th>
                    <th className="border border-slate-800 p-1">สนิทสนม</th>
                    <th className="border border-slate-800 p-1">เฉยๆ</th>
                    <th className="border border-slate-800 p-1">ห่างเหิน</th>
                    <th className="border border-slate-800 p-1">ขัดแย้ง</th>
                    <th className="border border-slate-800 p-1">ไม่มี</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'บิดา', label: 'บิดา' },
                    { id: 'มารดา', label: 'มารดา' },
                    { id: 'พี่ชาย/น้องชาย', label: 'พี่ชาย/น้องชาย' },
                    { id: 'พี่สาว/น้องสาว', label: 'พี่สาว/น้องสาว' },
                    { id: 'ปู่/ย่า/ตา/ยาย', label: 'ปู่/ย่า/ตา/ยาย' },
                    { id: 'ญาติ', label: 'ญาติ' },
                    { id: 'อื่นๆ', label: 'อื่นๆ' }
                  ].map((row) => (
                    <tr key={row.id}>
                      <td className="border border-slate-800 p-1 text-left pl-2">
                        {row.id === 'อื่นๆ' ? (
                          <div className="flex items-center gap-1">
                            <span>อื่นๆ</span>
                            <input 
                              type="text" 
                              value={data.familyRelationship.memberRelationsOtherDetail || ''}
                              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, familyRelationship: { ...prev.familyRelationship, memberRelationsOtherDetail: e.target.value } }))}
                              className="flex-1 border-b border-dotted border-slate-400 outline-none bg-transparent px-1"
                              readOnly={isPDF}
                            />
                          </div>
                        ) : row.label}
                      </td>
                      {['close', 'normal', 'distant', 'conflict', 'none'].map((level) => (
                        <td key={level} className="border border-slate-800 p-1">
                          <label className="flex items-center justify-center cursor-pointer h-full w-full">
                            <div className={cn(
                              "w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center",
                              data.familyRelationship.memberRelations[row.id] === level && "bg-slate-800"
                            )}>
                              {data.familyRelationship.memberRelations[row.id] === level && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                            </div>
                            <input 
                              type="radio" 
                              name={`relation-${row.id}`}
                              checked={data.familyRelationship.memberRelations[row.id] === level}
                              onChange={() => !isPDF && setFormData(prev => ({ 
                                ...prev, 
                                familyRelationship: { 
                                  ...prev.familyRelationship, 
                                  memberRelations: { ...prev.familyRelationship.memberRelations, [row.id]: level as any } 
                                } 
                              }))}
                              className="hidden"
                            />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
              <span>5.3 กรณีที่ผู้ปกครองไม่อยู่บ้านฝากเด็กนักเรียนอยู่บ้านกับใคร (ตอบเพียง 1 ข้อ)</span>
              <div className="flex flex-wrap gap-4 pl-4">
                {[
                  { id: 'relatives', label: 'ญาติ' },
                  { id: 'neighbors', label: 'เพื่อนบ้าน' },
                  { id: 'alone', label: 'นักเรียนอยู่บ้านด้วยตนเอง' },
                  { id: 'others', label: 'อื่น ๆ ระบุ' }
                ].map((v) => (
                  <label key={v.id} className="flex items-center gap-1 cursor-pointer">
                    <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", data.familyRelationship.guardianIfAbsent === v.id && "bg-slate-800")}>
                      {data.familyRelationship.guardianIfAbsent === v.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                    </div>
                    <input 
                      type="radio" 
                      name="guardianIfAbsent"
                      checked={data.familyRelationship.guardianIfAbsent === v.id} 
                      onChange={() => !isPDF && setFormData(prev => ({ ...prev, familyRelationship: { ...prev.familyRelationship, guardianIfAbsent: v.id as any } }))} 
                      className="hidden" 
                    />
                    <span>{v.label}</span>
                    {v.id === 'others' && data.familyRelationship.guardianIfAbsent === 'others' && (
                      <input 
                        type="text" 
                        value={data.familyRelationship.guardianOthersDetail || ''}
                        onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, familyRelationship: { ...prev.familyRelationship, guardianOthersDetail: e.target.value } }))}
                        className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                        readOnly={isPDF}
                      />
                    )}
                  </label>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );

  const renderPage3 = (data: HomeVisitData, isPDF = false) => (
    <div 
      className={cn(
        "bg-white relative text-slate-800 font-sans leading-relaxed border border-slate-200",
        isPDF ? "p-[1.5cm] w-[210mm] min-h-[29.7cm] text-[11px]" : "shadow-2xl mx-auto p-[1.5cm] md:p-[2cm] min-h-[29.7cm] text-sm"
      )}
      id={isPDF ? undefined : "form-page-3"}
      style={{ fontFamily: "'Sarabun', sans-serif" }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1"></div>
        <div className="text-center flex-1">
          <h2 className="text-xl font-bold text-slate-900">บันทึกการเยี่ยมบ้าน</h2>
        </div>
        <div className="flex-1 text-right text-xs text-slate-400">หน้า 3/4</div>
      </div>

      <div className="border-t border-slate-800 my-2"></div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span>5.4 รายได้ครัวเรือนเฉลี่ยต่อคน (รวมรายได้ครัวเรือน หารด้วยจำนวนสมาชิกทั้งหมด)</span>
          <input 
            type="number" 
            value={data.householdStatus.averageIncomePerPerson || ''}
            onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, householdStatus: { ...prev.householdStatus, averageIncomePerPerson: Number(e.target.value) } }))}
            className="w-32 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
            readOnly={isPDF}
          />
          <span>บาท (กรอกเฉพาะกรณีนักเรียนไม่ยากจนเท่านั้น)</span>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span>5.5 นักเรียนได้รับค่าใช้จ่ายจาก</span>
            <input 
              type="text" 
              value={data.studentFinance.incomeSource || ''}
              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, incomeSource: e.target.value } }))}
              className="w-48 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
              readOnly={isPDF}
            />
            <span>นักเรียนทำงานหารายได้ อาชีพ</span>
            <input 
              type="text" 
              value={data.studentFinance.occupation || ''}
              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, occupation: e.target.value } }))}
              className="w-48 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
              readOnly={isPDF}
            />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span>รายได้วันละ</span>
            <input 
              type="number" 
              value={data.studentFinance.dailyIncome || ''}
              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, dailyIncome: Number(e.target.value) } }))}
              className="w-32 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
              readOnly={isPDF}
            />
            <span>บาท</span>
            <span>นักเรียนได้เงินมาโรงเรียนวันละ</span>
            <input 
              type="number" 
              value={data.studentFinance.dailyAllowance || ''}
              onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, dailyAllowance: Number(e.target.value) } }))}
              className="w-32 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
              readOnly={isPDF}
            />
            <span>บาท</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span>นักเรียนทำงานหารายได้พิเศษ</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", data.studentFinance.hasWork && "bg-slate-800")}>
                {data.studentFinance.hasWork && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              </div>
              <input type="radio" checked={data.studentFinance.hasWork} onChange={() => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, hasWork: true } }))} className="hidden" />
              <span>มี</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", !data.studentFinance.hasWork && "bg-slate-800")}>
                {!data.studentFinance.hasWork && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              </div>
              <input type="radio" checked={!data.studentFinance.hasWork} onChange={() => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, hasWork: false } }))} className="hidden" />
              <span>ไม่มี</span>
            </label>
            {data.studentFinance.hasWork && (
              <>
                <span>ระบุ</span>
                <input 
                  type="text" 
                  value={data.studentFinance.workDescription || ''}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, workDescription: e.target.value } }))}
                  className="w-48 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                  readOnly={isPDF}
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
            <span>ภาระหนี้สินของครัวเรือน</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", data.studentFinance.hasDebt && "bg-slate-800")}>
                {data.studentFinance.hasDebt && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              </div>
              <input type="radio" checked={data.studentFinance.hasDebt} onChange={() => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, hasDebt: true } }))} className="hidden" />
              <span>มี</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", !data.studentFinance.hasDebt && "bg-slate-800")}>
                {!data.studentFinance.hasDebt && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              </div>
              <input type="radio" checked={!data.studentFinance.hasDebt} onChange={() => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, hasDebt: false } }))} className="hidden" />
              <span>ไม่มี</span>
            </label>
            {data.studentFinance.hasDebt && (
              <>
                <span>จำนวน</span>
                <input 
                  type="number" 
                  value={data.studentFinance.debtAmount || ''}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, studentFinance: { ...prev.studentFinance, debtAmount: Number(e.target.value) } }))}
                  className="w-32 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>บาท</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
          <span>5.6 สิ่งที่ผู้ปกครองต้องการให้โรงเรียนช่วยเหลือนักเรียน</span>
          <div className="flex flex-wrap gap-4 pl-4">
            {['ด้านการเรียน', 'ด้านพฤติกรรม', 'ด้านเศรษฐกิจ (เช่น ขอรับทุน)', 'อื่นๆ ระบุ'].map((v) => (
              <label key={v} className="flex items-center gap-1 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.helpNeeded?.includes(v) && "bg-slate-800")}>
                  {data.helpNeeded?.includes(v) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input 
                  type="checkbox" 
                  checked={data.helpNeeded?.includes(v)} 
                  onChange={() => {
                    if (!isPDF) {
                      const current = data.helpNeeded || [];
                      const updated = current.includes(v) ? current.filter(item => item !== v) : [...current, v];
                      setFormData(prev => ({ ...prev, helpNeeded: updated }));
                    }
                  }} 
                  className="hidden" 
                />
                <span>{v}</span>
                {v === 'อื่นๆ ระบุ' && data.helpNeeded?.includes('อื่นๆ ระบุ') && (
                  <input 
                    type="text" 
                    value={data.helpNeededOther || ''}
                    onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, helpNeededOther: e.target.value }))}
                    className="w-40 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                    readOnly={isPDF}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
          <span>5.7 ความช่วยเหลือที่ครอบครัวเคยได้รับจากหน่วยงานหรือต้องการได้รับความช่วยเหลือ</span>
          <div className="flex flex-wrap gap-4 pl-4">
            {[
              { id: 'elderly', label: 'เบี้ยผู้สูงอายุ' },
              { id: 'disability', label: 'เบี้ยพิการ' },
              { id: 'others', label: 'อื่นๆ ระบุ' }
            ].map((v) => (
              <label key={v.id} className="flex items-center gap-1 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", (v.id === 'others' ? !!data.assistanceReceived.others : data.assistanceReceived[v.id as keyof typeof data.assistanceReceived]) && "bg-slate-800")}>
                  {(v.id === 'others' ? !!data.assistanceReceived.others : data.assistanceReceived[v.id as keyof typeof data.assistanceReceived]) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input 
                  type="checkbox" 
                  checked={v.id === 'others' ? !!data.assistanceReceived.others : !!data.assistanceReceived[v.id as keyof typeof data.assistanceReceived]} 
                  onChange={(e) => {
                    if (!isPDF) {
                      if (v.id === 'others') {
                        setFormData(prev => ({ ...prev, assistanceReceived: { ...prev.assistanceReceived, others: e.target.checked ? 'ระบุ...' : '' } }));
                      } else {
                        setFormData(prev => ({ ...prev, assistanceReceived: { ...prev.assistanceReceived, [v.id]: e.target.checked } }));
                      }
                    }
                  }} 
                  className="hidden" 
                />
                <span>{v.label}</span>
                {v.id === 'others' && data.assistanceReceived.others && (
                  <input 
                    type="text" 
                    value={data.assistanceReceived.details || ''}
                    onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, assistanceReceived: { ...prev.assistanceReceived, details: e.target.value } }))}
                    className="w-64 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                    readOnly={isPDF}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span>5.8 ข้อห่วงใยของผู้ปกครองที่มีต่อนักเรียน</span>
          <textarea 
            value={data.parentConcerns || ''}
            onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentConcerns: e.target.value }))}
            className="w-full border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800 resize-none overflow-hidden min-h-[4rem]"
            rows={2}
            readOnly={isPDF}
            style={{ backgroundImage: 'linear-gradient(transparent, transparent 31px, #94a3b8 31px)', backgroundSize: '100% 32px', lineHeight: '32px' }}
          />
        </div>

        {/* Section 6 */}
        <div className="space-y-3">
          <p className="font-bold">6. พฤติกรรมและความเสี่ยง</p>
          <div className="pl-4 space-y-4">
            <div className="space-y-2">
              <p className="font-bold text-[11px]">6.1 สุขภาพ</p>
              <div className="grid grid-cols-3 gap-2 pl-4">
                {['ร่างกายไม่แข็งแรง', 'มีโรคประจำตัวหรือเจ็บป่วยบ่อย', 'มีภาวะทุพโภชนาการ', 'ป่วยเป็นโรคร้ายแรง/เรื้อรัง', 'สมรรถภาพทางร่างกายต่ำ'].map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.health.includes(v) && "bg-slate-800")}>
                      {data.behaviorRisks.health.includes(v) && <div className="w-1.5 h-1.5 bg-white"></div>}
                    </div>
                    <input type="checkbox" checked={data.behaviorRisks.health.includes(v)} onChange={() => !isPDF && toggleBehaviorRisk('health', v)} className="hidden" />
                    <span className="text-[11px]">{v}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold text-[11px]">6.2 สวัสดิการหรือความปลอดภัย</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 pl-4">
                {[
                  'พ่อแม่แยกทางกัน หรือแต่งงานใหม่', 
                  'ที่พักอาศัยอยู่ในชุมชนแออัดหรือใกล้แหล่งมั่วสุม/สถานเริงรมย์', 
                  'มีบุคคลในครอบครัวเจ็บป่วยด้วยโรคร้ายแรง/เรื้อรัง/ติดต่อ', 
                  'บุคคลในครอบครัวติดสารเสพติด', 
                  'บุคคลในครอบครัวเล่นการพนัน', 
                  'มีความขัดแย้ง/ทะเลาะกันในครอบครัว', 
                  'ไม่มีผู้ดูแล', 
                  'มีความขัดแย้งและการใช้ความรุนแรงในครอบครัว', 
                  'ถูกทารุณกรรม/ทำร้ายจากบุคคลในครอบครัว/เพื่อนบ้าน', 
                  'ถูกล่วงละเมิดทางเพศ', 
                  'เล่นการพนัน'
                ].map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.safety.includes(v) && "bg-slate-800")}>
                      {data.behaviorRisks.safety.includes(v) && <div className="w-1.5 h-1.5 bg-white"></div>}
                    </div>
                    <input type="checkbox" checked={data.behaviorRisks.safety.includes(v)} onChange={() => !isPDF && toggleBehaviorRisk('safety', v)} className="hidden" />
                    <span className="text-[11px]">{v}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 items-center">
                <span>6.3 ระยะทางระหว่างบ้านไปโรงเรียน(ไป/กลับ)</span>
                <input 
                  type="number" 
                  value={data.behaviorRisks.distanceToSchool || ''}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, distanceToSchool: Number(e.target.value) } }))}
                  className="w-20 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>กิโลเมตร ใช้เวลาเดินทาง</span>
                <input 
                  type="number" 
                  value={data.behaviorRisks.travelTimeHours || ''}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, travelTimeHours: Number(e.target.value) } }))}
                  className="w-12 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>ชม.</span>
                <input 
                  type="number" 
                  value={data.behaviorRisks.travelTimeMinutes || ''}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, travelTimeMinutes: Number(e.target.value) } }))}
                  className="w-12 border-b border-dotted border-slate-400 outline-none bg-transparent text-center font-bold text-blue-800"
                  readOnly={isPDF}
                />
                <span>นาที</span>
              </div>
              <div className="space-y-2">
                <p className="pl-4">การเดินทางของนักเรียนไปโรงเรียน (ตอบเพียง 1 ข้อ)</p>
                <div className="grid grid-cols-4 gap-4 pl-8">
                  {[
                    { id: 'parent', label: 'ผู้ปกครองมาส่ง' },
                    { id: 'bus', label: 'รถโดยสารประจำทาง' },
                    { id: 'motorcycle_taxi', label: 'รถจักรยานยนต์' },
                    { id: 'school_bus', label: 'รถโรงเรียน' },
                    { id: 'car', label: 'รถยนต์' },
                    { id: 'motorcycle', label: 'รถจักรยาน' },
                    { id: 'walk', label: 'เดิน' },
                    { id: 'others', label: 'อื่นๆ' }
                  ].map((v) => (
                    <label key={v.id} className="flex items-center gap-1 cursor-pointer">
                      <div className={cn("w-3.5 h-3.5 rounded-full border border-slate-800 flex items-center justify-center", data.behaviorRisks.travelMethod === v.id && "bg-slate-800")}>
                        {data.behaviorRisks.travelMethod === v.id && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                      </div>
                      <input 
                        type="radio" 
                        name="travelMethod"
                        checked={data.behaviorRisks.travelMethod === v.id} 
                        onChange={() => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, travelMethod: v.id } }))} 
                        className="hidden" 
                      />
                      <span className="text-[11px]">{v.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6.4 Responsibilities */}
        <div className="space-y-1">
          <p className="font-bold">6.4. ภาระงานความรับผิดชอบของนักเรียนที่มีต่อครอบครัว</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-4">
            {[
              { id: 'ช่วยงานบ้าน', label: 'ช่วยงานบ้าน' },
              { id: 'ช่วยคนดูแลคนเจ็บป่วย/พิการ', label: 'ช่วยคนดูแลคนเจ็บป่วย/พิการ' },
              { id: 'ช่วยค้าขายเล็กๆน้อยๆ', label: 'ช่วยค้าขายเล็กๆน้อยๆ' },
              { id: 'ทำงานแถวบ้าน', label: 'ทำงานแถวบ้าน' },
              { id: 'ช่วยงานในนาไร่', label: 'ช่วยงานในนาไร่' },
              { id: 'อื่น ระบุ', label: 'อื่น ระบุ' }
            ].map(v => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.responsibilities.includes(v.id) && "bg-slate-800")}>
                  {data.behaviorRisks.responsibilities.includes(v.id) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="checkbox" checked={data.behaviorRisks.responsibilities.includes(v.id)} onChange={() => !isPDF && toggleBehaviorRisk('responsibilities', v.id)} className="hidden" />
                <span className="text-[11px]">{v.label}</span>
                {v.id === 'อื่น ระบุ' && data.behaviorRisks.responsibilities.includes('อื่น ระบุ') && (
                  <input 
                    type="text" 
                    value={data.behaviorRisks.responsibilitiesOtherDetail || ''}
                    onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, responsibilitiesOtherDetail: e.target.value } }))}
                    className="flex-1 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                    readOnly={isPDF}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* 6.5 Hobbies */}
        <div className="space-y-1">
          <p className="font-bold">6.5. กิจกรรมยามว่างหรืองานอดิเรก</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-4">
            {[
              { id: 'ดูทีวี / ฟังเพลง', label: 'ดูทีวี / ฟังเพลง' },
              { id: 'ไปเที่ยวห้าง / ดูหนัง', label: 'ไปเที่ยวห้าง / ดูหนัง' },
              { id: 'อ่านหนังสือ', label: 'อ่านหนังสือ' },
              { id: 'ไปหาเพื่อน / เพื่อน', label: 'ไปหาเพื่อน / เพื่อน' },
              { id: 'แว้น / สก๊อย', label: 'แว้น / สก๊อย' },
              { id: 'เล่นเกม คอม / มือถือ', label: 'เล่นเกม คอม / มือถือ' },
              { id: 'ไปสวนสาธารณะ', label: 'ไปสวนสาธารณะ' },
              { id: 'ไปร้านสนุกเกอร์', label: 'ไปร้านสนุกเกอร์' },
              { id: 'อื่น ๆ ระบุ', label: 'อื่น ๆ ระบุ' }
            ].map(v => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.hobbies.includes(v.id) && "bg-slate-800")}>
                  {data.behaviorRisks.hobbies.includes(v.id) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="checkbox" checked={data.behaviorRisks.hobbies.includes(v.id)} onChange={() => !isPDF && toggleBehaviorRisk('hobbies', v.id)} className="hidden" />
                <span className="text-[11px]">{v.label}</span>
                {v.id === 'อื่น ๆ ระบุ' && data.behaviorRisks.hobbies.includes('อื่น ๆ ระบุ') && (
                  <input 
                    type="text" 
                    value={data.behaviorRisks.hobbiesOtherDetail || ''}
                    onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, hobbiesOtherDetail: e.target.value } }))}
                    className="flex-1 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                    readOnly={isPDF}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* 6.6 Drug Use */}
        <div className="space-y-1">
          <p className="font-bold">6.6. พฤติกรรมการใช้สารเสพติด</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-4">
            {[
              'คบเพื่อนในกลุ่มที่ใช้สารเสพติด',
              'สมาชิกในครอบครัวเกี่ยวข้องกับยาเสพติด',
              'อยู่ในสภาพแวดล้อมที่ใช้สารเสพติด',
              'ปัจจุบันเกี่ยวข้องกับสารเสพติด',
              'เป็นผู้ติดบุหรี่ สุรา หรือการใช้สารเสพติดอื่นๆ'
            ].map(v => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.drugUse.includes(v) && "bg-slate-800")}>
                  {data.behaviorRisks.drugUse.includes(v) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="checkbox" checked={data.behaviorRisks.drugUse.includes(v)} onChange={() => !isPDF && toggleBehaviorRisk('drugUse', v)} className="hidden" />
                <span className="text-[11px]">{v}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 6.7 Violence */}
        <div className="space-y-1">
          <p className="font-bold">6.7. พฤติกรรมการใช้ความรุนแรง</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-4">
            {[
              'มีการทะเลาะวิวาท',
              'ก้าวร้าว เกเร',
              'ทะเลาะวิวาทเป็นประจำ',
              'ทำร้ายร่างกายผู้อื่น',
              'ทำร้ายร่างกายตนเอง'
            ].map(v => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.violence.includes(v) && "bg-slate-800")}>
                  {data.behaviorRisks.violence.includes(v) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="checkbox" checked={data.behaviorRisks.violence.includes(v)} onChange={() => !isPDF && toggleBehaviorRisk('violence', v)} className="hidden" />
                <span className="text-[11px]">{v}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 6.8 Sexual Behavior */}
        <div className="space-y-1">
          <p className="font-bold">6.8. พฤติกรรมทางเพศ</p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 pl-4">
            {[
              'อยู่ในกลุ่มขายบริการ',
              'ใช้เครื่องมือสื่อสารที่เกี่ยวข้องกับด้านเพศเป็นเวลานานและบ่อยครั้ง',
              'ตั้งครรภ์',
              'ขายบริการทางเพศ',
              'หมกมุ่นในการใช้เครื่องมือสื่อสารที่เกี่ยวข้องทางเพศ',
              'มีการมั่วสุมทางเพศ'
            ].map(v => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.sexualBehavior.includes(v) && "bg-slate-800")}>
                  {data.behaviorRisks.sexualBehavior.includes(v) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="checkbox" checked={data.behaviorRisks.sexualBehavior.includes(v)} onChange={() => !isPDF && toggleBehaviorRisk('sexualBehavior', v)} className="hidden" />
                <span className="text-[11px]">{v}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 6.9 Game Addiction */}
        <div className="space-y-1">
          <p className="font-bold">6.9. การติดเกม</p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 pl-4">
            {[
              { id: 'เล่นเกมเกินวันละ 1 ชั่วโมง', label: 'เล่นเกมเกินวันละ 1 ชั่วโมง' },
              { id: 'ขาดจินตนาการและความคิดสร้างสรรค์', label: 'ขาดจินตนาการและความคิดสร้างสรรค์' },
              { id: 'เก็บตัว แยกตัวจากกลุ่มเพื่อน', label: 'เก็บตัว แยกตัวจากกลุ่มเพื่อน' },
              { id: 'ใช้จ่ายเงินผิดปกติ', label: 'ใช้จ่ายเงินผิดปกติ' },
              { id: 'อยู่ในกลุ่มเพื่อนเล่นเกม', label: 'อยู่ในกลุ่มเพื่อนเล่นเกม' },
              { id: 'ร้านเกมอยู่ใกล้บ้านหรือโรงเรียน', label: 'ร้านเกมอยู่ใกล้บ้านหรือโรงเรียน' },
              { id: 'ใช้เวลาเล่นเกมเกิน 2 ชั่วโมง', label: 'ใช้เวลาเล่นเกมเกิน 2 ชั่วโมง' },
              { id: 'หมกมุ่น จริงจังในการเล่นเกม', label: 'หมกมุ่น จริงจังในการเล่นเกม' },
              { id: 'ใช้เงินสิ้นเปลือง โกหก ลักขโมยเงินเพื่อเล่นเกม', label: 'ใช้เงินสิ้นเปลือง โกหก ลักขโมยเงินเพื่อเล่นเกม' },
              { id: 'อื่นๆ', label: 'อื่นๆ' }
            ].map(v => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.gameAddiction.includes(v.id) && "bg-slate-800")}>
                  {data.behaviorRisks.gameAddiction.includes(v.id) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="checkbox" checked={data.behaviorRisks.gameAddiction.includes(v.id)} onChange={() => !isPDF && toggleBehaviorRisk('gameAddiction', v.id)} className="hidden" />
                <span className="text-[11px]">{v.label}</span>
                {v.id === 'อื่นๆ' && data.behaviorRisks.gameAddiction.includes('อื่นๆ') && (
                  <input 
                    type="text" 
                    value={data.behaviorRisks.gameAddictionOtherDetail || ''}
                    onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, gameAddictionOtherDetail: e.target.value } }))}
                    className="flex-1 border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800"
                    readOnly={isPDF}
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        {/* 6.10 Internet Access */}
        <div className="space-y-1">
          <p className="font-bold">6.10. การเข้าถึงสื่อคอมพิวเตอร์และอินเทอร์เน็ตที่บ้าน</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-4">
            {[
              { id: 'yes', label: 'สามารถเข้าถึง Internet ได้จากที่บ้าน' },
              { id: 'no', label: 'ไม่สามารถเข้าถึง Internet ได้จากที่บ้าน' }
            ].map(v => (
              <label key={v.id} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.internetAccess === v.id && "bg-slate-800")}>
                  {data.behaviorRisks.internetAccess === v.id && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="radio" checked={data.behaviorRisks.internetAccess === v.id} onChange={() => !isPDF && setFormData(prev => ({ ...prev, behaviorRisks: { ...prev.behaviorRisks, internetAccess: v.id } }))} className="hidden" />
                <span className="text-[11px]">{v.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 6.11 Electronic Use */}
        <div className="space-y-1">
          <p className="font-bold">6.11. การใช้เครื่องมือสื่อสารอิเล็กทรอนิกส์</p>
          <div className="grid grid-cols-1 gap-y-1 pl-4">
            {[
              'เคยใช้โทรศัพท์มือถือในระหว่างการเรียน',
              'เข้าใช้ line, Facebook, twitter หรือ chat (เกินวันละ 1 ชั่วโมง)',
              'ใช้โทรศัพท์มือถือในระหว่างเรียน 2 - 3/วัน',
              'เข้าใช้ line, Facebook, twitter หรือ chat (เกินวันละ 2 ชั่วโมง)'
            ].map(v => (
              <label key={v} className="flex items-center gap-2 cursor-pointer">
                <div className={cn("w-3.5 h-3.5 border border-slate-800 flex items-center justify-center", data.behaviorRisks.electronicUse.includes(v) && "bg-slate-800")}>
                  {data.behaviorRisks.electronicUse.includes(v) && <div className="w-1.5 h-1.5 bg-white"></div>}
                </div>
                <input type="checkbox" checked={data.behaviorRisks.electronicUse.includes(v)} onChange={() => !isPDF && toggleBehaviorRisk('electronicUse', v)} className="hidden" />
                <span className="text-[11px]">{v}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Teacher Summary */}
        <div className="space-y-1">
          <p className="font-bold">สรุปความเห็นของครูที่ปรึกษา/ครูผู้เยี่ยมบ้าน</p>
          <textarea 
            value={data.teacherSummary || ''}
            onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, teacherSummary: e.target.value }))}
            className="w-full border-b border-dotted border-slate-400 outline-none bg-transparent px-1 font-bold text-blue-800 resize-none overflow-hidden min-h-[4rem]"
            rows={2}
            readOnly={isPDF}
            style={{ backgroundImage: 'linear-gradient(transparent, transparent 31px, #94a3b8 31px)', backgroundSize: '100% 32px', lineHeight: '32px' }}
          />
        </div>
      </div>
    </div>
  );

  const renderPage4 = (data: HomeVisitData, isPDF = false) => (
    <div 
      className={cn(
        "bg-white relative text-slate-800 font-sans leading-relaxed border border-slate-200",
        isPDF ? "p-[1.5cm] w-[210mm] min-h-[29.7cm] text-[11px]" : "shadow-2xl mx-auto p-[1.5cm] md:p-[2cm] min-h-[29.7cm] text-sm"
      )}
      id={isPDF ? undefined : "form-page-4"}
      style={{ fontFamily: "'Sarabun', sans-serif" }}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1"></div>
        <div className="text-center flex-1">
          <h2 className="text-xl font-bold text-slate-900">บันทึกการเยี่ยมบ้าน</h2>
        </div>
        <div className="flex-1 text-right text-xs text-slate-400">หน้า 4/4</div>
      </div>

      <div className="border-t border-slate-800 my-2"></div>

      <div className="space-y-8">
        <div className="text-center space-y-4">
          <p className="font-bold text-lg underline">ภาพถ่ายบ้านนักเรียน</p>
          
          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-2">
              <p className="font-bold italic text-slate-600">รูปที่ 1 ภาพถ่ายสภาพบ้านนักเรียน (ภายนอก)</p>
              <div className="w-full aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                {data.photos.exterior ? (
                  <>
                    <img src={data.photos.exterior} alt="Exterior" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {!isPDF && (
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, photos: { ...prev.photos, exterior: '' } }))}
                        className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors">
                    <Camera size={48} strokeWidth={1.5} />
                    <span className="font-medium">คลิกเพื่ออัปโหลดรูปภาพภายนอกบ้าน</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'exterior')} />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-bold italic text-slate-600">รูปที่ 2 ภาพถ่ายภายในบ้านนักเรียน</p>
              <div className="w-full aspect-video bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden relative group">
                {data.photos.interior ? (
                  <>
                    <img src={data.photos.interior} alt="Interior" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {!isPDF && (
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, photos: { ...prev.photos, interior: '' } }))}
                        className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors">
                    <Camera size={48} strokeWidth={1.5} />
                    <span className="font-medium">คลิกเพื่ออัปโหลดรูปภาพภายในบ้าน</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'interior')} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 space-y-8">
          <div className="text-center">
            <p className="font-bold">ขอรับรองว่าข้อมูล และภาพถ่ายบ้านของนักเรียนเป็นความจริง</p>
          </div>

          <div className="grid grid-cols-1 gap-8 max-w-md mx-auto">
            <div className="text-center space-y-4">
              <div className="border-b border-dotted border-slate-400 pb-2 min-h-[60px] flex flex-col items-center justify-center">
                {data.parentSignature ? (
                  <div className="relative group">
                    <img src={data.parentSignature} alt="Signature" className="max-h-20 object-contain" referrerPolicy="no-referrer" />
                    {!isPDF && (
                      <button 
                        onClick={() => setFormData(prev => ({ ...prev, parentSignature: '' }))}
                        className="absolute -top-2 -right-8 p-1 bg-red-100 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ) : (
                  !isPDF && (
                    <button 
                      onClick={() => setShowSignaturePad(true)}
                      className="text-blue-500 hover:text-blue-600 font-medium text-xs flex items-center gap-1"
                    >
                      <PenTool size={14} />
                      คลิกเพื่อลงชื่อ (ผู้ปกครอง)
                    </button>
                  )
                )}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span>(ลงชื่อ)</span>
                <input 
                  type="text" 
                  placeholder="ชื่อ-นามสกุล ผู้ปกครอง"
                  value={data.parentSignatureName || ''}
                  onChange={(e) => !isPDF && setFormData(prev => ({ ...prev, parentSignatureName: e.target.value }))}
                  className="w-64 border-b border-dotted border-slate-400 outline-none bg-transparent text-cen              new TextRun({ text: "4.3 สภาพที่อยู่อาศัย: ", font: "Sarabun" }),
              new TextRun({ text: checkbox(visit.householdStatus.housingCondition === 'dilapidated') + "ชำรุดทรุดโทรม  ", font: "Sarabun" }),
              new TextRun({ text: checkbox(visit.householdStatus.noToilet) + "ไม่มีห้องส้วม", font: "Sarabun" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "4.4 ยานพาหนะ: ", font: "Sarabun" }),
              new TextRun({ text: `รถยนต์(${visit.householdStatus.vehicles.car ? 'มี' : 'ไม่มี'})  `, font: "Sarabun" }),
              new TextRun({ text: `รถปิกอัพ(${visit.householdStatus.vehicles.pickup ? 'มี' : 'ไม่มี'})  `, font: "Sarabun" }),
              new TextRun({ text: `รถไถ(${visit.householdStatus.vehicles.tractor ? 'มี' : 'ไม่มี'})`, font: "Sarabun" }),
            ],
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Page 2
          new Paragraph({
            children: [new TextRun({ text: "บันทึกการเยี่ยมบ้าน (ต่อ)", bold: true, size: 28, font: "Sarabun" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "5. ความสัมพันธ์ในครอบครัว", bold: true, font: "Sarabun" })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `5.1 สมาชิกในครอบครัวมีเวลาอยู่ร่วมกัน: ${visit.familyRelationship.timeTogether || "0"} ชั่วโมง/วัน`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "5.2 ความสัมพันธ์ระหว่างนักเรียนกับสมาชิกในครอบครัว:", font: "Sarabun" })],
            spacing: { after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "สมาชิก", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "สนิทสนม", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "เฉยๆ", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ห่างเหิน", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ขัดแย้ง", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ไม่มี", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                ],
              }),
              ...['บิดา', 'มารดา', 'พี่ชาย/น้องชาย', 'พี่สาว/น้องสาว', 'ปู่/ย่า/ตา/ยาย', 'ญาติ', 'อื่นๆ'].map(member => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: member, font: "Sarabun", size: 20 })] })] }),
                  ...['close', 'normal', 'distant', 'conflict', 'none'].map(level => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: visit.familyRelationship.memberRelations[member] === level ? "●" : "", font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })]
                  }))
                ],
              })),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "5.3 กรณีผู้ปกครองไม่อยู่บ้าน ฝากเด็กไว้กับ: ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'relatives') + "ญาติ  ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'neighbors') + "เพื่อนบ้าน  ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'alone') + "อยู่คนเดียว  ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'others') + "อื่นๆ: " + (visit.familyRelationship.guardianOthersDetail || ""), font: "Sarabun" }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Page 3
          new Paragraph({
            children: [new TextRun({ text: "บันทึกการเยี่ยมบ้าน (ต่อ)", bold: true, size: 28, font: "Sarabun" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `5.4 รายได้ครัวเรือนเฉลี่ยต่อคน: ${visit.householdStatus.averageIncomePerPerson || "0"} บาท`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `5.5 นักเรียนได้รับค่าใช้จ่ายจาก: ${visit.studentFinance.incomeSource || "-"}`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `ได้เงินมาโรงเรียนวันละ: ${visit.studentFinance.dailyAllowance || "0"} บาท`, font: "Sarabun" }),
              new TextRun({ text: `\tภาระหนี้สิน: ${visit.studentFinance.hasDebt ? visit.studentFinance.debtAmount + ' บาท' : 'ไม่มี'}`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "5.6 สิ่งที่ต้องการให้โรงเรียนช่วยเหลือ: ", font: "Sarabun" }),
              new TextRun({ text: (visit.helpNeeded || []).join(", "), font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "5.7 ข้อห่วงใยของผู้ปกครอง:", font: "Sarabun", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: visit.parentConcerns || "-", font: "Sarabun" })],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [new TextRun({ text: "6. พฤติกรรมและความเสี่ยง", bold: true, font: "Sarabun" })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "6.1 สุขภาพ: ", font: "Sarabun" }),
              new TextRun({ text: (visit.behaviorRisks.health || []).join(", ") || "ปกติ", font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "6.2 สวัสดิการ/ความปลอดภัย: ", font: "Sarabun" }),
              new TextRun({ text: (visit.behaviorRisks.safety || []).join(", ") || "ปกติ", font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `6.3 ระยะทางไปโรงเรียน: ${visit.behaviorRisks.distanceToSchool || "0"} กม. `, font: "Sarabun" }),
              new TextRun({ text: `เดินทางโดย: ${visit.behaviorRisks.travelMethod || "-"}`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "สรุปความเห็นของครูที่ปรึกษา:", font: "Sarabun", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: visit.teacherSummary || "-", font: "Sarabun" })],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [new TextRun({ text: "ผู้ให้ข้อมูล: ", font: "Sarabun", bold: true }), new TextRun({ text: visit.informant || "-", font: "Sarabun" })],
            spacing: { after: 200 },
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Page 4
          new Paragraph({
            children: [new TextRun({ text: "ภาพถ่ายการเยี่ยมบ้าน", bold: true, size: 28, font: "Sarabun" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          ...(exteriorData ? [
            new Paragraph({ text: "ภาพถ่ายสภาพบ้านนักเรียน (ภายนอก)", alignment: AlignmentType.CENTER, font: "Sarabun" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: base64ToUint8Array(exteriorData),
                  transformation: { width: 450, height: 280 },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
          ] : []),

          ...(interiorData ? [
            new Paragraph({ text: "ภาพถ่ายภายในบ้านนักเรียน", alignment: AlignmentType.CENTER, font: "Sarabun" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: base64ToUint8Array(interiorData),
                  transformation: { width: 450, height: 280 },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
          ] : []),

          new Paragraph({ text: "", spacing: { before: 400 } }),
          new Paragraph({
            children: [new TextRun({ text: "ขอรับรองว่าข้อมูล และภาพถ่ายบ้านของนักเรียนเป็นความจริง", font: "Sarabun", bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "(ลงชื่อ)...........................................................................", font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `( ${visit.certification?.signerName || "...................................................."} )`, font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `ตำแหน่ง ${visit.certification?.position || "...................................................."}`, font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `วันที่ ${visit.certification?.day || "........"} เดือน ${visit.certification?.month || "................"} พ.ศ. ${visit.certification?.year || "........"}`, font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          
          new Paragraph({ text: "", spacing: { before: 400 } }),
          
          ...(parentSignatureData ? [
            new Paragraph({
              children: [
                new TextRun({ text: "ลายเซ็นผู้ปกครอง", font: "Sarabun", bold: true }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: base64ToUint8Array(parentSignatureData),
                  transformation: { width: 150, height: 75 },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `( ${visit.parentSignatureName || "...................................................."} )`, font: "Sarabun" }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ] : []),
        ],
      }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Home_Visit_${student?.firstName}_${student?.lastName}.docx`);
    });
  };

  return (TextRun({ text: radio(visit.householdStatus.housingType === 'rent') + "บ้านเช่า  ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.householdStatus.housingType === 'others') + "อาศัยผู้อื่น", font: "Sarabun" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "4.3 สภาพที่อยู่อาศัย: ", font: "Sarabun" }),
              new TextRun({ text: checkbox(visit.householdStatus.housingCondition === 'dilapidated') + "ชำรุดทรุดโทรม  ", font: "Sarabun" }),
              new TextRun({ text: checkbox(visit.householdStatus.noToilet) + "ไม่มีห้องส้วม", font: "Sarabun" }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "4.4 ยานพาหนะ: ", font: "Sarabun" }),
              new TextRun({ text: `รถยนต์(${visit.householdStatus.vehicles.car ? 'มี' : 'ไม่มี'})  `, font: "Sarabun" }),
              new TextRun({ text: `รถปิกอัพ(${visit.householdStatus.vehicles.pickup ? 'มี' : 'ไม่มี'})  `, font: "Sarabun" }),
              new TextRun({ text: `รถไถ(${visit.householdStatus.vehicles.tractor ? 'มี' : 'ไม่มี'})`, font: "Sarabun" }),
            ],
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Page 2
          new Paragraph({
            children: [new TextRun({ text: "บันทึกการเยี่ยมบ้าน", bold: true, size: 32, font: "Sarabun" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "หน้า 2/4", size: 20, font: "Sarabun" })],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [new TextRun({ text: "5. ความสัมพันธ์ในครอบครัว", bold: true, font: "Sarabun" })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `5.1 สมาชิกในครอบครัวมีเวลาอยู่ร่วมกัน: ${visit.familyRelationship.timeTogether || "0"} ชั่วโมง/วัน`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "5.2 ความสัมพันธ์ระหว่างนักเรียนกับสมาชิกในครอบครัว:", font: "Sarabun" })],
            spacing: { after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "สมาชิก", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "สนิทสนม", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "เฉยๆ", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ห่างเหิน", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ขัดแย้ง", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "ไม่มี", bold: true, font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })] }),
                ],
              }),
              ...['บิดา', 'มารดา', 'พี่ชาย/น้องชาย', 'พี่สาว/น้องสาว', 'ปู่/ย่า/ตา/ยาย', 'ญาติ', 'อื่นๆ'].map(member => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: member, font: "Sarabun", size: 20 })] })] }),
                  ...['close', 'normal', 'distant', 'conflict', 'none'].map(level => new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: visit.familyRelationship.memberRelations[member] === level ? "●" : "", font: "Sarabun", size: 20 })], alignment: AlignmentType.CENTER })]
                  }))
                ],
              })),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } }),
          new Paragraph({
            children: [
              new TextRun({ text: "5.3 กรณีผู้ปกครองไม่อยู่บ้าน ฝากเด็กไว้กับ: ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'relatives') + "ญาติ  ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'neighbors') + "เพื่อนบ้าน  ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'alone') + "อยู่คนเดียว  ", font: "Sarabun" }),
              new TextRun({ text: radio(visit.familyRelationship.guardianIfAbsent === 'others') + "อื่นๆ: " + (visit.familyRelationship.guardianOthersDetail || ""), font: "Sarabun" }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Page 3
          new Paragraph({
            children: [new TextRun({ text: "บันทึกการเยี่ยมบ้าน", bold: true, size: 32, font: "Sarabun" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "หน้า 3/4", size: 20, font: "Sarabun" })],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `5.4 รายได้ครัวเรือนเฉลี่ยต่อคน: ${visit.householdStatus.averageIncomePerPerson || "0"} บาท`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `5.5 นักเรียนได้รับค่าใช้จ่ายจาก: ${visit.studentFinance.incomeSource || "-"}`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `ได้เงินมาโรงเรียนวันละ: ${visit.studentFinance.dailyAllowance || "0"} บาท`, font: "Sarabun" }),
              new TextRun({ text: `\tภาระหนี้สิน: ${visit.studentFinance.hasDebt ? visit.studentFinance.debtAmount + ' บาท' : 'ไม่มี'}`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "5.6 สิ่งที่ต้องการให้โรงเรียนช่วยเหลือ: ", font: "Sarabun" }),
              new TextRun({ text: (visit.helpNeeded || []).join(", "), font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "5.8 ข้อห่วงใยของผู้ปกครอง:", font: "Sarabun", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: visit.parentConcerns || "-", font: "Sarabun" })],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [new TextRun({ text: "6. พฤติกรรมและความเสี่ยง", bold: true, font: "Sarabun" })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "6.1 สุขภาพ: ", font: "Sarabun" }),
              new TextRun({ text: (visit.behaviorRisks.health || []).join(", ") || "ปกติ", font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "6.2 สวัสดิการ/ความปลอดภัย: ", font: "Sarabun" }),
              new TextRun({ text: (visit.behaviorRisks.safety || []).join(", ") || "ปกติ", font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `6.3 ระยะทางไปโรงเรียน: ${visit.behaviorRisks.distanceToSchool || "0"} กม. `, font: "Sarabun" }),
              new TextRun({ text: `เดินทางโดย: ${visit.behaviorRisks.travelMethod || "-"}`, font: "Sarabun" }),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "สรุปความเห็นของครูที่ปรึกษา:", font: "Sarabun", bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: visit.teacherSummary || "-", font: "Sarabun" })],
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [new TextRun({ text: "ผู้ให้ข้อมูล: ", font: "Sarabun", bold: true }), new TextRun({ text: visit.informant || "-", font: "Sarabun" })],
            spacing: { after: 200 },
          }),

          new Paragraph({ children: [new PageBreak()] }),

          // Page 4
          new Paragraph({
            children: [new TextRun({ text: "บันทึกการเยี่ยมบ้าน", bold: true, size: 32, font: "Sarabun" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({ text: "หน้า 4/4", size: 20, font: "Sarabun" })],
            alignment: AlignmentType.RIGHT,
          }),
          new Paragraph({
            children: [new TextRun({ text: "ภาพถ่ายบ้านนักเรียน", bold: true, font: "Sarabun", size: 28 })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          ...(exteriorData ? [
            new Paragraph({ text: "รูปที่ 1 ภาพถ่ายสภาพบ้านนักเรียน (ภายนอก)", alignment: AlignmentType.CENTER, font: "Sarabun" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: base64ToUint8Array(exteriorData),
                  transformation: { width: 450, height: 280 },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
          ] : []),

          ...(interiorData ? [
            new Paragraph({ text: "รูปที่ 2 ภาพถ่ายภายในบ้านนักเรียน", alignment: AlignmentType.CENTER, font: "Sarabun" }),
            new Paragraph({
              children: [
                new ImageRun({
                  data: base64ToUint8Array(interiorData),
                  transformation: { width: 450, height: 280 },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
          ] : []),

          new Paragraph({ text: "", spacing: { before: 400 } }),
          new Paragraph({
            children: [new TextRun({ text: "ขอรับรองว่าข้อมูล และภาพถ่ายบ้านของนักเรียนเป็นความจริง", font: "Sarabun", bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "(ลงชื่อ)...........................................................................", font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `( ${visit.certification?.signerName || "...................................................."} )`, font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `ตำแหน่ง ${visit.certification?.position || "...................................................."}`, font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `วันที่ ${visit.certification?.day || "........"} เดือน ${visit.certification?.month || "................"} พ.ศ. ${visit.certification?.year || "........"}`, font: "Sarabun" }),
            ],
            alignment: AlignmentType.CENTER,
          }),
        ],
      }],
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, `Home_Visit_${student?.firstName}_${student?.lastName}.docx`);
    });
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">ระบบบันทึกการเยี่ยมบ้าน</h1>
          <p className="text-slate-500 font-medium">บันทึกข้อมูลและคัดกรองนักเรียนรายบุคคล</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => {
              setSelectedStudentId('');
              setFormData(initialFormState);
              setCurrentPage(1);
            }}
            className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Plus size={20} />
            เยี่ยมบ้านใหม่
          </button>
          <button 
            onClick={() => window.print()}
            className="px-6 py-3 bg-slate-800 text-white rounded-2xl font-bold hover:bg-slate-900 transition-all flex items-center gap-2 shadow-lg shadow-slate-100"
          >
            <FileText size={20} />
            พิมพ์แบบฟอร์ม
          </button>
          <button 
            onClick={handleSave}
            disabled={loading || !selectedStudentId}
            className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
          >
            <Save size={20} />
            {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4].map(page => (
          <button
            key={page}
            onClick={() => setCurrentPage(page)}
            className={cn(
              "w-10 h-10 rounded-full font-bold transition-all border-2",
              currentPage === page 
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100" 
                : "bg-white text-slate-400 border-slate-100 hover:border-blue-200"
            )}
          >
            {page}
          </button>
        ))}
      </div>

      {/* Student Selection */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Search size={16} className="text-blue-600" />
              เลือกนักเรียนที่ต้องการเยี่ยมบ้าน
            </label>
            <select 
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-800"
            >
              <option value="">-- เลือกนักเรียน --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.studentId} - {s.firstName} {s.lastName} ({s.classId})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => downloadPDF(formData)}
              disabled={!selectedStudentId}
              className="p-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center gap-2 disabled:opacity-50"
              title="ดาวน์โหลด PDF"
            >
              <FileText size={24} />
            </button>
            <button 
              onClick={() => downloadWord(formData)}
              disabled={!selectedStudentId}
              className="p-4 bg-blue-50 text-blue-600 rounded-2xl font-bold hover:bg-blue-100 transition-all flex items-center gap-2 disabled:opacity-50"
              title="ดาวน์โหลด Word"
            >
              <FileCode size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="bg-slate-100 rounded-3xl shadow-inner border border-slate-200 overflow-hidden min-h-[800px] relative">
        <div className="max-w-[900px] mx-auto py-12 space-y-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentPage === 1 && renderPage1(formData)}
              {currentPage === 2 && renderPage2(formData)}
              {currentPage === 3 && renderPage3(formData)}
              {currentPage === 4 && renderPage4(formData)}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center max-w-[900px] mx-auto px-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-6 py-3 bg-white text-slate-600 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-30"
            >
              <ChevronLeft size={20} />
              ย้อนกลับ
            </button>
            <div className="text-slate-400 font-bold">หน้า {currentPage} จาก 4</div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(4, prev + 1))}
              disabled={currentPage === 4}
              className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 rounded-2xl font-bold border border-blue-100 hover:bg-blue-50 transition-all disabled:opacity-30"
            >
              ถัดไป
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Hidden PDF Generation Container */}
      {isGeneratingPDF && pdfVisitData && (
        <div className="fixed left-[-9999px] top-0" ref={pdfContainerRef}>
          {renderPage1(pdfVisitData, true)}
          {renderPage2(pdfVisitData, true)}
          {renderPage3(pdfVisitData, true)}
          {renderPage4(pdfVisitData, true)}
        </div>
      )}

      {/* History & Downloads */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2 text-xl">
          <LucideHistory size={24} className="text-blue-600" />
          ประวัติการเยี่ยมบ้าน
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {visits.map(v => {
            const student = students.find(s => s.id === v.studentId);
            return (
              <motion.div 
                key={v.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:shadow-md transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                      <User size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{student?.firstName} {student?.lastName}</h4>
                      <p className="text-xs text-slate-400">{student?.classId}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">
                    {format(toDate(v.date), 'dd MMM yyyy', { locale: th })}
                  </span>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin size={14} className="text-blue-400" />
                    <span>เยี่ยมโดย: {v.teacherName || 'ไม่ระบุ'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock size={14} className="text-blue-400" />
                    <span>ผู้ให้ข้อมูล: {v.informant || '-'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => downloadPDF(v)}
                    className="py-2 bg-white text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-50 transition-all flex items-center justify-center gap-1"
                  >
                    <FileText size={14} />
                    PDF
                  </button>
                  <button 
                    onClick={() => downloadWord(v)}
                    className="py-2 bg-white text-blue-600 rounded-xl text-xs font-bold border border-blue-100 hover:bg-blue-50 transition-all flex items-center justify-center gap-1"
                  >
                    <FileCode size={14} />
                    WORD
                  </button>
                </div>
              </motion.div>
            );
          })}
          {visits.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Home size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium">ยังไม่มีประวัติการเยี่ยมบ้าน</p>
            </div>
          )}
        </div>
      </div>
      
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border",
              notification.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" :
              notification.type === 'error' ? "bg-red-50 border-red-100 text-red-700" :
              "bg-blue-50 border-blue-100 text-blue-700"
            )}
          >
            {notification.type === 'success' ? <Info size={20} /> : 
             notification.type === 'error' ? <XCircle size={20} /> : <Info size={20} />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function XCircle({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
  );
}
