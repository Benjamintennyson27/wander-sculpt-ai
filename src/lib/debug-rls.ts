/**
 * RLS Security Debug Utilities
 * Development-only script to verify Row-Level Security policies
 * 
 * These tests confirm that users cannot access other users' data
 */

import { supabase } from "@/integrations/supabase/client";

export interface RLSTestResult {
  testName: string;
  description: string;
  targetId: string | null;
  targetOwner: string | null;
  expectedRows: number;
  actualRows: number;
  passed: boolean;
  error: string | null;
}

export interface RLSTestSummary {
  currentUserId: string | null;
  currentUserEmail: string | null;
  tests: RLSTestResult[];
  allPassed: boolean;
  timestamp: Date;
}

/**
 * Get the current authenticated user
 */
async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Must be authenticated to run RLS tests");
  }
  return user;
}

/**
 * Test 1: Attempt to read another user's trip
 * Expected: Empty result (RLS blocks access)
 */
export async function testCrossUserTripAccess(): Promise<RLSTestResult> {
  const testName = "Cross-User Trip Access";
  const description = "Attempt to read a trip owned by another user";
  
  try {
    const currentUser = await getCurrentUser();
    
    // Query all trips (RLS should filter to only current user's trips)
    const { data: trips, error } = await supabase
      .from("trips")
      .select("id, user_id, destination")
      .neq("user_id", currentUser.id) // Try to get trips NOT owned by current user
      .limit(5);
    
    if (error) {
      return {
        testName,
        description,
        targetId: null,
        targetOwner: "other users",
        expectedRows: 0,
        actualRows: 0,
        passed: true, // Error means RLS blocked it
        error: `Query blocked: ${error.message}`,
      };
    }
    
    // RLS should return empty array even if other trips exist
    const actualRows = trips?.length || 0;
    
    return {
      testName,
      description,
      targetId: "any trip with user_id ≠ current user",
      targetOwner: "other users",
      expectedRows: 0,
      actualRows,
      passed: actualRows === 0,
      error: actualRows > 0 
        ? `SECURITY BREACH: Returned ${actualRows} trips from other users!` 
        : null,
    };
  } catch (err) {
    return {
      testName,
      description,
      targetId: null,
      targetOwner: null,
      expectedRows: 0,
      actualRows: 0,
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Test 2: Attempt to read another user's itineraries
 * Expected: Empty result (RLS blocks via trip ownership check)
 */
export async function testCrossUserItineraryAccess(): Promise<RLSTestResult> {
  const testName = "Cross-User Itinerary Access";
  const description = "Attempt to read itineraries for trips owned by another user";
  
  try {
    const currentUser = await getCurrentUser();
    
    // First get current user's trip IDs
    const { data: myTrips } = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", currentUser.id);
    
    const myTripIds = myTrips?.map(t => t.id) || [];
    
    // Try to get itineraries NOT linked to our trips
    let query = supabase.from("itineraries").select("id, trip_id, title");
    
    if (myTripIds.length > 0) {
      // Exclude our own trips to try to get others
      query = query.not("trip_id", "in", `(${myTripIds.join(",")})`);
    }
    
    const { data: itineraries, error } = await query.limit(5);
    
    if (error) {
      return {
        testName,
        description,
        targetId: null,
        targetOwner: "other users' trips",
        expectedRows: 0,
        actualRows: 0,
        passed: true,
        error: `Query blocked: ${error.message}`,
      };
    }
    
    const actualRows = itineraries?.length || 0;
    
    return {
      testName,
      description,
      targetId: "itineraries for trips with user_id ≠ current user",
      targetOwner: "other users' trips",
      expectedRows: 0,
      actualRows,
      passed: actualRows === 0,
      error: actualRows > 0 
        ? `SECURITY BREACH: Returned ${actualRows} itineraries from other users!` 
        : null,
    };
  } catch (err) {
    return {
      testName,
      description,
      targetId: null,
      targetOwner: null,
      expectedRows: 0,
      actualRows: 0,
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Test 3: Attempt to read another user's profile
 * Expected: Empty result (RLS blocks access)
 */
export async function testCrossUserProfileAccess(): Promise<RLSTestResult> {
  const testName = "Cross-User Profile Access";
  const description = "Attempt to read profile data of another user";
  
  try {
    const currentUser = await getCurrentUser();
    
    // Try to get profiles NOT owned by current user
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, name, home_city")
      .neq("id", currentUser.id)
      .limit(5);
    
    if (error) {
      return {
        testName,
        description,
        targetId: null,
        targetOwner: "other users",
        expectedRows: 0,
        actualRows: 0,
        passed: true,
        error: `Query blocked: ${error.message}`,
      };
    }
    
    const actualRows = profiles?.length || 0;
    
    return {
      testName,
      description,
      targetId: "profiles with id ≠ current user",
      targetOwner: "other users",
      expectedRows: 0,
      actualRows,
      passed: actualRows === 0,
      error: actualRows > 0 
        ? `SECURITY BREACH: Returned ${actualRows} profiles from other users!` 
        : null,
    };
  } catch (err) {
    return {
      testName,
      description,
      targetId: null,
      targetOwner: null,
      expectedRows: 0,
      actualRows: 0,
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Test 4: Attempt to read another user's preferences
 * Expected: Empty result (RLS blocks access)
 */
export async function testCrossUserPreferencesAccess(): Promise<RLSTestResult> {
  const testName = "Cross-User Preferences Access";
  const description = "Attempt to read preferences of another user";
  
  try {
    const currentUser = await getCurrentUser();
    
    const { data: preferences, error } = await supabase
      .from("preferences")
      .select("id, user_id, diet, interests")
      .neq("user_id", currentUser.id)
      .limit(5);
    
    if (error) {
      return {
        testName,
        description,
        targetId: null,
        targetOwner: "other users",
        expectedRows: 0,
        actualRows: 0,
        passed: true,
        error: `Query blocked: ${error.message}`,
      };
    }
    
    const actualRows = preferences?.length || 0;
    
    return {
      testName,
      description,
      targetId: "preferences with user_id ≠ current user",
      targetOwner: "other users",
      expectedRows: 0,
      actualRows,
      passed: actualRows === 0,
      error: actualRows > 0 
        ? `SECURITY BREACH: Returned ${actualRows} preferences from other users!` 
        : null,
    };
  } catch (err) {
    return {
      testName,
      description,
      targetId: null,
      targetOwner: null,
      expectedRows: 0,
      actualRows: 0,
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Test 5: Attempt to read another user's trip messages
 * Expected: Empty result (RLS blocks via trip ownership check)
 */
export async function testCrossUserMessagesAccess(): Promise<RLSTestResult> {
  const testName = "Cross-User Trip Messages Access";
  const description = "Attempt to read messages from another user's trips";
  
  try {
    const currentUser = await getCurrentUser();
    
    // Get current user's trip IDs
    const { data: myTrips } = await supabase
      .from("trips")
      .select("id")
      .eq("user_id", currentUser.id);
    
    const myTripIds = myTrips?.map(t => t.id) || [];
    
    let query = supabase.from("trip_messages").select("id, trip_id, role, content");
    
    if (myTripIds.length > 0) {
      query = query.not("trip_id", "in", `(${myTripIds.join(",")})`);
    }
    
    const { data: messages, error } = await query.limit(5);
    
    if (error) {
      return {
        testName,
        description,
        targetId: null,
        targetOwner: "other users' trips",
        expectedRows: 0,
        actualRows: 0,
        passed: true,
        error: `Query blocked: ${error.message}`,
      };
    }
    
    const actualRows = messages?.length || 0;
    
    return {
      testName,
      description,
      targetId: "messages for trips with user_id ≠ current user",
      targetOwner: "other users' trips",
      expectedRows: 0,
      actualRows,
      passed: actualRows === 0,
      error: actualRows > 0 
        ? `SECURITY BREACH: Returned ${actualRows} messages from other users!` 
        : null,
    };
  } catch (err) {
    return {
      testName,
      description,
      targetId: null,
      targetOwner: null,
      expectedRows: 0,
      actualRows: 0,
      passed: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Run all RLS security tests
 */
export async function runAllRLSTests(): Promise<RLSTestSummary> {
  const currentUser = await getCurrentUser();
  
  const tests = await Promise.all([
    testCrossUserTripAccess(),
    testCrossUserItineraryAccess(),
    testCrossUserProfileAccess(),
    testCrossUserPreferencesAccess(),
    testCrossUserMessagesAccess(),
  ]);
  
  return {
    currentUserId: currentUser.id,
    currentUserEmail: currentUser.email || null,
    tests,
    allPassed: tests.every(t => t.passed),
    timestamp: new Date(),
  };
}
