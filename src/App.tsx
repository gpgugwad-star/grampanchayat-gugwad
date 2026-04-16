import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc, addDoc, collection, query, where, orderBy, onSnapshot, updateDoc, getDocFromServer, limit, deleteDoc } from 'firebase/firestore';
import React, { Component, useEffect, useState, createContext, useContext, ErrorInfo, ReactNode } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  FileText, 
  MessageSquare, 
  Bell, 
  CreditCard, 
  Folder, 
  LogOut, 
  LogIn,
  ShieldCheck,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { cn } from './lib/utils';
import { handleFirestoreError, OperationType } from './firebase';


// --- Context ---
interface UserContextType {
  user: any;
  profile: any;
  loading: boolean;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType>({ user: null, profile: null, loading: true, isAdmin: false });

export const useUser = () => useContext(UserContext);

// --- Components ---

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full"
      />
    </div>
  );
}

function Navbar() {
  const { user, profile, isAdmin } = useUser();

  return (
    <nav className="bg-primary text-white shadow-md sticky top-0 z-40 h-[70px] flex items-center">
      <div className="max-w-7xl mx-auto w-full px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center text-primary font-bold text-xl">
            GP
          </div>
          <h1 className="font-semibold text-xl tracking-tight">ग्राम पंचायत - गुगवाड</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-sm opacity-90 hidden sm:block">
            माझे खाते | मराठी
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium leading-none">{profile?.name || user.displayName}</p>
                <p className="text-xs text-primary-light opacity-80">{isAdmin ? 'प्रशासक' : 'नागरिक'}</p>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="p-2 hover:bg-accent rounded-full transition-colors"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
              className="flex items-center gap-2 bg-white text-primary px-4 py-2 rounded-lg font-semibold hover:bg-primary-light transition-colors"
            >
              <LogIn className="w-4 h-4" />
              लॉगिन करा
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={window.location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="bg-white border-t border-border-theme py-6 text-center text-text-muted text-sm">
        <p>© {new Date().getFullYear()} ग्राम पंचायत डिजिटल पोर्टल. सर्व हक्क राखीव.</p>
      </footer>
    </div>
  );
}

// --- Pages ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.";
      try {
        const parsedError = JSON.parse(this.state.error?.message || "");
        if (parsedError.error) {
          errorMessage = `त्रुटी: ${parsedError.error}`;
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
            <div className="bg-red-100 text-red-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">क्षमस्व!</h2>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-600 text-white px-8 py-2 rounded-full font-bold hover:bg-emerald-700 transition-all"
            >
              पुन्हा प्रयत्न करा
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

// --- Pages ---

function Home() {
  const { user, isAdmin } = useUser();
  const [notices, setNotices] = useState<any[]>([]);
  const [complaintCount, setComplaintCount] = useState(0);
  const [quickType, setQuickType] = useState('पाणी पुरवठा');
  const [quickDesc, setQuickDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notices'), orderBy('date', 'desc'), limit(4));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'notices'));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'complaints'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComplaintCount(snapshot.size);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'complaints'));
    return () => unsubscribe();
  }, [user]);

  const handleQuickSubmit = async () => {
    if (!quickDesc.trim() || !user) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        userId: user.uid,
        userName: user.displayName,
        type: quickType,
        description: quickDesc,
        status: 'प्रलंबित',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString()
      });
      setQuickDesc('');
      alert('तक्रार यशस्वीरित्या नोंदवली गेली!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'complaints');
    } finally {
      setSubmitting(false);
    }
  };

  const menuItems = [
    { title: "अर्ज करा", icon: FileText, path: "/apply" },
    { title: "कर भरा", icon: CreditCard, path: "/pay-tax" },
    { title: "माझे अर्ज", icon: Folder, path: "/my-complaints" },
    { title: "तक्रार नोंदवा", icon: MessageSquare, path: "/complaint" },
    { title: "सूचना", icon: Bell, path: "/notices" },
    ...(isAdmin ? [{ title: "प्रशासन", icon: ShieldCheck, path: "/admin" }] : []),
  ];

  if (!user) {
    return (
      <div className="text-center py-20">
        <h2 className="text-3xl font-bold text-primary mb-4">ग्राम पंचायत डिजिटल पोर्टलवर आपले स्वागत आहे</h2>
        <p className="text-text-muted mb-8">कृपया सेवा वापरण्यासाठी लॉगिन करा.</p>
        <button 
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="bg-primary text-white px-8 py-3 rounded-lg font-bold hover:bg-accent transition-all shadow-lg"
        >
          लॉगिन करा
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div className="flex flex-col gap-8">
        <section>
          <p className="text-[14px] uppercase tracking-wider text-text-muted font-bold mb-4">मुख्य सेवा</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <motion.a
                key={item.title}
                href={item.path}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="bg-white p-6 rounded-2xl border border-border-theme flex flex-col items-center gap-3 transition-all hover:border-primary hover:bg-primary-light/30 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center">
                  <item.icon className="w-6 h-6" />
                </div>
                <span className="font-semibold text-text-dark">{item.title}</span>
              </motion.a>
            ))}
          </div>
        </section>

        <section className="bg-white p-8 rounded-2xl border border-border-theme flex-1">
          <p className="text-[14px] uppercase tracking-wider text-text-muted font-bold mb-6">त्वरीत तक्रार नोंदवा</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">तक्रार प्रकार</label>
              <select 
                value={quickType}
                onChange={(e) => setQuickType(e.target.value)}
                className="w-full p-3 border border-border-theme rounded-lg bg-bg focus:ring-2 focus:ring-primary outline-none"
              >
                <option>पाणी पुरवठा</option>
                <option>रस्ते आणि गटारे</option>
                <option>आरोग्य विभाग</option>
                <option>दिवाबत्ती</option>
                <option>इतर</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">तक्रार तपशील</label>
              <textarea 
                value={quickDesc}
                onChange={(e) => setQuickDesc(e.target.value)}
                placeholder="येथे तुमची तक्रार लिहा..." 
                className="w-full p-3 border border-border-theme rounded-lg bg-bg h-24 resize-none focus:ring-2 focus:ring-primary outline-none"
              ></textarea>
            </div>
            <button 
              onClick={handleQuickSubmit}
              disabled={submitting}
              className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors disabled:opacity-50"
            >
              {submitting ? 'सबमिट होत आहे...' : 'तक्रार सबमिट करा'}
            </button>
          </div>
        </section>
      </div>

      <aside className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary-light p-4 rounded-xl text-center">
            <div className="text-2xl font-extrabold text-primary">{complaintCount}</div>
            <div className="text-[10px] uppercase font-bold text-text-dark/70">माझ्या तक्रारी</div>
          </div>
          <div className="bg-primary-light p-4 rounded-xl text-center">
            <div className="text-2xl font-extrabold text-primary">०२</div>
            <div className="text-[10px] uppercase font-bold text-text-dark/70">आजच्या सभा</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border-theme flex-1">
          <p className="text-[14px] uppercase tracking-wider text-text-muted font-bold mb-4">ताज्या सूचना</p>
          <div className="space-y-4">
            {notices.map((notice) => (
              <div key={notice.id} className="pb-4 border-b border-border-theme last:border-0 last:pb-0">
                <div className="text-[11px] text-primary font-bold uppercase">{notice.date}</div>
                <div className="text-sm font-semibold my-1">{notice.title}</div>
                <div className="text-xs text-text-muted line-clamp-2">{notice.content}</div>
              </div>
            ))}
            {notices.length === 0 && <p className="text-xs text-text-muted italic">कोणतीही नवीन सूचना नाही.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function Apply() {
  return (
    <div className="bg-white p-8 rounded-2xl border border-border-theme max-w-2xl mx-auto text-center">
      <div className="bg-primary-light text-primary w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
        <FileText className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-bold text-text-dark mb-4">नवीन अर्जासाठी अर्ज करा</h2>
      <p className="text-text-muted mb-8">येथे तुम्ही विविध दाखल्यांसाठी (उदा. रहिवासी दाखला, जन्म दाखला) अर्ज करू शकता. ही सुविधा लवकरच उपलब्ध होईल.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {['रहिवासी दाखला', 'जन्म दाखला', 'मृत्यू दाखला', 'उत्पन्न दाखला'].map(item => (
          <div key={item} className="p-4 border border-border-theme rounded-xl text-text-muted bg-bg cursor-not-allowed font-medium">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function PayTax() {
  return (
    <div className="bg-white p-8 rounded-2xl border border-border-theme max-w-2xl mx-auto text-center">
      <div className="bg-primary-light text-primary w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
        <CreditCard className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-bold text-text-dark mb-4">घरपट्टी आणि पाणीपट्टी भरा</h2>
      <p className="text-text-muted mb-8">तुमचा कर ऑनलाइन भरण्यासाठी ही सुविधा लवकरच सुरू होईल. सध्या तुम्ही ग्रामपंचायत कार्यालयात जाऊन कर भरू शकता.</p>
      <div className="bg-bg p-8 rounded-xl border border-dashed border-border-theme">
        <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">येथे पेमेंट गेटवे येईल</p>
        <div className="h-12 bg-primary-light/50 rounded-lg animate-pulse w-full max-w-xs mx-auto"></div>
      </div>
    </div>
  );
}

// --- Pages ---

function Complaint() {
  const { user, profile } = useUser();
  const [type, setType] = useState('पाणी');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setSubmitting(true);
    try {
      const path = 'complaints';
      await addDoc(collection(db, path), {
        userId: user.uid,
        userName: profile?.name || user.displayName,
        type,
        description,
        status: 'प्रलंबित',
        createdAt: new Date().toISOString()
      });
      setSuccess(true);
      setDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'complaints');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-border-theme text-center max-w-md mx-auto">
        <div className="bg-primary-light text-primary w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-text-dark mb-2">तक्रार यशस्वीरित्या नोंदवली!</h2>
        <p className="text-text-muted mb-6">तुमच्या तक्रारीवर लवकरच कार्यवाही केली जाईल.</p>
        <button 
          onClick={() => setSuccess(false)}
          className="bg-primary text-white px-8 py-2 rounded-lg font-bold hover:bg-accent transition-colors"
        >
          आणखी एक तक्रार नोंदवा
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl border border-border-theme max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-text-dark mb-6 flex items-center gap-3">
        <div className="p-2 bg-primary-light rounded-lg text-primary">
          <MessageSquare className="w-6 h-6" />
        </div>
        तक्रार नोंदवा
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-text-dark mb-3 uppercase tracking-wider">तक्रार प्रकार निवडा</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {['पाणी', 'रस्ता', 'गटार', 'इतर'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "py-3 px-4 rounded-xl font-bold text-sm transition-all border",
                  type === t 
                    ? "bg-primary text-white border-primary shadow-md" 
                    : "bg-bg text-text-muted border-border-theme hover:border-primary hover:text-primary"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-text-dark mb-2 uppercase tracking-wider">तक्रार तपशील लिहा</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="येथे तुमची तक्रार सविस्तर लिहा..."
            className="w-full h-40 p-4 rounded-xl border border-border-theme bg-bg focus:ring-2 focus:ring-primary outline-none transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          {submitting ? 'पाठवत आहे...' : 'सबमिट करा'}
        </button>
      </form>
    </div>
  );
}

function Notices() {
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notices');
    });
    return unsubscribe;
  }, []);

  if (loading) return <div className="text-center py-12 text-text-muted">लोड होत आहे...</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-text-dark flex items-center gap-3">
        <div className="p-2 bg-primary-light rounded-lg text-primary">
          <Bell className="w-6 h-6" />
        </div>
        सूचना फलक
      </h2>
      
      {notices.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl text-center text-text-muted border border-dashed border-border-theme">
          सध्या कोणतीही नवीन सूचना नाही.
        </div>
      ) : (
        notices.map((notice) => (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white p-6 rounded-2xl border border-border-theme border-l-4 border-l-primary"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-xl text-text-dark">{notice.title}</h3>
              <div className="flex items-center gap-2 text-[11px] font-bold text-primary uppercase bg-primary-light px-3 py-1 rounded-lg">
                <Clock className="w-3 h-3" />
                {notice.date} {notice.time}
              </div>
            </div>
            <p className="text-text-muted leading-relaxed whitespace-pre-wrap text-sm">{notice.content}</p>
          </motion.div>
        ))
      )}
    </div>
  );
}

function MyComplaints() {
  const { user } = useUser();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'complaints'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'complaints');
    });
    return unsubscribe;
  }, [user.uid]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'प्रलंबित': return 'bg-orange-50 text-orange-600 border-orange-100';
      case 'प्रगतीपथावर': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'पूर्ण': return 'bg-primary-light text-primary border-primary/20';
      default: return 'bg-bg text-text-muted border-border-theme';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'प्रलंबित': return <Clock className="w-4 h-4" />;
      case 'प्रगतीपथावर': return <AlertCircle className="w-4 h-4" />;
      case 'पूर्ण': return <CheckCircle2 className="w-4 h-4" />;
      default: return null;
    }
  };

  if (loading) return <div className="text-center py-12 text-text-muted">लोड होत आहे...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-text-dark flex items-center gap-3">
        <div className="p-2 bg-primary-light rounded-lg text-primary">
          <Folder className="w-6 h-6" />
        </div>
        माझे अर्ज आणि तक्रारी
      </h2>

      {complaints.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl text-center text-text-muted border border-dashed border-border-theme">
          तुम्ही अद्याप कोणतीही तक्रार नोंदवलेली नाही.
        </div>
      ) : (
        <div className="grid gap-4">
          {complaints.map((c) => (
            <div key={c.id} className="bg-white p-6 rounded-2xl border border-border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{c.type}</span>
                  <span className="text-border-theme">•</span>
                  <span className="text-[10px] font-bold text-text-muted uppercase">{new Date(c.createdAt).toLocaleDateString('mr-IN')}</span>
                </div>
                <p className="text-text-dark font-semibold">{c.description}</p>
              </div>
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border self-start sm:self-center",
                getStatusColor(c.status)
              )}>
                {getStatusIcon(c.status)}
                {c.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Admin() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'complaints' | 'notices'>('complaints');
  
  // Notice form state
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeDate, setNoticeDate] = useState('');
  const [isAddingNotice, setIsAddingNotice] = useState(false);

  useEffect(() => {
    const qC = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    const unsubscribeC = onSnapshot(qC, (snapshot) => {
      setComplaints(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qN = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const unsubscribeN = onSnapshot(qN, (snapshot) => {
      setNotices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribeC();
      unsubscribeN();
    };
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'complaints', id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'complaints');
    }
  };

  const handleAddNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'notices'), {
        title: noticeTitle,
        content: noticeContent,
        date: noticeDate,
        time: new Date().toLocaleTimeString('mr-IN', { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString()
      });
      setNoticeTitle('');
      setNoticeContent('');
      setNoticeDate('');
      setIsAddingNotice(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'notices');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-text-dark flex items-center gap-3">
          <div className="p-2 bg-primary-light rounded-lg text-primary">
            <ShieldCheck className="w-8 h-8" />
          </div>
          प्रशासन पॅनेल
        </h2>
        <div className="flex bg-bg p-1 rounded-xl border border-border-theme">
          <button 
            onClick={() => setActiveTab('complaints')}
            className={cn(
              "px-6 py-2 rounded-lg font-bold text-sm transition-all", 
              activeTab === 'complaints' ? "bg-primary text-white shadow-md" : "text-text-muted hover:text-primary"
            )}
          >
            तक्रारी ({complaints.length})
          </button>
          <button 
            onClick={() => setActiveTab('notices')}
            className={cn(
              "px-6 py-2 rounded-lg font-bold text-sm transition-all", 
              activeTab === 'notices' ? "bg-primary text-white shadow-md" : "text-text-muted hover:text-primary"
            )}
          >
            सूचना ({notices.length})
          </button>
        </div>
      </div>

      {activeTab === 'complaints' ? (
        <div className="bg-white rounded-2xl border border-border-theme overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg border-b border-border-theme">
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-muted">नागरिक</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-muted">प्रकार</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-muted">तक्रार</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-muted">स्थिती</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-text-muted">कृती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-theme">
                {complaints.map((c) => (
                  <tr key={c.id} className="hover:bg-bg/50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-text-dark">{c.userName}</p>
                      <p className="text-[10px] text-text-muted uppercase">{new Date(c.createdAt).toLocaleDateString('mr-IN')}</p>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold bg-primary-light text-primary px-2 py-1 rounded-lg uppercase">{c.type}</span>
                    </td>
                    <td className="p-4 max-w-xs">
                      <p className="text-sm text-text-dark line-clamp-2">{c.description}</p>
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "text-[11px] font-bold px-3 py-1 rounded-lg border uppercase",
                        c.status === 'प्रलंबित' ? "bg-orange-50 text-orange-600 border-orange-100" :
                        c.status === 'प्रगतीपथावर' ? "bg-blue-50 text-blue-600 border-blue-100" :
                        "bg-primary-light text-primary border-primary/20"
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <select 
                        value={c.status}
                        onChange={(e) => handleStatusUpdate(c.id, e.target.value)}
                        className="text-xs p-2 border border-border-theme rounded-lg bg-bg focus:ring-1 focus:ring-primary outline-none font-bold"
                      >
                        <option value="प्रलंबित">प्रलंबित</option>
                        <option value="प्रगतीपथावर">प्रगतीपथावर</option>
                        <option value="पूर्ण">पूर्ण</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => setIsAddingNotice(!isAddingNotice)}
              className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-accent transition-all shadow-lg"
            >
              <Plus className="w-5 h-5" />
              नवीन सूचना जोडा
            </button>
          </div>

          {isAddingNotice && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-8 rounded-2xl border border-border-theme"
            >
              <form onSubmit={handleAddNotice} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wider">शीर्षक</label>
                    <input 
                      required
                      placeholder="सूचनेचे शीर्षक"
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      className="w-full p-3 rounded-xl border border-border-theme bg-bg focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wider">तारीख</label>
                    <input 
                      required
                      type="text"
                      placeholder="उदा. १२ मार्च"
                      value={noticeDate}
                      onChange={(e) => setNoticeDate(e.target.value)}
                      className="w-full p-3 rounded-xl border border-border-theme bg-bg focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-2 uppercase tracking-wider">मजकूर</label>
                  <textarea 
                    required
                    placeholder="सूचनेचा तपशील..."
                    value={noticeContent}
                    onChange={(e) => setNoticeContent(e.target.value)}
                    className="w-full h-40 p-3 rounded-xl border border-border-theme bg-bg focus:ring-2 focus:ring-primary outline-none resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsAddingNotice(false)}
                    className="px-6 py-2 text-text-muted font-bold hover:text-text-dark transition-colors"
                  >
                    रद्द करा
                  </button>
                  <button 
                    type="submit"
                    className="bg-primary text-white px-8 py-2 rounded-xl font-bold hover:bg-accent transition-all shadow-md"
                  >
                    सूचना प्रसिद्ध करा
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          <div className="grid gap-4">
            {notices.map((n) => (
              <div key={n.id} className="bg-white p-6 rounded-2xl border border-border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{n.date}</span>
                    <span className="text-border-theme">•</span>
                    <span className="text-[10px] font-bold text-text-muted uppercase">{n.time}</span>
                  </div>
                  <h4 className="font-bold text-text-dark">{n.title}</h4>
                  <p className="text-sm text-text-muted line-clamp-2">{n.content}</p>
                </div>
                <button 
                  onClick={async () => {
                    if(confirm('ही सूचना हटवायची आहे का?')) {
                      await deleteDoc(doc(db, 'notices', n.id));
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors self-end sm:self-center"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [user, loading] = useAuthState(auth);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();

    async function fetchProfile() {
      if (user) {
        setProfileLoading(true);
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        } else {
          // Create default profile
          const newProfile = {
            uid: user.uid,
            name: user.displayName || 'नागरिक',
            email: user.email,
            role: user.email === 'gpgugwad@gmail.com' ? 'admin' : 'user',
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
        setProfileLoading(false);
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    }
    fetchProfile();
  }, [user]);

  if (loading || profileLoading) return <LoadingScreen />;

  const isAdmin = profile?.role === 'admin';

  return (
    <ErrorBoundary>
      <UserContext.Provider value={{ user, profile, loading, isAdmin }}>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/apply" element={user ? <Apply /> : <Navigate to="/" />} />
              <Route path="/complaint" element={user ? <Complaint /> : <Navigate to="/" />} />
              <Route path="/notices" element={user ? <Notices /> : <Navigate to="/" />} />
              <Route path="/pay-tax" element={user ? <PayTax /> : <Navigate to="/" />} />
              <Route path="/my-complaints" element={user ? <MyComplaints /> : <Navigate to="/" />} />
              <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/" />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Layout>
        </Router>
      </UserContext.Provider>
    </ErrorBoundary>
  );
}
