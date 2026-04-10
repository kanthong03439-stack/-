import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { TeacherDocument, TeacherDocumentAttachment } from '../types';
import { motion } from 'motion/react';
import { Plus, Edit, Trash2, FileText, Image as ImageIcon, Link as LinkIcon, Download, FileDown, X, Upload } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, AlignmentType, WidthType, ImageRun, ExternalHyperlink } from 'docx';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import { toJpeg } from 'html-to-image';
import autoTable from 'jspdf-autotable';
import { setupThaiFont } from '../lib/pdfFont';
import toast from 'react-hot-toast';

export default function TeacherDocuments() {
  const [documents, setDocuments] = useState<TeacherDocument[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<TeacherDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [organization, setOrganization] = useState('');
  const [dateReceived, setDateReceived] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TeacherDocument['category']>('award');
  const [attachments, setAttachments] = useState<TeacherDocumentAttachment[]>([]);
  
  // Filter state
  const [activeTab, setActiveTab] = useState<'all' | 'award' | 'official_docs'>('all');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH');
  };

  const formatDateLong = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'teacher_documents'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData: TeacherDocument[] = [];
      snapshot.forEach((doc) => {
        docsData.push({ id: doc.id, ...doc.data() } as TeacherDocument);
      });
      // Sort by date descending
      docsData.sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
      setDocuments(docsData);
      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.warn('Permission denied, ignoring...');
        return;
      }
      console.error('Snapshot error:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenModal = (doc?: TeacherDocument) => {
    if (doc) {
      setEditingDoc(doc);
      setTitle(doc.title);
      setOrganization(doc.organization);
      setDateReceived(doc.dateReceived);
      setDescription(doc.description);
      setCategory(doc.category || 'award');
      setAttachments(doc.attachments || []);
    } else {
      setEditingDoc(null);
      setTitle('');
      setOrganization('');
      setDateReceived(new Date().toISOString().split('T')[0]);
      setDescription('');
      setCategory(activeTab === 'official_docs' ? 'order' : 'award');
      setAttachments([]);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDoc(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !auth.currentUser) return;
    
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      toast.error("ยังไม่ได้ตั้งค่า VITE_CLOUDINARY_CLOUD_NAME หรือ VITE_CLOUDINARY_UPLOAD_PRESET ในไฟล์ .env");
      return;
    }

    setUploading(true);
    const newAttachments = [...attachments];
    
    for (let i = 0; i < e.target.files.length; i++) {
      const file = e.target.files[i];
      let type: 'image' | 'file' = file.type.startsWith('image/') ? 'image' : 'file';
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        // Use 'auto' resource type to handle both images and raw files (PDFs, docs, etc.)
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.secure_url) {
          newAttachments.push({
            name: file.name,
            url: data.secure_url,
            type
          });
        } else {
          throw new Error(data.error?.message || 'Upload failed');
        }
      } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        alert(`เกิดข้อผิดพลาดในการอัปโหลดไฟล์ ${file.name} ไปยัง Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    setAttachments(newAttachments);
    setUploading(false);
    
    // Reset file input
    e.target.value = '';
  };

  const handleAddLink = () => {
    const url = prompt("กรุณาระบุ URL ของลิงก์:");
    if (url) {
      const name = prompt("กรุณาระบุชื่อลิงก์:") || url;
      setAttachments([...attachments, { name, url, type: 'link' }]);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const docData = {
      userId: auth.currentUser.uid,
      title,
      organization,
      dateReceived,
      description,
      category,
      attachments,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingDoc && editingDoc.id) {
        await updateDoc(doc(db, 'teacher_documents', editingDoc.id), docData);
      } else {
        await addDoc(collection(db, 'teacher_documents'), {
          ...docData,
          createdAt: new Date().toISOString()
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving document:", error);
      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, 'teacher_documents', itemToDelete));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const filteredDocuments = documents.filter(doc => {
    // Tab filter
    if (activeTab === 'award' && doc.category !== 'award') return false;
    if (activeTab === 'official_docs' && !['order', 'memo', 'official', 'other'].includes(doc.category || '')) return false;
    
    // Sub-category filter (only for official_docs tab)
    if (activeTab === 'official_docs' && subCategoryFilter && doc.category !== subCategoryFilter) return false;

    if (!doc.dateReceived) return !filterMonth && !filterYear;
    const date = new Date(doc.dateReceived);
    if (isNaN(date.getTime())) return !filterMonth && !filterYear;
    const matchMonth = filterMonth ? date.getMonth() + 1 === parseInt(filterMonth) : true;
    const matchYear = filterYear ? date.getFullYear() === parseInt(filterYear) : true;
    return matchMonth && matchYear;
  });

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      saveAs(blob, filename);
    } catch (error) {
      console.error("Download error:", error);
      // Fallback to opening in new tab
      window.open(url, '_blank');
    }
  };

  const getCategoryLabel = (cat?: string) => {
    switch (cat) {
      case 'award': return 'ผลงาน/รางวัล';
      case 'order': return 'คำสั่ง';
      case 'memo': return 'บันทึกข้อความ';
      case 'official': return 'หนังสือราชการ';
      case 'other': return 'อื่นๆ';
      default: return 'ไม่ระบุ';
    }
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'image') return <ImageIcon size={16} className="text-blue-500" />;
    if (type === 'link') return <LinkIcon size={16} className="text-emerald-500" />;
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText size={16} className="text-rose-500" />;
    if (['doc', 'docx'].includes(ext || '')) return <FileText size={16} className="text-blue-600" />;
    if (['xls', 'xlsx'].includes(ext || '')) return <FileText size={16} className="text-green-600" />;
    return <FileText size={16} className="text-slate-500" />;
  };

  const exportToWord = async () => {
    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: "ที่", alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ประเภท", alignment: AlignmentType.CENTER })], width: { size: 12, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ชื่อเอกสาร/รางวัล", alignment: AlignmentType.CENTER })], width: { size: 18, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "หน่วยงานที่มอบให้", alignment: AlignmentType.CENTER })], width: { size: 18, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "วันที่ได้รับ", alignment: AlignmentType.CENTER })], width: { size: 11, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "หมายเหตุ", alignment: AlignmentType.CENTER })], width: { size: 11, type: WidthType.PERCENTAGE } }),
          new TableCell({ children: [new Paragraph({ text: "ไฟล์แนบ", alignment: AlignmentType.CENTER })], width: { size: 25, type: WidthType.PERCENTAGE } }),
        ],
      }),
    ];

    for (let index = 0; index < filteredDocuments.length; index++) {
      const docItem = filteredDocuments[index];
      const attachmentParagraphs: Paragraph[] = [];

      if (docItem.attachments && docItem.attachments.length > 0) {
        for (const att of docItem.attachments) {
          if (att.type === 'image') {
            try {
              const response = await fetch(att.url);
              const blob = await response.blob();
              const arrayBuffer = await blob.arrayBuffer();
              
              attachmentParagraphs.push(
                new Paragraph({
                  children: [
                    new ImageRun({
                      data: arrayBuffer,
                      transformation: {
                        width: 150,
                        height: 75,
                      },
                      type: 'jpg',
                    }),
                  ],
                })
              );
            } catch (e) {
              attachmentParagraphs.push(
                new Paragraph({
                  children: [
                    new ExternalHyperlink({
                      children: [
                        new TextRun({
                          text: `[รูปภาพ] ${att.name}`,
                          style: "Hyperlink",
                        }),
                      ],
                      link: att.url,
                    }),
                  ],
                })
              );
            }
          } else {
            attachmentParagraphs.push(
              new Paragraph({
                children: [
                  new ExternalHyperlink({
                    children: [
                      new TextRun({
                        text: `[${att.type === 'link' ? 'ลิงก์' : 'ไฟล์'}] ${att.name}`,
                        style: "Hyperlink",
                      }),
                    ],
                    link: att.url,
                  }),
                ],
              })
            );
          }
        }
      } else {
        attachmentParagraphs.push(new Paragraph({ text: "-" }));
      }

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: (index + 1).toString(), alignment: AlignmentType.CENTER })] }),
            new TableCell({ children: [new Paragraph({ text: getCategoryLabel(docItem.category) })] }),
            new TableCell({ children: [new Paragraph({ text: docItem.title })] }),
            new TableCell({ children: [new Paragraph({ text: docItem.organization })] }),
            new TableCell({ children: [new Paragraph({ text: formatDate(docItem.dateReceived) })] }),
            new TableCell({ children: [new Paragraph({ text: docItem.description || "-" })] }),
            new TableCell({ children: attachmentParagraphs }),
          ],
        })
      );
    }

    const doc = new Document({
      styles: {
        default: {
          document: {
            run: {
              font: "TH Sarabun PSK",
              size: 32, // 16pt
            },
          },
        },
      },
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "รายงานเอกสาร ผลงาน และรางวัลของครู",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `ประจำเดือน ${filterMonth ? new Date(2000, parseInt(filterMonth) - 1).toLocaleString('th-TH', { month: 'long' }) : 'ทั้งหมด'} ปี ${filterYear ? parseInt(filterYear) + 543 : 'ทั้งหมด'}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Table({
              rows: tableRows,
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Teacher_Documents_Report.docx`);
  };

  const exportToPDF = async () => {
    if (filteredDocuments.length === 0) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    setIsGeneratingPDF(true);

    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      await setupThaiFont(doc);

      doc.setFont('Sarabun', 'bold');
      doc.setFontSize(18);
      doc.text("รายงานเอกสาร ผลงาน และรางวัลของครู", 148.5, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`ประจำเดือน ${filterMonth ? new Date(2000, parseInt(filterMonth) - 1).toLocaleString('th-TH', { month: 'long' }) : 'ทั้งหมด'} ปี ${filterYear ? parseInt(filterYear) + 543 : 'ทั้งหมด'}`, 148.5, 22, { align: 'center' });

      const tableData = filteredDocuments.map((docItem, index) => [
        (index + 1).toString(),
        getCategoryLabel(docItem.category),
        docItem.title,
        docItem.organization,
        formatDate(docItem.dateReceived),
        docItem.description || "-"
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['ที่', 'ประเภท', 'ชื่อเอกสาร/รางวัล', 'หน่วยงานที่มอบให้', 'วันที่ได้รับ', 'หมายเหตุ']],
        body: tableData,
        styles: { font: 'Sarabun', fontSize: 10 },
        headStyles: { fillColor: [37, 99, 235], halign: 'center' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 60 },
          3: { cellWidth: 60 },
          4: { halign: 'center', cellWidth: 30 },
          5: { cellWidth: 60 },
        },
      });
      
      doc.save('Teacher_Documents_Report.pdf');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้าง PDF กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Split documents into pages for PDF
  const itemsPerPage = 8;
  const pdfPages = [];
  for (let i = 0; i < filteredDocuments.length; i += itemsPerPage) {
    pdfPages.push(filteredDocuments.slice(i, i + itemsPerPage));
  }
  if (pdfPages.length === 0) pdfPages.push([]); // At least one page

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="space-y-6 relative">
      {/* Hidden PDF Container */}
      <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none" style={{ width: '210mm' }}>
        <div ref={pdfContainerRef}>
          {pdfPages.map((pageDocs, pageIndex) => (
            <div 
              key={pageIndex} 
              className="bg-white w-[210mm] h-[297mm] p-[20mm] box-border relative flex flex-col"
              style={{ fontFamily: "'Sarabun', sans-serif" }}
            >
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold mb-2 text-slate-800">รายงานเอกสาร ผลงาน และรางวัลของครู</h1>
                <p className="text-lg text-slate-600">โรงเรียนบ้านแม่ตาวแพะ</p>
                <p className="text-sm text-slate-500 mt-2">
                  ประจำเดือน {filterMonth ? new Date(2000, parseInt(filterMonth) - 1).toLocaleString('th-TH', { month: 'long' }) : 'ทั้งหมด'} ปี {filterYear ? parseInt(filterYear) + 543 : 'ทั้งหมด'}
                </p>
              </div>

              <table className="w-full border-collapse border border-slate-300 text-[14px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-center w-[5%]">ที่</th>
                    <th className="border border-slate-300 p-2 text-left w-[12%]">ประเภท</th>
                    <th className="border border-slate-300 p-2 text-left w-[20%]">ชื่อเอกสาร/รางวัล</th>
                    <th className="border border-slate-300 p-2 text-left w-[20%]">หน่วยงานที่มอบให้</th>
                    <th className="border border-slate-300 p-2 text-center w-[10%]">วันที่ได้รับ</th>
                    <th className="border border-slate-300 p-2 text-left w-[10%]">หมายเหตุ</th>
                    <th className="border border-slate-300 p-2 text-left w-[23%]">ไฟล์แนบ</th>
                  </tr>
                </thead>
                <tbody>
                  {pageDocs.map((doc, idx) => (
                    <tr key={doc.id}>
                      <td className="border border-slate-300 p-2 text-center align-middle">{pageIndex * itemsPerPage + idx + 1}</td>
                      <td className="border border-slate-300 p-2 align-middle text-[12px]">{getCategoryLabel(doc.category)}</td>
                      <td className="border border-slate-300 p-2 align-middle font-bold">{doc.title}</td>
                      <td className="border border-slate-300 p-2 align-middle">{doc.organization}</td>
                      <td className="border border-slate-300 p-2 text-center align-middle">{formatDate(doc.dateReceived)}</td>
                      <td className="border border-slate-300 p-2 align-middle">{doc.description || '-'}</td>
                      <td className="border border-slate-300 p-2 align-middle">
                        {doc.attachments && doc.attachments.length > 0 ? (
                          <div className="flex flex-col gap-2 items-center">
                            {doc.attachments.map((att, i) => (
                              <div key={i} className="text-center">
                                {att.type === 'image' ? (
                                  <img 
                                    src={att.url} 
                                    alt={att.name} 
                                    className="w-[150px] h-[75px] object-cover rounded border border-slate-200"
                                    crossOrigin="anonymous"
                                  />
                                ) : (
                                  <div className="text-[10px] text-blue-600 truncate max-w-[160px]">
                                    [{att.type === 'link' ? 'ลิงก์' : 'ไฟล์'}] {att.name}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                  {pageDocs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="border border-slate-300 p-8 text-center text-slate-400">
                        ไม่พบข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="mt-auto pt-8 flex justify-between text-xs text-slate-400">
                <p>ระบบงานธุรการชั้นเรียน โรงเรียนบ้านแม่ตาวแพะ</p>
                <p>หน้า {pageIndex + 1} จาก {pdfPages.length}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">เอกสารและผลงานครู</h2>
          <p className="text-slate-500">พื้นที่จัดเก็บเอกสารทางราชการ ผลงาน และรางวัล</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          <span>เพิ่มข้อมูล</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('all'); setSubCategoryFilter(''); }}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'all' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ทั้งหมด
          {activeTab === 'all' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => { setActiveTab('award'); setSubCategoryFilter(''); }}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'award' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          ผลงานและรางวัล
          {activeTab === 'award' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
        <button
          onClick={() => { setActiveTab('official_docs'); setSubCategoryFilter(''); }}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'official_docs' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          เอกสารทางราชการ
          {activeTab === 'official_docs' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
        {activeTab === 'official_docs' && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทเอกสาร</label>
            <select 
              value={subCategoryFilter} 
              onChange={(e) => setSubCategoryFilter(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 w-48"
            >
              <option value="">ทั้งหมด</option>
              <option value="order">คำสั่ง</option>
              <option value="memo">บันทึกข้อความ</option>
              <option value="official">หนังสือราชการ</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">เดือน</label>
          <select 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 w-40"
          >
            <option value="">ทั้งหมด</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2000, i).toLocaleString('th-TH', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ปี (พ.ศ.)</label>
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 w-32"
          >
            <option value="">ทั้งหมด</option>
            {Array.from({ length: 5 }, (_, i) => {
              const year = new Date().getFullYear() - i;
              return <option key={year} value={year}>{year + 543}</option>;
            })}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={exportToWord}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <FileDown size={20} />
            <span>ดาวน์โหลด Word</span>
          </button>
          <button
            onClick={exportToPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50"
          >
            {isGeneratingPDF ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <Download size={20} />
            )}
            <span>{isGeneratingPDF ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDocuments.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="space-y-1">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    doc.category === 'award' ? 'bg-amber-100 text-amber-700' : 
                    doc.category === 'order' ? 'bg-blue-100 text-blue-700' :
                    doc.category === 'memo' ? 'bg-purple-100 text-purple-700' :
                    doc.category === 'official' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {getCategoryLabel(doc.category)}
                  </span>
                  <h3 className="font-bold text-lg text-slate-800 line-clamp-2">{doc.title}</h3>
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button onClick={() => handleOpenModal(doc)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleDelete(doc.id!)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600 mb-4">
                <p><span className="font-medium">หน่วยงาน:</span> {doc.organization}</p>
                <p><span className="font-medium">วันที่ได้รับ:</span> {formatDateLong(doc.dateReceived)}</p>
                {doc.description && <p className="line-clamp-2 text-slate-500 mt-2">{doc.description}</p>}
              </div>

              {doc.attachments && doc.attachments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">ไฟล์แนบ ({doc.attachments.length})</h4>
                  <div className="space-y-2">
                    {doc.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-blue-50/50 p-2 rounded-lg group">
                        <a 
                          href={att.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline flex-1 truncate"
                        >
                          {getFileIcon(att.name, att.type)}
                          <span className="truncate">{att.name}</span>
                        </a>
                        {att.type !== 'link' && (
                          <button 
                            onClick={() => downloadFile(att.url, att.name)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="ดาวน์โหลด"
                          >
                            <Download size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {filteredDocuments.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
            ไม่มีข้อมูลเอกสารหรือรางวัลในระบบ
          </div>
        )}
      </div>



      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-4">ยืนยันการลบ</h3>
            <p className="text-slate-600 mb-6">คุณแน่ใจหรือไม่ที่จะลบเอกสารนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                ลบข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-800">
                {editingDoc ? 'แก้ไขข้อมูล' : 'เพิ่มเอกสาร/รางวัล'}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทเอกสาร *</label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="award">ผลงานและรางวัล</option>
                    <option value="order">คำสั่ง</option>
                    <option value="memo">บันทึกข้อความ</option>
                    <option value="official">หนังสือราชการ</option>
                    <option value="other">อื่นๆ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อเอกสาร/รางวัล *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="เช่น รางวัลครูดีเด่น, คำสั่งแต่งตั้งคณะกรรมการ..."
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">หน่วยงานที่มอบให้ *</label>
                  <input
                    type="text"
                    required
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">วันที่ได้รับ *</label>
                  <input
                    type="date"
                    required
                    value={dateReceived}
                    onChange={(e) => setDateReceived(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">รายละเอียดเพิ่มเติม</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">ไฟล์แนบ</label>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <label className="cursor-pointer flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                    <Upload size={18} />
                    <span>อัปโหลดไฟล์/รูปภาพ</span>
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <LinkIcon size={18} />
                    <span>แนบลิงก์</span>
                  </button>
                </div>

                {uploading && <p className="text-sm text-blue-600 mb-2">กำลังอัปโหลด...</p>}

                {attachments.length > 0 && (
                  <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                    {attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-100">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {att.type === 'image' ? <ImageIcon size={16} className="text-blue-500 shrink-0" /> : 
                           att.type === 'link' ? <LinkIcon size={16} className="text-green-500 shrink-0" /> : 
                           <FileText size={16} className="text-orange-500 shrink-0" />}
                          <span className="text-sm truncate" title={att.name}>{att.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
