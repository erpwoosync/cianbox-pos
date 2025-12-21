import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  User,
  Plus,
  Check,
  Phone,
  Mail,
  FileText,
  MapPin,
  Edit2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { customersService, Customer, CONSUMIDOR_FINAL } from '../services/customers';

interface CustomerSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: Customer | null) => void;
  selectedCustomerId?: string | null;
}

type ModalView = 'list' | 'create' | 'edit';

export default function CustomerSelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedCustomerId,
}: CustomerSelectorModalProps) {
  const [view, setView] = useState<ModalView>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    documentType: 'DNI' as Customer['documentType'],
    documentNumber: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Cargar clientes al abrir
  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      setView('list');
      setSearchQuery('');
    }
  }, [isOpen]);

  const loadCustomers = useCallback(() => {
    const allCustomers = customersService.getAllWithDefault();
    setCustomers(allCustomers);
  }, []);

  // Buscar clientes
  const filteredCustomers = searchQuery
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.documentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.phone?.includes(searchQuery)
      )
    : customers;

  const handleSelectCustomer = (customer: Customer) => {
    onSelect(customer);
    onClose();
  };

  const handleClearCustomer = () => {
    onSelect(null);
    onClose();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      documentType: 'DNI',
      documentNumber: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
    });
    setFormError(null);
    setEditingCustomer(null);
  };

  const handleCreateNew = () => {
    resetForm();
    setView('create');
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      documentType: customer.documentType || 'DNI',
      documentNumber: customer.documentNumber || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setView('edit');
  };

  const handleDelete = (customer: Customer) => {
    if (customer.id === CONSUMIDOR_FINAL.id) return;

    if (window.confirm(`¿Eliminar cliente "${customer.name}"?`)) {
      customersService.delete(customer.id);
      loadCustomers();

      // Si se elimina el cliente seleccionado, limpiar seleccion
      if (selectedCustomerId === customer.id) {
        onSelect(null);
      }
    }
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      setFormError('El nombre es requerido');
      return;
    }

    try {
      if (view === 'edit' && editingCustomer) {
        const updated = customersService.update(editingCustomer.id, {
          name: formData.name.trim(),
          documentType: formData.documentType,
          documentNumber: formData.documentNumber.trim() || undefined,
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        });

        if (updated) {
          loadCustomers();
          setView('list');
          resetForm();
        }
      } else {
        const newCustomer = customersService.create({
          name: formData.name.trim(),
          documentType: formData.documentType,
          documentNumber: formData.documentNumber.trim() || undefined,
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          address: formData.address.trim() || undefined,
          notes: formData.notes.trim() || undefined,
        });

        loadCustomers();
        handleSelectCustomer(newCustomer);
      }
    } catch {
      setFormError('Error al guardar el cliente');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">
              {view === 'list' && 'Seleccionar Cliente'}
              {view === 'create' && 'Nuevo Cliente'}
              {view === 'edit' && 'Editar Cliente'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'list' ? (
            <>
              {/* Barra de busqueda y boton nuevo */}
              <div className="p-4 border-b space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, documento, email..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleCreateNew}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Crear nuevo cliente
                </button>
              </div>

              {/* Lista de clientes */}
              <div className="flex-1 overflow-y-auto p-2">
                {filteredCustomers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
                    <User className="w-12 h-12 mb-2" />
                    <p>No se encontraron clientes</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredCustomers.map((customer) => {
                      const isSelected = selectedCustomerId === customer.id;
                      const isConsumidorFinal = customer.id === CONSUMIDOR_FINAL.id;

                      return (
                        <div
                          key={customer.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => handleSelectCustomer(customer)}
                        >
                          {/* Avatar */}
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isConsumidorFinal
                                ? 'bg-gray-200 text-gray-600'
                                : 'bg-blue-100 text-blue-600'
                            }`}
                          >
                            <User className="w-5 h-5" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{customer.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              {customer.documentNumber && (
                                <span>
                                  {customer.documentType}: {customer.documentNumber}
                                </span>
                              )}
                              {customer.phone && (
                                <span className="flex items-center gap-0.5">
                                  <Phone className="w-3 h-3" />
                                  {customer.phone}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex items-center gap-1">
                            {isSelected && (
                              <Check className="w-5 h-5 text-blue-600" />
                            )}
                            {!isConsumidorFinal && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit(customer);
                                  }}
                                  className="p-1.5 hover:bg-gray-200 rounded"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-500" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(customer);
                                  }}
                                  className="p-1.5 hover:bg-red-100 rounded"
                                  title="Eliminar"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer lista */}
              <div className="p-4 border-t bg-gray-50 shrink-0">
                {selectedCustomerId && selectedCustomerId !== CONSUMIDOR_FINAL.id && (
                  <button
                    onClick={handleClearCustomer}
                    className="w-full py-2 px-4 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Quitar cliente asignado
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Formulario crear/editar */
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nombre completo"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Documento */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo Doc.
                  </label>
                  <select
                    value={formData.documentType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        documentType: e.target.value as Customer['documentType'],
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="DNI">DNI</option>
                    <option value="CUIT">CUIT</option>
                    <option value="CUIL">CUIL</option>
                    <option value="PASSPORT">Pasaporte</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numero
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.documentNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, documentNumber: e.target.value })
                      }
                      placeholder="12345678"
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@ejemplo.com"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Telefono */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+54 11 1234-5678"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Direccion */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direccion
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Calle, numero, ciudad"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer formulario */}
        {view !== 'list' && (
          <div className="flex gap-3 p-4 border-t bg-gray-50 shrink-0">
            <button
              onClick={() => {
                setView('list');
                resetForm();
              }}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {view === 'edit' ? 'Guardar' : 'Crear y Seleccionar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
