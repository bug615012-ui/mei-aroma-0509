"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Leaf, CalendarDays, Clock, User, Phone, CheckCircle, Info, CreditCard, Ticket, Settings, ArrowRight, Wallet, Lock, Link as LinkIcon, Trash2, Calendar, Edit2, Save, X, Loader2, AlertCircle, Plus, Minus, CalendarX, ChevronRight, LogOut, Search, BarChart3, ChevronLeft } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, addDoc } from 'firebase/firestore';

// ==========================================
// 💡 Firebase 初始化與路徑設定 (鎖定為您的專屬專案)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyD61qTdz9nXgGXd6ew5WNIHxVBEXNPjmXA",
  authDomain: "meispa.firebaseapp.com",
  projectId: "meispa",
  storageBucket: "meispa.firebasestorage.app",
  messagingSenderId: "805080020583",
  appId: "1:805080020583:web:0088e93445682c4e6046c2",
  measurementId: "G-2MP5QK553Q"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 關鍵修正：強制固定 appId，避免環境變數注入斜線導致路徑段數錯誤，確保讀取您專屬的資料
const appId = 'mei-aroma-app';

const SERVICES = [
  { id: 's1', title: '30分鐘 局部體驗', duration: 30, desc: '適合局部放鬆、快速紓壓、輕盈體驗。', price: 600 },
  { id: 's2', title: '1小時 慢活療癒療程', duration: 60, desc: '適合身心放鬆、舒緩疲憊、日常保養。', price: 1200 },
  { id: 's3', title: '100分鐘 深層修護療程', duration: 100, desc: '適合深層放鬆、完整修復、全身療癒感。', price: 1500 },
];

const INITIAL_SETTINGS = {
  weekdayStart: '17:30',
  weekdayEnd: '20:00',
  weekdayBreakStart: '',
  weekdayBreakEnd: '',
  weekendStart: '10:00',
  weekendEnd: '17:00',
  weekendBreakStart: '',
  weekendBreakEnd: '',
  googleScriptUrl: '' 
};

// ==========================================
// 核心修正：跨平台台灣時間轉換引擎 (解決 Safari / iOS Invalid Date 問題)
// ==========================================
const getTWNow = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 8)); // UTC+8
};

const getTWDateStr = (offsetDays = 0) => {
  const twTime = getTWNow();
  if (offsetDays !== 0) {
    twTime.setDate(twTime.getDate() + offsetDays);
  }
  return twTime.getFullYear() + '-' + 
         String(twTime.getMonth() + 1).padStart(2, '0') + '-' + 
         String(twTime.getDate()).padStart(2, '0');
};

// ==========================================
// 共用元件
// ==========================================
function BankInfoBox() {
  return (
    <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 text-left animate-in zoom-in duration-300">
      <div className="flex items-center gap-2 mb-3 text-green-700 font-bold border-b border-green-100 pb-2">
        <CreditCard size={18} /> <span>匯款帳號資訊</span>
      </div>
      <div className="space-y-2 text-sm font-bold text-gray-600">
        <div className="flex justify-between items-center text-left">
          <span className="text-gray-400 font-medium">銀行名稱</span> 
          <span>聯邦銀行 營業部 (803)</span>
        </div>
        <div className="flex justify-between items-center text-left">
          <span className="text-gray-400 font-medium">銀行帳號</span> 
          <span className="font-mono text-gray-900 tracking-wider text-base">888504075033</span>
        </div>
        <div className="flex justify-between items-center text-left">
          <span className="text-gray-400 font-medium">帳戶戶名</span> 
          <span>徐宛甄</span>
        </div>
      </div>
      <div className="mt-4 p-2 bg-white rounded-xl text-[10px] text-red-400 font-bold text-center border border-red-50">
        * 匯款完成後請至 LINE 告知老師後五碼
      </div>
    </div>
  );
}

// ==========================================
// 主程式入口
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState('book');
  const [members, setMembers] = useState({});
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [bookings, setBookings] = useState([]); 
  const [specialClosures, setSpecialClosures] = useState([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    let displayMessage = "發生未知錯誤";
    if (typeof message === 'string') {
      displayMessage = message;
    } else if (message instanceof Error) {
      displayMessage = message.message;
    } else if (message && typeof message === 'object' && message.message) {
      displayMessage = message.message;
    } else {
      displayMessage = String(message);
    }
    setToast({ message: displayMessage, type });
    setTimeout(() => setToast(null), 3000);
  };

  // (1) 初始化身分驗證 (直接使用匿名登入，對應您的個人 Firebase 專案)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // (2) 數據監聽邏輯
  useEffect(() => {
    if (!user) return; 
    
    let isMounted = true;
    const publicPath = (coll) => collection(db, 'artifacts', appId, 'public', 'data', coll);

    const unsubMembers = onSnapshot(publicPath('members'), (snap) => {
      if (!isMounted) return;
      const data = {};
      snap.forEach(d => data[d.id] = d.data());
      setMembers(data);
    }, (err) => console.error("Firestore Members Error:", err));

    const unsubSettings = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), (docSnap) => {
      if (!isMounted) return;
      if (docSnap.exists()) setSettings(prev => ({ ...prev, ...docSnap.data() }));
      setIsLoading(false); // 成功取得資料後解鎖畫面
    }, (err) => {
      console.error("Firestore Settings Error:", err);
      if (isMounted) setIsLoading(false); // 即便權限被擋，也要強制解鎖畫面確保按鈕可點
    });

    const unsubBookings = onSnapshot(publicPath('bookings'), (snap) => {
      if (!isMounted) return;
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setBookings(data);
    }, (err) => console.error("Firestore Bookings Error:", err));

    const unsubClosures = onSnapshot(publicPath('special_closures'), (snap) => {
      if (!isMounted) return;
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setSpecialClosures(data);
    }, (err) => console.error("Firestore Closures Error:", err));

    // 安全防護機制：如果 Firebase 連線異常，2.5 秒後強制隱藏 Loading，避免網頁凍結
    const safetyTimeout = setTimeout(() => {
      if (isMounted) setIsLoading(false);
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      unsubMembers(); unsubSettings(); unsubBookings(); unsubClosures();
    };
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAF8] text-green-600">
        <Loader2 className="animate-spin mb-4" size={40} />
        <p className="font-bold tracking-widest text-sm text-center px-4">正在載入專屬空間...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-gray-800 font-sans pb-24 md:pb-0">
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={18}/> : <AlertCircle size={18}/>}
          <span className="font-bold text-xs md:text-sm">{toast.message}</span>
        </div>
      )}

      <nav className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 text-left">
        <div className="max-w-5xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setCurrentView('book')}>
            <div className="bg-green-600 p-1.5 rounded-xl text-white">
              <Leaf size={18} />
            </div>
            <h1 className="text-lg font-black text-gray-900 tracking-tighter">Mei植感芳療</h1>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <NavTab active={currentView === 'book'} onClick={() => setCurrentView('book')} icon={<CalendarDays size={18}/>} label="預約" />
            <NavTab active={currentView === 'member'} onClick={() => setCurrentView('member')} icon={<User size={18}/>} label="查詢中心" />
            <NavTab active={currentView === 'admin'} onClick={() => setCurrentView('admin')} icon={<Settings size={18}/>} label="後台" />
          </div>

          <button onClick={() => setCurrentView('admin')} className={`md:hidden p-2.5 rounded-2xl transition-all ${currentView === 'admin' ? 'bg-green-50 text-green-600' : 'text-gray-400'}`}>
            <Settings size={22} />
          </button>
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 flex justify-around items-center h-20 px-6 z-50 shadow-sm text-left">
        <MobileTab active={currentView === 'book'} onClick={() => setCurrentView('book')} icon={<CalendarDays size={24}/>} label="預約" />
        <MobileTab active={currentView === 'member'} onClick={() => setCurrentView('member')} icon={<Search size={24}/>} label="查詢" />
      </nav>

      <main className="max-w-5xl mx-auto p-4 md:py-12">
        {currentView === 'book' && <BookingFlow settings={settings} bookings={bookings} specialClosures={specialClosures} user={user} showToast={showToast} />}
        {currentView === 'member' && <MemberPortal members={members} bookings={bookings} />}
        {currentView === 'admin' && (
          <AdminPortal 
            members={members} settings={settings} bookings={bookings} specialClosures={specialClosures}
            isAdminAuthenticated={isAdminAuthenticated} setIsAdminAuthenticated={setIsAdminAuthenticated} user={user} showToast={showToast} 
          />
        )}
      </main>
    </div>
  );
}

function NavTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${active ? 'bg-green-50 text-green-700' : 'text-gray-400 hover:bg-gray-50'}`}>
      {icon} {label}
    </button>
  );
}

function MobileTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-green-600 scale-105' : 'text-gray-300'}`}>
      <div className={`p-2 rounded-2xl ${active ? 'bg-green-50' : ''}`}>{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

// ==========================================
// 預約流程元件
// ==========================================
function BookingFlow({ settings, bookings, specialClosures, user, showToast }) {
  const [step, setStep] = useState(0); 
  const [bookingData, setBookingData] = useState({ service: null, date: '', time: '', name: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 取得明日日期，作為不可預約今日的依據
  const tomorrowStr = getTWDateStr(1);

  const getAvailableSlots = (dateString, durationMins) => {
    // 嚴格阻擋：只要是今天以前的日期，直接回傳無時段可選
    if (!dateString || dateString < tomorrowStr) return [];
    
    const date = new Date(dateString);
    const day = date.getDay(); 
    const isWeekend = day === 0 || day === 6;
    const parseTime = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };
    const startMins = isWeekend ? parseTime(settings.weekendStart || "10:00") : parseTime(settings.weekdayStart || "17:30"); 
    const endMins = isWeekend ? parseTime(settings.weekendEnd || "17:00") : parseTime(settings.weekdayEnd || "20:00");
    const breakStartMins = (isWeekend ? settings.weekendBreakStart : settings.weekdayBreakStart) ? parseTime(isWeekend ? settings.weekendBreakStart : settings.weekdayBreakStart) : null;
    const breakEndMins = (isWeekend ? settings.weekendBreakEnd : settings.weekdayBreakEnd) ? parseTime(isWeekend ? settings.weekendBreakEnd : settings.weekdayBreakEnd) : null;
    const bookingsOnDate = bookings.filter(b => b.date === dateString);
    const closuresOnDate = specialClosures.filter(c => c.date === dateString);
    const slots = [];

    for (let t = startMins; (t + durationMins) <= endMins; t += 30) {
      const slotStart = t;
      const slotEnd = t + durationMins;
      let isOverlapping = false;
      if (breakStartMins !== null && breakEndMins !== null) {
        if (Math.max(slotStart, breakStartMins) < Math.min(slotEnd, breakEndMins)) isOverlapping = true;
      }
      if (!isOverlapping) {
        for (const c of closuresOnDate) {
          const cS = parseTime(c.start); const cE = parseTime(c.end);
          if (Math.max(slotStart, cS) < Math.min(slotEnd, cE)) { isOverlapping = true; break; }
        }
      }
      if (!isOverlapping) {
        for (const e of bookingsOnDate) {
          const eS = parseTime(e.time); const eE = eS + (e.duration || 60);
          if (Math.max(slotStart, eS) < Math.min(slotEnd, eE)) { isOverlapping = true; break; }
        }
      }
      if (!isOverlapping) {
        const h = Math.floor(t / 60).toString().padStart(2, '0');
        const m = (t % 60).toString().padStart(2, '0');
        slots.push(`${h}:${m}`);
      }
    }
    return slots;
  };

  const handleBookingSubmit = async () => {
    if (!user) {
      showToast('系統安全連線中，請稍候重試', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      if (settings.googleScriptUrl) {
        const fd = new FormData();
        fd.append('type', 'booking'); fd.append('name', bookingData.name); fd.append('phone', bookingData.phone);
        fd.append('service', bookingData.service.title); fd.append('date', bookingData.date); fd.append('time', bookingData.time);
        fetch(settings.googleScriptUrl, { method: 'POST', body: fd, mode: 'no-cors' }).catch(console.error);
      }
      
      const bookingsRef = collection(db, 'artifacts', appId, 'public', 'data', 'bookings');
      await addDoc(bookingsRef, {
        ...bookingData, 
        service: bookingData.service.title, 
        duration: bookingData.service.duration, 
        timestamp: new Date().toISOString()
      });
      showToast('預約成功，期待您的到來！');
      setStep(4); 
    } catch (e) { showToast(e, 'error'); } 
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-[2.5rem] shadow-xl border border-gray-50 overflow-hidden flex flex-col text-left">
      <div className="flex-1 p-6 md:p-12">
        {step === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black text-gray-900">預約須知</h2>
            </div>
            <div className="space-y-4 text-gray-600 bg-gray-50/50 p-6 md:p-8 rounded-[2rem] border border-gray-100/50 text-left text-sm md:text-base leading-relaxed">
              <p>為保留每位顧客專屬的療癒時光，本工作室採<strong className="text-green-700">預約制服務</strong>。</p>
              <p>請提前私訊確認可預約時段，並建議於療程前 <strong className="text-green-700">5–10 分鐘</strong> 抵達，讓身體與心慢慢安定下來。</p>
              <p>若需調整或取消預約，請於<strong className="text-green-700">預約前二日</strong>告知，逾期將無法退款。</p>
              <p>如當日臨時遲到或取消，療程將依原預約時間結束，款項亦無法退款。感謝您的體諒。</p>
            </div>
            <button onClick={() => setStep(1)} className="w-full bg-green-700 hover:bg-green-800 text-white font-black py-5 rounded-2xl active:scale-95 transition-all shadow-lg shadow-green-100 mt-8">開始預約</button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-black text-gray-900 text-center">選擇療程項目</h2>
            <div className="grid gap-3">
              {SERVICES.map(srv => (
                <button key={srv.id} onClick={() => { setBookingData({...bookingData, service: srv}); setStep(2); }} className="w-full text-left p-6 border-2 border-gray-50 bg-white hover:border-green-500 rounded-3xl transition-all flex items-center gap-4 group">
                  <div className="bg-green-50 p-3 rounded-2xl text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors"><Leaf size={22} /></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center"><span className="font-black text-gray-800">{srv.title}</span><span className="text-green-600 font-bold">${srv.price}</span></div>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-widest">{srv.duration}分鐘 療程</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(0)} className="w-full text-gray-300 text-xs font-bold uppercase tracking-widest hover:text-gray-500 mt-4">返回</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <h2 className="text-xl font-black text-gray-900 text-center">日期與時間</h2>
            <div className="space-y-4">
              <div className="bg-green-50/50 p-4 rounded-2xl flex items-center justify-between border border-green-100/50">
                <span className="text-green-800 font-black text-sm">{bookingData.service?.title}</span>
                <button onClick={() => setStep(1)} className="text-[10px] bg-white px-3 py-1.5 rounded-full text-green-600 font-black shadow-sm">更換項目</button>
              </div>
              <div className="space-y-1 text-left">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">1. 請先點選日期</div>
                <input 
                  type="date" 
                  min={tomorrowStr} 
                  value={bookingData.date} 
                  onChange={(e) => {
                    const val = e.target.value;
                    // 雙重保險：如果客人透過手機特殊輸入法選了今天或過去的日期，給予提示並擋下
                    if (val && val < tomorrowStr) {
                      showToast('為提供最佳服務，僅開放預約明日起之時段喔！', 'error');
                      setBookingData({...bookingData, date: '', time: ''});
                    } else {
                      setBookingData({...bookingData, date: val, time: ''});
                    }
                  }} 
                  className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-black" 
                />
              </div>
            </div>
            {bookingData.date && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 text-left">
                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">2. 請選擇時段</div>
                <div className="grid grid-cols-3 gap-2">
                  {getAvailableSlots(bookingData.date, bookingData.service?.duration).map(slot => (
                    <button key={slot} onClick={() => setBookingData({...bookingData, time: slot})} className={`py-4 rounded-xl border-2 text-xs font-black transition-all ${bookingData.time === slot ? 'bg-green-700 text-white border-green-700 shadow-md scale-95' : 'bg-white text-gray-400 border-gray-50'}`}>{slot}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="flex-1 bg-gray-50 py-4 rounded-2xl font-bold text-gray-400">上一步</button>
              <button disabled={!bookingData.date || !bookingData.time} onClick={() => setStep(3)} className="flex-[2] bg-green-700 disabled:bg-gray-100 text-white font-black py-4 rounded-2xl shadow-xl">下一步</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in text-left">
            <h2 className="text-xl font-black text-gray-900 text-center">確認資料</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">您的姓名</label>
                <input type="text" placeholder="例：林植感" value={bookingData.name} onChange={(e) => setBookingData({...bookingData, name: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-black" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">聯絡電話</label>
                <input type="tel" placeholder="0912..." value={bookingData.phone} onChange={(e) => setBookingData({...bookingData, phone: e.target.value})} className="w-full px-5 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-black" />
              </div>
            </div>
            <div className="bg-gray-900 p-6 rounded-3xl text-white space-y-1 shadow-2xl font-bold">
              <div className="text-xs font-bold text-white/30 uppercase tracking-widest">預約摘要</div>
              <div className="text-lg">{bookingData.service?.title}</div>
              <div className="flex justify-between text-sm pt-2 border-t border-white/10 mt-2">
                <span className="opacity-60">{bookingData.date}</span>
                <span className="text-green-400">{bookingData.time}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 bg-gray-50 py-4 rounded-2xl font-bold text-gray-400">上一步</button>
              <button disabled={!bookingData.name || !bookingData.phone || isSubmitting} onClick={handleBookingSubmit} className="flex-[2] bg-green-700 text-white font-black py-4 rounded-2xl shadow-xl flex justify-center items-center gap-2">
                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : '確認預約'}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8 text-center animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto text-white shadow-2xl"><CheckCircle size={48} strokeWidth={3}/></div>
            <h2 className="text-3xl font-black text-gray-900">預約成功</h2>
            <BankInfoBox />
            <a href={`https://line.me/R/oaMessage/@222lfbsc/?${encodeURIComponent(`小玫老師好！我已預約：\n姓名：${bookingData.name}\n項目：${bookingData.service?.title}\n時間：${bookingData.date} ${bookingData.time}\n(我已匯款，後五碼為：____)`)}`} target="_blank" rel="noreferrer" className="w-full bg-[#06C755] text-white font-black py-5 rounded-2xl shadow-xl flex justify-center items-center gap-3">
              通知小玫老師
            </a>
            <button onClick={() => { setStep(0); setBookingData({ service: null, date: '', time: '', name: '', phone: '' }); }} className="text-gray-300 font-bold underline text-sm">返回預約首頁</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberPortal({ members, bookings }) {
  const [phone, setPhone] = useState('');
  const [data, setData] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [error, setError] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const resultRef = useRef(null);

  const handleSearch = () => {
    setIsSearching(true);
    setError('');
    setTimeout(() => {
      const foundMember = members[phone];
      const foundBookings = bookings.filter(b => b.phone === phone && new Date(`${b.date}T${b.time}:00`) >= new Date()).sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
      
      if (foundMember || foundBookings.length > 0) { 
        setData(foundMember || { name: '預約客戶', balance: 0, sessions: 0 }); 
        setUserBookings(foundBookings);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      } else { 
        setData(null); 
        setError('查無此號碼的預約或會員紀錄。'); 
      }
      setIsSearching(false);
    }, 600);
  };

  return (
    <div className="max-w-md mx-auto space-y-10 animate-in fade-in py-6 px-2 text-left pb-32">
      <div className="text-center space-y-1">
        <h2 className="text-3xl font-black text-gray-900 italic tracking-tighter underline decoration-green-400 decoration-4">查詢中心</h2>
        <p className="text-[10px] font-bold text-green-600 uppercase tracking-[0.3em]">我的預約與點數</p>
      </div>
      
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col gap-4">
        <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest px-2">手機號碼 Mobile Phone</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0"> 
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
            <input type="tel" placeholder="0912..." value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-black text-lg transition-all" />
          </div>
          <button onClick={handleSearch} disabled={isSearching} className="bg-gray-900 text-white px-8 py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
            {isSearching ? <Loader2 className="animate-spin" size={18} /> : '查詢我的資料'}
          </button>
        </div>
        {error && <div className="text-red-500 text-xs font-bold text-center bg-red-50 py-3 px-4 rounded-xl border border-red-100">{error}</div>}
      </div>

      {data && (
        <div ref={resultRef} className="animate-in fade-in slide-in-from-bottom-8 space-y-6">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-green-700 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
              <Wallet size={20} className="mb-4 opacity-40 mx-auto" />
              <p className="text-[9px] font-black opacity-50 uppercase mb-1 tracking-widest">儲值餘額</p>
              <p className="text-3xl font-black tracking-tighter">${Number(data.balance || 0).toLocaleString()}</p>
            </div>
            <div className="bg-orange-500 p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden group">
              <Ticket size={20} className="mb-4 opacity-40 mx-auto" />
              <p className="text-[9px] font-black opacity-50 uppercase mb-1 tracking-widest">包堂剩餘</p>
              <p className="text-3xl font-black tracking-tighter">{Number(data.sessions || 0)}<small className="text-xs ml-1 opacity-50 font-medium">堂</small></p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-black text-gray-900 flex items-center gap-2 border-b border-gray-50 pb-3 text-left"><Calendar size={20} className="text-green-600"/> 您即將進行的預約</h3>
            {userBookings.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400 font-bold italic">目前沒有未來的預約紀錄</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userBookings.map(b => (
                  <div key={b.id} className="bg-gray-50 p-4 rounded-3xl border border-gray-100 flex justify-between items-center group transition-all">
                    <div className="text-left">
                      <div className="text-[10px] font-black text-green-600 uppercase mb-1">{typeof b.service === 'object' ? b.service.title : String(b.service || '')}</div>
                      <div className="font-black text-gray-900 tracking-tight">{String(b.date || '')} <span className="text-orange-500 ml-1">{String(b.time || '')}</span></div>
                    </div>
                    <div className="bg-white p-2 rounded-xl text-green-600"><ChevronRight size={16}/></div>
                  </div>
                ))}
              </div>
            )}
            
            <button onClick={() => setShowBank(!showBank)} className="w-full flex items-center justify-between p-4 bg-green-50 rounded-2xl text-green-700 font-black text-sm active:scale-95 transition-all">
              <span className="flex items-center gap-2"><CreditCard size={18}/> 展開/收合 匯款帳號</span>
              {showBank ? <Minus size={16}/> : <Plus size={16}/>}
            </button>
            {showBank && <BankInfoBox />}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPortal({ members, settings, bookings, specialClosures, isAdminAuthenticated, setIsAdminAuthenticated, user, showToast }) {
  const [adminTab, setAdminTab] = useState('bookings'); 
  const [newM, setNewM] = useState({ phone: '', name: '', balance: 0, sessions: 0 });
  const [localS, setLocalS] = useState(settings);
  const [pwd, setPwd] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [isS, setIsS] = useState(false);
  const [delC, setDelC] = useState(null); 
  const [newC, setNewC] = useState({ date: '', start: '', end: '' });
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [reportDate, setReportDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(getTWDateStr(0));
  const [editingBooking, setEditingBooking] = useState(null);

  useEffect(() => { setLocalS(settings); }, [settings]);

  if (!isAdminAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-10 bg-white p-10 rounded-[3rem] shadow-sm border border-gray-100 text-center animate-in fade-in zoom-in space-y-6">
        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300"><Lock size={36}/></div>
        <h2 className="text-2xl font-black italic">管理後台驗證</h2>
        <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (pwd === '8011' ? setIsAdminAuthenticated(true) : setAuthErr('密碼錯誤'))} className="w-full px-4 py-5 bg-gray-50 border-none rounded-2xl outline-none text-center text-4xl tracking-[0.5em] font-black focus:ring-2 focus:ring-green-500" placeholder="****" />
        <button onClick={() => (pwd === '8011' ? setIsAdminAuthenticated(true) : setAuthErr('密碼錯誤'))} className="w-full bg-gray-900 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all">登入系統</button>
        {authErr && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{authErr}</p>}
      </div>
    );
  }

  const generateCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cal = [];
    for (let i = 0; i < firstDay; i++) cal.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      cal.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return cal;
  };

  const handleUpdate = async (phone, f, amt) => {
    const m = members[phone];
    const nV = Math.max(0, Number(m[f] || 0) + amt); 
    try {
      const memberRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', phone);
      await setDoc(memberRef, { ...m, [f]: nV }, { merge: true });

      // 同步儲值金與包堂數的異動至 Google Script
      if (settings.googleScriptUrl) {
        const fd = new FormData();
        fd.append('type', 'member_update');
        fd.append('name', m.name);
        fd.append('phone', phone);
        fd.append('field', f === 'balance' ? '儲值金' : '包堂數');
        fd.append('change', amt);
        fd.append('balance', f === 'balance' ? nV : (m.balance || 0));
        fd.append('sessions', f === 'sessions' ? nV : (m.sessions || 0));
        fetch(settings.googleScriptUrl, { method: 'POST', body: fd, mode: 'no-cors' }).catch(console.error);
      }

      showToast('會員資料已更新');
    } catch (e) { showToast(e, 'error'); }
  };

  const handleDeleteItem = async (type, id) => {
    const colName = type === 'member' ? 'members' : type === 'booking' ? 'bookings' : 'special_closures';
    try {
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', colName, id);
      await deleteDoc(itemRef);
      showToast('資料已成功移除');
    } catch (e) { showToast(e, 'error'); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingBooking) return;
    try {
      const { id, ...updatedData } = editingBooking;
      const srv = SERVICES.find(s => s.title === updatedData.service);
      if (srv) updatedData.duration = srv.duration;
      const bookingRef = doc(db, 'artifacts', appId, 'public', 'data', 'bookings', id);
      await updateDoc(bookingRef, updatedData);
      showToast('預約資訊已修正');
      setEditingBooking(null);
    } catch (e) { showToast(e, 'error'); }
  };

  const reportYear = reportDate.getFullYear();
  const reportMonth = reportDate.getMonth();
  const filteredBookings = bookings.filter(b => b.date && new Date(b.date).getFullYear() === reportYear && new Date(b.date).getMonth() === reportMonth);
  const totalRev = filteredBookings.reduce((sum, b) => sum + (SERVICES.find(s => s.title === b.service)?.price || 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in pb-32 text-left">
      {/* 移除確認彈窗 */}
      {delC && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[1000] flex items-center justify-center p-6 text-center">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-sm w-full space-y-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto"><Trash2 size={32}/></div>
            <h3 className="text-xl font-black text-gray-900 tracking-tighter">確認要刪除這筆資料嗎？</h3>
            <div className="flex gap-2">
              <button onClick={() => setDelC(null)} className="flex-1 py-4 bg-gray-50 rounded-2xl font-bold text-gray-400 text-xs uppercase">取消</button>
              <button onClick={() => { handleDeleteItem(delC.type, delC.id); setDelC(null); }} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg uppercase">確認執行</button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯預約彈窗 */}
      {editingBooking && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[1000] flex items-center justify-center p-6">
          <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-2xl max-w-md w-full animate-in zoom-in duration-300">
            <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
              <h3 className="text-xl font-black text-gray-900 flex items-center gap-2"><Edit2 size={20} className="text-green-600"/> 編輯預約詳情</h3>
              <button onClick={() => setEditingBooking(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:bg-gray-100 transition-all"><X size={20}/></button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">姓名 Name</label>
                <input type="text" value={editingBooking.name} onChange={e => setEditingBooking({...editingBooking, name: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">電話 Phone</label>
                <input type="tel" value={editingBooking.phone} onChange={e => setEditingBooking({...editingBooking, phone: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">日期 Date</label>
                  <input type="date" value={editingBooking.date} onChange={e => setEditingBooking({...editingBooking, date: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">時間 Time</label>
                  <input type="time" value={editingBooking.time} onChange={e => setEditingBooking({...editingBooking, time: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">服務項目 Service</label>
                <select value={editingBooking.service} onChange={e => setEditingBooking({...editingBooking, service: e.target.value})} className="w-full px-5 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold text-sm">
                  {SERVICES.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-green-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-green-100 flex justify-center items-center gap-2 mt-4 active:scale-95 transition-all">
                <Save size={18}/> 儲存預約變更
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center px-2 text-left">
        <h2 className="text-2xl font-black text-gray-900 italic tracking-tighter underline decoration-green-400 decoration-4">Admin Console</h2>
        <button onClick={() => setIsAdminAuthenticated(false)} className="text-[10px] font-black text-red-400 bg-red-50 px-4 py-2 rounded-xl border border-red-100">登出系統</button>
      </div>

      <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto no-scrollbar font-black">
        <AdminTab active={adminTab === 'bookings'} onClick={() => setAdminTab('bookings')} icon={<Calendar size={16}/>} label="預約月曆" />
        <AdminTab active={adminTab === 'members'} onClick={() => setAdminTab('members')} icon={<User size={16}/>} label="會員管理" />
        <AdminTab active={adminTab === 'settings'} onClick={() => setAdminTab('settings')} icon={<Settings size={16}/>} label="營運設定" />
        <AdminTab active={adminTab === 'report'} onClick={() => setAdminTab('report')} icon={<BarChart3 size={16}/>} label="結算報表" />
      </div>

      {adminTab === 'bookings' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-2 bg-gray-50 rounded-xl transition-all hover:bg-gray-100"><ChevronLeft size={20}/></button>
              <h3 className="font-black text-lg">{calendarDate.getFullYear()}年 {calendarDate.getMonth() + 1}月</h3>
              <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-2 bg-gray-50 rounded-xl transition-all hover:bg-gray-100"><ChevronRight size={20}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center font-black">
              {['日','一','二','三','四','五','六'].map(d => <div key={d} className="text-[10px] text-gray-300 py-2">{d}</div>)}
              {generateCalendar().map((date, idx) => {
                const dayBookings = bookings.filter(b => b.date === date);
                const isSelected = selectedDate === date;
                const isToday = date === getTWDateStr(0);
                return (
                  <div key={idx} onClick={() => date && setSelectedDate(date)} className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all border-2 ${!date ? 'opacity-0' : ''} ${isSelected ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'bg-gray-50/50 border-transparent hover:border-gray-100'} ${isToday && !isSelected ? 'text-green-600 border-green-100' : ''}`}>
                    <span className="text-xs font-black">{date ? date.split('-')[2] : ''}</span>
                    {dayBookings.length > 0 && <div className={`mt-0.5 px-1 rounded-full text-[8px] ${isSelected ? 'bg-white text-green-700' : 'bg-green-600 text-white'}`}>{dayBookings.length}</div>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4 text-left">
            <h4 className="font-black text-gray-900 border-b border-gray-50 pb-4 flex items-center gap-2"><Clock size={18} className="text-green-600"/> {selectedDate} 預約明細</h4>
            <div className="space-y-3">
              {bookings.filter(b => b.date === selectedDate).length === 0 ? <p className="text-center text-gray-300 py-10 font-bold italic">該日尚無預約紀錄</p> : 
                bookings.filter(b => b.date === selectedDate).sort((a,b) => String(a.time || '').localeCompare(String(b.time || ''))).map(b => (
                <div key={b.id} className="p-4 bg-gray-50 rounded-3xl border border-gray-100 flex justify-between items-center group transition-all">
                  <div className="flex gap-4 items-center">
                    <div className="text-lg font-black text-green-600 w-14 text-left">{String(b.time || '')}</div>
                    <div className="text-left">
                      <div className="font-black text-gray-900 text-sm">{typeof b.name === 'object' ? JSON.stringify(b.name) : String(b.name || '')} <span className="text-[10px] opacity-30 font-mono ml-1">{String(b.phone || '')}</span></div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white px-2 py-0.5 rounded border border-gray-100 mt-1 inline-block">{typeof b.service === 'object' ? b.service.title : String(b.service || '')}</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditingBooking(b)} className="p-3 text-gray-300 hover:text-green-600 transition-colors"><Edit2 size={18}/></button>
                    <button onClick={() => setDelC({type:'booking', id: b.id})} className="p-3 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {adminTab === 'members' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {Object.values(members).map(m => (
              <div key={m.phone} className="p-6 bg-white border border-gray-100 rounded-[2.5rem] shadow-sm space-y-5">
                <div className="flex justify-between items-start text-left">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-11 h-11 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 font-black text-lg border border-green-100">{m.name ? String(m.name)[0] : '?'}</div>
                    <div className="text-left">
                      <div className="font-black text-gray-900">{typeof m.name === 'object' ? JSON.stringify(m.name) : String(m.name || '')}</div>
                      <div className="text-[10px] font-mono text-gray-300 font-bold">{String(m.phone || '')}</div>
                    </div>
                  </div>
                  <button onClick={() => setDelC({type:'member', id: m.phone})} className="p-2 text-gray-200 hover:text-red-300 transition-colors text-right"><Trash2 size={18}/></button>
                </div>
                <div className="grid grid-cols-2 gap-4 font-black">
                  <div className="space-y-3 bg-gray-50/50 p-4 rounded-3xl border border-gray-100/50 text-center">
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">儲值金</div>
                    <div className="text-xl text-green-700">${Number(m.balance || 0).toLocaleString()}</div>
                    <div className="grid grid-cols-2 gap-1">
                      <button onClick={() => handleUpdate(m.phone,'balance',-100)} className="py-2 bg-white border border-red-50 text-red-400 rounded-xl font-black text-[10px] active:scale-90">-100</button>
                      <button onClick={() => handleUpdate(m.phone,'balance',100)} className="py-2 bg-white border border-green-50 text-green-600 rounded-xl font-black text-[10px] active:scale-90">+100</button>
                    </div>
                  </div>
                  <div className="space-y-3 bg-gray-50/50 p-4 rounded-3xl border border-gray-100/50 text-center">
                    <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest">包堂數</div>
                    <div className="text-xl text-orange-600">{Number(m.sessions || 0)}堂</div>
                    <div className="grid grid-cols-2 gap-1">
                      <button onClick={() => handleUpdate(m.phone,'sessions',-1)} className="py-2 bg-white border border-gray-100 rounded-xl flex justify-center items-center text-gray-400 active:scale-90"><Minus size={14}/></button>
                      <button onClick={() => handleUpdate(m.phone,'sessions',1)} className="py-2 bg-white border border-green-50 rounded-xl flex justify-center items-center text-green-600 active:scale-90"><Plus size={14}/></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-green-50/50 p-8 rounded-[2.5rem] border border-green-100/50 space-y-6 text-left">
            <h4 className="font-black text-green-900 flex items-center gap-2"><Plus size={20}/> 建立新會員</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left">
              <AdminInput label="姓名" value={newM.name} onChange={v => setNewM({...newM, name: v})} placeholder="姓名" />
              <AdminInput label="手機" value={newM.phone} onChange={v => setNewM({...newM, phone: v})} placeholder="09..." />
              <AdminInput label="初始儲值" type="number" value={newM.balance} onChange={v => setNewM({...newM, balance: v})} />
              <AdminInput label="初始堂數" type="number" value={newM.sessions} onChange={v => setNewM({...newM, sessions: v})} />
            </div>
            <button onClick={async () => {
                if(!newM.name || !newM.phone) return showToast('請填寫完整姓名與手機','error');
                const memberRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', newM.phone);
                await setDoc(memberRef, {...newM, balance: Number(newM.balance), sessions: Number(newM.sessions)});
                
                // 同步新建立的會員資料至 Google Script
                if (settings.googleScriptUrl) {
                  const fd = new FormData();
                  fd.append('type', 'new_member');
                  fd.append('name', newM.name);
                  fd.append('phone', newM.phone);
                  fd.append('balance', newM.balance);
                  fd.append('sessions', newM.sessions);
                  fetch(settings.googleScriptUrl, { method: 'POST', body: fd, mode: 'no-cors' }).catch(console.error);
                }
                
                setNewM({phone:'', name:'', balance:0, sessions:0}); showToast('建立成功');
              }} className="w-full bg-green-700 text-white font-black py-4 rounded-2xl active:scale-95 shadow-lg shadow-green-100 text-center">確認建立會員</button>
          </div>
        </div>
      )}

      {adminTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in text-left">
          <div className="bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl text-white space-y-6 relative overflow-hidden border border-white/5 text-left">
            <h3 className="font-black text-xl flex items-center gap-2"><LinkIcon size={20} className="text-green-400"/> Google 同步設定</h3>
            <div className="flex flex-col sm:flex-row gap-2 text-left">
              <input type="text" value={localS.googleScriptUrl || ''} onChange={e => setLocalS({...localS, googleScriptUrl: e.target.value})} placeholder="https://script.google.com/..." className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none font-mono text-[10px] text-green-400" />
              <button onClick={async () => { setIsS(true); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), localS); showToast('設定已儲存'); setIsS(false); }} disabled={isS} className="bg-green-500 text-white font-black py-4 px-8 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 text-center">{isS ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <span>儲存</span></button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left font-black">
            <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8 text-left">
              <h3 className="font-black text-gray-900 flex items-center gap-3 text-lg"><Clock size={22} className="text-green-600"/> 營業時段設定</h3>
              <div className="space-y-8 text-left">
                <TimeGroup label="平日時段 (週一至週五)" start={localS.weekdayStart} end={localS.weekdayEnd} onStart={v => setLocalS({...localS, weekdayStart:v})} onEnd={v => setLocalS({...localS, weekdayEnd:v})} breakStart={localS.weekdayBreakStart} breakEnd={localS.weekdayBreakEnd} onBreakStart={v => setLocalS({...localS, weekdayBreakStart:v})} onBreakEnd={v => setLocalS({...localS, weekdayBreakEnd:v})} onClear={() => setLocalS({...localS, weekdayBreakStart:'', weekdayBreakEnd:''})} />
                <TimeGroup label="假日時段 (週六、週日)" start={localS.weekendStart} end={localS.weekendEnd} onStart={v => setLocalS({...localS, weekendStart:v})} onEnd={v => setLocalS({...localS, weekendEnd:v})} breakStart={localS.weekendBreakStart} breakEnd={localS.weekendBreakEnd} onBreakStart={v => setLocalS({...localS, weekendBreakStart:v})} onBreakEnd={v => setLocalS({...localS, weekendBreakEnd:v})} onClear={() => setLocalS({...localS, weekendBreakStart:'', weekendBreakEnd:''})} />
              </div>
              <button onClick={async () => { setIsS(true); await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), localS); showToast('設定已更新'); setIsS(false); }} disabled={isS} className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl active:scale-95 text-center">儲存營運設定</button>
            </div>
            <div className="bg-orange-50/50 p-8 rounded-[2.5rem] border border-orange-100 shadow-sm space-y-6 text-left">
              <h3 className="font-black text-orange-900 flex items-center gap-3 text-lg justify-center"><CalendarX size={22}/> 特定日期關閉</h3>
              <div className="space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <AdminInput label="日期" type="date" value={newC.date} onChange={v => setNewC({...newC, date: v})} light />
                  <AdminInput label="開始" type="time" value={newC.start} onChange={v => setNewC({...newC, start: v})} light />
                  <AdminInput label="結束" type="time" value={newC.end} onChange={v => setNewC({...newC, end: v})} light />
                </div>
                <button onClick={async () => {
                  if(!newC.date || !newC.start || !newC.end) return showToast('請填寫完整','error');
                  await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'special_closures'), newC);
                  setNewC({date:'', start:'', end:''}); showToast('時段已暫停');
                }} className="w-full bg-orange-600 text-white font-black py-4 rounded-2xl active:scale-95 shadow-md text-center">新增暫停時段</button>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {specialClosures.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-orange-100 font-bold text-xs text-left">
                    <span>{c.date} <span className="opacity-20 mx-1">|</span> {c.start}-{c.end}</span>
                    <button onClick={() => handleDeleteItem('closure', c.id)} className="text-orange-200 hover:text-red-500 transition-colors px-2 text-right"><Trash2 size={16}/></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {adminTab === 'report' && (
        <div className="space-y-6 animate-in fade-in text-left">
          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex items-center justify-between text-left">
            <button onClick={() => setReportDate(new Date(reportYear, reportMonth - 1, 1))} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all text-gray-400"><ChevronLeft size={24}/></button>
            <div className="text-center font-black"><h3 className="text-2xl text-gray-900">{reportYear}年 {reportMonth + 1}月</h3><p className="text-[10px] text-green-600 uppercase tracking-widest mt-1 italic">Monthly Performance</p></div>
            <button onClick={() => setReportDate(new Date(reportYear, reportMonth + 1, 1))} className="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:bg-gray-100 transition-all"><ChevronRight size={24}/></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-black">
            <div className="bg-green-700 p-6 md:p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
              <div className="absolute top-1/2 -translate-y-1/2 right-0 pr-6 opacity-10"><Calendar size={80} className="md:w-[100px] md:h-[100px]"/></div>
              <p className="text-xs opacity-60 mb-1 relative z-10">當月預約總量</p>
              <p className="text-4xl md:text-5xl relative z-10">{filteredBookings.length}<span className="text-sm md:text-lg ml-2 opacity-60">堂</span></p>
            </div>
            <div className="bg-gray-900 p-6 md:p-8 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
              <div className="absolute top-1/2 -translate-y-1/2 right-0 pr-6 opacity-10"><Wallet size={80} className="md:w-[100px] md:h-[100px]"/></div>
              <p className="text-xs opacity-60 mb-1 relative z-10">預計月營收</p>
              <p className="text-4xl md:text-5xl relative z-10"><span className="text-xl md:text-2xl mr-1 opacity-60">$</span>{totalRev.toLocaleString()}</p>
            </div>
          </div>
          
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
             <h4 className="font-black text-gray-900 border-b border-gray-50 pb-4 text-left">本月明細單</h4>
             {filteredBookings.length === 0 ? <p className="py-10 text-center text-gray-300 font-bold italic">當月暫無預約紀錄</p> : (
               <div className="space-y-3">
                 {filteredBookings.sort((a,b) => String(a.date || '').localeCompare(String(b.date || ''))).map(b => (
                   <div key={b.id} className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex justify-between items-center text-sm font-bold">
                     <div className="text-left">
                       <span className="text-green-600 mr-2">{String(b.date || '').split('-')[2]}日</span>
                       <span className="text-gray-900">{typeof b.name === 'object' ? JSON.stringify(b.name) : String(b.name || '')}</span>
                     </div>
                     <span className="text-gray-400 text-right">{typeof b.service === 'object' ? b.service.title : String(b.service || '')}</span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminInput({ label, value, onChange, placeholder, type = 'text', light = false }) {
  return (
    <div className="space-y-1 flex-1 min-w-0 text-left">
      <div className={`text-[9px] font-black uppercase tracking-widest px-2 ${light ? 'text-orange-600/50' : 'text-gray-300'}`}>{String(label)}</div>
      <input type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className={`w-full px-4 py-4 rounded-2xl outline-none focus:ring-2 font-black transition-all ${light ? 'bg-white focus:ring-orange-400' : 'bg-white focus:ring-green-500 shadow-sm border border-gray-50'}`} />
    </div>
  );
}

function AdminTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 rounded-xl transition-all whitespace-nowrap text-center ${active ? 'bg-green-600 text-white shadow-lg scale-[1.02] font-black' : 'text-gray-400 font-bold hover:bg-gray-50'}`}>
      {icon} <span className="text-xs md:text-sm">{String(label)}</span>
    </button>
  );
}

function TimeGroup({ label, start, end, onStart, onEnd, breakStart, breakEnd, onBreakStart, onBreakEnd, onClear }) {
  return (
    <div className="space-y-4 text-left">
      <div className="text-[10px] font-black text-gray-400 border-l-4 border-green-500 pl-2 uppercase tracking-widest">{String(label)}</div>
      <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100">
        <input type="time" value={start} onChange={e => onStart(e.target.value)} className="flex-1 bg-white p-3 rounded-xl font-black text-sm outline-none" />
        <span className="opacity-20 font-black">➜</span>
        <input type="time" value={end} onChange={e => onEnd(e.target.value)} className="flex-1 bg-white p-3 rounded-xl font-black text-sm outline-none" />
      </div>
      <div className="bg-red-50/50 p-5 rounded-[2rem] border border-red-50 space-y-3 text-left">
        <div className="flex justify-between items-center"><div className="text-[9px] font-black text-red-400 uppercase tracking-widest italic font-bold">固定休息</div> <button onClick={onClear} className="text-[8px] font-black text-red-300 border border-red-100 bg-white px-3 py-1 rounded-full uppercase font-bold text-center transition-all">清除</button></div>
        <div className="flex items-center gap-2">
          <input type="time" value={breakStart || ''} onChange={e => onBreakStart(e.target.value)} className="flex-1 bg-white p-3 rounded-xl text-xs font-black outline-none" />
          <span className="opacity-10">➜</span>
          <input type="time" value={breakEnd || ''} onChange={e => onBreakEnd(e.target.value)} className="flex-1 bg-white p-3 rounded-xl text-xs font-black outline-none" />
        </div>
      </div>
    </div>
  );
}
