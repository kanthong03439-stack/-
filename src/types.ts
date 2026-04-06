export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'teacher' | 'student';
  isApproved: boolean;
  classId?: string;
  designation?: string;
  signatureUrl?: string;
  createdAt: string;
}

export interface Student {
  id: string;
  studentId: string;
  studentNumber?: number;
  firstName: string;
  lastName: string;
  classId: string;
  gender: 'male' | 'female';
  weight?: number;
  height?: number;
  birthDate?: string;
  photoUrl?: string;
  createdAt?: string;
}

export interface Attendance {
  id?: string;
  date: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  classId: string;
  subjectId: string;
  period: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  classId: string;
}

export interface Grade {
  id?: string;
  studentId: string;
  subjectId: string;
  classId: string;
  score: number;
  maxScore: number;
  description: string;
  date: string;
  semester: number;
  updatedAt?: any;
}

export interface MilkBrushingRecord {
  id?: string;
  date: string;
  studentId: string;
  type: 'milk' | 'brushing';
  status: boolean;
}

export interface Saving {
  id?: string;
  studentId: string;
  date: string;
  amount: number;
  type: 'deposit' | 'withdraw';
}
