import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  addToCart: (product: any) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalPrice: () => number;
  getItemCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCartItems();
    } else {
      setItems([]);
    }
  }, [user]);

  const fetchCartItems = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('Fetching cart items for user:', user.id);
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (
            name,
            price,
            image_url
          )
        `)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Cart fetch error:', error);
        throw error;
      }
      
      const cartItems: CartItem[] = data?.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.products?.name || 'Unknown Product',
        price: item.products?.price || 0,
        quantity: item.quantity,
        image_url: item.products?.image_url || ''
      })) || [];
      
      console.log('Cart items loaded:', cartItems.length);
      setItems(cartItems);
    } catch (error: any) {
      console.error('Error fetching cart items:', error);
      toast.error('Failed to load cart items');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product: any) => {
    if (!user) {
      toast.error('Please log in to add items to cart');
      navigate('/login');
      return;
    }
    
    try {
      console.log('Adding to cart:', product.id, product.name);
      
      // Check if item already exists in cart
      const { data: existingItem, error: checkError } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Check existing item error:', checkError);
        throw checkError;
      }
      
      if (existingItem) {
        // Update quantity if item exists
        const { error: updateError } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);
        
        if (updateError) {
          console.error('Update quantity error:', updateError);
          throw updateError;
        }
        
        console.log('Cart item quantity updated');
      } else {
        // Add new item to cart
        const { error: insertError } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: product.id,
            quantity: 1
          });
        
        if (insertError) {
          console.error('Insert cart item error:', insertError);
          throw insertError;
        }
        
        console.log('New cart item added');
      }
      
      // Refresh cart items
      await fetchCartItems();
      
    } catch (error: any) {
      console.error('Add to cart error:', error);
      toast.error('Failed to add item to cart');
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!user) return;
    
    try {
      console.log('Removing from cart:', itemId);
      
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Remove from cart error:', error);
        throw error;
      }
      
      console.log('Cart item removed');
      
      // Refresh cart items
      await fetchCartItems();
      
    } catch (error: any) {
      console.error('Remove from cart error:', error);
      toast.error('Failed to remove item from cart');
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!user || quantity < 1) return;
    
    try {
      console.log('Updating quantity:', itemId, quantity);
      
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Update quantity error:', error);
        throw error;
      }
      
      console.log('Cart item quantity updated');
      
      // Update local state immediately for better UX
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, quantity } : item
      ));
      
    } catch (error: any) {
      console.error('Update quantity error:', error);
      toast.error('Failed to update quantity');
      // Refresh cart items on error
      await fetchCartItems();
    }
  };

  const clearCart = async () => {
    if (!user) return;
    
    try {
      console.log('Clearing cart for user:', user.id);
      
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Clear cart error:', error);
        throw error;
      }
      
      console.log('Cart cleared');
      setItems([]);
      
    } catch (error: any) {
      console.error('Clear cart error:', error);
      toast.error('Failed to clear cart');
    }
  };

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getItemCount = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  const value: CartContextType = {
    items,
    loading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getItemCount
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};