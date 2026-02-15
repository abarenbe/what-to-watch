/**
 * Match Logic for WhatToWatch
 * 
 * Scores:
 * Up (WATCH)    = 3
 * Right (SOCIAL) = 2
 * Down (MAYBE)   = 1
 * Left (NOPE)    = 0
 * 
 * Rules:
 * 1. Match exists ONLY if everyone swiped > 0.
 * 2. Match exists ONLY if at least one person swiped >= 2.
 * 3. Priority = sum of scores.
 */

export type SwipeScore = 0 | 1 | 2 | 3;
export type SwipeDirection = 'up' | 'right' | 'down' | 'left';

export const DIRECTION_TO_SCORE: Record<SwipeDirection, SwipeScore> = {
    up: 3,    // WATCH
    right: 2, // SOCIAL
    down: 1,  // MAYBE
    left: 0   // NOPE
};

export interface UserSwipe {
    userId: string;
    score: SwipeScore;
}

export function calculateMatchScore(swipes: UserSwipe[], totalFamilyMembers: number) {
    // If not everyone has swiped yet, it's not a full match calculation
    if (swipes.length < totalFamilyMembers) return null;

    const scores = swipes.map(s => s.score);

    // Rule 1: Everyone must be above 0 (No "NOPE"s allowed)
    const everyoneLikes = scores.every(score => score > 0);
    if (!everyoneLikes) return null;

    // Rule 2: At least one person is 2 or greater (Someone really wants to watch/socialize)
    const someoneActive = scores.some(score => score >= 2);
    if (!someoneActive) return null;

    // Rule 3: Rank by sum
    const totalScore = scores.reduce((sum: number, score) => sum + score, 0 as number);

    return totalScore;
}
