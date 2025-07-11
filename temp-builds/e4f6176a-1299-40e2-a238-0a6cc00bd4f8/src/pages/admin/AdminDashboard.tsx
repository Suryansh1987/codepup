import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Trash2, Package, Users, DollarSign, ShoppingCart, Eye, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminDashboard = () => {
  const { profile, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    totalRevenue: 0
  });
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    image_url: '',
    stock_quantity: '',
    is_featured: false
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchAdminData();
    }
  }, [profile]);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      console.log('Fetching admin data...');
      
      // Step 1: Fetch all tables separately to avoid RLS conflicts
      const [productsRes, ordersRes, profilesRes, orderItemsRes] = await Promise.all([
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('order_items').select('*')
      ]);
      
      // Step 2: Check for errors
      if (productsRes.error) {
        console.error('Products error:', productsRes.error);
        throw productsRes.error;
      }
      if (ordersRes.error) {
        console.error('Orders error:', ordersRes.error);
        throw ordersRes.error;
      }
      if (profilesRes.error) {
        console.error('Profiles error:', profilesRes.error);
        throw profilesRes.error;
      }
      if (orderItemsRes.error) {
        console.error('Order items error:', orderItemsRes.error);
        throw orderItemsRes.error;
      }
      
      // Step 3: Log data counts for debugging
      console.log('Products loaded:', productsRes.data?.length || 0);
      console.log('Orders loaded:', ordersRes.data?.length || 0);
      console.log('Profiles loaded:', profilesRes.data?.length || 0);
      console.log('Order items loaded:', orderItemsRes.data?.length || 0);
      
      // Step 4: Manually join data in JavaScript
      const ordersWithDetails = ordersRes.data?.map(order => {
        const userProfile = profilesRes.data?.find(p => p.id === order.user_id);
        const orderItems = orderItemsRes.data?.filter(item => item.order_id === order.id);
        
        const itemsWithProducts = orderItems?.map(item => {
          const product = productsRes.data?.find(p => p.id === item.product_id);
          return {
            ...item,
            products: product ? { 
              name: product.name, 
              price: product.price,
              image_url: product.image_url 
            } : null
          };
        });
        
        return {
          ...order,
          profiles: userProfile ? { 
            full_name: userProfile.full_name, 
            email: userProfile.email 
          } : null,
          order_items: itemsWithProducts || []
        };
      });
      
      // Step 5: Set state with joined data
      setProducts(productsRes.data || []);
      setOrders(ordersWithDetails || []);
      setStats({
        totalOrders: ordersRes.data?.length || 0,
        totalProducts: productsRes.data?.length || 0,
        totalUsers: profilesRes.data?.filter(p => p.role === 'user').length || 0,
        totalRevenue: ordersWithDetails?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0
      });
      
    } catch (error: any) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productForm.name?.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      toast.error('Valid price is required');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Adding product:', productForm);
      
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: productForm.name.trim(),
          description: productForm.description.trim(),
          price: parseFloat(productForm.price),
          category: productForm.category.trim(),
          image_url: productForm.image_url.trim(),
          stock_quantity: parseInt(productForm.stock_quantity) || 0,
          is_featured: productForm.is_featured
        })
        .select();
      
      if (error) {
        console.error('Add product error:', error);
        throw error;
      }
      
      console.log('Product added successfully:', data);
      toast.success('Product added successfully!');
      
      // Reset form and refresh data
      setProductForm({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
        stock_quantity: '',
        is_featured: false
      });
      setShowAddProduct(false);
      fetchAdminData();
    } catch (error: any) {
      console.error('Add product failed:', error);
      toast.error(error.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingProduct || !productForm.name?.trim()) {
      toast.error('Product name is required');
      return;
    }
    
    if (!productForm.price || parseFloat(productForm.price) <= 0) {
      toast.error('Valid price is required');
      return;
    }
    
    try {
      setLoading(true);
      console.log('Updating product:', editingProduct.id, productForm);
      
      const { data, error } = await supabase
        .from('products')
        .update({
          name: productForm.name.trim(),
          description: productForm.description.trim(),
          price: parseFloat(productForm.price),
          category: productForm.category.trim(),
          image_url: productForm.image_url.trim(),
          stock_quantity: parseInt(productForm.stock_quantity) || 0,
          is_featured: productForm.is_featured
        })
        .eq('id', editingProduct.id)
        .select();
      
      if (error) {
        console.error('Update product error:', error);
        throw error;
      }
      
      console.log('Product updated successfully:', data);
      toast.success('Product updated successfully!');
      
      // Reset form and refresh data
      setEditingProduct(null);
      setProductForm({
        name: '',
        description: '',
        price: '',
        category: '',
        image_url: '',
        stock_quantity: '',
        is_featured: false
      });
      fetchAdminData();
    } catch (error: any) {
      console.error('Update product failed:', error);
      toast.error(error.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) {
      return;
    }
    
    try {
      setLoading(true);
      console.log('Deleting product:', productId);
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      
      if (error) {
        console.error('Delete product error:', error);
        throw error;
      }
      
      console.log('Product deleted successfully');
      toast.success('Product deleted successfully!');
      fetchAdminData();
    } catch (error: any) {
      console.error('Delete product failed:', error);
      toast.error(error.message || 'Failed to delete product');
    } finally {
      setLoading(false);
    }
  };

  const startEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      category: product.category || '',
      image_url: product.image_url || '',
      stock_quantity: product.stock_quantity?.toString() || '',
      is_featured: product.is_featured || false
    });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setShowAddProduct(false);
    setProductForm({
      name: '',
      description: '',
      price: '',
      category: '',
      image_url: '',
      stock_quantity: '',
      is_featured: false
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage your table shop</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Orders</p>
                <p className="text-2xl font-bold text-primary">{stats.totalOrders}</p>
              </div>
              <div className="bg-primary-100 p-3 rounded-full">
                <ShoppingCart className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Products</p>
                <p className="text-2xl font-bold text-primary">{stats.totalProducts}</p>
              </div>
              <div className="bg-accent-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-primary">{stats.totalUsers}</p>
              </div>
              <div className="bg-secondary-100 p-3 rounded-full">
                <Users className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-primary">${stats.totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-success-100 p-3 rounded-full">
                <DollarSign className="w-6 h-6 text-success" />
              </div>
            </div>
          </div>
        </div>

        {/* Products Management */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Products</h2>
            <button
              onClick={() => setShowAddProduct(true)}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>

          {/* Add/Edit Product Form */}
          {(showAddProduct || editingProduct) && (
            <div className="p-6 border-b bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                    <input
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={productForm.category}
                      onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                    <input
                      type="number"
                      value={productForm.stock_quantity}
                      onChange={(e) => setProductForm({...productForm, stock_quantity: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={productForm.description}
                    onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={productForm.image_url}
                    onChange={(e) => setProductForm({...productForm, image_url: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_featured"
                    checked={productForm.is_featured}
                    onChange={(e) => setProductForm({...productForm, is_featured: e.target.checked})}
                    className="w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                  <label htmlFor="is_featured" className="text-sm font-medium text-gray-700">Featured Product</label>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingProduct ? 'Update' : 'Add'} Product
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Products List */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Featured</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img 
                          src={product.image_url || '/api/placeholder/50/50'} 
                          alt={product.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{product.name}</div>
                          <div className="text-sm text-gray-500">{product.description?.substring(0, 50)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.category || 'Uncategorized'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${product.price?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {product.stock_quantity || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        product.is_featured ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {product.is_featured ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditProduct(product)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Orders Management */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Recent Orders</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{order.id.slice(-8)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{order.profiles?.full_name || 'Unknown Customer'}</div>
                        <div className="text-gray-500">{order.profiles?.email || 'No email'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.order_items?.length || 0} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${order.total_amount?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === 'completed' ? 'bg-success text-white' :
                        order.status === 'pending' ? 'bg-accent text-white' :
                        order.status === 'cancelled' ? 'bg-destructive text-white' :
                        'bg-blue-500 text-white'
                      }`}>
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1) || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;