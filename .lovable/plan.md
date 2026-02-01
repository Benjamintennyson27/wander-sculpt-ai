

## Plan: Make Abhishekrajawat1808@gmail.com Admin & Disable Email Verification

This plan will make the specified email an admin with unlimited generations and remove email verification for all new signups.

---

### What Will Change

#### 1. Disable Email Verification (Backend Auth Setting)
- Enable "auto-confirm" for email signups so new users can sign in immediately without verifying their email
- This is a backend configuration change

#### 2. Update Sign Up Flow (Frontend)
- Remove the "Check your email" verification screen that appears after signup
- Instead, automatically sign in and redirect users to the dashboard after signup
- Update the `Auth.tsx` page to handle immediate login after registration

#### 3. Grant Admin Role to Abhishekrajawat1808@gmail.com
- **Note**: This email doesn't exist in the database yet
- Once you register with this email (after the changes above), I'll add the admin role to the `user_roles` table
- Admins get unlimited trip generations as per your existing quota system

---

### Technical Details

**Files to modify:**
- `src/pages/Auth.tsx` - Remove verification message screen, auto-redirect after signup
- `src/contexts/AuthContext.tsx` - Update signUp to handle auto-confirm flow

**Backend changes:**
- Configure auth to auto-confirm email signups
- SQL to add admin role (after registration):
```sql
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role 
FROM profiles 
WHERE LOWER(email) = LOWER('Abhishekrajawat1808@gmail.com');
```

---

### After Implementation

1. New users can sign up and immediately start using the app (no email verification)
2. You'll register with `Abhishekrajawat1808@gmail.com`
3. I'll then add the admin role giving you unlimited generations

