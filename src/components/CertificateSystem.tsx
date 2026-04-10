import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { Student } from '../types';
import { FileText, Download, Award, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';
import { setupThaiFont } from '../lib/pdfFont';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

import { fetchStudentsForUser } from '../lib/firestoreUtils';

export default function CertificateSystem() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');

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
    const fetchStudents = async () => {
      const studentList = await fetchStudentsForUser();
      setStudents(studentList);
    };
    fetchStudents();
  }, []);

  const filteredStudents = students
    .filter(s => {
      const matchesSearch = `${s.prefix || ''}${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = selectedClass === 'all' || (s.classId && s.classId.startsWith(selectedClass));
      return matchesSearch && matchesClass;
    })
    .sort((a, b) => {
      // Sort by classId first
      const classCompare = (a.classId || '').localeCompare(b.classId || '');
      if (classCompare !== 0) return classCompare;
      // Then by name
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });

  const generateCertificate = async (student: Student) => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      await setupThaiFont(doc);
      
      // Add border
      doc.setDrawColor(37, 99, 235); // Blue-600
      doc.setLineWidth(2);
      doc.rect(10, 10, 277, 190);
      doc.setDrawColor(219, 234, 254); // Blue-100
      doc.setLineWidth(1);
      doc.rect(12, 12, 273, 186);

      // Title
      doc.setFont('Sarabun', 'bold');
      doc.setFontSize(36);
      doc.setTextColor(30, 58, 138); // Blue-900
      doc.text('ใบรับรองผลการศึกษา', 148.5, 50, { align: 'center' });
      
      // Subtitle
      doc.setFont('Sarabun', 'normal');
      doc.setFontSize(20);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text('ขอมอบใบรับรองฉบับนี้เพื่อแสดงว่า', 148.5, 75, { align: 'center' });
      
      // Student Name
      doc.setFont('Sarabun', 'bold');
      doc.setFontSize(32);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text(`${student.prefix || ''}${student.firstName} ${student.lastName}`, 148.5, 100, { align: 'center' });
      
      // Details
      doc.setFont('Sarabun', 'normal');
      doc.setFontSize(18);
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(`รหัสนักเรียน: ${student.studentId}   ชั้น: ${student.classId}`, 148.5, 120, { align: 'center' });
      
      // Date
      const dateStr = format(new Date(), 'd MMMM yyyy', { locale: th });
      doc.setFontSize(16);
      doc.text(`ให้ไว้ ณ วันที่ ${dateStr}`, 148.5, 145, { align: 'center' });
      
      // Signature lines
      doc.setDrawColor(148, 163, 184); // Slate-400
      doc.setLineWidth(0.5);
      
      doc.line(60, 170, 120, 170);
      doc.setFontSize(14);
      doc.text('(                                  )', 90, 180, { align: 'center' });
      doc.text('ครูประจำชั้น', 90, 190, { align: 'center' });
      
      doc.line(177, 170, 237, 170);
      doc.text('(                                  )', 207, 180, { align: 'center' });
      doc.text('ผู้อำนวยการโรงเรียน', 207, 190, { align: 'center' });

      doc.save(`Certificate_${student.firstName}_${student.lastName}.pdf`);
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างใบรับรอง');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Award size={24} className="text-blue-600" />
          ใบรับรองและวุฒิบัตร
        </h3>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="ค้นหานักเรียน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClass(cls.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  selectedClass === cls.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cls.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => (
            <div key={student.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-800">{student.prefix || ''}{student.firstName} {student.lastName}</p>
                <p className="text-xs text-slate-400">ชั้น {student.classId}</p>
              </div>
              <button 
                onClick={() => generateCertificate(student)}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                <Download size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
