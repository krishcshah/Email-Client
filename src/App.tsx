import React, { useState, useEffect, createContext, useContext } from 'react';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore';
import { Mail, Send, File, Trash2, Search, Menu, Plus, RefreshCw, ChevronLeft, ChevronRight, User as UserIcon, X, Star, MailOpen, Folder, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './lib/utils';

// --- Types ---
type Email = {
  id: string;
  uid: number;
  folder: string;
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

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  activeAccount: null, 
  accounts: [], 
  login: async () => {}, 
  switchAccount: async () => {}, 
  logoutAccount: () => {} 
});

// --- Components ---

function Login({ onCancel }: { onCancel?: () => void }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    <div className={cn("bg-gray-100 flex items-center justify-center p-4", onCancel ? "absolute inset-0 z-50 bg-black/50" : "min-h-screen")}>
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md relative">
        {onCancel && (
          <button onClick={onCancel} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        )}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-semibold text-center mb-2">Sign in</h1>
        <p className="text-center text-gray-500 mb-8">to continue to BMI Mail</p>
        
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              required
              placeholder="Email or phone"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <input
              type="password"
              required
              placeholder="Enter your password"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-70 flex justify-center"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Next'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ComposeModal({ onClose, initialTo = '', initialSubject = '' }: { onClose: () => void, initialTo?: string, initialSubject?: string }) {
  const { user, activeAccount } = useContext(AuthContext);
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

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
      formData.append('subject', subject);
      formData.append('text', body);
      formData.append('html', body.replace(/\n/g, '<br/>'));
      
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      const res = await fetch('/api/send', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to send');
      onClose();
    } catch (err) {
      alert('Error sending email');
    } finally {
      setSending(false);
    }
  };

  const handleCloseCompose = async () => {
    if ((to || subject || body || attachments.length > 0) && activeAccount) {
      const formData = new FormData();
      formData.append('email', activeAccount.email);
      formData.append('password', activeAccount.pass);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('text', body);
      formData.append('html', body.replace(/\n/g, '<br/>'));
      attachments.forEach(file => formData.append('attachments', file));
      
      fetch('/api/draft', {
        method: 'POST',
        body: formData
      }).catch(console.error);
    }
    onClose();
  };

  return (
    <div className="fixed bottom-0 right-24 w-[500px] bg-white rounded-t-xl shadow-2xl border border-gray-200 flex flex-col z-50">
      <div className="bg-gray-800 text-white px-4 py-3 rounded-t-xl flex justify-between items-center">
        <span className="font-medium text-sm">New Message</span>
        <button onClick={handleCloseCompose} className="hover:bg-gray-700 p-1 rounded"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSend} className="flex flex-col flex-1">
        <input
          type="text"
          placeholder="To"
          required
          className="border-b border-gray-100 px-4 py-2 outline-none text-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <input
          type="text"
          placeholder="Subject"
          className="border-b border-gray-100 px-4 py-2 outline-none text-sm font-medium"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <textarea
          className="flex-1 p-4 outline-none resize-none text-sm min-h-[300px]"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {attachments.length > 0 && (
          <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-gray-100">
            {attachments.map((att, i) => (
              <div key={i} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded flex items-center gap-1">
                <File className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{att.name}</span>
                <button type="button" onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="hover:text-red-500 ml-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="p-3 border-t border-gray-100 flex items-center justify-between">
          <button
            type="submit"
            disabled={sending || !to}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-medium text-sm transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
          <label className="cursor-pointer p-2 hover:bg-gray-100 rounded-full">
            <input type="file" multiple className="hidden" onChange={handleFileChange} />
            <File className="w-5 h-5 text-gray-600" />
          </label>
        </div>
      </form>
    </div>
  );
}

function MainApp() {
  const { user, activeAccount, accounts, switchAccount, logoutAccount } = useContext(AuthContext);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedFolder, setSelectedFolder] = useState('INBOX');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [replyData, setReplyData] = useState<{to: string, subject: string} | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [logoutConfirmAccount, setLogoutConfirmAccount] = useState<string | null>(null);

  // Listen to Firestore
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/emails`), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => doc.data() as Email);
      setEmails(data);
    });
    return () => unsub();
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
        // Save to Firestore
        for (const email of data.emails) {
          const emailData = { ...email, userId: user.uid };
          await setDoc(doc(db, `users/${user.uid}/emails`, email.id), emailData, { merge: true });
        }
      }
    } catch (err) {
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
    
    await setDoc(emailRef, updates, { merge: true });

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
    await setDoc(emailRef, { folder: destination }, { merge: true });
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
    }
  }, [activeAccount, user]);

  const unreadInboxCount = emails.filter(e => e.folder.toUpperCase() === 'INBOX' && !e.read && !e.localDeleted).length;
  const draftsCount = emails.filter(e => e.folder.toUpperCase() === 'DRAFTS' && !e.localDeleted).length;
  const updatesCount = emails.filter(e => e.folder.toUpperCase() === 'UPDATES' && !e.read && !e.localDeleted).length;

  const folders = [
    { id: 'INBOX', name: 'Inbox', icon: Mail, count: unreadInboxCount },
    { id: 'Updates', name: 'Updates', icon: Bell, count: updatesCount },
    { id: 'Sent', name: 'Sent', icon: Send },
    { id: 'Drafts', name: 'Drafts', icon: File, count: draftsCount },
    { id: 'Trash', name: 'Trash', icon: Trash2 },
  ];

  const filteredEmails = emails.filter(e => {
    const matchesSearch = e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.snippet.toLowerCase().includes(searchQuery.toLowerCase());
                          
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
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-gray-200 flex items-center px-4 justify-between bg-white shrink-0">
        <div className="flex items-center gap-4 w-64">
          <button className="p-2 hover:bg-gray-100 rounded-full"><Menu className="w-5 h-5 text-gray-600" /></button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-medium text-gray-600 tracking-tight">BMI Mail</span>
          </div>
        </div>
        
        <div className="flex-1 max-w-2xl px-8">
          <div className="bg-gray-100 rounded-full flex items-center px-4 py-2 focus-within:bg-white focus-within:shadow-md focus-within:ring-1 focus-within:ring-gray-200 transition-all">
            <Search className="w-5 h-5 text-gray-500 mr-3" />
            <input 
              type="text" 
              placeholder="Search mail" 
              className="bg-transparent border-none outline-none w-full text-gray-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 w-64 justify-end relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)} 
            className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-medium hover:ring-2 hover:ring-purple-300 transition-all"
          >
            {activeAccount?.email?.[0].toUpperCase()}
          </button>

          {showProfileMenu && (
            <div className="absolute top-10 right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2">
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Current account</div>
                <div className="font-medium text-sm truncate">{activeAccount?.email}</div>
              </div>
              
              <div className="max-h-64 overflow-y-auto py-2">
                {accounts.map(acc => (
                  <div key={acc.email} className="px-2 py-1 flex items-center justify-between group">
                    <button 
                      onClick={() => { switchAccount(acc.email); setShowProfileMenu(false); }}
                      className={cn(
                        "flex-1 text-left flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 truncate",
                        acc.email === activeAccount?.email ? "bg-blue-50/50" : ""
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {acc.email[0].toUpperCase()}
                      </div>
                      <span className={cn("text-sm truncate", acc.email === activeAccount?.email ? "font-bold text-blue-700" : "text-gray-700")}>
                        {acc.email}
                      </span>
                    </button>
                    <button 
                      onClick={() => { setLogoutConfirmAccount(acc.email); setShowProfileMenu(false); }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all ml-1"
                      title="Log out"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-100 p-2 mt-1">
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
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add another account
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 p-3 flex flex-col gap-1 border-r border-gray-100 bg-white">
          <button 
            onClick={() => {
              setReplyData(null);
              setIsComposing(true);
            }}
            className="bg-[#c2e7ff] hover:bg-[#b5dfff] text-[#001d35] flex items-center gap-4 px-4 py-4 rounded-2xl font-medium mb-4 w-fit transition-colors shadow-sm"
          >
            <Plus className="w-6 h-6" />
            Compose
          </button>
          
          <div className="flex flex-col gap-1">
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedFolder(f.id);
                  setSelectedEmail(null);
                  syncEmails(f.id);
                }}
                className={cn(
                  "flex items-center justify-between px-6 py-2 rounded-r-full font-medium text-sm transition-colors",
                  selectedFolder === f.id 
                    ? "bg-[#d3e3fd] text-[#0b57d0]" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <div className="flex items-center gap-4">
                  <f.icon className="w-4 h-4" />
                  {f.name}
                </div>
                {f.count !== undefined && f.count > 0 && (
                  <span className="text-xs font-bold">{f.count}</span>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          <div className="h-12 border-b border-gray-100 flex items-center px-4 justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={() => syncEmails(selectedFolder)} className="p-2 hover:bg-gray-100 rounded-full" disabled={syncing}>
                <RefreshCw className={cn("w-4 h-4 text-gray-600", syncing && "animate-spin")} />
              </button>
            </div>
            <div className="text-xs text-gray-500 font-medium">
              {filteredEmails.length} messages
            </div>
          </div>

          {selectedEmail ? (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="flex items-center justify-between mb-6">
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className="p-2 hover:bg-gray-100 rounded-full inline-flex"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      const prev = filteredEmails[currentIndex - 1];
                      setSelectedEmail(prev);
                      if (!prev.read) handleMark(prev, 'read');
                    }}
                    disabled={!hasPrev}
                    className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <button 
                    onClick={() => {
                      const next = filteredEmails[currentIndex + 1];
                      setSelectedEmail(next);
                      if (!next.read) handleMark(next, 'read');
                    }}
                    disabled={!hasNext}
                    className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
              <h2 className="text-2xl font-normal text-gray-900 mb-6">{selectedEmail.subject}</h2>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg">
                    {selectedEmail.from[0]?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="font-medium text-sm text-gray-900">{selectedEmail.from}</div>
                    <div className="text-xs text-gray-500">to {selectedEmail.to}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-gray-500">
                    {format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleMark(selectedEmail, selectedEmail.starred ? 'unstar' : 'star')}
                      className="p-2 hover:bg-gray-100 rounded-full"
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
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-full transition-colors"
                    >
                      Reply
                    </button>
                    <div className="relative group">
                      <button className="p-2 hover:bg-gray-100 rounded-full" title="Move to folder">
                        <Folder className="w-5 h-5 text-gray-600" />
                      </button>
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 hidden group-hover:block z-50 py-1">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Move to</div>
                        {folders.filter(f => f.id !== selectedEmail.folder).map(f => (
                          <button 
                            key={f.id} 
                            onClick={() => handleMove(selectedEmail, f.id)} 
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <f.icon className="w-4 h-4 text-gray-400" />
                            {f.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div 
                className="prose max-w-none text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  {syncing ? 'Loading...' : 'No messages in this folder.'}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredEmails.map(email => (
                    <div 
                      key={email.id}
                      onClick={() => {
                        setSelectedEmail(email);
                        if (!email.read) handleMark(email, 'read');
                      }}
                      className={cn(
                        "flex items-center px-4 py-2 cursor-pointer hover:shadow-md transition-shadow group border-b border-gray-100 relative",
                        !email.read ? "bg-white font-bold" : "bg-gray-50/50 text-gray-600"
                      )}
                    >
                      <div className="flex items-center gap-2 w-48 pr-4">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleMark(email, email.starred ? 'unstar' : 'star'); }}
                          className="p-1 hover:bg-gray-200 rounded-full"
                        >
                          <Star className={cn("w-4 h-4", email.starred ? "fill-yellow-400 text-yellow-400" : "text-gray-400")} />
                        </button>
                        <div className="truncate text-sm">
                          {email.from.split('<')[0].trim() || email.from}
                        </div>
                      </div>
                      <div className="flex-1 truncate text-sm">
                        <span className={cn("mr-2", !email.read ? "text-gray-900" : "text-gray-700")}>
                          {email.subject || '(No Subject)'}
                        </span>
                        <span className="text-gray-500 font-normal">
                          - {email.snippet}
                        </span>
                      </div>
                      <div className="w-24 text-right text-xs font-medium pl-4 group-hover:hidden">
                        {format(new Date(email.date), 'MMM d')}
                      </div>
                      
                      {/* Hover Actions */}
                      <div className="hidden group-hover:flex items-center gap-2 absolute right-4 bg-white/90 px-2 py-1 rounded shadow-sm">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleMark(email, email.read ? 'unread' : 'read'); }}
                          className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600"
                          title={email.read ? "Mark as unread" : "Mark as read"}
                        >
                          {email.read ? <Mail className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                        </button>
                        {email.localDeleted ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMark(email, 'restore'); }}
                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600"
                            title="Restore"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleMark(email, 'delete'); }}
                            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-600"
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
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm Logout</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to log out of <span className="font-medium text-gray-900">{logoutConfirmAccount}</span>?</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setLogoutConfirmAccount(null)} 
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
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
      const data = await res.json();
      throw new Error(data.error || 'Invalid credentials');
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

  return (
    <AuthContext.Provider value={{ user, activeAccount, accounts, login, switchAccount, logoutAccount }}>
      {activeAccount ? <MainApp /> : <Login />}
    </AuthContext.Provider>
  );
}

