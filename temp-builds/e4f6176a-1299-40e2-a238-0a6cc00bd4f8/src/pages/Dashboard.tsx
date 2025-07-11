import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User, ShoppingBag, Clock, Star, Package, Truck } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    pendingOrders: 0,
    completedOrders: 0
  });

  useEffect(() => {
    if (user && profile) {
      fetchUserOrders();
    }
  }, [user, profile]);

  const fetchUserOrders = async () => {
    try {
      setLoading(true);
      console.log('Fetching orders for user:', user?.id);
      
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (ordersError) {
        console.error('Orders error:', ordersError);
        throw ordersError;
      }
      
      const { data: orderItemsData, error: orderItemsError } = await supabase
        .from('order_items')
        .select('*, products(*)')
        .in('order_id', ordersData?.map(o => o.id) || []);
      
      if (orderItemsError) {
        console.error('Order items error:', orderItemsError);
        throw orderItemsError;
      }
      
      // Combine orders with their items
      const ordersWithItems = ordersData?.map(order => ({
        ...order,
        items: orderItemsData?.filter(item => item.order_id === order.id) || []
      })) || [];
      
      setOrders(ordersWithItems);
      
      // Calculate stats
      const totalOrders = ordersData?.length || 0;
      const totalSpent = ordersData?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const pendingOrders = ordersData?.filter(order => order.status === 'pending').length || 0;
      const completedOrders = ordersData?.filter(order => order.status === 'completed').length || 0;
      
      setStats({
        totalOrders,
        totalSpent,
        pendingOrders,
        completedOrders
      });
      
      console.log('Orders loaded:', totalOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      setError(error.message);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-accent text-white';
      case 'processing': return 'bg-blue-500 text-white';
      case 'shipped': return 'bg-purple-500 text-white';
      case 'delivered': return 'bg-success text-white';
      case 'completed': return 'bg-success text-white';
      case 'cancelled': return 'bg-destructive text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'processing': return <Package className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'delivered': return <Star className="w-4 h-4" />;
      case 'completed': return <Star className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-600">Please log in to view your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary-100 p-3 rounded-full">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome back, {profile.full_name || 'User'}!</h1>
              <p className="text-gray-600">{profile.email}</p>
            </div>
          </div>
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
                <ShoppingBag className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Spent</p>
                <p className="text-2xl font-bold text-primary">${stats.totalSpent.toFixed(2)}</p>
              </div>
              <div className="bg-accent-100 p-3 rounded-full">
                <Package className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Orders</p>
                <p className="text-2xl font-bold text-primary">{stats.pendingOrders}</p>
              </div>
              <div className="bg-warning-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-primary">{stats.completedOrders}</p>
              </div>
              <div className="bg-success-100 p-3 rounded-full">
                <Star className="w-6 h-6 text-success" />
              </div>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Your Orders</h2>
          </div>
          
          {error && (
            <div className="p-6 bg-red-50 border-l-4 border-red-500">
              <p className="text-red-700">Error: {error}</p>
            </div>
          )}
          
          {orders.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
              <p className="text-gray-600">Start shopping to see your orders here!</p>
            </div>
          ) : (
            <div className="divide-y">
              {orders.map((order) => (
                <div key={order.id} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        Order #{order.id.slice(-8)}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-lg font-semibold text-primary">
                        ${order.total_amount?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                  
                  {order.items && order.items.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600 mb-2">Items:</p>
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-3 text-sm">
                          <img 
                            src={item.products?.image_url || '/api/placeholder/60/60'} 
                            alt={item.products?.name || 'Product'}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div className="flex-1">
                            <p className="font-medium">{item.products?.name || 'Product'}</p>
                            <p className="text-gray-600">Quantity: {item.quantity}</p>
                          </div>
                          <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;