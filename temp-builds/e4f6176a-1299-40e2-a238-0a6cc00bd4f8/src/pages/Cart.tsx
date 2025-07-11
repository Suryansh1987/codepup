import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const Cart = () => {
  const { items, updateQuantity, removeFromCart, getTotalPrice, loading } = useCart();

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    try {
      await updateQuantity(itemId, newQuantity);
    } catch (error) {
      console.error('Update quantity error:', error);
      toast.error('Failed to update quantity');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeFromCart(itemId);
      toast.success('Item removed from cart');
    } catch (error) {
      console.error('Remove item error:', error);
      toast.error('Failed to remove item');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Shopping Cart</h1>
            <p className="text-gray-600">
              {items.length === 0 ? 'Your cart is empty' : `${items.length} item${items.length > 1 ? 's' : ''} in your cart`}
            </p>
          </div>

          {items.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-600 mb-6">Start shopping to add items to your cart!</p>
              <Link 
                to="/products" 
                className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Continue Shopping
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold text-gray-900">Cart Items</h2>
                  </div>
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="p-6">
                        <div className="flex items-center gap-4">
                          {/* Product Image */}
                          <img 
                            src={item.image_url || '/api/placeholder/100/100'} 
                            alt={item.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          
                          {/* Product Info */}
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.name}</h3>
                            <p className="text-primary font-semibold">${item.price?.toFixed(2) || '0.00'}</p>
                          </div>
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-12 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Item Total */}
                          <div className="text-right">
                            <p className="text-lg font-semibold text-gray-900">
                              ${((item.price || 0) * item.quantity).toFixed(2)}
                            </p>
                          </div>
                          
                          {/* Remove Button */}
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
                  
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">${getTotalPrice().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium text-success">Free</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium">${(getTotalPrice() * 0.08).toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between">
                        <span className="text-lg font-semibold text-gray-900">Total</span>
                        <span className="text-lg font-semibold text-primary">
                          ${(getTotalPrice() * 1.08).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <Link 
                    to="/checkout" 
                    className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 mb-3"
                  >
                    Proceed to Checkout
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  
                  <Link 
                    to="/products" 
                    className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Cart;