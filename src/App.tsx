import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, getDocs, writeBatch, where, deleteDoc } from 'firebase/firestore';
import { Sun, Moon, Mail, Send, File, Trash2, Search, Menu, Plus, RefreshCw, ChevronLeft, ChevronRight, User as UserIcon, X, Star, MailOpen, Folder, Bell, AlertCircle, Maximize2, Minimize2, Bold, Italic, Underline, List, ListOrdered, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

// --- Types ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

type Email = {
  id: string;
  uid: number;
  folder: string;
  previousFolder?: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  read: boolean;
  starred?: boolean;
  localDeleted?: boolean;
  flags: string[];
  userId: string;
};

// --- Context ---
type Account = { email: string; pass: string };
type AuthContextType = {
  user: User | null;
  activeAccount: Account | null;
  accounts: Account[];
  login: (email: string, pass: string) => Promise<void>;
  switchAccount: (email: string) => Promise<void>;
  logoutAccount: (email: string) => void;
};

interface ThemeContextType {
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  activeAccount: null,
  accounts: [],
  login: async () => {},
  switchAccount: async () => {},
  logoutAccount: () => {}
});

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {}
});

function Login({ onCancel }: { onCancel?: () => void }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { theme, setTheme } = useContext(ThemeContext);
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const isDark = theme === 'dark';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
      if (onCancel) onCancel();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col items-center justify-center p-4 transition-colors duration-300", 
        onCancel ? "absolute inset-0 z-50 bg-black/50" : (isDark ? "min-h-screen bg-gray-950" : "min-h-screen bg-slate-50"))}>
      
      {/* Theme Toggle - Positioned top right if not in modal mode */}
      {!onCancel && (
      <div className="absolute top-6 right-6">
        <button
          onClick={toggleTheme}
          className={cn(
            "relative flex items-center w-16 h-8 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2",
            isDark ? "bg-gray-700 focus:ring-gray-600 focus:ring-offset-gray-950" : "bg-slate-300 focus:ring-slate-400 focus:ring-offset-white"
          )}
          aria-label="Toggle theme"
        >
          <div
            className={cn(
              "absolute left-1 w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 flex items-center justify-center",
              isDark ? "translate-x-8" : "translate-x-0"
            )}
          >
            {isDark ? <Moon className="w-4 h-4 text-gray-800" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </div>
        </button>
      </div>
      )}

      <div className={cn("p-8 rounded-3xl shadow-2xl w-full max-w-md relative transition-all duration-300 border", 
        isDark ? 'bg-gray-900 border-gray-800 text-white shadow-black/50' : 'bg-white border-slate-100 text-slate-900')}>
        
        {onCancel && (
          <button onClick={onCancel} className={cn("absolute top-5 right-5 p-2 rounded-full transition-colors", 
            isDark ? 'hover:bg-gray-800 text-gray-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900')}>
            <X className="w-5 h-5" />
          </button>
        )}
        
        <div className="flex justify-center mb-6">
          <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner", 
            isDark ? "bg-blue-600/20 text-blue-400" : "bg-blue-50 text-blue-600")}>
            <Mail className="w-10 h-10" />
          </div>
        </div>
        
        <h1 className="text-3xl font-extrabold text-center mb-2 tracking-tight">Welcome Back</h1>
        <p className={cn("text-center mb-8", isDark ? 'text-gray-400' : 'text-slate-500')}>Sign in to BMI Mail</p>

        {error && (
            <div className={cn("p-4 rounded-xl mb-6 text-sm flex items-center gap-3 border", 
                isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-600")}>
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{error}</p>
            </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-4">
            <div>
              <label className={cn("block text-sm font-medium mb-1.5", isDark ? "text-gray-300" : "text-slate-700")}>Email Input</label>
              <input
                type="text"
                required
                placeholder="Email or phone"
                className={cn("w-full px-4 py-3 rounded-xl outline-none transition-all duration-200 border", 
                    isDark ? 'bg-gray-950 border-gray-800 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className={cn("block text-sm font-medium mb-1.5", isDark ? "text-gray-300" : "text-slate-700")}>Security Key</label>
              <input
                type="password"
                required
                placeholder="Enter password"
                className={cn("w-full px-4 py-3 rounded-xl outline-none transition-all duration-200 border", 
                    isDark ? 'bg-gray-950 border-gray-800 text-white placeholder-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:bg-white')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={cn("w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6", 
                isDark ? "focus:ring-offset-gray-900" : "focus:ring-offset-white")}
          >
            {loading ? (
                <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Signing in...
                </>
            ) : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ComposeModal({ onClose, initialTo = '', initialSubject = '' }: { onClose: () => void, initialTo?: string, initialSubject?: string }) {
  const { user, activeAccount } = useContext(AuthContext);
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [draftUid, setDraftUid] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    if (!activeAccount) return;
    if (!to && !cc && !bcc && !subject && !body && attachments.length === 0) return;

    const timer = setTimeout(async () => {
      const formData = new FormData();
      formData.append('email', activeAccount.email);
      formData.append('password', activeAccount.pass);
      formData.append('to', to);
      if (cc) formData.append('cc', cc);
      if (bcc) formData.append('bcc', bcc);
      formData.append('subject', subject);
      formData.append('text', editorRef.current?.innerText || '');
      formData.append('html', body);
      if (draftUid) formData.append('previousUid', draftUid);
      attachments.forEach(file => formData.append('attachments', file));
      
      try {
        const res = await fetch('/api/draft', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.uid) {
          setDraftUid(data.uid);
        }
      } catch (err) {
        console.error("Auto-save draft failed", err);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [to, subject, body, attachments, activeAccount]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const validFiles = files.filter(f => f.size <= 25 * 1024 * 1024);
    if (validFiles.length < files.length) {
      alert("Some files were too large. Maximum size is 25MB per file.");
    }
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccount) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('email', activeAccount.email);
      formData.append('password', activeAccount.pass);
      formData.append('to', to);
      if (cc) formData.append('cc', cc);
      if (bcc) formData.append('bcc', bcc);
      formData.append('subject', subject);
      formData.append('text', editorRef.current?.innerText || '');
      formData.append('html', body);
      if (draftUid) formData.append('draftUid', draftUid);
      
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const res = await fetch('/api/send', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to send');
      
      // Clear draftUid so handleCloseCompose doesn't save it again
      setDraftUid(null);
      // Also clear fields so handleCloseCompose doesn't trigger
      setTo('');
      setCc('');
      setBcc('');
      setSubject('');
      setBody('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setAttachments([]);
      
      onClose();
    } catch (err) {
      alert('Error sending email');
    } finally {
      setSending(false);
    }
  };

  const handleCloseCompose = async () => {
    if (activeAccount && (to || cc || bcc || subject || body || attachments.length > 0)) {
      const formData = new FormData();
      formData.append('email', activeAccount.email);
      formData.append('password', activeAccount.pass);
      formData.append('to', to);
      if (cc) formData.append('cc', cc);
      if (bcc) formData.append('bcc', bcc);
      formData.append('subject', subject);
      formData.append('text', editorRef.current?.innerText || '');
      formData.append('html', body);
      if (draftUid) formData.append('previousUid', draftUid);
      attachments.forEach(file => formData.append('attachments', file));
      
      // Fire and forget
      fetch('/api/draft', { method: 'POST', body: formData }).catch(console.error);
    }
    onClose();
  };

  const handleFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
  };

  return (
    <div className={cn(
      "fixed flex flex-col shadow-2xl border z-50 transition-all duration-200", 
      document.documentElement.classList.contains('dark') ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200',
      isFullScreen 
        ? "inset-0 sm:inset-10 sm:rounded-xl" 
        : "bottom-0 left-0 right-0 sm:left-auto sm:right-24 sm:w-[500px] h-[90vh] sm:h-[500px] rounded-t-xl"
    )}>
      <div className={cn("bg-gray-800 text-white px-4 py-3 flex justify-between items-center", isFullScreen ? "rounded-t-xl" : "rounded-t-xl")}>
        <span className="font-medium text-sm">New Message</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setIsFullScreen(!isFullScreen)} className="hover:bg-gray-700 p-1 rounded">
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={handleCloseCompose} className="hover:bg-gray-700 p-1 rounded"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-hidden">
        <div className={cn("border-b flex items-center pr-4", document.documentElement.classList.contains('dark') ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
          <input
            type="text"
            placeholder="To"
            required
            className={cn("flex-1 px-4 py-2 outline-none text-sm bg-transparent", document.documentElement.classList.contains('dark') ? 'text-gray-100 placeholder-gray-500' : 'text-gray-900')}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <button 
            type="button" 
            onClick={() => setShowCcBcc(!showCcBcc)}
            className={cn("text-xs font-medium px-2 py-1 rounded transition-colors", document.documentElement.classList.contains('dark') ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100')}
          >
            Cc/Bcc
          </button>
        </div>
        {showCcBcc && (
          <>
            <input
              type="text"
              placeholder="Cc"
              className={cn("border-b px-4 py-2 outline-none text-sm", document.documentElement.classList.contains('dark') ? 'bg-gray-900 border-gray-800 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-100 text-gray-900')}
              value={cc}
              onChange={(e) => setCc(e.target.value)}
            />
            <input
              type="text"
              placeholder="Bcc"
              className={cn("border-b px-4 py-2 outline-none text-sm", document.documentElement.classList.contains('dark') ? 'bg-gray-900 border-gray-800 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-100 text-gray-900')}
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
            />
          </>
        )}
        <input
          type="text"
          placeholder="Subject"
          className={cn("border-b px-4 py-2 outline-none text-sm font-medium", document.documentElement.classList.contains('dark') ? 'bg-gray-900 border-gray-800 text-gray-100 placeholder-gray-500' : 'bg-white border-gray-100 text-gray-900')}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <div className={cn("flex flex-wrap items-center gap-1 border-b px-2 py-1", document.documentElement.classList.contains('dark') ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-gray-50')}>
          <button type="button" onClick={() => handleFormat('bold')} className={cn("p-1.5 rounded", document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700')} title="Bold"><Bold className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleFormat('italic')} className={cn("p-1.5 rounded", document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700')} title="Italic"><Italic className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleFormat('underline')} className={cn("p-1.5 rounded", document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700')} title="Underline"><Underline className="w-4 h-4" /></button>
          <div className={cn("w-px h-4 mx-1", document.documentElement.classList.contains('dark') ? 'bg-gray-700' : 'bg-gray-300')}></div>
          <button type="button" onClick={() => handleFormat('insertUnorderedList')} className={cn("p-1.5 rounded", document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700')} title="Bullet List"><List className="w-4 h-4" /></button>
          <button type="button" onClick={() => handleFormat('insertOrderedList')} className={cn("p-1.5 rounded", document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700')} title="Numbered List"><ListOrdered className="w-4 h-4" /></button>
          <div className={cn("w-px h-4 mx-1", document.documentElement.classList.contains('dark') ? 'bg-gray-700' : 'bg-gray-300')}></div>
          <button type="button" onClick={() => {
            const url = prompt('Enter link URL:');
            if (url) handleFormat('createLink', url);
          }} className={cn("p-1.5 rounded", document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-200 text-gray-700')} title="Insert Link"><Link2 className="w-4 h-4" /></button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          onInput={handleEditorInput}
          className={cn("flex-1 p-4 outline-none overflow-y-auto text-sm min-h-[200px] prose", document.documentElement.classList.contains('dark') ? 'bg-gray-900 text-gray-100 prose-invert max-w-none' : 'bg-white text-gray-900 max-w-none')}
        />
        {attachments.length > 0 && (
          <div className={cn("px-4 py-2 flex flex-wrap gap-2 border-t", document.documentElement.classList.contains('dark') ? 'border-gray-800' : 'border-gray-100')}>
            {attachments.map((att, i) => (
              <div key={i} className={cn("text-xs px-2 py-1 rounded flex items-center gap-1", document.documentElement.classList.contains('dark') ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700')}>
                <File className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{att.name}</span>
                <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className={cn("p-3 border-t flex items-center justify-between", document.documentElement.classList.contains('dark') ? 'border-gray-800' : 'border-gray-100')}>
          <button
            type="submit"
            disabled={sending || !to}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium text-sm transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
          <label className={cn("cursor-pointer p-2 rounded-full", document.documentElement.classList.contains('dark') ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}>
            <input type="file" multiple className="hidden" onChange={handleFileChange} />
            <File className={cn("w-5 h-5", document.documentElement.classList.contains('dark') ? 'text-gray-400' : 'text-gray-600')} />
          </label>
        </div>
      </form>
    </div>
  );
}


function MainApp({ onLogout, key }: { onLogout: () => void, key?: string }) {
  const { user, activeAccount, accounts, switchAccount, logoutAccount } = useContext(AuthContext);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [replyData, setReplyData] = useState<{to: string, subject: string} | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsSidebarOpen(window.innerWidth >= 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [logoutConfirmAccount, setLogoutConfirmAccount] = useState<string | null>(null);
  const [openMoveMenuId, setOpenMoveMenuId] = useState<string | null>(null);

  const { theme, setTheme } = useContext(ThemeContext);
  
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Listen to Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/emails`), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => doc.data() as Email);
      // Deduplicate by folder and uid to hide old numeric IDs if new ones exist
      const uniqueEmails: Email[] = [];
      const seen = new Set<string>();
      for (const e of data) {
        const key = `${e.folder}_${e.uid}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueEmails.push(e);
        }
      }
      setEmails(uniqueEmails);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/emails`);
    });

    const fq = query(collection(db, `users/${user.uid}/folders`));
    const unsubF = onSnapshot(fq, (snap) => {
      const fetchedFolders = snap.docs.map(doc => doc.data().name as string);
      setCustomFolders(fetchedFolders);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/folders`);
    });

    return () => {
      unsub();
      unsubF();
    };
  }, [user]);

  // Sync emails from IMAP
  const syncEmails = async (folder = 'INBOX') => {
    if (!activeAccount || !user) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: activeAccount.email,
          password: activeAccount.pass,
          folder
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Save to Firestore using writeBatch
        const batch = writeBatch(db);

        // Clean up old buggy numeric IDs
        try {
          const oldDocsQuery = query(collection(db, `users/${user.uid}/emails`), where('folder', '==', folder));
          const oldDocsSnap = await getDocs(oldDocsQuery);
          oldDocsSnap.forEach(docSnap => {
            if (/^\d+$/.test(docSnap.id)) {
              batch.delete(docSnap.ref);
            }
          });
        } catch (e) {
          console.error("Cleanup failed", e);
        }

        for (const email of data.emails) {
          const emailData = { ...email, userId: user.uid };
          const emailRef = doc(db, `users/${user.uid}/emails`, email.id);
          batch.set(emailRef, emailData, { merge: true });
        }
        await batch.commit();
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('permission')) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/emails`);
      }
      console.error('Sync failed', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleMark = async (email: Email, action: 'read' | 'unread' | 'star' | 'unstar' | 'delete' | 'restore') => {
    if (!user || !activeAccount) return;
    
    // Optimistic update
    const emailRef = doc(db, `users/${user.uid}/emails`, email.id);
    let updates: any = {};
    if (action === 'read') updates.read = true;
    if (action === 'unread') updates.read = false;
    if (action === 'star') updates.starred = true;
    if (action === 'unstar') updates.starred = false;
    if (action === 'delete') updates.localDeleted = true;
    if (action === 'restore') updates.localDeleted = false;
    
    try {
      await setDoc(emailRef, updates, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/emails/${email.id}`);
    }

    // Server update (except for delete and restore)
    if (action !== 'delete' && action !== 'restore') {
      try {
        await fetch('/api/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: activeAccount.email,
            password: activeAccount.pass,
            folder: email.folder,
            uid: email.uid,
            action
          })
        });
      } catch (err) {
        console.error('Failed to mark on server', err);
      }
    }
  };

  const handleMove = async (email: Email, destination: string) => {
    if (!user || !activeAccount) return;

    // Optimistic update
    const emailRef = doc(db, `users/${user.uid}/emails`, email.id);
    try {
      await setDoc(emailRef, { folder: destination, previousFolder: email.folder }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/emails/${email.id}`);
    }
    setSelectedEmail(null);

    // Server update
    try {
      await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: activeAccount.email,
          password: activeAccount.pass,
          folder: email.folder,
          uid: email.uid,
          destination
        })
      });
    } catch (err) {
      console.error('Failed to move on server', err);
    }
  };

  // Initial sync
  useEffect(() => {
    if (activeAccount && user) {
      syncEmails('INBOX');
      syncEmails('Updates');
      syncEmails('Drafts');
    }
  }, [activeAccount, user]);

  const unreadInboxCount = emails.filter(e => e.folder.toUpperCase() === 'INBOX' && !e.read && !e.localDeleted).length;

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !activeAccount || !user) return;

    try {
      await fetch('/api/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: activeAccount.email,
          password: activeAccount.pass,
          folderName: newFolderName.trim()
        })
      });

      await setDoc(doc(db, `users/${user.uid}/folders`, newFolderName.trim()), {
        name: newFolderName.trim()
      });

      setNewFolderName('');
      setShowNewFolder(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/folders`);
    }
  };

  const handleDeleteFolder = async (folderName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !activeAccount) return;
    if (!window.confirm(`Are you sure you want to delete the folder "${folderName}" and move its contents back to their original folders?`)) return;

    const folderEmails = emails.filter(email => email.folder === folderName);
    const moves: Record<string, number[]> = {};
    for (const email of folderEmails) {
      const dest = email.previousFolder || 'INBOX';
      if (!moves[dest]) moves[dest] = [];
      moves[dest].push(email.uid);
    }

    try {
      await fetch('/api/delete-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: activeAccount.email,
          password: activeAccount.pass,
          folderName: folderName,
          moves: moves
        })
      });

      // Update Firestore optimistic batch
      const batch = writeBatch(db);
      folderEmails.forEach(email => {
        const dest = email.previousFolder || 'INBOX';
        const ref = doc(db, `users/${user.uid}/emails`, email.id);
        batch.update(ref, { folder: dest, previousFolder: null });
      });
      batch.delete(doc(db, `users/${user.uid}/folders`, folderName));
      await batch.commit();

      if (selectedFolder === folderName) {
        setSelectedFolder('INBOX');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/folders`);
    }
  };
  const draftsCount = emails.filter(e => e.folder.toUpperCase() === 'DRAFTS' && !e.localDeleted).length;
  const updatesCount = emails.filter(e => e.folder.toUpperCase() === 'UPDATES' && !e.read && !e.localDeleted).length;

  const folders = [
    { id: 'INBOX', name: 'Inbox', icon: Mail, count: unreadInboxCount },
    { id: 'Updates', name: 'Updates', icon: Bell, count: updatesCount },
    { id: 'Sent', name: 'Sent', icon: Send },
    { id: 'Drafts', name: 'Drafts', icon: File, count: draftsCount },
    { id: 'Trash', name: 'Trash', icon: Trash2 },
  ];

  const allFolders = [
    ...folders,
    ...customFolders.map(f => ({ id: f, name: f, icon: Folder }))
  ];

  const filteredEmails = emails.filter(e => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = e.subject.toLowerCase().includes(searchLower) || 
                          e.from.toLowerCase().includes(searchLower) ||
                          e.snippet.toLowerCase().includes(searchLower) ||
                          (e.body && e.body.toLowerCase().includes(searchLower));
                          
    if (selectedFolder === 'Trash') {
      return (e.localDeleted || e.folder.toUpperCase() === 'TRASH') && matchesSearch;
    }
    
    if (e.localDeleted) return false;
    
    const matchesFolder = e.folder.toUpperCase() === selectedFolder.toUpperCase() || 
                          (selectedFolder === 'INBOX' && e.folder === 'INBOX');
    return matchesFolder && matchesSearch;
  });

  const currentIndex = selectedEmail ? filteredEmails.findIndex(e => e.id === selectedEmail.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < filteredEmails.length - 1;

  return (
    <div className={cn("h-screen flex flex-col overflow-hidden transition-colors duration-200", theme === 'dark' ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900')}>
      {/* Header */}
      <header className={cn("relative z-10 h-16 border-b flex items-center px-4 justify-between shrink-0 transition-colors duration-200", theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white')}>
        <div className="flex items-center gap-2 sm:gap-4 lg:w-64">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={cn("p-2 rounded-full", theme === 'dark' ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className={cn("text-xl font-medium tracking-tight", theme === 'dark' ? 'text-gray-200' : 'text-gray-600')}>BMI Mail</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-2xl px-2 sm:px-8">
          <div className={cn("rounded-full flex items-center px-4 py-2 focus-within:shadow-md focus-within:ring-1 transition-all", theme === 'dark' ? 'bg-gray-800 focus-within:bg-gray-800 focus-within:ring-gray-700' : 'bg-gray-100 focus-within:bg-white focus-within:ring-gray-200')}>
            <Search className={cn("w-5 h-5 mr-2 sm:mr-3", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')} />
            <input 
              type="text" 
              placeholder="Search mail" 
              className={cn("bg-transparent border-none outline-none w-full", theme === 'dark' ? 'text-gray-100 placeholder-gray-400' : 'text-gray-700')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 lg:w-64 justify-end relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)} 
            className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-medium hover:ring-2 hover:ring-purple-300 transition-all"
          >
            {activeAccount?.email?.[0].toUpperCase()}
          </button>

          {showProfileMenu && (
            <div className={cn("absolute top-10 right-0 mt-2 w-64 sm:w-72 rounded-xl shadow-xl border z-50 py-2", theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100')}>
              <div className={cn("px-4 py-3 border-b", theme === 'dark' ? 'border-gray-800' : 'border-gray-100')}>
                <div className={cn("text-xs mb-1", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Current account</div>
                <div className={cn("font-medium text-sm truncate", theme === 'dark' ? 'text-gray-100' : 'text-gray-900')}>{activeAccount?.email}</div>
              </div>
              
              <div className="max-h-64 overflow-y-auto py-2">
                {accounts.map(acc => (
                  <div key={acc.email} className="px-2 py-1 flex items-center justify-between group">
                    <button 
                      onClick={() => { switchAccount(acc.email); setShowProfileMenu(false); }}
                      className={cn(
                        "flex-1 text-left flex items-center gap-3 px-2 py-2 rounded-lg truncate",
                        theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50',
                        acc.email === activeAccount?.email ? (theme === 'dark' ? "bg-blue-900/30" : "bg-blue-50/50") : ""
                      )}
                    >
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0", theme === 'dark' ? 'bg-purple-900/50 text-purple-300' : 'bg-purple-100 text-purple-700')}>
                        {acc.email[0].toUpperCase()}
                      </div>
                      <span className={cn("text-sm truncate", acc.email === activeAccount?.email ? (theme === 'dark' ? "font-bold text-blue-400" : "font-bold text-blue-700") : (theme === 'dark' ? "text-gray-300" : "text-gray-700"))}>
                        {acc.email}
                      </span>
                    </button>
                    <button 
                      onClick={() => { setLogoutConfirmAccount(acc.email); setShowProfileMenu(false); }}
                      className={cn("p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all ml-1", theme === 'dark' ? 'text-gray-500 hover:text-red-400 hover:bg-red-900/30' : 'text-gray-400 hover:text-red-600 hover:bg-red-50')}
                      title="Log out"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className={cn("border-t p-2 mt-1", theme === 'dark' ? 'border-gray-800' : 'border-gray-100')}>
                <button 
                  onClick={() => {
                    if (accounts.length >= 10) {
                      alert("Maximum 10 accounts allowed.");
                      return;
                    }
                    setShowAddAccount(true);
                    setShowProfileMenu(false);
                  }}
                  disabled={accounts.length >= 10}
                  className={cn("w-full text-left px-4 py-2 text-sm rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors", theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-700 hover:bg-gray-50')}
                >
                  <Plus className="w-4 h-4" />
                  Add another account
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={cn("absolute lg:relative z-40 h-full w-64 p-3 flex flex-col gap-1 border-r shrink-0 transition-transform duration-200", 
          theme === 'dark' ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white',
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        )}>
          {/* Mobile Logo */}
          <div className="flex items-center justify-between px-4 py-2 mb-2 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className={cn("text-xl font-medium tracking-tight", theme === 'dark' ? 'text-gray-200' : 'text-gray-600')}>BMI Mail</span>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn("p-2 rounded-full", theme === 'dark' ? 'hover:bg-gray-800 text-yellow-400' : 'hover:bg-gray-100 text-gray-600')}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          <button 
            onClick={() => {
              setReplyData(null);
              setIsComposing(true);
              if (window.innerWidth < 1024) setIsSidebarOpen(false);
            }}
            className={cn("flex items-center gap-4 px-4 py-4 rounded-2xl font-medium mb-4 w-fit transition-colors shadow-sm", theme === 'dark' ? 'bg-blue-900 hover:bg-blue-800 text-blue-100' : 'bg-[#c2e7ff] hover:bg-[#b5dfff] text-[#001d35]')}
          >
            <Plus className="w-6 h-6" />
            Compose
          </button>
          
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
            {allFolders.map(f => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedFolder(f.id);
                  setSelectedEmail(null);
                  syncEmails(f.id);
                  if (window.innerWidth < 1024) setIsSidebarOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between px-6 py-2 rounded-r-full font-medium text-sm transition-colors",
                  selectedFolder === f.id 
                    ? (theme === 'dark' ? "bg-blue-900/50 text-blue-300" : "bg-[#d3e3fd] text-[#0b57d0]") 
                    : (theme === 'dark' ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100")
                )}
              >
                <div className="flex items-center gap-4">
                  <f.icon className="w-4 h-4" />
                  {f.name}
                </div>
                <div className="flex items-center gap-2">
                  {f.count !== undefined && f.count > 0 && (
                    <span className="text-xs font-bold">{f.count}</span>
                  )}
                  {customFolders.includes(f.id) && (
                    <div
                      role="button"
                      onClick={(e) => handleDeleteFolder(f.id, e)}
                      className={cn("p-1.5 rounded-full transition-colors", 
                        theme === 'dark' ? "text-gray-400 hover:text-red-400 hover:bg-gray-700/50" : "text-gray-500 hover:text-red-500 hover:bg-gray-200/50"
                      )}
                      title="Delete folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              </button>
            ))}

            {showNewFolder ? (
              <form onSubmit={handleCreateFolder} className="px-6 py-2 mt-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Folder name"
                  className={cn("w-full px-2 py-1 text-sm rounded border outline-none", theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300')}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => setShowNewFolder(false)}
                />
              </form>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className={cn("flex items-center gap-4 px-6 py-2 rounded-r-full font-medium text-sm transition-colors mt-2", theme === 'dark' ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100')}
              >
                <Plus className="w-4 h-4" />
                Create Folder
              </button>
            )}
          </div>

          <div className="mt-auto pt-4 px-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                "flex items-center gap-3 px-4 py-2 w-full rounded-2xl text-sm font-medium transition-all duration-300",
                theme === 'dark' 
                  ? "bg-gray-800/80 text-gray-200 hover:bg-gray-700 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-gray-700/50" 
                  : "bg-white text-gray-700 hover:bg-gray-50 shadow-sm border border-gray-200"
              )}
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-blue-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>{theme === 'dark' ? 'Dark Theme' : 'Light Theme'}</span>
              <div className={cn(
                "ml-auto w-8 h-4 rounded-full flex items-center p-0.5 transition-colors",
                theme === 'dark' ? "bg-blue-500/20" : "bg-gray-200"
              )}>
                <div className={cn(
                  "w-3 h-3 rounded-full transition-transform duration-300",
                  theme === 'dark' ? "bg-blue-400 translate-x-4" : "bg-white translate-x-0 shadow-sm"
                )} />
              </div>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className={cn("flex-1 flex flex-col overflow-hidden transition-colors duration-200 min-w-0", theme === 'dark' ? 'bg-gray-900' : 'bg-white')}>
          <div className={cn("h-12 border-b flex items-center px-4 justify-between shrink-0 transition-colors duration-200", theme === 'dark' ? 'border-gray-800' : 'border-gray-100')}>
            <div className="flex items-center gap-2">
              <button onClick={() => syncEmails(selectedFolder)} className={cn("p-2 rounded-full", theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')} disabled={syncing}>
                <RefreshCw className={cn("w-4 h-4", theme === 'dark' ? 'text-gray-400' : 'text-gray-600', syncing && "animate-spin")} />
              </button>
            </div>
            <div className={cn("text-xs font-medium", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
              {filteredEmails.length} messages
            </div>
          </div>

          {selectedEmail ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className={cn("p-2 rounded-full inline-flex", theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
                >
                  <ChevronLeft className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                </button>
                <div className="flex items-center gap-1">
                  <span className={cn("text-xs mr-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                    {currentIndex + 1} of {filteredEmails.length}
                  </span>
                  <button 
                    onClick={() => {
                      if (window.confirm("Are you sure you want to delete this email?")) {
                        handleMark(selectedEmail, 'delete');
                        setSelectedEmail(null);
                      }
                    }}
                    className={cn("p-2 rounded-full mr-2", theme === 'dark' ? 'hover:bg-gray-800 text-red-400 hover:text-red-300' : 'hover:bg-gray-100 text-red-500 hover:text-red-600')}
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      const prev = filteredEmails[currentIndex - 1];
                      setSelectedEmail(prev);
                      if (!prev.read) handleMark(prev, 'read');
                    }}
                    disabled={!hasPrev}
                    className={cn("p-2 rounded-full disabled:opacity-30", theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
                  >
                    <ChevronLeft className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                  </button>
                  <button 
                    onClick={() => {
                      const next = filteredEmails[currentIndex + 1];
                      setSelectedEmail(next);
                      if (!next.read) handleMark(next, 'read');
                    }}
                    disabled={!hasNext}
                    className={cn("p-2 rounded-full disabled:opacity-30", theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
                  >
                    <ChevronRight className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                  </button>
                </div>
              </div>
              <h2 className={cn("text-xl sm:text-2xl font-normal mb-6 break-words", theme === 'dark' ? 'text-gray-100' : 'text-gray-900')}>{selectedEmail.subject}</h2>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 sm:gap-0">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shrink-0", theme === 'dark' ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700')}>
                    {selectedEmail.from[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className={cn("font-medium text-sm truncate w-full", theme === 'dark' ? 'text-gray-200' : 'text-gray-900')}>{selectedEmail.from}</div>
                    <div className={cn("text-xs truncate w-full", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>to {selectedEmail.to}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className={cn("text-xs", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                    {format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleMark(selectedEmail, selectedEmail.starred ? 'unstar' : 'star')}
                      className={cn("p-2 rounded-full", theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')}
                      title={selectedEmail.starred ? "Unstar" : "Star"}
                    >
                      <Star className={cn("w-5 h-5", selectedEmail.starred ? "fill-yellow-400 text-yellow-400" : "text-gray-400")} />
                    </button>
                    <button 
                      onClick={() => {
                        setReplyData({
                          to: selectedEmail.from,
                          subject: selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`
                        });
                        setIsComposing(true);
                      }}
                      className={cn("text-sm font-medium px-4 py-2 rounded-full transition-colors", theme === 'dark' ? 'text-blue-400 hover:text-blue-300 bg-blue-900/50 hover:bg-blue-900' : 'text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100')}
                    >
                      Reply
                    </button>
                    <div className="relative">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenMoveMenuId(openMoveMenuId === selectedEmail.id ? null : selectedEmail.id); }}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenMoveMenuId(openMoveMenuId === selectedEmail.id ? null : selectedEmail.id); }}
                        className={cn("p-2 rounded-full", theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-100')} 
                        title="Move to folder"
                      >
                        <Folder className={cn("w-5 h-5", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')} />
                      </button>
                      {openMoveMenuId === selectedEmail.id && (
                        <div className={cn("absolute right-0 mt-2 w-48 rounded-xl shadow-xl border z-50 py-1", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100')}>
                          <div className={cn("px-3 py-2 text-xs font-semibold uppercase tracking-wider", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Move to</div>
                          {allFolders.filter(f => f.id !== selectedEmail.folder).map(f => (
                            <button 
                              key={f.id} 
                              onClick={() => { handleMove(selectedEmail, f.id); setOpenMoveMenuId(null); }} 
                              className={cn("w-full text-left px-4 py-2 text-sm flex items-center gap-2", theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')}
                            >
                              <f.icon className="w-4 h-4 text-gray-400" />
                              {f.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div 
                className={cn("prose max-w-none text-sm break-words overflow-x-auto", theme === 'dark' ? 'text-gray-300' : 'text-gray-800')}
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredEmails.length === 0 ? (
                <div className={cn("flex flex-col items-center justify-center h-full", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                  {syncing ? 'Loading...' : 'No messages in this folder.'}
                </div>
              ) : (
                <div className={cn("divide-y", theme === 'dark' ? 'divide-gray-800' : 'divide-gray-100')}>
                  {filteredEmails.map(email => (
                    <div 
                      key={email.id}
                      onClick={() => {
                        setSelectedEmail(email);
                        if (!email.read) handleMark(email, 'read');
                      }}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center px-4 py-3 sm:py-2 cursor-pointer transition-shadow group border-b relative gap-1 sm:gap-0",
                        theme === 'dark' ? 'border-gray-800 hover:bg-gray-800' : 'border-gray-100 hover:shadow-md',
                        !email.read 
                          ? (theme === 'dark' ? "bg-gray-900 font-bold" : "bg-white font-bold") 
                          : (theme === 'dark' ? "bg-gray-900/50 text-gray-400" : "bg-gray-50/50 text-gray-600")
                      )}
                    >
                      <div className="flex items-center justify-between sm:w-48 sm:pr-4 w-full">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMark(email, email.starred ? 'unstar' : 'star'); }}
                            className={cn("p-1 rounded-full shrink-0", theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200')}
                          >
                            <Star className={cn("w-4 h-4", email.starred ? "fill-yellow-400 text-yellow-400" : "text-gray-400")} />
                          </button>
                          <div className={cn("truncate text-sm", theme === 'dark' ? 'text-gray-300' : 'text-gray-900')}>
                            {email.from.split('<')[0].trim() || email.from}
                          </div>
                        </div>
                        <div className={cn("sm:hidden shrink-0 text-xs font-medium ml-2", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                          {format(new Date(email.date), 'MMM d')}
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:flex-1 sm:items-center w-full truncate text-sm pl-8 sm:pl-0">
                        <span className={cn("truncate sm:mr-2", !email.read ? (theme === 'dark' ? "text-gray-100" : "text-gray-900") : (theme === 'dark' ? "text-gray-400" : "text-gray-700"))}>
                          {email.subject || '(No Subject)'}
                        </span>
                        <span className={cn("truncate font-normal hidden sm:inline", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          - {email.snippet}
                        </span>
                        <span className={cn("truncate font-normal sm:hidden text-xs mt-0.5", theme === 'dark' ? 'text-gray-500' : 'text-gray-500')}>
                          {email.snippet}
                        </span>
                      </div>
                      <div className={cn("hidden sm:block w-24 text-right text-xs font-medium pl-4 group-hover:hidden", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
                        {format(new Date(email.date), 'MMM d')}
                      </div>
                      
                      {/* Hover Actions */}
                      <div className={cn("hidden group-hover:flex items-center gap-2 absolute right-4 px-2 py-1 rounded shadow-sm", theme === 'dark' ? 'bg-gray-800/90' : 'bg-white/90')}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleMark(email, email.read ? 'unread' : 'read'); }}
                          className={cn("p-1.5 rounded-full", theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}
                          title={email.read ? "Mark as unread" : "Mark as read"}
                        >
                          {email.read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                        </button>
                        <div className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOpenMoveMenuId(openMoveMenuId === email.id ? null : email.id); }}
                            className={cn("p-1.5 rounded-full", theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}
                            title="Move to folder"
                          >
                            <Folder className="w-4 h-4" />
                          </button>
                          {openMoveMenuId === email.id && (
                            <div className={cn("absolute right-0 mt-1 w-48 rounded-xl shadow-xl border z-50 py-1", theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100')}>
                              <div className={cn("px-3 py-2 text-xs font-semibold uppercase tracking-wider", theme === 'dark' ? 'text-gray-400' : 'text-gray-500')}>Move to</div>
                              {allFolders.filter(f => f.id !== email.folder).map(f => (
                                <button 
                                  key={f.id} 
                                  onClick={(e) => { e.stopPropagation(); handleMove(email, f.id); setOpenMoveMenuId(null); }} 
                                  className={cn("w-full text-left px-4 py-2 text-sm flex items-center gap-2", theme === 'dark' ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-50')}
                                >
                                  <f.icon className="w-4 h-4 text-gray-400" />
                                  {f.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {email.localDeleted ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMark(email, 'restore'); }}
                            className={cn("p-1.5 rounded-full", theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}
                            title="Restore"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMark(email, 'delete'); }}
                            className={cn("p-1.5 rounded-full", theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600')}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {isComposing && <ComposeModal onClose={() => setIsComposing(false)} initialTo={replyData?.to} initialSubject={replyData?.subject} />}
      {showAddAccount && <Login onCancel={() => setShowAddAccount(false)} />}
      
      {logoutConfirmAccount && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className={cn("p-6 rounded-2xl shadow-xl max-w-sm w-full", theme === 'dark' ? 'bg-gray-900 border border-gray-800' : 'bg-white')}>
            <h3 className={cn("text-lg font-semibold mb-2", theme === 'dark' ? 'text-gray-100' : 'text-gray-900')}>Confirm Logout</h3>
            <p className={cn("mb-6", theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Are you sure you want to log out of <span className={cn("font-medium", theme === 'dark' ? 'text-gray-200' : 'text-gray-900')}>{logoutConfirmAccount}</span>?</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setLogoutConfirmAccount(null)} 
                className={cn("px-4 py-2 rounded-lg font-medium transition-colors", theme === 'dark' ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100')}
              >
                Cancel
              </button>
              <button 
                onClick={() => { 
                  logoutAccount(logoutConfirmAccount); 
                  setLogoutConfirmAccount(null); 
                }} 
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try { return JSON.parse(localStorage.getItem('bmi_accounts') || '[]'); } catch { return []; }
  });
  const [activeAccount, setActiveAccount] = useState<Account | null>(() => {
    try { return JSON.parse(localStorage.getItem('bmi_active_account') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.setItem('bmi_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('bmi_active_account', JSON.stringify(activeAccount));
  }, [activeAccount]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activeAccount && (!user || user.email !== activeAccount.email)) {
      signInWithEmailAndPassword(auth, activeAccount.email, activeAccount.pass).catch(console.error);
    }
  }, [activeAccount, user]);

  const login = async (email: string, pass: string) => {
    if (accounts.length >= 10) throw new Error("Maximum 10 accounts allowed");
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    if (!res.ok) {
      let errorMessage = 'Invalid credentials';
      try {
        const data = await res.json();
        errorMessage = data.error || errorMessage;
      } catch (e) {
        const text = await res.text();
        errorMessage = `Server Error (${res.status}): ${text || 'Empty response'}`;
      }
      throw new Error(errorMessage);
    }
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        await createUserWithEmailAndPassword(auth, email, pass);
      } else {
        throw err;
      }
    }
    const newAcc = { email, pass };
    if (!accounts.find(a => a.email === email)) {
      setAccounts(prev => [...prev, newAcc]);
    }
    setActiveAccount(newAcc);
  };

  const switchAccount = async (email: string) => {
    const acc = accounts.find(a => a.email === email);
    if (acc) {
      await signInWithEmailAndPassword(auth, acc.email, acc.pass);
      setActiveAccount(acc);
    }
  };

  const logoutAccount = (email: string) => {
    const newAccounts = accounts.filter(a => a.email !== email);
    setAccounts(newAccounts);
    if (activeAccount?.email === email) {
      if (newAccounts.length > 0) {
        switchAccount(newAccounts[0].email);
      } else {
        setActiveAccount(null);
        auth.signOut();
      }
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  const isUserMatching = activeAccount && user && user.email === activeAccount.email;

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <AuthContext.Provider value={{ user, activeAccount, accounts, login, switchAccount, logoutAccount }}>
        {activeAccount ? (
          isUserMatching ? <MainApp key={activeAccount.email} onLogout={() => logoutAccount(activeAccount.email)} /> : <div className={cn("h-screen flex items-center justify-center", theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900')}>Switching account...</div>
        ) : <Login />}
      </AuthContext.Provider>
    </ThemeContext.Provider>
  );
}


