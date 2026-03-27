const fs = require('fs');

const loginReplacer = `
function Login({ onCancel }: { onCancel?: () => void }) {
  const { login } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { theme, toggleTheme } = useContext(ThemeContext);
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

function MainApp({ onLogout }: { onLogout: () => void }) {
`;

const file = 'src/App.tsx';
let c = fs.readFileSync(file, 'utf8');
const sIdx = c.indexOf('function Login({ onCancel');
const eIdx = c.indexOf('function MainApp');

if (sIdx !== -1 && eIdx !== -1) {
    const p1 = c.substring(0, sIdx);
    const p2 = c.substring(eIdx + 'function MainApp'.length);

    fs.writeFileSync(file, p1 + loginReplacer + p2);
    console.log("Success");
} else {
    console.log("Failed");
}
