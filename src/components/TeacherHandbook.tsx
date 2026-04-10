import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, writeBatch, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { TeacherLink } from '../types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Globe, 
  Search, 
  X, 
  Bookmark, 
  Link as LinkIcon,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  FileText,
  School,
  Library,
  Video,
  Database,
  ShieldCheck,
  HelpCircle,
  MessageSquare,
  Settings,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

const ICON_OPTIONS = [
  { name: 'Globe', icon: Globe },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'GraduationCap', icon: GraduationCap },
  { name: 'LayoutDashboard', icon: LayoutDashboard },
  { name: 'FileText', icon: FileText },
  { name: 'School', icon: School },
  { name: 'Library', icon: Library },
  { name: 'Video', icon: Video },
  { name: 'Database', icon: Database },
  { name: 'ShieldCheck', icon: ShieldCheck },
  { name: 'MessageSquare', icon: MessageSquare },
  { name: 'Settings', icon: Settings },
];

const DEFAULT_LINKS = [
  { title: 'กระทรวงศึกษาธิการ', url: 'https://www.moe.go.th/', description: 'เว็บไซต์หลักกระทรวงศึกษาธิการ', category: 'หน่วยงานหลัก', iconName: 'School' },
  { title: 'สพฐ.', url: 'https://www.obec.go.th/', description: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน', category: 'หน่วยงานหลัก', iconName: 'Library' },
  { title: 'คุรุสภา', url: 'https://www.ksp.or.th/', description: 'สภาครูและบุคลากรทางการศึกษา', category: 'หน่วยงานหลัก', iconName: 'ShieldCheck' },
  { title: 'DLTV', url: 'https://www.dltv.ac.th/', description: 'มูลนิธิการศึกษาทางไกลผ่านดาวเทียม', category: 'แหล่งเรียนรู้', iconName: 'Video' },
  { title: 'ระบบ CCT', url: 'https://cct.equitableeducation.or.th/', description: 'ระบบปัจจัยพื้นฐานนักเรียนยากจน', category: 'ระบบงาน', iconName: 'Database' },
  { title: 'ระบบ DMC', url: 'https://portal.bopp-obec.info/dmc/', description: 'ระบบจัดเก็บข้อมูลนักเรียนรายบุคคล', category: 'ระบบงาน', iconName: 'FileText' },
  { title: 'ระบบ SGS', url: 'https://sgs.bopp-obec.info/', description: 'ระบบบริหารจัดการสถานศึกษา', category: 'ระบบงาน', iconName: 'LayoutDashboard' },
];

export default function TeacherHandbook() {
  const [links, setLinks] = useState<TeacherLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDefaultLinksModalOpen, setIsDefaultLinksModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<TeacherLink | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');

  // Form state
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ทั่วไป');
  const [iconName, setIconName] = useState('Globe');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'teacher_links'), 
      where('userId', '==', auth.currentUser.uid),
      orderBy('order', 'asc'), 
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const linksData: TeacherLink[] = [];
      snapshot.forEach((doc) => {
        linksData.push({ id: doc.id, ...doc.data() } as TeacherLink);
      });
      setLinks(linksData);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = links.findIndex((item) => item.id === active.id);
      const newIndex = links.findIndex((item) => item.id === over.id);

      const newLinks = arrayMove(links, oldIndex, newIndex);
      setLinks(newLinks);

      // Update order in Firestore
      try {
        const batch = writeBatch(db);
        newLinks.forEach((link, index) => {
          if (link.id) {
            const linkRef = doc(db, 'teacher_links', link.id);
            batch.update(linkRef, { order: index });
          }
        });
        await batch.commit();
      } catch (error) {
        console.error("Error updating order:", error);
      }
    }
  };

  const handleOpenModal = (link?: TeacherLink) => {
    if (link) {
      setEditingLink(link);
      setTitle(link.title);
      setUrl(link.url);
      setDescription(link.description || '');
      setCategory(link.category || 'ทั่วไป');
      setIconName(link.iconName || 'Globe');
    } else {
      setEditingLink(null);
      setTitle('');
      setUrl('');
      setDescription('');
      setCategory('ทั่วไป');
      setIconName('Globe');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const linkData = {
      title,
      url: url.startsWith('http') ? url : `https://${url}`,
      description,
      category,
      iconName,
      userId: auth.currentUser.uid,
      createdAt: editingLink ? editingLink.createdAt : new Date().toISOString(),
      order: editingLink ? (editingLink.order ?? links.length) : links.length
    };

    try {
      if (editingLink && editingLink.id) {
        await updateDoc(doc(db, 'teacher_links', editingLink.id), linkData);
      } else {
        await addDoc(collection(db, 'teacher_links'), linkData);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving link:", error);
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
      await deleteDoc(doc(db, 'teacher_links', itemToDelete));
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
    } catch (error) {
      console.error("Error deleting link:", error);
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const addDefaultLinks = async () => {
    if (!auth.currentUser) return;
    try {
      const batch = writeBatch(db);
      DEFAULT_LINKS.forEach((link, index) => {
        const newDocRef = doc(collection(db, 'teacher_links'));
        batch.set(newDocRef, {
          ...link,
          userId: auth.currentUser!.uid,
          createdAt: new Date().toISOString(),
          order: links.length + index
        });
      });
      await batch.commit();
      setIsDefaultLinksModalOpen(false);
    } catch (error) {
      console.error("Error adding default links:", error);
    }
  };

  const categories = ['ทั้งหมด', ...Array.from(new Set([...DEFAULT_LINKS.map(l => l.category), ...links.map(l => l.category || 'ทั่วไป')]))];

  const filteredLinks = links.filter(link => {
    const matchesSearch = link.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         link.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ทั้งหมด' || link.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getIconComponent = (name: string) => {
    const iconObj = ICON_OPTIONS.find(i => i.name === name);
    const IconComp = iconObj ? iconObj.icon : Globe;
    return <IconComp size={24} />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold uppercase tracking-wider">
            <Globe size={14} />
            <span>Resource Hub</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">เว็บไซต์สำหรับครู</h2>
          <p className="text-slate-500 text-lg max-w-2xl">รวบรวมเว็บไซต์ที่จำเป็นและลิงก์ส่วนตัวสำหรับการทำงานของครูมืออาชีพ</p>
        </div>
        <div className="flex gap-3 w-full lg:w-auto">
          {links.length === 0 && (
            <button
              onClick={() => setIsDefaultLinksModalOpen(true)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all font-bold shadow-sm"
            >
              <Bookmark size={20} />
              <span>เพิ่มลิงก์แนะนำ</span>
            </button>
          )}
          <button
            onClick={() => handleOpenModal()}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-2xl hover:bg-blue-700 transition-all font-bold shadow-xl shadow-blue-200 active:scale-95"
          >
            <Plus size={20} />
            <span>เพิ่มลิงก์ใหม่</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-4 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="ค้นหาชื่อเว็บไซต์..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm outline-none text-slate-700 font-medium"
          />
        </div>
        <div className="lg:col-span-8 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-6 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all border",
                selectedCategory === cat
                  ? "bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Links Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <SortableContext
            items={filteredLinks.map(l => l.id!)}
            strategy={rectSortingStrategy}
          >
            <AnimatePresence mode="popLayout">
              {filteredLinks.map((link) => (
                <SortableLinkCard 
                  key={link.id} 
                  link={link} 
                  onEdit={handleOpenModal} 
                  onDelete={handleDelete}
                  getIconComponent={getIconComponent}
                />
              ))}
            </AnimatePresence>
          </SortableContext>

          {filteredLinks.length === 0 && (
          <div className="col-span-full py-24 text-center bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200 shadow-sm">
              <LinkIcon size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">ไม่พบข้อมูลที่คุณค้นหา</h3>
            <p className="text-slate-500 max-w-md mx-auto">ลองเปลี่ยนคำค้นหา หรือเพิ่มลิงก์เว็บไซต์ใหม่เข้าสู่คลังข้อมูลของคุณ</p>
            {links.length === 0 && (
              <button
                onClick={() => setIsDefaultLinksModalOpen(true)}
                className="mt-8 text-blue-600 font-black hover:text-blue-700 underline underline-offset-8 decoration-2"
              >
                เพิ่มลิงก์แนะนำเริ่มต้น
              </button>
            )}
          </div>
        )}
      </div>
      </DndContext>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">ยืนยันการลบ?</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">คุณแน่ใจหรือไม่ที่จะลบลิงก์นี้? ข้อมูลจะถูกลบออกจากระบบอย่างถาวร</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => { setIsDeleteModalOpen(false); setItemToDelete(null); }}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                >
                  ลบข้อมูล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Default Links Confirmation Modal */}
      <AnimatePresence>
        {isDefaultLinksModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[110]">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bookmark size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2">เพิ่มลิงก์แนะนำ</h3>
              <p className="text-slate-500 mb-8 leading-relaxed">ต้องการเพิ่มลิงก์เว็บไซต์สำคัญสำหรับการทำงานของครูเข้าสู่รายการของคุณหรือไม่?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDefaultLinksModalOpen(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={addDefaultLinks}
                  className="flex-1 px-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                  เพิ่มลิงก์
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[100]">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200">
                    {editingLink ? <Edit size={24} /> : <Plus size={24} />}
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-none">
                      {editingLink ? 'แก้ไขข้อมูลเว็บไซต์' : 'เพิ่มเว็บไซต์ใหม่'}
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">กรอกข้อมูลเพื่อบันทึกลงในคลังข้อมูล</p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">ชื่อเว็บไซต์ *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                      placeholder="เช่น ระบบ DMC"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">URL เว็บไซต์ *</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        required
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full border border-slate-200 rounded-2xl pl-12 pr-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium"
                        placeholder="www.example.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">เลือกไอคอน</label>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 p-4 bg-slate-50 rounded-[2rem] border border-slate-100">
                    {ICON_OPTIONS.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setIconName(item.name)}
                        className={cn(
                          "p-3 rounded-xl transition-all flex items-center justify-center",
                          iconName === item.name
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110"
                            : "bg-white text-slate-400 hover:text-slate-600 hover:shadow-sm"
                        )}
                      >
                        <item.icon size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black text-slate-700 uppercase tracking-wider">หมวดหมู่</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium appearance-none bg-white"
                    >
                      <option value="ทั่วไป">ทั่วไป</option>
                      <option value="หน่วยงานหลัก">หน่วยงานหลัก</option>
                      <option value="ระบบงาน">ระบบงาน</option>
                      <option value="แหล่งเรียนรู้">แหล่งเรียนรู้</option>
                      <option value="ส่วนตัว">ส่วนตัว</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-black text-slate-700 uppercase tracking-wider">รายละเอียดเพิ่มเติม</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full border border-slate-200 rounded-2xl px-5 py-4 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium resize-none"
                    placeholder="ระบุรายละเอียดสั้นๆ เกี่ยวกับเว็บไซต์นี้..."
                  ></textarea>
                </div>

                <div className="pt-6 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-8 py-5 border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-8 py-5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all active:scale-95"
                  >
                    บันทึกข้อมูล
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SortableLinkCardProps {
  link: TeacherLink;
  onEdit: (link: TeacherLink) => void;
  onDelete: (id: string) => void;
  getIconComponent: (name: string) => React.ReactNode;
}

function SortableLinkCard({ link, onEdit, onDelete, getIconComponent }: SortableLinkCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: link.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white rounded-[2rem] border border-slate-200 p-6 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:border-blue-100 transition-all duration-500 flex flex-col h-full"
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners}
        className="absolute top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500"
      >
        <GripVertical size={20} />
      </div>

      {/* Card Header */}
      <div className="flex justify-between items-start mb-6">
        <div className={cn(
          "p-4 rounded-2xl transition-all duration-500 shadow-sm",
          "bg-slate-50 text-slate-600 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-blue-200 group-hover:shadow-lg group-hover:-translate-y-1"
        )}>
          {getIconComponent(link.iconName || 'Globe')}
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
          {link.userId === auth.currentUser?.uid && (
            <>
              <button 
                onClick={() => onEdit(link)}
                className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                title="แก้ไข"
              >
                <Edit size={18} />
              </button>
              <button 
                onClick={() => onDelete(link.id!)}
                className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="ลบ"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {link.category || 'ทั่วไป'}
          </span>
        </div>
        <h3 className="font-black text-xl text-slate-900 leading-tight group-hover:text-blue-600 transition-colors">
          {link.title}
        </h3>
        <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 min-h-[2.5rem]">
          {link.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
        </p>
      </div>

      {/* Card Footer */}
      <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <Globe size={14} />
          <span className="text-[10px] font-medium truncate max-w-[120px]">
            {new URL(link.url).hostname}
          </span>
        </div>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-slate-100"
        >
          <span>เยี่ยมชม</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
