import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { UserPlus, Trash2, ArrowLeft, Loader2, Phone, User, Users } from 'lucide-react';
import { useAuth } from '@/react-app/contexts/AuthContext';

interface DirectoryUser {
  id: number;
  phone_number: string;
  name: string;
  team: string;
  role: string;
  created_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number: phoneNumber, name, team, role }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add user');
      }

      await fetchUsers();
      setShowAddForm(false);
      setPhoneNumber('');
      setName('');
      setTeam('');
      setRole('user');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Are you sure you want to remove this user from the directory?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchUsers();
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  // Only Admin can access admin panel
  if (user?.role !== 'Admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-8 text-center shadow-lg border border-slate-200">
          <p className="text-slate-700 mb-4">Access denied. Only Admins can manage users.</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-white/50 rounded-lg transition-all active:scale-95"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">User Directory</h1>
              <p className="text-xs text-slate-600">Manage authorized users</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Add User Button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg active:scale-95"
        >
          <UserPlus className="w-5 h-5" />
          <span className="font-medium">Add New User</span>
        </button>

        {/* Add User Form */}
        {showAddForm && (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-slate-200 mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add User to Directory</h2>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Enter phone number"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Team
                </label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none bg-white text-sm"
                  >
                    <option value="">Select team</option>
                    <option value="Admin">Admin</option>
                    <option value="Regional Manager">Regional Manager</option>
                    <option value="CM Operations">CM Operations</option>
                    <option value="CM Credit">CM Credit</option>
                    <option value="CM D & VAS">CM D & VAS</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all appearance-none bg-white text-sm"
                >
                  <option value="user">Team Member</option>
                  <option value="Admin">Admin</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Admins can manage all users and assign roles
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white py-2.5 rounded-lg font-medium hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 active:scale-95"
                >
                  {submitting ? 'Adding...' : 'Add User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setError('');
                    setPhoneNumber('');
                    setName('');
                    setTeam('');
                    setRole('user');
                  }}
                  className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* User List */}
        {loading ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-xl p-12 text-center shadow-lg border border-slate-200">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-600">Loading users...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((dirUser) => (
              <div
                key={dirUser.id}
                className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900 mb-1">{dirUser.name}</h3>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4 text-indigo-500" />
                        <span>{dirUser.phone_number}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-blue-100 text-indigo-700 rounded-full font-medium text-xs">
                          {dirUser.team}
                        </span>
                        {dirUser.role === 'Admin' && (
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 rounded-full font-medium text-xs">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteUser(dirUser.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-95"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
