
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Loader2, Mail, Lock, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react';
import GlitchLogo from './GlitchLogo';

const LoginPage: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                setMessage('Signup successful! You can now log in.');
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                 <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-600/10 rounded-full blur-[100px]"></div>
                 <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px]"></div>
            </div>

            {/* Decorative Image - Repositioned on top of the form */}
            <div className="relative z-10 pointer-events-none select-none mb-4">
                 <img 
                    src="https://iili.io/fLQxSN2.png" 
                    alt="AI Visualization" 
                    className="w-[300px] h-[300px] md:w-[450px] md:h-[450px] object-contain opacity-80 mix-blend-screen drop-shadow-[0_0_40px_rgba(234,88,12,0.3)]"
                 />
            </div>

            <div className="w-full max-w-md bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-8 z-10 animate-fadeIn relative">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-48 mb-6">
                        <GlitchLogo />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p className="text-zinc-400 text-sm mt-2">
                        {isSignUp ? 'Join the Velosi AI Agent Platform' : 'Sign in to access your VELOSI AI Agents'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}
                
                {message && (
                    <div className="mb-6 p-3 bg-green-900/20 border border-green-900/50 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" /> {message}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-5 h-5 text-zinc-600" />
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white outline-none focus:border-orange-500 transition-all placeholder-zinc-700"
                                placeholder="name@company.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-zinc-600" />
                            <input 
                                type="password" 
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white outline-none focus:border-orange-500 transition-all placeholder-zinc-700"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                        {isSignUp ? 'Sign Up' : 'Log In'}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-sm text-zinc-500 hover:text-white transition-colors"
                    >
                        {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
            
            <div className="mt-8 text-zinc-600 text-xs relative z-10">
                © {new Date().getFullYear()} Velosi Certification. All rights reserved.
            </div>
        </div>
    );
};

export default LoginPage;
