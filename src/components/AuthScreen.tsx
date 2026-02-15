'use client'

import React, { useState } from 'react'
import { Film, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import styles from './AuthScreen.module.css'

export function AuthScreen() {
    const { signIn, signUp, signInWithGoogle } = useAuth()
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        if (!email || !password) {
            setError('Please enter both email and password.')
            return
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.')
            return
        }

        setLoading(true)
        try {
            if (mode === 'login') {
                const { error: loginError } = await signIn(email, password)
                if (loginError) setError(loginError)
            } else {
                const { error: signupError } = await signUp(email, password)
                if (signupError) {
                    setError(signupError)
                } else {
                    setSuccess('Account created! Check your email to confirm, or sign in if email confirmation is disabled.')
                    const { error: autoLoginError } = await signIn(email, password)
                    if (autoLoginError) {
                        // Might need email confirmation first — that's fine
                    }
                }
            }
        } catch {
            setError('Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true)
        setError(null)
        const { error: googleError } = await signInWithGoogle()
        if (googleError) {
            setError(googleError)
        }
        setGoogleLoading(false)
    }

    return (
        <div className={styles.container}>
            <div className={styles.backdrop} />
            <div className={styles.content}>
                {/* Logo */}
                <div className={styles.logoSection}>
                    <div className={styles.iconCircle}>
                        <Film className="w-10 h-10 text-white" />
                    </div>
                    <h1 className={styles.title}>WATCH</h1>
                    <p className={styles.subtitle}>Find shows your whole family will love</p>
                </div>

                {/* Google Sign In */}
                <button
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading}
                    className={styles.googleBtn}
                >
                    {googleLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    )}
                    <span>Continue with Google</span>
                </button>

                <div className={styles.divider}>
                    <span className={styles.dividerLine} />
                    <span className={styles.dividerText}>or</span>
                    <span className={styles.dividerLine} />
                </div>

                {/* Auth Form */}
                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.inputGroup}>
                        <Mail className={`w-5 h-5 ${styles.inputIcon}`} />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                            autoComplete="email"
                        />
                    </div>

                    <div className={styles.inputGroup}>
                        <Lock className={`w-5 h-5 ${styles.inputIcon}`} />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={styles.eyeBtn}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    {error && <div className={styles.error}>{error}</div>}
                    {success && <div className={styles.success}>{success}</div>}

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            mode === 'login' ? 'Sign In' : 'Create Account'
                        )}
                    </button>
                </form>

                <div className={styles.switchMode}>
                    <span className={styles.switchText}>
                        {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                    </span>
                    <button
                        onClick={() => {
                            setMode(mode === 'login' ? 'signup' : 'login')
                            setError(null)
                            setSuccess(null)
                        }}
                        className={styles.switchBtn}
                    >
                        {mode === 'login' ? 'Sign Up' : 'Sign In'}
                    </button>
                </div>
            </div>
        </div>
    )
}
