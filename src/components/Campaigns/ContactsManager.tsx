import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Edit2, Users, Mail, Phone, Building2, Upload, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmDialog } from '../Common/ConfirmDialog';

interface Contact {
  id: string;
  group_id: string;
  email: string;
  first_name: string;
  last_name: string;
  company_name: string;
  phone: string;
  status: string;
}

interface ContactsManagerProps {
  groupId: string;
  onClose: () => void;
}

export function ContactsManager({ groupId, onClose }: ContactsManagerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const { user } = useAuth();
  const toast = useToast();

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    contactId: string | null;
  }>({
    isOpen: false,
    title: '',
    message: '',
    contactId: null
  });

  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    company_name: '',
    phone: '',
    status: 'active'
  });

  useEffect(() => {
    loadContacts();
    loadGroupName();
  }, [groupId]);

  const loadGroupName = async () => {
    const { data } = await supabase
      .from('contact_groups')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();

    if (data) setGroupName(data.name);
  };

  const loadContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setContacts(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingContactId) {
      const { error } = await supabase
        .from('contacts')
        .update(formData)
        .eq('id', editingContactId);

      if (!error) {
        loadContacts();
        resetForm();
        toast.showToast('Contacto actualizado exitosamente', 'success');
      } else {
        toast.showToast(`Error al actualizar contacto: ${error.message}`, 'error');
      }
      return;
    }

    const contactData: any = {
      ...formData,
      group_id: groupId
    };

    if (user?.id) {
      contactData.created_by = user.id;
    }

    const { error } = await supabase.from('contacts').insert(contactData);

    if (!error) {
      loadContacts();
      resetForm();
      toast.showToast('Contacto agregado exitosamente', 'success');
    } else {
      toast.showToast(`Error al guardar contacto: ${error.message}`, 'error');
    }
  };

  const handleEdit = (contact: Contact) => {
    setEditingContactId(contact.id);
    setFormData({
      email: contact.email,
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      company_name: contact.company_name || '',
      phone: contact.phone || '',
      status: contact.status || 'active'
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '¿Eliminar contacto?',
      message: 'Este contacto se eliminará permanentemente del grupo.',
      contactId: id
    });
  };

  const confirmDelete = async () => {
    if (confirmDialog.contactId) {
      const { error } = await supabase.from('contacts').delete().eq('id', confirmDialog.contactId);

      if (!error) {
        toast.success('Contacto eliminado correctamente');
        loadContacts();
      } else {
        toast.error('Error al eliminar el contacto');
      }
    }
    setConfirmDialog({ isOpen: false, title: '', message: '', contactId: null });
  };

  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      company_name: '',
      phone: '',
      status: 'active'
    });
    setEditingContactId(null);
    setShowAddForm(false);
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(s => s.trim());
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

    if (lines.length < 2) {
      toast.error('El archivo CSV no tiene filas de datos para importar');
      return;
    }

    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase());
    const emailIdx = headers.findIndex(h => h.includes('email') || h.includes('correo'));

    if (emailIdx === -1) {
      toast.error('El CSV debe tener una columna "Email"');
      return;
    }

    const firstNameIdx = headers.findIndex(h => h.includes('nombre') && !h.includes('apellido'));
    const lastNameIdx = headers.findIndex(h => h.includes('apellido'));
    const companyIdx = headers.findIndex(h => h.includes('empresa') || h.includes('compan'));
    const phoneIdx = headers.findIndex(h => h.includes('tel') || h.includes('phone'));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const newContacts: any[] = [];
    let skipped = 0;

    for (const line of lines.slice(1)) {
      const row = parseCsvLine(line);
      const email = (row[emailIdx] || '').trim();

      if (!email || !emailRegex.test(email)) {
        skipped++;
        continue;
      }

      newContacts.push({
        group_id: groupId,
        email,
        first_name: firstNameIdx >= 0 ? row[firstNameIdx] || '' : '',
        last_name: lastNameIdx >= 0 ? row[lastNameIdx] || '' : '',
        company_name: companyIdx >= 0 ? row[companyIdx] || '' : '',
        phone: phoneIdx >= 0 ? row[phoneIdx] || '' : '',
        status: 'active',
        ...(user?.id ? { created_by: user.id } : {}),
      });
    }

    if (newContacts.length === 0) {
      toast.error('No se encontraron filas válidas con email en el CSV');
      return;
    }

    const { error } = await supabase.from('contacts').insert(newContacts);

    if (error) {
      toast.error(`Error al importar contactos: ${error.message}`);
      return;
    }

    toast.success(
      `${newContacts.length} contacto(s) importado(s)` +
        (skipped > 0 ? `, ${skipped} fila(s) omitida(s) por email inválido` : '')
    );
    loadContacts();
  };

  const exportContacts = () => {
    const csv = [
      ['Email', 'Nombre', 'Apellido', 'Empresa', 'Teléfono'],
      ...contacts.map(c => [c.email, c.first_name, c.last_name, c.company_name, c.phone])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contactos_${groupName}.csv`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-brand-600 to-accent-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Contactos del Grupo</h2>
              <p className="text-brand-100 mt-1">{groupName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-lg transition"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-2">
              <div className="bg-brand-100 dark:bg-brand-500/15 p-2 rounded-lg">
                <Users className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">Total Contactos</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{contacts.length}</p>
              </div>
            </div>

            <div className="flex space-x-2">
              <label className="flex items-center space-x-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>Importar CSV</span>
                <input type="file" accept=".csv,text/csv" onChange={handleImportCsv} className="hidden" />
              </label>
              <button
                onClick={exportContacts}
                className="flex items-center space-x-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                <Download className="w-4 h-4" />
                <span>Exportar CSV</span>
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center space-x-2 bg-gradient-to-r from-brand-600 to-accent-600 text-white px-4 py-2 rounded-lg hover:from-brand-700 hover:to-accent-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Contacto</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 -mt-4 mb-6">
            El CSV a importar debe tener una columna "Email" (obligatoria) y opcionalmente "Nombre",
            "Apellido", "Empresa" y "Teléfono" — mismo formato que genera "Exportar CSV".
          </p>

          {showAddForm && (
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 mb-6 border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                {editingContactId ? 'Editar Contacto' : 'Nuevo Contacto'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="contacto@ejemplo.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nombre</label>
                    <input
                      type="text"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="Juan"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Apellido</label>
                    <input
                      type="text"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="Pérez"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Empresa</label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="Acme Corp"
                    />
                  </div>

                  <div className={editingContactId ? '' : 'col-span-2'}>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Teléfono</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                      placeholder="+52 55 1234 5678"
                    />
                  </div>

                  {editingContactId && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Estado</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                        <option value="bounced">Rebotado</option>
                        <option value="unsubscribed">Dado de baja</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-brand-600 to-accent-600 text-white rounded-lg hover:from-brand-700 hover:to-accent-700 transition"
                  >
                    {editingContactId ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Nombre</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Empresa</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Teléfono</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Estado</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{contact.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-900 dark:text-white font-medium">
                        {contact.first_name} {contact.last_name}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{contact.company_name || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-300">{contact.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        contact.status === 'active' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' :
                        contact.status === 'bounced' ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300' :
                        contact.status === 'unsubscribed' ? 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleEdit(contact)}
                          className="p-2 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {contacts.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No hay contactos en este grupo</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Agrega contactos para comenzar</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Las variables de la plantilla se reemplazarán con los datos de cada contacto
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="danger"
        confirmText="Eliminar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', contactId: null })}
      />
    </div>
  );
}
