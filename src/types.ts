export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'teacher' | 'student';
  isApproved: boolean;
  classId?: string;
  studentId?: string;
  designation?: string;
  signatureUrl?: string;
  createdAt: string;
}

export interface StudentMaster {
  studentId: string;
  fullName: string;
}

export interface Student {
  id: string;
  studentId: string;
  studentNumber?: number;
  prefix?: string;
  firstName: string;
  lastName: string;
  classId: string;
  gender: 'male' | 'female';
  weight?: number;
  height?: number;
  birthDate?: string;
  photoUrl?: string;
  createdAt?: string;
  yearClasses?: { [year: string]: string };
}

export interface Attendance {
  id?: string;
  date: string;
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  classId: string;
  subjectId: string;
  period: number;
  academicYear: string;
  term: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  classId: string;
  academicYear: string;
  dayOfWeek?: string;
  period?: string; // Changed to string to support "1-2"
  timeRange?: string; // Added time range field
  iconName?: string;
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
  academicYear: string;
  term: string;
  updatedAt?: any;
}

export interface MilkBrushingRecord {
  id?: string;
  date: string;
  studentId: string;
  type: 'milk' | 'brushing';
  status: boolean;
  academicYear: string;
  term: string;
}

export interface Saving {
  id?: string;
  studentId: string;
  date: string;
  amount: number;
  type: 'deposit' | 'withdraw';
  academicYear: string;
}

export interface HealthRecord {
  id?: string;
  studentId: string;
  month: number;
  year: number;
  weight: number;
  height: number;
  classId: string;
  academicYear: string;
  term: string;
  updatedAt?: any;
}

export interface TeacherDocumentAttachment {
  name: string;
  url: string;
  type: 'image' | 'file' | 'link';
}

export interface TeacherDocument {
  id?: string;
  userId: string;
  title: string;
  organization: string;
  dateReceived: string;
  description: string;
  category?: 'award' | 'order' | 'memo' | 'official' | 'other';
  attachments: TeacherDocumentAttachment[];
  createdAt?: string;
}

export interface TeacherLink {
  id?: string;
  title: string;
  url: string;
  description?: string;
  category?: string;
  iconName?: string;
  order?: number;
  userId: string;
  createdAt: string;
}

export interface CalendarEvent {
  id?: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  description?: string;
  category?: string;
  color?: string;
  googleEventId?: string;
  userId: string;
  createdAt: string;
}
