import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Building2, Plus, Edit2, Trash2, Save, X, Search } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

interface Branch {
  id: number | null;
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  registration_date: string;
  deregistration_date: string | null;
  is_active: boolean;
}

export function BranchesModule() {
  const toast = useToast();
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<Branch>({
    id: null,
    code: '',
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    registration_date: new Date().toISOString().split('T')[0],
    deregistration_date: null,
    is_active: true
  });

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('code', { ascending: true });

      if (error) throw error;

      setBranches(data || []);
    } catch (error: any) {
      toast.error('Error al cargar sucursales: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (branch?: Branch) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData(branch);
    } else {
      setEditingBranch(null);
      setFormData({
        id: null,
        code: '',
        name: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        registration_date: new Date().toISOString().split('T')[0],
        deregistration_date: null,
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
  };

  const handleSave = async () => {
    if (!formData.id) {
      toast.error('El ID es obligatorio');
      return;
    }

    if (!formData.code || !formData.name) {
      toast.error('Código y Nombre son obligatorios');
      return;
    }

    try {
      const branchData = {
        id: formData.id,
        code: formData.code,
        name: formData.name,
        city: formData.city || null,
        address: formData.address || null,
        phone: formData.phone || null,
        email: formData.email || null,
        registration_date: formData.registration_date || null,
        deregistration_date: formData.deregistration_date || null,
        is_active: formData.is_active,
        created_by: user?.id || 'system',
        updated_at: new Date().toISOString()
      };

      let error;

      if (editingBranch) {
        const { error: updateError } = await supabase
          .from('branches')
          .update(branchData)
          .eq('id', formData.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('branches')
          .insert(branchData);
        error = insertError;
      }

      if (error) {
        if (error.code === '23505') {
          toast.error('Ya existe una sucursal con este ID o código');
        } else {
          throw error;
        }
        return;
      }

      toast.success(editingBranch ? 'Sucursal actualizada exitosamente' : 'Sucursal creada exitosamente');
      handleCloseModal();
      loadBranches();
    } catch (error: any) {
      toast.error('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta sucursal?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Sucursal eliminada exitosamente');
      loadBranches();
    } catch (error: any) {
      toast.error('Error al eliminar: ' + error.message);
    }
  };

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.id?.toString().includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando sucursales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sucursales</h2>
            <p className="text-slate-600">Gestiona las sucursales de la empresa</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Sucursal</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por ID, código, nombre o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ciudad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Dirección</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Teléfono</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha de Alta</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha de Baja</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500">
                    {searchTerm ? 'No se encontraron sucursales' : 'No hay sucursales registradas'}
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{branch.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.code}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{branch.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.city || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.address || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{branch.email || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {branch.registration_date ? new Date(branch.registration_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {branch.deregistration_date ? new Date(branch.deregistration_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        branch.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {branch.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleOpenModal(branch)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(branch.id!)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-slate-900">
                  {editingBranch ? 'Editar Sucursal' : 'Nueva Sucursal'}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="p-2 hover:bg-slate-100 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    ID * <span className="text-xs text-slate-500">(debe coincidir con el sistema externo)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.id || ''}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value ? parseInt(e.target.value) : null })}
                    disabled={!!editingBranch}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
                    placeholder="572"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Código *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="2"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="DogCatiFy"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Montevideo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="092519111"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="itapebi 2194"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="info@ayalait.com.uy"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fecha de Alta
                  </label>
                  <input
                    type="date"
                    value={formData.registration_date}
                    onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Fecha de Baja
                  </label>
                  <input
                    type="date"
                    value={formData.deregistration_date || ''}
                    onChange={(e) => setFormData({ ...formData, deregistration_date: e.target.value || null })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Sucursal Activa</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={handleCloseModal}
                className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-blue-600 transition shadow-lg"
              >
                <Save className="w-5 h-5" />
                <span>{editingBranch ? 'Actualizar' : 'Crear'} Sucursal</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
