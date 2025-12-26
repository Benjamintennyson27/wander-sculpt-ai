/**
 * Debug RLS Page
 * Development-only page to test Row-Level Security policies
 * 
 * Access at: /debug-rls (only in development mode)
 */

import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldX, RefreshCw, AlertTriangle } from "lucide-react";
import { runAllRLSTests, RLSTestSummary, RLSTestResult } from "@/lib/debug-rls";
import { useAuth } from "@/contexts/AuthContext";

// Only allow in development mode
const isDev = import.meta.env.DEV;

function TestResultCard({ result }: { result: RLSTestResult }) {
  return (
    <Card className={`border-l-4 ${result.passed ? 'border-l-green-500' : 'border-l-destructive'}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {result.passed ? (
              <ShieldCheck className="w-5 h-5 text-green-500" />
            ) : (
              <ShieldX className="w-5 h-5 text-destructive" />
            )}
            {result.testName}
          </CardTitle>
          <Badge variant={result.passed ? "default" : "destructive"}>
            {result.passed ? "PASS" : "FAIL"}
          </Badge>
        </div>
        <CardDescription>{result.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
          <div>
            <span className="font-medium">Target:</span>
            <p className="text-xs">{result.targetId || "N/A"}</p>
          </div>
          <div>
            <span className="font-medium">Owner:</span>
            <p className="text-xs">{result.targetOwner || "N/A"}</p>
          </div>
        </div>
        <div className="flex gap-4 pt-2 border-t">
          <div>
            <span className="text-muted-foreground">Expected rows:</span>{" "}
            <span className="font-mono font-bold">{result.expectedRows}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Actual rows:</span>{" "}
            <span className={`font-mono font-bold ${result.actualRows === result.expectedRows ? 'text-green-500' : 'text-destructive'}`}>
              {result.actualRows}
            </span>
          </div>
        </div>
        {result.error && (
          <div className={`text-xs p-2 rounded ${result.passed ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}>
            {result.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DebugRLS() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<RLSTestSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect to home if not in development mode
  if (!isDev) {
    return <Navigate to="/" replace />;
  }

  const runTests = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await runAllRLSTests();
      setSummary(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run tests");
    } finally {
      setLoading(false);
    }
  };

  // Auto-run tests when user is authenticated
  useEffect(() => {
    if (user && !summary && !loading) {
      runTests();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Authentication Required
              </CardTitle>
              <CardDescription>
                You must be logged in to run RLS security tests.
                The tests verify that your session cannot access other users' data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <a href="/auth">Sign In to Run Tests</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              RLS Security Tests
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Development-only debug page to verify Row-Level Security policies
            </p>
          </div>
          <Badge variant="outline" className="font-mono">
            DEV MODE
          </Badge>
        </div>

        {/* Current User Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Current Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="flex gap-2">
              <span className="text-muted-foreground">User ID:</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded">{user.id}</code>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground">Email:</span>
              <code className="text-xs bg-muted px-2 py-0.5 rounded">{user.email}</code>
            </div>
          </CardContent>
        </Card>

        {/* Run Tests Button */}
        <div className="flex justify-between items-center">
          <Button onClick={runTests} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? "Running Tests..." : "Run All Tests"}
          </Button>
          
          {summary && (
            <div className="flex items-center gap-2">
              {summary.allPassed ? (
                <>
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  <span className="text-green-500 font-medium">All tests passed!</span>
                </>
              ) : (
                <>
                  <ShieldX className="w-5 h-5 text-destructive" />
                  <span className="text-destructive font-medium">Some tests failed!</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="pt-4">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        {summary && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Tests run at: {summary.timestamp.toLocaleString()}
            </div>
            
            <div className="grid gap-4">
              {summary.tests.map((test, idx) => (
                <TestResultCard key={idx} result={test} />
              ))}
            </div>

            {/* Summary Box */}
            <Card className={summary.allPassed ? 'border-green-500 bg-green-500/5' : 'border-destructive bg-destructive/5'}>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  {summary.allPassed ? (
                    <>
                      <ShieldCheck className="w-8 h-8 text-green-500" />
                      <div>
                        <p className="font-bold text-green-500">All RLS Tests Passed</p>
                        <p className="text-sm text-muted-foreground">
                          Your Row-Level Security policies are working correctly.
                          Users cannot access other users' data.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShieldX className="w-8 h-8 text-destructive" />
                      <div>
                        <p className="font-bold text-destructive">Security Issue Detected</p>
                        <p className="text-sm text-muted-foreground">
                          One or more RLS policies are not working correctly.
                          Review the failed tests above.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Expected Behavior Note */}
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm">Expected Behavior</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>All tests should PASS</strong> by returning 0 rows when attempting to access 
              data owned by other users. This confirms RLS is blocking unauthorized access.
            </p>
            <p>
              <strong>How it works:</strong> Each test attempts to query records where 
              <code className="mx-1 bg-background px-1 rounded">user_id ≠ current_user</code>.
              RLS policies should filter these out, returning empty results.
            </p>
            <p>
              <strong>If a test fails:</strong> It means RLS policies are misconfigured and 
              users can potentially access other users' data. This is a critical security issue.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
