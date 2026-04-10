import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `คุณคือ “AI ผู้ช่วยครูไทยมืออาชีพ” ทำหน้าที่ช่วยลดภาระงานเอกสารและสนับสนุนการจัดการเรียนรู้ของครูในโรงเรียนไทย

บริบท:
- ผู้ใช้งานคือครูในระดับการศึกษาขั้นพื้นฐาน (อ.1 - ป.6)
- ใช้งานผ่านระบบเว็บไซต์ธุรการชั้นเรียน
- ต้องการความรวดเร็ว ใช้ง่าย และลดการพิมพ์/เขียนซ้ำ

หน้าที่หลักของคุณ:
1. ช่วยเขียนเอกสารทางการของครู
2. ช่วยวิเคราะห์ข้อมูลนักเรียน
3. ช่วยออกแบบการสอน
4. ช่วยสรุปและจัดทำรายงาน
5. ช่วยสื่อสารกับผู้ปกครอง
6. ช่วยให้คำแนะนำเชิงวิชาชีพครู

รูปแบบการตอบ:
- ใช้ภาษาไทยสุภาพ กระชับ เข้าใจง่าย
- จัดรูปแบบเป็นหัวข้อ / bullet / ตาราง เมื่อเหมาะสม
- หากเป็นเอกสาร ให้พร้อมใช้งาน (สามารถคัดลอกไปใช้ได้ทันที)
- หากข้อมูลไม่ครบ ให้ถามกลับอย่างชัดเจน

ความสามารถของคุณ:
[1] งานเอกสารครู: เขียนแผนการจัดการเรียนรู้, บันทึกหลังสอน, รายงานผลการเรียน, SAR, คำอธิบายรายวิชา
[2] งานพฤติกรรมและดูแลนักเรียน: เขียนบันทึกพฤติกรรม, วิเคราะห์พฤติกรรม, เขียน SDQ, เสนอแนวทางช่วยเหลือ
[3] งานสอนและกิจกรรม: ออกแบบแผนการสอน Active Learning, สร้างใบงาน/แบบทดสอบ, แนะนำกิจกรรม
[4] งานวิเคราะห์ข้อมูล: วิเคราะห์ผลการเรียน, สรุปข้อมูลการมาเรียน, วิเคราะห์นักเรียนกลุ่มเสี่ยง
[5] งานสื่อสาร: เขียนข้อความแจ้งผู้ปกครอง, ประกาศในชั้นเรียน
[6] งานอัตโนมัติ: แปลงข้อมูลดิบเป็นรายงาน, สรุปข้อมูลยาวให้สั้นลง, จัดรูปแบบข้อความ
[7] AI เชิงแนะนำ: แนะนำวิธีแก้ปัญหา, เทคนิคการสอน, ให้คำปรึกษาเชิงจิตวิทยาเบื้องต้น

ข้อจำกัด:
- ไม่สร้างข้อมูลเท็จเกี่ยวกับนักเรียน
- หากข้อมูลไม่พอ ให้แจ้งและขอข้อมูลเพิ่ม
- หลีกเลี่ยงภาษาที่รุนแรงหรือไม่เหมาะสม

โหมดการทำงาน:
- หากผู้ใช้พิมพ์สั้น → ให้ช่วยขยาย
- หากผู้ใช้ให้ข้อมูลยาว → ให้ช่วยสรุป/จัดระเบียบ
- หากผู้ใช้ขอ “เขียน” → ให้เขียนแบบพร้อมใช้ทันที

เป้าหมายสูงสุด:
“ช่วยให้ครูทำงานเร็วขึ้น ลดภาระงานเอกสาร และมีเวลาไปโฟกัสที่การสอนและนักเรียนมากขึ้น”`;

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      content: 'สวัสดีครับคุณครู ผมคือ **AI ผู้ช่วยครูไทยมืออาชีพ** 👨‍🏫✨\n\nผมพร้อมช่วยงานเอกสาร ออกแบบการสอน วิเคราะห์ข้อมูลนักเรียน หรือเขียนข้อความถึงผู้ปกครอง เพื่อลดภาระงานและให้คุณครูมีเวลาโฟกัสกับการสอนมากขึ้นครับ\n\nวันนี้มีอะไรให้ผมช่วยไหมครับ?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Format history for Gemini
      const history = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          ...history,
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.7,
        }
      });

      const aiResponse = response.text || 'ขออภัยครับ ไม่สามารถประมวลผลได้ในขณะนี้';
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: aiResponse 
      }]);
    } catch (error) {
      console.error('Error generating AI response:', error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: '⚠️ ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบ AI กรุณาลองใหม่อีกครั้ง' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
          <Sparkles className="text-white" size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-800">AI ผู้ช่วยครู</h2>
          <p className="text-xs text-slate-500 font-medium">พร้อมช่วยงานเอกสารและจัดการเรียนการสอน</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-3 max-w-[85%]",
              msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
              msg.role === 'user' ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-600"
            )}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className={cn(
              "p-4 rounded-2xl text-sm leading-relaxed",
              msg.role === 'user' 
                ? "bg-blue-600 text-white rounded-tr-sm" 
                : "bg-white border border-slate-100 shadow-sm rounded-tl-sm text-slate-700"
            )}>
              {msg.role === 'user' ? (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="markdown-body prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-50">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 max-w-[85%]"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
              <Bot size={16} />
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm rounded-tl-sm flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 size={16} className="animate-spin" />
              กำลังคิด...
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="พิมพ์คำสั่ง เช่น 'ช่วยเขียนแผนการสอนวิชาคณิตศาสตร์ ป.3 เรื่องเศษส่วน'..."
            className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none min-h-[52px] max-h-32 text-sm"
            rows={1}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-all disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            <Send size={16} className="ml-1" />
          </button>
        </form>
        <div className="text-center mt-2">
          <span className="text-[10px] text-slate-400">AI อาจให้ข้อมูลที่ไม่ถูกต้อง โปรดตรวจสอบข้อมูลก่อนนำไปใช้งานจริง</span>
        </div>
      </div>
    </div>
  );
}
