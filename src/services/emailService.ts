import emailjs from '@emailjs/browser';

export const sendApprovalEmail = async (userEmail: string, userName: string) => {
  const publicKey = (import.meta as any).env.VITE_EMAILJS_PUBLIC_KEY;
  const serviceId = (import.meta as any).env.VITE_EMAILJS_SERVICE_ID;
  const templateId = (import.meta as any).env.VITE_EMAILJS_TEMPLATE_ID;

  if (!publicKey || !serviceId || !templateId) {
    const missing = [];
    if (!publicKey) missing.push('VITE_EMAILJS_PUBLIC_KEY');
    if (!serviceId) missing.push('VITE_EMAILJS_SERVICE_ID');
    if (!templateId) missing.push('VITE_EMAILJS_TEMPLATE_ID');
    
    const errorMsg = `EmailJS is not fully configured. Missing: ${missing.join(', ')}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const templateParams = {
      to_email: userEmail,
      to_name: userName,
      message: 'บัญชีของคุณได้รับการอนุมัติจากผู้ดูแลระบบแล้ว คุณสามารถเข้าใช้งานระบบงานธุรการชั้นเรียน โรงเรียนบ้านแม่ตาวแพะ ได้ทันที',
      app_link: window.location.origin
    };

    console.log('Attempting to send email to:', userEmail);
    
    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      publicKey
    );

    console.log('EmailJS Response:', response);
    return response;
  } catch (error: any) {
    console.error('EmailJS Error Details:', {
      status: error?.status,
      text: error?.text,
      message: error?.message || error
    });
    throw error;
  }
};
