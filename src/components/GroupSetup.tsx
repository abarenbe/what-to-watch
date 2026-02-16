'use client'

import React, { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { Users, Plus, LogIn, Copy, Check, Loader2, User, LogOut, ChevronRight, Crown, Trash2 } from 'lucide-react'
import styles from './GroupSetup.module.css'

import { ServiceSelection } from './ServiceSelection'

// This component handles two scenarios:
// 1. Initial setup (no groups yet) — set display name then create/join
// 2. Group management — shown in the "Family" tab of the main app

interface GroupSetupProps {
    mode?: 'setup' | 'manage'
    onComplete?: () => void
}

export function GroupSetup({ mode = 'setup', onComplete }: GroupSetupProps) {
    const {
        user, profile, groups, activeGroup,
        updateProfile, createGroup, joinGroup, leaveGroup, switchGroup, signOut
    } = useAuth()

    const needsName = !profile?.display_name
    const containerClass = mode === 'manage' ? styles.containerInline : styles.container
    const [step, setStep] = useState<'name' | 'choice' | 'create' | 'join' | 'services' | 'manage'>(
        mode === 'manage' ? 'manage' : (needsName ? 'name' : 'choice')
    )
    const [displayName, setDisplayName] = useState(profile?.display_name || '')
    const [groupName, setGroupName] = useState('')
    const [inviteCode, setInviteCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [copied, setCopied] = useState<string | null>(null) // group id that was copied
    const [createdGroup, setCreatedGroup] = useState<{ name: string, invite_code: string, id: string } | null>(null)
    const [confirmLeave, setConfirmLeave] = useState<string | null>(null)

    const handleSetName = async () => {
        if (!displayName.trim()) {
            setError('Please enter your name')
            return
        }
        setLoading(true)
        setError(null)
        const { error: updateError } = await updateProfile({ display_name: displayName.trim() })
        if (updateError) {
            setError(updateError)
        } else {
            setStep(groups.length > 0 ? 'manage' : 'choice')
        }
        setLoading(false)
    }

    const handleCreateGroup = async () => {
        if (!groupName.trim()) {
            setError('Please enter a group name')
            return
        }
        setLoading(true)
        setError(null)
        const { group: newGroup, error: createError } = await createGroup(groupName.trim())
        if (createError) {
            setError(createError)
        } else if (newGroup) {
            setCreatedGroup(newGroup)
            setGroupName('')
        }
        setLoading(false)
    }

    const handleJoinGroup = async () => {
        if (!inviteCode.trim()) {
            setError('Please enter the invite code')
            return
        }
        setLoading(true)
        setError(null)
        const { group: joinedGroup, error: joinError } = await joinGroup(inviteCode.trim())
        if (joinError) {
            setError(joinError)
        } else if (joinedGroup) {
            // Check if group already has providers
            const { data: providers } = await supabase
                .from('group_providers')
                .select('id')
                .eq('group_id', joinedGroup.id)
                .limit(1)

            setInviteCode('')

            if (providers && providers.length > 0) {
                // Group already has services, skip to complete
                if (mode === 'setup' && onComplete) {
                    onComplete()
                } else {
                    setStep('manage')
                }
            } else {
                setStep('services')
            }
        }
        setLoading(false)
    }

    const handleLeaveGroup = async (groupId: string) => {
        setLoading(true)
        await leaveGroup(groupId)
        setConfirmLeave(null)
        setLoading(false)
    }

    const copyInviteCode = async (code: string, groupId: string) => {
        await navigator.clipboard.writeText(code)
        setCopied(groupId)
        setTimeout(() => setCopied(null), 2000)
    }

    // ── Success screen after creating ──
    if (createdGroup) {
        return (
            <div className={containerClass}>
                <div className={styles.card}>
                    <div className={styles.iconCircle}>
                        <Check className="w-8 h-8 text-white" />
                    </div>
                    <h2 className={styles.heading}>Group Created!</h2>
                    <p className={styles.subtext}>
                        Share this invite code with your family or friends:
                    </p>
                    <div className={styles.codeDisplay}>
                        <span className={styles.code}>{createdGroup.invite_code}</span>
                        <button onClick={() => copyInviteCode(createdGroup.invite_code, createdGroup.id)} className={styles.copyBtn}>
                            {copied === createdGroup.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied === createdGroup.id ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <p className={styles.hint}>
                        They&apos;ll enter this code after signing up.
                    </p>
                    <button
                        onClick={() => { setCreatedGroup(null); setStep('services') }}
                        className={styles.primaryBtn}
                    >
                        {groups.length > 1 ? 'Manage Groups' : 'Get Started'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className={containerClass}>
            <div className={styles.card}>
                {/* ── Step: Set display name ── */}
                {step === 'name' && (
                    <>
                        <div className={styles.iconCircle}>
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <h2 className={styles.heading}>What&apos;s your name?</h2>
                        <p className={styles.subtext}>
                            This is how others in your groups will see you.
                        </p>
                        <div className={styles.inputWrap}>
                            <input
                                type="text"
                                placeholder="e.g. Dad, Mom, Alex..."
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                className={styles.input}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleSetName()}
                            />
                        </div>
                        {error && <div className={styles.error}>{error}</div>}
                        <button onClick={handleSetName} disabled={loading} className={styles.primaryBtn}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
                        </button>
                    </>
                )}

                {/* ── Step: Create or Join (first group) ── */}
                {step === 'choice' && (
                    <>
                        <div className={styles.iconCircle}>
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        <h2 className={styles.heading}>
                            Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
                        </h2>
                        <p className={styles.subtext}>
                            Create a group for your family, friends, or anyone you want to find shows with.
                        </p>
                        <div className={styles.choiceButtons}>
                            <button onClick={() => { setStep('create'); setError(null) }} className={styles.choiceBtn}>
                                <Plus className="w-5 h-5" />
                                <span className={styles.choiceBtnLabel}>Create a Group</span>
                                <span className={styles.choiceBtnSub}>Start fresh — invite others with a code</span>
                            </button>
                            <button onClick={() => { setStep('join'); setError(null) }} className={styles.choiceBtn}>
                                <LogIn className="w-5 h-5" />
                                <span className={styles.choiceBtnLabel}>Join a Group</span>
                                <span className={styles.choiceBtnSub}>Got an invite code? Enter it here</span>
                            </button>
                        </div>
                    </>
                )}

                {/* ── Step: Create group ── */}
                {step === 'create' && (
                    <>
                        <div className={styles.iconCircle}>
                            <Plus className="w-8 h-8 text-white" />
                        </div>
                        <h2 className={styles.heading}>Name Your Group</h2>
                        <p className={styles.subtext}>
                            Give it a name everyone will recognize.
                        </p>
                        <div className={styles.inputWrap}>
                            <input
                                type="text"
                                placeholder='e.g. "The Barenbergs" or "Movie Night Crew"'
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className={styles.input}
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                            />
                        </div>
                        {error && <div className={styles.error}>{error}</div>}
                        <button onClick={handleCreateGroup} disabled={loading} className={styles.primaryBtn}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Group'}
                        </button>
                        <button onClick={() => setStep(groups.length > 0 ? 'manage' : 'choice')} className={styles.backBtn}>
                            ← Back
                        </button>
                    </>
                )}

                {/* ── Step: Join group ── */}
                {step === 'join' && (
                    <>
                        <div className={styles.iconCircle}>
                            <LogIn className="w-8 h-8 text-white" />
                        </div>
                        <h2 className={styles.heading}>Join a Group</h2>
                        <p className={styles.subtext}>
                            Enter the 6-character invite code.
                        </p>
                        <div className={styles.inputWrap}>
                            <input
                                type="text"
                                placeholder="e.g. A3X7K2"
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                className={`${styles.input} ${styles.codeInput}`}
                                maxLength={6}
                                autoFocus
                                autoCapitalize="characters"
                                onKeyDown={(e) => e.key === 'Enter' && handleJoinGroup()}
                            />
                        </div>
                        {error && <div className={styles.error}>{error}</div>}
                        <button onClick={handleJoinGroup} disabled={loading} className={styles.primaryBtn}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join Group'}
                        </button>
                        <button onClick={() => setStep(groups.length > 0 ? 'manage' : 'choice')} className={styles.backBtn}>
                            ← Back
                        </button>
                    </>
                )}

                {/* ── Step: Manage groups (multi-group view) ── */}
                {step === 'manage' && (
                    <>
                        <div className={styles.iconCircle}>
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        <h2 className={styles.heading}>Your Groups</h2>
                        <p className={styles.subtext}>
                            Switch between groups or create new ones. Swipes are separate per group.
                        </p>

                        {groups.length > 0 ? (
                            <div className={styles.groupList}>
                                {groups.map(membership => (
                                    <div
                                        key={membership.group.id}
                                        className={`${styles.groupItem} ${activeGroup?.id === membership.group.id ? styles.groupItemActive : ''}`}
                                    >
                                        <button
                                            className={styles.groupItemMain}
                                            onClick={() => switchGroup(membership.group.id)}
                                        >
                                            <div className={styles.groupInfo}>
                                                <span className={styles.groupName}>
                                                    {membership.role === 'owner' && <Crown className="w-3.5 h-3.5 inline-block mr-1" style={{ color: '#f59e0b' }} />}
                                                    {membership.group.name}
                                                </span>
                                                {activeGroup?.id === membership.group.id && (
                                                    <span className={styles.activeBadge}>Active</span>
                                                )}
                                            </div>
                                            <ChevronRight className="w-4 h-4" style={{ color: 'var(--muted)' }} />
                                        </button>
                                        <div className={styles.groupActions}>
                                            <button
                                                className={styles.groupActionBtn}
                                                onClick={() => copyInviteCode(membership.group.invite_code, membership.group.id)}
                                            >
                                                {copied === membership.group.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copied === membership.group.id ? 'Copied!' : membership.group.invite_code}</span>
                                            </button>
                                            {confirmLeave === membership.group.id ? (
                                                <div className={styles.confirmLeave}>
                                                    <span>Leave?</span>
                                                    <button onClick={() => handleLeaveGroup(membership.group.id)} className={styles.confirmYes}>Yes</button>
                                                    <button onClick={() => setConfirmLeave(null)} className={styles.confirmNo}>No</button>
                                                </div>
                                            ) : (
                                                <button
                                                    className={styles.groupActionBtn}
                                                    onClick={() => setConfirmLeave(membership.group.id)}
                                                    style={{ color: '#f87171' }}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>Leave</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className={styles.hint}>You&apos;re not in any groups yet.</p>
                        )}

                        <div className={styles.manageActions}>
                            <button onClick={() => { setStep('create'); setError(null) }} className={styles.outlineBtn}>
                                <Plus className="w-4 h-4" />
                                Create New Group
                            </button>
                            <button onClick={() => { setStep('join'); setError(null) }} className={styles.outlineBtn}>
                                <LogIn className="w-4 h-4" />
                                Join with Code
                            </button>
                            <button onClick={() => setStep('services')} className={styles.outlineBtn}>
                                Streaming Services
                            </button>
                        </div>
                    </>
                )}

                {/* ── Step: Streaming Services ── */}
                {step === 'services' && (
                    <ServiceSelection
                        onComplete={() => {
                            if (mode === 'setup' && onComplete) {
                                onComplete()
                            } else {
                                setStep('manage')
                            }
                        }}
                    />
                )}

                {/* Sign out */}
                <button onClick={signOut} className={styles.signOutBtn}>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out ({user?.email})</span>
                </button>
            </div>
        </div>
    )
}
