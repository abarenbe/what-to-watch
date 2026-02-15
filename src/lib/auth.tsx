'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface Profile {
    id: string
    display_name: string | null
    avatar_url: string | null
    active_group_id: string | null
}

export interface Group {
    id: string
    name: string
    invite_code: string
}

export interface GroupMembership {
    group: Group
    role: 'owner' | 'member'
    joined_at: string
}

interface AuthContextType {
    user: User | null
    session: Session | null
    profile: Profile | null
    groups: GroupMembership[]         // All groups user belongs to
    activeGroup: Group | null         // Currently selected group
    loading: boolean
    signUp: (email: string, password: string) => Promise<{ error: string | null }>
    signIn: (email: string, password: string) => Promise<{ error: string | null }>
    signInWithGoogle: () => Promise<{ error: string | null }>
    signOut: () => Promise<void>
    updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>
    createGroup: (name: string) => Promise<{ group: Group | null, error: string | null }>
    joinGroup: (inviteCode: string) => Promise<{ error: string | null }>
    leaveGroup: (groupId: string) => Promise<{ error: string | null }>
    switchGroup: (groupId: string) => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}

function generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [profile, setProfile] = useState<Profile | null>(null)
    const [groups, setGroups] = useState<GroupMembership[]>([])
    const [activeGroup, setActiveGroup] = useState<Group | null>(null)
    const [loading, setLoading] = useState(true)

    // Fetch profile
    const fetchProfile = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()

        if (error && error.code === 'PGRST116') {
            // Profile not found — create one (fallback if trigger didn't fire)
            const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({ id: userId })
                .select()
                .single()

            if (!insertError && newProfile) {
                setProfile(newProfile)
                return newProfile
            }
        } else if (data) {
            setProfile(data)
            return data
        }
        return null
    }, [])

    // Fetch all groups user belongs to
    const fetchGroups = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from('group_members')
            .select(`
                role,
                joined_at,
                group:groups (id, name, invite_code)
            `)
            .eq('user_id', userId)

        if (error) {
            console.error('Failed to fetch groups:', error)
            setGroups([])
            return []
        }

        const memberships: GroupMembership[] = (data || [])
            .filter((d: Record<string, unknown>) => d.group)
            .map((d: Record<string, unknown>) => ({
                group: d.group as unknown as Group,
                role: d.role as 'owner' | 'member',
                joined_at: d.joined_at as string,
            }))

        setGroups(memberships)
        return memberships
    }, [])

    // Set active group from profile preference or first available
    const resolveActiveGroup = useCallback((prof: Profile | null, memberships: GroupMembership[]) => {
        if (memberships.length === 0) {
            setActiveGroup(null)
            return
        }

        // Try to use the profile's saved active group
        if (prof?.active_group_id) {
            const saved = memberships.find(m => m.group.id === prof.active_group_id)
            if (saved) {
                setActiveGroup(saved.group)
                return
            }
        }

        // Default to first group
        setActiveGroup(memberships[0].group)
    }, [])

    // Initialize auth
    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession()
                setSession(currentSession)
                setUser(currentSession?.user ?? null)

                if (currentSession?.user) {
                    const p = await fetchProfile(currentSession.user.id)
                    const g = await fetchGroups(currentSession.user.id)
                    resolveActiveGroup(p, g)
                }
            } catch (err) {
                console.error('Auth init error:', err)
            } finally {
                setLoading(false)
            }
        }
        init()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            setSession(newSession)
            setUser(newSession?.user ?? null)

            if (newSession?.user) {
                const p = await fetchProfile(newSession.user.id)
                const g = await fetchGroups(newSession.user.id)
                resolveActiveGroup(p, g)
            } else {
                setProfile(null)
                setGroups([])
                setActiveGroup(null)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [fetchProfile, fetchGroups, resolveActiveGroup])

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin }
        })
        return { error: error?.message ?? null }
    }

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
    }

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin }
        })
        return { error: error?.message ?? null }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
        setGroups([])
        setActiveGroup(null)
    }

    const updateProfile = async (updates: Partial<Profile>) => {
        if (!user) return { error: 'Not authenticated' }
        const { error } = await supabase
            .from('profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id)

        if (!error) {
            setProfile(prev => prev ? { ...prev, ...updates } : null)
        }
        return { error: error?.message ?? null }
    }

    const createGroup = async (name: string) => {
        if (!user) return { group: null, error: 'Not authenticated' }

        const invite_code = generateInviteCode()
        const { data, error } = await supabase
            .from('groups')
            .insert({ name, invite_code, created_by: user.id })
            .select()
            .single()

        if (error) return { group: null, error: error.message }

        // Add user as owner member
        const { error: memberError } = await supabase
            .from('group_members')
            .insert({ user_id: user.id, group_id: data.id, role: 'owner' })

        if (memberError) return { group: null, error: memberError.message }

        // Set as active group
        await supabase
            .from('profiles')
            .update({ active_group_id: data.id, updated_at: new Date().toISOString() })
            .eq('id', user.id)

        const newMembership: GroupMembership = {
            group: data,
            role: 'owner',
            joined_at: new Date().toISOString(),
        }
        setGroups(prev => [...prev, newMembership])
        setActiveGroup(data)
        setProfile(prev => prev ? { ...prev, active_group_id: data.id } : null)

        return { group: data, error: null }
    }

    const joinGroup = async (inviteCode: string) => {
        if (!user) return { error: 'Not authenticated' }

        const { data: foundGroup, error: lookupError } = await supabase
            .from('groups')
            .select('*')
            .eq('invite_code', inviteCode.toUpperCase().trim())
            .single()

        if (lookupError || !foundGroup) {
            return { error: 'Invalid invite code. Check the code and try again.' }
        }

        // Check if already a member
        const { data: existing } = await supabase
            .from('group_members')
            .select('id')
            .eq('user_id', user.id)
            .eq('group_id', foundGroup.id)
            .single()

        if (existing) {
            return { error: 'You\'re already a member of this group!' }
        }

        const { error: joinError } = await supabase
            .from('group_members')
            .insert({ user_id: user.id, group_id: foundGroup.id, role: 'member' })

        if (joinError) return { error: joinError.message }

        // Set as active group
        await supabase
            .from('profiles')
            .update({ active_group_id: foundGroup.id, updated_at: new Date().toISOString() })
            .eq('id', user.id)

        const newMembership: GroupMembership = {
            group: foundGroup,
            role: 'member',
            joined_at: new Date().toISOString(),
        }
        setGroups(prev => [...prev, newMembership])
        setActiveGroup(foundGroup)
        setProfile(prev => prev ? { ...prev, active_group_id: foundGroup.id } : null)

        return { error: null }
    }

    const leaveGroup = async (groupId: string) => {
        if (!user) return { error: 'Not authenticated' }
        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('user_id', user.id)
            .eq('group_id', groupId)

        if (!error) {
            setGroups(prev => prev.filter(m => m.group.id !== groupId))
            // If leaving the active group, switch to another
            if (activeGroup?.id === groupId) {
                const remaining = groups.filter(m => m.group.id !== groupId)
                if (remaining.length > 0) {
                    setActiveGroup(remaining[0].group)
                    await supabase
                        .from('profiles')
                        .update({ active_group_id: remaining[0].group.id })
                        .eq('id', user.id)
                } else {
                    setActiveGroup(null)
                    await supabase
                        .from('profiles')
                        .update({ active_group_id: null })
                        .eq('id', user.id)
                }
            }
        }
        return { error: error?.message ?? null }
    }

    const switchGroup = async (groupId: string) => {
        const membership = groups.find(m => m.group.id === groupId)
        if (!membership) return

        setActiveGroup(membership.group)
        setProfile(prev => prev ? { ...prev, active_group_id: groupId } : null)

        if (user) {
            await supabase
                .from('profiles')
                .update({ active_group_id: groupId, updated_at: new Date().toISOString() })
                .eq('id', user.id)
        }
    }

    const refreshProfile = async () => {
        if (user) {
            const p = await fetchProfile(user.id)
            const g = await fetchGroups(user.id)
            resolveActiveGroup(p, g)
        }
    }

    return (
        <AuthContext.Provider value={{
            user, session, profile, groups, activeGroup, loading,
            signUp, signIn, signInWithGoogle, signOut,
            updateProfile, createGroup, joinGroup, leaveGroup, switchGroup, refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    )
}
