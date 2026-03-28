function ComposeModal({ onClose, initialTo = '', initialSubject = '' }: { onClose: () => void, initialTo?: string, initialSubject?: string }) {
  const { user, activeAccount } = useContext(AuthContext);
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [draftUid, setDraftUid] = useState<string | null>(null);

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
      formData.append('text', body);
      formData.append('html', body.replace(/\n/g, '<br/>'));
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
      formData.append('text', body);
      formData.append('html', body.replace(/\n/g, '<br/>'));
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
      formData.append('text', body);
      formData.append('html', body.replace(/\n/g, '<br/>'));
      if (draftUid) formData.append('previousUid', draftUid);
      attachments.forEach(file => formData.append('attachments', file));
      
      // Fire and forget
      fetch('/api/draft', { method: 'POST', body: formData }).catch(console.error);
    }
    onClose();
  };

  return (
    <div className={cn("fixed bottom-0 right-24 w-[500px] rounded-t-xl shadow-2xl border flex flex-col z-50", document.documentElement.classList.contains('dark') ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200')}>
      <div className="bg-gray-800 text-white px-4 py-3 rounded-t-xl flex justify-between items-center">
        <span className="font-medium text-sm">New Message</span>
        <button onClick={handleCloseCompose} className="hover:bg-gray-700 p-1 rounded"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSend} className="flex flex-col flex-1">
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
        <textarea
          className={cn("flex-1 p-4 outline-none resize-none text-sm min-h-[300px]", document.documentElement.classList.contains('dark') ? 'bg-gray-900 text-gray-100 placeholder-gray-500' : 'bg-white text-gray-900')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
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

