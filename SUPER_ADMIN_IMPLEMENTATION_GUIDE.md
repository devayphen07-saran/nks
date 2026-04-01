# Super Admin Pages — Frontend Implementation Guide

Step-by-step guide for building the super admin dashboard using the NKS frontend architecture.

---

## 📦 Setup & Project Structure

### Directory Structure
```
apps/nks-web/src/
├── app/
│   └── (protected)/
│       ├── admin/
│       │   ├── _layout.tsx          # Admin layout with nav
│       │   ├── page.tsx             # Dashboard
│       │   ├── users/
│       │   │   ├── page.tsx         # Users list
│       │   │   ├── [id]/
│       │   │   │   └── page.tsx     # User detail/edit
│       │   ├── stores/
│       │   │   ├── page.tsx         # Stores list
│       │   │   ├── [id]/
│       │   │   │   └── page.tsx     # Store detail/edit
│       │   ├── roles/
│       │   │   ├── page.tsx         # Roles list
│       │   │   ├── [id]/
│       │   │   │   └── page.tsx     # Role detail/edit
│       │   ├── permissions/
│       │   │   └── page.tsx         # Permissions list
│       │   ├── location/
│       │   │   ├── countries/
│       │   │   ├── states/
│       │   │   └── cities/
│       │   └── tax/
│       │       ├── agencies/
│       │       ├── rates/
│       │       └── registrations/
├── components/
│   └── admin/
│       ├── users/
│       │   ├── UsersTable.tsx
│       │   ├── UserForm.tsx
│       │   └── UserDetail.tsx
│       ├── stores/
│       │   ├── StoresTable.tsx
│       │   ├── StoreForm.tsx
│       │   └── StoreDetail.tsx
│       ├── roles/
│       │   ├── RolesTable.tsx
│       │   ├── RoleForm.tsx
│       │   └── PermissionPicker.tsx
│       ├── common/
│       │   ├── DataTable.tsx
│       │   ├── Pagination.tsx
│       │   ├── SearchBar.tsx
│       │   └── FilterPanel.tsx
│       └── layout/
│           ├── AdminNav.tsx
│           ├── Sidebar.tsx
│           └── AdminHeader.tsx
└── lib/
    └── admin/
        ├── api-client.ts         # API calls for admin
        ├── hooks/
        │   ├── useUsers.ts
        │   ├── useStores.ts
        │   ├── useRoles.ts
        │   └── usePagination.ts
        └── types/
            ├── admin.types.ts
            └── pagination.types.ts
```

---

## 🛠️ Implementation Patterns

### 1. API Client Layer (Thunks)

Create thunks in the api-manager library for each resource:

```typescript
// libs-common/api-manager/src/lib/admin/admin-thunks.ts

import { createAsyncThunk } from '@reduxjs/toolkit';

// Users
export const fetchUsers = createAsyncThunk(
  'admin/fetchUsers',
  async (params: { page: number; pageSize: number; search?: string }, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/users', {
        method: 'GET',
        body: JSON.stringify(params),
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserById = createAsyncThunk(
  'admin/fetchUserById',
  async (userId: number, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch(`/api/v1/admin/users/${userId}`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateUser = createAsyncThunk(
  'admin/updateUser',
  async ({ userId, data }: { userId: number; data: any }, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Stores
export const fetchStores = createAsyncThunk(
  'admin/fetchStores',
  async (params: { page: number; pageSize: number; search?: string }, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch('/api/v1/admin/stores', {
        method: 'GET',
        body: JSON.stringify(params),
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Roles
export const fetchRoles = createAsyncThunk(
  'admin/fetchRoles',
  async (params: { search?: string; page?: number }, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch('/api/v1/roles', {
        method: 'GET',
        body: JSON.stringify(params),
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchRoleById = createAsyncThunk(
  'admin/fetchRoleById',
  async (roleId: number, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch(`/api/v1/roles/${roleId}`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchRolePermissions = createAsyncThunk(
  'admin/fetchRolePermissions',
  async (roleId: number, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch(`/api/v1/roles/${roleId}/permissions`, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const assignPermissionToRole = createAsyncThunk(
  'admin/assignPermissionToRole',
  async (
    { roleId, permissionId }: { roleId: number; permissionId: number },
    { rejectWithValue }
  ) => {
    try {
      const response = await authenticatedFetch(`/api/v1/roles/${roleId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ permissionId }),
      });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Permissions
export const fetchAllPermissions = createAsyncThunk(
  'admin/fetchAllPermissions',
  async (resource?: string, { rejectWithValue }) => {
    try {
      const url = resource
        ? `/api/v1/roles/permissions/all?resource=${resource}`
        : '/api/v1/roles/permissions/all';
      const response = await authenticatedFetch(url, { method: 'GET' });
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserPermissions = createAsyncThunk(
  'admin/fetchUserPermissions',
  async (userId: number, { rejectWithValue }) => {
    try {
      const response = await authenticatedFetch(
        `/api/v1/roles/users/${userId}/permissions`,
        { method: 'GET' }
      );
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
```

### 2. Redux Slice for Admin State

```typescript
// libs-common/state-manager/src/lib/admin/admin.slice.ts

import { createSlice } from '@reduxjs/toolkit';
import { fetchUsers, fetchUserById, updateUser, fetchStores, fetchRoles } from './admin-thunks';

interface AdminState {
  users: {
    list: any[];
    current: any | null;
    loading: boolean;
    error: string | null;
    pagination: { page: number; pageSize: number; total: number };
  };
  stores: {
    list: any[];
    current: any | null;
    loading: boolean;
    error: string | null;
    pagination: { page: number; pageSize: number; total: number };
  };
  roles: {
    list: any[];
    current: any | null;
    permissions: any[];
    loading: boolean;
    error: string | null;
  };
}

const initialState: AdminState = {
  users: {
    list: [],
    current: null,
    loading: false,
    error: null,
    pagination: { page: 1, pageSize: 20, total: 0 },
  },
  stores: {
    list: [],
    current: null,
    loading: false,
    error: null,
    pagination: { page: 1, pageSize: 20, total: 0 },
  },
  roles: {
    list: [],
    current: null,
    permissions: [],
    loading: false,
    error: null,
  },
};

export const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    clearAdminError: (state) => {
      state.users.error = null;
      state.stores.error = null;
      state.roles.error = null;
    },
  },
  extraReducers: (builder) => {
    // Users
    builder.addCase(fetchUsers.pending, (state) => {
      state.users.loading = true;
    });
    builder.addCase(fetchUsers.fulfilled, (state, action) => {
      state.users.loading = false;
      state.users.list = action.payload.data;
      state.users.pagination = {
        page: action.payload.page,
        pageSize: action.payload.pageSize,
        total: action.payload.total,
      };
    });
    builder.addCase(fetchUsers.rejected, (state, action) => {
      state.users.loading = false;
      state.users.error = action.payload as string;
    });

    // Similar cases for fetchUserById, updateUser, fetchStores, fetchRoles...
  },
});

export default adminSlice.reducer;
```

---

## 🎨 Component Examples

### 1. Users List Component

```typescript
// apps/nks-web/src/components/admin/users/UsersTable.tsx

'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@nks/state-manager';
import { fetchUsers } from '@nks/api-manager';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@nks/web-ui-components/ui/table';
import { Button } from '@nks/web-ui-components/ui/button';
import { Badge } from '@nks/web-ui-components/ui/badge';
import Link from 'next/link';

export function UsersTable() {
  const dispatch = useAppDispatch();
  const { users } = useAppSelector((state) => state.admin);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(
      fetchUsers({
        page,
        pageSize: 20,
        search: searchTerm || undefined,
      }) as any
    );
  }, [dispatch, page, searchTerm]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border rounded"
        />
      </div>

      {users.loading ? (
        <div>Loading...</div>
      ) : users.error ? (
        <div className="text-red-600">Error: {users.error}</div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.list.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phoneNumber}</TableCell>
                  <TableCell>
                    <Badge variant={user.isBlocked ? 'destructive' : 'default'}>
                      {user.isBlocked ? 'Blocked' : 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.loginCount}</TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${user.id}`}>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-between items-center">
            <span>
              Page {users.pagination.page} of{' '}
              {Math.ceil(users.pagination.total / users.pagination.pageSize)}
            </span>
            <div className="space-x-2">
              <Button
                disabled={users.pagination.page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                disabled={
                  users.pagination.page >=
                  Math.ceil(users.pagination.total / users.pagination.pageSize)
                }
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

### 2. User Detail/Edit Component

```typescript
// apps/nks-web/src/components/admin/users/UserDetail.tsx

'use client';

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@nks/state-manager';
import { fetchUserById, updateUser } from '@nks/api-manager';
import { Button } from '@nks/web-ui-components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nks/web-ui-components/ui/card';

export function UserDetail({ userId }: { userId: number }) {
  const dispatch = useAppDispatch();
  const { users } = useAppSelector((state) => state.admin);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    isBlocked: false,
    emailVerified: false,
    phoneNumberVerified: false,
  });

  useEffect(() => {
    dispatch(fetchUserById(userId) as any);
  }, [dispatch, userId]);

  useEffect(() => {
    if (users.current) {
      setFormData({
        name: users.current.name,
        isBlocked: users.current.isBlocked,
        emailVerified: users.current.emailVerified,
        phoneNumberVerified: users.current.phoneNumberVerified,
      });
    }
  }, [users.current]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatch(updateUser({ userId, data: formData }) as any);
    setIsEditing(false);
  };

  if (users.loading) return <div>Loading...</div>;
  if (users.error) return <div className="text-red-600">Error: {users.error}</div>;
  if (!users.current) return <div>User not found</div>;

  const user = users.current;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>User ID: {user.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <p className="text-gray-700">{user.email}</p>
            <p className="text-sm text-gray-500">
              Verified: {user.emailVerified ? 'Yes' : 'No'}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Phone</label>
            <p className="text-gray-700">{user.phoneNumber}</p>
            <p className="text-sm text-gray-500">
              Verified: {user.phoneNumberVerified ? 'Yes' : 'No'}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Status</label>
            <p className="text-gray-700">{user.isBlocked ? 'Blocked' : 'Active'}</p>
          </div>

          <div>
            <label className="text-sm font-medium">Login Count</label>
            <p className="text-gray-700">{user.loginCount}</p>
          </div>
        </CardContent>
      </Card>

      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isBlocked"
                  checked={formData.isBlocked}
                  onChange={(e) => setFormData({ ...formData, isBlocked: e.target.checked })}
                />
                <label htmlFor="isBlocked">Block User</label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="emailVerified"
                  checked={formData.emailVerified}
                  onChange={(e) =>
                    setFormData({ ...formData, emailVerified: e.target.checked })
                  }
                />
                <label htmlFor="emailVerified">Email Verified</label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="phoneVerified"
                  checked={formData.phoneNumberVerified}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumberVerified: e.target.checked })
                  }
                />
                <label htmlFor="phoneVerified">Phone Verified</label>
              </div>

              <div className="flex gap-2">
                <Button type="submit">Save</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={() => setIsEditing(true)}>Edit User</Button>
      )}
    </div>
  );
}
```

---

## 📄 Page Routes

### Layout File (`_layout.tsx`)

```typescript
// apps/nks-web/src/app/(protected)/admin/_layout.tsx

'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@nks/web-utils';
import AdminNav from '@/components/admin/layout/AdminNav';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  // Verify super admin
  const isSuperAdmin = user?.access?.isSuperAdmin === true;

  if (!isAuthenticated || !isSuperAdmin) {
    router.push('/login');
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
```

### Dashboard Page

```typescript
// apps/nks-web/src/app/(protected)/admin/page.tsx

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nks/web-ui-components/ui/card';
import Link from 'next/link';
import { Button } from '@nks/web-ui-components/ui/button';

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-gray-500">System users</p>
            <Link href="/admin/users">
              <Button className="mt-4 w-full">Manage Users</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stores</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-gray-500">Registered stores</p>
            <Link href="/admin/stores">
              <Button className="mt-4 w-full">Manage Stores</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-gray-500">Role definitions</p>
            <Link href="/admin/roles">
              <Button className="mt-4 w-full">Manage Roles</Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">—</p>
            <p className="text-sm text-gray-500">System permissions</p>
            <Link href="/admin/permissions">
              <Button className="mt-4 w-full">View Permissions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## 🎯 Implementation Checklist

### Phase 1: Users Management
- [ ] Create Users List page with table + pagination + search
- [ ] Create Users Detail page
- [ ] Create Users Edit form
- [ ] Add block/unblock user functionality
- [ ] Display user verification status

### Phase 2: Stores Management
- [ ] Create Stores List page
- [ ] Create Stores Detail page
- [ ] Create Stores Edit form
- [ ] Display store location information
- [ ] Display store staff/users

### Phase 3: Roles & Permissions
- [ ] Create Roles List page
- [ ] Create Roles Detail page
- [ ] Create Roles Create/Edit forms
- [ ] Implement Permission Picker component
- [ ] Create Permissions List page
- [ ] Implement Role-Permission assignment

### Phase 4: Advanced Features
- [ ] User Permission checking/verification
- [ ] User-Role assignment UI
- [ ] Audit log viewer
- [ ] Location/Tax management pages
- [ ] Analytics dashboard

---

## 🔐 Guard Setup

Ensure all admin routes are protected with super admin check:

```typescript
// middleware.ts (if using middleware pattern)

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/admin')) {
    // Check if user is super admin
    // Redirect to login if not
    // This is handled client-side via layout.tsx for now
  }

  return NextResponse.next();
}
```

---

## 📚 Resources

- Backend Admin APIs: `GET /api/v1/admin/*`
- Roles/Permissions APIs: `GET /api/v1/roles/*`
- UI Components: `@nks/web-ui-components`
- State Management: `@nks/state-manager`
- API Manager: `@nks/api-manager`

